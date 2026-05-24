import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.frame import FrameRead
from app.schemas.user import UserRead


class SlotAdjustments(BaseModel):
    brightness: float = 1.0
    contrast: float = 1.0
    saturation: float = 1.0
    rotation: float = 0.0
    cropX: float = 0.0
    cropY: float = 0.0
    cropW: float = 0.0
    cropH: float = 0.0
    flipX: bool = False
    flipY: bool = False


class SlotCustomization(BaseModel):
    slot_id: int
    image_url: str
    adjustments: SlotAdjustments


class CustomizationPayload(BaseModel):
    frame_id: uuid.UUID
    slots: list[SlotCustomization]


class CartItemCreate(BaseModel):
    frame_id: uuid.UUID
    customization_data: dict[str, Any]


class CartItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    frame_id: uuid.UUID
    customization_data: dict[str, Any]
    created_at: datetime


class CheckoutItem(BaseModel):
    frame_id: uuid.UUID
    quantity: int = Field(default=1, ge=1)
    price: Decimal | None = Field(default=None, gt=0)
    customization_data: dict[str, Any]


class DeliveryAddress(BaseModel):
    fullName: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=8, max_length=20)
    line1: str = Field(min_length=4, max_length=240)
    line2: str = Field(default="", max_length=240)
    city: str = Field(min_length=2, max_length=120)
    state: str = Field(min_length=2, max_length=120)
    postalCode: str = Field(min_length=4, max_length=16)
    notes: str = Field(default="", max_length=500)

    @field_validator("*", mode="before")
    @classmethod
    def trim_strings(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


class OrderCreate(BaseModel):
    delivery_address: DeliveryAddress
    items: list[CheckoutItem]


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    frame_id: uuid.UUID
    customization_data: dict[str, Any]
    print_file_status: str
    print_file_error: str | None = None
    quantity: int
    price: Decimal
    frame: FrameRead | None = None


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    status: str
    payment_status: str
    razorpay_order_id: str | None
    razorpay_payment_id: str | None
    total_amount: Decimal
    delivery_address: dict[str, Any]
    tracking_link: str | None
    created_at: datetime
    items: list[OrderItemRead]
    user: UserRead | None = None


class OrderStatusUpdate(BaseModel):
    status: str
    tracking_link: str | None = None


class RazorpayOrderCreate(BaseModel):
    amount: Decimal
    currency: str = "INR"
    receipt: str
    notes: dict[str, Any] = Field(default_factory=dict)


class RazorpayOrderRead(BaseModel):
    id: str
    amount: int
    currency: str
    status: str
