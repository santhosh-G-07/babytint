import json
import uuid

import razorpay
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import AuthUser, get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.order import Order, OrderStatus, PaymentStatus, PrintFileStatus
from app.services.image_composer import generate_order_item_print_file

router = APIRouter(prefix="/payment")
settings = get_settings()
RAZORPAY_CREATE_ORDER_ERRORS = (
    razorpay.errors.BadRequestError,
    razorpay.errors.GatewayError,
    razorpay.errors.ServerError,
)


class CreateRazorpayOrderRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    order_id: uuid.UUID
    currency: str = "INR"
    notes: dict = Field(default_factory=dict)


def _razorpay_client() -> razorpay.Client:
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


@router.post("/create-order")
def create_razorpay_order(
    payload: CreateRazorpayOrderRequest,
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    order = db.scalar(select(Order).where(Order.id == payload.order_id))
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if str(order.user_id) != current.id:
        raise HTTPException(status_code=403, detail="You cannot pay for this order.")

    # Security-critical: never trust any client-side amount.
    amount_paise = int(order.total_amount * 100)
    client = _razorpay_client()

    try:
        razorpay_order = client.order.create(
            {
                "amount": amount_paise,
                "currency": payload.currency,
                "receipt": str(order.id),
                "notes": payload.notes,
            }
        )
    except RAZORPAY_CREATE_ORDER_ERRORS as exc:
        raise HTTPException(
            status_code=502,
            detail="Payment provider order creation failed. Please retry shortly.",
        ) from exc

    order.razorpay_order_id = razorpay_order["id"]
    db.commit()
    return {
        "razorpay_order_id": razorpay_order["id"],
        "amount": razorpay_order["amount"],
        "currency": razorpay_order["currency"],
        "status": razorpay_order["status"],
        "receipt": razorpay_order.get("receipt"),
    }


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_razorpay_signature: str | None = Header(default=None),
) -> dict:
    raw = await request.body()
    try:
        # Accept optional UTF-8 BOM to avoid failing on proxied webhook payloads.
        body = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Webhook body must be valid UTF-8.") from exc

    if settings.razorpay_webhook_secret:
        if not x_razorpay_signature:
            raise HTTPException(status_code=400, detail="Missing Razorpay signature.")
        try:
            razorpay.utility.verify_webhook_signature(
                body,
                x_razorpay_signature,
                settings.razorpay_webhook_secret,
            )
        except razorpay.errors.SignatureVerificationError as exc:
            raise HTTPException(status_code=400, detail="Invalid webhook signature.") from exc

    try:
        payload = json.loads(body or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Malformed webhook payload.") from exc
    event = payload.get("event")
    payload_data = payload.get("payload", {})
    payment_entity = payload_data.get("payment", {}).get("entity", {})
    order_entity = payload_data.get("order", {}).get("entity", {})

    if event not in {"payment.captured", "order.paid", "payment.failed"}:
        return {"ok": True, "ignored": True}

    razorpay_order_id = payment_entity.get("order_id") or order_entity.get("id")
    razorpay_payment_id = payment_entity.get("id")
    if not razorpay_order_id:
        return {"ok": True, "ignored": True}

    order = db.scalar(
        select(Order)
        .where(Order.razorpay_order_id == razorpay_order_id)
        .options(joinedload(Order.items))
    )
    if order is None:
        return {"ok": True, "ignored": True}

    if event == "payment.failed":
        order.payment_status = PaymentStatus.failed
        db.commit()
        return {"ok": True}

    order.razorpay_payment_id = razorpay_payment_id
    order.payment_status = PaymentStatus.paid
    order.status = OrderStatus.printing
    for item in order.items:
        item.print_file_status = PrintFileStatus.generating
        item.print_file_error = None
    db.commit()

    for item in order.items:
        background_tasks.add_task(generate_order_item_print_file, str(item.id))

    return {"ok": True}
