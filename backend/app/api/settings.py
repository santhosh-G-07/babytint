from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_admin
from app.core.database import get_db
from app.models.site import SiteSettings
from app.schemas.site import SiteSettingsRead, SiteSettingsUpdate

router = APIRouter(prefix="/settings")


def _site_settings(db: Session) -> SiteSettings:
    settings = db.get(SiteSettings, 1)
    if settings is None:
        settings = SiteSettings(id=1, active_theme="classic")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/site", response_model=SiteSettingsRead)
def get_site_settings(db: Session = Depends(get_db)) -> SiteSettings:
    return _site_settings(db)


@router.put("/site", response_model=SiteSettingsRead)
def update_site_settings(
    payload: SiteSettingsUpdate,
    _: AuthUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SiteSettings:
    settings = _site_settings(db)
    settings.active_theme = payload.active_theme
    db.commit()
    db.refresh(settings)
    return settings
