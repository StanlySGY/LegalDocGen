from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import require_admin
from backend.exceptions import NotFoundError, ValidationError
from backend.models.legal_article import LegalArticle
from backend.services.audit_service import record_audit
from backend.services.legal_article_service import public_article, verify_article_refs

router = APIRouter(prefix="/api/legal-articles", tags=["legal-articles"])


class LegalArticleRequest(BaseModel):
    law_name: str
    article_no: str
    title: str = ""
    content: str = ""


class VerifyRequest(BaseModel):
    text: str


@router.get("")
def list_articles(keyword: str = "", db: Session = Depends(get_db)):
    query = db.query(LegalArticle)
    if keyword.strip():
        like = f"%{keyword.strip()}%"
        query = query.filter((LegalArticle.law_name.ilike(like)) | (LegalArticle.content.ilike(like)))
    return [public_article(article) for article in query.order_by(LegalArticle.law_name.asc(), LegalArticle.article_no.asc()).limit(200).all()]


@router.post("", dependencies=[Depends(require_admin)])
def create_article(req: LegalArticleRequest, db: Session = Depends(get_db)):
    law_name = req.law_name.strip()
    article_no = req.article_no.strip()
    if not law_name or not article_no:
        raise ValidationError("法律名称和条号不能为空")
    article = db.query(LegalArticle).filter(LegalArticle.law_name == law_name, LegalArticle.article_no == article_no).first()
    if not article:
        article = LegalArticle(law_name=law_name, article_no=article_no)
        db.add(article)
    article.title = req.title.strip()
    article.content = req.content.strip()
    db.flush()
    record_audit(db, "legal_article.upsert", "legal_article", article.id, f"维护法条：{law_name}第{article_no}条")
    db.commit()
    db.refresh(article)
    return public_article(article)


@router.post("/verify")
def verify_articles(req: VerifyRequest, db: Session = Depends(get_db)):
    return {"references": verify_article_refs(db, req.text)}


@router.delete("/{article_id}", dependencies=[Depends(require_admin)])
def delete_article(article_id: str, db: Session = Depends(get_db)):
    article = db.query(LegalArticle).filter(LegalArticle.id == article_id).first()
    if not article:
        raise NotFoundError("法条不存在")
    record_audit(db, "legal_article.delete", "legal_article", article.id, f"删除法条：{article.law_name}第{article.article_no}条")
    db.delete(article)
    db.commit()
    return {"message": "已删除"}
