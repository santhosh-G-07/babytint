"""sales hardening fields

Revision ID: 20260523_0002
Revises: 20260513_0001
Create Date: 2026-05-23 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260523_0002"
down_revision: Union[str, None] = "20260513_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    payment_status = sa.Enum("pending", "paid", "failed", "refunded", name="payment_status")
    print_file_status = sa.Enum("pending", "generating", "ready", "failed", name="print_file_status")
    payment_status.create(bind, checkfirst=True)
    print_file_status.create(bind, checkfirst=True)

    op.add_column("users", sa.Column("password_hash", sa.String(length=256), nullable=True))
    op.add_column("users", sa.Column("password_reset_code_hash", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("password_reset_sent_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column(
        "orders",
        sa.Column("payment_status", payment_status, nullable=False, server_default="pending"),
    )

    op.add_column(
        "order_items",
        sa.Column("print_file_status", print_file_status, nullable=False, server_default="pending"),
    )
    op.add_column("order_items", sa.Column("print_file_error", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("order_items", "print_file_error")
    op.drop_column("order_items", "print_file_status")
    op.drop_column("orders", "payment_status")
    op.drop_column("users", "password_reset_sent_at")
    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_code_hash")
    op.drop_column("users", "password_hash")

    bind = op.get_bind()
    sa.Enum(name="print_file_status").drop(bind, checkfirst=True)
    sa.Enum(name="payment_status").drop(bind, checkfirst=True)
