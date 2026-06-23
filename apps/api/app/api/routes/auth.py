from fastapi import APIRouter, Depends, status

from app.dependencies import get_auth_service, get_current_user
from app.models import User
from app.schemas import AuthSession, UserLogin, UserRegister, UserRead
from app.services.auth import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthSession, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, auth_service: AuthService = Depends(get_auth_service)) -> AuthSession:
    user, token = auth_service.register(
        email=payload.email,
        display_name=payload.display_name,
        password=payload.password,
    )
    return AuthSession(token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=AuthSession)
def login(payload: UserLogin, auth_service: AuthService = Depends(get_auth_service)) -> AuthSession:
    user, token = auth_service.login(email=payload.email, password=payload.password)
    return AuthSession(token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> User:
    return user
