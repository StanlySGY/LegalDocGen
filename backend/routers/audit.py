from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv, io

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


@router.get("/export", dependencies=[Depends(require_admin)])
def export_audit_logs(limit: int = 500, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(max(limit, 1), 2000)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["时间", "操作", "资源类型", "资源ID", "摘要"])
    for log in logs:
        writer.writerow([
            log.created_at.isoformat() if log.created_at else "",
            log.action, log.resource_type, log.resource_id, log.summary,
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )
