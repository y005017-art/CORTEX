from fastapi import FastAPI


app = FastAPI(
    title="CORTEX API",
    description="Foundation scaffold for the CORTEX backend",
    version="0.1.0",
)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "cortex-api"}


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "CORTEX API",
        "phase": "foundation",
        "message": "Backend scaffold is running."
    }
