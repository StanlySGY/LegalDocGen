import re
from typing import List

from sqlalchemy.orm import Session

from backend.models.legal_article import LegalArticle

ARTICLE_PATTERN = re.compile(r"《([^》]{2,80})》第([一二三四五六七八九十百千万零〇0-9]+)条")


def extract_article_refs(text: str) -> List[dict]:
    seen = set()
    refs = []
    for law_name, article_no in ARTICLE_PATTERN.findall(text or ""):
        key = (law_name, article_no)
        if key in seen:
            continue
        seen.add(key)
        refs.append({"law_name": law_name, "article_no": article_no})
    return refs


def verify_article_refs(db: Session, text: str) -> List[dict]:
    result = []
    for ref in extract_article_refs(text):
        article = db.query(LegalArticle).filter(
            LegalArticle.law_name == ref["law_name"],
            LegalArticle.article_no == ref["article_no"],
        ).first()
        result.append({
            **ref,
            "matched": bool(article),
            "title": article.title if article else "",
            "content": article.content if article else "",
        })
    return result


def public_article(article: LegalArticle) -> dict:
    return {
        "id": article.id,
        "law_name": article.law_name,
        "article_no": article.article_no,
        "title": article.title,
        "content": article.content,
        "created_at": article.created_at.isoformat() if article.created_at else None,
        "updated_at": article.updated_at.isoformat() if article.updated_at else None,
    }
