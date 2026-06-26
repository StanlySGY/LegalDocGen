import json
import re
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.workflow import WorkflowNode, StageType, STAGE_ORDER, STAGE_NAMES
from backend.models.material import Material
from backend.models.case import Case, CaseStatus


class WorkflowEngine:
    def __init__(self, db: Session):
        self.db = db

    def get_case_nodes(self, case_id: str) -> list[WorkflowNode]:
        return (
            self.db.query(WorkflowNode)
            .filter(WorkflowNode.case_id == case_id, WorkflowNode.is_current == True)
            .all()
        )

    def get_stage_node(self, case_id: str, stage: StageType) -> Optional[WorkflowNode]:
        return (
            self.db.query(WorkflowNode)
            .filter(
                WorkflowNode.case_id == case_id,
                WorkflowNode.stage == stage.value,
                WorkflowNode.is_current == True,
            )
            .first()
        )

    def get_case_context(self, case_id: str) -> dict:
        materials = self.db.query(Material).filter(Material.case_id == case_id).all()
        material_catalog = self.get_material_catalog(case_id)
        materials_text = "\n\n".join(
            f"【材料{index}: {item['filename']}｜{item['citation']}】\n{item['excerpt']}"
            for index, item in enumerate(material_catalog, start=1)
            if item["excerpt"]
        )
        nodes = self.get_case_nodes(case_id)
        stage_outputs = {}
        for node in nodes:
            stage_outputs[node.stage] = node.output
        return {"materials": materials_text, "stage_outputs": stage_outputs, "material_catalog": material_catalog}

    def get_material_catalog(self, case_id: str) -> list[dict]:
        materials = self.db.query(Material).filter(Material.case_id == case_id).order_by(Material.created_at.asc()).all()
        return [self._material_summary(material) for material in materials]

    def get_fact_timeline(self, case_id: str) -> list[dict]:
        timeline = []
        for material in self.db.query(Material).filter(Material.case_id == case_id).all():
            if not material.parsed_content:
                continue
            sentences = re.split(r"[。；;\n]", material.parsed_content)
            for sentence in sentences:
                text = sentence.strip()
                if not text:
                    continue
                dates = re.findall(r"\d{4}[年/-]\d{1,2}(?:[月/-]\d{1,2}日?)?|\d{1,2}月\d{1,2}日", text)
                for date in dates:
                    timeline.append({"date": date, "event": text[:160], "source": material.filename})
        return timeline[:80]

    def _material_pages(self, material: Material) -> list[dict]:
        try:
            data = json.loads(material.structured_data or "{}")
        except json.JSONDecodeError:
            return []
        pages = data.get("pages", [])
        return pages if isinstance(pages, list) else []

    def _material_summary(self, material: Material) -> dict:
        content = material.parsed_content or ""
        compact = re.sub(r"\s+", " ", content).strip()
        pages = [page for page in self._material_pages(material) if str(page.get("text", "")).strip()]
        page_refs = [str(page.get("page")) for page in pages[:5] if page.get("page")]
        citation = f"页码：{', '.join(page_refs)}" if page_refs else "页码未识别"
        return {
            "id": material.id,
            "filename": material.filename,
            "file_type": material.file_type,
            "file_size": material.file_size,
            "parse_status": material.parse_status,
            "created_at": material.created_at.isoformat() if material.created_at else None,
            "excerpt": compact[:500],
            "word_count": len(content),
            "page_refs": page_refs,
            "citation": citation,
        }

    def create_or_update_node(
        self, case_id: str, stage: StageType, prompt: str, output: str, model_used: str
    ) -> WorkflowNode:
        existing = self.get_stage_node(case_id, stage)
        if existing:
            existing.is_current = False
            new_node = WorkflowNode(
                case_id=case_id,
                stage=stage.value,
                prompt=prompt,
                output=output,
                model_used=model_used,
                version=existing.version + 1,
                is_current=True,
                parent_version_id=existing.id,
                status="completed",
            )
            self.db.add(new_node)
        else:
            new_node = WorkflowNode(
                case_id=case_id,
                stage=stage.value,
                prompt=prompt,
                output=output,
                model_used=model_used,
                version=1,
                is_current=True,
                status="completed",
            )
            self.db.add(new_node)
        self.db.flush()
        self.sync_case_status(case_id)
        self.db.commit()
        self.db.refresh(new_node)
        return new_node

    def get_missing_previous_stages(self, case_id: str, current_stage: StageType) -> list[str]:
        current_idx = STAGE_ORDER.index(current_stage)
        missing = []
        for stage in STAGE_ORDER[:current_idx]:
            node = self.get_stage_node(case_id, stage)
            if not node or not node.output:
                missing.append(STAGE_NAMES[stage])
        return missing

    def get_missing_output_stages(self, case_id: str) -> list[str]:
        missing = []
        for stage in STAGE_ORDER:
            node = self.get_stage_node(case_id, stage)
            if not node or not node.output:
                missing.append(STAGE_NAMES[stage])
        return missing

    def sync_case_status(self, case_id: str):
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            return
        if not self.get_case_nodes(case_id):
            case.status = CaseStatus.DRAFT
        elif self.get_missing_output_stages(case_id):
            case.status = CaseStatus.IN_PROGRESS
        else:
            case.status = CaseStatus.COMPLETED

    def get_version_history(self, case_id: str, stage: StageType) -> list[WorkflowNode]:
        return (
            self.db.query(WorkflowNode)
            .filter(
                WorkflowNode.case_id == case_id,
                WorkflowNode.stage == stage.value,
            )
            .order_by(WorkflowNode.version.desc())
            .all()
        )

    def rollback_to_version(self, node_id: str) -> WorkflowNode:
        target = self.db.query(WorkflowNode).filter(WorkflowNode.id == node_id).first()
        if not target:
            raise ValueError("Node not found")
        current = self.get_stage_node(target.case_id, StageType(target.stage))
        if current:
            current.is_current = False
        target.is_current = True
        self.db.flush()
        self.sync_case_status(target.case_id)
        self.db.commit()
        self.db.refresh(target)
        return target

    def get_stage_progress(self, case_id: str) -> list[dict]:
        result = []
        for stage in STAGE_ORDER:
            node = self.get_stage_node(case_id, stage)
            result.append({
                "stage": stage.value,
                "name": STAGE_NAMES[stage],
                "status": node.status if node else "pending",
                "has_output": bool(node and node.output),
                "version": node.version if node else 0,
            })
        return result

    def get_previous_stages_output(self, case_id: str, current_stage: StageType) -> str:
        current_idx = STAGE_ORDER.index(current_stage)
        parts = []
        for i in range(current_idx):
            node = self.get_stage_node(case_id, STAGE_ORDER[i])
            if node and node.output:
                parts.append(f"## {STAGE_NAMES[STAGE_ORDER[i]]}\n{node.output}")
        return "\n\n".join(parts)
