from typing import Optional

from sqlalchemy.orm import Session

from backend.database import utcnow
from backend.models.task import BackgroundTask, TaskStatus


def start_task(db: Session, task_type: str, case_id: Optional[str] = None, message: str = "") -> BackgroundTask:
    task = BackgroundTask(case_id=case_id, task_type=task_type, status=TaskStatus.RUNNING, message=message, started_at=utcnow())
    db.add(task)
    db.flush()
    return task


def complete_task(db: Session, task: BackgroundTask, result: str = "{}", message: str = "") -> BackgroundTask:
    task.status = TaskStatus.COMPLETED
    task.result = result
    task.message = message or task.message
    task.completed_at = utcnow()
    db.flush()
    return task


def fail_task(db: Session, task: BackgroundTask, error: str) -> BackgroundTask:
    task.status = TaskStatus.FAILED
    task.error = error
    task.completed_at = utcnow()
    db.flush()
    return task


def public_task(task: BackgroundTask) -> dict:
    return {
        "id": task.id,
        "case_id": task.case_id,
        "task_type": task.task_type,
        "status": task.status,
        "message": task.message,
        "result": task.result,
        "error": task.error,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }
