from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChatSession


class ChatSessionsRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_project(self, project_id: str) -> list[ChatSession]:
        return list(
            self.db.scalars(
                select(ChatSession)
                .where(ChatSession.project_id == project_id)
                .order_by(ChatSession.created_at.desc())
            )
        )

    def get(self, session_id: str) -> ChatSession | None:
        return self.db.get(ChatSession, session_id)

    def get_by_thread(self, thread_id: str) -> ChatSession | None:
        return self.db.scalar(select(ChatSession).where(ChatSession.thread_id == thread_id))

    def create(
        self,
        *,
        project_id: str,
        thread_id: str,
        title: str,
        session_type: str,
        role_id: str | None,
        provider_site: str | None,
        workspace_url: str | None,
        launch_mode: str,
        startup_prompt: str | None,
    ) -> ChatSession:
        session = ChatSession(
            project_id=project_id,
            thread_id=thread_id,
            title=title,
            session_type=session_type,
            role_id=role_id,
            provider_site=provider_site,
            workspace_url=workspace_url,
            launch_mode=launch_mode,
            startup_prompt=startup_prompt,
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session
