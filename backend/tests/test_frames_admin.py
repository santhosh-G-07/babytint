import uuid
from types import SimpleNamespace

from app.core.auth import AuthUser, require_admin
from app.core.database import get_db


class _FakeDB:
    def __init__(self, scalar_results):
        self._scalar_results = iter(scalar_results)
        self.executed = 0
        self.deleted = 0
        self.commits = 0

    def scalar(self, _statement):
        return next(self._scalar_results)

    def execute(self, _statement):
        self.executed += 1

    def delete(self, _obj):
        self.deleted += 1

    def commit(self):
        self.commits += 1


async def _fake_admin():
    return AuthUser(
        id="11111111-1111-1111-1111-111111111111",
        email="admin@example.com",
        name="Admin",
        role="admin",
        access_token="test-token",
    )


def test_delete_frame_blocked_when_order_items_exist(client):
    frame_id = uuid.uuid4()
    frame = SimpleNamespace(id=frame_id)
    fake_db = _FakeDB([frame, 1])

    def fake_get_db():
        yield fake_db

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[require_admin] = _fake_admin

    response = client.delete(f"/api/frames/{frame_id}")

    assert response.status_code == 409
    assert response.json()["detail"] == "Frame is used in orders. Deactivate it instead of deleting."
    assert fake_db.executed == 0
    assert fake_db.deleted == 0
    assert fake_db.commits == 0


def test_delete_frame_clears_cart_refs_and_deletes_when_unused(client):
    frame_id = uuid.uuid4()
    frame = SimpleNamespace(id=frame_id)
    fake_db = _FakeDB([frame, 0])

    def fake_get_db():
        yield fake_db

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[require_admin] = _fake_admin

    response = client.delete(f"/api/frames/{frame_id}")

    assert response.status_code == 204
    assert fake_db.executed == 1
    assert fake_db.deleted == 1
    assert fake_db.commits == 1
