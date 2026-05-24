import uuid

from app.core.database import get_db


def _dummy_db():
    yield object()


def test_cart_requires_auth(client):
    from app.main import app

    app.dependency_overrides[get_db] = _dummy_db
    response = client.get("/api/orders/cart")
    assert response.status_code == 401


def test_checkout_requires_auth(client):
    from app.main import app

    app.dependency_overrides[get_db] = _dummy_db
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
                    "frame_id": str(uuid.uuid4()),
                    "quantity": 1,
                    "customization_data": {
                        "frame_id": str(uuid.uuid4()),
                        "slots": [],
                    },
                }
            ],
        },
    )
    assert response.status_code == 401
