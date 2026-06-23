from fastapi import APIRouter, Depends, status

from app.dependencies import get_cowork_service, get_current_user
from app.models import User
from app.schemas import CoWorkRunResponse
from app.services.cowork import CoWorkService


router = APIRouter(tags=["cowork"])


@router.post(
    "/threads/{thread_id}/cowork-run",
    response_model=CoWorkRunResponse,
    status_code=status.HTTP_201_CREATED,
)
def run_cowork(
    thread_id: str,
    _: User = Depends(get_current_user),
    cowork: CoWorkService = Depends(get_cowork_service),
) -> CoWorkRunResponse:
    result = cowork.run(thread_id=thread_id)
    return CoWorkRunResponse(
        analysis_message_id=result.analysis_message.id,
        decision_message_id=result.decision_message.id if result.decision_message else None,
        decision_id=result.decision_record.id if result.decision_record else None,
        deduplicated=result.deduplicated,
    )
