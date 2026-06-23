from fastapi import APIRouter, Depends

from app.db import get_db
from app.models import Role
from app.repositories.roles import RolesRepository
from app.schemas import RoleRead


router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleRead])
def list_roles(db=Depends(get_db)) -> list[Role]:
    return RolesRepository(db).list()
