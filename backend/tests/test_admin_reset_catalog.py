from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.auth import AuthUser, require_admin
from app.core.database import Base, get_db
from app.models import CartItem, Frame, Order, OrderItem, OrderStatus, PaymentStatus, User


async def _fake_admin():
    return AuthUser(
        id="11111111-1111-1111-1111-111111111111",
        email="admin@example.com",
        name="Admin",
        role="admin",
        access_token="test-token",
    )


def test_reset_catalog_archives_ordered_frames_and_deletes_unused(client, tmp_path):
    from app.main import app

    engine = create_engine(f"sqlite:///{tmp_path / 'catalog-reset.db'}", future=True)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(engine)

    with TestingSession() as db:
        user = User(
            supabase_uid="local:test-user",
            email="customer@example.com",
            name="Customer",
        )
        used_frame = Frame(
            name="Ordered Frame",
            slug="ordered-frame",
            category="old",
            size="12x8",
            slot_count=1,
            price=Decimal("1200.00"),
            assisted_customization_price=Decimal("300.00"),
            frame_asset_url="https://example.com/ordered.png",
            slot_positions=[{"slot_id": 1, "x": 0, "y": 0, "width": 10, "height": 10}],
            text_positions=[],
        )
        unused_frame = Frame(
            name="Unused Frame",
            slug="unused-frame",
            category="old",
            size="12x8",
            slot_count=1,
            price=Decimal("1200.00"),
            assisted_customization_price=Decimal("300.00"),
            frame_asset_url="https://example.com/unused.png",
            slot_positions=[{"slot_id": 1, "x": 0, "y": 0, "width": 10, "height": 10}],
            text_positions=[],
        )
        db.add_all([user, used_frame, unused_frame])
        db.flush()

        order = Order(
            user_id=user.id,
            status=OrderStatus.received,
            payment_status=PaymentStatus.paid,
            total_amount=Decimal("1200.00"),
            delivery_address={"fullName": "Customer"},
        )
        db.add(order)
        db.flush()
        db.add(
            OrderItem(
                order_id=order.id,
                frame_id=used_frame.id,
                customization_data={"frame_id": str(used_frame.id), "slots": []},
                quantity=1,
                price=Decimal("1200.00"),
            )
        )
        db.add(
            CartItem(
                user_id=user.id,
                frame_id=unused_frame.id,
                customization_data={"frame_id": str(unused_frame.id), "slots": []},
                quantity=1,
            )
        )
        db.commit()

    def fake_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[require_admin] = _fake_admin

    response = client.post("/api/admin/frames/reset-catalog")

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "total_frames": 2,
        "deleted_frames": 1,
        "deactivated_frames": 1,
        "cleared_cart_items": 1,
    }

    with TestingSession() as db:
        frames = list(db.scalars(select(Frame)).all())
        assert len(frames) == 1
        assert frames[0].name == "Ordered Frame"
        assert frames[0].is_active is False
        assert frames[0].slug == f"archived-{frames[0].id}"
        assert db.scalar(select(CartItem)) is None
        assert db.scalar(select(OrderItem).where(OrderItem.frame_id == frames[0].id)) is not None
