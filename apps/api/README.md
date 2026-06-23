# CORTEX API

This directory contains the FastAPI backend scaffold for CORTEX.

## Local run

```bash
uvicorn app.main:app --reload --port 8000
```

## Current scope

- database schema v1 for `projects`, `threads`, and `messages`
- API skeleton for project, thread, message, role, constitution, and decision flows
- Alembic migration tooling baseline
- local auth routes plus token-backed session flow
- repository/service layering for workspace and decision operations

## Database

The canonical target remains PostgreSQL.

For local scaffold verification, the API defaults to:

```bash
sqlite:///./cortex.db
```

Override with `DATABASE_URL` when wiring a PostgreSQL instance.

## Migrations

Initialize the local database with:

```bash
alembic upgrade head
```

## Auth routes

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Authenticated routes expect:

```text
Authorization: Bearer <token>
```
