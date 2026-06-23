from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_project_or_404, get_thread_or_404
from app.models import Project, Thread
from app.schemas import ThreadCreate, ThreadRead


router = APIRouter(tags=["threads"])


@router.get("/projects/{project_id}/threads", response_model=list[ThreadRead])
def list_threads(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
) -> list[Thread]:
    statement = select(Thread).where(Thread.project_id == project.id).order_by(Thread.created_at.desc())
    return list(db.scalars(statement))


@router.post(
    "/projects/{project_id}/threads",
    response_model=ThreadRead,
    status_code=status.HTTP_201_CREATED,
)
def create_thread(
    payload: ThreadCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
) -> Thread:
    thread = Thread(project_id=project.id, title=payload.title)
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


@router.get("/threads/{thread_id}", response_model=ThreadRead)
def get_thread(thread: Thread = Depends(get_thread_or_404)) -> Thread:
    return thread
