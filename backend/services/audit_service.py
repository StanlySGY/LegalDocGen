from sqlalchemy.orm import Session

from backend.models.audit import AuditLog


def record_audit(db: Session, action: str, resource_type: str = "", resource_id: str = "", summary: str = ""):
    log = AuditLog(
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        summary=summary[:1000],
    )
    db.add(log)
    return log
