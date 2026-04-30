import io
from pathlib import Path
from typing import Protocol


class BaseParser(Protocol):
    def parse(self, file_path: Path) -> str: ...


class PDFParser:
    def parse(self, file_path: Path) -> str:
        try:
            import pdfplumber
            text_parts = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        text_parts.append(text)
            return "\n\n".join(text_parts)
        except ImportError:
            return self._fallback_parse(file_path)

    def _fallback_parse(self, file_path: Path) -> str:
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(file_path))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            return f"[PDF解析失败: {e}]"


class WordParser:
    def parse(self, file_path: Path) -> str:
        try:
            from docx import Document
            doc = Document(str(file_path))
            return "\n\n".join(para.text for para in doc.paragraphs if para.text.strip())
        except Exception as e:
            return f"[Word解析失败: {e}]"


class OCRParser:
    def parse(self, file_path: Path) -> str:
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img, lang="chi_sim+eng")
            return text.strip() if text.strip() else "[OCR未识别到文字]"
        except ImportError:
            return self._fallback_parse(file_path)
        except Exception as e:
            return f"[OCR识别失败: {e}]"

    def _fallback_parse(self, file_path: Path) -> str:
        try:
            import easyocr
            reader = easyocr.Reader(["ch_sim", "en"], gpu=False)
            result = reader.readtext(str(file_path))
            return "\n".join(item[1] for item in result)
        except Exception as e:
            return f"[OCR解析失败，请安装 pytesseract 或 easyocr: {e}]"


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
