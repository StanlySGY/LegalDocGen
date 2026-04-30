import json
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.material import Material
from backend.models.case import Case
from backend.config import settings
from backend.services.file_parser.parser import parse_file

router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.post("/upload/{case_id}")
async def upload_material(case_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "案件不存在")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"不支持的文件格式: {suffix}")

    case_dir = settings.UPLOAD_DIR / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    file_path = case_dir / file.filename

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    parsed_text = parse_file(file_path)

    material = Material(
        case_id=case_id,
        filename=file.filename,
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


@router.get("/case/{case_id}")
def list_materials(case_id: str, db: Session = Depends(get_db)):
    return db.query(Material).filter(Material.case_id == case_id).order_by(Material.created_at.desc()).all()


@router.get("/{material_id}")
def get_material(material_id: str, db: Session = Depends(get_db)):
    m = db.query(Material).filter(Material.id == material_id).first()
    if not m:
        raise HTTPException(404, "材料不存在")
    return m


@router.delete("/{material_id}")
def delete_material(material_id: str, db: Session = Depends(get_db)):
    m = db.query(Material).filter(Material.id == material_id).first()
    if not m:
        raise HTTPException(404, "材料不存在")
    try:
        Path(m.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    db.delete(m)
    db.commit()
    return {"message": "已删除"}
