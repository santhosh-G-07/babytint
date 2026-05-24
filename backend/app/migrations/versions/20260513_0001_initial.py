"""initial schema

Revision ID: 20260513_0001
Revises: None
Create Date: 2026-05-13 16:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260513_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role = sa.Enum("customer", "admin", name="user_role")
    order_status = sa.Enum("received", "printing", "dispatched", "delivered", name="order_status")
    user_role.create(op.get_bind(), checkfirst=True)
    order_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supabase_uid", sa.String(length=128), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("role", user_role, nullable=False, server_default="customer"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.UniqueConstraint("supabase_uid", name=op.f("uq_users_supabase_uid")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)
    op.create_index(op.f("ix_users_supabase_uid"), "users", ["supabase_uid"], unique=False)

    op.create_table(
        "frames",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=180), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("size", sa.String(length=40), nullable=False),
        sa.Column("slot_count", sa.Integer(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("offer_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("frame_asset_url", sa.String(length=1024), nullable=False),
        sa.Column("slot_positions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_frames")),
        sa.UniqueConstraint("slug", name=op.f("uq_frames_slug")),
    )
    op.create_index(op.f("ix_frames_slug"), "frames", ["slug"], unique=False)
    op.create_index(op.f("ix_frames_category"), "frames", ["category"], unique=False)
    op.create_index(op.f("ix_frames_size"), "frames", ["size"], unique=False)

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", order_status, nullable=False, server_default="received"),
        sa.Column("razorpay_order_id", sa.String(length=120), nullable=True),
        sa.Column("razorpay_payment_id", sa.String(length=120), nullable=True),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("delivery_address", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("tracking_link", sa.String(length=1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_orders_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_orders")),
    )
    op.create_index(op.f("ix_orders_user_id"), "orders", ["user_id"], unique=False)
    op.create_index(op.f("ix_orders_razorpay_order_id"), "orders", ["razorpay_order_id"], unique=False)
    op.create_index(op.f("ix_orders_razorpay_payment_id"), "orders", ["razorpay_payment_id"], unique=False)

    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("frame_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customization_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("print_file_url", sa.String(length=1024), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.ForeignKeyConstraint(["frame_id"], ["frames.id"], name=op.f("fk_order_items_frame_id_frames")),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], name=op.f("fk_order_items_order_id_orders")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_order_items")),
    )
    op.create_index(op.f("ix_order_items_order_id"), "order_items", ["order_id"], unique=False)
    op.create_index(op.f("ix_order_items_frame_id"), "order_items", ["frame_id"], unique=False)

    op.create_table(
        "cart_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("frame_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customization_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["frame_id"], ["frames.id"], name=op.f("fk_cart_items_frame_id_frames")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_cart_items_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cart_items")),
    )
    op.create_index(op.f("ix_cart_items_user_id"), "cart_items", ["user_id"], unique=False)
    op.create_index(op.f("ix_cart_items_frame_id"), "cart_items", ["frame_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_cart_items_frame_id"), table_name="cart_items")
    op.drop_index(op.f("ix_cart_items_user_id"), table_name="cart_items")
    op.drop_table("cart_items")

    op.drop_index(op.f("ix_order_items_frame_id"), table_name="order_items")
    op.drop_index(op.f("ix_order_items_order_id"), table_name="order_items")
    op.drop_table("order_items")

    op.drop_index(op.f("ix_orders_razorpay_payment_id"), table_name="orders")
    op.drop_index(op.f("ix_orders_razorpay_order_id"), table_name="orders")
    op.drop_index(op.f("ix_orders_user_id"), table_name="orders")
    op.drop_table("orders")

    op.drop_index(op.f("ix_frames_size"), table_name="frames")
    op.drop_index(op.f("ix_frames_category"), table_name="frames")
    op.drop_index(op.f("ix_frames_slug"), table_name="frames")
    op.drop_table("frames")

    op.drop_index(op.f("ix_users_supabase_uid"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    sa.Enum(name="order_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)

