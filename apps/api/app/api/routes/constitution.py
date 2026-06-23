from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ConstitutionRule
from app.schemas import (
    ConstitutionEvaluateRequest,
    ConstitutionEvaluateResponse,
    ConstitutionRuleRead,
)


router = APIRouter(prefix="/constitution", tags=["constitution"])


@router.get("/rules", response_model=list[ConstitutionRuleRead])
def list_rules(db: Session = Depends(get_db)) -> list[ConstitutionRule]:
    return list(db.scalars(select(ConstitutionRule).where(ConstitutionRule.active.is_(True)).order_by(ConstitutionRule.rule_code.asc())))


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
