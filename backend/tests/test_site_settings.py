from types import SimpleNamespace

from app.core.auth import AuthUser, require_admin
from app.core.database import get_db


class _FakeDB:
    def __init__(self):
        self.settings = None
        self.commits = 0

    def get(self, _model, _key):
        return self.settings

    def add(self, settings):
        self.settings = settings

    def commit(self):
        self.commits += 1

    def refresh(self, settings):
        if not hasattr(settings, "updated_at"):
            settings.updated_at = None


async def _fake_admin():
    return AuthUser(
        id="11111111-1111-1111-1111-111111111111",
        email="admin@example.com",
        name="Admin",
        role="admin",
        access_token="test-token",
    )


def test_public_site_settings_returns_default(client):
    fake_db = _FakeDB()

    def fake_get_db():
        yield fake_db

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db

    response = client.get("/api/settings/site")

    assert response.status_code == 200
    assert response.json()["active_theme"] == "classic"
    assert fake_db.commits == 1


def test_admin_can_update_site_theme(client):
    fake_db = _FakeDB()
    fake_db.settings = SimpleNamespace(active_theme="classic", updated_at=None)

    def fake_get_db():
        yield fake_db

    from app.main import app

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[require_admin] = _fake_admin

    response = client.put("/api/settings/site", json={"active_theme": "blush"})

    assert response.status_code == 200
    assert response.json()["active_theme"] == "blush"
    assert fake_db.settings.active_theme == "blush"
    assert fake_db.commits == 1
