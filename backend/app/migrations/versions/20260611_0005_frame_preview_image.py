"""frame storefront preview image

Revision ID: 20260611_0005
Revises: 20260523_0004
Create Date: 2026-06-11 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260611_0005"
down_revision: Union[str, None] = "20260523_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "frames",
        sa.Column("preview_image_url", sa.String(length=1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("frames", "preview_image_url")
