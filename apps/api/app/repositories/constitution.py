from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ConstitutionRule


class ConstitutionRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_active(self) -> list[ConstitutionRule]:
        return list(
            self.db.scalars(
                select(ConstitutionRule)
                .where(ConstitutionRule.active.is_(True))
                .order_by(ConstitutionRule.rule_code.asc())
            )
        )
