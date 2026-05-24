"""frame text positions

Revision ID: 20260523_0003
Revises: 20260523_0002
Create Date: 2026-05-23 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260523_0003"
down_revision: Union[str, None] = "20260523_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        json_type = postgresql.JSONB(astext_type=sa.Text())
        default = sa.text("'[]'::jsonb")
    else:
        json_type = sa.JSON()
        default = "[]"

    op.add_column(
        "frames",
        sa.Column("text_positions", json_type, nullable=False, server_default=default),
    )


def downgrade() -> None:
    op.drop_column("frames", "text_positions")
