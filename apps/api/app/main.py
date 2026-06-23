from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes.messages import router as messages_router
from app.api.routes.projects import router as projects_router
from app.api.routes.threads import router as threads_router
from app.core.config import settings
from app.db import Base, engine
from app import models  # noqa: F401


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    description=settings.app_description,
    version=settings.app_version,
    lifespan=lifespan,
)

app.include_router(projects_router)
app.include_router(threads_router)
app.include_router(messages_router)


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
        ],
    }
