import io
import ipaddress
import logging
import math
import os
import socket
import uuid
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urlparse

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
MAX_REMOTE_IMAGE_BYTES = 40 * 1024 * 1024


def _assert_public_host(hostname: str) -> None:
    try:
        addr_infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve host: {hostname}") from exc

    for family, _, _, _, sockaddr in addr_infos:
        ip = ipaddress.ip_address(sockaddr[0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise ValueError(f"Refusing to fetch image from non-public host: {hostname}")

# Canonical fonts, bundled as real .ttf files under backend/assets/fonts so
# rendering is identical across dev (Windows) and production (Linux/Railway).
# Old Windows-only family names (segoe script, gabriola, ...) are kept as
# aliases pointing at the closest replacement so frames/orders created before
# the font swap keep rendering with their nearest equivalent instead of
# silently falling back to Arial/DejaVu.
FONT_FILES: dict[str, dict[str, list[str]]] = {
    "dancing script": {
        "normal": ["DancingScript-Regular.ttf"],
        "bold": ["DancingScript-Bold.ttf"],
    },
    "segoe script": {
        "normal": ["DancingScript-Regular.ttf"],
        "bold": ["DancingScript-Bold.ttf"],
    },
    "yellowtail": {
        "normal": ["Yellowtail-Regular.ttf"],
        "bold": ["Yellowtail-Regular.ttf"],
    },
    "gabriola": {
        "normal": ["Yellowtail-Regular.ttf"],
        "bold": ["Yellowtail-Regular.ttf"],
    },
    "baloo 2": {
        "normal": ["Baloo2-Regular.ttf"],
        "bold": ["Baloo2-Bold.ttf"],
    },
    "mv boli": {
        "normal": ["Baloo2-Regular.ttf"],
        "bold": ["Baloo2-Bold.ttf"],
    },
    "quicksand": {
        "normal": ["Quicksand-Regular.ttf"],
        "bold": ["Quicksand-Bold.ttf"],
    },
    "leelawadee": {
        "normal": ["Quicksand-Regular.ttf"],
        "bold": ["Quicksand-Bold.ttf"],
    },
    "caveat": {
        "normal": ["Caveat-Regular.ttf"],
        "bold": ["Caveat-Bold.ttf"],
    },
    "kristen itc": {
        "normal": ["Caveat-Regular.ttf"],
        "bold": ["Caveat-Bold.ttf"],
    },
    "fredoka": {
        "normal": ["Fredoka-Regular.ttf"],
        "bold": ["Fredoka-SemiBold.ttf"],
    },
    "hobo std": {
        "normal": ["Fredoka-Regular.ttf"],
        "bold": ["Fredoka-SemiBold.ttf"],
    },
    "pacifico": {
        "normal": ["Pacifico-Regular.ttf"],
        "bold": ["Pacifico-Regular.ttf"],
    },
    "illuma": {
        "normal": ["Pacifico-Regular.ttf"],
        "bold": ["Pacifico-Regular.ttf"],
    },
    "montserrat": {
        "normal": ["Montserrat-Regular.ttf"],
        "bold": ["Montserrat-Bold.ttf", "Montserrat-SemiBold.ttf"],
    },
    "playfair display": {
        "normal": ["PlayfairDisplay-Regular.ttf"],
        "bold": ["PlayfairDisplay-Bold.ttf"],
    },
    "cambria": {
        "normal": ["PlayfairDisplay-Regular.ttf"],
        "bold": ["PlayfairDisplay-Bold.ttf"],
    },
    "arial": {
        "normal": ["arial.ttf", "Arial.ttf"],
        "bold": ["arialbd.ttf", "Arial Bold.ttf", "arial.ttf", "Arial.ttf"],
    },
}


def _open_image_from_url(url: str) -> Image.Image:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Image URL must be an absolute http(s) URL.")
    _assert_public_host(parsed.hostname)

    buffer = io.BytesIO()
    with httpx.Client(timeout=20, follow_redirects=False) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            total = 0
            for chunk in response.iter_bytes():
                total += len(chunk)
                if total > MAX_REMOTE_IMAGE_BYTES:
                    raise ValueError("Remote image exceeds the maximum allowed size.")
                buffer.write(chunk)
    buffer.seek(0)
    return Image.open(buffer).convert("RGBA")


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
    shape = str(slot_shape.get("shape", "rect")).lower()
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

    if shape == "diamond":
        return [(0.5, 0.02), (0.98, 0.5), (0.5, 0.98), (0.02, 0.5)]

    if shape == "hexagon":
        return [(0.25, 0.02), (0.75, 0.02), (0.98, 0.5), (0.75, 0.98), (0.25, 0.98), (0.02, 0.5)]

    return [(0.08, 0.08), (0.92, 0.04), (0.98, 0.76), (0.66, 0.98), (0.08, 0.9), (0.02, 0.3)]


def _apply_slot_mask(slot_layer: Image.Image, slot_shape: dict, width: int, height: int) -> None:
    shape = str(slot_shape.get("shape", "rect")).lower()
    if shape == "circle":
        mask = Image.new("L", (width, height), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, width, height), fill=255)
        slot_layer.putalpha(mask)
        return

    if shape in {"free", "polygon", "diamond", "hexagon"}:
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

    if shape in {"free", "polygon", "diamond", "hexagon"}:
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


def _text_width(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    letter_spacing: float = 0.0,
) -> int:
    if not text:
        return 0
    if abs(letter_spacing) < 0.01:
        bbox = draw.textbbox((0, 0), text, font=font)
        return int(bbox[2] - bbox[0])

    width = 0.0
    for index, char in enumerate(text):
        bbox = draw.textbbox((0, 0), char, font=font)
        width += float(bbox[2] - bbox[0])
        if index < len(text) - 1:
            width += letter_spacing
    return int(round(width))


def _draw_spaced_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    fill: tuple[int, int, int, int] | int,
    letter_spacing: float = 0.0,
) -> None:
    if abs(letter_spacing) < 0.01:
        draw.text(xy, text, fill=fill, font=font)
        return

    cursor_x = float(xy[0])
    cursor_y = int(xy[1])
    for index, char in enumerate(text):
        draw.text((int(round(cursor_x)), cursor_y), char, fill=fill, font=font)
        bbox = draw.textbbox((0, 0), char, font=font)
        char_width = float(bbox[2] - bbox[0])
        cursor_x += char_width
        if index < len(text) - 1:
            cursor_x += letter_spacing


def _parse_rich_runs(raw_runs: object, text_length: int) -> list[dict]:
    runs: list[dict] = []
    if not isinstance(raw_runs, list):
        return runs

    for item in raw_runs:
        if not isinstance(item, dict):
            continue
        try:
            start = int(float(item.get("start", 0)))
            end = int(float(item.get("end", 0)))
        except (TypeError, ValueError):
            continue

        start = max(0, min(text_length, start))
        end = max(0, min(text_length, end))
        if end <= start:
            continue

        family = str(item.get("font_family", "")).strip()
        color = str(item.get("color", "")).strip()
        weight_raw = str(item.get("font_weight", "normal")).strip().lower()
        weight = "bold" if weight_raw == "bold" else "normal"

        font_size = None
        if item.get("font_size") is not None:
            try:
                font_size = max(1, int(float(item.get("font_size"))))
            except (TypeError, ValueError):
                font_size = None

        run: dict[str, object] = {"start": start, "end": end}
        if family:
            run["font_family"] = family
        run["font_weight"] = weight
        if color:
            run["color"] = color
        if font_size is not None:
            run["font_size"] = font_size
        runs.append(run)

    return runs


def _build_rich_char_styles(
    value: str,
    base_family: str,
    base_weight: str,
    base_size: int,
    base_color: str,
    rich_runs: list[dict],
) -> list[dict]:
    styles: list[dict] = [
        {
            "font_family": base_family,
            "font_weight": "bold" if str(base_weight).lower() == "bold" else "normal",
            "font_size": max(1, int(base_size)),
            "color": base_color,
        }
        for _ in value
    ]

    for run in rich_runs:
        start = int(run.get("start", 0))
        end = int(run.get("end", 0))
        for index in range(start, end):
            cell = styles[index]
            if isinstance(run.get("font_family"), str) and run.get("font_family"):
                cell["font_family"] = run["font_family"]
            if run.get("font_weight") in {"normal", "bold"}:
                cell["font_weight"] = run["font_weight"]
            if isinstance(run.get("color"), str) and run.get("color"):
                cell["color"] = run["color"]
            if isinstance(run.get("font_size"), int):
                cell["font_size"] = max(1, int(run["font_size"]))

    return styles


def _rich_char_width(
    draw: ImageDraw.ImageDraw,
    char: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
) -> float:
    bbox = draw.textbbox((0, 0), char, font=font)
    width = float(bbox[2] - bbox[0])
    if width > 0:
        return width
    if char == " ":
        space_bbox = draw.textbbox((0, 0), " ", font=font)
        space_width = float(space_bbox[2] - space_bbox[0])
        if space_width > 0:
            return space_width
    return 0.0


def _draw_rich_text_positions(
    draw: ImageDraw.ImageDraw,
    *,
    x: int,
    y: int,
    width: int,
    height: int,
    value: str,
    align: str,
    line_height_ratio: float,
    letter_spacing: float,
    base_family: str,
    base_weight: str,
    base_size: int,
    base_color: str,
    rich_runs: list[dict],
) -> None:
    if not value:
        return

    char_styles = _build_rich_char_styles(
        value=value,
        base_family=base_family,
        base_weight=base_weight,
        base_size=base_size,
        base_color=base_color,
        rich_runs=rich_runs,
    )

    font_cache: dict[tuple[str, int, str], ImageFont.FreeTypeFont | ImageFont.ImageFont] = {}

    def resolve_font(style: dict) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
        key = (
            str(style["font_family"]),
            int(style["font_size"]),
            "bold" if str(style["font_weight"]).lower() == "bold" else "normal",
        )
        if key not in font_cache:
            font_cache[key] = _load_font(key[0], key[1], key[2])
        return font_cache[key]

    lines: list[dict] = []
    line = {"glyphs": [], "width": 0.0, "max_font": 1}

    def push_line() -> None:
        nonlocal line
        lines.append(line)
        line = {"glyphs": [], "width": 0.0, "max_font": 1}

    for index, char in enumerate(value):
        if char == "\r":
            continue
        if char == "\n":
            push_line()
            continue

        style = char_styles[index]
        font = resolve_font(style)
        char_width = _rich_char_width(draw, char, font)
        prefix_spacing = letter_spacing if line["glyphs"] else 0.0
        candidate_width = float(line["width"]) + prefix_spacing + char_width

        if line["glyphs"] and candidate_width > float(width):
            push_line()
            prefix_spacing = 0.0
            candidate_width = char_width

        glyph_x = float(line["width"]) + prefix_spacing
        line["glyphs"].append({"char": char, "x": glyph_x, "style": style})
        line["width"] = candidate_width
        line["max_font"] = max(int(line["max_font"]), int(style["font_size"]))

    push_line()

    line_heights = [max(1, int(round(int(item["max_font"]) * line_height_ratio))) for item in lines]
    total_height = sum(line_heights)
    cursor_y = max(0.0, (float(height) - float(total_height)) / 2.0)

    for index, current in enumerate(lines):
        visual_width = float(current["width"])
        if align == "right":
            offset_x = max(0.0, float(width) - visual_width)
        elif align == "center":
            offset_x = max(0.0, (float(width) - visual_width) / 2.0)
        else:
            offset_x = 0.0

        for glyph in current["glyphs"]:
            style = glyph["style"]
            font = resolve_font(style)
            fill = _parse_color(str(style["color"]))
            draw.text(
                (x + int(round(offset_x + float(glyph["x"]))), y + int(round(cursor_y))),
                str(glyph["char"]),
                font=font,
                fill=fill,
            )

        cursor_y += float(line_heights[index])


def _wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    max_width: int,
    letter_spacing: float = 0.0,
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
            if _text_width(draw, candidate, font, letter_spacing) <= max_width:
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


def _parse_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _build_linear_gradient(
    width: int,
    height: int,
    start_color: tuple[int, int, int, int],
    end_color: tuple[int, int, int, int],
    angle: float,
) -> Image.Image:
    span = max(1, int(math.hypot(width, height)))
    gradient = Image.new("RGBA", (span, span), (0, 0, 0, 0))
    gradient_draw = ImageDraw.Draw(gradient)
    denominator = max(1, span - 1)

    for x in range(span):
        mix = x / denominator
        color = tuple(
            int(start_color[channel] + (end_color[channel] - start_color[channel]) * mix)
            for channel in range(4)
        )
        gradient_draw.line((x, 0, x, span), fill=color)

    rotated = gradient.rotate(-angle, resample=Image.Resampling.BICUBIC, expand=True)
    return ImageOps.fit(rotated, (width, height), method=Image.Resampling.BICUBIC, centering=(0.5, 0.5))


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

        try:
            x = int(float(override.get("x", text_shape.get("x", 0))))
        except (TypeError, ValueError):
            x = int(float(text_shape.get("x", 0)))
        try:
            y = int(float(override.get("y", text_shape.get("y", 0))))
        except (TypeError, ValueError):
            y = int(float(text_shape.get("y", 0)))
        try:
            width = max(1, int(float(override.get("width", text_shape.get("width", 1)))))
        except (TypeError, ValueError):
            width = max(1, int(float(text_shape.get("width", 1))))
        try:
            height = max(1, int(float(override.get("height", text_shape.get("height", 1)))))
        except (TypeError, ValueError):
            height = max(1, int(float(text_shape.get("height", 1))))
        family = str(override.get("font_family") or text_shape.get("font_family") or "Arial")
        weight = str(override.get("font_weight") or text_shape.get("font_weight") or "normal")
        font_size = max(1, int(float(override.get("font_size", text_shape.get("font_size", 72)))))
        align = str(override.get("align", text_shape.get("align", "center"))).lower()
        color = _parse_color(str(override.get("color", text_shape.get("color", "#1c1917"))))
        gradient_enabled = _parse_bool(text_shape.get("gradient_enabled", False))
        gradient_from = _parse_color(str(text_shape.get("gradient_from") or text_shape.get("color", "#1c1917")))
        gradient_to = _parse_color(str(text_shape.get("gradient_to") or text_shape.get("color", "#1c1917")))
        try:
            line_height_ratio = float(override.get("line_height", text_shape.get("line_height", 1.2)))
        except (TypeError, ValueError):
            line_height_ratio = 1.2
        line_height_ratio = max(0.8, min(3.5, line_height_ratio))
        try:
            letter_spacing = float(override.get("letter_spacing", text_shape.get("letter_spacing", 0)))
        except (TypeError, ValueError):
            letter_spacing = 0.0
        letter_spacing = max(-20.0, min(80.0, letter_spacing))
        try:
            gradient_angle = float(text_shape.get("gradient_angle", 0))
        except (TypeError, ValueError):
            gradient_angle = 0.0
        rich_runs = _parse_rich_runs(override.get("rich_runs"), len(value))

        if rich_runs:
            _draw_rich_text_positions(
                draw,
                x=x,
                y=y,
                width=width,
                height=height,
                value=value,
                align=align,
                line_height_ratio=line_height_ratio,
                letter_spacing=letter_spacing,
                base_family=family,
                base_weight=weight,
                base_size=font_size,
                base_color=str(override.get("color", text_shape.get("color", "#1c1917"))),
                rich_runs=rich_runs,
            )
            continue

        font = _load_font(family, font_size, weight)
        lines = _wrap_text(draw, value, font, width, letter_spacing)
        bbox = draw.textbbox((0, 0), "Ay", font=font)
        line_height = max(1, int((bbox[3] - bbox[1]) * line_height_ratio))
        total_height = line_height * len(lines)
        cursor_y = max(0, int((height - total_height) / 2))
        laid_out_lines: list[tuple[str, int, int]] = []

        for line in lines:
            line_width = _text_width(draw, line, font, letter_spacing)
            if align == "right":
                cursor_x = max(0, width - line_width)
            elif align == "left":
                cursor_x = 0
            else:
                cursor_x = max(0, int((width - line_width) / 2))
            laid_out_lines.append((line, cursor_x, cursor_y))
            cursor_y += line_height

        if gradient_enabled:
            text_mask = Image.new("L", (width, height), 0)
            mask_draw = ImageDraw.Draw(text_mask)
            for line, local_x, local_y in laid_out_lines:
                _draw_spaced_text(
                    mask_draw,
                    (local_x, local_y),
                    line,
                    font=font,
                    fill=255,
                    letter_spacing=letter_spacing,
                )
            gradient = _build_linear_gradient(width, height, gradient_from, gradient_to, gradient_angle)
            image.paste(gradient, (x, y), text_mask)
            continue

        for line, local_x, local_y in laid_out_lines:
            _draw_spaced_text(
                draw,
                (x + local_x, y + local_y),
                line,
                font=font,
                fill=color,
                letter_spacing=letter_spacing,
            )


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

        # Prefer the geometry snapshot taken at checkout time so a later
        # admin edit to the frame's slot/text positions can't reflow or drop
        # photos on an order that's already been paid for. Orders placed
        # before this snapshot existed fall back to the live frame row.
        snapshot = order_item.frame_snapshot or {}
        frame_asset_url = snapshot.get("frame_asset_url") or frame.frame_asset_url
        slot_positions = snapshot.get("slot_positions") or frame.slot_positions
        text_positions = snapshot.get("text_positions")
        if text_positions is None:
            text_positions = getattr(frame, "text_positions", [])

        try:
            image_bytes = compose_print_png(
                frame_asset_url=frame_asset_url,
                slot_positions=slot_positions,
                text_positions=text_positions,
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
