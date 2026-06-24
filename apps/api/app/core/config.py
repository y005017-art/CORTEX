from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    app_name: str = "CORTEX API"
    app_version: str = "0.1.0"
    app_description: str = "Foundation API skeleton for the CORTEX backend"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./cortex.db")
    default_provider: str = os.getenv("CORTEX_DEFAULT_PROVIDER", "deterministic")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-5-mini")


settings = Settings()
