from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.database import get_db
from backend.models.reference_doc import ReferenceDoc
from backend.services.file_parser.parser import parse_file
from pathlib import Path
from backend.config import settings
import uuid

router = APIRouter(prefix="/api/reference-docs", tags=["reference_docs"])


class RefDocCreate(BaseModel):
    name: str
    doc_type: str = ""
    content: str = ""


@router.get("")
def list_ref_docs(db: Session = Depends(get_db)):
    docs = db.query(ReferenceDoc).order_by(ReferenceDoc.created_at.desc()).all()
    return [
        {"id": d.id, "name": d.name, "doc_type": d.doc_type,
         "content_length": len(d.content) if d.content else 0,
         "created_at": d.created_at.isoformat() if d.created_at else None}
        for d in docs
    ]


@router.post("")
def create_ref_doc(data: RefDocCreate, db: Session = Depends(get_db)):
    doc = ReferenceDoc(name=data.name, doc_type=data.doc_type, content=data.content)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "name": doc.name}


@router.post("/upload")
async def upload_ref_doc(file: UploadFile = File(...), db: Session = Depends(get_db)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in {'.pdf', '.doc', '.docx', '.txt'}:
        raise HTTPException(400, f"不支持的格式: {suffix}")

    ref_dir = settings.UPLOAD_DIR / "reference_docs"
    ref_dir.mkdir(parents=True, exist_ok=True)
    file_path = ref_dir / f"{uuid.uuid4()}{suffix}"

    content = await file.read()
    with open(file_path, 'wb') as f:
        f.write(content)

    parsed = parse_file(file_path)

    doc = ReferenceDoc(
        name=file.filename,
        doc_type="",
        content=parsed,
        file_path=str(file_path),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "name": doc.name, "content_length": len(parsed)}


@router.get("/{doc_id}")
def get_ref_doc(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(ReferenceDoc).filter(ReferenceDoc.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "文档不存在")
    return {"id": doc.id, "name": doc.name, "doc_type": doc.doc_type, "content": doc.content}


@router.delete("/{doc_id}")
def delete_ref_doc(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(ReferenceDoc).filter(ReferenceDoc.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "文档不存在")
    db.delete(doc)
    db.commit()
    return {"message": "已删除"}
