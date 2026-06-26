from sqlalchemy import Column, String, DateTime, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship
import uuid
import enum

from backend.database import Base, utcnow


class CaseStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


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
    document_type = Column(String(50), default="")
    archived_at = Column(DateTime, nullable=True)
    archive_note = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    materials = relationship(
        "Material", back_populates="case", cascade="all, delete-orphan"
    )
    documents = relationship(
        "CaseDocument", back_populates="case", cascade="all, delete-orphan"
    )
    workflow_nodes = relationship(
        "WorkflowNode", back_populates="case", cascade="all, delete-orphan"
    )
    template = relationship("CaseTemplate")
    owner = relationship("User", back_populates="cases")
    team = relationship("Team", back_populates="cases")
