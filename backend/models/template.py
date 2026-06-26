from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime
import uuid

from backend.database import Base


class SavedTemplate(Base):
    __tablename__ = "saved_templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    document_type = Column(String(100), default="")
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
