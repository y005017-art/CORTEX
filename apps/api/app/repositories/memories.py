from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Memory


class MemoriesRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_project(self, project_id: str) -> list[Memory]:
        return list(
            self.db.scalars(
                select(Memory)
                .where(Memory.project_id == project_id)
                .order_by(Memory.created_at.desc())
            )
        )

    def get(self, memory_id: str) -> Memory | None:
        return self.db.get(Memory, memory_id)

    def create(
        self,
        *,
        project_id: str,
        memory_type: str,
        status: str,
        visibility: str,
        content: str,
        source_role_id: str | None,
        source_message_id: str | None,
        source_decision_id: str | None,
        approved_by: str | None,
    ) -> Memory:
        memory = Memory(
            project_id=project_id,
            memory_type=memory_type,
            status=status,
            visibility=visibility,
            content=content,
            source_role_id=source_role_id,
            source_message_id=source_message_id,
            source_decision_id=source_decision_id,
            approved_by=approved_by,
        )
        self.db.add(memory)
        self.db.flush()
        return memory

    def save(self, memory: Memory) -> Memory:
        self.db.add(memory)
        self.db.commit()
        self.db.refresh(memory)
        return memory
