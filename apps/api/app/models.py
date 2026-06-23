from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def new_id() -> str:
    return str(uuid4())


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow)

    threads: Mapped[list["Thread"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan"
    )
    decisions: Mapped[list["Decision"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan"
    )


class Thread(Base):
    __tablename__ = "threads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow)

    project: Mapped[Project] = relationship(back_populates="threads")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan"
    )
    decisions: Mapped[list["Decision"]] = relationship(back_populates="thread")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    role_type: Mapped[str] = mapped_column(String(32), default="permanent")
    is_permanent: Mapped[bool] = mapped_column(default=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    prompt_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow)


class ConstitutionRule(Base):
    __tablename__ = "constitution_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    rule_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    scope: Mapped[str] = mapped_column(String(64), default="system")
    description: Mapped[str] = mapped_column(Text(), nullable=False)
    enforcement_action: Mapped[str] = mapped_column(String(32), default="BLOCK")
    severity: Mapped[str] = mapped_column(String(16), default="high")
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow)


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    thread_id: Mapped[str | None] = mapped_column(ForeignKey("threads.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str] = mapped_column(Text(), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="proposed")
    proposed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow)

    project: Mapped[Project] = relationship(back_populates="decisions")
    thread: Mapped[Thread | None] = relationship(back_populates="decisions")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    thread_id: Mapped[str] = mapped_column(ForeignKey("threads.id"), nullable=False, index=True)
    message_type: Mapped[str] = mapped_column(String(32), default="analysis")
    sender_type: Mapped[str] = mapped_column(String(32), default="user")
    sender_role_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    visibility: Mapped[str] = mapped_column(String(32), default="project")
    content_text: Mapped[str] = mapped_column(Text(), nullable=False)
    payload_json: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow)

    project: Mapped[Project] = relationship(back_populates="messages")
    thread: Mapped[Thread] = relationship(back_populates="messages")
