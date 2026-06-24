from __future__ import annotations

import json
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Decision, Message, Thread
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


class CoWorkService:
    def __init__(self, db: Session):
        self.db = db
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
            )

        verified_memories = self.memories.list_by_project_statuses(thread.project_id, {"verified", "locked"})
        analysis_payload = self._build_analysis_payload(goal_message, verified_memories)
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
        )

    def _build_analysis_payload(self, goal_message: Message, memories) -> dict[str, object]:
        normalized = " ".join(goal_message.content_text.split())
        words = normalized.split()
        focus = normalized[:160]
        recommend_decision = len(words) >= 6
        memory_context = [
            {
                "memory_id": memory.id,
                "status": memory.status,
                "snippet": memory.content[:120],
            }
            for memory in memories[:3]
        ]
        checkpoints = [
            "Clarify objective and success criteria",
            "Break the request into executable tasks",
            "Surface decision points and constraints",
        ]
        if memory_context:
            checkpoints.append("Reuse verified memory before creating new execution branches")

        return {
            "source_message_id": goal_message.id,
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
        }

    def _render_analysis_text(self, payload: dict[str, object]) -> str:
        checkpoints = payload["checkpoints"]
        rendered = "\n".join(f"- {item}" for item in checkpoints)
        memory_context = payload.get("memory_context", [])
        if memory_context:
            rendered_memories = "\n".join(
                f"- [{item['status']}] {item['snippet']}" for item in memory_context
            )
            return f"{payload['summary']}\n\n{rendered}\n\nMemory context:\n{rendered_memories}"
        return f"{payload['summary']}\n\n{rendered}"

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
