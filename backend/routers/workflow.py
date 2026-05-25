import json
import re
import zipfile
from io import BytesIO
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend.models.case import Case
from backend.models.workflow import StageType
from backend.services.workflow_engine.engine import WorkflowEngine
from backend.services.model_dispatcher.dispatcher import dispatcher
from backend.services.prompt_manager.manager import PromptManager
from backend.services.export_service import ExportService
from backend.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


class GenerateRequest(BaseModel):
    stage: str
    prompt: str = ""
    provider: str = ""
    model: str = ""
    template_id: str = ""


class RollbackRequest(BaseModel):
    node_id: str


class SaveOutputRequest(BaseModel):
    output: str = ""


class BatchExportRequest(BaseModel):
    case_ids: list[str]


TRUSTED_OUTPUT_RULES = """

---
输出可信度要求：
1. 仅基于已上传案件材料和前序阶段内容作答，不得编造材料中不存在的事实、证据或程序进展。
2. 涉及事实判断时，尽量标注依据材料或证据来源；无法确认的内容请列入“需人工核验事项”。
3. 涉及法律条文、金额计算或诉讼策略时，如材料不足或准确性不确定，必须明确提示需由律师复核。
4. 输出末尾请保留“需人工核验事项”小节，列明不确定信息和建议补充材料。
"""


def _build_final_prompt(prompt_template: str, materials: str, previous_context: str) -> str:
    return prompt_template.format(
        materials=materials,
        previous_context=previous_context,
    ) + TRUSTED_OUTPUT_RULES


@router.get("/progress/{case_id}")
def get_progress(case_id: str, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    return engine.get_stage_progress(case_id)


def _get_case_template_id(case_id: str, request_template_id: str, db: Session) -> str:
    if request_template_id:
        return request_template_id
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise NotFoundError("案件不存在")
    return case.template_id or ""


def _safe_filename(value: str) -> str:
    name = re.sub(r"[^\w一-鿿.-]+", "_", value).strip("._")
    return name or "case"


def _build_docx_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


def _ensure_stage_ready(engine: WorkflowEngine, case_id: str, stage: StageType):
    missing = engine.get_missing_previous_stages(case_id, stage)
    if missing:
        raise ValidationError(f"请先完成前序阶段：{'、'.join(missing)}")


def _ensure_export_ready(engine: WorkflowEngine, case_id: str):
    missing = engine.get_missing_output_stages(case_id)
    if missing:
        raise ValidationError(f"请先完成全部工作流阶段，仍缺少：{'、'.join(missing)}")


@router.get("/node/{case_id}/{stage}")
def get_node(case_id: str, stage: str, db: Session = Depends(get_db)):
    try:
        stage_type = StageType(stage)
    except ValueError:
        raise ValidationError(f"无效的工作流阶段: {stage}")

    engine = WorkflowEngine(db)
    node = engine.get_stage_node(case_id, stage_type)
    if not node:
        pm = PromptManager(db)
        template_id = _get_case_template_id(case_id, "", db)
        return {"stage": stage, "output": "", "prompt": pm.get_prompt(stage_type, template_id), "version": 0}
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
        _ensure_stage_ready(engine, case_id, stage)
        template_id = _get_case_template_id(case_id, req.template_id, db)
        prompt_template = req.prompt or pm.get_prompt(stage, template_id)
        materials_context = engine.get_case_context(case_id)
        previous_context = engine.get_previous_stages_output(case_id, stage)

        final_prompt = _build_final_prompt(
            prompt_template,
            materials_context["materials"],
            previous_context,
        )

        output = await dispatcher.generate(final_prompt, req.provider, req.model)
    except ValueError as e:
        raise ValidationError(str(e))

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
        _ensure_stage_ready(engine, case_id, stage)
        template_id = _get_case_template_id(case_id, req.template_id, db)
        prompt_template = req.prompt or pm.get_prompt(stage, template_id)
        materials_context = engine.get_case_context(case_id)
        previous_context = engine.get_previous_stages_output(case_id, stage)

        final_prompt = _build_final_prompt(
            prompt_template,
            materials_context["materials"],
            previous_context,
        )
    except ValueError as e:
        raise ValidationError(str(e))

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
def save_output(case_id: str, stage: str, req: SaveOutputRequest, db: Session = Depends(get_db)):
    try:
        stage_type = StageType(stage)
    except ValueError:
        raise ValidationError(f"无效的工作流阶段: {stage}")

    engine = WorkflowEngine(db)
    node = engine.get_stage_node(case_id, stage_type)
    if not node:
        raise NotFoundError("工作流节点不存在")
    node.output = req.output
    engine.sync_case_status(case_id)
    db.commit()
    return {"message": "已保存"}


@router.get("/export/{case_id}")
def export_case(case_id: str, db: Session = Depends(get_db)):
    try:
        engine = WorkflowEngine(db)
        _ensure_export_ready(engine, case_id)
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise NotFoundError("案件不存在")
        export_service = ExportService(db)
        content = export_service.export_to_word(case_id)
        return _build_docx_response(content, f"{_safe_filename(case.name)}.docx")
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        if isinstance(e, (NotFoundError, ValidationError)):
            raise e
        raise HTTPException(500, f"导出失败: {str(e)}")


@router.post("/export-batch")
def export_batch(req: BatchExportRequest, db: Session = Depends(get_db)):
    if not req.case_ids:
        raise ValidationError("请选择要导出的案件")

    cases = db.query(Case).filter(Case.id.in_(req.case_ids)).all()
    case_map = {case.id: case for case in cases}
    missing_ids = [case_id for case_id in req.case_ids if case_id not in case_map]
    if missing_ids:
        raise NotFoundError("部分案件不存在")

    engine = WorkflowEngine(db)
    export_service = ExportService(db)
    buffer = BytesIO()
    used_names: dict[str, int] = {}

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for case_id in req.case_ids:
            case = case_map[case_id]
            _ensure_export_ready(engine, case_id)
            base_name = _safe_filename(case.name)
            count = used_names.get(base_name, 0) + 1
            used_names[base_name] = count
            filename = f"{base_name}.docx" if count == 1 else f"{base_name}_{count}.docx"
            archive.writestr(filename, export_service.export_to_word(case_id))

    buffer.seek(0)
    filename = f"LegalDocGen_批量导出_{len(req.case_ids)}份.zip"
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )
