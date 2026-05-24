import io
import uuid
from types import SimpleNamespace

from PIL import Image

from app.services import image_composer


def test_compose_print_png_outputs_300_dpi(monkeypatch):
    frame_image = Image.new("RGBA", (1200, 900), (255, 255, 255, 0))
    source_image = Image.new("RGBA", (900, 900), (210, 60, 60, 255))

    def fake_open_image(url: str):
        if "frame" in url:
            return frame_image.copy()
        return source_image.copy()

    monkeypatch.setattr(image_composer, "_open_image_from_url", fake_open_image)

    result = image_composer.compose_print_png(
        frame_asset_url="https://example.com/frame.png",
        slot_positions=[
            {"slot_id": 1, "x": 100, "y": 120, "width": 300, "height": 240, "shape": "rect"}
        ],
        customization_data={
            "slots": [
                {
                    "slot_id": 1,
                    "image_url": "https://example.com/source.png",
                    "adjustments": {
                        "brightness": 1.0,
                        "contrast": 1.0,
                        "saturation": 1.0,
                        "rotation": 0,
                        "cropX": 0,
                        "cropY": 0,
                        "cropW": 0,
                        "cropH": 0,
                        "flipX": False,
                        "flipY": False,
                    },
                }
            ]
        },
    )

    output = Image.open(io.BytesIO(result))
    dpi = output.info.get("dpi")

    assert output.size == (1200, 900)
    assert dpi is not None
    assert abs(float(dpi[0]) - 300.0) < 1.0
    assert abs(float(dpi[1]) - 300.0) < 1.0


def test_compose_print_png_supports_free_shape_and_text(monkeypatch):
    frame_image = Image.new("RGBA", (400, 300), (255, 255, 255, 0))
    source_image = Image.new("RGBA", (400, 400), (20, 80, 210, 255))

    def fake_open_image(url: str):
        if "frame" in url:
            return frame_image.copy()
        return source_image.copy()

    monkeypatch.setattr(image_composer, "_open_image_from_url", fake_open_image)

    result = image_composer.compose_print_png(
        frame_asset_url="https://example.com/frame.png",
        slot_positions=[
            {
                "slot_id": 1,
                "x": 50,
                "y": 40,
                "width": 200,
                "height": 200,
                "shape": "free",
                "points": [{"x": 0, "y": 0}, {"x": 1, "y": 0}, {"x": 0, "y": 1}],
            }
        ],
        text_positions=[
            {
                "text_id": 1,
                "x": 20,
                "y": 245,
                "width": 360,
                "height": 40,
                "font_family": "Arial",
                "font_weight": "normal",
                "font_size": 24,
                "color": "#111111",
                "align": "center",
            }
        ],
        customization_data={
            "slots": [
                {
                    "slot_id": 1,
                    "image_url": "https://example.com/source.png",
                    "adjustments": {},
                }
            ],
            "texts": [{"text_id": 1, "value": "Baby A", "font_family": "Arial", "font_weight": "normal"}],
        },
    )

    output = Image.open(io.BytesIO(result)).convert("RGBA")

    assert output.getpixel((60, 50))[3] > 0
    assert output.getpixel((240, 230))[3] == 0


def test_compose_print_png_renders_photo_above_opaque_frame_slot(monkeypatch):
    frame_image = Image.new("RGBA", (400, 300), (255, 255, 255, 255))
    source_image = Image.new("RGBA", (400, 400), (10, 120, 220, 255))

    def fake_open_image(url: str):
        if "frame" in url:
            return frame_image.copy()
        return source_image.copy()

    monkeypatch.setattr(image_composer, "_open_image_from_url", fake_open_image)

    result = image_composer.compose_print_png(
        frame_asset_url="https://example.com/frame.png",
        slot_positions=[
            {"slot_id": 1, "x": 80, "y": 60, "width": 120, "height": 120, "shape": "rect"}
        ],
        customization_data={
            "slots": [
                {
                    "slot_id": 1,
                    "image_url": "https://example.com/source.png",
                    "adjustments": {},
                }
            ]
        },
    )

    output = Image.open(io.BytesIO(result)).convert("RGBA")

    assert output.getpixel((120, 100))[:3] == (10, 120, 220)
    assert output.getpixel((20, 20))[:3] == (255, 255, 255)


class _FakeSessionContext:
    def __init__(self, db):
        self.db = db

    def __enter__(self):
        return self.db

    def __exit__(self, exc_type, exc, tb):
        return False


class _FakeDB:
    def __init__(self, order_item):
        self.order_item = order_item
        self.commits = 0

    def scalar(self, _statement):
        return self.order_item

    def commit(self):
        self.commits += 1


def test_generate_order_item_print_file_uploads_to_print_bucket(monkeypatch):
    frame = SimpleNamespace(
        frame_asset_url="https://example.com/frame.png",
        slot_positions=[{"slot_id": 1, "x": 0, "y": 0, "width": 100, "height": 100, "shape": "rect"}],
    )
    order_item = SimpleNamespace(
        id=uuid.uuid4(),
        frame=frame,
        customization_data={"slots": []},
        print_file_url=None,
    )
    fake_db = _FakeDB(order_item)

    captured: dict = {}

    png_buffer = io.BytesIO()
    Image.new("RGBA", (32, 32), (0, 0, 0, 0)).save(png_buffer, format="PNG", dpi=(300, 300))
    png_bytes = png_buffer.getvalue()

    def fake_session_local():
        return _FakeSessionContext(fake_db)

    def fake_compose_print_png(**_kwargs):
        return png_bytes

    def fake_upload_file(*, bucket: str, local_path: str, content_type: str):
        captured["bucket"] = bucket
        captured["local_path"] = local_path
        captured["content_type"] = content_type
        return SimpleNamespace(public_url="https://cdn.example.com/print-ready/final.png")

    monkeypatch.setattr(image_composer, "SessionLocal", fake_session_local)
    monkeypatch.setattr(image_composer, "compose_print_png", fake_compose_print_png)
    monkeypatch.setattr(image_composer, "upload_file", fake_upload_file)
    monkeypatch.setattr(image_composer.settings, "storage_bucket_prints", "print-ready-test")

    result = image_composer.generate_order_item_print_file(order_item.id)

    assert result == "https://cdn.example.com/print-ready/final.png"
    assert order_item.print_file_url == "https://cdn.example.com/print-ready/final.png"
    assert fake_db.commits == 1
    assert captured["bucket"] == "print-ready-test"
    assert captured["content_type"] == "image/png"
