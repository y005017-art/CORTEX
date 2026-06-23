from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Thread


class ThreadsRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_project(self, project_id: str) -> list[Thread]:
        return list(
            self.db.scalars(
                select(Thread).where(Thread.project_id == project_id).order_by(Thread.created_at.desc())
            )
        )

    def get(self, thread_id: str) -> Thread | None:
        return self.db.get(Thread, thread_id)

    def create(self, *, project_id: str, title: str) -> Thread:
        thread = Thread(project_id=project_id, title=title)
        self.db.add(thread)
        self.db.commit()
        self.db.refresh(thread)
        return thread
