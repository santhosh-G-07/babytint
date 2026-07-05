from decimal import Decimal
from email.message import EmailMessage
from html import escape
import logging
import smtplib
import uuid

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.order import Order, OrderItem
from app.services.customization import is_assisted_customization

logger = logging.getLogger(__name__)


def is_smtp_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_username and settings.smtp_password)


def _send_message(message: EmailMessage) -> None:
    settings = get_settings()
    if not is_smtp_configured():
        raise RuntimeError("SMTP is not configured.")

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


def send_password_reset_otp(*, to_email: str, otp: str) -> None:
    settings = get_settings()
    if not is_smtp_configured():
        raise RuntimeError("SMTP is not configured.")

    from_email = settings.smtp_from_email or settings.smtp_username
    message = EmailMessage()
    message["Subject"] = "Your BabyTint password reset OTP"
    message["From"] = f"{settings.smtp_from_name} <{from_email}>"
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                f"Your BabyTint password reset OTP is {otp}.",
                f"It expires in {settings.password_reset_otp_minutes} minutes.",
                "",
                "If you did not request this, you can ignore this email.",
            ]
        )
    )

    _send_message(message)


def _format_money(value: Decimal | int | float | str | None) -> str:
    amount = Decimal(str(value or "0"))
    return f"INR {amount:,.2f}"


def _delivery_lines(address: dict | None) -> list[str]:
    if not address:
        return []
    lines = [
        address.get("fullName", ""),
        address.get("line1", ""),
        address.get("line2", ""),
        ", ".join(
            part
            for part in [
                address.get("city", ""),
                address.get("state", ""),
                address.get("postalCode", ""),
            ]
            if part
        ),
        address.get("phone", ""),
    ]
    return [str(line).strip() for line in lines if str(line or "").strip()]


def _order_item_label(item: OrderItem) -> str:
    frame = getattr(item, "frame", None)
    frame_name = getattr(frame, "name", None) or "Custom frame"
    if is_assisted_customization(getattr(item, "customization_data", {})):
        frame_name = f"{frame_name} + assisted customization"
    return f"{frame_name} x {item.quantity} - {_format_money(item.price * item.quantity)}"


def send_order_paid_email(order: Order) -> None:
    settings = get_settings()
    if not is_smtp_configured():
        raise RuntimeError("SMTP is not configured.")

    user = order.user
    if user is None or not user.email:
        raise RuntimeError("Order customer email is not available.")

    from_email = settings.smtp_from_email or settings.smtp_username
    order_code = str(order.id)[:8]
    customer_name = user.name or order.delivery_address.get("fullName") or "there"
    item_labels = [_order_item_label(item) for item in order.items]
    delivery_lines = _delivery_lines(order.delivery_address)

    text_lines = [
        f"Hi {customer_name},",
        "",
        f"Your BabyTint order #{order_code} is confirmed.",
        "Payment is received and your custom frame is now moving to printing.",
        "",
        f"Order total: {_format_money(order.total_amount)}",
        "Items:",
        *[f"- {label}" for label in item_labels],
        "",
        "Delivery address:",
        *[f"- {line}" for line in delivery_lines],
        "",
        "We will share the tracking link once your order is dispatched.",
        "Thank you for choosing BabyTint.",
    ]

    escaped_items = "".join(f"<li>{escape(label)}</li>" for label in item_labels)
    escaped_address = "<br>".join(escape(line) for line in delivery_lines)
    html_body = f"""\
<!doctype html>
<html>
  <body style="margin:0;background:#f8f5ef;font-family:Arial,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f5ef;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e7dfd2;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;background:#111827;color:#ffffff;">
                <div style="font-size:24px;font-weight:700;letter-spacing:.3px;">BabyTint</div>
                <div style="margin-top:8px;font-size:15px;color:#d1d5db;">Order #{escape(order_code)} confirmed</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px;">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#111827;">Payment received</h1>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Hi {escape(customer_name)}, your custom BabyTint frame is confirmed and now moving to printing.</p>
                <div style="margin:22px 0;padding:16px 18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;">
                  <div style="font-size:13px;text-transform:uppercase;color:#9a3412;font-weight:700;">Order total</div>
                  <div style="font-size:24px;font-weight:700;margin-top:4px;color:#111827;">{escape(_format_money(order.total_amount))}</div>
                </div>
                <h2 style="font-size:16px;margin:24px 0 10px;color:#111827;">Items</h2>
                <ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.7;">{escaped_items}</ul>
                <h2 style="font-size:16px;margin:24px 0 10px;color:#111827;">Delivery address</h2>
                <p style="margin:0;font-size:15px;line-height:1.7;">{escaped_address}</p>
                <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#4b5563;">We will share the tracking link once your order is dispatched.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#f3f0ea;color:#6b7280;font-size:13px;">
                Thank you for choosing BabyTint.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

    message = EmailMessage()
    message["Subject"] = f"BabyTint order #{order_code} confirmed"
    message["From"] = f"{settings.smtp_from_name} <{from_email}>"
    message["To"] = user.email
    message.set_content("\n".join(text_lines))
    message.add_alternative(html_body, subtype="html")
    _send_message(message)


def send_order_paid_email_task(order_id: str) -> None:
    if not is_smtp_configured():
        logger.info("Skipping paid order email because SMTP is not configured.")
        return

    try:
        parsed_order_id = uuid.UUID(order_id)
    except ValueError:
        logger.warning("Skipping paid order email for invalid order id %s.", order_id)
        return

    try:
        with SessionLocal() as db:
            stmt = (
                select(Order)
                .where(Order.id == parsed_order_id)
                .options(
                    joinedload(Order.user),
                    joinedload(Order.items).joinedload(OrderItem.frame),
                )
            )
            order = db.scalars(stmt).unique().first()
            if order is None:
                logger.warning("Skipping paid order email because order %s was not found.", order_id)
                return
            send_order_paid_email(order)
    except Exception:
        logger.exception("Could not send paid order email for order %s.", order_id)
