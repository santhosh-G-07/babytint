"""site settings

Revision ID: 20260523_0004
Revises: 20260523_0003
Create Date: 2026-05-23 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260523_0004"
down_revision: Union[str, None] = "20260523_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("active_theme", sa.String(length=40), nullable=False, server_default="classic"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_site_settings")),
    )
    op.execute("INSERT INTO site_settings (id, active_theme) VALUES (1, 'classic')")


def downgrade() -> None:
    op.drop_table("site_settings")
