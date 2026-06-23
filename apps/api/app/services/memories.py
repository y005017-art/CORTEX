from sqlalchemy.orm import Session

from app.models import Memory
from app.repositories.memories import MemoriesRepository
from app.repositories.projects import ProjectsRepository


class MemoryService:
    def __init__(self, db: Session):
        self.db = db
        self.memories = MemoriesRepository(db)
        self.projects = ProjectsRepository(db)

    def list_memories(self, project_id: str) -> list[Memory]:
        if self.projects.get(project_id) is None:
            from fastapi import HTTPException, status

            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return self.memories.list_by_project(project_id)
