from __future__ import annotations

from fastapi import HTTPException, status

from app.core.config import settings
from app.providers.base import ProviderAdapter
from app.providers.deterministic import DeterministicAdapter
from app.providers.openai_adapter import OpenAIAdapter


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, ProviderAdapter] = {
            "deterministic": DeterministicAdapter(),
            "openai": OpenAIAdapter(),
        }

    def list_providers(self) -> list[ProviderAdapter]:
        return list(self._providers.values())

    def get(self, provider_key: str) -> ProviderAdapter:
        provider = self._providers.get(provider_key)
        if provider is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
        return provider

    def get_default(self) -> ProviderAdapter:
        provider = self._providers.get(settings.default_provider)
        if provider is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Configured default provider is not registered",
            )
        return provider
