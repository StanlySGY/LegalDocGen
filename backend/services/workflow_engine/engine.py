import json
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.workflow import WorkflowNode, StageType, STAGE_ORDER, STAGE_NAMES
from backend.models.material import Material
from backend.models.case import Case


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
        materials_text = "\n\n".join(
            f"【{m.filename}】\n{m.parsed_content}" for m in materials if m.parsed_content
        )
        nodes = self.get_case_nodes(case_id)
        stage_outputs = {}
        for node in nodes:
            stage_outputs[node.stage] = node.output
        return {"materials": materials_text, "stage_outputs": stage_outputs}

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
        self.db.commit()
        self.db.refresh(new_node)
        return new_node

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
