from fastapi import APIRouter, Depends

from app.db import get_db
from app.models import ConstitutionRule
from app.repositories.constitution import ConstitutionRepository
from app.schemas import (
    ConstitutionEvaluateRequest,
    ConstitutionEvaluateResponse,
    ConstitutionRuleRead,
)


router = APIRouter(prefix="/constitution", tags=["constitution"])


@router.get("/rules", response_model=list[ConstitutionRuleRead])
def list_rules(db=Depends(get_db)) -> list[ConstitutionRule]:
    return ConstitutionRepository(db).list_active()


@router.post("/evaluate", response_model=ConstitutionEvaluateResponse)
def evaluate_rule(payload: ConstitutionEvaluateRequest) -> ConstitutionEvaluateResponse:
    if payload.action_type == "modify_locked_memory":
        return ConstitutionEvaluateResponse(
            status="BLOCK",
            rule_code="IL-LOCKED-MEMORY",
            reason="Locked memory cannot be modified through the foundation scaffold."
        )

    return ConstitutionEvaluateResponse(
        status="PASS",
        rule_code="FOUNDATION-ALLOW",
        reason="No blocking constitutional rule matched in the current scaffold."
    )
