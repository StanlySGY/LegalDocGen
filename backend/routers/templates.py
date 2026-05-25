from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import json
import uuid

from backend.database import get_db
from backend.dependencies import require_admin
from backend.models.case_template import CaseTemplate

router = APIRouter(prefix="/api/templates", tags=["templates"])


class MaterialChecklistItem(BaseModel):
    name: str
    description: str
    required: bool = True


class PromptConfig(BaseModel):
    stage: str
    content: str


class CaseTemplateCreate(BaseModel):
    name: str
    description: str
    category: str
    materials_checklist: List[MaterialChecklistItem]
    default_prompts: dict


class CaseTemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    category: str
    materials_checklist: List[MaterialChecklistItem]
    default_prompts: dict
    is_default: bool
    created_at: str


@router.get("/categories")
def get_categories():
    return {
        "categories": [
            {"value": "contract", "label": "合同纠纷", "icon": "📋"},
            {"value": "labor", "label": "劳动争议", "icon": "👷"},
            {"value": "family", "label": "婚姻家庭", "icon": "👨‍👩‍👧"},
            {"value": "property", "label": "房产纠纷", "icon": "🏠"},
            {"value": "tort", "label": "侵权纠纷", "icon": "⚠️"},
            {"value": "commercial", "label": "商业纠纷", "icon": "🏢"},
            {"value": "administrative", "label": "行政纠纷", "icon": "🏛️"},
            {"value": "criminal", "label": "刑事案件", "icon": "⚖️"},
        ]
    }


@router.get("/list")
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(CaseTemplate).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "category": t.category,
            "materials_checklist": t.get_materials_checklist(),
            "default_prompts": t.get_default_prompts(),
            "is_default": t.is_default,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in templates
    ]


@router.get("/{template_id}")
def get_template(template_id: str, db: Session = Depends(get_db)):
    template = db.query(CaseTemplate).filter(CaseTemplate.id == template_id).first()
    if not template:
        raise HTTPException(404, "模板不存在")
    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "category": template.category,
        "materials_checklist": template.get_materials_checklist(),
        "default_prompts": template.get_default_prompts(),
        "is_default": template.is_default,
        "created_at": template.created_at.isoformat() if template.created_at else None,
    }


@router.post("/create", dependencies=[Depends(require_admin)])
def create_template(req: CaseTemplateCreate, db: Session = Depends(get_db)):
    template = CaseTemplate(
        id=str(uuid.uuid4()),
        name=req.name,
        description=req.description,
        category=req.category,
        materials_checklist=json.dumps([item.dict() for item in req.materials_checklist]),
        default_prompts=json.dumps(req.default_prompts),
        is_default=False,
    )
    db.add(template)
    db.commit()
    return {"id": template.id, "message": "模板已创建"}


@router.put("/{template_id}", dependencies=[Depends(require_admin)])
def update_template(template_id: str, req: CaseTemplateCreate, db: Session = Depends(get_db)):
    template = db.query(CaseTemplate).filter(CaseTemplate.id == template_id).first()
    if not template:
        raise HTTPException(404, "模板不存在")

    template.name = req.name
    template.description = req.description
    template.category = req.category
    template.materials_checklist = json.dumps([item.dict() for item in req.materials_checklist])
    template.default_prompts = json.dumps(req.default_prompts)
    db.commit()
    return {"message": "模板已更新"}


@router.delete("/{template_id}", dependencies=[Depends(require_admin)])
def delete_template(template_id: str, db: Session = Depends(get_db)):
    template = db.query(CaseTemplate).filter(CaseTemplate.id == template_id).first()
    if not template:
        raise HTTPException(404, "模板不存在")
    db.delete(template)
    db.commit()
    return {"message": "已删除"}
