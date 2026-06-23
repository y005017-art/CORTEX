from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None


class ProjectRead(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ThreadCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)


class ThreadRead(BaseModel):
    id: str
    project_id: str
    title: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    message_type: str = Field(default="user_goal", min_length=1, max_length=32)
    sender_type: str = Field(default="user", min_length=1, max_length=32)
    sender_role_id: str | None = None
    visibility: str = Field(default="project", min_length=1, max_length=32)
    content_text: str = Field(min_length=1)
    payload_json: str | None = None


class MessageRead(BaseModel):
    id: str
    project_id: str
    thread_id: str
    message_type: str
    sender_type: str
    sender_role_id: str | None
    visibility: str
    content_text: str
    payload_json: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
