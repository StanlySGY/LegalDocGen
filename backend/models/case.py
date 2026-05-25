from sqlalchemy import Column, String, DateTime, Text, Enum as SAEnum, ForeignKey
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
    template_id = Column(String(36), ForeignKey("case_templates.id"), nullable=True)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    team_id = Column(String(36), ForeignKey("teams.id"), nullable=True)
    status = Column(SAEnum(CaseStatus), default=CaseStatus.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    materials = relationship("Material", back_populates="case", cascade="all, delete-orphan")
    workflow_nodes = relationship("WorkflowNode", back_populates="case", cascade="all, delete-orphan")
    template = relationship("CaseTemplate")
    owner = relationship("User", back_populates="cases")
    team = relationship("Team", back_populates="cases")
