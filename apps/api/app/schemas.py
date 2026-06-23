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


class RoleRead(BaseModel):
    id: str
    name: str
    role_type: str
    is_permanent: bool
    status: str
    prompt_key: str | None
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConstitutionRuleRead(BaseModel):
    id: str
    rule_code: str
    name: str
    scope: str
    description: str
    enforcement_action: str
    severity: str
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConstitutionEvaluateRequest(BaseModel):
    actor_role: str
    action_type: str
    target_type: str


class ConstitutionEvaluateResponse(BaseModel):
    status: str
    rule_code: str
    reason: str


class DecisionCreate(BaseModel):
    thread_id: str | None = None
    title: str = Field(min_length=1, max_length=160)
    summary: str = Field(min_length=1)
    proposed_by: str | None = None


class DecisionRead(BaseModel):
    id: str
    project_id: str
    thread_id: str | None
    title: str
    summary: str
    status: str
    proposed_by: str | None
    approved_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DecisionApproveResponse(BaseModel):
    id: str
    status: str
    approved_by: str | None

    model_config = {"from_attributes": True}


class UserRegister(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=255)


class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=255)


class UserRead(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthSession(BaseModel):
    token: str
    user: UserRead
