# CORTEX MVP System Design

Version: v1
Status: Draft for implementation
Depends on: `CORTEX_CONTINUITY_MASTER.md`

## 1. Purpose

This document translates the CORTEX continuity and product vision into an implementation-oriented MVP system design.

It is the working design baseline for the first real build of CORTEX.

## 2. MVP Goal

The MVP must support one complete operational loop:

1. A user creates a project
2. A user enters a goal in Group Chat
3. CoWork interprets the goal
4. Relevant roles participate within constraints
5. A structured decision is produced
6. The decision is stored as controlled memory
7. A handover package can be produced for continuity

If this loop works reliably, CORTEX Core MVP is successful.

## 3. MVP Scope

Included:

- authentication basics
- project creation
- workspace entry
- thread creation
- structured messaging
- Group Chat UI
- provider abstraction
- first LLM adapter
- constitution rules registry
- policy checks
- permanent roles registry
- CoWork orchestration v1
- decision proposal and approval basics
- memory write and retrieval basics
- handover package basics

Excluded from MVP:

- advanced skill lifecycle
- automated role creation
- full training and examination workflows
- governance workflow engine
- reflection and evolution loops
- full multi-provider switching UI

## 4. System Architecture

High-level structure:

1. Frontend application
2. Backend API
3. Database
4. Realtime chat channel
5. LLM provider adapter layer
6. Policy engine
7. Memory engine

Logical flow:

- frontend sends user input to backend
- backend persists structured message
- orchestration invokes policy checks
- orchestration invokes provider adapter
- output is normalized into messages, decisions, and memory actions
- frontend renders message stream and state changes

## 5. Recommended Repository Layout

Suggested top-level layout:

```text
CORTEX/
  apps/
    web/
    api/
  packages/
    shared/
    prompts/
    schemas/
  infra/
    docker/
  docs/
  CORTEX_CONTINUITY_MASTER.md
  CORTEX_MVP_SYSTEM_DESIGN.md
  CORTEX_HANDOVER_LOG.md
```

If a simpler split is preferred, use:

```text
frontend/
backend/
docs/
```

But preserve clear ownership boundaries.

## 6. Frontend Design

Recommended stack:

- Next.js
- React
- TypeScript
- Tailwind CSS

### Initial frontend routes

- `/`
- `/projects`
- `/projects/[projectId]`
- `/projects/[projectId]/threads/[threadId]`

### First-wave screens

1. Dashboard
2. Workspace
3. Group Chat

### Group Chat UI requirements

- left project/thread context
- main structured chat stream
- input area for user goals and follow-up instructions
- visible tags for role speaker and message type
- light decision and memory side panels if feasible

### UI priorities

1. clarity
2. traceability
3. dense but readable work surface
4. role-aware conversation

## 7. Backend Design

Recommended stack:

- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL

### Backend module layout

```text
app/
  api/
  core/
  db/
  domain/
  models/
  repos/
  schemas/
  services/
  orchestration/
  policies/
  providers/
  memory/
  handover/
```

### Module responsibilities

- `api`: route handlers
- `core`: configuration, auth wiring, app startup
- `db`: session management, base metadata
- `domain`: enums, value objects, domain rules
- `models`: ORM models
- `repos`: data access
- `schemas`: request and response contracts
- `services`: application services
- `orchestration`: CoWork flow and role coordination
- `policies`: constitution rule evaluation
- `providers`: provider adapter implementations
- `memory`: memory lifecycle and retrieval logic
- `handover`: continuity package creation and validation

## 8. Core Domain Objects

These are the core MVP concepts.

### Project

Represents a working container for goals, threads, messages, decisions, and memory.

### Thread

Represents a structured collaborative conversation inside a project.

### Message

Represents a persisted event-backed conversational unit.

### Role

Represents a permanent or project-specific actor with defined authority and restrictions.

### Decision

Represents a first-class project outcome, not merely a line in chat.

### Memory

Represents approved, scoped knowledge with authority level and lifecycle state.

### Constitution Rule

Represents a structured policy entry evaluated against system actions.

### Handover Package

Represents a continuity artifact for session transition.

## 9. Database Schema v1

The fields below are the recommended MVP minimums.

### `users`

- `id`
- `email`
- `password_hash`
- `display_name`
- `created_at`

### `projects`

- `id`
- `name`
- `description`
- `status`
- `created_by`
- `created_at`

### `threads`

- `id`
- `project_id`
- `title`
- `status`
- `created_at`

### `messages`

- `id`
- `project_id`
- `thread_id`
- `message_type`
- `sender_type`
- `sender_role_id`
- `reply_to_message_id`
- `task_id`
- `decision_id`
- `visibility`
- `content_text`
- `payload_json`
- `created_at`

### `roles`

- `id`
- `name`
- `role_type`
- `is_permanent`
- `status`
- `prompt_key`
- `description`
- `created_at`

### `role_assignments`

- `id`
- `project_id`
- `role_id`
- `assigned_by`
- `status`
- `created_at`

### `tasks`

- `id`
- `project_id`
- `thread_id`
- `title`
- `description`
- `status`
- `owner_role_id`
- `created_at`

### `decisions`

- `id`
- `project_id`
- `thread_id`
- `title`
- `summary`
- `status`
- `proposed_by`
- `approved_by`
- `linked_memory_id`
- `created_at`

### `memories`

- `id`
- `project_id`
- `memory_type`
- `status`
- `visibility`
- `content`
- `embedding`
- `source_role_id`
- `source_message_id`
- `approved_by`
- `locked_at`
- `created_at`

### `constitution_rules`

- `id`
- `rule_code`
- `name`
- `scope`
- `condition_json`
- `enforcement_action`
- `severity`
- `active`
- `created_at`

### `locked_decisions`

- `id`
- `decision_id`
- `lock_reason`
- `locked_by`
- `created_at`

### `handover_packages`

- `id`
- `project_id`
- `thread_id`
- `from_session`
- `to_session`
- `status`
- `summary`
- `understanding_report`
- `created_at`

## 10. Message Protocol v1

Every message must be both displayable and machine-actionable.

### Required fields

- `message_type`
- `sender_type`
- `sender_role_id`
- `project_id`
- `thread_id`
- `visibility`
- `content_text`
- `payload_json`

### Core message types

- `user_goal`
- `analysis`
- `task_request`
- `task_update`
- `decision_proposal`
- `decision_final`
- `skill_request`
- `role_request`
- `governance_alert`
- `handover_notice`

### Protocol examples

`user_goal`

```json
{
  "goal": "Build an onboarding workflow for new clients",
  "priority": "high"
}
```

`decision_proposal`

```json
{
  "decision_title": "Adopt phased onboarding flow",
  "summary": "Use intake, validation, setup, and review stages",
  "proposed_by_role": "CoWork"
}
```

`handover_notice`

```json
{
  "reason": "context_threshold_50",
  "handover_package_id": "uuid"
}
```

## 11. Policy Engine Design v1

The policy engine evaluates whether proposed actions conform to the Constitution.

### Inputs

- actor role
- action type
- target object
- project scope
- memory state
- decision state

### Outputs

- `PASS`
- `WARN`
- `BLOCK`

### Early enforced rule categories

1. authority violations
2. locked object modification attempts
3. forbidden direct decision finalization
4. forbidden memory promotion
5. restricted role behavior

### Suggested service contract

```text
evaluate_action(actor, action, context) -> policy_result
```

Where `policy_result` includes:

- status
- rule_code
- reason
- recommended_next_step

## 12. Provider Adapter Design v1

All provider-specific behavior must remain behind shared interfaces.

### Interface methods

- `sendMessage`
- `streamMessage`
- `toolCall`
- `embed`
- `countTokens`

### First implementation

- `OpenAIAdapter`

### Planned future adapters

- `AnthropicAdapter`
- `GeminiAdapter`
- `OllamaAdapter`

### Adapter responsibility boundaries

Providers handle:

- message formatting
- request submission
- streaming normalization
- tool call normalization
- token estimation

Orchestration handles:

- role coordination
- policy decisions
- message persistence
- decision and memory transitions

## 13. CoWork Orchestration v1

CoWork is the first orchestration actor in the MVP.

### Responsibilities

1. receive user goal
2. interpret request
3. identify required roles
4. request role participation
5. synthesize responses
6. produce structured next actions
7. propose decisions

### MVP orchestration flow

1. persist `user_goal`
2. run policy precheck
3. build CoWork context
4. call provider adapter
5. normalize output into:
   - `analysis`
   - optional `task_request`
   - optional `decision_proposal`
6. persist outputs
7. if approved path exists, write verified memory

## 14. Memory Engine v1

The memory engine is responsible for controlled memory creation and retrieval.

### Responsibilities

1. classify memory type
2. assign memory status
3. enforce visibility and approval
4. generate embeddings where enabled
5. retrieve scoped memory for context building

### Retrieval defaults

- by project
- by status: `verified`, `locked`
- by relevance
- by visibility constraints

### Memory write rules

- chat content alone is not memory
- approved decisions may create memory
- locked memory requires protected path

## 15. Handover System v1

The handover system prevents progress loss across compressed or restarted sessions.

### Handover triggers

- context monitor at 40%
- package preparation at 50%
- transition readiness at 70%

### Handover package sections

1. completed work
2. in-progress work
3. locked decisions
4. risks
5. constraints
6. next steps

### Understanding report

A resumed session must provide:

- concise summary of state
- confirmation of active phase
- confirmation of next action

## 16. API Spec v1

These are the initial route groups.

### Auth

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`

### Projects

- `GET /projects`
- `POST /projects`
- `GET /projects/{project_id}`

### Threads

- `GET /projects/{project_id}/threads`
- `POST /projects/{project_id}/threads`
- `GET /threads/{thread_id}`

### Messages

- `GET /threads/{thread_id}/messages`
- `POST /threads/{thread_id}/messages`

### Roles

- `GET /roles`
- `GET /projects/{project_id}/roles`
- `POST /projects/{project_id}/roles/assign`

### Tasks

- `GET /projects/{project_id}/tasks`
- `POST /projects/{project_id}/tasks`

### Decisions

- `GET /projects/{project_id}/decisions`
- `POST /projects/{project_id}/decisions`
- `POST /decisions/{decision_id}/approve`

### Memories

- `GET /projects/{project_id}/memories`
- `POST /projects/{project_id}/memories`

### Handover

- `POST /projects/{project_id}/handover`
- `GET /projects/{project_id}/handover`

### Constitution

- `GET /constitution/rules`
- `POST /constitution/evaluate`

### Providers

- `GET /providers`
- `GET /providers/health`

## 17. MVP Build Order

Recommended execution order:

1. repo setup
2. backend skeleton
3. frontend skeleton
4. db schema + migrations
5. auth and project basics
6. thread and message persistence
7. Group Chat UI
8. provider interface
9. OpenAI adapter
10. constitution rule registry
11. policy engine v1
12. CoWork orchestration v1
13. decision flow
14. memory flow
15. handover flow

## 18. Sprint Backlog Baseline

### Sprint 1

- scaffold frontend and backend
- configure database
- add migrations
- create auth endpoints
- create project endpoints
- create thread endpoints
- create message persistence
- build initial Group Chat page
- define provider interface
- add first adapter

### Sprint 2

- add constitution rules storage
- add policy engine
- add permanent roles registry
- add CoWork orchestration
- add decision proposal flow
- add memory creation flow

### Sprint 3

- add handover packages
- add memory retrieval
- add role assignment UI
- add workspace refinement
- add dashboard visibility

## 19. MVP Acceptance Criteria

CORTEX Core MVP is accepted when:

1. a user can create a project
2. a user can open a thread
3. a user can submit a goal
4. CoWork can respond in structured form
5. the system can persist role-aware messages
6. a decision proposal can be created
7. an approved decision can become verified memory
8. a handover package can be generated

## 20. Open Design Questions

These are allowed to remain open briefly, but should be resolved during early implementation:

1. exact auth method details for local-first mode
2. whether realtime transport is polling first or WebSocket first
3. whether pgvector is enabled in Sprint 1 or Sprint 2
4. whether permanent roles are seeded from DB or filesystem registry
5. whether project role creation is disabled entirely in MVP or allowed in limited admin mode

## 21. Immediate Next Action

The next implementation step after this document is:

1. scaffold the project structure
2. create database schema v1
3. create API skeletons for projects, threads, and messages
4. build the first Group Chat UI shell

