from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

from backend.database import get_db
from backend.dependencies import assign_case_owner, case_query_for_user, get_accessible_case, get_current_user
from backend.models.case import Case, CaseStatus
from backend.models.billing import UsageMetric
from backend.models.case_template import CaseTemplate
from backend.models.deadline import CaseDeadline
from backend.models.case_note import CaseNote
from backend.models.user import User
from backend.exceptions import ForbiddenError, NotFoundError, ValidationError
from backend.services.audit_service import record_audit
from backend.services.billing_service import enforce_quota, record_usage

router = APIRouter(prefix="/api/cases", tags=["cases"])


class CaseCreate(BaseModel):
    name: str
    description: str = ""
    case_type: str = ""
    template_id: str = ""
    document_type: str = ""


class CaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    case_type: Optional[str] = None
    template_id: Optional[str] = None
    status: Optional[str] = None
    document_type: Optional[str] = None


class CaseBatchRequest(BaseModel):
    case_ids: list[str]


@router.post("")
def create_case(data: CaseCreate, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    template_id = data.template_id or None
    if template_id and not db.query(CaseTemplate).filter(CaseTemplate.id == template_id).first():
        raise HTTPException(404, "案件模板不存在")
    case = Case(
        name=data.name,
        description=data.description,
        case_type=data.case_type,
        template_id=template_id,
        document_type=data.document_type,
    )
    assign_case_owner(case, current_user, db)
    enforce_quota(db, case.team_id, UsageMetric.CASES)
    db.add(case)
    db.flush()
    record_usage(db, case.team_id, UsageMetric.CASES, "case", case.id)
    record_audit(db, "case.create", "case", case.id, f"创建案件：{case.name}")
    db.commit()
    db.refresh(case)
    return case


@router.get("")
def list_cases(
    status: str = "",
    keyword: str = "",
    case_type: str = "",
    template_id: str = "",
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    q = case_query_for_user(db, current_user)
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
def batch_delete_cases(data: CaseBatchRequest, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    if not data.case_ids:
        raise HTTPException(400, "请选择要删除的案件")
    cases = case_query_for_user(db, current_user).filter(Case.id.in_(data.case_ids)).all()
    if len(cases) != len(set(data.case_ids)):
        raise HTTPException(404, "部分案件不存在或无权访问")
    for case in cases:
        record_audit(db, "case.delete", "case", case.id, f"批量删除案件：{case.name}")
        db.delete(case)
    db.commit()
    return {"message": f"已删除 {len(cases)} 个案件", "deleted": len(cases)}


@router.get("/upcoming-deadlines")
def upcoming_deadlines(db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    case_ids = [c.id for c in case_query_for_user(db, current_user).all()]
    if not case_ids:
        return []
    cutoff = date.today() + timedelta(days=14)
    deadlines = (
        db.query(CaseDeadline)
        .filter(
            CaseDeadline.case_id.in_(case_ids),
            CaseDeadline.is_completed == False,
            CaseDeadline.due_date <= cutoff,
        )
        .order_by(CaseDeadline.due_date.asc())
        .all()
    )
    result = []
    case_map = {c.id: c.name for c in db.query(Case).filter(Case.id.in_(case_ids)).all()}
    for d in deadlines:
        days_left = (d.due_date - date.today()).days
        result.append({
            "id": d.id,
            "case_id": d.case_id,
            "case_name": case_map.get(d.case_id, ""),
            "title": d.title,
            "due_date": d.due_date.isoformat(),
            "days_left": days_left,
            "note": d.note,
        })
    return result


@router.get("/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    return get_accessible_case(db, case_id, current_user)


@router.put("/{case_id}")
def update_case(case_id: str, data: CaseUpdate, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    case = get_accessible_case(db, case_id, current_user)
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
def delete_case(case_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    case = get_accessible_case(db, case_id, current_user)
    record_audit(db, "case.delete", "case", case.id, f"删除案件：{case.name}")
    db.delete(case)
    db.commit()
    return {"message": "已删除"}


# --- Archive ---

class ArchiveRequest(BaseModel):
    note: str = ""


@router.post("/{case_id}/archive")
def archive_case(case_id: str, data: ArchiveRequest, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    case = get_accessible_case(db, case_id, current_user)
    if case.status == CaseStatus.ARCHIVED:
        raise ValidationError("案件已归档")
    from datetime import datetime
    case.status = CaseStatus.ARCHIVED
    case.archived_at = datetime.utcnow()
    case.archive_note = data.note
    record_audit(db, "case.archive", "case", case.id, f"归档案件：{case.name}")
    db.commit()
    db.refresh(case)
    return case


@router.post("/{case_id}/unarchive")
def unarchive_case(case_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    case = get_accessible_case(db, case_id, current_user)
    if case.status != CaseStatus.ARCHIVED:
        raise ValidationError("案件未处于归档状态")
    case.status = CaseStatus.COMPLETED
    case.archived_at = None
    case.archive_note = ""
    record_audit(db, "case.unarchive", "case", case.id, f"解归档案件：{case.name}")
    db.commit()
    db.refresh(case)
    return case


# --- Deadlines ---

class DeadlineCreate(BaseModel):
    title: str
    due_date: date
    reminder_days: int = 3
    note: str = ""


class DeadlineUpdate(BaseModel):
    title: Optional[str] = None
    due_date: Optional[date] = None
    reminder_days: Optional[int] = None
    note: Optional[str] = None
    is_completed: Optional[bool] = None


@router.get("/{case_id}/deadlines")
def list_deadlines(case_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    get_accessible_case(db, case_id, current_user)
    return db.query(CaseDeadline).filter(CaseDeadline.case_id == case_id).order_by(CaseDeadline.due_date.asc()).all()


@router.post("/{case_id}/deadlines")
def create_deadline(case_id: str, data: DeadlineCreate, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    case = get_accessible_case(db, case_id, current_user)
    if case.status == CaseStatus.ARCHIVED:
        raise ForbiddenError("案件已归档，无法添加期限")
    deadline = CaseDeadline(case_id=case_id, title=data.title, due_date=data.due_date, reminder_days=data.reminder_days, note=data.note)
    db.add(deadline)
    db.commit()
    db.refresh(deadline)
    return deadline


@router.put("/{case_id}/deadlines/{deadline_id}")
def update_deadline(case_id: str, deadline_id: str, data: DeadlineUpdate, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    get_accessible_case(db, case_id, current_user)
    deadline = db.query(CaseDeadline).filter(CaseDeadline.id == deadline_id, CaseDeadline.case_id == case_id).first()
    if not deadline:
        raise NotFoundError("期限不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(deadline, k, v)
    db.commit()
    db.refresh(deadline)
    return deadline


@router.delete("/{case_id}/deadlines/{deadline_id}")
def delete_deadline(case_id: str, deadline_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    get_accessible_case(db, case_id, current_user)
    deadline = db.query(CaseDeadline).filter(CaseDeadline.id == deadline_id, CaseDeadline.case_id == case_id).first()
    if not deadline:
        raise NotFoundError("期限不存在")
    db.delete(deadline)
    db.commit()
    return {"message": "已删除"}


# --- Notes ---

class NoteCreate(BaseModel):
    title: str = ""
    content: str = ""
    pinned: bool = False


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    pinned: Optional[bool] = None


@router.get("/{case_id}/notes")
def list_notes(case_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    get_accessible_case(db, case_id, current_user)
    return db.query(CaseNote).filter(CaseNote.case_id == case_id).order_by(CaseNote.pinned.desc(), CaseNote.created_at.desc()).all()


@router.post("/{case_id}/notes")
def create_note(case_id: str, data: NoteCreate, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    case = get_accessible_case(db, case_id, current_user)
    if case.status == CaseStatus.ARCHIVED:
        raise ForbiddenError("案件已归档，无法添加笔记")
    note = CaseNote(case_id=case_id, title=data.title, content=data.content, pinned=data.pinned)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/{case_id}/notes/{note_id}")
def update_note(case_id: str, note_id: str, data: NoteUpdate, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    get_accessible_case(db, case_id, current_user)
    note = db.query(CaseNote).filter(CaseNote.id == note_id, CaseNote.case_id == case_id).first()
    if not note:
        raise NotFoundError("笔记不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(note, k, v)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{case_id}/notes/{note_id}")
def delete_note(case_id: str, note_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    get_accessible_case(db, case_id, current_user)
    note = db.query(CaseNote).filter(CaseNote.id == note_id, CaseNote.case_id == case_id).first()
    if not note:
        raise NotFoundError("笔记不存在")
    db.delete(note)
    db.commit()
    return {"message": "已删除"}
