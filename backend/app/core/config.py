from functools import lru_cache
from typing import List

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_ADMIN_TOKEN_SALT = "babytint-admin-local"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8-sig",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001",
        alias="CORS_ORIGINS",
    )

    admin_login_email: str = Field(default="", alias="ADMIN_LOGIN_EMAIL")
    admin_login_password: str = Field(default="", alias="ADMIN_LOGIN_PASSWORD")
    admin_token_salt: str = Field(default=DEFAULT_ADMIN_TOKEN_SALT, alias="ADMIN_TOKEN_SALT")

    database_url: str = Field(alias="DATABASE_URL")

    razorpay_key_id: str = Field(default="", alias="RAZORPAY_KEY_ID")
    razorpay_key_secret: str = Field(default="", alias="RAZORPAY_KEY_SECRET")
    razorpay_webhook_secret: str = Field(default="", alias="RAZORPAY_WEBHOOK_SECRET")

    # Reserved, currently unused: no Delhivery courier integration exists
    # yet. Kept so the documented env vars don't silently become invalid if
    # someone has them set; wire these up when that integration is built.
    delhivery_api_token: str = Field(default="", alias="DELHIVERY_API_TOKEN")
    delhivery_mode: str = Field(default="production", alias="DELHIVERY_MODE")
    delhivery_pickup_location: str = Field(default="", alias="DELHIVERY_PICKUP_LOCATION")
    delhivery_api_base_url: str = Field(default="", alias="DELHIVERY_API_BASE_URL")

    local_auth_token_hours: int = Field(default=24, alias="LOCAL_AUTH_TOKEN_HOURS")
    password_reset_otp_minutes: int = Field(default=10, alias="PASSWORD_RESET_OTP_MINUTES")

    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str = Field(default="", alias="SMTP_USERNAME")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from_email: str = Field(default="", alias="SMTP_FROM_EMAIL")
    smtp_from_name: str = Field(default="BabyTint", alias="SMTP_FROM_NAME")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")
    smtp_use_ssl: bool = Field(default=False, alias="SMTP_USE_SSL")

    storage_bucket_frames: str = Field(default="frame-assets", alias="STORAGE_BUCKET_FRAMES")
    storage_bucket_uploads: str = Field(default="user-uploads", alias="STORAGE_BUCKET_UPLOADS")
    storage_bucket_prints: str = Field(default="print-ready", alias="STORAGE_BUCKET_PRINTS")
    # Reserved, currently unused: storage.py always writes to local storage
    # unconditionally (no cloud-storage code path exists to "fall back"
    # from). Kept so the documented env var doesn't silently become invalid.
    allow_local_storage_fallback: bool = Field(default=True, alias="ALLOW_LOCAL_STORAGE_FALLBACK")
    local_storage_root: str = Field(default="", alias="LOCAL_STORAGE_ROOT")
    public_base_url: str = Field(default="", alias="PUBLIC_BASE_URL")
    max_upload_bytes: int = Field(default=20 * 1024 * 1024, alias="MAX_UPLOAD_BYTES")
    max_upload_pixels: int = Field(default=80_000_000, alias="MAX_UPLOAD_PIXELS")

    @property
    def cors_list(self) -> List[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> "Settings":
        if not self.is_production:
            return self

        missing = []
        if not self.admin_token_salt or self.admin_token_salt == DEFAULT_ADMIN_TOKEN_SALT:
            missing.append("ADMIN_TOKEN_SALT (must be set to a unique random secret)")
        if not self.admin_login_email:
            missing.append("ADMIN_LOGIN_EMAIL")
        if not self.admin_login_password:
            missing.append("ADMIN_LOGIN_PASSWORD")
        if not self.razorpay_webhook_secret:
            missing.append("RAZORPAY_WEBHOOK_SECRET")
        if "*" in self.cors_list:
            missing.append("CORS_ORIGINS (must not be '*' when credentials are allowed)")

        if missing:
            raise ValueError(
                "Refusing to start with APP_ENV=production while required secrets are "
                "missing or insecure: " + "; ".join(missing)
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
