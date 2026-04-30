from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from backend.database import init_db, SessionLocal
from backend.routers import cases, materials, workflow, config, channel, parties, templates
from backend.services.prompt_manager.manager import PromptManager
from backend.seed import seed_demo_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        pm = PromptManager(db)
        pm.init_default_templates()
        seed_demo_data(db)
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

app.include_router(cases.router)
app.include_router(materials.router)
app.include_router(workflow.router)
app.include_router(config.router)
app.include_router(channel.router)
app.include_router(parties.router)
app.include_router(templates.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
