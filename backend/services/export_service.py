from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from backend.models.case import Case
from backend.models.workflow import WorkflowNode, StageType, STAGE_NAMES
from backend.services.workflow_engine.engine import WorkflowEngine


class ExportService:
    def __init__(self, db: Session):
        self.db = db
        self.engine = WorkflowEngine(db)

    def export_to_word(self, case_id: str, filename: Optional[str] = None) -> bytes:
        """
        Export case workflow output to Word document
        """
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise ValueError(f"Case {case_id} not found")

        doc = Document()

        # Add title
        title = doc.add_heading(case.name, level=1)
        title.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

        # Add case info
        info_table = doc.add_table(rows=4, cols=2)
        info_table.style = 'Light Grid Accent 1'

        info_data = [
            ("案件ID", case.id),
            ("案件类型", case.case_type or "未分类"),
            ("案件状态", self._get_status_text(case.status)),
            ("生成时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        ]

        for i, (label, value) in enumerate(info_data):
            info_table.rows[i].cells[0].text = label
            info_table.rows[i].cells[1].text = str(value)

        if case.description:
            doc.add_heading("案件描述", level=2)
            doc.add_paragraph(case.description)

        # Add workflow outputs
        doc.add_heading("工作流输出", level=2)

        for stage_type in [
            StageType.FACT_EXTRACTION,
            StageType.LEGAL_ANALYSIS,
            StageType.DISPUTE_FOCUS,
            StageType.DRAFT_GENERATION,
            StageType.REVIEW_OPTIMIZATION,
        ]:
            node = self.engine.get_stage_node(case_id, stage_type)
            if node and node.output:
                stage_name = STAGE_NAMES.get(stage_type, stage_type.value)
                doc.add_heading(stage_name, level=3)

                # Add output content
                doc.add_paragraph(node.output)

                # Add metadata
                meta_para = doc.add_paragraph()
                meta_para.add_run(f"模型: {node.model_used or '未记录'} | ").font.size = Pt(9)
                meta_para.add_run(f"版本: {node.version} | ").font.size = Pt(9)
                meta_para.add_run(f"生成时间: {node.created_at.strftime('%Y-%m-%d %H:%M:%S') if node.created_at else '未记录'}").font.size = Pt(9)

                for run in meta_para.runs:
                    run.font.color.rgb = RGBColor(128, 128, 128)

        # Add footer
        doc.add_paragraph()
        footer = doc.add_paragraph("本文档由 LegalDocGen 自动生成")
        footer.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
        for run in footer.runs:
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(128, 128, 128)

        # Save to bytes
        from io import BytesIO
        output = BytesIO()
        doc.save(output)
        output.seek(0)
        return output.getvalue()

    def _get_status_text(self, status: str) -> str:
        status_map = {
            "draft": "草稿",
            "in_progress": "进行中",
            "completed": "已完成",
        }
        return status_map.get(status, status)
