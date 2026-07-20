"""cart item quantity

Revision ID: 20260614_0006
Revises: 20260611_0005
Create Date: 2026-06-14 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260614_0006"
down_revision: Union[str, None] = "20260611_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cart_items",
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("cart_items", "quantity")
