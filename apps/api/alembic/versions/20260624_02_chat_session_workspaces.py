"""chat session workspace metadata

Revision ID: 20260624_02
Revises: 20260624_01
Create Date: 2026-06-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260624_02"
down_revision = "20260624_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {column["name"] for column in inspect(bind).get_columns("chat_sessions")}

    if "provider_site" not in existing:
        op.add_column("chat_sessions", sa.Column("provider_site", sa.String(length=32), nullable=True))
    if "workspace_url" not in existing:
        op.add_column("chat_sessions", sa.Column("workspace_url", sa.Text(), nullable=True))
    if "launch_mode" not in existing:
        op.add_column(
            "chat_sessions",
            sa.Column("launch_mode", sa.String(length=32), nullable=False, server_default="external_tab"),
        )
    if "startup_prompt" not in existing:
        op.add_column("chat_sessions", sa.Column("startup_prompt", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_sessions", "startup_prompt")
    op.drop_column("chat_sessions", "launch_mode")
    op.drop_column("chat_sessions", "workspace_url")
    op.drop_column("chat_sessions", "provider_site")
