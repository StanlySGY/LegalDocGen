from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.database import get_db
from backend.models.case import Case, CaseStatus

router = APIRouter(prefix="/api/cases", tags=["cases"])


class CaseCreate(BaseModel):
    name: str
    description: str = ""
    case_type: str = ""
    case_number: str = ""
    court: str = ""
    cause: str = ""
    filing_date: str = ""


class CaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    case_type: Optional[str] = None
    case_number: Optional[str] = None
    court: Optional[str] = None
    cause: Optional[str] = None
    filing_date: Optional[str] = None
    status: Optional[str] = None


@router.post("")
def create_case(data: CaseCreate, db: Session = Depends(get_db)):
    case = Case(**data.model_dump())
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


@router.get("")
def list_cases(status: str = "", search: str = "", case_type: str = "", db: Session = Depends(get_db)):
    q = db.query(Case)
    if status:
        q = q.filter(Case.status == status)
    if case_type:
        q = q.filter(Case.case_type == case_type)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            (Case.name.ilike(pattern)) |
            (Case.description.ilike(pattern)) |
            (Case.case_number.ilike(pattern)) |
            (Case.cause.ilike(pattern))
        )
    return q.order_by(Case.created_at.desc()).all()


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
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(case, k, v)
    db.commit()
    db.refresh(case)
    return case


@router.delete("/{case_id}")
def delete_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "案件不存在")
    db.delete(case)
    db.commit()
    return {"message": "已删除"}


class BatchDeleteRequest(BaseModel):
    ids: list[str]


@router.post("/batch-delete")
def batch_delete(req: BatchDeleteRequest, db: Session = Depends(get_db)):
    deleted = 0
    for cid in req.ids:
        case = db.query(Case).filter(Case.id == cid).first()
        if case:
            db.delete(case)
            deleted += 1
    db.commit()
    return {"message": f"已删除 {deleted} 个案件"}
