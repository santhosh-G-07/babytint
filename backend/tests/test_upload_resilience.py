import io

from PIL import Image

from app.api import upload
from app.core.auth import AuthUser, require_admin


def _tiny_png() -> bytes:
    output = io.BytesIO()
    Image.new("RGBA", (1, 1), (255, 255, 255, 255)).save(output, format="PNG")
    return output.getvalue()


def test_upload_image_storage_failure_returns_503(client, monkeypatch):
    def fail_upload(**_kwargs):
        raise RuntimeError("storage down")

    monkeypatch.setattr(upload, "upload_bytes", fail_upload)

    response = client.post(
        "/api/upload/image",
        files={"file": ("tiny.png", _tiny_png(), "image/png")},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Storage service is unavailable. Please try again later."


def test_upload_frame_storage_failure_returns_503(client, monkeypatch):
    from app.main import app

    async def fake_admin():
        return AuthUser(
            id="11111111-1111-1111-1111-111111111111",
            email="admin@example.com",
            name="Admin",
            role="admin",
            access_token="test-token",
        )

    def fail_upload(**_kwargs):
        raise RuntimeError("storage down")

    app.dependency_overrides[require_admin] = fake_admin
    monkeypatch.setattr(upload, "upload_bytes", fail_upload)

    response = client.post(
        "/api/upload/frame",
        files={"file": ("tiny.png", _tiny_png(), "image/png")},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Storage service is unavailable. Please try again later."
