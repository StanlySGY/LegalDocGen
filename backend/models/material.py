from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from backend.database import Base

EVIDENCE_CATEGORIES = {
    "identity": "诉讼主体材料",
    "contract": "核心法律依据",
    "evidence": "履约与侵权事实",
    "other": "辅助/其他程序材料",
}


class Material(Base):
    __tablename__ = "materials"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, default=0)
    parsed_content = Column(Text, default="")
    structured_data = Column(Text, default="{}")
    parse_task_id = Column(String(36), nullable=True)
    parse_status = Column(String(50), default="pending")
    category = Column(String(50), default="other")
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="materials")
