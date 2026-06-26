import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.dependencies import get_accessible_case, get_current_user
from backend.exceptions import ForbiddenError, InternalServerError, NotFoundError, ValidationError
from backend.models.billing import UsageMetric
from backend.models.case import CaseStatus
from backend.models.material import Material
from backend.models.task import BackgroundTask
from backend.models.user import User
from backend.services.audit_service import record_audit
from backend.services.billing_service import enforce_quota, record_usage
from backend.services.file_parser.parser import parse_file_with_pages
from backend.services.storage_service import get_storage
from backend.services.task_service import complete_task, fail_task, public_task, start_task

router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.post("/upload/{case_id}")
async def upload_material(
    case_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    case = get_accessible_case(db, case_id, current_user)
    if case.status == CaseStatus.ARCHIVED:
        raise ForbiddenError("案件已归档，无法上传材料。如需编辑请先解归档。")
    enforce_quota(db, case.team_id, UsageMetric.MATERIALS)
    safe_name = Path(file.filename or "").name
    if not safe_name:
        raise ValidationError("文件名不能为空")

    suffix = Path(safe_name).suffix.lower()
    if suffix not in settings.ALLOWED_EXTENSIONS:
        raise ValidationError(f"不支持的文件格式: {suffix}。支持的格式: {', '.join(settings.ALLOWED_EXTENSIONS)}")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise ValidationError(f"文件过大，最大支持 {settings.MAX_FILE_SIZE / 1024 / 1024:.0f}MB")

    storage = get_storage()
    object_key = f"{case_id}/{uuid.uuid4().hex}{suffix}"
    file_path = ""
    task = start_task(db, "material.parse", case_id, f"解析材料：{safe_name}")
    db.flush()

    try:
        file_path = storage.save(object_key, content)
        parsed = parse_file_with_pages(Path(file_path))
        parsed_text = parsed["text"]
        material = Material(
            case_id=case_id,
            filename=safe_name,
            file_path=file_path,
            file_type=suffix,
            file_size=len(content),
            parsed_content=parsed_text,
            structured_data=json.dumps({"pages": parsed["pages"]}, ensure_ascii=False),
            parse_task_id=task.id,
            parse_status="completed" if parsed_text and not parsed_text.startswith("[") else "failed",
        )
        db.add(material)
        db.flush()
        record_usage(db, case.team_id, UsageMetric.MATERIALS, "material", material.id)
        complete_task(db, task, json.dumps({"material_id": material.id}, ensure_ascii=False), "材料解析完成")
        record_audit(db, "material.upload", "case", case_id, f"上传材料：{safe_name}")
        db.commit()
        db.refresh(material)
        return material
    except Exception as e:
        fail_task(db, task, str(e))
        if file_path:
            storage.delete(file_path)
        db.commit()
        raise InternalServerError(f"文件上传失败: {str(e)}")


@router.get("/case/{case_id}")
def list_materials(case_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    get_accessible_case(db, case_id, current_user)
    return db.query(Material).filter(Material.case_id == case_id).order_by(Material.created_at.desc()).all()


@router.get("/case/{case_id}/catalog")
def get_material_catalog(case_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    get_accessible_case(db, case_id, current_user)
    from backend.services.workflow_engine.engine import WorkflowEngine
    engine = WorkflowEngine(db)
    return {
        "catalog": engine.get_material_catalog(case_id),
        "timeline": engine.get_fact_timeline(case_id),
    }


@router.get("/tasks/{task_id}")
def get_material_task(task_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    task = db.query(BackgroundTask).filter(BackgroundTask.id == task_id).first()
    if not task:
        raise NotFoundError("任务不存在")
    if task.case_id:
        get_accessible_case(db, task.case_id, current_user)
    return public_task(task)


@router.get("/{material_id}")
def get_material(material_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise NotFoundError(f"材料 {material_id} 不存在")
    get_accessible_case(db, material.case_id, current_user)
    return material


@router.get("/{material_id}/preview")
def preview_material(material_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise NotFoundError(f"材料 {material_id} 不存在")
    get_accessible_case(db, material.case_id, current_user)
    return {
        "id": material.id,
        "filename": material.filename,
        "file_type": material.file_type,
        "parsed_content": material.parsed_content or "",
        "file_path": material.file_path,
    }


@router.delete("/{material_id}")
def delete_material(material_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise NotFoundError(f"材料 {material_id} 不存在")
    case = get_accessible_case(db, material.case_id, current_user)
    if case.status == CaseStatus.ARCHIVED:
        raise ForbiddenError("案件已归档，无法删除材料。如需编辑请先解归档。")
    get_storage().delete(material.file_path)
    record_audit(db, "material.delete", "case", material.case_id, f"删除材料：{material.filename}")
    db.delete(material)
    db.commit()
    return {"message": "已删除"}


@router.put("/{material_id}/category")
def update_material_category(
    material_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise NotFoundError(f"材料 {material_id} 不存在")
    get_accessible_case(db, material.case_id, current_user)
    
    category = body.get("category", "other")
    from backend.models.material import EVIDENCE_CATEGORIES
    if category not in EVIDENCE_CATEGORIES:
        raise ValidationError(f"无效的分类: {category}，可选值: {', '.join(EVIDENCE_CATEGORIES.keys())}")
    
    material.category = category
    db.commit()
    db.refresh(material)
    return material


@router.get("/case/{case_id}/search")
def search_materials(
    case_id: str,
    q: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    get_accessible_case(db, case_id, current_user)
    
    if not q or len(q.strip()) < 2:
        raise ValidationError("搜索关键词至少需要2个字符")
    
    keyword = q.strip()
    materials = db.query(Material).filter(
        Material.case_id == case_id,
        Material.parsed_content.isnot(None),
        Material.parsed_content != "",
    ).all()
    
    results = []
    for mat in materials:
        content = mat.parsed_content or ""
        idx = content.lower().find(keyword.lower())
        if idx == -1:
            continue
        
        context_start = max(0, idx - 80)
        context_end = min(len(content), idx + len(keyword) + 80)
        snippet = content[context_start:context_end]
        
        if context_start > 0:
            snippet = "..." + snippet
        if context_end < len(content):
            snippet = snippet + "..."
        
        import re
        page_matches = re.findall(r'\[第(\d+)页\]', content[:idx])
        page_num = int(page_matches[-1]) if page_matches else None
        
        results.append({
            "material_id": mat.id,
            "filename": mat.filename,
            "file_type": mat.file_type,
            "snippet": snippet,
            "page_num": page_num,
            "position": idx,
        })
    
    return {"query": keyword, "results": results[:20]}
