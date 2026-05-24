import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.database import get_db
from backend.models.workflow import StageType, STAGE_NAMES
from backend.services.workflow_engine.engine import WorkflowEngine
from backend.services.workflow_engine.stages import STAGE_PROMPTS
from backend.services.model_dispatcher.dispatcher import dispatcher
from backend.services.prompt_manager.manager import PromptManager
from backend.services.export_service import ExportService
from backend.exceptions import NotFoundError, ValidationError, InternalServerError

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

    try:
        stage = StageType(req.stage)
    except ValueError:
        raise ValidationError(f"无效的工作流阶段: {req.stage}")

    try:
        prompt_template = req.prompt or pm.get_prompt(stage, req.template_id)
        materials_context = engine.get_case_context(case_id)
        previous_context = engine.get_previous_stages_output(case_id, stage)

        final_prompt = prompt_template.format(
            materials=materials_context["materials"],
            previous_context=previous_context,
        )

        output = await dispatcher.generate(final_prompt, req.provider, req.model)
    except ValueError as e:
        raise ValidationError(str(e))
    except Exception as e:
        raise InternalServerError(f"生成失败: {str(e)}")

    node = engine.create_or_update_node(
        case_id=case_id, stage=stage, prompt=req.prompt or prompt_template,
        output=output, model_used=f"{req.provider}/{req.model}" if req.provider else "default",
    )
    return {"node_id": node.id, "output": output, "version": node.version}


@router.post("/generate-stream/{case_id}")
async def generate_stream(case_id: str, req: GenerateRequest, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    pm = PromptManager(db)

    try:
        stage = StageType(req.stage)
    except ValueError:
        raise ValidationError(f"无效的工作流阶段: {req.stage}")

    try:
        prompt_template = req.prompt or pm.get_prompt(stage, req.template_id)
        materials_context = engine.get_case_context(case_id)
        previous_context = engine.get_previous_stages_output(case_id, stage)

        final_prompt = prompt_template.format(
            materials=materials_context["materials"],
            previous_context=previous_context,
        )
    except ValueError as e:
        raise ValidationError(str(e))
    except Exception as e:
        raise InternalServerError(f"准备生成失败: {str(e)}")

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
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'生成失败: {str(e)}'})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")


@router.post("/rollback/{case_id}")
def rollback(case_id: str, req: RollbackRequest, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    try:
        node = engine.rollback_to_version(req.node_id)
        return {"stage": node.stage, "version": node.version, "output": node.output}
    except Exception as e:
        raise InternalServerError(f"回滚失败: {str(e)}")


@router.get("/history/{case_id}/{stage}")
def get_history(case_id: str, stage: str, db: Session = Depends(get_db)):
    try:
        stage_type = StageType(stage)
    except ValueError:
        raise ValidationError(f"无效的工作流阶段: {stage}")

    engine = WorkflowEngine(db)
    nodes = engine.get_version_history(case_id, stage_type)
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
    try:
        stage_type = StageType(stage)
    except ValueError:
        raise ValidationError(f"无效的工作流阶段: {stage}")

    engine = WorkflowEngine(db)
    node = engine.get_stage_node(case_id, stage_type)
    if not node:
        raise NotFoundError(f"工作流节点不存在")
    node.output = output
    db.commit()
    return {"message": "已保存"}


@router.get("/export/{case_id}")
def export_case(case_id: str, db: Session = Depends(get_db)):
    try:
        export_service = ExportService(db)
        content = export_service.export_to_word(case_id)
        return FileResponse(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=f"case_{case_id}.docx"
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"导出失败: {str(e)}")
