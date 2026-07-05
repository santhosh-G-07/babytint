import hashlib
import hmac
import uuid
from decimal import Decimal
from types import SimpleNamespace

import razorpay

from app.api import payment
from app.core.auth import AuthUser, get_current_user
from app.core.database import get_db
from app.models.order import OrderStatus, PaymentStatus, PrintFileStatus


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
        id=uuid.uuid4(),
        razorpay_order_id="order_test_123",
        razorpay_payment_id=None,
        payment_status=PaymentStatus.pending,
        status=OrderStatus.received,
        items=[order_item_1, order_item_2],
    )
    fake_db = FakeDB(order)
    called_item_ids: list[str] = []
    emailed_order_ids: list[str] = []

    def fake_get_db():
        yield fake_db

    def fake_generate_order_item_print_file(item_id: str):
        called_item_ids.append(str(item_id))

    def fake_send_order_paid_email_task(order_id: str):
        emailed_order_ids.append(order_id)

    monkeypatch.setattr(payment, "generate_order_item_print_file", fake_generate_order_item_print_file)
    monkeypatch.setattr(payment, "send_order_paid_email_task", fake_send_order_paid_email_task)
    monkeypatch.setattr(payment.settings, "razorpay_webhook_secret", "")
    monkeypatch.setattr(payment.settings, "app_env", "development")

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
    assert emailed_order_ids == [str(order.id)]


def test_payment_webhook_skips_print_generation_for_assisted_items(client, monkeypatch):
    normal_item = SimpleNamespace(id=uuid.uuid4(), customization_data={"frame_id": str(uuid.uuid4())})
    assisted_item = SimpleNamespace(
        id=uuid.uuid4(),
        customization_data={
            "frame_id": str(uuid.uuid4()),
            "customization_mode": "assisted",
            "slots": [],
        },
    )
    order = SimpleNamespace(
        id=uuid.uuid4(),
        razorpay_order_id="order_test_123",
        razorpay_payment_id=None,
        payment_status=PaymentStatus.pending,
        status=OrderStatus.received,
        items=[normal_item, assisted_item],
    )
    fake_db = FakeDB(order)
    called_item_ids: list[str] = []
    emailed_order_ids: list[str] = []

    def fake_get_db():
        yield fake_db

    def fake_generate_order_item_print_file(item_id: str):
        called_item_ids.append(str(item_id))

    def fake_send_order_paid_email_task(order_id: str):
        emailed_order_ids.append(order_id)

    monkeypatch.setattr(payment, "generate_order_item_print_file", fake_generate_order_item_print_file)
    monkeypatch.setattr(payment, "send_order_paid_email_task", fake_send_order_paid_email_task)
    monkeypatch.setattr(payment.settings, "razorpay_webhook_secret", "")
    monkeypatch.setattr(payment.settings, "app_env", "development")

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
    assert normal_item.print_file_status == PrintFileStatus.generating
    assert assisted_item.print_file_status == PrintFileStatus.pending
    assert called_item_ids == [str(normal_item.id)]
    assert emailed_order_ids == [str(order.id)]


def test_payment_webhook_ignores_duplicate_paid_event(client, monkeypatch):
    order_item = SimpleNamespace(id=uuid.uuid4())
    order = SimpleNamespace(
        id=uuid.uuid4(),
        razorpay_order_id="order_test_123",
        razorpay_payment_id="pay_test_001",
        payment_status=PaymentStatus.paid,
        status=OrderStatus.printing,
        items=[order_item],
    )
    fake_db = FakeDB(order)
    called_item_ids: list[str] = []
    emailed_order_ids: list[str] = []

    def fake_get_db():
        yield fake_db

    def fake_generate_order_item_print_file(item_id: str):
        called_item_ids.append(str(item_id))

    def fake_send_order_paid_email_task(order_id: str):
        emailed_order_ids.append(order_id)

    monkeypatch.setattr(payment, "generate_order_item_print_file", fake_generate_order_item_print_file)
    monkeypatch.setattr(payment, "send_order_paid_email_task", fake_send_order_paid_email_task)
    monkeypatch.setattr(payment.settings, "razorpay_webhook_secret", "")
    monkeypatch.setattr(payment.settings, "app_env", "development")

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
    assert fake_db.commits == 0
    assert called_item_ids == []
    assert emailed_order_ids == []


def test_payment_webhook_rejects_malformed_json(client, monkeypatch):
    monkeypatch.setattr(payment.settings, "razorpay_webhook_secret", "")
    monkeypatch.setattr(payment.settings, "app_env", "development")

    response = client.post(
        "/api/payment/webhook",
        data="{bad-json",
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Malformed webhook payload."


def test_payment_webhook_accepts_utf8_bom(client, monkeypatch):
    monkeypatch.setattr(payment.settings, "razorpay_webhook_secret", "")
    monkeypatch.setattr(payment.settings, "app_env", "development")

    response = client.post(
        "/api/payment/webhook",
        data=b"\xef\xbb\xbf{}",
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True, "ignored": True}


def test_payment_webhook_requires_secret_in_production(client, monkeypatch):
    monkeypatch.setattr(payment.settings, "razorpay_webhook_secret", "")
    monkeypatch.setattr(payment.settings, "app_env", "production")

    response = client.post(
        "/api/payment/webhook",
        json={},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Razorpay webhook secret is not configured."


def test_create_order_handles_provider_failure(client, monkeypatch):
    user_id = uuid.uuid4()
    order_id = uuid.uuid4()
    order = SimpleNamespace(
        id=order_id,
        user_id=user_id,
        total_amount=Decimal("1598.00"),
        razorpay_order_id=None,
        payment_status=PaymentStatus.pending,
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

    assert response.status_code == 401
    assert response.json()["detail"] == "Razorpay authentication failed."


def test_create_order_rejects_amount_below_minimum(client, monkeypatch):
    user_id = uuid.uuid4()
    order_id = uuid.uuid4()
    order = SimpleNamespace(
        id=order_id,
        user_id=user_id,
        total_amount=Decimal("0.50"),
        razorpay_order_id=None,
        payment_status=PaymentStatus.pending,
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

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = fake_get_current_user

    response = client.post(
        "/api/payment/create-order",
        json={"order_id": str(order_id)},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Minimum payment amount is 100 paise."
    assert fake_db.commits == 0


def test_verify_payment_marks_paid_after_signature_match(client, monkeypatch):
    user_id = uuid.uuid4()
    order_id = uuid.uuid4()
    razorpay_order_id = "order_test_123"
    razorpay_payment_id = "pay_test_001"
    signature = hmac.new(
        payment.settings.razorpay_key_secret.encode("utf-8"),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    order_item = SimpleNamespace(id=uuid.uuid4(), print_file_status=PrintFileStatus.pending, print_file_error="old")
    order = SimpleNamespace(
        id=order_id,
        user_id=user_id,
        razorpay_order_id=razorpay_order_id,
        razorpay_payment_id=None,
        payment_status=PaymentStatus.pending,
        status=OrderStatus.received,
        items=[order_item],
    )
    fake_db = FakeDB(order)
    called_item_ids: list[str] = []
    emailed_order_ids: list[str] = []

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

    def fake_generate_order_item_print_file(item_id: str):
        called_item_ids.append(item_id)

    def fake_send_order_paid_email_task(order_id: str):
        emailed_order_ids.append(order_id)

    monkeypatch.setattr(payment, "generate_order_item_print_file", fake_generate_order_item_print_file)
    monkeypatch.setattr(payment, "send_order_paid_email_task", fake_send_order_paid_email_task)

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = fake_get_current_user

    response = client.post(
        "/api/payment/verify-payment",
        json={
            "app_order_id": str(order_id),
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": signature,
        },
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert order.payment_status == PaymentStatus.paid
    assert order.status == OrderStatus.printing
    assert order.razorpay_payment_id == razorpay_payment_id
    assert order_item.print_file_status == PrintFileStatus.generating
    assert order_item.print_file_error is None
    assert fake_db.commits == 1
    assert called_item_ids == [str(order_item.id)]
    assert emailed_order_ids == [str(order.id)]


def test_verify_payment_rejects_signature_mismatch_without_marking_paid(client):
    user_id = uuid.uuid4()
    order_id = uuid.uuid4()
    order = SimpleNamespace(
        id=order_id,
        user_id=user_id,
        razorpay_order_id="order_test_123",
        razorpay_payment_id=None,
        payment_status=PaymentStatus.pending,
        status=OrderStatus.received,
        items=[],
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

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = fake_get_current_user

    response = client.post(
        "/api/payment/verify-payment",
        json={
            "app_order_id": str(order_id),
            "razorpay_order_id": "order_test_123",
            "razorpay_payment_id": "pay_test_001",
            "razorpay_signature": "bad-signature",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid Razorpay payment signature."
    assert order.payment_status == PaymentStatus.pending
    assert fake_db.commits == 0


def test_verify_payment_rejects_missing_fields(client):
    user_id = uuid.uuid4()

    def fake_get_db():
        yield FakeDB(None)

    async def fake_get_current_user():
        return AuthUser(
            id=str(user_id),
            email="user@example.com",
            name="User",
            role="customer",
            access_token="test-token",
        )

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = fake_get_current_user

    response = client.post(
        "/api/payment/verify-payment",
        json={"razorpay_order_id": "order_test_123"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Missing Razorpay payment verification fields."
