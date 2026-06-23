from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Message


class MessagesRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_thread(self, thread_id: str) -> list[Message]:
        return list(
            self.db.scalars(
                select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.asc())
            )
        )

    def latest_user_goal(self, thread_id: str) -> Message | None:
        return self.db.scalar(
            select(Message)
            .where(Message.thread_id == thread_id, Message.message_type == "user_goal")
            .order_by(Message.created_at.desc())
        )

    def latest_cowork_analysis_for_goal(self, thread_id: str, goal_message_id: str) -> Message | None:
        messages = list(
            self.db.scalars(
                select(Message)
                .where(
                    Message.thread_id == thread_id,
                    Message.message_type == "analysis",
                    Message.sender_role_id == "cowork",
                )
                .order_by(Message.created_at.desc())
            )
        )

        for message in messages:
            if not message.payload_json:
                continue
            try:
                import json

                payload = json.loads(message.payload_json)
            except Exception:
                continue
            if payload.get("source_message_id") == goal_message_id:
                return message
        return None

    def create(
        self,
        *,
        project_id: str,
        thread_id: str,
        message_type: str,
        sender_type: str,
        sender_role_id: str | None,
        visibility: str,
        content_text: str,
        payload_json: str | None,
    ) -> Message:
        message = Message(
            project_id=project_id,
            thread_id=thread_id,
            message_type=message_type,
            sender_type=sender_type,
            sender_role_id=sender_role_id,
            visibility=visibility,
            content_text=content_text,
            payload_json=payload_json,
        )
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message
