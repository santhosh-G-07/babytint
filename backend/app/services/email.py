from email.message import EmailMessage
import smtplib

from app.core.config import get_settings


def is_smtp_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_username and settings.smtp_password)


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
