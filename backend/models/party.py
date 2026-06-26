from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from datetime import datetime
import uuid

from backend.database import Base


class Party(Base):
    __tablename__ = "parties"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    name = Column(String(200), nullable=False)
    role = Column(String(100), default="")
    id_number = Column(String(100), default="")
    address = Column(String(500), default="")
    phone = Column(String(50), default="")
    legal_representative = Column(String(200), default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
