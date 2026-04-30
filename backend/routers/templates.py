from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend.models.template import SavedTemplate

router = APIRouter(prefix="/api/templates", tags=["templates"])


class TemplateCreate(BaseModel):
    name: str
    document_type: str = ""
    content: str


@router.get("")
def list_templates(document_type: str = "", db: Session = Depends(get_db)):
    q = db.query(SavedTemplate)
    if document_type:
        q = q.filter(SavedTemplate.document_type == document_type)
    return q.order_by(SavedTemplate.created_at.desc()).all()


@router.post("")
def create_template(data: TemplateCreate, db: Session = Depends(get_db)):
    tpl = SavedTemplate(**data.model_dump())
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.get("/{template_id}")
def get_template(template_id: str, db: Session = Depends(get_db)):
    tpl = db.query(SavedTemplate).filter(SavedTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(404, "模板不存在")
    return tpl


@router.delete("/{template_id}")
def delete_template(template_id: str, db: Session = Depends(get_db)):
    tpl = db.query(SavedTemplate).filter(SavedTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(404, "模板不存在")
    db.delete(tpl)
    db.commit()
    return {"message": "已删除"}
