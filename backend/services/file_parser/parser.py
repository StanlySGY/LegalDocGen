from pathlib import Path
from typing import List, Protocol


def _page_text(page_no: int, text: str) -> dict:
    return {"page": page_no, "text": text.strip()}


class BaseParser(Protocol):
    def parse(self, file_path: Path) -> str: ...
    def parse_pages(self, file_path: Path) -> List[dict]: ...


class PDFParser:
    def parse(self, file_path: Path) -> str:
        pages = self.parse_pages(file_path)
        if len(pages) == 1 and pages[0]["text"].startswith("["):
            return pages[0]["text"]
        return "\n\n".join(page["text"] for page in pages if page["text"])

    def parse_pages(self, file_path: Path) -> List[dict]:
        try:
            import pdfplumber
            pages = []
            with pdfplumber.open(file_path) as pdf:
                for index, page in enumerate(pdf.pages, start=1):
                    text = page.extract_text() or ""
                    if text.strip():
                        pages.append(_page_text(index, text))
            return pages
        except ImportError:
            return self._fallback_parse_pages(file_path)

    def _fallback_parse_pages(self, file_path: Path) -> List[dict]:
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(file_path))
            return [_page_text(index, page.extract_text() or "") for index, page in enumerate(reader.pages, start=1)]
        except Exception as e:
            return [_page_text(0, f"[PDF解析失败: {e}]")]


class WordParser:
    def parse(self, file_path: Path) -> str:
        pages = self.parse_pages(file_path)
        if len(pages) == 1 and pages[0]["text"].startswith("["):
            return pages[0]["text"]
        return "\n\n".join(page["text"] for page in pages if page["text"])

    def parse_pages(self, file_path: Path) -> List[dict]:
        try:
            from docx import Document
            doc = Document(str(file_path))
            text = "\n\n".join(para.text for para in doc.paragraphs if para.text.strip())
            return [_page_text(1, text)] if text else []
        except Exception as e:
            return [_page_text(0, f"[Word解析失败: {e}]")]


class OCRParser:
    def parse(self, file_path: Path) -> str:
        pages = self.parse_pages(file_path)
        if len(pages) == 1 and pages[0]["text"].startswith("["):
            return pages[0]["text"]
        return "\n\n".join(page["text"] for page in pages if page["text"])

    def parse_pages(self, file_path: Path) -> List[dict]:
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img, lang="chi_sim+eng")
            return [_page_text(1, text)] if text.strip() else [_page_text(0, "[OCR未识别到文字]")]
        except ImportError:
            return self._fallback_parse_pages(file_path)
        except Exception as e:
            return [_page_text(0, f"[OCR识别失败: {e}]")]

    def _fallback_parse_pages(self, file_path: Path) -> List[dict]:
        try:
            import easyocr
            reader = easyocr.Reader(["ch_sim", "en"], gpu=False)
            result = reader.readtext(str(file_path))
            text = "\n".join(item[1] for item in result)
            return [_page_text(1, text)] if text.strip() else [_page_text(0, "[OCR未识别到文字]")]
        except Exception as e:
            return [_page_text(0, f"[OCR解析失败，请安装 pytesseract 或 easyocr: {e}]")]


PARSERS = {
    ".pdf": PDFParser(),
    ".doc": WordParser(),
    ".docx": WordParser(),
    ".jpg": OCRParser(),
    ".jpeg": OCRParser(),
    ".png": OCRParser(),
}


def parse_file(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    parser = PARSERS.get(suffix)
    if not parser:
        return f"[不支持的文件格式: {suffix}]"
    return parser.parse(file_path)


def parse_file_with_pages(file_path: Path) -> dict:
    suffix = file_path.suffix.lower()
    parser = PARSERS.get(suffix)
    if not parser:
        message = f"[不支持的文件格式: {suffix}]"
        return {"text": message, "pages": [_page_text(0, message)]}
    pages = parser.parse_pages(file_path)
    text = "\n\n".join(page["text"] for page in pages if page.get("text"))
    return {"text": text, "pages": pages}
