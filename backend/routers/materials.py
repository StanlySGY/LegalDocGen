import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.dependencies import get_accessible_case, get_current_user
from backend.exceptions import NotFoundError, ValidationError, InternalServerError
from backend.models.material import Material
from backend.models.user import User
from backend.services.audit_service import record_audit
from backend.services.file_parser.parser import parse_file

router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.post("/upload/{case_id}")
async def upload_material(
    case_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    get_accessible_case(db, case_id, current_user)

    safe_name = Path(file.filename or "").name
    if not safe_name:
        raise ValidationError("文件名不能为空")

    suffix = Path(safe_name).suffix.lower()
    if suffix not in settings.ALLOWED_EXTENSIONS:
        raise ValidationError(f"不支持的文件格式: {suffix}。支持的格式: {', '.join(settings.ALLOWED_EXTENSIONS)}")

    if file.size and file.size > settings.MAX_FILE_SIZE:
        raise ValidationError(f"文件过大，最大支持 {settings.MAX_FILE_SIZE / 1024 / 1024:.0f}MB")

    case_dir = settings.UPLOAD_DIR / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    file_path = case_dir / f"{uuid.uuid4().hex}{suffix}"

    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        parsed_text = parse_file(file_path)

        material = Material(
            case_id=case_id,
            filename=safe_name,
            file_path=str(file_path),
            file_type=suffix,
            file_size=len(content),
            parsed_content=parsed_text,
            parse_status="completed" if not parsed_text.startswith("[") else "error",
        )
        db.add(material)
        db.flush()
        record_audit(db, "material.upload", "case", case_id, f"上传材料：{safe_name}")
        db.commit()
        db.refresh(material)
        return material
    except Exception as e:
        if file_path.exists():
            file_path.unlink(missing_ok=True)
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


@router.get("/{material_id}")
def get_material(material_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise NotFoundError(f"材料 {material_id} 不存在")
    get_accessible_case(db, material.case_id, current_user)
    return material


@router.delete("/{material_id}")
def delete_material(material_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise NotFoundError(f"材料 {material_id} 不存在")
    get_accessible_case(db, material.case_id, current_user)
    try:
        Path(material.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    record_audit(db, "material.delete", "case", material.case_id, f"删除材料：{material.filename}")
    db.delete(material)
    db.commit()
    return {"message": "已删除"}
