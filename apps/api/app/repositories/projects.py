from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project


class ProjectsRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[Project]:
        return list(self.db.scalars(select(Project).order_by(Project.created_at.desc())))

    def get(self, project_id: str) -> Project | None:
        return self.db.get(Project, project_id)

    def create(self, *, name: str, description: str | None) -> Project:
        project = Project(name=name, description=description)
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project
