import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import (
    AuthUser,
    _hash_otp,
    _local_uid_for_email,
    _normalize_email,
    _utcnow,
    authenticate_local_admin,
    get_current_user,
    hash_password,
    make_local_session_token,
    verify_password,
)
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import rate_limiter
from app.models.user import User
from app.schemas.user import UserRead
from app.services.email import is_smtp_configured, send_password_reset_otp

router = APIRouter(prefix="/auth")
settings = get_settings()

MAX_OTP_ATTEMPTS = 5
OTP_LOCKOUT_MINUTES = 15

_login_rate_limit = Depends(rate_limiter("login", limit=10, window_seconds=300))
_admin_login_rate_limit = Depends(rate_limiter("admin-login", limit=10, window_seconds=300))
_register_rate_limit = Depends(rate_limiter("register", limit=10, window_seconds=300))
_otp_request_rate_limit = Depends(rate_limiter("otp-request", limit=5, window_seconds=600))
_otp_confirm_rate_limit = Depends(rate_limiter("otp-confirm", limit=10, window_seconds=600))


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    expires_at: str | None = None


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LocalAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    expires_at: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=12)
    password: str = Field(min_length=6, max_length=128)


class OkResponse(BaseModel):
    ok: bool = True
    dev_otp: str | None = None


@router.post("/logout", response_model=OkResponse)
def logout(
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OkResponse:
    user = db.scalar(select(User).where(User.id == uuid.UUID(current.id)))
    if user is not None:
        user.session_version += 1
        db.commit()
    return OkResponse()


@router.get("/me", response_model=UserRead)
def auth_me(
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user = db.scalar(select(User).where(User.id == uuid.UUID(current.id)))
    if user is None:
        raise HTTPException(status_code=404, detail="User record not found.")
    return user


@router.post("/admin/login", response_model=AdminLoginResponse, dependencies=[_admin_login_rate_limit])
def admin_login(
    payload: AdminLoginRequest,
    db: Session = Depends(get_db),
) -> AdminLoginResponse:
    auth_user = authenticate_local_admin(payload.email, payload.password, db)
    if auth_user is None:
        raise HTTPException(status_code=401, detail="Invalid admin credentials.")

    return AdminLoginResponse(
        access_token=auth_user.access_token,
        role=auth_user.role,
        expires_at=None,
    )


@router.post("/register", response_model=LocalAuthResponse, status_code=201, dependencies=[_register_rate_limit])
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> LocalAuthResponse:
    email = _normalize_email(str(payload.email))
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account already exists for this email.")

    user = User(
        auth_uid=_local_uid_for_email(email),
        email=email,
        name=payload.name.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account already exists for this email.")
    db.refresh(user)

    token, expires_at = make_local_session_token(user)
    return LocalAuthResponse(
        access_token=token,
        role=user.role.value,
        expires_at=expires_at.isoformat(),
    )


@router.post("/login", response_model=LocalAuthResponse, dependencies=[_login_rate_limit])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LocalAuthResponse:
    email = _normalize_email(str(payload.email))
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token, expires_at = make_local_session_token(user)
    return LocalAuthResponse(
        access_token=token,
        role=user.role.value,
        expires_at=expires_at.isoformat(),
    )


def _aware(value: datetime | None, now: datetime) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=now.tzinfo)
    return value


@router.post("/password-reset/request", response_model=OkResponse, dependencies=[_otp_request_rate_limit])
def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> OkResponse:
    email = _normalize_email(str(payload.email))
    user = db.scalar(select(User).where(User.email == email))
    otp = f"{uuid.uuid4().int % 1_000_000:06d}"
    dev_otp = None
    now = _utcnow()

    if user is not None and user.password_hash:
        locked_until = _aware(user.password_reset_locked_until, now)
        if locked_until is not None and locked_until > now:
            # Account is in an active OTP lockout from repeated wrong
            # attempts -- don't issue a fresh OTP (that would just reset the
            # attacker's attempt budget). Respond identically to the normal
            # success case so this doesn't leak lockout state to a caller.
            return OkResponse(dev_otp=dev_otp)

        user.password_reset_code_hash = _hash_otp(email, otp)
        user.password_reset_expires_at = now + timedelta(minutes=settings.password_reset_otp_minutes)
        user.password_reset_sent_at = now
        user.password_reset_failed_attempts = 0
        db.commit()

        if is_smtp_configured():
            try:
                send_password_reset_otp(to_email=email, otp=otp)
            except Exception as exc:
                raise HTTPException(status_code=503, detail="Could not send reset OTP. Try again later.") from exc
        elif settings.app_env.lower() == "development":
            dev_otp = otp

    return OkResponse(dev_otp=dev_otp)


@router.post("/password-reset/confirm", response_model=OkResponse, dependencies=[_otp_confirm_rate_limit])
def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> OkResponse:
    email = _normalize_email(str(payload.email))
    user = db.scalar(select(User).where(User.email == email))
    now = _utcnow()

    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    locked_until = _aware(user.password_reset_locked_until, now)
    if locked_until is not None and locked_until > now:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    expires_at = _aware(user.password_reset_expires_at, now)

    otp_matches = bool(
        user.password_reset_code_hash
        and expires_at is not None
        and expires_at >= now
        and hmac_safe_compare(user.password_reset_code_hash, _hash_otp(email, payload.otp.strip()))
    )

    if not otp_matches:
        user.password_reset_failed_attempts += 1
        if user.password_reset_failed_attempts >= MAX_OTP_ATTEMPTS:
            # Lock the account out of further attempts AND further OTP
            # requests for a cooldown window, and invalidate the current
            # OTP so it can't keep being guessed during the lockout.
            user.password_reset_locked_until = now + timedelta(minutes=OTP_LOCKOUT_MINUTES)
            user.password_reset_failed_attempts = 0
            user.password_reset_code_hash = None
            user.password_reset_expires_at = None
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    user.password_hash = hash_password(payload.password)
    user.password_reset_code_hash = None
    user.password_reset_expires_at = None
    user.password_reset_sent_at = None
    user.password_reset_failed_attempts = 0
    user.password_reset_locked_until = None
    db.commit()
    return OkResponse()


def hmac_safe_compare(left: str, right: str) -> bool:
    import hmac

    return hmac.compare_digest(left, right)
