"""drop firebase_uid from users

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-06
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("uq_users_firebase_uid", type_="unique")
        batch_op.drop_column("firebase_uid")


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("firebase_uid", sa.String(length=255), nullable=True))
        batch_op.create_unique_constraint("uq_users_firebase_uid", ["firebase_uid"])
