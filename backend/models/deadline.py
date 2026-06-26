from sqlalchemy import Column, String, Date, DateTime, Integer, Boolean, Text, ForeignKey
from datetime import date
import uuid

from backend.database import Base


class CaseDeadline(Base):
    __tablename__ = "case_deadlines"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    due_date = Column(Date, nullable=False)
    reminder_days = Column(Integer, default=3)
    note = Column(Text, default="")
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
