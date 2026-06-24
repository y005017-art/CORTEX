from __future__ import annotations

from openai import OpenAI
from openai import OpenAIError
from pydantic import BaseModel, Field

from app.core.config import settings
from app.providers.base import ProviderAdapter, ProviderHealth, ProviderMessage, ProviderResponse


class OpenAICoWorkStructuredOutput(BaseModel):
    goal_excerpt: str = Field(min_length=1, max_length=160)
    recommend_decision: bool
    summary: str = Field(min_length=1)
    checkpoints: list[str] = Field(min_length=3, max_length=6)
    decision_title: str = Field(min_length=1, max_length=160)
    decision_summary: str = Field(min_length=1)


class OpenAIAdapter(ProviderAdapter):
    provider_key = "openai"
    display_name = "OpenAI Adapter"

    def _get_client(self) -> OpenAI:
        if not settings.openai_api_key:
            raise OpenAIError("OPENAI_API_KEY is not configured.")
        return OpenAI(api_key=settings.openai_api_key)

    def _render_instructions(self, *, system_prompt: str | None, metadata: dict | None) -> str:
        metadata = metadata or {}
        memory_context = metadata.get("memory_context", [])
        memory_lines = "\n".join(
            f"- [{item['status']}] {item['snippet']}" for item in memory_context if "snippet" in item
        )
        base_prompt = system_prompt or "You are CoWork. Return structured execution guidance."
        if memory_lines:
            return (
                f"{base_prompt}\n\nUse the verified memory context when relevant.\n"
                f"Verified memory context:\n{memory_lines}"
            )
        return base_prompt

    def _render_input(self, messages: list[ProviderMessage]) -> list[dict[str, str]]:
        return [{"role": message.role, "content": message.content} for message in messages]

    def send_message(
        self,
        *,
        messages: list[ProviderMessage],
        system_prompt: str | None,
        metadata: dict | None = None,
    ) -> ProviderResponse:
        metadata = metadata or {}
        client = self._get_client()
        response = client.responses.parse(
            model=settings.openai_model,
            instructions=self._render_instructions(system_prompt=system_prompt, metadata=metadata),
            input=self._render_input(messages),
            text_format=OpenAICoWorkStructuredOutput,
        )
        parsed = response.output_parsed
        if parsed is None:
            raise OpenAIError("OpenAI response did not return a parsed structured output.")

        structured_output = parsed.model_dump()
        structured_output["memory_context"] = metadata.get("memory_context", [])
        structured_output["provider_key"] = self.provider_key
        return ProviderResponse(
            provider_key=self.provider_key,
            output_text=response.output_text,
            structured_output=structured_output,
        )

    def stream_message(
        self,
        *,
        messages: list[ProviderMessage],
        system_prompt: str | None,
        metadata: dict | None = None,
    ) -> list[str]:
        response = self.send_message(messages=messages, system_prompt=system_prompt, metadata=metadata)
        return [response.output_text]

    def tool_call(
        self,
        *,
        tool_name: str,
        payload: dict,
        metadata: dict | None = None,
    ) -> dict:
        client = self._get_client()
        response = client.responses.create(
            model=settings.openai_model,
            input=payload.get("input", ""),
            tools=payload.get("tools", []),
            tool_choice=payload.get("tool_choice", "auto"),
            instructions=payload.get("instructions"),
        )
        return {
            "provider_key": self.provider_key,
            "tool_name": tool_name,
            "response_id": response.id,
            "output_text": response.output_text,
        }

    def embed(self, *, texts: list[str]) -> list[list[float]]:
        client = self._get_client()
        response = client.embeddings.create(model=settings.openai_embedding_model, input=texts)
        return [item.embedding for item in response.data]

    def count_tokens(self, *, text: str) -> int:
        return len(text.split())

    def health(self) -> ProviderHealth:
        has_key = bool(settings.openai_api_key)
        return ProviderHealth(
            provider_key=self.provider_key,
            display_name=self.display_name,
            enabled=settings.default_provider == self.provider_key,
            available=has_key,
            reason=(
                f"Ready to use model {settings.openai_model} through the Responses API."
                if has_key
                else "Set OPENAI_API_KEY before enabling the OpenAI adapter."
            ),
        )
