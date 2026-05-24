import mimetypes
import os
import uuid
from dataclasses import dataclass
from pathlib import Path

from supabase import Client, create_client

from app.core.config import get_settings

settings = get_settings()
LOCAL_STORAGE_ROOT = Path("local_storage")


def _supabase() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _is_supabase_configured() -> bool:
    return bool(
        settings.supabase_url
        and settings.supabase_service_key
        and settings.supabase_url.startswith("http"),
    )


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
    bucket_dir = LOCAL_STORAGE_ROOT / bucket
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
    if not _is_supabase_configured():
        if settings.app_env.lower() == "development" or settings.allow_local_storage_fallback:
            return _local_upload(bucket=bucket, file_bytes=file_bytes, filename=filename)
        raise RuntimeError("Supabase storage is not configured.")

    try:
        client = _supabase()
        ext = Path(filename).suffix or ".bin"
        key = f"{uuid.uuid4()}{ext}"

        if content_type is None:
            content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

        client.storage.from_(bucket).upload(
            key,
            file_bytes,
            file_options={
                "content-type": content_type,
                "upsert": upsert,
            },
        )
        public_url_obj = client.storage.from_(bucket).get_public_url(key)
        if isinstance(public_url_obj, dict):
            public_url = str(public_url_obj.get("publicUrl", ""))
        else:
            public_url = str(public_url_obj)
        return StorageUploadResult(bucket=bucket, path=key, public_url=public_url)
    except Exception:
        if settings.app_env.lower() == "development" or settings.allow_local_storage_fallback:
            return _local_upload(bucket=bucket, file_bytes=file_bytes, filename=filename)
        raise


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
