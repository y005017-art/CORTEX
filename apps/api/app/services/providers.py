from app.providers.base import ProviderHealth
from app.providers.registry import ProviderRegistry


class ProviderService:
    def __init__(self, registry: ProviderRegistry):
        self.registry = registry

    def list_providers(self) -> list[ProviderHealth]:
        return [provider.health() for provider in self.registry.list_providers()]

    def healthcheck(self) -> dict[str, object]:
        providers = self.list_providers()
        return {
            "default_provider": self.registry.get_default().provider_key,
            "providers": providers,
        }
