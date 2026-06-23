from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Decision


class DecisionsRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_project(self, project_id: str) -> list[Decision]:
        return list(
            self.db.scalars(
                select(Decision)
                .where(Decision.project_id == project_id)
                .order_by(Decision.created_at.desc())
            )
        )

    def get(self, decision_id: str) -> Decision | None:
        return self.db.get(Decision, decision_id)

    def create(
        self,
        *,
        project_id: str,
        thread_id: str | None,
        title: str,
        summary: str,
        proposed_by: str | None,
    ) -> Decision:
        decision = Decision(
            project_id=project_id,
            thread_id=thread_id,
            title=title,
            summary=summary,
            proposed_by=proposed_by,
        )
        self.db.add(decision)
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def approve(self, decision: Decision, approver: str) -> Decision:
        decision.status = "approved"
        decision.approved_by = approver
        self.db.add(decision)
        self.db.commit()
        self.db.refresh(decision)
        return decision
