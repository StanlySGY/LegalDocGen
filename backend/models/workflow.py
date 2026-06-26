from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer, Boolean
from sqlalchemy.orm import relationship
import uuid
import enum

from backend.database import Base, utcnow


class StageType(str, enum.Enum):
    FACT_EXTRACTION = "fact_extraction"
    LEGAL_ANALYSIS = "legal_analysis"
    DISPUTE_FOCUS = "dispute_focus"
    DRAFT_GENERATION = "draft_generation"
    REVIEW_OPTIMIZATION = "review_optimization"


STAGE_ORDER = [
    StageType.FACT_EXTRACTION,
    StageType.LEGAL_ANALYSIS,
    StageType.DISPUTE_FOCUS,
    StageType.DRAFT_GENERATION,
    StageType.REVIEW_OPTIMIZATION,
]

STAGE_NAMES = {
    StageType.FACT_EXTRACTION: "案件要素提取",
    StageType.LEGAL_ANALYSIS: "法律关系分析",
    StageType.DISPUTE_FOCUS: "争议焦点整理",
    StageType.DRAFT_GENERATION: "文书初稿生成",
    StageType.REVIEW_OPTIMIZATION: "审查与优化",
}


class WorkflowNode(Base):
    __tablename__ = "workflow_nodes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    document_id = Column(String, ForeignKey("case_documents.id"), nullable=True)
    stage = Column(String(50), nullable=False)
    prompt = Column(Text, default="")
    output = Column(Text, default="")
    model_used = Column(String(100), default="")
    version = Column(Integer, default=1)
    is_current = Column(Boolean, default=True)
    parent_version_id = Column(String, ForeignKey("workflow_nodes.id"), nullable=True)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    case = relationship("Case", back_populates="workflow_nodes")
    document = relationship("CaseDocument", back_populates="workflow_nodes")
    children = relationship("WorkflowNode", backref="parent", remote_side=[id])

    def create_new_version(self):
        return WorkflowNode(
            case_id=self.case_id,
            document_id=self.document_id,
            stage=self.stage,
            prompt=self.prompt,
            output="",
            version=self.version + 1,
            is_current=True,
            parent_version_id=self.id,
            status="pending",
        )
