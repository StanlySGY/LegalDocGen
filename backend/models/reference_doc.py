from sqlalchemy import Column, String, DateTime, Text
from datetime import datetime
import uuid

from backend.database import Base


class ReferenceDoc(Base):
    __tablename__ = "reference_docs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    doc_type = Column(String(100), default="")
    content = Column(Text, default="")
    file_path = Column(String(1000), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
