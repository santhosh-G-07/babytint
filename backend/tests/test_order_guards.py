import uuid
from decimal import Decimal
from types import SimpleNamespace

from app.core.auth import AuthUser, get_current_user, require_admin
from app.core.database import get_db
from app.models.order import OrderStatus, PaymentStatus


class _ScalarResult:
    def __init__(self, values):
        self._values = list(values)

    def __iter__(self):
        return iter(self._values)

    def unique(self):
        return self

    def first(self):
        return self._values[0] if self._values else None


class _FakeDB:
    def __init__(self, *, scalar_results=None, scalars_results=None):
        self._scalar_results = iter(scalar_results or [])
        self._scalars_results = iter(scalars_results or [])
        self.added = 0
        self.flushes = 0
        self.commits = 0

    def scalar(self, _statement):
        return next(self._scalar_results)

    def scalars(self, _statement):
        return _ScalarResult(next(self._scalars_results))

    def add(self, _obj):
        self.added += 1

    def flush(self):
        self.flushes += 1

    def commit(self):
        self.commits += 1

    def refresh(self, *_args, **_kwargs):
        return None


async def _fake_customer():
    return AuthUser(
        id="11111111-1111-1111-1111-111111111111",
        email="customer@example.com",
        name="Customer",
        role="customer",
        access_token="test-token",
    )


async def _fake_admin():
    return AuthUser(
        id="11111111-1111-1111-1111-111111111111",
        email="admin@example.com",
        name="Admin",
        role="admin",
        access_token="test-token",
    )


def test_checkout_rejects_inactive_frame_without_creating_order(client):
    frame_id = uuid.uuid4()
    fake_db = _FakeDB(
        scalars_results=[
            [
                SimpleNamespace(
                    id=frame_id,
                    name="Archived Frame",
                    is_active=False,
                    offer_price=None,
                    price=Decimal("1499.00"),
                    slot_positions=[{"slot_id": 1}],
                )
            ]
        ]
    )

    def fake_get_db():
        yield fake_db

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = _fake_customer

    response = client.post(
        "/api/orders/checkout",
        json={
            "delivery_address": {
                "fullName": "Sherlock Holmes",
                "phone": "9876543210",
                "line1": "221B Baker Street",
                "line2": "",
                "city": "London",
                "state": "London",
                "postalCode": "NW16XE",
                "notes": "",
            },
            "items": [
                {
                    "frame_id": str(frame_id),
                    "quantity": 1,
                    "customization_data": {
                        "frame_id": str(frame_id),
                        "slots": [{"slot_id": 1, "image_url": "https://example.com/photo.png"}],
                        "composite_preview_url": "https://example.com/preview.png",
                    },
                }
            ],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Archived Frame is no longer available."
    assert fake_db.added == 0
    assert fake_db.flushes == 0
    assert fake_db.commits == 0


def test_unpaid_order_cannot_move_to_printing(client):
    order_id = uuid.uuid4()
    fake_db = _FakeDB(
        scalars_results=[
            [
                SimpleNamespace(
                    id=order_id,
                    payment_status=PaymentStatus.pending,
                    status=OrderStatus.received,
                    tracking_link=None,
                    items=[],
                )
            ]
        ]
    )

    def fake_get_db():
        yield fake_db

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[require_admin] = _fake_admin

    response = client.patch(
        f"/api/orders/{order_id}/status",
        json={"status": "printing", "tracking_link": ""},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unpaid orders cannot move into printing, dispatch, or delivery."
    assert fake_db.commits == 0


def test_unpaid_order_cannot_generate_print_files(client):
    item_id = uuid.uuid4()
    order = SimpleNamespace(payment_status=PaymentStatus.pending)
    item = SimpleNamespace(id=item_id, order=order, frame=SimpleNamespace())
    fake_db = _FakeDB(scalar_results=[item])

    def fake_get_db():
        yield fake_db

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[require_admin] = _fake_admin

    response = client.post(f"/api/orders/admin/items/{item_id}/print-file")

    assert response.status_code == 400
    assert response.json()["detail"] == "Payment must be completed before generating print files."
    assert fake_db.commits == 0


def test_create_payment_order_rejects_inactive_frame_order(client):
    order_id = uuid.uuid4()
    fake_db = _FakeDB(
        scalars_results=[
            [
                SimpleNamespace(
                    id=order_id,
                    user_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
                    total_amount=Decimal("1499.00"),
                    razorpay_order_id=None,
                    payment_status=PaymentStatus.pending,
                    items=[SimpleNamespace(frame=SimpleNamespace(is_active=False))],
                )
            ]
        ]
    )

    def fake_get_db():
        yield fake_db

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = _fake_customer

    response = client.post(
        "/api/payment/create-order",
        json={"order_id": str(order_id)},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "This order contains a frame that is no longer available."
    assert fake_db.commits == 0
