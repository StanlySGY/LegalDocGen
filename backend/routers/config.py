from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import require_admin
from backend.services.model_dispatcher.dispatcher import dispatcher
from backend.models.prompt import PromptTemplate
from backend.models.workflow import StageType, STAGE_NAMES

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/models")
def get_models():
    return {"available": dispatcher.get_available_models()}


@router.get("/prompts")
def list_prompts(stage: str = "", db: Session = Depends(get_db)):
    q = db.query(PromptTemplate)
    if stage:
        q = q.filter(PromptTemplate.stage == stage)
    templates = q.order_by(PromptTemplate.created_at.desc()).all()
    return [
        {"id": t.id, "stage": t.stage, "name": t.name, "content": t.content,
         "is_default": t.is_default, "version": t.version}
        for t in templates
    ]


@router.post("/prompts", dependencies=[Depends(require_admin)])
def create_prompt(data: dict, db: Session = Depends(get_db)):
    tpl = PromptTemplate(stage=data["stage"], name=data["name"], content=data["content"], is_default=False)
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return {"id": tpl.id, "name": tpl.name}


@router.put("/prompts/{template_id}", dependencies=[Depends(require_admin)])
def update_prompt(template_id: str, data: dict, db: Session = Depends(get_db)):
    tpl = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if not tpl:
        return {"error": "not found"}
    tpl.content = data.get("content", tpl.content)
    if "name" in data:
        tpl.name = data["name"]
    db.commit()
    return {"id": tpl.id, "name": tpl.name}


@router.get("/stages")
def get_stages():
    return [{"value": s.value, "name": STAGE_NAMES[s]} for s in StageType]
