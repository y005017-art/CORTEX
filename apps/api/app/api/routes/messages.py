from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user, get_workspace_service
from app.models import Message, User
from app.schemas import MessageCreate, MessageRead
from app.services.workspace import WorkspaceService


router = APIRouter(tags=["messages"])


@router.get("/threads/{thread_id}/messages", response_model=list[MessageRead])
def list_messages(
    thread_id: str,
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> list[Message]:
    return workspace.list_messages(thread_id)


@router.post(
    "/threads/{thread_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
)
def create_message(
    payload: MessageCreate,
    thread_id: str,
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> Message:
    return workspace.create_message(
        thread_id=thread_id,
        message_type=payload.message_type,
        sender_type=payload.sender_type,
        sender_role_id=payload.sender_role_id,
        visibility=payload.visibility,
        content_text=payload.content_text,
        payload_json=payload.payload_json,
    )
