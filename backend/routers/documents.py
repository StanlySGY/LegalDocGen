from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db, utcnow
from backend.dependencies import get_accessible_case, get_current_user
from backend.exceptions import NotFoundError, ValidationError
from backend.models.case import Case
from backend.models.document import CaseDocument
from backend.models.user import User
from backend.services.audit_service import record_audit

router = APIRouter(prefix="/api/documents", tags=["documents"])

DOC_TYPES = {
    "complaint": "起诉状/仲裁申请书",
    "evidence_list": "证据清单",
    "opinion": "代理词/法律意见书",
    "defense": "答辩状",
    "other": "其他文书",
}


class CreateDocumentRequest(BaseModel):
    name: str
    doc_type: str = "complaint"


class UpdateDocumentRequest(BaseModel):
    name: Optional[str] = None
    doc_type: Optional[str] = None


@router.get("/case/{case_id}")
def list_documents(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    get_accessible_case(db, case_id, current_user)
    docs = (
        db.query(CaseDocument)
        .filter(CaseDocument.case_id == case_id)
        .order_by(CaseDocument.created_at.desc())
        .all()
    )
    return [doc.to_dict() for doc in docs]


@router.post("/case/{case_id}")
def create_document(
    case_id: str,
    req: CreateDocumentRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    get_accessible_case(db, case_id, current_user)

    if not req.name.strip():
        raise ValidationError("文书名称不能为空")

    if req.doc_type not in DOC_TYPES:
        raise ValidationError(f"无效的文书类型: {req.doc_type}")

    doc = CaseDocument(
        case_id=case_id,
        name=req.name.strip(),
        doc_type=req.doc_type,
        status="draft",
    )
    db.add(doc)
    record_audit(db, "document.create", "case", case_id, f"创建文书: {req.name}")
    db.commit()
    db.refresh(doc)
    return doc.to_dict()


@router.get("/{document_id}")
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    doc = db.query(CaseDocument).filter(CaseDocument.id == document_id).first()
    if not doc:
        raise NotFoundError("文书不存在")
    get_accessible_case(db, doc.case_id, current_user)
    return doc.to_dict()


@router.put("/{document_id}")
def update_document(
    document_id: str,
    req: UpdateDocumentRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    doc = db.query(CaseDocument).filter(CaseDocument.id == document_id).first()
    if not doc:
        raise NotFoundError("文书不存在")
    get_accessible_case(db, doc.case_id, current_user)

    if req.name is not None:
        if not req.name.strip():
            raise ValidationError("文书名称不能为空")
        doc.name = req.name.strip()

    if req.doc_type is not None:
        if req.doc_type not in DOC_TYPES:
            raise ValidationError(f"无效的文书类型: {req.doc_type}")
        doc.doc_type = req.doc_type

    record_audit(db, "document.update", "case", doc.case_id, f"更新文书: {doc.name}")
    db.commit()
    db.refresh(doc)
    return doc.to_dict()


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    doc = db.query(CaseDocument).filter(CaseDocument.id == document_id).first()
    if not doc:
        raise NotFoundError("文书不存在")
    get_accessible_case(db, doc.case_id, current_user)

    record_audit(db, "document.delete", "case", doc.case_id, f"删除文书: {doc.name}")
    db.delete(doc)
    db.commit()
    return {"message": "已删除"}


@router.get("/types")
def get_document_types():
    return DOC_TYPES


@router.post("/{document_id}/upload-final")
async def upload_final_version(
    document_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    doc = db.query(CaseDocument).filter(CaseDocument.id == document_id).first()
    if not doc:
        raise NotFoundError("文书不存在")
    get_accessible_case(db, doc.case_id, current_user)
    
    safe_name = Path(file.filename or "").name
    if not safe_name:
        raise ValidationError("文件名不能为空")
    
    suffix = Path(safe_name).suffix.lower()
    if suffix not in [".docx", ".doc"]:
        raise ValidationError("仅支持 Word 文档格式 (.docx, .doc)")
    
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise ValidationError("文件过大，最大支持 50MB")
    
    storage = get_storage()
    object_key = f"{doc.case_id}/documents/{doc.id}/final{suffix}"
    file_path = storage.save(object_key, content)
    
    doc.final_file_path = file_path
    doc.final_file_name = safe_name
    doc.final_uploaded_at = utcnow()
    doc.status = "finalized"
    
    record_audit(db, "document.upload_final", "case", doc.case_id, f"上传终版文书: {doc.name}")
    db.commit()
    db.refresh(doc)
    return doc.to_dict()


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    version: str = "final",
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    doc = db.query(CaseDocument).filter(CaseDocument.id == document_id).first()
    if not doc:
        raise NotFoundError("文书不存在")
    get_accessible_case(db, doc.case_id, current_user)
    
    if version == "final" and doc.final_file_path:
        file_path = doc.final_file_path
        file_name = doc.final_file_name or f"{doc.name}.docx"
    else:
        raise NotFoundError("未找到可下载的文件")
    
    from fastapi.responses import FileResponse
    return FileResponse(
        path=file_path,
        filename=file_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
