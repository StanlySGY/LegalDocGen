from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
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


@router.post("/prompts")
def create_prompt(data: dict, db: Session = Depends(get_db)):
    tpl = PromptTemplate(stage=data["stage"], name=data["name"], content=data["content"], is_default=False)
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return {"id": tpl.id, "name": tpl.name}


@router.put("/prompts/{template_id}")
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


@router.get("/stage-variables/{stage}")
def get_stage_variables(stage: str):
    from backend.services.workflow_engine.stages import STAGE_VARIABLES
    variables = STAGE_VARIABLES.get(StageType(stage), [])
    return {"variables": variables}


@router.get("/document-types")
def get_document_types():
    from backend.services.workflow_engine.stages import DOCUMENT_TYPES
    return {"types": [{"key": k, "name": v["name"], "desc": v["desc"], "scenario": v["scenario"]} for k, v in DOCUMENT_TYPES.items()]}


class OptimizePromptRequest(BaseModel):
    prompt: str
    instruction: str
    provider: str = ""
    model: str = ""


@router.post("/optimize-prompt")
async def optimize_prompt(req: OptimizePromptRequest):
    system = (
        "你是一位Prompt工程专家，专门为法律文书生成系统优化Prompt模板。"
        "用户会给你当前的Prompt模板和优化需求，你需要返回优化后的完整Prompt文本。"
        "规则：\n"
        "1. 只返回优化后的完整Prompt，不要添加任何解释、说明或前缀\n"
        "2. 保留模板中的变量占位符（如 {materials}、{previous_context}）\n"
        "3. 确保优化后的Prompt仍然适用于原始阶段（文书生成/审查等）\n"
        "4. 使Prompt更加具体、有针对性，符合中国法律实务需求"
    )
    prompt = f"当前Prompt模板：\n---\n{req.prompt}\n---\n\n用户的优化需求：{req.instruction}\n\n请返回优化后的完整Prompt："
    try:
        result = await dispatcher.generate(prompt, req.provider, req.model)
        return {"result": result}
    except Exception as e:
        raise HTTPException(500, f"优化失败: {e}")
