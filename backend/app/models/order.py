import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, Numeric, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

json_type = JSON().with_variant(JSONB, "postgresql")


class OrderStatus(str, enum.Enum):
    received = "received"
    printing = "printing"
    dispatched = "dispatched"
    delivered = "delivered"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class PrintFileStatus(str, enum.Enum):
    pending = "pending"
    generating = "generating"
    ready = "ready"
    failed = "failed"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"),
        default=OrderStatus.received,
        nullable=False,
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"),
        default=PaymentStatus.pending,
        nullable=False,
    )
    razorpay_order_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    delivery_address: Mapped[dict] = mapped_column(json_type, nullable=False, default=dict)
    tracking_link: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all,delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True)
    frame_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("frames.id"), nullable=False, index=True)
    customization_data: Mapped[dict] = mapped_column(json_type, nullable=False, default=dict)
    print_file_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    print_file_status: Mapped[PrintFileStatus] = mapped_column(
        Enum(PrintFileStatus, name="print_file_status"),
        default=PrintFileStatus.pending,
        nullable=False,
    )
    print_file_error: Mapped[str | None] = mapped_column(String(512), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    frame = relationship("Frame", back_populates="order_items")


class CartItem(Base):
    __tablename__ = "cart_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    frame_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("frames.id"), nullable=False, index=True)
    customization_data: Mapped[dict] = mapped_column(json_type, nullable=False, default=dict)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="cart_items")
    frame = relationship("Frame", back_populates="cart_items")
