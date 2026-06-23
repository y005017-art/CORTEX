from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Decision
from app.repositories.decisions import DecisionsRepository
from app.repositories.projects import ProjectsRepository
from app.repositories.threads import ThreadsRepository


class DecisionService:
    def __init__(self, db: Session):
        self.decisions = DecisionsRepository(db)
        self.projects = ProjectsRepository(db)
        self.threads = ThreadsRepository(db)

    def list_decisions(self, project_id: str) -> list[Decision]:
        if self.projects.get(project_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return self.decisions.list_by_project(project_id)

    def create_decision(
        self,
        *,
        project_id: str,
        thread_id: str | None,
        title: str,
        summary: str,
        proposed_by: str | None,
    ) -> Decision:
        if self.projects.get(project_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if thread_id is not None:
            thread = self.threads.get(thread_id)
            if thread is None or thread.project_id != project_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found in project")

        return self.decisions.create(
            project_id=project_id,
            thread_id=thread_id,
            title=title,
            summary=summary,
            proposed_by=proposed_by,
        )

    def approve_decision(self, *, decision_id: str, approver: str) -> Decision:
        decision = self.decisions.get(decision_id)
        if decision is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")
        return self.decisions.approve(decision, approver)
