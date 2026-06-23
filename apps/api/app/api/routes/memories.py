from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_memory_service
from app.models import Memory, User
from app.schemas import MemoryRead
from app.services.memories import MemoryService


router = APIRouter(tags=["memories"])


@router.get("/projects/{project_id}/memories", response_model=list[MemoryRead])
def list_memories(
    project_id: str,
    _: User = Depends(get_current_user),
    memory_service: MemoryService = Depends(get_memory_service),
) -> list[Memory]:
    return memory_service.list_memories(project_id)
