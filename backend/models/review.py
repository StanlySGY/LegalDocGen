from sqlalchemy import Column, String, DateTime, Text
from datetime import datetime
import uuid

from backend.database import Base


class ReviewResult(Base):
    __tablename__ = "review_results"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String, nullable=False)
    review_mode = Column(String(50))
    step_outputs = Column(Text, default="{}")
    model_outputs = Column(Text, default="{}")
    selected_model = Column(String(200), default="")
    final_output = Column(Text, default="")
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
