import uuid

from sqlalchemy import Column, DateTime, String, Text

from backend.database import Base, utcnow


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action = Column(String(80), nullable=False)
    resource_type = Column(String(80), default="")
    resource_id = Column(String, default="")
    summary = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)
