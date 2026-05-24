import uuid
from decimal import Decimal
from types import SimpleNamespace

import razorpay

from app.api import payment
from app.core.auth import AuthUser, get_current_user
from app.core.database import get_db
from app.models.order import OrderStatus


class FakeDB:
    def __init__(self, order):
        self.order = order
        self.commits = 0

    def scalar(self, _statement):
        return self.order

    def commit(self):
        self.commits += 1


def test_payment_webhook_marks_printing_and_triggers_jobs(client, monkeypatch):
    order_item_1 = SimpleNamespace(id=uuid.uuid4())
    order_item_2 = SimpleNamespace(id=uuid.uuid4())
    order = SimpleNamespace(
        razorpay_order_id="order_test_123",
        razorpay_payment_id=None,
        status=OrderStatus.received,
        items=[order_item_1, order_item_2],
    )
    fake_db = FakeDB(order)
    called_item_ids: list[str] = []

    def fake_get_db():
        yield fake_db

    def fake_generate_order_item_print_file(item_id: str):
        called_item_ids.append(str(item_id))

    monkeypatch.setattr(payment, "generate_order_item_print_file", fake_generate_order_item_print_file)
    monkeypatch.setattr(payment.settings, "razorpay_webhook_secret", "")

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db

    response = client.post(
        "/api/payment/webhook",
        json={
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test_001",
                        "order_id": "order_test_123",
                    }
                }
            },
        },
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert order.status == OrderStatus.printing
    assert order.razorpay_payment_id == "pay_test_001"
    assert fake_db.commits == 1
    assert called_item_ids == [str(order_item_1.id), str(order_item_2.id)]


def test_payment_webhook_rejects_malformed_json(client, monkeypatch):
    monkeypatch.setattr(payment.settings, "razorpay_webhook_secret", "")

    response = client.post(
        "/api/payment/webhook",
        data="{bad-json",
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Malformed webhook payload."


def test_payment_webhook_accepts_utf8_bom(client, monkeypatch):
    monkeypatch.setattr(payment.settings, "razorpay_webhook_secret", "")

    response = client.post(
        "/api/payment/webhook",
        data=b"\xef\xbb\xbf{}",
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True, "ignored": True}


def test_create_order_handles_provider_failure(client, monkeypatch):
    user_id = uuid.uuid4()
    order_id = uuid.uuid4()
    order = SimpleNamespace(
        id=order_id,
        user_id=user_id,
        total_amount=Decimal("1598.00"),
        razorpay_order_id=None,
    )
    fake_db = FakeDB(order)

    def fake_get_db():
        yield fake_db

    async def fake_get_current_user():
        return AuthUser(
            id=str(user_id),
            email="user@example.com",
            name="User",
            role="customer",
            access_token="test-token",
        )

    class _FakeRazorpayOrderClient:
        @staticmethod
        def create(_payload):
            raise razorpay.errors.BadRequestError("Authentication failed")

    class _FakeRazorpayClient:
        order = _FakeRazorpayOrderClient()

    monkeypatch.setattr(payment, "_razorpay_client", lambda: _FakeRazorpayClient())

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = fake_get_current_user

    response = client.post(
        "/api/payment/create-order",
        json={"order_id": str(order_id)},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Payment provider order creation failed. Please retry shortly."
