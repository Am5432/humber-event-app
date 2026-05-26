"""create event images table

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-20
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision = "0013"
down_revision: str | None = "0012"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "event_image",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("event_id", sa.String(length=50), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("original_url", sa.String(length=500), nullable=False),
        sa.Column("display_url", sa.String(length=500), nullable=False),
        sa.Column("thumbnail_url", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["event.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_event_image_event_id"), "event_image", ["event_id"], unique=False)
    op.create_index(
        "ix_event_image_event_id_sort_order",
        "event_image",
        ["event_id", "sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_event_image_event_id_sort_order", table_name="event_image")
    op.drop_index(op.f("ix_event_image_event_id"), table_name="event_image")
    op.drop_table("event_image")
