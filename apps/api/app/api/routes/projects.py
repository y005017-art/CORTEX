from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user, get_workspace_service
from app.models import Project, User
from app.schemas import ProjectCreate, ProjectRead
from app.services.workspace import WorkspaceService


router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> list[Project]:
    return workspace.list_projects()


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> Project:
    return workspace.create_project(name=payload.name, description=payload.description)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: str,
    _: User = Depends(get_current_user),
    workspace: WorkspaceService = Depends(get_workspace_service),
) -> Project:
    return workspace.get_project(project_id)
