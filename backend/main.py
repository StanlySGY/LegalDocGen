from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager

from backend.database import init_db, SessionLocal
from backend.config import settings
from backend.routers import audit, cases, materials, workflow, config, channel, templates
from backend.services.prompt_manager.manager import PromptManager
from backend.services.template_manager import init_default_templates
from backend.models.channel import Channel
from backend.exceptions import (
    AppException, app_exception_handler, validation_exception_handler, general_exception_handler
)


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
        api_key=api_key,
        models=f'["{model_name}"]',
        default_model=model_name,
        status=1,
        priority=0,
    )
    db.add(ch)
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        pm = PromptManager(db)
        pm.init_default_templates()
        init_default_templates(db)
        _seed_default_channel(db)
    finally:
        db.close()
    yield


app = FastAPI(title="LegalDocGen", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

app.include_router(audit.router)
app.include_router(cases.router)
app.include_router(materials.router)
app.include_router(workflow.router)
app.include_router(config.router)
app.include_router(channel.router)
app.include_router(templates.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
