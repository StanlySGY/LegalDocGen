from sqlalchemy import Column, String, Text, Integer, DateTime, Boolean
import json

from backend.database import Base, utcnow

class CaseTemplate(Base):
    __tablename__ = "case_templates"

    id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    category = Column(String(50), nullable=False)
    materials_checklist = Column(Text)
    default_prompts = Column(Text)
    created_at = Column(DateTime, default=utcnow)
    is_default = Column(Boolean, default=False)

    def get_materials_checklist(self):
        return json.loads(self.materials_checklist) if self.materials_checklist else []

    def get_default_prompts(self):
        return json.loads(self.default_prompts) if self.default_prompts else {}
