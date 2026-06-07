import hashlib
import hmac
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
from app.services.email import send_order_paid_email_task
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


class VerifyRazorpayPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    app_order_id: uuid.UUID | None = None
    razorpay_order_id: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None


def _razorpay_client() -> razorpay.Client:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(status_code=401, detail="Razorpay credentials are not configured.")
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


def _is_razorpay_auth_failure(exc: Exception) -> bool:
    message = str(exc).lower()
    return "authentication" in message or "unauthorized" in message or "invalid key" in message


def _mark_order_paid(
    order: Order,
    razorpay_payment_id: str | None,
    db: Session,
    background_tasks: BackgroundTasks,
) -> None:
    was_paid = order.payment_status == PaymentStatus.paid
    if razorpay_payment_id:
        order.razorpay_payment_id = razorpay_payment_id
    order.payment_status = PaymentStatus.paid
    order.status = OrderStatus.printing
    for item in order.items:
        item.print_file_status = PrintFileStatus.generating
        item.print_file_error = None
    db.commit()

    for item in order.items:
        background_tasks.add_task(generate_order_item_print_file, str(item.id))
    if not was_paid:
        background_tasks.add_task(send_order_paid_email_task, str(order.id))


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
    if amount_paise < 100:
        raise HTTPException(status_code=400, detail="Minimum payment amount is 100 paise.")
    if order.payment_status == PaymentStatus.paid:
        raise HTTPException(status_code=400, detail="This order is already paid.")

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
    except razorpay.errors.BadRequestError as exc:
        if _is_razorpay_auth_failure(exc):
            raise HTTPException(status_code=401, detail="Razorpay authentication failed.") from exc
        raise HTTPException(
            status_code=500,
            detail="Payment provider order creation failed. Please retry shortly.",
        ) from exc
    except (razorpay.errors.GatewayError, razorpay.errors.ServerError) as exc:
        raise HTTPException(
            status_code=500,
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


@router.post("/verify-payment")
def verify_razorpay_payment(
    payload: VerifyRazorpayPaymentRequest,
    background_tasks: BackgroundTasks,
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not payload.razorpay_order_id or not payload.razorpay_payment_id or not payload.razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing Razorpay payment verification fields.")
    if not settings.razorpay_key_secret:
        raise HTTPException(status_code=401, detail="Razorpay key secret is not configured.")

    query = select(Order).options(joinedload(Order.items))
    if payload.app_order_id is not None:
        query = query.where(Order.id == payload.app_order_id)
    else:
        query = query.where(Order.razorpay_order_id == payload.razorpay_order_id)

    order = db.scalar(query)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if str(order.user_id) != current.id:
        raise HTTPException(status_code=403, detail="You cannot verify payment for this order.")
    if not order.razorpay_order_id or order.razorpay_order_id != payload.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Razorpay order does not match this order.")

    signature_payload = f"{order.razorpay_order_id}|{payload.razorpay_payment_id}"
    generated_signature = hmac.new(
        settings.razorpay_key_secret.encode("utf-8"),
        signature_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(generated_signature, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature.")

    if order.payment_status == PaymentStatus.paid:
        if order.razorpay_payment_id != payload.razorpay_payment_id:
            raise HTTPException(status_code=400, detail="Order is already paid with a different payment.")
        return {
            "ok": True,
            "status": order.payment_status.value,
            "order_id": str(order.id),
            "razorpay_order_id": order.razorpay_order_id,
            "razorpay_payment_id": order.razorpay_payment_id,
        }

    _mark_order_paid(order, payload.razorpay_payment_id, db, background_tasks)
    return {
        "ok": True,
        "status": order.payment_status.value,
        "order_id": str(order.id),
        "razorpay_order_id": order.razorpay_order_id,
        "razorpay_payment_id": order.razorpay_payment_id,
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
    elif settings.app_env.lower() == "production":
        raise HTTPException(status_code=503, detail="Razorpay webhook secret is not configured.")

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

    if order.payment_status == PaymentStatus.paid:
        if razorpay_payment_id and order.razorpay_payment_id and order.razorpay_payment_id != razorpay_payment_id:
            raise HTTPException(status_code=400, detail="Order is already paid with a different payment.")
        return {"ok": True}

    if event == "payment.captured" and not razorpay_payment_id:
        return {"ok": True, "ignored": True}

    _mark_order_paid(order, razorpay_payment_id, db, background_tasks)
    return {"ok": True}
