from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Memory
from app.repositories.memories import MemoriesRepository
from app.repositories.projects import ProjectsRepository


ALLOWED_MEMORY_STATUSES = {"draft", "verified", "locked", "archived"}
TRANSITIONS: dict[str, set[str]] = {
    "draft": {"verified", "archived"},
    "verified": {"locked", "archived"},
    "locked": {"archived"},
    "archived": set(),
}


class MemoryGovernanceService:
    def __init__(self, db: Session):
        self.memories = MemoriesRepository(db)
        self.projects = ProjectsRepository(db)

    def list_memories(self, project_id: str) -> list[Memory]:
        if self.projects.get(project_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return self.memories.list_by_project(project_id)

    def transition_memory(self, *, memory_id: str, next_status: str, actor: str) -> Memory:
        memory = self.memories.get(memory_id)
        if memory is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

        if next_status not in ALLOWED_MEMORY_STATUSES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid memory status")

        if next_status == memory.status:
            return memory

        allowed_targets = TRANSITIONS.get(memory.status, set())
        if next_status not in allowed_targets:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Memory cannot transition from {memory.status} to {next_status}",
            )

        if memory.status == "locked" and next_status != "archived":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Locked memory cannot be modified except archival handling",
            )

        memory.status = next_status
        memory.approved_by = actor
        if next_status == "locked":
            memory.locked_at = datetime.utcnow()
        if next_status == "archived" and memory.locked_at is None:
            memory.locked_at = memory.locked_at
        return self.memories.save(memory)
