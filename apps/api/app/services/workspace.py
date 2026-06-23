from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Project, Thread
from app.repositories.messages import MessagesRepository
from app.repositories.projects import ProjectsRepository
from app.repositories.threads import ThreadsRepository


class WorkspaceService:
    def __init__(self, db: Session):
        self.projects = ProjectsRepository(db)
        self.threads = ThreadsRepository(db)
        self.messages = MessagesRepository(db)

    def list_projects(self) -> list[Project]:
        return self.projects.list()

    def create_project(self, *, name: str, description: str | None) -> Project:
        return self.projects.create(name=name, description=description)

    def get_project(self, project_id: str) -> Project:
        project = self.projects.get(project_id)
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return project

    def list_threads(self, project_id: str) -> list[Thread]:
        self.get_project(project_id)
        return self.threads.list_by_project(project_id)

    def create_thread(self, *, project_id: str, title: str) -> Thread:
        self.get_project(project_id)
        return self.threads.create(project_id=project_id, title=title)

    def get_thread(self, thread_id: str) -> Thread:
        thread = self.threads.get(thread_id)
        if thread is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
        return thread

    def list_messages(self, thread_id: str):
        self.get_thread(thread_id)
        return self.messages.list_by_thread(thread_id)

    def create_message(
        self,
        *,
        thread_id: str,
        message_type: str,
        sender_type: str,
        sender_role_id: str | None,
        visibility: str,
        content_text: str,
        payload_json: str | None,
    ):
        thread = self.get_thread(thread_id)
        content = content_text.strip()
        if not content:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="content_text is required")

        return self.messages.create(
            project_id=thread.project_id,
            thread_id=thread.id,
            message_type=message_type,
            sender_type=sender_type,
            sender_role_id=sender_role_id,
            visibility=visibility,
            content_text=content,
            payload_json=payload_json,
        )
