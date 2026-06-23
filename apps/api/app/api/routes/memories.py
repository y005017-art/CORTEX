from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_memory_governance_service, get_memory_service
from app.models import Memory, User
from app.schemas import MemoryRead, MemoryTransitionRequest
from app.services.memory_governance import MemoryGovernanceService
from app.services.memories import MemoryService


router = APIRouter(tags=["memories"])


@router.get("/projects/{project_id}/memories", response_model=list[MemoryRead])
def list_memories(
    project_id: str,
    _: User = Depends(get_current_user),
    memory_service: MemoryService = Depends(get_memory_service),
) -> list[Memory]:
    return memory_service.list_memories(project_id)


@router.post("/memories/{memory_id}/transition", response_model=MemoryRead)
def transition_memory(
    memory_id: str,
    payload: MemoryTransitionRequest,
    user: User = Depends(get_current_user),
    governance: MemoryGovernanceService = Depends(get_memory_governance_service),
) -> Memory:
    return governance.transition_memory(
        memory_id=memory_id,
        next_status=payload.status,
        actor=user.display_name,
    )
