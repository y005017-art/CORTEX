from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user, get_workspace_service
from app.models import ChatSession, User
from app.schemas import ChatSessionCreate, ChatSessionRead
from app.services.workspace import WorkspaceService


router = APIRouter(tags=["chat_sessions"])


@router.get("/projects/{project_id}/chat-sessions", response_model=list[ChatSessionRead])
def list_chat_sessions(
    project_id: str,
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> list[ChatSession]:
    return workspace.list_chat_sessions(project_id)


@router.post(
    "/projects/{project_id}/chat-sessions",
    response_model=ChatSessionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_chat_session(
    payload: ChatSessionCreate,
    project_id: str,
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> ChatSession:
    return workspace.create_chat_session(
        project_id=project_id,
        title=payload.title,
        session_type=payload.session_type,
        role_id=payload.role_id,
        provider_site=payload.provider_site,
        workspace_url=payload.workspace_url,
        launch_mode=payload.launch_mode,
        startup_prompt=payload.startup_prompt,
    )


@router.get("/chat-sessions/{session_id}", response_model=ChatSessionRead)
def get_chat_session(
    session_id: str,
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> ChatSession:
    return workspace.get_chat_session(session_id)
