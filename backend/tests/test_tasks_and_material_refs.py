import json

from backend.models.material import Material
from backend.models.task import BackgroundTask, TaskStatus
from backend.services.task_service import complete_task, public_task, start_task
from backend.services.workflow_engine.engine import WorkflowEngine


def test_task_lifecycle_public_payload(db_session):
    task = start_task(db_session, "material.parse", "case-1", "解析材料")
    complete_task(db_session, task, '{"material_id":"m1"}', "完成")

    payload = public_task(task)

    assert payload["status"] == TaskStatus.COMPLETED
    assert payload["message"] == "完成"
    assert payload["result"] == '{"material_id":"m1"}'


def test_material_summary_includes_page_citation(db_session):
    material = Material(
        case_id="case-1",
        filename="证据.pdf",
        file_path="/tmp/evidence.pdf",
        file_type=".pdf",
        file_size=10,
        parsed_content="第一页事实\n第二页事实",
        structured_data=json.dumps({"pages": [{"page": 1, "text": "第一页事实"}, {"page": 2, "text": "第二页事实"}]}, ensure_ascii=False),
        parse_status="completed",
    )
    db_session.add(material)
    db_session.commit()

    summary = WorkflowEngine(db_session).get_material_catalog("case-1")[0]

    assert summary["page_refs"] == ["1", "2"]
    assert summary["citation"] == "页码：1, 2"
