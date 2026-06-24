from __future__ import annotations

from app.core.config import settings
from app.providers.base import ProviderAdapter, ProviderHealth, ProviderMessage, ProviderResponse


class OpenAIAdapter(ProviderAdapter):
    provider_key = "openai"
    display_name = "OpenAI Adapter"

    def send_message(
        self,
        *,
        messages: list[ProviderMessage],
        system_prompt: str | None,
        metadata: dict | None = None,
    ) -> ProviderResponse:
        raise NotImplementedError("OpenAI adapter is not wired yet in this phase.")

    def stream_message(
        self,
        *,
        messages: list[ProviderMessage],
        system_prompt: str | None,
        metadata: dict | None = None,
    ) -> list[str]:
        raise NotImplementedError("OpenAI adapter streaming is not wired yet in this phase.")

    def tool_call(
        self,
        *,
        tool_name: str,
        payload: dict,
        metadata: dict | None = None,
    ) -> dict:
        raise NotImplementedError("OpenAI adapter tool calls are not wired yet in this phase.")

    def embed(self, *, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError("OpenAI adapter embeddings are not wired yet in this phase.")

    def count_tokens(self, *, text: str) -> int:
        return len(text.split())

    def health(self) -> ProviderHealth:
        has_key = bool(settings.openai_api_key)
        return ProviderHealth(
            provider_key=self.provider_key,
            display_name=self.display_name,
            enabled=settings.default_provider == self.provider_key,
            available=False,
            reason=(
                "OpenAI API key detected, but adapter execution is not wired yet."
                if has_key
                else "Set OPENAI_API_KEY before enabling the OpenAI adapter."
            ),
        )
