"""initial event schema

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-04

"""
from typing import Sequence, Union

revision: str = "0002"
down_revision: str | None = "0001_create_users_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

from alembic import op
import sqlalchemy as sa
from datetime import datetime

# Categories to seed
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
    import sqlalchemy as sa
    
    # Create category table
    category_table = op.create_table(
        "category",
        sa.Column("id", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create event table
    op.create_table(
        "event",
        sa.Column("id", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("date_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("location", sa.String(500), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("organizer_id", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, default="draft"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow),
        sa.PrimaryKeyConstraint("id"),
    )
    
    op.create_table(
        "event_category",
        sa.Column("event_id", sa.String(50), nullable=False),
        sa.Column("category_id", sa.String(50), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("event_id", "category_id"),
        sa.ForeignKeyConstraint(["event_id"], ["event.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["category.id"], ondelete="CASCADE"),
    )

    op.bulk_insert(
        category_table,
        [
            {"id": str(i), "name": name, "description": None, "created_at": datetime.utcnow()}
            for i, name in enumerate(CATEGORIES, 1)
        ],
    )


def downgrade() -> None:
    op.drop_table("event_category")
    op.drop_table("event")
    op.drop_table("category")
