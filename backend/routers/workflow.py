import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.database import get_db
from backend.models.workflow import StageType, STAGE_NAMES
from backend.models.material import Material
from backend.services.workflow_engine.engine import WorkflowEngine
from backend.services.workflow_engine.stages import STAGE_PROMPTS
from backend.services.model_dispatcher.dispatcher import dispatcher
from backend.services.prompt_manager.manager import PromptManager

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


class GenerateRequest(BaseModel):
    stage: str
    prompt: str = ""
    provider: str = ""
    model: str = ""
    template_id: str = ""


class RollbackRequest(BaseModel):
    node_id: str


@router.get("/progress/{case_id}")
def get_progress(case_id: str, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    return engine.get_stage_progress(case_id)


@router.get("/node/{case_id}/{stage}")
def get_node(case_id: str, stage: str, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    node = engine.get_stage_node(case_id, StageType(stage))
    if not node:
        return {"stage": stage, "output": "", "prompt": STAGE_PROMPTS.get(StageType(stage), ""), "version": 0}
    return {
        "id": node.id,
        "stage": node.stage,
        "output": node.output,
        "prompt": node.prompt,
        "model_used": node.model_used,
        "version": node.version,
        "status": node.status,
        "created_at": node.created_at.isoformat() if node.created_at else None,
    }


@router.post("/generate/{case_id}")
async def generate(case_id: str, req: GenerateRequest, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    pm = PromptManager(db)
    stage = StageType(req.stage)

    progress = engine.get_stage_progress(case_id)
    stage_info = next((s for s in progress if s["stage"] == req.stage), None)
    if stage_info and stage_info["locked"]:
        raise HTTPException(400, stage_info["locked_reason"])

    prompt_template = req.prompt or pm.get_prompt(stage, req.template_id)
    materials_context = engine.get_case_context(case_id)
    previous_context = engine.get_previous_stages_output(case_id, stage)

    final_prompt = prompt_template.format(
        materials=materials_context["materials"],
        previous_context=previous_context,
    )

    try:
        output = await dispatcher.generate(final_prompt, req.provider, req.model)
    except Exception as e:
        raise HTTPException(500, f"生成失败: {e}")

    node = engine.create_or_update_node(
        case_id=case_id, stage=stage, prompt=req.prompt or prompt_template,
        output=output, model_used=f"{req.provider}/{req.model}" if req.provider else "default",
    )

    if stage == StageType.FACT_EXTRACTION:
        from backend.services.structurer.structurer import structure_facts
        structured = structure_facts(output)
        for m in db.query(Material).filter(Material.case_id == case_id).all():
            m.structured_data = json.dumps(structured, ensure_ascii=False)
        db.commit()

    return {"node_id": node.id, "output": output, "version": node.version}
async def generate_stream(case_id: str, req: GenerateRequest, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    pm = PromptManager(db)
    stage = StageType(req.stage)

    progress = engine.get_stage_progress(case_id)
    stage_info = next((s for s in progress if s["stage"] == req.stage), None)
    if stage_info and stage_info["locked"]:
        raise HTTPException(400, stage_info["locked_reason"])

    prompt_template = req.prompt or pm.get_prompt(stage, req.template_id)
    materials_context = engine.get_case_context(case_id)
    previous_context = engine.get_previous_stages_output(case_id, stage)

    final_prompt = prompt_template.format(
        materials=materials_context["materials"],
        previous_context=previous_context,
    )

    async def stream_generator():
        try:
            full_output = []
            async for chunk in dispatcher.generate_stream(final_prompt, req.provider, req.model):
                full_output.append(chunk)
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            output = "".join(full_output)
            engine.create_or_update_node(
                case_id=case_id, stage=stage, prompt=req.prompt or prompt_template,
                output=output, model_used=f"{req.provider}/{req.model}" if req.provider else "default",
            )
            if stage == StageType.FACT_EXTRACTION:
                from backend.services.structurer.structurer import structure_facts
                structured = structure_facts(output)
                for m in db.query(Material).filter(Material.case_id == case_id).all():
                    m.structured_data = json.dumps(structured, ensure_ascii=False)
                db.commit()
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")


@router.post("/rollback/{case_id}")
def rollback(case_id: str, req: RollbackRequest, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    node = engine.rollback_to_version(req.node_id)
    return {"stage": node.stage, "version": node.version, "output": node.output}


@router.get("/history/{case_id}/{stage}")
def get_history(case_id: str, stage: str, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    nodes = engine.get_version_history(case_id, StageType(stage))
    return [
        {
            "id": n.id, "version": n.version, "output": n.output,
            "prompt": n.prompt, "model_used": n.model_used,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in nodes
    ]


@router.post("/save-output/{case_id}/{stage}")
def save_output(case_id: str, stage: str, output: str = "", db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    node = engine.get_stage_node(case_id, StageType(stage))
    if not node:
        raise HTTPException(404, "节点不存在")
    node.output = output
    db.commit()
    return {"message": "已保存"}
