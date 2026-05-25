from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.database import get_db
from backend.models.case import Case
from backend.models.case_template import CaseTemplate
from backend.services.audit_service import record_audit

router = APIRouter(prefix="/api/cases", tags=["cases"])


class CaseCreate(BaseModel):
    name: str
    description: str = ""
    case_type: str = ""
    template_id: str = ""


class CaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    case_type: Optional[str] = None
    template_id: Optional[str] = None
    status: Optional[str] = None


class CaseBatchRequest(BaseModel):
    case_ids: list[str]


@router.post("")
def create_case(data: CaseCreate, db: Session = Depends(get_db)):
    template_id = data.template_id or None
    if template_id and not db.query(CaseTemplate).filter(CaseTemplate.id == template_id).first():
        raise HTTPException(404, "案件模板不存在")
    case = Case(
        name=data.name,
        description=data.description,
        case_type=data.case_type,
        template_id=template_id,
    )
    db.add(case)
    db.flush()
    record_audit(db, "case.create", "case", case.id, f"创建案件：{case.name}")
    db.commit()
    db.refresh(case)
    return case


@router.get("")
def list_cases(status: str = "", keyword: str = "", case_type: str = "", template_id: str = "", db: Session = Depends(get_db)):
    q = db.query(Case)
    if status:
        q = q.filter(Case.status == status)
    if case_type:
        q = q.filter(Case.case_type == case_type)
    if template_id:
        q = q.filter(Case.template_id == template_id)
    if keyword:
        like = f"%{keyword.strip()}%"
        q = q.filter(or_(Case.name.ilike(like), Case.description.ilike(like), Case.case_type.ilike(like)))
    return q.order_by(Case.created_at.desc()).all()


@router.post("/batch-delete")
def batch_delete_cases(data: CaseBatchRequest, db: Session = Depends(get_db)):
    if not data.case_ids:
        raise HTTPException(400, "请选择要删除的案件")
    cases = db.query(Case).filter(Case.id.in_(data.case_ids)).all()
    if len(cases) != len(set(data.case_ids)):
        raise HTTPException(404, "部分案件不存在")
    for case in cases:
        record_audit(db, "case.delete", "case", case.id, f"批量删除案件：{case.name}")
        db.delete(case)
    db.commit()
    return {"message": f"已删除 {len(cases)} 个案件", "deleted": len(cases)}


@router.get("/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "案件不存在")
    return case


@router.put("/{case_id}")
def update_case(case_id: str, data: CaseUpdate, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "案件不存在")
    updates = data.model_dump(exclude_unset=True)
    if updates.get("template_id") == "":
        updates["template_id"] = None
    if updates.get("template_id") and not db.query(CaseTemplate).filter(CaseTemplate.id == updates["template_id"]).first():
        raise HTTPException(404, "案件模板不存在")
    for k, v in updates.items():
        setattr(case, k, v)
    record_audit(db, "case.update", "case", case.id, f"更新案件：{case.name}")
    db.commit()
    db.refresh(case)
    return case


@router.delete("/{case_id}")
def delete_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    record_audit(db, "case.delete", "case", case.id, f"删除案件：{case.name}")
    db.delete(case)
    db.commit()
    return {"message": "已删除"}
