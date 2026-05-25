from fastapi import Header, HTTPException

from backend.config import settings


def require_admin(x_admin_token: str = Header(default="")):
    if settings.ADMIN_TOKEN and x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="未授权")
    return True
