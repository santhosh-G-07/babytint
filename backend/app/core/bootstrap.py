from decimal import Decimal
from pathlib import Path
import shutil
from urllib.parse import quote

from sqlalchemy import delete, func, select
from sqlalchemy import inspect, text

from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.models import Frame
from app.models.order import CartItem, OrderItem

FRAME_TEMPLATES: list[dict] = [
    {
        "name": "White 12x8 Frame",
        "slug": "white-12x8-frame",
        "source_filename": "White 12-8 Frame.png",
        "category": "white-collection",
        "size": "12x8",
        "price": Decimal("1499.00"),
        "offer_price": Decimal("1299.00"),
        "slot_positions": [
            {"slot_id": 1, "x": 832, "y": 849, "width": 738, "height": 737, "shape": "circle"},
        ],
    },
    {
        "name": "White 12x8 Frame 1",
        "slug": "white-12x8-frame-1",
        "source_filename": "White 12-8 Frame 1.png",
        "category": "white-collection",
        "size": "12x8",
        "price": Decimal("1799.00"),
        "offer_price": Decimal("1599.00"),
        "slot_positions": [
            {"slot_id": 1, "x": 746, "y": 738, "width": 908, "height": 1224, "shape": "rect", "label": "Baby Photo"},
            {"slot_id": 2, "x": 150, "y": 2863, "width": 618, "height": 618, "shape": "circle", "label": "Parents Photo"},
        ],
    },
    {
        "name": "White 12x8 Frame 2",
        "slug": "white-12x8-frame-2",
        "source_filename": "White 12-8 Frame 2.png",
        "category": "white-collection",
        "size": "12x8",
        "price": Decimal("1899.00"),
        "offer_price": Decimal("1699.00"),
        "slot_positions": [
            {"slot_id": 1, "x": 722, "y": 470, "width": 926, "height": 1153, "shape": "rect", "label": "Baby Photo"},
            {"slot_id": 2, "x": 745, "y": 1855, "width": 914, "height": 1303, "shape": "rect", "label": "Parents Photo"},
        ],
    },
    {
        "name": "White 18x12 Frame 1",
        "slug": "white-18x12-frame-1",
        "source_filename": "White 18-12 Frame 1.png",
        "category": "white-collection",
        "size": "18x12",
        "price": Decimal("2499.00"),
        "offer_price": Decimal("2199.00"),
        "slot_positions": [
            {"slot_id": 1, "x": 1236, "y": 1229, "width": 1130, "height": 1128, "shape": "circle"},
        ],
    },
    {
        "name": "White 18x12 Frame 2",
        "slug": "white-18x12-frame-2",
        "source_filename": "White 18-12 Frame 2.png",
        "category": "white-collection",
        "size": "18x12",
        "price": Decimal("2699.00"),
        "offer_price": Decimal("2399.00"),
        "slot_positions": [
            {"slot_id": 1, "x": 1074, "y": 681, "width": 1407, "height": 1751, "shape": "rect", "label": "Baby Photo"},
            {"slot_id": 2, "x": 1101, "y": 2775, "width": 1399, "height": 1989, "shape": "rect", "label": "Parents Photo"},
        ],
    },
    {
        "name": "White 18x12 Frame 3",
        "slug": "white-18x12-frame-3",
        "source_filename": "White 18-12 Frame 3.png",
        "category": "white-collection",
        "size": "18x12",
        "price": Decimal("2599.00"),
        "offer_price": Decimal("2299.00"),
        "slot_positions": [
            {"slot_id": 1, "x": 1091, "y": 914, "width": 1438, "height": 1940, "shape": "rect", "label": "Baby Photo"},
            {"slot_id": 2, "x": 140, "y": 4281, "width": 988, "height": 988, "shape": "circle", "label": "Parents Photo"},
        ],
    },
]


SQLITE_COMPAT_COLUMNS: dict[str, list[str]] = {
    "users": [
        "ALTER TABLE users ADD COLUMN password_hash VARCHAR(256)",
        "ALTER TABLE users ADD COLUMN password_reset_code_hash VARCHAR(128)",
        "ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME",
        "ALTER TABLE users ADD COLUMN password_reset_sent_at DATETIME",
    ],
    "orders": [
        "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(16) NOT NULL DEFAULT 'pending'",
    ],
    "order_items": [
        "ALTER TABLE order_items ADD COLUMN print_file_status VARCHAR(16) NOT NULL DEFAULT 'pending'",
        "ALTER TABLE order_items ADD COLUMN print_file_error VARCHAR(512)",
    ],
    "frames": [
        "ALTER TABLE frames ADD COLUMN text_positions JSON NOT NULL DEFAULT '[]'",
        "ALTER TABLE frames ADD COLUMN preview_image_url VARCHAR(1024)",
    ],
    "cart_items": [
        "ALTER TABLE cart_items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1",
    ],
}


def _ensure_sqlite_compat_columns() -> None:
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    with engine.begin() as connection:
        for table_name, statements in SQLITE_COMPAT_COLUMNS.items():
            if table_name not in table_names:
                continue
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for statement in statements:
                column_name = statement.split(" ADD COLUMN ", 1)[1].split(" ", 1)[0]
                if column_name not in existing:
                    connection.execute(text(statement))


def _public_local_asset_url(filename: str) -> str:
    settings = get_settings()
    host = settings.app_host
    if host in {"0.0.0.0", "::"}:
        host = "127.0.0.1"
    return f"http://{host}:{settings.app_port}/local-storage/{settings.storage_bucket_frames}/{filename}"


def _public_repo_asset_url(filename: str) -> str:
    encoded = quote(filename, safe="")
    return f"https://raw.githubusercontent.com/santhosh-G-07/babytint/main/img/{encoded}"


def _sync_frame_assets() -> dict[str, str]:
    project_root = Path(__file__).resolve().parents[3]
    backend_root = Path(__file__).resolve().parents[2]
    source_root = project_root / "img"
    target_root = backend_root / "local_storage" / get_settings().storage_bucket_frames
    target_root.mkdir(parents=True, exist_ok=True)

    urls_by_slug: dict[str, str] = {}
    for template in FRAME_TEMPLATES:
        source_path = source_root / template["source_filename"]
        if source_path.exists():
            target_name = f"{template['slug']}.png"
            target_path = target_root / target_name
            shutil.copy2(source_path, target_path)
            urls_by_slug[str(template["slug"])] = _public_local_asset_url(target_name)
            continue

        # Monorepo deploys that use /backend as root won't include ../img.
        # In that case, fall back to public raw file URLs from GitHub.
        urls_by_slug[str(template["slug"])] = _public_repo_asset_url(str(template["source_filename"]))

    return urls_by_slug


def _sync_dev_frames() -> None:
    urls_by_slug = _sync_frame_assets()
    template_slugs = {str(template["slug"]) for template in FRAME_TEMPLATES}

    with SessionLocal() as db:
        existing_frames = list(db.scalars(select(Frame)))
        existing_by_slug = {frame.slug: frame for frame in existing_frames}

        for template in FRAME_TEMPLATES:
            slug = str(template["slug"])
            payload = {
                "name": str(template["name"]),
                "slug": slug,
                "category": str(template["category"]),
                "size": str(template["size"]),
                "slot_count": len(template["slot_positions"]),
                "price": template["price"],
                "offer_price": template["offer_price"],
                "is_active": True,
                "frame_asset_url": urls_by_slug[slug],
                "slot_positions": template["slot_positions"],
                "text_positions": template.get("text_positions", []),
            }

            frame = existing_by_slug.get(slug)
            if frame is None:
                db.add(Frame(**payload))
                continue

            for key, value in payload.items():
                setattr(frame, key, value)

        for frame in existing_frames:
            if frame.slug in template_slugs:
                continue

            order_item_count = (
                db.scalar(
                    select(func.count())
                    .select_from(OrderItem)
                    .where(OrderItem.frame_id == frame.id)
                )
                or 0
            )
            if int(order_item_count) > 0:
                frame.is_active = False
                continue

            db.execute(delete(CartItem).where(CartItem.frame_id == frame.id))
            db.delete(frame)

        db.commit()


def bootstrap_dev_database() -> None:
    settings = get_settings()
    if not settings.database_url.startswith("sqlite"):
        return

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_compat_columns()
    if settings.app_env.lower() == "development":
        _sync_dev_frames()
        return

    # In production SQLite deployments, seed templates once on a fresh database.
    with SessionLocal() as db:
        frame_count = db.scalar(select(func.count()).select_from(Frame)) or 0
    if int(frame_count) == 0:
        _sync_dev_frames()
