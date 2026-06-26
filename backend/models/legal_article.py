from datetime import datetime
import uuid

from sqlalchemy import Column, DateTime, String, Text, UniqueConstraint

from backend.database import Base


class LegalArticle(Base):
    __tablename__ = "legal_articles"
    __table_args__ = (UniqueConstraint("law_name", "article_no", name="uq_legal_article"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    law_name = Column(String(200), nullable=False)
    article_no = Column(String(50), nullable=False)
    title = Column(String(200), default="")
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
