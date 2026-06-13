import uuid
import io
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import AuthUser, get_current_user, require_admin
from app.core.database import get_db
from app.models.frame import Frame
from app.models.order import CartItem, Order, OrderItem, OrderStatus, PaymentStatus, PrintFileStatus
from app.schemas.order import (
    CartItemCreate,
    CartItemRead,
    CartItemUpdate,
    OrderCreate,
    OrderRead,
    OrderStatusUpdate,
)
from app.services.image_composer import compose_print_png, generate_order_item_print_file

router = APIRouter(prefix="/orders")
FULFILLMENT_STATUSES = {OrderStatus.printing, OrderStatus.dispatched, OrderStatus.delivered}


def _order_query():
    return (
        select(Order)
        .options(
            joinedload(Order.user),
            joinedload(Order.items).joinedload(OrderItem.frame),
        )
        .order_by(Order.created_at.desc())
    )


def _ensure_frame_is_sellable(frame: Frame) -> None:
    if not frame.is_active:
        raise HTTPException(status_code=400, detail=f"{frame.name} is no longer available.")


def _validate_customization(frame: Frame, customization_data: dict) -> None:
    if not isinstance(customization_data, dict):
        raise HTTPException(status_code=400, detail="Customization data is invalid.")

    if str(customization_data.get("frame_id")) != str(frame.id):
        raise HTTPException(status_code=400, detail="Customization does not match the selected frame.")

    slots = customization_data.get("slots")
    if not isinstance(slots, list) or not slots:
        raise HTTPException(status_code=400, detail="Customization must include at least one photo slot.")

    expected_slot_ids = {slot.get("slot_id") for slot in frame.slot_positions if isinstance(slot, dict)}
    provided_slot_ids: set[int] = set()
    for slot in slots:
        if not isinstance(slot, dict):
            raise HTTPException(status_code=400, detail="Customization slot data is invalid.")
        slot_id = slot.get("slot_id")
        image_url = slot.get("image_url")
        if not isinstance(slot_id, int) or not isinstance(image_url, str) or not image_url.strip():
            raise HTTPException(status_code=400, detail="Each customization slot needs an uploaded image.")
        provided_slot_ids.add(slot_id)

    if expected_slot_ids and provided_slot_ids != expected_slot_ids:
        raise HTTPException(status_code=400, detail="Customization must include all frame photo slots.")


@router.get("/me", response_model=list[OrderRead])
def list_my_orders(
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Order]:
    stmt = _order_query().where(Order.user_id == uuid.UUID(current.id))
    return list(db.scalars(stmt).unique())


@router.get("/admin/all", response_model=list[OrderRead])
def list_all_orders(
    _: AuthUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[Order]:
    return list(db.scalars(_order_query()).unique())


@router.post("/checkout", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def checkout(
    payload: OrderCreate,
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Order:
    if not payload.items:
        raise HTTPException(status_code=400, detail="Checkout requires at least one item.")

    total_amount = Decimal("0.00")
    frame_ids = {item.frame_id for item in payload.items}
    frames = {
        frame.id: frame
        for frame in db.scalars(select(Frame).where(Frame.id.in_(frame_ids)))
    }

    if len(frames) != len(frame_ids):
        raise HTTPException(status_code=400, detail="One or more selected frames do not exist.")

    prepared_items: list[tuple[Frame, dict, int, Decimal]] = []
    total_amount = Decimal("0.00")
    for item in payload.items:
        frame = frames[item.frame_id]
        _ensure_frame_is_sellable(frame)
        _validate_customization(frame, item.customization_data)
        composite_preview_url = item.customization_data.get("composite_preview_url")
        if not isinstance(composite_preview_url, str) or not composite_preview_url.strip():
            raise HTTPException(
                status_code=400,
                detail="Each order item requires a preview image. Please reopen the editor and save it again.",
            )

        frame_price = frame.offer_price if frame.offer_price is not None else frame.price
        item_price = Decimal(frame_price)
        total_amount += item_price * item.quantity
        prepared_items.append((frame, item.customization_data, item.quantity, item_price))

    order = Order(
        user_id=uuid.UUID(current.id),
        status=OrderStatus.received,
        payment_status=PaymentStatus.pending,
        total_amount=Decimal("0.00"),
        delivery_address=payload.delivery_address.model_dump(),
    )
    db.add(order)
    db.flush()

    for frame, customization_data, quantity, item_price in prepared_items:
        order_item = OrderItem(
            order_id=order.id,
            frame_id=frame.id,
            customization_data=customization_data,
            print_file_url=None,
            print_file_status=PrintFileStatus.pending,
            quantity=quantity,
            price=item_price,
        )
        db.add(order_item)

    order.total_amount = total_amount
    db.commit()
    db.refresh(order)
    db.refresh(order, attribute_names=["items"])
    return order


def _admin_order_item(item_id: uuid.UUID, db: Session) -> OrderItem:
    item = db.scalar(
        select(OrderItem)
        .where(OrderItem.id == item_id)
        .options(joinedload(OrderItem.frame), joinedload(OrderItem.order))
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Order item not found.")
    if item.frame is None:
        raise HTTPException(status_code=404, detail="Frame not found for order item.")
    return item


@router.post("/admin/items/{item_id}/print-file", response_model=OrderRead)
def regenerate_print_file(
    item_id: uuid.UUID,
    _: AuthUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Order:
    item = _admin_order_item(item_id, db)
    if item.order.payment_status != PaymentStatus.paid:
        raise HTTPException(status_code=400, detail="Payment must be completed before generating print files.")
    item.print_file_status = PrintFileStatus.generating
    item.print_file_error = None
    db.commit()

    try:
        generate_order_item_print_file(item.id)
    except Exception as exc:
        item = _admin_order_item(item_id, db)
        item.print_file_status = PrintFileStatus.failed
        item.print_file_error = str(exc)[:512]
        db.commit()
        raise HTTPException(status_code=500, detail="Failed to generate print file.") from exc

    order = db.scalars(_order_query().where(Order.id == item.order_id)).unique().first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order


@router.get("/admin/items/{item_id}/print-file/download")
def download_print_file(
    item_id: uuid.UUID,
    _: AuthUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    item = _admin_order_item(item_id, db)
    if item.order.payment_status != PaymentStatus.paid:
        raise HTTPException(status_code=400, detail="Payment must be completed before downloading print files.")
    frame = item.frame
    image_bytes = compose_print_png(
        frame_asset_url=frame.frame_asset_url,
        slot_positions=frame.slot_positions,
        text_positions=frame.text_positions,
        customization_data=item.customization_data,
    )
    filename = f"babytint-{item.order_id}-{item.id}.png"
    return StreamingResponse(
        io.BytesIO(image_bytes),
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/{order_id}/status", response_model=OrderRead)
def update_order_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdate,
    _: AuthUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Order:
    order = (
        db.scalars(select(Order).where(Order.id == order_id).options(joinedload(Order.items)))
        .unique()
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")

    try:
        next_status = OrderStatus(payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid order status.") from exc

    if order.payment_status != PaymentStatus.paid and next_status in FULFILLMENT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Unpaid orders cannot move into printing, dispatch, or delivery.",
        )

    order.status = next_status
    tracking_link = (payload.tracking_link or "").strip()
    order.tracking_link = tracking_link or None
    db.commit()
    db.refresh(order)
    db.refresh(order, attribute_names=["items"])
    return order


@router.get("/me/{order_id}", response_model=OrderRead)
def get_my_order(
    order_id: uuid.UUID,
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Order:
    order = (
        db.scalars(_order_query().where(Order.id == order_id, Order.user_id == uuid.UUID(current.id)))
        .unique()
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order


@router.get("/cart", response_model=list[CartItemRead])
def list_cart_items(
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CartItem]:
    stmt = (
        select(CartItem)
        .where(CartItem.user_id == uuid.UUID(current.id))
        .order_by(CartItem.created_at.desc())
    )
    return list(db.scalars(stmt))


@router.post("/cart", response_model=CartItemRead, status_code=status.HTTP_201_CREATED)
def add_cart_item(
    payload: CartItemCreate,
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CartItem:
    frame = db.scalar(select(Frame).where(Frame.id == payload.frame_id))
    if frame is None:
        raise HTTPException(status_code=404, detail="Frame not found.")
    _ensure_frame_is_sellable(frame)
    _validate_customization(frame, payload.customization_data)

    existing = db.scalar(
        select(CartItem).where(
            CartItem.user_id == uuid.UUID(current.id),
            CartItem.frame_id == payload.frame_id,
            CartItem.customization_data == payload.customization_data,
        )
    )
    if existing is not None:
        existing.quantity = payload.quantity
        db.commit()
        db.refresh(existing)
        return existing

    item = CartItem(
        user_id=uuid.UUID(current.id),
        frame_id=payload.frame_id,
        customization_data=payload.customization_data,
        quantity=payload.quantity,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/cart/{item_id}", response_model=CartItemRead)
def update_cart_item(
    item_id: uuid.UUID,
    payload: CartItemUpdate,
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CartItem:
    item = db.scalar(select(CartItem).where(CartItem.id == item_id))
    if item is None or str(item.user_id) != current.id:
        raise HTTPException(status_code=404, detail="Cart item not found.")

    frame = db.scalar(select(Frame).where(Frame.id == item.frame_id))
    if frame is None:
        raise HTTPException(status_code=404, detail="Frame not found.")
    _ensure_frame_is_sellable(frame)

    item.quantity = payload.quantity
    db.commit()
    db.refresh(item)
    return item


@router.delete("/cart/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_cart_item(
    item_id: uuid.UUID,
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    item = db.scalar(select(CartItem).where(CartItem.id == item_id))
    if item is None or str(item.user_id) != current.id:
        raise HTTPException(status_code=404, detail="Cart item not found.")
    db.delete(item)
    db.commit()
