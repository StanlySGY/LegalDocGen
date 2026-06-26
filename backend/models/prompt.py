from sqlalchemy import Column, String, DateTime, Text, Integer, Boolean
import uuid

from backend.database import Base, utcnow


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    stage = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(Integer, default=1)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
