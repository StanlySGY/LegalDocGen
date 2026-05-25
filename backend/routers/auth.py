from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.dependencies import get_optional_user, require_admin
from backend.exceptions import ForbiddenError, UnauthorizedError, ValidationError
from backend.models.user import User, UserRole
from backend.services.audit_service import record_audit
from backend.services.auth_service import hash_password, issue_token, public_user, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str = ""


class UserUpdateRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username.strip()).first()
    if not user or not user.is_active or not verify_password(req.password, user.password_hash):
        raise UnauthorizedError("用户名或密码错误")
    return {"token": issue_token(user), "user": public_user(user), "auth_required": settings.AUTH_REQUIRED}


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if not settings.ALLOW_USER_REGISTRATION:
        raise ForbiddenError("当前未开放用户注册")
    username = req.username.strip()
    if not username or len(username) < 3:
        raise ValidationError("用户名至少 3 个字符")
    if len(req.password) < 8:
        raise ValidationError("密码至少 8 个字符")
    if db.query(User).filter(User.username == username).first():
        raise ValidationError("用户名已存在")
    role = UserRole.ADMIN if db.query(User).count() == 0 else UserRole.MEMBER
    user = User(
        username=username,
        display_name=req.display_name.strip() or username,
        password_hash=hash_password(req.password),
        role=role,
    )
    db.add(user)
    db.flush()
    record_audit(db, "auth.register", "user", user.id, f"注册用户：{user.username}")
    db.commit()
    db.refresh(user)
    return {"token": issue_token(user), "user": public_user(user), "auth_required": settings.AUTH_REQUIRED}


@router.get("/me")
def me(user: Optional[User] = Depends(get_optional_user)):
    return {"user": public_user(user) if user else None, "auth_required": settings.AUTH_REQUIRED}


@router.get("/users", dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [public_user(user) for user in users]


@router.put("/users/{user_id}", dependencies=[Depends(require_admin)])
def update_user(user_id: str, req: UserUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValidationError("用户不存在")
    if req.role is not None:
        if req.role not in (UserRole.ADMIN, UserRole.MEMBER):
            raise ValidationError("无效角色")
        user.role = req.role
    if req.is_active is not None:
        user.is_active = req.is_active
    record_audit(db, "auth.update_user", "user", user.id, f"更新用户：{user.username}")
    db.commit()
    db.refresh(user)
    return public_user(user)
