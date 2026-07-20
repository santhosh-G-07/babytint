from decimal import Decimal
from typing import Any

from app.models.frame import Frame

ASSISTED_CUSTOMIZATION_MODE = "assisted"


def is_assisted_customization(customization_data: dict[str, Any] | dict | None) -> bool:
    return bool(
        isinstance(customization_data, dict)
        and customization_data.get("customization_mode") == ASSISTED_CUSTOMIZATION_MODE
    )


def frame_base_price(frame: Frame) -> Decimal:
    return Decimal(frame.offer_price if frame.offer_price is not None else frame.price)


def assisted_customization_fee(frame: Frame) -> Decimal:
    return Decimal(frame.assisted_customization_price or 0)


def order_item_unit_price(frame: Frame, customization_data: dict[str, Any] | dict) -> Decimal:
    price = frame_base_price(frame)
    if is_assisted_customization(customization_data):
        price += assisted_customization_fee(frame)
    return price
