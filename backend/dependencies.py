from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
from backend.models.case import Case
from backend.models.user import User, UserRole
from backend.services.auth_service import decode_token
from backend.services.team_service import ensure_default_team, get_user_team_ids


def require_admin(
    x_admin_token: str = Header(default=""),
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
):
    if settings.ADMIN_TOKEN and x_admin_token == settings.ADMIN_TOKEN:
        return True
    if authorization:
        user = _user_from_authorization(authorization, db)
        if user.role == UserRole.ADMIN:
            return True
        raise ForbiddenError("需要管理员权限")
    if settings.ADMIN_TOKEN or settings.AUTH_REQUIRED:
        raise HTTPException(status_code=401, detail="未授权")
    return True


def get_optional_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> Optional[User]:
    if not authorization:
        return None
    try:
        return _user_from_authorization(authorization, db)
    except UnauthorizedError:
        return None


def get_current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> Optional[User]:
    if not authorization:
        if settings.AUTH_REQUIRED:
            raise UnauthorizedError("请先登录")
        return None
    return _user_from_authorization(authorization, db)


def require_user(user: Optional[User] = Depends(get_current_user)) -> User:
    if not user:
        raise UnauthorizedError("请先登录")
    return user


def require_admin_user(user: User = Depends(require_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise ForbiddenError("需要管理员权限")
    return user


def case_query_for_user(db: Session, user: Optional[User]):
    query = db.query(Case)
    if user and user.role != UserRole.ADMIN:
        team_ids = get_user_team_ids(db, user)
        filters = [Case.owner_id == user.id]
        if team_ids:
            filters.append(Case.team_id.in_(team_ids))
        query = query.filter(or_(*filters))
    return query


def get_accessible_case(db: Session, case_id: str, user: Optional[User]) -> Case:
    case = case_query_for_user(db, user).filter(Case.id == case_id).first()
    if not case:
        raise NotFoundError("案件不存在或无权访问")
    return case


def assign_case_owner(case: Case, user: Optional[User], db: Optional[Session] = None):
    if user and not case.owner_id:
        case.owner_id = user.id
    if user and db and not case.team_id:
        case.team_id = ensure_default_team(db, user).id


def _user_from_authorization(authorization: str, db: Session) -> User:
    payload = decode_token(_get_bearer_token(authorization))
    user = db.query(User).filter(User.id == payload.get("sub"), User.is_active == True).first()
    if not user:
        raise UnauthorizedError("登录用户不存在或已停用")
    return user


def _get_bearer_token(authorization: str) -> str:
    if not authorization:
        raise UnauthorizedError("请先登录")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("登录状态无效")
    return token.strip()
