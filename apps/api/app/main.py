from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.bootstrap import seed_foundation_data
from app.api.routes.auth import router as auth_router
from app.api.routes.cowork import router as cowork_router
from app.api.routes.constitution import router as constitution_router
from app.api.routes.decisions import router as decisions_router
from app.api.routes.memories import router as memories_router
from app.api.routes.messages import router as messages_router
from app.api.routes.projects import router as projects_router
from app.api.routes.roles import router as roles_router
from app.api.routes.threads import router as threads_router
from app.core.config import settings
from app.db import SessionLocal
from app import models  # noqa: F401


@asynccontextmanager
async def lifespan(_: FastAPI):
    db = SessionLocal()
    try:
        seed_foundation_data(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    description=settings.app_description,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(cowork_router)
app.include_router(projects_router)
app.include_router(threads_router)
app.include_router(messages_router)
app.include_router(memories_router)
app.include_router(roles_router)
app.include_router(constitution_router)
app.include_router(decisions_router)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "cortex-api"}


@app.get("/")
def root() -> dict[str, object]:
    return {
        "name": settings.app_name,
        "phase": "foundation",
        "database_url": settings.database_url,
        "routes": [
            "/projects",
            "/projects/{project_id}",
            "/projects/{project_id}/threads",
            "/threads/{thread_id}",
            "/threads/{thread_id}/messages",
            "/threads/{thread_id}/cowork-run",
            "/projects/{project_id}/memories",
            "/memories/{memory_id}/transition",
            "/auth/register",
            "/auth/login",
            "/auth/me",
            "/roles",
            "/constitution/rules",
            "/constitution/evaluate",
            "/projects/{project_id}/decisions",
            "/decisions/{decision_id}/approve",
        ],
    }
