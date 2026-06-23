from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user, get_decision_service
from app.models import Decision, User
from app.schemas import DecisionApproveResponse, DecisionCreate, DecisionRead
from app.services.decisions import DecisionService


router = APIRouter(tags=["decisions"])


@router.get("/projects/{project_id}/decisions", response_model=list[DecisionRead])
def list_decisions(
    project_id: str,
    _: User = Depends(get_current_user),
    decision_service: DecisionService = Depends(get_decision_service),
) -> list[Decision]:
    return decision_service.list_decisions(project_id)


@router.post(
    "/projects/{project_id}/decisions",
    response_model=DecisionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_decision(
    payload: DecisionCreate,
    project_id: str,
    user: User = Depends(get_current_user),
    decision_service: DecisionService = Depends(get_decision_service),
) -> Decision:
    proposed_by = payload.proposed_by or user.display_name
    return decision_service.create_decision(
        project_id=project_id,
        thread_id=payload.thread_id,
        title=payload.title,
        summary=payload.summary,
        proposed_by=proposed_by,
    )


@router.post("/decisions/{decision_id}/approve", response_model=DecisionApproveResponse)
def approve_decision(
    decision_id: str,
    user: User = Depends(get_current_user),
    decision_service: DecisionService = Depends(get_decision_service),
) -> Decision:
    return decision_service.approve_decision(decision_id=decision_id, approver=user.display_name)
