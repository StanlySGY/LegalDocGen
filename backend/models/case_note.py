from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey
from datetime import datetime
import uuid

from backend.database import Base


class CaseNote(Base):
    __tablename__ = "case_notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), default="")
    content = Column(Text, default="")
    pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
