from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Project, Thread, User
from app.providers.registry import ProviderRegistry
from app.services.auth import AuthService
from app.services.cowork import CoWorkService
from app.services.decisions import DecisionService
from app.services.memories import MemoryService
from app.services.memory_governance import MemoryGovernanceService
from app.services.providers import ProviderService
from app.services.workspace import WorkspaceService


def get_project_or_404(project_id: str, db: Session = Depends(get_db)) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def get_thread_or_404(thread_id: str, db: Session = Depends(get_db)) -> Thread:
    thread = db.get(Thread, thread_id)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return thread


def get_workspace_service(db: Session = Depends(get_db)) -> WorkspaceService:
    return WorkspaceService(db)


def get_decision_service(db: Session = Depends(get_db)) -> DecisionService:
    return DecisionService(db)


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


def get_provider_registry() -> ProviderRegistry:
    return ProviderRegistry()


def get_provider_service(registry: ProviderRegistry = Depends(get_provider_registry)) -> ProviderService:
    return ProviderService(registry)


def get_cowork_service(db: Session = Depends(get_db)) -> CoWorkService:
    return CoWorkService(db, provider_registry=ProviderRegistry())


def get_memory_service(db: Session = Depends(get_db)) -> MemoryService:
    return MemoryService(db)


def get_memory_governance_service(db: Session = Depends(get_db)) -> MemoryGovernanceService:
    return MemoryGovernanceService(db)


def get_current_user(
    authorization: str | None = Header(default=None),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return auth_service.resolve_user(token)
