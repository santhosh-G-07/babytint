from types import SimpleNamespace

from app.services.storage import resolve_local_storage_root


def _as_posix(path) -> str:
    return str(path).replace("\\", "/")


def test_local_storage_root_uses_configured_path():
    settings = SimpleNamespace(
        local_storage_root="/data/uploads",
        database_url="sqlite:////data/babytint.db",
    )

    assert _as_posix(resolve_local_storage_root(settings)) == "/data/uploads"


def test_local_storage_root_uses_sqlite_volume_parent():
    settings = SimpleNamespace(
        local_storage_root="",
        database_url="sqlite:////data/babytint.db",
    )

    assert _as_posix(resolve_local_storage_root(settings)) == "/data/local_storage"


def test_local_storage_root_defaults_to_project_path_for_non_sqlite():
    settings = SimpleNamespace(
        local_storage_root="",
        database_url="postgresql+psycopg2://user:pass@localhost/testdb",
    )

    assert _as_posix(resolve_local_storage_root(settings)) == "local_storage"
