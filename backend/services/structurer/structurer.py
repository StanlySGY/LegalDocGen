import re
import json

HEADING_MAP = {
    "当事人信息": "parties",
    "关键事实": "case_facts",
    "时间线": "timeline",
    "证据清单": "evidence",
}

SECTION_PATTERN = re.compile(r'## (.+?)\n(.*?)(?=## |$)', re.DOTALL)


def structure_facts(markdown_text: str) -> dict:
    sections = {"parties": "", "case_facts": "", "timeline": "", "evidence": ""}
    for match in SECTION_PATTERN.finditer(markdown_text):
        heading = match.group(1).strip()
        content = match.group(2).strip()
        key = HEADING_MAP.get(heading)
        if key:
            sections[key] = content
    return sections
