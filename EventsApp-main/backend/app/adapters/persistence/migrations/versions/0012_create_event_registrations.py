"""create event registration table

Revision ID: 0012
Revises: 0011_add_registrations_count
Create Date: 2026-04-20
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision = "0012"
down_revision: str | None = "0011_add_registrations_count"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "event_registration",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["event.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "event_id", name="uq_event_registration_user_event"),
    )
    op.create_index(
        op.f("ix_event_registration_user_id"),
        "event_registration",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_registration_event_id"),
        "event_registration",
        ["event_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_event_registration_event_id"), table_name="event_registration")
    op.drop_index(op.f("ix_event_registration_user_id"), table_name="event_registration")
    op.drop_table("event_registration")
