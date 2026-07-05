import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, Boolean, DateTime, Numeric, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

json_type = JSON().with_variant(JSONB, "postgresql")


class Frame(Base):
    __tablename__ = "frames"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    size: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    slot_count: Mapped[int] = mapped_column(nullable=False, default=1)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    offer_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    assisted_customization_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    frame_asset_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    preview_image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    slot_positions: Mapped[list[dict]] = mapped_column(json_type, nullable=False, default=list)
    text_positions: Mapped[list[dict]] = mapped_column(json_type, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    order_items = relationship("OrderItem", back_populates="frame")
    cart_items = relationship("CartItem", back_populates="frame")
