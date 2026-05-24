from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

SiteTheme = Literal["classic", "blush", "midnight"]


class SiteSettingsUpdate(BaseModel):
    active_theme: SiteTheme


class SiteSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    active_theme: SiteTheme
    updated_at: datetime | None = None
