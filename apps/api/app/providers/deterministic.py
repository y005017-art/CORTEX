from __future__ import annotations

from typing import Any

from app.providers.base import ProviderAdapter, ProviderHealth, ProviderMessage, ProviderResponse


class DeterministicAdapter(ProviderAdapter):
    provider_key = "deterministic"
    display_name = "Deterministic Adapter"

    def send_message(
        self,
        *,
        messages: list[ProviderMessage],
        system_prompt: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> ProviderResponse:
        metadata = metadata or {}
        goal_text = metadata.get("goal_text", "")
        normalized = " ".join(goal_text.split())
        words = normalized.split()
        focus = normalized[:160]
        memory_context = metadata.get("memory_context", [])
        recommend_decision = len(words) >= 6
        checkpoints = [
            "Clarify objective and success criteria",
            "Break the request into executable tasks",
            "Surface decision points and constraints",
        ]
        if memory_context:
            checkpoints.append("Reuse verified memory before creating new execution branches")

        structured_output = {
            "goal_excerpt": focus,
            "recommend_decision": recommend_decision,
            "summary": f"CoWork reviewed the latest goal and mapped the next execution checkpoints for: {focus}",
            "checkpoints": checkpoints,
            "memory_context": memory_context,
            "decision_title": f"CoWork proposal: {focus[:60]}".strip(),
            "decision_summary": (
                "Proceed with structured execution based on the latest goal, "
                "using the identified checkpoints as the immediate operating plan."
            ),
            "provider_key": self.provider_key,
        }
        return ProviderResponse(
            provider_key=self.provider_key,
            output_text=structured_output["summary"],
            structured_output=structured_output,
        )

    def stream_message(
        self,
        *,
        messages: list[ProviderMessage],
        system_prompt: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> list[str]:
        response = self.send_message(messages=messages, system_prompt=system_prompt, metadata=metadata)
        return [response.output_text]

    def tool_call(
        self,
        *,
        tool_name: str,
        payload: dict[str, Any],
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "provider_key": self.provider_key,
            "tool_name": tool_name,
            "accepted": False,
            "reason": "Deterministic adapter does not execute external tools.",
        }

    def embed(self, *, texts: list[str]) -> list[list[float]]:
        return [[float(len(text.split()))] for text in texts]

    def count_tokens(self, *, text: str) -> int:
        return len(text.split())

    def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider_key=self.provider_key,
            display_name=self.display_name,
            enabled=True,
            available=True,
            reason="Active local adapter for deterministic orchestration.",
        )
