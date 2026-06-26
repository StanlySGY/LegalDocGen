from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey
import uuid

from backend.database import Base, utcnow


class CaseNote(Base):
    __tablename__ = "case_notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), default="")
    content = Column(Text, default="")
    pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
