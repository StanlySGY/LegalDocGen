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


@router.get("/document-types")
def get_document_types():
    return {"types": [
        {"key": "complaint", "name": "民事起诉状", "desc": "原告向法院提起民事诉讼", "scenario": "原告起诉被告"},
        {"key": "defense", "name": "民事答辩状", "desc": "被告回应诉讼请求", "scenario": "被告被起诉后回应"},
        {"key": "representation", "name": "代理词", "desc": "代理人发表代理意见", "scenario": "开庭审理时提交"},
        {"key": "lawyer_letter", "name": "律师函", "desc": "向对方发送法律告知", "scenario": "诉前通知对方"},
    ]}


@router.get("/stage-variables/{stage}")
def get_stage_variables(stage: str):
    variables = []
    if stage == "fact_extraction":
        variables = [{"name": "案件类型", "hint": "如民间借贷、合同纠纷"}, {"name": "关键证据", "hint": "主要证据材料"}]
    elif stage == "legal_analysis":
        variables = [{"name": "适用法律", "hint": "相关法律条文"}, {"name": "管辖法院", "hint": "有管辖权的法院"}]
    elif stage == "dispute_focus":
        variables = [{"name": "争议焦点", "hint": "双方核心分歧"}]
    elif stage == "draft_generation":
        variables = [{"name": "诉讼请求", "hint": "具体请求事项"}, {"name": "事实与理由", "hint": "案件事实经过"}]
    elif stage == "review_optimization":
        variables = [{"name": "审查重点", "hint": "需要重点审查的内容"}]
    return {"variables": variables}


@router.post("/optimize-prompt")
def optimize_prompt(data: dict):
    prompt = data.get("prompt", "")
    instruction = data.get("instruction", "")
    return {"result": f"[AI优化建议] {instruction}\n\n{prompt}"}
