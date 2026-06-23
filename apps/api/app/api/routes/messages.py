from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_thread_or_404
from app.models import Message, Thread
from app.schemas import MessageCreate, MessageRead


router = APIRouter(tags=["messages"])


@router.get("/threads/{thread_id}/messages", response_model=list[MessageRead])
def list_messages(
    thread: Thread = Depends(get_thread_or_404),
    db: Session = Depends(get_db),
) -> list[Message]:
    statement = select(Message).where(Message.thread_id == thread.id).order_by(Message.created_at.asc())
    return list(db.scalars(statement))


@router.post(
    "/threads/{thread_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
)
def create_message(
    payload: MessageCreate,
    thread: Thread = Depends(get_thread_or_404),
    db: Session = Depends(get_db),
) -> Message:
    if not payload.content_text.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="content_text is required")

    message = Message(
        project_id=thread.project_id,
        thread_id=thread.id,
        message_type=payload.message_type,
        sender_type=payload.sender_type,
        sender_role_id=payload.sender_role_id,
        visibility=payload.visibility,
        content_text=payload.content_text.strip(),
        payload_json=payload.payload_json,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
