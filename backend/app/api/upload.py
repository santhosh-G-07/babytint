import io
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.auth import AuthUser, require_admin
from app.core.config import get_settings
from app.services.storage import upload_bytes

router = APIRouter(prefix="/upload")
settings = get_settings()
ALLOWED_UPLOAD_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _validate_and_sanitize_image(file: UploadFile, data: bytes) -> tuple[bytes, str, str]:
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload.")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Image is too large.")

    content_type = (file.content_type or "").lower()
    ext = Path(file.filename or "").suffix.lower()
    if content_type not in ALLOWED_UPLOAD_TYPES or ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Use JPG, PNG, or WEBP images only.")

    try:
        with Image.open(io.BytesIO(data)) as source:
            source.verify()
        with Image.open(io.BytesIO(data)) as source:
            width, height = source.size
            if width <= 0 or height <= 0 or width * height > settings.max_upload_pixels:
                raise HTTPException(status_code=413, detail="Image dimensions are too large.")

            image = ImageOps.exif_transpose(source).convert("RGBA")
            output = io.BytesIO()
            if content_type == "image/jpeg":
                image.convert("RGB").save(output, format="JPEG", quality=95, optimize=True)
                return output.getvalue(), ".jpg", "image/jpeg"
            if content_type == "image/webp":
                image.save(output, format="WEBP", quality=95, method=6)
                return output.getvalue(), ".webp", "image/webp"
            image.save(output, format="PNG", optimize=True)
            return output.getvalue(), ".png", "image/png"
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.") from exc


def _is_local_request(request: Request) -> bool:
    hostname = (request.url.hostname or "").lower()
    return hostname in {"localhost", "127.0.0.1", "0.0.0.0", "testserver"}


def _public_upload_url(request: Request, *, bucket: str, path: str, url: str) -> str:
    if "/local-storage/" not in url or not _is_local_request(request):
        return url
    return f"{str(request.base_url).rstrip('/')}/local-storage/{bucket}/{path}"


def _upload_image_bytes(*, request: Request, bucket: str, filename: str, content_type: str, data: bytes) -> dict:
    try:
        uploaded = upload_bytes(
            bucket=bucket,
            file_bytes=data,
            filename=filename,
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Storage service is unavailable. Please try again later.",
        ) from exc

    return {
        "bucket": uploaded.bucket,
        "path": uploaded.path,
        "url": _public_upload_url(
            request,
            bucket=uploaded.bucket,
            path=uploaded.path,
            url=uploaded.public_url,
        ),
    }


@router.post("/image")
async def upload_image(request: Request, file: UploadFile = File(...)) -> dict:
    data = await file.read()
    sanitized, ext, content_type = _validate_and_sanitize_image(file, data)

    return _upload_image_bytes(
        request=request,
        bucket=settings.storage_bucket_uploads,
        filename=f"{Path(file.filename or 'upload').stem}{ext}",
        content_type=content_type,
        data=sanitized,
    )


@router.post("/frame")
async def upload_frame_asset(
    request: Request,
    file: UploadFile = File(...),
    _: AuthUser = Depends(require_admin),
) -> dict:
    data = await file.read()
    sanitized, ext, content_type = _validate_and_sanitize_image(file, data)

    return _upload_image_bytes(
        request=request,
        bucket=settings.storage_bucket_frames,
        filename=f"{Path(file.filename or 'frame').stem}{ext}",
        content_type=content_type,
        data=sanitized,
    )
