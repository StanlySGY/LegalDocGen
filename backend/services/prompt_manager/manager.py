import json
from sqlalchemy.orm import Session
from backend.models.prompt import PromptTemplate
from backend.models.workflow import StageType, STAGE_NAMES
from backend.services.workflow_engine.stages import STAGE_PROMPTS


class PromptManager:
    def __init__(self, db: Session):
        self.db = db

    def init_default_templates(self):
        for stage, content in STAGE_PROMPTS.items():
            existing = (
                self.db.query(PromptTemplate)
                .filter(PromptTemplate.stage == stage.value, PromptTemplate.is_default == True)
                .first()
            )
            if not existing:
                self.db.add(
                    PromptTemplate(
                        stage=stage.value,
                        name=f"{STAGE_NAMES[stage]}-默认模板",
                        content=content,
                        is_default=True,
                    )
                )
        self.db.commit()

    def get_prompt(self, stage: StageType, template_id: str = "") -> str:
        if template_id:
            tpl = self.db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
            if tpl:
                return tpl.content
        tpl = (
            self.db.query(PromptTemplate)
            .filter(PromptTemplate.stage == stage.value, PromptTemplate.is_default == True)
            .first()
        )
        if tpl:
            return tpl.content
        return STAGE_PROMPTS.get(stage, "")

    def list_templates(self, stage: str = "") -> list[PromptTemplate]:
        q = self.db.query(PromptTemplate)
        if stage:
            q = q.filter(PromptTemplate.stage == stage)
        return q.order_by(PromptTemplate.created_at.desc()).all()

    def save_template(self, stage: str, name: str, content: str) -> PromptTemplate:
        tpl = PromptTemplate(stage=stage, name=name, content=content, is_default=False)
        self.db.add(tpl)
        self.db.commit()
        self.db.refresh(tpl)
        return tpl

    def update_template(self, template_id: str, content: str, name: str = "") -> PromptTemplate:
        tpl = self.db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
        if not tpl:
            raise ValueError("Template not found")
        tpl.content = content
        if name:
            tpl.name = name
        self.db.commit()
        self.db.refresh(tpl)
        return tpl
