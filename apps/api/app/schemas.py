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


class ChatSessionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    session_type: str = Field(default="group_chat", min_length=1, max_length=32)
    role_id: str | None = None
    provider_site: str | None = Field(default=None, max_length=32)
    workspace_url: str | None = None
    launch_mode: str = Field(default="external_tab", min_length=1, max_length=32)
    startup_prompt: str | None = None


class ChatSessionRead(BaseModel):
    id: str
    project_id: str
    thread_id: str
    title: str
    session_type: str
    role_id: str | None
    provider_site: str | None
    workspace_url: str | None
    launch_mode: str
    startup_prompt: str | None
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


class CoWorkRunResponse(BaseModel):
    analysis_message_id: str
    decision_message_id: str | None
    decision_id: str | None
    deduplicated: bool = False
    provider_key: str | None = None


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
    context: dict[str, str | bool | int | float | None] | None = None


class ConstitutionEvaluateResponse(BaseModel):
    status: str
    rule_code: str
    reason: str
    recommended_next_step: str


class ProviderHealthRead(BaseModel):
    provider_key: str
    display_name: str
    enabled: bool
    available: bool
    reason: str | None


class ProviderHealthResponse(BaseModel):
    default_provider: str
    providers: list[ProviderHealthRead]


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
    linked_memory_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DecisionApproveResponse(BaseModel):
    id: str
    status: str
    approved_by: str | None
    linked_memory_id: str | None

    model_config = {"from_attributes": True}


class MemoryRead(BaseModel):
    id: str
    project_id: str
    memory_type: str
    status: str
    visibility: str
    content: str
    source_role_id: str | None
    source_message_id: str | None
    source_decision_id: str | None
    approved_by: str | None
    locked_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MemoryTransitionRequest(BaseModel):
    status: str = Field(min_length=1, max_length=32)


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
