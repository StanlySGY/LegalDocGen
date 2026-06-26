import re
from typing import List, Tuple, Dict

class Anonymizer:
    """Regex-based text anonymizer for legal documents."""
    
    def __init__(self):
        self._mapping: Dict[str, str] = {}
        
    def anonymize(self, text: str, party_names: List[str] = None) -> Tuple[str, Dict[str, str]]:
        """
        Anonymize sensitive data in text.
        Returns (anonymized_text, reverse_mapping).
        
        Rules:
        - ID card (18 digits): replace with [身份证号-1], [身份证号-2], etc.
        - Phone (11 digits starting with 1): replace with [手机号-1], [手机号-2], etc.
        - Party names (from party_names list): replace with 甲方/乙方 or 张某某/李某某
        - Unified social credit code (18 chars): replace with [信用代码-1], etc.
        """
        self._mapping = {}
        result = text
        counter = {"id": 0, "phone": 0, "credit": 0}
        
        # ID card numbers (18 digits, last may be X)
        def replace_id(m: re.Match) -> str:
            counter["id"] += 1
            key = f"[身份证号-{counter['id']}]"
            self._mapping[key] = m.group()
            return key
        result = re.sub(r'\b\d{17}[\dXx]\b', replace_id, result)
        
        # Phone numbers (11 digits starting with 1)
        def replace_phone(m: re.Match) -> str:
            counter["phone"] += 1
            key = f"[手机号-{counter['phone']}]"
            self._mapping[key] = m.group()
            return key
        result = re.sub(r'\b1[3-9]\d{9}\b', replace_phone, result)
        
        # Unified social credit code (18 alphanumeric chars)
        def replace_credit(m: re.Match) -> str:
            counter["credit"] += 1
            key = f"[信用代码-{counter['credit']}]"
            self._mapping[key] = m.group()
            return key
        result = re.sub(r'\b[A-Z0-9]{18}\b', replace_credit, result)
        
        # Party names - replace longest first to avoid partial matches
        if party_names:
            sorted_names = sorted(party_names, key=len, reverse=True)
            aliases = ["甲方", "乙方", "丙方", "丁方", "戊方"]
            for i, name in enumerate(sorted_names):
                if name and len(name) >= 2:
                    alias = aliases[i] if i < len(aliases) else f"当事人{i+1}"
                    result = result.replace(name, alias)
                    self._mapping[alias] = name
        
        return result, self._mapping
    
    def deanonymize(self, text: str, mapping: Dict[str, str]) -> str:
        """Reverse the anonymization using the mapping."""
        result = text
        # Replace longest keys first to avoid partial matches
        for key in sorted(mapping.keys(), key=len, reverse=True):
            result = result.replace(key, mapping[key])
        return result
