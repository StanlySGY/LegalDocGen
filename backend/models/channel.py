from sqlalchemy import Column, String, DateTime, Text, Integer, Boolean
import uuid

from backend.database import Base, utcnow


class Channel(Base):
    __tablename__ = "channels"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False, default="openai")  # openai / claude / custom
    base_url = Column(String(500), nullable=False)
    api_key = Column(String(500), default="")
    models = Column(Text, default="[]")  # JSON list of enabled model IDs
    default_model = Column(String(200), default="")
    status = Column(Integer, default=1)  # 1=enabled, 0=disabled
    test_status = Column(String(50), default="untested")  # untested / success / failed
    balance = Column(String(100), default="")
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
