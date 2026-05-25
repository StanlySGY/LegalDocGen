from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_accessible_case, get_current_user, require_admin
from backend.exceptions import NotFoundError
from backend.models.task import BackgroundTask
from backend.models.user import User
from backend.services.task_service import public_task

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", dependencies=[Depends(require_admin)])
def list_tasks(limit: int = 50, case_id: str = "", db: Session = Depends(get_db)):
    query = db.query(BackgroundTask)
    if case_id:
        query = query.filter(BackgroundTask.case_id == case_id)
    tasks = query.order_by(BackgroundTask.created_at.desc()).limit(min(limit, 200)).all()
    return [public_task(task) for task in tasks]


@router.get("/{task_id}")
def get_task(task_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)):
    task = db.query(BackgroundTask).filter(BackgroundTask.id == task_id).first()
    if not task:
        raise NotFoundError("任务不存在")
    if task.case_id:
        get_accessible_case(db, task.case_id, current_user)
    return public_task(task)
