from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_project_or_404, get_thread_or_404
from app.models import Decision, Project, Thread
from app.schemas import DecisionCreate, DecisionRead


router = APIRouter(tags=["decisions"])


@router.get("/projects/{project_id}/decisions", response_model=list[DecisionRead])
def list_decisions(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
) -> list[Decision]:
    return list(
        db.scalars(
            select(Decision)
            .where(Decision.project_id == project.id)
            .order_by(Decision.created_at.desc())
        )
    )


@router.post(
    "/projects/{project_id}/decisions",
    response_model=DecisionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_decision(
    payload: DecisionCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
) -> Decision:
    thread: Thread | None = None
    if payload.thread_id is not None:
        thread = db.get(Thread, payload.thread_id)
        if thread is None or thread.project_id != project.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found in project")

    decision = Decision(
        project_id=project.id,
        thread_id=thread.id if thread else None,
        title=payload.title,
        summary=payload.summary,
        proposed_by=payload.proposed_by,
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision
