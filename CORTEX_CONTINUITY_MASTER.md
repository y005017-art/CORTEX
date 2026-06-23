# CORTEX Continuity Master

Version: v1
Status: Active
Purpose: Preserve the full working context for CORTEX so future sessions can resume implementation without architectural drift, scope loss, or memory contamination.

## 1. Product Identity

- Product name: `CORTEX`
- Internal operating model: `AIOOS`
- Product category: AI organization operating system
- Primary objective: Build a system where a user sets goals, CoWork orchestrates execution, roles collaborate under constitutional rules, decisions become controlled memory, and work can be handed over across sessions safely.

## 2. Core Product Definition

CORTEX is not a generic chat application.

It is a structured multi-role AI operating environment with:

- constitutional rules
- role orchestration
- controlled memory
- decision management
- handover continuity
- future skill and governance layers

The first meaningful system loop is:

1. User creates a project
2. User submits a goal in Group Chat
3. CoWork interprets and structures the request
4. Appropriate roles participate
5. A decision is proposed and finalized
6. The finalized decision is written into controlled memory
7. A handover package can be generated when context thresholds are reached

This loop is the minimum viable closure of CORTEX Core.

## 3. Naming Rules

Use these terms consistently:

- `CORTEX`: product/system name
- `AIOOS`: internal organizational operating model
- `Constitution`: machine-enforced and prompt-guided rule system
- `Permanent Roles`: fixed system roles
- `Project Roles`: dynamic project-specific roles
- `Group Chat`: structured collaborative project conversation
- `Memory`: controlled organizational memory, not loose notes
- `Handover Package`: session continuity artifact

Do not rename these casually during implementation.

## 4. Non-Negotiable Product Principles

These principles must not drift.

1. CORTEX must be built as a system, not as a prompt collection.
2. Constitutional rules must be programmatically enforceable where risk is meaningful.
3. Group Chat must be backed by structured message protocol, not plain text only.
4. Memory must have authority, status, and visibility control.
5. Decisions must be traceable and linked to project context.
6. Handover is a first-class system concern, not an afterthought.
7. Provider-specific model integrations must be abstracted behind adapters.
8. Scope must be phased; Skill and Governance systems must not derail Core MVP.

## 5. Major Risks and Hard Mitigations

### Risk 1: Prompt rules stay as prose and never become system behavior

Mitigation:

- Build a `Policy Engine`
- Store rules structurally
- Enforce high-risk rules in backend logic
- Return `PASS`, `WARN`, or `BLOCK`

Hard rule:

- Never rely on prompt text alone for critical constraints

### Risk 2: Role, Skill, and Governance systems explode the scope

Mitigation:

- Develop in phases
- MVP includes only core role orchestration
- Skill and Governance layers come later

Hard rule:

- Do not build autonomous self-evolving role or skill systems in MVP

### Risk 3: Memory contamination corrupts later decisions

Mitigation:

- Separate working memory from decision memory
- Add approval states and visibility filters
- Default retrieval to verified and locked memory only

Hard rule:

- Draft memory must not directly influence core decision context by default

### Risk 4: Group Chat has no message protocol

Mitigation:

- Create typed message objects from day one
- Store structured event metadata with every message

Hard rule:

- No production chat persistence without protocol metadata

### Risk 5: Single-model coupling makes future migration expensive

Mitigation:

- Build provider adapters
- Keep orchestration independent from SDK-specific details

Hard rule:

- Core orchestration must never call provider SDKs directly

## 6. Delivery Strategy

Implementation should follow a phased expansion model.

### Phase 0: Foundation

Deliver:

- repo structure
- backend skeleton
- frontend skeleton
- database schema v1
- migration setup
- provider interface
- message protocol v1
- policy rule format
- prompt registry format

### Phase 1: CORTEX Core MVP

Deliver:

- projects
- threads
- structured messages
- Group Chat UI
- CoWork orchestration v1
- constitution enforcement v1
- permanent roles registry
- decision flow
- memory write and retrieval basics
- handover package basics

### Phase 2: Execution Layer

Deliver:

- task engine
- role assignment flow
- project role lifecycle
- decision approval flow
- memory ACL
- context rotation thresholds
- understanding report flow

### Phase 3: Capability Layer

Deliver:

- skill registry
- role-skill mapping
- skill request flow
- skill lifecycle basics
- Essence / Trainer / Examiner basics

### Phase 4: Governance Layer

Deliver:

- governance alerts
- audit workflows
- observer logs
- reflection proposals
- evolution proposals

## 7. Scope Guardrails

### Must build early

- message protocol
- policy engine
- memory status model
- provider interface
- project/thread/message persistence
- decision flow
- handover structure

### May be delayed

- skill health score
- auto-upgrade logic
- full certification workflows
- full governance approvals
- reflection and evolution loops
- multi-provider UI richness

### Do not build in early MVP

- self-creating roles
- self-upgrading skills
- self-modifying constitution
- uncontrolled memory writes
- fully autonomous governance loop
- provider-specific branching everywhere

## 8. Canonical Technical Stack

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:

- FastAPI
- SQLAlchemy
- PostgreSQL

Memory and retrieval:

- PostgreSQL
- pgvector

Realtime:

- WebSocket

Deployment:

- Docker

Provider architecture:

- Adapter pattern

## 9. Canonical Core Modules

Backend modules:

- `constitution`
- `orchestration`
- `chat`
- `roles`
- `tasks`
- `decisions`
- `memory`
- `handover`
- `providers`
- `governance`

Frontend modules:

- `Dashboard`
- `Workspace`
- `Group Chat`
- `Role Console`
- `Memory Center`
- `Constitution Center`
- `Skill Center`
- `Handover Center`

First-wave UI priority:

1. Dashboard
2. Workspace
3. Group Chat

## 10. Canonical Database Entities

Phase 1 required entities:

- `users`
- `projects`
- `threads`
- `messages`
- `roles`
- `role_assignments`
- `tasks`
- `decisions`
- `memories`
- `constitution_rules`
- `locked_decisions`
- `handover_packages`

Phase 2+ entities:

- `skills`
- `role_skills`
- `training_records`
- `exam_records`
- `governance_events`
- `audit_logs`

## 11. Message Protocol v1

Every stored Group Chat message must include structured metadata.

Minimum fields:

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
- `payload_json`
- `created_at`

Core message types:

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

Rule:

- UI may look like chat, but storage must behave like a structured event stream

## 12. Memory Model v1

Memory is authoritative and must be controlled.

Memory types:

- `decision`
- `constraint`
- `preference`
- `risk`
- `task`
- `document`
- `handover`

Memory statuses:

- `draft`
- `verified`
- `locked`
- `archived`

Minimum memory fields:

- `id`
- `project_id`
- `memory_type`
- `status`
- `content`
- `source_role_id`
- `source_message_id`
- `visibility`
- `approved_by`
- `locked_at`
- `created_at`

Rules:

- `draft` is writable working memory
- `verified` is approved usable memory
- `locked` is protected constitutional or finalized memory
- `archived` is historical and non-default

Retrieval default:

- Only retrieve `verified` and `locked`

## 13. Decision Model v1

Decisions are first-class objects.

Minimum fields:

- `id`
- `project_id`
- `title`
- `summary`
- `status`
- `proposed_by`
- `approved_by`
- `linked_memory_id`
- `created_at`

Decision statuses:

- `proposed`
- `reviewing`
- `approved`
- `rejected`
- `locked`

Rule:

- Only approved or locked decisions should create authoritative memory by default

## 14. Constitution and Policy Model v1

High-risk rules must be structured.

Minimum rule fields:

- `id`
- `rule_code`
- `name`
- `scope`
- `condition_json`
- `enforcement_action`
- `severity`
- `active`

Enforcement outcomes:

- `PASS`
- `WARN`
- `BLOCK`

Examples of rules that should become backend policy early:

- role cannot exceed authority
- locked memory cannot be modified
- role cannot self-create unrestricted capabilities
- critical decisions cannot bypass required review path

## 15. Provider Interface v1

All model providers must sit behind a shared interface.

Required methods:

- `sendMessage`
- `streamMessage`
- `toolCall`
- `embed`
- `countTokens`

Planned adapters:

- `OpenAIAdapter`
- `AnthropicAdapter`
- `GeminiAdapter`
- `OllamaAdapter`

Rule:

- orchestration code must not import provider SDKs directly

## 16. Handover System v1

Handover is a required continuity mechanism.

Trigger thresholds:

- 40% context: monitor
- 50% context: prepare handover
- 70% context: force transition readiness

Handover package must contain:

- completed work
- in-progress work
- locked decisions
- risks
- constraints
- next steps

New session must produce:

- understanding report

Acceptance rule:

- new session should not continue execution until understanding is sufficient

## 17. Canonical Development Order

Build in this order unless a strong reason emerges:

1. repo structure
2. database schema and migrations
3. auth and project/thread basics
4. message protocol and persistence
5. Group Chat basic UI
6. provider interface and first adapter
7. constitution policy engine
8. CoWork orchestration
9. decision flow
10. memory engine
11. handover flow
12. dashboard/workspace refinement
13. role console
14. memory center

## 18. Sprint Plan Baseline

### Sprint 1

- repo scaffolding
- frontend skeleton
- backend skeleton
- DB schema v1
- migrations
- projects/threads/messages APIs
- Group Chat initial page
- provider interface
- first provider adapter

Sprint 1 done means:

- a user can create a project
- enter a workspace
- create a thread
- send a message
- persist that message
- invoke the first LLM adapter successfully

### Sprint 2

- constitution rules registry
- policy engine v1
- permanent roles registry
- CoWork orchestration v1
- decision proposal flow
- verified memory write path

Sprint 2 done means:

- a user goal can become a structured decision proposal
- policy checks can run
- approved output can write to verified memory

## 19. Session Resume Rules

When resuming work in a new session:

1. Read this file first.
2. Confirm current implementation phase.
3. Confirm what has already been built versus only planned.
4. Continue from the highest-priority unfinished item in the canonical development order.
5. Do not expand scope into Skill or Governance layers unless Core MVP is stable.
6. Do not rename system concepts unless explicitly requested.

## 20. Handover Update Template

Use this block when updating continuity:

```md
## Session Update

- Date:
- Current phase:
- What was completed:
- What is in progress:
- What is blocked:
- Architectural decisions made:
- Files/modules touched:
- Next recommended action:
```

## 21. Resume Prompt Template

Use this when asking a future agent to continue:

```text
Please resume CORTEX development.
Read CORTEX_CONTINUITY_MASTER.md first.
Treat it as the canonical continuity document.
Then identify the current implementation state, compare it with the canonical development order, and continue from the highest-priority unfinished Core MVP item without expanding scope prematurely.
```

## 22. Anti-Drift Rules

If future implementation starts to drift, correct course using these priorities:

1. preserve CORTEX Core loop
2. preserve policy enforcement
3. preserve message structure
4. preserve memory integrity
5. preserve provider abstraction
6. preserve phased scope boundaries

## 23. Current Canonical State

As of this document version:

- Product name is fixed as `CORTEX`
- AIOOS remains the internal operating model
- No implementation has yet been declared complete in this continuity file
- Core MVP remains the immediate target
- The next recommended artifact is a formal MVP system design and then implementation scaffolding

