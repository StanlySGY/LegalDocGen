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


class CaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    case_type: Optional[str] = None
    status: Optional[str] = None


@router.post("")
def create_case(data: CaseCreate, db: Session = Depends(get_db)):
    case = Case(name=data.name, description=data.description, case_type=data.case_type)
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


@router.get("")
def list_cases(status: str = "", db: Session = Depends(get_db)):
    q = db.query(Case)
    if status:
        q = q.filter(Case.status == status)
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
