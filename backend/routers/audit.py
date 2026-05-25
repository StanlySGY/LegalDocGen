from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import require_admin
from backend.models.audit import AuditLog

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", dependencies=[Depends(require_admin)])
def list_audit_logs(limit: int = 100, resource_type: str = "", resource_id: str = "", db: Session = Depends(get_db)):
    query = db.query(AuditLog)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.filter(AuditLog.resource_id == resource_id)
    logs = query.order_by(AuditLog.created_at.desc()).limit(min(max(limit, 1), 500)).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "summary": log.summary,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
