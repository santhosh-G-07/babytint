"""assisted customization price

Revision ID: 20260705_0007
Revises: 20260614_0006
Create Date: 2026-07-05 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260705_0007"
down_revision: str | None = "20260614_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "frames",
        sa.Column("assisted_customization_price", sa.Numeric(10, 2), nullable=True),
    )
    op.execute("UPDATE frames SET assisted_customization_price = 300.00 WHERE assisted_customization_price IS NULL")


def downgrade() -> None:
    op.drop_column("frames", "assisted_customization_price")
