import os
from pathlib import Path
from pydantic_settings import BaseSettings


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings(BaseSettings):
    APP_NAME: str = "LegalDocGen"
    DATABASE_URL: str = "sqlite:///./legaldocgen.db"
    UPLOAD_DIR: Path = Path("uploads")
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS: set = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"}
    CORS_ORIGINS: str = "*"
    ADMIN_TOKEN: str = ""
    API_KEY_SECRET: str = ""

    DEFAULT_MODEL: str = "openai"
    DEFAULT_MODEL_NAME: str = "mimo-v2.5-pro"
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL_NAME: str = "mimo-v2.5-pro"
    CLAUDE_API_KEY: str = ""
    CUSTOM_API_KEY: str = ""
    CUSTOM_BASE_URL: str = ""
    CUSTOM_MODEL_NAME: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return ["*"] if self.CORS_ORIGINS.strip() == "*" else _split_csv(self.CORS_ORIGINS)

    class Config:
        env_file = ".env"


settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
