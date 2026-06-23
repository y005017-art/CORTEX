"""memories and decision link

Revision ID: 20260623_03
Revises: 20260623_02
Create Date: 2026-06-23
"""

from alembic import op
import sqlalchemy as sa


revision = "20260623_03"
down_revision = "20260623_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "memories",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("memory_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("visibility", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_role_id", sa.String(length=64), nullable=True),
        sa.Column("source_message_id", sa.String(length=36), nullable=True),
        sa.Column("source_decision_id", sa.String(length=36), nullable=True),
        sa.Column("approved_by", sa.String(length=64), nullable=True),
        sa.Column("locked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_memories_project_id", "memories", ["project_id"])

    with op.batch_alter_table("decisions") as batch_op:
        batch_op.add_column(sa.Column("linked_memory_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_decisions_linked_memory_id_memories",
            "memories",
            ["linked_memory_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("decisions") as batch_op:
        batch_op.drop_constraint("fk_decisions_linked_memory_id_memories", type_="foreignkey")
        batch_op.drop_column("linked_memory_id")
    op.drop_index("ix_memories_project_id", table_name="memories")
    op.drop_table("memories")
