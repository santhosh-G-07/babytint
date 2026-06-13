import uuid
from decimal import Decimal
from types import SimpleNamespace

from app.services import email as email_service


def test_paid_order_email_contains_confirmation_details(monkeypatch):
    settings = SimpleNamespace(
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username="orders@example.com",
        smtp_password="app-password",
        smtp_from_email="orders@example.com",
        smtp_from_name="BabyTint",
        smtp_use_tls=True,
        smtp_use_ssl=False,
    )
    sent_messages = []
    monkeypatch.setattr(email_service, "get_settings", lambda: settings)
    monkeypatch.setattr(email_service, "_send_message", sent_messages.append)

    order_id = uuid.uuid4()
    order = SimpleNamespace(
        id=order_id,
        total_amount=Decimal("1299.00"),
        delivery_address={
            "fullName": "Test Customer",
            "phone": "9999999999",
            "line1": "12 Test Street",
            "line2": "",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postalCode": "560001",
        },
        user=SimpleNamespace(email="customer@example.com", name="Test Customer"),
        items=[
            SimpleNamespace(
                frame=SimpleNamespace(name="Baby Birth Frame"),
                quantity=1,
                price=Decimal("1299.00"),
            ),
        ],
    )

    email_service.send_order_paid_email(order)

    assert len(sent_messages) == 1
    message = sent_messages[0]
    assert message["To"] == "customer@example.com"
    assert str(order_id)[:8] in message["Subject"]
    content = message.as_string()
    assert "Payment received" in content
    assert "Baby Birth Frame" in content
    assert "INR 1,299.00" in content
    assert "12 Test Street" in content
    assert "tracking link once your order is dispatched" in content
