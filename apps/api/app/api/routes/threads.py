from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user, get_workspace_service
from app.models import Thread, User
from app.schemas import ThreadCreate, ThreadRead
from app.services.workspace import WorkspaceService


router = APIRouter(tags=["threads"])


@router.get("/projects/{project_id}/threads", response_model=list[ThreadRead])
def list_threads(
    project_id: str,
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> list[Thread]:
    return workspace.list_threads(project_id)


@router.post(
    "/projects/{project_id}/threads",
    response_model=ThreadRead,
    status_code=status.HTTP_201_CREATED,
)
def create_thread(
    payload: ThreadCreate,
    project_id: str,
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> Thread:
    return workspace.create_thread(project_id=project_id, title=payload.title)


@router.get("/threads/{thread_id}", response_model=ThreadRead)
def get_thread(
    thread_id: str,
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> Thread:
    return workspace.get_thread(thread_id)
