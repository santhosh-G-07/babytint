import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class FramePoint(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class SlotPosition(BaseModel):
    slot_id: int = Field(ge=1)
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    shape: str = "rect"
    label: str | None = None
    points: list[FramePoint] | None = None


class TextPosition(BaseModel):
    text_id: int = Field(ge=1)
    label: str
    placeholder: str | None = None
    default_text: str | None = None
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    font_group: str = "general"
    font_family: str = "Arial"
    font_weight: str = "normal"
    font_size: float = Field(default=72, gt=0)
    color: str = "#1c1917"
    gradient_enabled: bool = False
    gradient_from: str | None = None
    gradient_to: str | None = None
    gradient_angle: float = 0.0
    align: str = "center"
    line_height: float = Field(default=1.2, gt=0, le=4)
    letter_spacing: float = Field(default=0.0, ge=-20, le=80)
    allow_customer_font: bool = True


class FrameBase(BaseModel):
    name: str
    slug: str
    category: str
    size: str
    slot_count: int = Field(ge=1, le=24)
    price: Decimal = Field(gt=0)
    offer_price: Decimal | None = Field(default=None, gt=0)
    is_active: bool = True
    frame_asset_url: str
    slot_positions: list[SlotPosition]
    text_positions: list[TextPosition] = Field(default_factory=list)


class FrameCreate(FrameBase):
    pass


class FrameUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    category: str | None = None
    size: str | None = None
    slot_count: int | None = Field(default=None, ge=1, le=24)
    price: Decimal | None = Field(default=None, gt=0)
    offer_price: Decimal | None = Field(default=None, gt=0)
    is_active: bool | None = None
    frame_asset_url: str | None = None
    slot_positions: list[SlotPosition] | None = None
    text_positions: list[TextPosition] | None = None


class FrameRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    category: str
    size: str
    slot_count: int
    price: Decimal
    offer_price: Decimal | None
    is_active: bool
    frame_asset_url: str
    slot_positions: list[SlotPosition]
    text_positions: list[TextPosition]
    created_at: datetime
