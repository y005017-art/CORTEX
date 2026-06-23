from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ConstitutionRule, Role


PERMANENT_ROLES = [
    {
        "name": "CoWork",
        "role_type": "permanent",
        "is_permanent": True,
        "prompt_key": "cowork",
        "description": "Primary orchestration role for incoming project goals.",
    },
    {
        "name": "Constitution Core",
        "role_type": "permanent",
        "is_permanent": True,
        "prompt_key": "constitution_core",
        "description": "Constitution enforcement and rule stewardship role.",
    },
    {
        "name": "Memory",
        "role_type": "permanent",
        "is_permanent": True,
        "prompt_key": "memory",
        "description": "Organizational memory stewardship role.",
    },
]

FOUNDATION_RULES = [
    {
        "rule_code": "IL-001",
        "name": "Single final decision authority",
        "scope": "system",
        "description": "Critical decisions cannot bypass the final authority path.",
        "enforcement_action": "BLOCK",
        "severity": "high",
    },
    {
        "rule_code": "IL-LOCKED-MEMORY",
        "name": "Locked memory protection",
        "scope": "memory",
        "description": "Locked memory records cannot be modified through ordinary operations.",
        "enforcement_action": "BLOCK",
        "severity": "high",
    },
]


def seed_foundation_data(db: Session) -> None:
    existing_role_names = set(db.scalars(select(Role.name)))
    for role_data in PERMANENT_ROLES:
        if role_data["name"] not in existing_role_names:
            db.add(Role(**role_data))

    existing_rule_codes = set(db.scalars(select(ConstitutionRule.rule_code)))
    for rule_data in FOUNDATION_RULES:
        if rule_data["rule_code"] not in existing_rule_codes:
            db.add(ConstitutionRule(**rule_data))

    db.commit()
