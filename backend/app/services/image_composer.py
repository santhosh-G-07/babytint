import io
import logging
import os
import uuid
from pathlib import Path
from tempfile import NamedTemporaryFile

import httpx
from PIL import Image, ImageColor, ImageDraw, ImageEnhance, ImageFont, ImageOps
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.order import OrderItem, PrintFileStatus
from app.services.storage import upload_file
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
TRANSPARENT_ALPHA_THRESHOLD = 245
TRANSPARENT_RATIO_FOR_FRAME_HOLE = 0.15
SAMPLE_SIZE = 120

FONT_FILES: dict[str, dict[str, list[str]]] = {
    "segoe script": {
        "normal": ["segoesc.ttf", "Segoe Script.ttf"],
        "bold": ["segoescb.ttf", "Segoe Script Bold.ttf", "segoesc.ttf"],
    },
    "gabriola": {
        "normal": ["gabriola.ttf", "Gabriola.ttf"],
        "bold": ["gabriola.ttf", "Gabriola.ttf"],
    },
    "mv boli": {
        "normal": ["mvboli.ttf", "MV Boli.ttf"],
        "bold": ["mvboli.ttf", "MV Boli.ttf"],
    },
    "leelawadee": {
        "normal": ["leelawad.ttf", "LeelawUI.ttf", "LeelawUI-Regular.ttf"],
        "bold": ["leelawdb.ttf", "LeelawUI-Bold.ttf", "LeelawUI.ttf"],
    },
    "kristen itc": {
        "normal": ["itckrist.ttf", "Kristen ITC.ttf"],
        "bold": ["itckrist.ttf", "Kristen ITC.ttf"],
    },
    "hobo std": {
        "normal": ["HoboStd.otf", "HoboStd.ttf", "hobo.ttf"],
        "bold": ["HoboStd.otf", "HoboStd.ttf", "hobo.ttf"],
    },
    "illuma": {
        "normal": ["Illuma.ttf", "ILLUMA.TTF"],
        "bold": ["Illuma.ttf", "ILLUMA.TTF"],
    },
    "montserrat": {
        "normal": ["Montserrat-Regular.ttf", "Montserrat.ttf"],
        "bold": ["Montserrat-Bold.ttf", "Montserrat-SemiBold.ttf", "Montserrat-Regular.ttf"],
    },
    "arial": {
        "normal": ["arial.ttf", "Arial.ttf", "Arial.ttf"],
        "bold": ["arialbd.ttf", "Arial Bold.ttf", "Arial.ttf"],
    },
    "cambria": {
        "normal": ["cambria.ttc", "cambria.ttf", "Cambria.ttf"],
        "bold": ["cambriab.ttf", "cambria.ttc", "Cambria.ttf"],
    },
}


def _open_image_from_url(url: str) -> Image.Image:
    with httpx.Client(timeout=20) as client:
        response = client.get(url)
        response.raise_for_status()
    return Image.open(io.BytesIO(response.content)).convert("RGBA")


def _apply_adjustments(img: Image.Image, adjustments: dict) -> Image.Image:
    crop_x = int(adjustments.get("cropX", 0))
    crop_y = int(adjustments.get("cropY", 0))
    crop_w = int(adjustments.get("cropW", 0))
    crop_h = int(adjustments.get("cropH", 0))

    if crop_w > 0 and crop_h > 0:
        right = min(img.width, crop_x + crop_w)
        bottom = min(img.height, crop_y + crop_h)
        left = max(0, crop_x)
        top = max(0, crop_y)
        if right > left and bottom > top:
            img = img.crop((left, top, right, bottom))

    brightness = float(adjustments.get("brightness", 1.0))
    contrast = float(adjustments.get("contrast", 1.0))
    saturation = float(adjustments.get("saturation", 1.0))
    rotation = float(adjustments.get("rotation", 0.0))
    flip_x = bool(adjustments.get("flipX", False))
    flip_y = bool(adjustments.get("flipY", False))

    if brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(brightness)
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    if saturation != 1.0:
        img = ImageEnhance.Color(img).enhance(saturation)
    if flip_x:
        img = ImageOps.mirror(img)
    if flip_y:
        img = ImageOps.flip(img)
    if rotation:
        img = img.rotate(rotation, expand=True, resample=Image.Resampling.BICUBIC)

    return img


def _normalized_points(slot_shape: dict) -> list[tuple[float, float]]:
    raw_points = slot_shape.get("points") or []
    points: list[tuple[float, float]] = []
    for point in raw_points:
        try:
            px = min(1.0, max(0.0, float(point.get("x", 0))))
            py = min(1.0, max(0.0, float(point.get("y", 0))))
        except (TypeError, ValueError, AttributeError):
            continue
        points.append((px, py))

    if len(points) >= 3:
        return points

    return [(0.08, 0.08), (0.92, 0.04), (0.98, 0.76), (0.66, 0.98), (0.08, 0.9), (0.02, 0.3)]


def _apply_slot_mask(slot_layer: Image.Image, slot_shape: dict, width: int, height: int) -> None:
    shape = str(slot_shape.get("shape", "rect")).lower()
    if shape == "circle":
        mask = Image.new("L", (width, height), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, width, height), fill=255)
        slot_layer.putalpha(mask)
        return

    if shape in {"free", "polygon"}:
        mask = Image.new("L", (width, height), 0)
        draw = ImageDraw.Draw(mask)
        polygon = [(int(px * width), int(py * height)) for px, py in _normalized_points(slot_shape)]
        draw.polygon(polygon, fill=255)
        slot_layer.putalpha(mask)


def _point_in_slot_shape(slot_shape: dict, x: float, y: float) -> bool:
    shape = str(slot_shape.get("shape", "rect")).lower()
    if shape == "circle":
        dx = x - 0.5
        dy = y - 0.5
        return dx * dx + dy * dy <= 0.25

    if shape in {"free", "polygon"}:
        points = _normalized_points(slot_shape)
        inside = False
        j = len(points) - 1
        for i, point in enumerate(points):
            prev = points[j]
            intersects = (point[1] > y) != (prev[1] > y) and x < (
                (prev[0] - point[0]) * (y - point[1]) / (prev[1] - point[1]) + point[0]
            )
            if intersects:
                inside = not inside
            j = i
        return inside

    return True


def _slot_should_render_above_frame(frame: Image.Image, slot_shape: dict) -> bool:
    try:
        width = int(slot_shape["width"])
        height = int(slot_shape["height"])
        x = int(slot_shape["x"])
        y = int(slot_shape["y"])
    except (KeyError, TypeError, ValueError):
        return False

    if width <= 0 or height <= 0:
        return False

    sample_width = max(8, min(SAMPLE_SIZE, width))
    sample_height = max(8, min(SAMPLE_SIZE, height))
    sample = frame.crop((x, y, x + width, y + height)).resize(
        (sample_width, sample_height),
        Image.Resampling.BILINEAR,
    )

    sampled = 0
    transparent = 0
    pixels = sample.getdata()
    for index, pixel in enumerate(pixels):
        sx = index % sample_width
        sy = index // sample_width
        nx = (sx + 0.5) / sample_width
        ny = (sy + 0.5) / sample_height
        if not _point_in_slot_shape(slot_shape, nx, ny):
            continue
        sampled += 1
        if pixel[3] < TRANSPARENT_ALPHA_THRESHOLD:
            transparent += 1

    if sampled == 0:
        return False

    return transparent / sampled < TRANSPARENT_RATIO_FOR_FRAME_HOLE


def _font_search_roots() -> list[Path]:
    backend_root = Path(__file__).resolve().parents[2]
    configured = os.environ.get("BABYTINT_FONT_DIR")
    roots = [
        backend_root / "assets" / "fonts",
        backend_root / "local_storage" / "fonts",
        Path("C:/Windows/Fonts"),
        Path("/usr/share/fonts/truetype"),
        Path("/usr/share/fonts/opentype"),
        Path("/usr/local/share/fonts"),
    ]
    if configured:
        roots.insert(0, Path(configured))
    return roots


def _load_font(family: str, size: int, weight: str) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    font_family = family.strip().lower()
    font_weight = "bold" if str(weight).lower() == "bold" else "normal"
    candidate_files = FONT_FILES.get(font_family, FONT_FILES["arial"]).get(font_weight, [])
    candidate_files += FONT_FILES.get(font_family, FONT_FILES["arial"]).get("normal", [])
    candidate_files += FONT_FILES["arial"].get(font_weight, []) + FONT_FILES["arial"]["normal"]

    for root in _font_search_roots():
        if not root.exists():
            continue
        for filename in candidate_files:
            direct = root / filename
            if direct.exists():
                try:
                    return ImageFont.truetype(str(direct), size=size)
                except OSError:
                    continue

    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf" if font_weight == "bold" else "DejaVuSans.ttf", size=size)
    except OSError:
        return ImageFont.load_default()


def _text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont | ImageFont.ImageFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return int(bbox[2] - bbox[0])


def _wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    lines: list[str] = []
    for raw_line in text.splitlines() or [text]:
        words = raw_line.split()
        if not words:
            lines.append("")
            continue

        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if _text_width(draw, candidate, font) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def _parse_color(value: str) -> tuple[int, int, int, int]:
    try:
        parsed = ImageColor.getrgb(value)
    except ValueError:
        parsed = (28, 25, 23)
    if len(parsed) == 4:
        return parsed
    return parsed[0], parsed[1], parsed[2], 255


def _draw_text_positions(
    image: Image.Image,
    text_positions: list[dict] | None,
    customization_data: dict,
) -> None:
    if not text_positions:
        return

    text_overrides = {
        int(item.get("text_id", 0)): item
        for item in customization_data.get("texts", [])
        if isinstance(item, dict)
    }
    draw = ImageDraw.Draw(image)

    for text_shape in text_positions:
        try:
            text_id = int(text_shape.get("text_id", 0))
        except (TypeError, ValueError):
            continue

        override = text_overrides.get(text_id, {})
        value = str(override.get("value", text_shape.get("default_text") or "")).strip()
        if not value:
            continue

        x = int(text_shape.get("x", 0))
        y = int(text_shape.get("y", 0))
        width = max(1, int(text_shape.get("width", 1)))
        height = max(1, int(text_shape.get("height", 1)))
        family = str(override.get("font_family") or text_shape.get("font_family") or "Arial")
        weight = str(override.get("font_weight") or text_shape.get("font_weight") or "normal")
        font_size = max(1, int(float(text_shape.get("font_size", 72))))
        align = str(text_shape.get("align", "center")).lower()
        color = _parse_color(str(text_shape.get("color", "#1c1917")))

        font = _load_font(family, font_size, weight)
        lines = _wrap_text(draw, value, font, width)
        bbox = draw.textbbox((0, 0), "Ay", font=font)
        line_height = max(1, int((bbox[3] - bbox[1]) * 1.2))
        total_height = line_height * len(lines)
        cursor_y = y + max(0, int((height - total_height) / 2))

        for line in lines:
            line_width = _text_width(draw, line, font)
            if align == "right":
                cursor_x = x + max(0, width - line_width)
            elif align == "left":
                cursor_x = x
            else:
                cursor_x = x + max(0, int((width - line_width) / 2))
            draw.text((cursor_x, cursor_y), line, fill=color, font=font)
            cursor_y += line_height


def compose_print_png(
    *,
    frame_asset_url: str,
    slot_positions: list[dict],
    customization_data: dict,
    text_positions: list[dict] | None = None,
) -> bytes:
    frame = _open_image_from_url(frame_asset_url)
    slot_map = {int(s["slot_id"]): s for s in slot_positions}

    behind_frame = Image.new("RGBA", frame.size, (255, 255, 255, 0))
    above_frame = Image.new("RGBA", frame.size, (255, 255, 255, 0))

    slots = customization_data.get("slots", [])
    for slot in slots:
        slot_id = int(slot.get("slot_id", 0))
        slot_shape = slot_map.get(slot_id)
        if not slot_shape:
            continue

        image_url = slot.get("image_url")
        if not image_url:
            continue

        source = _open_image_from_url(image_url)
        source = _apply_adjustments(source, slot.get("adjustments", {}))

        width = int(slot_shape["width"])
        height = int(slot_shape["height"])
        x = int(slot_shape["x"])
        y = int(slot_shape["y"])
        scale = float(slot.get("adjustments", {}).get("scale", 1.0))
        offset_x = int(slot.get("adjustments", {}).get("offsetX", 0))
        offset_y = int(slot.get("adjustments", {}).get("offsetY", 0))

        base = ImageOps.fit(source, (width, height), method=Image.Resampling.LANCZOS)
        if scale != 1.0:
            scaled_w = max(1, int(width * scale))
            scaled_h = max(1, int(height * scale))
            base = base.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)

        slot_layer = Image.new("RGBA", (width, height), (255, 255, 255, 0))
        paste_x = int((width - base.width) / 2 + offset_x)
        paste_y = int((height - base.height) / 2 + offset_y)
        slot_layer.alpha_composite(base, dest=(paste_x, paste_y))

        _apply_slot_mask(slot_layer, slot_shape, width, height)

        if _slot_should_render_above_frame(frame, slot_shape):
            above_frame.alpha_composite(slot_layer, dest=(x, y))
        else:
            behind_frame.alpha_composite(slot_layer, dest=(x, y))

    final = Image.alpha_composite(behind_frame, frame)
    final.alpha_composite(above_frame)
    _draw_text_positions(final, text_positions, customization_data)
    output = io.BytesIO()
    final.save(output, format="PNG", dpi=(300, 300))
    return output.getvalue()


def generate_order_item_print_file(order_item_id: str | uuid.UUID) -> str:
    order_item_uuid = uuid.UUID(str(order_item_id))

    with SessionLocal() as db:
        order_item = db.scalar(
            select(OrderItem).where(OrderItem.id == order_item_uuid).join(OrderItem.frame)
        )
        if order_item is None:
            raise ValueError(f"Order item not found: {order_item_id}")

        frame = order_item.frame
        if frame is None:
            raise ValueError(f"Frame not found for order item: {order_item_id}")

        order_item.print_file_status = PrintFileStatus.generating
        order_item.print_file_error = None

        try:
            image_bytes = compose_print_png(
                frame_asset_url=frame.frame_asset_url,
                slot_positions=frame.slot_positions,
                text_positions=getattr(frame, "text_positions", []),
                customization_data=order_item.customization_data,
            )

            with NamedTemporaryFile(suffix=".png", delete=True) as temp:
                temp.write(image_bytes)
                temp.flush()
                upload = upload_file(
                    bucket=settings.storage_bucket_prints,
                    local_path=temp.name,
                    content_type="image/png",
                )
        except Exception as exc:
            order_item.print_file_status = PrintFileStatus.failed
            order_item.print_file_error = str(exc)[:512]
            db.commit()
            raise

        order_item.print_file_url = upload.public_url
        order_item.print_file_status = PrintFileStatus.ready
        order_item.print_file_error = None
        db.commit()
        logger.info("Generated print-ready file for order_item=%s", order_item_id)
        return upload.public_url
