"""add registrations_count to event

Revision ID: 0011_add_registrations_count
Revises: 0010_add_password_hash_and_reset_tokens
Create Date: 2026-04-07
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision = "0011_add_registrations_count"
down_revision: str | None = "0010"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "event",
        sa.Column("registrations_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    with op.batch_alter_table("event") as batch_op:
        batch_op.drop_column("registrations_count")