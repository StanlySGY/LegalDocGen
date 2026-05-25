import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone

from backend.config import settings
from backend.exceptions import UnauthorizedError
from backend.models.user import User


_PROCESS_SECRET = secrets.token_urlsafe(32)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return f"pbkdf2:{base64.urlsafe_b64encode(salt).decode()}:{base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_text, digest_text = stored.split(":", 2)
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(digest_text.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def issue_token(user: User) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.AUTH_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user.id,
        "username": user.username,
        "role": user.role,
        "exp": int(expires_at.timestamp()),
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    signature = _sign(body)
    return f"{body}.{signature}"


def decode_token(token: str) -> dict:
    try:
        body, signature = token.split(".", 1)
    except ValueError:
        raise UnauthorizedError("登录状态无效")
    if not hmac.compare_digest(_sign(body), signature):
        raise UnauthorizedError("登录状态无效")
    try:
        payload = json.loads(_unb64(body).decode())
    except Exception:
        raise UnauthorizedError("登录状态无效")
    if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
        raise UnauthorizedError("登录已过期")
    return payload


def public_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _secret() -> bytes:
    secret = settings.AUTH_SECRET or settings.API_KEY_SECRET or settings.ADMIN_TOKEN or _PROCESS_SECRET
    return secret.encode("utf-8")


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode((value + "=" * (-len(value) % 4)).encode())


def _sign(body: str) -> str:
    digest = hmac.new(_secret(), body.encode(), hashlib.sha256).digest()
    return _b64(digest)
