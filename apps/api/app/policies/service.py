from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.constitution import ConstitutionRepository


@dataclass(frozen=True)
class PolicyEvaluationResult:
    status: str
    rule_code: str
    reason: str
    recommended_next_step: str


class PolicyService:
    def __init__(self, db: Session):
        self.db = db
        self.constitution = ConstitutionRepository(db)

    def evaluate_action(
        self,
        *,
        actor_role: str,
        action_type: str,
        target_type: str,
        context: dict[str, Any] | None = None,
    ) -> PolicyEvaluationResult:
        context = context or {}

        if action_type == "modify_locked_memory":
            return PolicyEvaluationResult(
                status="BLOCK",
                rule_code="IL-LOCKED-MEMORY",
                reason="Locked memory cannot be modified through ordinary operations.",
                recommended_next_step="Archive the locked memory instead of attempting direct modification.",
            )

        if action_type == "approve_decision" and actor_role.lower() == "cowork":
            return PolicyEvaluationResult(
                status="BLOCK",
                rule_code="IL-001",
                reason="CoWork cannot finalize decisions through the approval path.",
                recommended_next_step="Leave the decision in proposed state and route it to a human approver.",
            )

        if action_type in {"run_cowork", "invoke_provider"}:
            provider_key = context.get("provider_key")
            provider_available = context.get("provider_available")
            if provider_key and provider_available is False:
                return PolicyEvaluationResult(
                    status="BLOCK",
                    rule_code="PR-001",
                    reason=f"Provider {provider_key} is not available for execution.",
                    recommended_next_step="Switch to an available provider or restore the provider configuration.",
                )

        if action_type == "invoke_provider":
            allowed_roles = {"cowork", "constitution core"}
            if actor_role.lower() not in allowed_roles:
                return PolicyEvaluationResult(
                    status="BLOCK",
                    rule_code="RB-001",
                    reason=f"Role {actor_role} is not allowed to invoke provider execution directly.",
                    recommended_next_step="Route provider execution through CoWork or Constitution Core.",
                )

        return PolicyEvaluationResult(
            status="PASS",
            rule_code="FOUNDATION-ALLOW",
            reason="No blocking constitutional rule matched in the current scaffold.",
            recommended_next_step="Continue within the current governance boundary.",
        )

    def enforce_action(
        self,
        *,
        actor_role: str,
        action_type: str,
        target_type: str,
        context: dict[str, Any] | None = None,
    ) -> PolicyEvaluationResult:
        result = self.evaluate_action(
            actor_role=actor_role,
            action_type=action_type,
            target_type=target_type,
            context=context,
        )
        if result.status == "BLOCK":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "status": result.status,
                    "rule_code": result.rule_code,
                    "reason": result.reason,
                    "recommended_next_step": result.recommended_next_step,
                },
            )
        return result
