from sqlalchemy.orm import Session
from backend.models.prompt import PromptTemplate
from backend.models.case_template import CaseTemplate
from backend.models.workflow import StageType, STAGE_NAMES
from backend.services.workflow_engine.stages import STAGE_PROMPTS, DOCUMENT_TYPE_PROMPTS, DOCUMENT_TYPES


class PromptManager:
    def __init__(self, db: Session):
        self.db = db

    def init_default_templates(self):
        for stage, content in STAGE_PROMPTS.items():
            existing = (
                self.db.query(PromptTemplate)
                .filter(PromptTemplate.stage == stage.value, PromptTemplate.is_default == True,
                        PromptTemplate.document_type == "")
                .first()
            )
            if not existing:
                self.db.add(
                    PromptTemplate(
                        stage=stage.value,
                        name=f"{STAGE_NAMES[stage]}-默认模板",
                        content=content,
                        is_default=True,
                        document_type="",
                    )
                )
        for doc_type, prompts in DOCUMENT_TYPE_PROMPTS.items():
            doc_name = DOCUMENT_TYPES.get(doc_type, {}).get("name", doc_type)
            for stage_key, content in prompts.items():
                existing = (
                    self.db.query(PromptTemplate)
                    .filter(PromptTemplate.stage == stage_key, PromptTemplate.document_type == doc_type,
                            PromptTemplate.is_default == True)
                    .first()
                )
                if not existing:
                    stage_name = STAGE_NAMES.get(StageType(stage_key), stage_key)
                    self.db.add(
                        PromptTemplate(
                            stage=stage_key,
                            name=f"{doc_name}-{stage_name}",
                            content=content,
                            is_default=True,
                            document_type=doc_type,
                        )
                    )
        self.db.commit()

    def get_prompt(self, stage: StageType, template_id: str = "", document_type: str = "") -> str:
        if template_id:
            case_template = self.db.query(CaseTemplate).filter(CaseTemplate.id == template_id).first()
            if case_template:
                prompts = case_template.get_default_prompts()
                template_prompt = prompts.get(stage.value)
                if template_prompt:
                    return template_prompt
            tpl = self.db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
            if tpl:
                return tpl.content
        if document_type:
            tpl = (
                self.db.query(PromptTemplate)
                .filter(PromptTemplate.stage == stage.value, PromptTemplate.document_type == document_type,
                        PromptTemplate.is_default == True)
                .first()
            )
            if tpl:
                return tpl.content
        tpl = (
            self.db.query(PromptTemplate)
            .filter(PromptTemplate.stage == stage.value, PromptTemplate.is_default == True,
                    PromptTemplate.document_type == "")
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

    def save_template(self, stage: str, name: str, content: str, document_type: str = "") -> PromptTemplate:
        tpl = PromptTemplate(stage=stage, name=name, content=content, is_default=False, document_type=document_type)
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
