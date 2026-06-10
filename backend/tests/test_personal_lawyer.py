from datetime import date, timedelta

import pytest

from backend.exceptions import ForbiddenError, ValidationError
from backend.models.case import Case, CaseStatus
from backend.models.workflow import StageType, WorkflowNode
from backend.routers.cases import (
    ArchiveRequest,
    DeadlineCreate,
    DeadlineUpdate,
    NoteCreate,
    NoteUpdate,
    archive_case,
    create_deadline,
    create_note,
    list_deadlines,
    list_notes,
    unarchive_case,
    update_deadline,
    update_note,
    upcoming_deadlines,
)
from backend.services.export_service import ExportService
from backend.services.workflow_engine.stages import DRAFT_PROMPTS, STAGE_PROMPTS, get_draft_prompt


def _make_case(db, **kwargs) -> Case:
    case = Case(name=kwargs.pop("name", "测试案件"), **kwargs)
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


# --- 归档 ---

def test_archive_then_unarchive_case(db_session):
    case = _make_case(db_session)

    archived = archive_case(case.id, ArchiveRequest(note="结案归档"), db_session, None)
    assert archived.status == CaseStatus.ARCHIVED
    assert archived.archived_at is not None
    assert archived.archive_note == "结案归档"

    restored = unarchive_case(case.id, db_session, None)
    assert restored.status == CaseStatus.COMPLETED
    assert restored.archived_at is None
    assert restored.archive_note == ""


def test_archive_twice_rejected(db_session):
    case = _make_case(db_session, status=CaseStatus.ARCHIVED)
    with pytest.raises(ValidationError):
        archive_case(case.id, ArchiveRequest(), db_session, None)


def test_unarchive_non_archived_rejected(db_session):
    case = _make_case(db_session)
    with pytest.raises(ValidationError):
        unarchive_case(case.id, db_session, None)


def test_archived_case_blocks_write_operations(db_session):
    case = _make_case(db_session, status=CaseStatus.ARCHIVED)

    with pytest.raises(ForbiddenError):
        create_deadline(case.id, DeadlineCreate(title="开庭", due_date=date.today()), db_session, None)
    with pytest.raises(ForbiddenError):
        create_note(case.id, NoteCreate(content="笔记"), db_session, None)


# --- 期限 ---

def test_deadline_crud(db_session):
    case = _make_case(db_session)

    created = create_deadline(case.id, DeadlineCreate(title="提交答辩", due_date=date.today() + timedelta(days=5), note="别忘了"), db_session, None)
    assert created.title == "提交答辩"
    assert created.is_completed is False

    listed = list_deadlines(case.id, db_session, None)
    assert len(listed) == 1

    updated = update_deadline(case.id, created.id, DeadlineUpdate(is_completed=True), db_session, None)
    assert updated.is_completed is True


def test_upcoming_deadlines_filters_window_and_completed(db_session):
    case = _make_case(db_session)
    create_deadline(case.id, DeadlineCreate(title="近期", due_date=date.today() + timedelta(days=3)), db_session, None)
    create_deadline(case.id, DeadlineCreate(title="远期", due_date=date.today() + timedelta(days=30)), db_session, None)
    done = create_deadline(case.id, DeadlineCreate(title="已完成", due_date=date.today() + timedelta(days=2)), db_session, None)
    update_deadline(case.id, done.id, DeadlineUpdate(is_completed=True), db_session, None)

    result = upcoming_deadlines(db_session, None)

    titles = [d["title"] for d in result]
    assert titles == ["近期"]
    assert result[0]["case_name"] == case.name
    assert result[0]["days_left"] == 3


# --- 笔记 ---

def test_note_crud_and_pin_ordering(db_session):
    case = _make_case(db_session)

    first = create_note(case.id, NoteCreate(title="普通笔记", content="内容一"), db_session, None)
    second = create_note(case.id, NoteCreate(title="重点笔记", content="内容二", pinned=True), db_session, None)

    update_note(case.id, first.id, NoteUpdate(content="改后内容"), db_session, None)

    listed = list_notes(case.id, db_session, None)
    assert listed[0].id == second.id  # 置顶优先
    assert next(n for n in listed if n.id == first.id).content == "改后内容"


# --- 文书类型 prompt ---

def test_get_draft_prompt_returns_specialized_template():
    for doc_type in DRAFT_PROMPTS:
        assert get_draft_prompt(doc_type) == DRAFT_PROMPTS[doc_type]


def test_get_draft_prompt_falls_back_to_default():
    assert get_draft_prompt("") == STAGE_PROMPTS[StageType.DRAFT_GENERATION]
    assert get_draft_prompt("unknown_type") == STAGE_PROMPTS[StageType.DRAFT_GENERATION]


# --- 案件包导出 ---

def test_export_case_package_contains_core_documents(db_session):
    import zipfile
    from io import BytesIO

    case = _make_case(db_session, name="借贷纠纷", case_type="民间借贷", document_type="complaint")
    for stage in [StageType.FACT_EXTRACTION, StageType.DRAFT_GENERATION, StageType.REVIEW_OPTIMIZATION]:
        db_session.add(WorkflowNode(case_id=case.id, stage=stage.value, output=f"{stage.value} 输出 《民法典》第 1 条", is_current=True, status="completed"))
    db_session.commit()

    content = ExportService(db_session).export_case_package(case.id)

    with zipfile.ZipFile(BytesIO(content)) as archive:
        names = archive.namelist()
        assert "document.docx" in names
        assert "案件信息.txt" in names
        assert "法条引用清单.txt" in names
        assert any(n.startswith("analysis/") for n in names)
        legal_refs = archive.read("法条引用清单.txt").decode("utf-8")
        assert "《民法典》第 1 条" in legal_refs
