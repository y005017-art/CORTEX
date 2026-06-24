from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ProviderMessage:
    role: str
    content: str


@dataclass(frozen=True)
class ProviderResponse:
    provider_key: str
    output_text: str
    structured_output: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ProviderHealth:
    provider_key: str
    display_name: str
    enabled: bool
    available: bool
    reason: str | None = None


class ProviderAdapter(ABC):
    provider_key: str
    display_name: str

    @abstractmethod
    def send_message(
        self,
        *,
        messages: list[ProviderMessage],
        system_prompt: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> ProviderResponse:
        raise NotImplementedError

    @abstractmethod
    def stream_message(
        self,
        *,
        messages: list[ProviderMessage],
        system_prompt: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def tool_call(
        self,
        *,
        tool_name: str,
        payload: dict[str, Any],
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def embed(self, *, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    @abstractmethod
    def count_tokens(self, *, text: str) -> int:
        raise NotImplementedError

    @abstractmethod
    def health(self) -> ProviderHealth:
        raise NotImplementedError
