from fastapi import APIRouter, Depends

from app.dependencies import get_policy_service
from app.db import get_db
from app.models import ConstitutionRule
from app.repositories.constitution import ConstitutionRepository
from app.schemas import (
    ConstitutionEvaluateRequest,
    ConstitutionEvaluateResponse,
    ConstitutionRuleRead,
)
from app.policies.service import PolicyService


router = APIRouter(prefix="/constitution", tags=["constitution"])


@router.get("/rules", response_model=list[ConstitutionRuleRead])
def list_rules(db=Depends(get_db)) -> list[ConstitutionRule]:
    return ConstitutionRepository(db).list_active()


@router.post("/evaluate", response_model=ConstitutionEvaluateResponse)
def evaluate_rule(
    payload: ConstitutionEvaluateRequest,
    policy_service: PolicyService = Depends(get_policy_service),
) -> ConstitutionEvaluateResponse:
    result = policy_service.evaluate_action(
        actor_role=payload.actor_role,
        action_type=payload.action_type,
        target_type=payload.target_type,
        context=payload.context,
    )
    return ConstitutionEvaluateResponse(
        status=result.status,
        rule_code=result.rule_code,
        reason=result.reason,
        recommended_next_step=result.recommended_next_step,
    )
