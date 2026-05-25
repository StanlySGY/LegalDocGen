from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from backend.config import settings
from backend.database import SessionLocal, init_db
from backend.exceptions import (
    AppException, app_exception_handler, validation_exception_handler, general_exception_handler
)
from backend.models.channel import Channel
from backend.models.user import User, UserRole
from backend.routers import audit, auth, cases, channel, config, legal_articles, materials, tasks, teams, templates, workflow
from backend.services.auth_service import hash_password
from backend.services.prompt_manager.manager import PromptManager
from backend.services.secret_service import encrypt_secret
from backend.services.storage_service import get_storage
from backend.services.team_service import ensure_default_team
from backend.services.template_manager import init_default_templates


def _seed_default_channel(db):
    """Auto-create a default channel from env config if no channels exist."""
    if db.query(Channel).count() > 0:
        return
    api_key = settings.OPENAI_API_KEY
    base_url = settings.OPENAI_BASE_URL.rstrip("/")
    model_name = settings.OPENAI_MODEL_NAME
    if not api_key:
        return
    ch = Channel(
        name="默认渠道",
        type="openai",
        base_url=base_url,
        api_key=encrypt_secret(api_key),
        models=f'["{model_name}"]',
        default_model=model_name,
        status=1,
        priority=0,
    )
    db.add(ch)
    db.commit()


def _seed_default_admin(db):
    password = settings.DEFAULT_ADMIN_PASSWORD
    if not password:
        return
    username = settings.DEFAULT_ADMIN_USERNAME.strip() or "admin"
    if db.query(User).filter(User.username == username).first():
        return
    user = User(
        username=username,
        display_name="系统管理员",
        password_hash=hash_password(password),
        role=UserRole.ADMIN,
    )
    db.add(user)
    db.flush()
    ensure_default_team(db, user)
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        pm = PromptManager(db)
        pm.init_default_templates()
        init_default_templates(db)
        _seed_default_admin(db)
        _seed_default_channel(db)
    finally:
        db.close()
    yield


app = FastAPI(title="LegalDocGen", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

app.include_router(audit.router)
app.include_router(auth.router)
app.include_router(teams.router)
app.include_router(cases.router)
app.include_router(materials.router)
app.include_router(tasks.router)
app.include_router(workflow.router)
app.include_router(legal_articles.router)
app.include_router(config.router)
app.include_router(channel.router)
app.include_router(templates.router)


def _database_health() -> tuple[dict, dict]:
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {
            "ok": True,
            "dialect": db.bind.dialect.name if db.bind else "unknown",
        }, {
            "total": db.query(Channel).count(),
            "enabled": db.query(Channel).filter(Channel.status == 1).count(),
            "tested_success": db.query(Channel).filter(Channel.test_status == "success").count(),
        }
    except Exception as exc:
        return {
            "ok": False,
            "error_type": exc.__class__.__name__,
        }, {"total": 0, "enabled": 0, "tested_success": 0}
    finally:
        db.close()


def _storage_health() -> dict:
    return get_storage().health()


@app.get("/api/health")
def health():
    database, channels = _database_health()
    storage = _storage_health()
    healthy = database["ok"] and storage["exists"] and storage["writable"]
    return {
        "status": "ok" if healthy else "degraded",
        "app": settings.APP_NAME,
        "version": app.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": database,
        "storage": storage,
        "channels": channels,
        "config": {
            "admin_token_enabled": bool(settings.ADMIN_TOKEN),
            "cors_origins": settings.cors_origins_list,
        },
    }
