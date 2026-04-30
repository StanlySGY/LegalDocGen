from sqlalchemy import Column, String, DateTime, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from backend.database import Base


class CaseStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    case_type = Column(String(100), default="")
    status = Column(SAEnum(CaseStatus), default=CaseStatus.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    materials = relationship("Material", back_populates="case", cascade="all, delete-orphan")
    workflow_nodes = relationship("WorkflowNode", back_populates="case", cascade="all, delete-orphan")
