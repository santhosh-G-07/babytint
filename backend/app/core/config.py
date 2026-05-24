from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001",
        alias="CORS_ORIGINS",
    )

    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_service_key: str = Field(alias="SUPABASE_SERVICE_KEY")
    admin_login_email: str = Field(default="", alias="ADMIN_LOGIN_EMAIL")
    admin_login_password: str = Field(default="", alias="ADMIN_LOGIN_PASSWORD")
    admin_token_salt: str = Field(default="babytint-admin-local", alias="ADMIN_TOKEN_SALT")

    database_url: str = Field(alias="DATABASE_URL")

    razorpay_key_id: str = Field(alias="RAZORPAY_KEY_ID")
    razorpay_key_secret: str = Field(alias="RAZORPAY_KEY_SECRET")
    razorpay_webhook_secret: str = Field(default="", alias="RAZORPAY_WEBHOOK_SECRET")
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
    allow_local_storage_fallback: bool = Field(default=True, alias="ALLOW_LOCAL_STORAGE_FALLBACK")
    public_base_url: str = Field(default="", alias="PUBLIC_BASE_URL")
    max_upload_bytes: int = Field(default=20 * 1024 * 1024, alias="MAX_UPLOAD_BYTES")
    max_upload_pixels: int = Field(default=80_000_000, alias="MAX_UPLOAD_PIXELS")

    @property
    def cors_list(self) -> List[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
