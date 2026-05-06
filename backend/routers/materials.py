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


@router.post("/anonymize/{case_id}")
async def anonymize_materials(case_id: str, db: Session = Depends(get_db)):
    """Anonymize all materials for a case using party names from the case."""
    from backend.services.anonymizer.anonymizer import Anonymizer
    from backend.models.party import Party
    from backend.models.material import Material
    import json
    
    materials = db.query(Material).filter(Material.case_id == case_id).all()
    if not materials:
        raise HTTPException(400, "无材料可脱敏")
    
    # Get party names for replacement
    parties = db.query(Party).filter(Party.case_id == case_id).all()
    party_names = [p.name for p in parties if p.name]
    
    anonymizer = Anonymizer()
    results = []
    for m in materials:
        if getattr(m, 'parsed_content', None):
            anonymized, mapping = anonymizer.anonymize(m.parsed_content, party_names)
            # Store anonymized content and mapping
            m.parsed_content_masked = anonymized
            m.anonymize_mapping = json.dumps(mapping, ensure_ascii=False)
            results.append({"id": m.id, "filename": m.filename, "anonymized": True})
    
    db.commit()
    return {"message": f"已脱敏 {len(results)} 份材料", "materials": results}
