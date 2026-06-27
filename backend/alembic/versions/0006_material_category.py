"""add category column to materials

Revision ID: 0006_material_category
Revises: 0005_deadline_type
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_material_category"
down_revision = "0005_deadline_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("materials", sa.Column("category", sa.String(50), server_default="other"))


def downgrade() -> None:
    op.drop_column("materials", "category")
