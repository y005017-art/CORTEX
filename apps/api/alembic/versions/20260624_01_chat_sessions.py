"""chat sessions

Revision ID: 20260624_01
Revises: 20260623_03
Create Date: 2026-06-24
"""

from alembic import op
import sqlalchemy as sa


revision = "20260624_01"
down_revision = "20260623_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("thread_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("session_type", sa.String(length=32), nullable=False),
        sa.Column("role_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["thread_id"], ["threads.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("thread_id"),
    )
    op.create_index("ix_chat_sessions_project_id", "chat_sessions", ["project_id"])
    op.create_index("ix_chat_sessions_thread_id", "chat_sessions", ["thread_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_sessions_thread_id", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions_project_id", table_name="chat_sessions")
    op.drop_table("chat_sessions")
