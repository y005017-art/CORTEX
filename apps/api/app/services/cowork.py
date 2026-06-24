from __future__ import annotations

import json
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Decision, Message, Thread
from app.providers.base import ProviderMessage
from app.providers.registry import ProviderRegistry
from app.repositories.decisions import DecisionsRepository
from app.repositories.memories import MemoriesRepository
from app.repositories.messages import MessagesRepository
from app.repositories.projects import ProjectsRepository
from app.repositories.threads import ThreadsRepository


@dataclass
class CoWorkRunResult:
    analysis_message: Message
    decision_message: Message | None
    decision_record: Decision | None
    deduplicated: bool = False
    provider_key: str | None = None


class CoWorkService:
    def __init__(self, db: Session, *, provider_registry: ProviderRegistry):
        self.db = db
        self.provider_registry = provider_registry
        self.projects = ProjectsRepository(db)
        self.threads = ThreadsRepository(db)
        self.messages = MessagesRepository(db)
        self.decisions = DecisionsRepository(db)
        self.memories = MemoriesRepository(db)

    def run(self, *, thread_id: str) -> CoWorkRunResult:
        thread = self.threads.get(thread_id)
        if thread is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

        goal_message = self.messages.latest_user_goal(thread_id)
        if goal_message is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="CoWork requires at least one user_goal message in the thread",
            )

        existing_analysis = self.messages.latest_cowork_analysis_for_goal(thread_id, goal_message.id)
        if existing_analysis is not None:
            decision_message = self._find_matching_decision_message(thread, existing_analysis)
            decision_record = self._find_matching_decision_record(decision_message)
            return CoWorkRunResult(
                analysis_message=existing_analysis,
                decision_message=decision_message,
                decision_record=decision_record,
                deduplicated=True,
                provider_key=self._provider_key_from_analysis(existing_analysis),
            )

        verified_memories = self.memories.list_by_project_statuses(thread.project_id, {"verified", "locked"})
        memory_context = [
            {
                "memory_id": memory.id,
                "status": memory.status,
                "snippet": memory.content[:120],
            }
            for memory in verified_memories[:3]
        ]
        provider = self.provider_registry.get_default()
        provider_response = provider.send_message(
            messages=[ProviderMessage(role="user", content=goal_message.content_text)],
            system_prompt="You are CoWork. Return structured execution guidance.",
            metadata={
                "thread_id": thread.id,
                "project_id": thread.project_id,
                "goal_text": goal_message.content_text,
                "memory_context": memory_context,
            },
        )
        analysis_payload = {
            "source_message_id": goal_message.id,
            **provider_response.structured_output,
        }
        analysis_text = self._render_analysis_text(analysis_payload)

        analysis_message = self.messages.create(
            project_id=thread.project_id,
            thread_id=thread.id,
            message_type="analysis",
            sender_type="role",
            sender_role_id="cowork",
            visibility="project",
            content_text=analysis_text,
            payload_json=json.dumps(analysis_payload),
        )

        decision_message: Message | None = None
        decision_record: Decision | None = None
        if analysis_payload["recommend_decision"]:
            decision_title = analysis_payload["decision_title"]
            decision_summary = analysis_payload["decision_summary"]
            existing_decision = self._find_equivalent_thread_decision(
                thread=thread,
                title=decision_title,
                summary=decision_summary,
            )
            if existing_decision is not None:
                decision_record = existing_decision
                decision_message = self._find_decision_message_for_record(
                    thread,
                    existing_decision,
                    source_message_id=goal_message.id,
                )
                if decision_message is None:
                    decision_message = self.messages.create(
                        project_id=thread.project_id,
                        thread_id=thread.id,
                        message_type="decision_proposal",
                        sender_type="role",
                        sender_role_id="cowork",
                        visibility="project",
                        content_text=f"{decision_title}\n\n{decision_summary}",
                        payload_json=json.dumps(
                            {
                                "source_message_id": goal_message.id,
                                "decision_id": decision_record.id,
                                "decision_title": decision_title,
                                "decision_summary": decision_summary,
                            }
                        ),
                    )
            else:
                decision_record = self.decisions.create(
                    project_id=thread.project_id,
                    thread_id=thread.id,
                    title=decision_title,
                    summary=decision_summary,
                    proposed_by="CoWork",
                )
                decision_message = self.messages.create(
                    project_id=thread.project_id,
                    thread_id=thread.id,
                    message_type="decision_proposal",
                    sender_type="role",
                    sender_role_id="cowork",
                    visibility="project",
                    content_text=f"{decision_title}\n\n{decision_summary}",
                    payload_json=json.dumps(
                        {
                            "source_message_id": goal_message.id,
                            "decision_id": decision_record.id,
                            "decision_title": decision_title,
                            "decision_summary": decision_summary,
                        }
                    ),
                )

        return CoWorkRunResult(
            analysis_message=analysis_message,
            decision_message=decision_message,
            decision_record=decision_record,
            deduplicated=False,
            provider_key=provider.provider_key,
        )

    def _render_analysis_text(self, payload: dict[str, object]) -> str:
        checkpoints = payload["checkpoints"]
        rendered = "\n".join(f"- {item}" for item in checkpoints)
        memory_context = payload.get("memory_context", [])
        provider_line = f"Provider: {payload['provider_key']}\n\n" if payload.get("provider_key") else ""
        if memory_context:
            rendered_memories = "\n".join(
                f"- [{item['status']}] {item['snippet']}" for item in memory_context
            )
            return f"{provider_line}{payload['summary']}\n\n{rendered}\n\nMemory context:\n{rendered_memories}"
        return f"{provider_line}{payload['summary']}\n\n{rendered}"

    def _find_matching_decision_message(self, thread: Thread, analysis_message: Message) -> Message | None:
        if not analysis_message.payload_json:
            return None
        try:
            payload = json.loads(analysis_message.payload_json)
        except Exception:
            return None
        source_message_id = payload.get("source_message_id")
        if not source_message_id:
            return None
        messages = self.messages.list_by_thread(thread.id)
        for message in reversed(messages):
            if message.message_type != "decision_proposal" or not message.payload_json:
                continue
            try:
                decision_payload = json.loads(message.payload_json)
            except Exception:
                continue
            if decision_payload.get("source_message_id") == source_message_id:
                return message
        return None

    def _find_matching_decision_record(self, decision_message: Message | None) -> Decision | None:
        if decision_message is None or not decision_message.payload_json:
            return None
        try:
            payload = json.loads(decision_message.payload_json)
        except Exception:
            return None
        decision_id = payload.get("decision_id")
        if not decision_id:
            return None
        return self.decisions.get(decision_id)

    def _find_equivalent_thread_decision(self, *, thread: Thread, title: str, summary: str) -> Decision | None:
        normalized_title = self._normalize(title)
        normalized_summary = self._normalize(summary)
        for decision in reversed(self.decisions.list_by_thread(thread.id)):
            if (
                self._normalize(decision.title) == normalized_title
                and self._normalize(decision.summary) == normalized_summary
            ):
                return decision
        return None

    def _find_decision_message_for_record(
        self,
        thread: Thread,
        decision: Decision,
        *,
        source_message_id: str | None = None,
    ) -> Message | None:
        messages = self.messages.list_by_thread(thread.id)
        for message in reversed(messages):
            if message.message_type != "decision_proposal" or not message.payload_json:
                continue
            try:
                payload = json.loads(message.payload_json)
            except Exception:
                continue
            if payload.get("decision_id") != decision.id:
                continue
            if source_message_id is not None and payload.get("source_message_id") != source_message_id:
                continue
            if payload.get("decision_id") == decision.id:
                return message
        return None

    def _normalize(self, value: str) -> str:
        return " ".join(value.lower().split())

    def _provider_key_from_analysis(self, analysis_message: Message) -> str | None:
        if not analysis_message.payload_json:
            return None
        try:
            payload = json.loads(analysis_message.payload_json)
        except Exception:
            return None
        provider_key = payload.get("provider_key")
        return provider_key if isinstance(provider_key, str) else None
