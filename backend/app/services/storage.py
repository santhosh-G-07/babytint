import os
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()


def resolve_local_storage_root(settings_obj: object) -> Path:
    configured = str(getattr(settings_obj, "local_storage_root", "")).strip()
    if configured:
        return Path(configured)

    database_url = str(getattr(settings_obj, "database_url", ""))
    sqlite_prefix = "sqlite:///"
    if database_url.startswith(sqlite_prefix):
        raw_db_path = database_url[len(sqlite_prefix) :]
        db_path = Path(raw_db_path)
        if raw_db_path.startswith("/") or db_path.is_absolute():
            return db_path.parent / "local_storage"

    return Path("local_storage")


def get_local_storage_root() -> Path:
    return resolve_local_storage_root(settings)


def get_public_base_url() -> str:
    return _public_base_url()


def _public_base_url() -> str:
    configured = settings.public_base_url.strip()
    if configured:
        return configured.rstrip("/")

    railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip()
    if railway_domain:
        return f"https://{railway_domain}"

    host = settings.app_host
    if host in {"0.0.0.0", "::"}:
        host = "127.0.0.1"
    scheme = "https" if settings.app_port == 443 else "http"
    port = settings.app_port
    if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
        return f"{scheme}://{host}"
    return f"{scheme}://{host}:{port}"


@dataclass
class StorageUploadResult:
    bucket: str
    path: str
    public_url: str


def _local_upload(
    *,
    bucket: str,
    file_bytes: bytes,
    filename: str,
) -> StorageUploadResult:
    ext = Path(filename).suffix or ".bin"
    key = f"{uuid.uuid4()}{ext}"
    bucket_dir = get_local_storage_root() / bucket
    bucket_dir.mkdir(parents=True, exist_ok=True)
    destination = bucket_dir / key
    destination.write_bytes(file_bytes)

    public_url = f"{_public_base_url()}/local-storage/{bucket}/{key}"

    return StorageUploadResult(bucket=bucket, path=key, public_url=public_url)


def upload_bytes(
    *,
    bucket: str,
    file_bytes: bytes,
    filename: str,
    content_type: str | None = None,
    upsert: bool = False,
) -> StorageUploadResult:
    return _local_upload(bucket=bucket, file_bytes=file_bytes, filename=filename)


def upload_file(
    *,
    bucket: str,
    local_path: str,
    content_type: str | None = None,
) -> StorageUploadResult:
    file_path = Path(local_path)
    with file_path.open("rb") as f:
        data = f.read()
    return upload_bytes(
        bucket=bucket,
        file_bytes=data,
        filename=file_path.name,
        content_type=content_type,
    )
