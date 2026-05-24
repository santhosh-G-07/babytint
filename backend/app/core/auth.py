from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import json
import secrets
from typing import Any
import uuid

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User, UserRole

settings = get_settings()
security = HTTPBearer(auto_error=False)
PASSWORD_HASH_ITERATIONS = 210_000


@dataclass
class AuthUser:
    id: str
    email: str
    name: str | None
    role: str
    access_token: str


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_HASH_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt}${digest}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        algorithm, iterations_raw, salt, expected = password_hash.split("$", 3)
        iterations = int(iterations_raw)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()
    return hmac.compare_digest(digest, expected)


def _local_uid_for_email(email: str) -> str:
    normalized = _normalize_email(email)
    return f"local:{hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:32]}"


def _hash_otp(email: str, otp: str) -> str:
    payload = f"{_normalize_email(email)}:{otp}".encode("utf-8")
    salt = settings.admin_token_salt.encode("utf-8")
    return hmac.new(salt, payload, hashlib.sha256).hexdigest()


def make_local_session_token(user: User) -> tuple[str, datetime]:
    expires_at = _utcnow() + timedelta(hours=settings.local_auth_token_hours)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "exp": int(expires_at.timestamp()),
    }
    raw_payload = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    encoded = base64.urlsafe_b64encode(raw_payload).decode("ascii").rstrip("=")
    signature = hmac.new(
        settings.admin_token_salt.encode("utf-8"),
        encoded.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return f"local.{encoded}.{signature}", expires_at


def authenticate_local_session_token(token: str, db: Session) -> AuthUser | None:
    if not token.startswith("local."):
        return None
    try:
        _, encoded, signature = token.split(".", 2)
    except ValueError:
        return None
    expected = hmac.new(
        settings.admin_token_salt.encode("utf-8"),
        encoded.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        padded = encoded + ("=" * (-len(encoded) % 4))
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
    except (ValueError, json.JSONDecodeError):
        return None
    if int(payload.get("exp", 0)) < int(_utcnow().timestamp()):
        return None

    try:
        user_id = uuid.UUID(str(payload.get("sub")))
    except ValueError:
        return None
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        return None
    return AuthUser(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        access_token=token,
    )


def _is_supabase_auth_configured() -> bool:
    return bool(
        settings.supabase_url
        and settings.supabase_service_key
        and settings.supabase_url.startswith(("http://", "https://")),
    )


def _is_local_admin_configured() -> bool:
    return bool(settings.admin_login_email.strip() and settings.admin_login_password)


def _local_admin_expected_email() -> str:
    return _normalize_email(settings.admin_login_email)


def _local_admin_token_for_credentials(email: str, password: str) -> str:
    payload = f"{_normalize_email(email)}:{password}".encode("utf-8")
    salt = settings.admin_token_salt.encode("utf-8")
    digest = hmac.new(salt, payload, hashlib.sha256).hexdigest()
    return f"local-admin.{digest}"


def _ensure_local_admin_user(db: Session) -> User:
    email = _local_admin_expected_email()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        local_uid = f"local-admin:{hashlib.sha256(email.encode('utf-8')).hexdigest()[:16]}"
        user = User(
            supabase_uid=local_uid,
            email=email,
            name="Local Admin",
            role=UserRole.admin,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    update_needed = False
    if user.role != UserRole.admin:
        user.role = UserRole.admin
        update_needed = True
    if user.email != email:
        user.email = email
        update_needed = True
    if update_needed:
        db.commit()
        db.refresh(user)
    return user


def authenticate_local_admin(email: str, password: str, db: Session) -> AuthUser | None:
    if not _is_local_admin_configured():
        return None

    normalized_email = _normalize_email(email)
    expected_email = _local_admin_expected_email()
    if normalized_email != expected_email:
        return None
    if not hmac.compare_digest(password, settings.admin_login_password):
        return None

    user = _ensure_local_admin_user(db)
    token, _ = make_local_session_token(user)
    return AuthUser(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        access_token=token,
    )


def authenticate_local_admin_token(token: str, db: Session) -> AuthUser | None:
    local_session = authenticate_local_session_token(token, db)
    if local_session is not None and local_session.role == UserRole.admin.value:
        return local_session

    if not _is_local_admin_configured():
        return None

    expected_token = _local_admin_token_for_credentials(
        _local_admin_expected_email(),
        settings.admin_login_password,
    )
    if not hmac.compare_digest(token, expected_token):
        return None

    user = _ensure_local_admin_user(db)
    return AuthUser(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        access_token=token,
    )


async def _fetch_supabase_user(token: str) -> dict[str, Any]:
    if not _is_supabase_auth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication provider is not configured on backend.",
        )

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {token}",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url, headers=headers)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is unavailable. Try again later.",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )
    return response.json()


def _first_non_empty_name(payload: dict[str, Any]) -> str | None:
    user_meta = payload.get("user_metadata") or {}
    return user_meta.get("name") or user_meta.get("full_name")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token is required.",
        )

    token = credentials.credentials
    local_session = authenticate_local_session_token(token, db)
    if local_session is not None:
        return local_session

    local_admin = authenticate_local_admin_token(token, db)
    if local_admin is not None:
        return local_admin

    payload = await _fetch_supabase_user(token)

    supabase_uid = payload.get("id")
    email = payload.get("email")

    if not supabase_uid or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed Supabase auth payload.",
        )

    user = db.scalar(select(User).where(User.supabase_uid == str(supabase_uid)))
    if user is None:
        user = User(
            supabase_uid=str(supabase_uid),
            email=str(email),
            name=_first_non_empty_name(payload),
            role=UserRole.customer,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        update_needed = False
        new_name = _first_non_empty_name(payload)
        if user.email != email:
            user.email = email
            update_needed = True
        if new_name and user.name != new_name:
            user.name = new_name
            update_needed = True
        if update_needed:
            db.commit()
            db.refresh(user)

    return AuthUser(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        access_token=token,
    )


async def require_admin(current: AuthUser = Depends(get_current_user)) -> AuthUser:
    if current.role != UserRole.admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current
