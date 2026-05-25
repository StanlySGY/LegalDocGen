import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.material import Material
from backend.models.case import Case
from backend.config import settings
from backend.services.file_parser.parser import parse_file
from backend.exceptions import NotFoundError, ValidationError, InternalServerError

router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.post("/upload/{case_id}")
async def upload_material(case_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise NotFoundError(f"案件 {case_id} 不存在")

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
        db.commit()
        db.refresh(material)
        return material
    except Exception as e:
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        raise InternalServerError(f"文件上传失败: {str(e)}")


@router.get("/case/{case_id}")
def list_materials(case_id: str, db: Session = Depends(get_db)):
    return db.query(Material).filter(Material.case_id == case_id).order_by(Material.created_at.desc()).all()


@router.get("/case/{case_id}/catalog")
def get_material_catalog(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise NotFoundError(f"案件 {case_id} 不存在")
    from backend.services.workflow_engine.engine import WorkflowEngine
    engine = WorkflowEngine(db)
    return {
        "catalog": engine.get_material_catalog(case_id),
        "timeline": engine.get_fact_timeline(case_id),
    }


@router.get("/{material_id}")
def get_material(material_id: str, db: Session = Depends(get_db)):
    m = db.query(Material).filter(Material.id == material_id).first()
    if not m:
        raise NotFoundError(f"材料 {material_id} 不存在")
    return m


@router.delete("/{material_id}")
def delete_material(material_id: str, db: Session = Depends(get_db)):
    m = db.query(Material).filter(Material.id == material_id).first()
    if not m:
        raise NotFoundError(f"材料 {material_id} 不存在")
    try:
        Path(m.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    db.delete(m)
    db.commit()
    return {"message": "已删除"}
