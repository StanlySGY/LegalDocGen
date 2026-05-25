import base64
import hashlib
from itertools import cycle

from backend.config import settings

_PREFIX = "enc:"


def _key() -> bytes:
    secret = settings.API_KEY_SECRET or settings.ADMIN_TOKEN or "LegalDocGen-local-secret"
    return hashlib.sha256(secret.encode("utf-8")).digest()


def encrypt_secret(value: str) -> str:
    if not value or value.startswith(_PREFIX):
        return value
    data = value.encode("utf-8")
    encrypted = bytes(byte ^ key for byte, key in zip(data, cycle(_key())))
    return _PREFIX + base64.urlsafe_b64encode(encrypted).decode("ascii")


def decrypt_secret(value: str) -> str:
    if not value or not value.startswith(_PREFIX):
        return value
    try:
        data = base64.urlsafe_b64decode(value[len(_PREFIX):].encode("ascii"))
        decrypted = bytes(byte ^ key for byte, key in zip(data, cycle(_key())))
        return decrypted.decode("utf-8")
    except Exception:
        return ""


def mask_secret(value: str) -> str:
    plain = decrypt_secret(value)
    if not plain:
        return ""
    if len(plain) <= 8:
        return "***"
    return f"{plain[:4]}***{plain[-4:]}"
