from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from backend.database import Base


class CaseDocument(Base):
    __tablename__ = "case_documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    name = Column(String(200), nullable=False)
    doc_type = Column(String(50), default="complaint")
    status = Column(String(50), default="draft")
    final_file_path = Column(String(1000), nullable=True)
    final_file_name = Column(String(500), nullable=True)
    final_uploaded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="documents")
    workflow_nodes = relationship(
        "WorkflowNode", back_populates="document", lazy="dynamic"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "case_id": self.case_id,
            "name": self.name,
            "doc_type": self.doc_type,
            "status": self.status,
            "has_final_file": bool(self.final_file_path),
            "final_file_name": self.final_file_name,
            "final_uploaded_at": (
                self.final_uploaded_at.isoformat() if self.final_uploaded_at else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
