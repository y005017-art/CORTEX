from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_provider_service
from app.models import User
from app.schemas import ProviderHealthRead, ProviderHealthResponse
from app.services.providers import ProviderService


router = APIRouter(tags=["providers"])


@router.get("/providers", response_model=list[ProviderHealthRead])
def list_providers(
    _: User = Depends(get_current_user),
    provider_service: ProviderService = Depends(get_provider_service),
) -> list[ProviderHealthRead]:
    return provider_service.list_providers()


@router.get("/providers/health", response_model=ProviderHealthResponse)
def provider_health(
    _: User = Depends(get_current_user),
    provider_service: ProviderService = Depends(get_provider_service),
) -> ProviderHealthResponse:
    return provider_service.healthcheck()
