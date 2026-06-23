from __future__ import annotations

import json
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Decision, Message, Thread
from app.repositories.decisions import DecisionsRepository
from app.repositories.messages import MessagesRepository
from app.repositories.projects import ProjectsRepository
from app.repositories.threads import ThreadsRepository


@dataclass
class CoWorkRunResult:
    analysis_message: Message
    decision_message: Message | None
    decision_record: Decision | None


class CoWorkService:
    def __init__(self, db: Session):
        self.db = db
        self.projects = ProjectsRepository(db)
        self.threads = ThreadsRepository(db)
        self.messages = MessagesRepository(db)
        self.decisions = DecisionsRepository(db)

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

        analysis_payload = self._build_analysis_payload(goal_message.content_text)
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
        )

    def _build_analysis_payload(self, goal: str) -> dict[str, object]:
        normalized = " ".join(goal.split())
        words = normalized.split()
        focus = normalized[:160]
        recommend_decision = len(words) >= 6
        checkpoints = [
            "Clarify objective and success criteria",
            "Break the request into executable tasks",
            "Surface decision points and constraints",
        ]

        return {
            "goal_excerpt": focus,
            "recommend_decision": recommend_decision,
            "summary": f"CoWork reviewed the latest goal and mapped the next execution checkpoints for: {focus}",
            "checkpoints": checkpoints,
            "decision_title": f"CoWork proposal: {focus[:60]}".strip(),
            "decision_summary": (
                "Proceed with structured execution based on the latest goal, "
                "using the identified checkpoints as the immediate operating plan."
            ),
        }

    def _render_analysis_text(self, payload: dict[str, object]) -> str:
        checkpoints = payload["checkpoints"]
        rendered = "\n".join(f"- {item}" for item in checkpoints)
        return f"{payload['summary']}\n\n{rendered}"
