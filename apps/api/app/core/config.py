from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    app_name: str = "CORTEX API"
    app_version: str = "0.1.0"
    app_description: str = "Foundation API skeleton for the CORTEX backend"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./cortex.db")


settings = Settings()
