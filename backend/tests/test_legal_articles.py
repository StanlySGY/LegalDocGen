from backend.models.legal_article import LegalArticle
from backend.services.legal_article_service import extract_article_refs, verify_article_refs


def test_extract_article_refs_deduplicates():
    refs = extract_article_refs("依据《民法典》第五百七十七条，《民法典》第五百七十七条处理。")
    assert refs == [{"law_name": "民法典", "article_no": "五百七十七"}]


def test_verify_article_refs_matches_local_library(db_session):
    db_session.add(LegalArticle(law_name="民法典", article_no="五百七十七", title="违约责任", content="当事人一方不履行合同义务..."))
    db_session.commit()

    result = verify_article_refs(db_session, "请求依据《民法典》第五百七十七条承担违约责任。")

    assert result[0]["matched"] is True
    assert result[0]["title"] == "违约责任"
