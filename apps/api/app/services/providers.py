from fastapi import HTTPException, status

from app.policies.service import PolicyService
from app.providers.base import ProviderHealth
from app.providers.registry import ProviderRegistry


class ProviderService:
    def __init__(self, registry: ProviderRegistry, policy_service: PolicyService):
        self.registry = registry
        self.policy_service = policy_service

    def list_providers(self) -> list[ProviderHealth]:
        return [provider.health() for provider in self.registry.list_providers()]

    def healthcheck(self) -> dict[str, object]:
        providers = self.list_providers()
        return {
            "default_provider": self.registry.get_default().provider_key,
            "providers": providers,
        }

    def validate_provider_execution(self, *, actor_role: str, provider_key: str) -> ProviderHealth:
        provider = self.registry.get(provider_key)
        health = provider.health()
        self.policy_service.enforce_action(
            actor_role=actor_role,
            action_type="invoke_provider",
            target_type="provider",
            context={
                "provider_key": provider_key,
                "provider_available": health.available,
            },
        )
        if not health.available:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Provider is not available.")
        return health
