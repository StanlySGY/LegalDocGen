import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "LegalDocGen"
    DATABASE_URL: str = "sqlite:///./legaldocgen.db"
    UPLOAD_DIR: Path = Path("uploads")
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS: set = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"}

    DEFAULT_MODEL: str = "openai"
    DEFAULT_MODEL_NAME: str = "mimo-v2.5-pro"
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL_NAME: str = "mimo-v2.5-pro"
    CLAUDE_API_KEY: str = ""
    CUSTOM_API_KEY: str = ""
    CUSTOM_BASE_URL: str = ""
    CUSTOM_MODEL_NAME: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
