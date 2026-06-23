from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Role


class RolesRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[Role]:
        return list(self.db.scalars(select(Role).order_by(Role.is_permanent.desc(), Role.name.asc())))
