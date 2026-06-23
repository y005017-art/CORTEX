# CORTEX API

This directory contains the FastAPI backend scaffold for CORTEX.

## Local run

```bash
uvicorn app.main:app --reload --port 8000
```

## Current scope

- database schema v1 for `projects`, `threads`, and `messages`
- API skeleton for project, thread, and message flows

## Database

The canonical target remains PostgreSQL.

For local scaffold verification, the API defaults to:

```bash
sqlite:///./cortex.db
```

Override with `DATABASE_URL` when wiring a PostgreSQL instance.
