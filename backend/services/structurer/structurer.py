import re
import json

HEADING_MAP = {
    "当事人信息": "parties",
    "关键事实": "case_facts",
    "时间线": "timeline",
    "证据清单": "evidence",
}

SECTION_PATTERN = re.compile(r'##\s+(.+?)\n(.*?)(?=\n##\s|$)', re.DOTALL)


def structure_facts(markdown_text: str) -> dict:
    sections = {"parties": "", "case_facts": "", "timeline": "", "evidence": ""}
    found_any = False
    for match in SECTION_PATTERN.finditer(markdown_text):
        heading = match.group(1).strip()
        content = match.group(2).strip()
        key = HEADING_MAP.get(heading)
        if key:
            sections[key] = content
            found_any = True

    # Fallback: if no sections matched, put everything into case_facts
    if not found_any and markdown_text.strip():
        sections["case_facts"] = markdown_text.strip()

    return sections
