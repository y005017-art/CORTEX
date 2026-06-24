import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Decision
from app.repositories.decisions import DecisionsRepository
from app.repositories.memories import MemoriesRepository
from app.repositories.messages import MessagesRepository
from app.repositories.projects import ProjectsRepository
from app.repositories.threads import ThreadsRepository


class DecisionService:
    def __init__(self, db: Session):
        self.db = db
        self.decisions = DecisionsRepository(db)
        self.memories = MemoriesRepository(db)
        self.projects = ProjectsRepository(db)
        self.threads = ThreadsRepository(db)
        self.messages = MessagesRepository(db)

    def list_decisions(self, project_id: str) -> list[Decision]:
        if self.projects.get(project_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return self.decisions.list_by_project(project_id)

    def create_decision(
        self,
        *,
        project_id: str,
        thread_id: str | None,
        title: str,
        summary: str,
        proposed_by: str | None,
    ) -> Decision:
        if self.projects.get(project_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if thread_id is not None:
            thread = self.threads.get(thread_id)
            if thread is None or thread.project_id != project_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found in project")

        return self.decisions.create(
            project_id=project_id,
            thread_id=thread_id,
            title=title,
            summary=summary,
            proposed_by=proposed_by,
        )

    def approve_decision(self, *, decision_id: str, approver: str) -> Decision:
        decision = self.decisions.get(decision_id)
        if decision is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")
        if decision.status == "approved":
            return decision

        duplicate = self._find_equivalent_approved_decision(decision)
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An equivalent approved decision already exists in this project.",
            )

        self._validate_approval_context(decision)
        self.decisions.approve(decision, approver)

        if decision.linked_memory_id is None:
            promoted_memory = self.memories.create(
                project_id=decision.project_id,
                memory_type="decision",
                status="verified",
                visibility="project",
                content=f"{decision.title}\n\n{decision.summary}",
                source_role_id=decision.proposed_by,
                source_message_id=None,
                source_decision_id=decision.id,
                approved_by=approver,
            )
            decision.linked_memory = promoted_memory
            decision.linked_memory_id = promoted_memory.id

        self.db.add(decision)
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def _validate_approval_context(self, decision: Decision) -> None:
        if decision.proposed_by != "CoWork":
            return

        if decision.thread_id is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="CoWork decision cannot be approved without a source thread.",
            )

        thread = self.threads.get(decision.thread_id)
        if thread is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found in project")

        proposal_payload = self._find_decision_proposal_payload(decision)
        if proposal_payload is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="CoWork decision cannot be approved without a linked proposal message.",
            )

        source_message_id = proposal_payload.get("source_message_id")
        if not source_message_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="CoWork decision proposal is missing its source goal reference.",
            )

        latest_goal = self.messages.latest_user_goal(thread.id)
        if latest_goal is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="CoWork decision cannot be approved because the thread no longer has a goal context.",
            )

        if latest_goal.id != source_message_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This CoWork proposal is stale. Run CoWork again on the latest thread goal before approval.",
            )

    def _find_decision_proposal_payload(self, decision: Decision) -> dict[str, object] | None:
        if decision.thread_id is None:
            return None

        messages = self.messages.list_by_thread(decision.thread_id)
        for message in reversed(messages):
            if message.message_type != "decision_proposal" or not message.payload_json:
                continue
            try:
                payload = json.loads(message.payload_json)
            except Exception:
                continue
            if payload.get("decision_id") == decision.id:
                return payload
        return None

    def _find_equivalent_approved_decision(self, decision: Decision) -> Decision | None:
        normalized_title = self._normalize(decision.title)
        normalized_summary = self._normalize(decision.summary)
        for candidate in self.decisions.list_by_project(decision.project_id):
            if candidate.id == decision.id or candidate.status != "approved":
                continue
            if (
                self._normalize(candidate.title) == normalized_title
                and self._normalize(candidate.summary) == normalized_summary
            ):
                return candidate
        return None

    def _normalize(self, value: str) -> str:
        return " ".join(value.lower().split())
