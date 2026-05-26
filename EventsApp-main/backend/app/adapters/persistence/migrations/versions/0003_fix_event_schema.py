"""fix event schema: add submitted_at, seed categories

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-05

"""
from typing import Sequence, Union
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = [
    "Academic",
    "Sports & Recreation",
    "Arts & Culture",
    "Social",
    "Career & Professional",
    "Health & Wellness",
    "Technology",
    "Community Service",
]


def upgrade() -> None:
    # 1. Add missing submitted_at column to event table
    op.add_column(
        "event",
        sa.Column("submitted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    # 2. Seed categories if not already present
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    for i, name in enumerate(CATEGORIES, 1):
        exists = conn.execute(
            sa.text("SELECT 1 FROM category WHERE id = :id"),
            {"id": str(i)},
        ).fetchone()
        if not exists:
            conn.execute(
                sa.text(
                    "INSERT INTO category (id, name, description, created_at)"
                    " VALUES (:id, :name, :description, :created_at)"
                ),
                {"id": str(i), "name": name, "description": None, "created_at": now},
            )


def downgrade() -> None:
    op.drop_column("event", "submitted_at")
