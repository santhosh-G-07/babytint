import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    customer = "customer"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(256), nullable=True)
    password_reset_code_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_reset_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Per-account OTP brute-force guard: counts wrong attempts against the
    # current OTP; once it hits the threshold the account is locked out of
    # both new attempts and new OTP requests until password_reset_locked_until
    # passes, closing the loophole of just requesting a fresh OTP to reset
    # a per-IP attempt counter.
    password_reset_failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    password_reset_locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        default=UserRole.customer,
        nullable=False,
    )
    # Bumped on logout (and could be bumped on password change) so
    # previously-issued session tokens, which embed the version they were
    # minted with, stop validating immediately instead of staying replayable
    # until their natural expiry.
    session_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    orders = relationship("Order", back_populates="user", cascade="all,delete-orphan")
    cart_items = relationship("CartItem", back_populates="user", cascade="all,delete-orphan")
