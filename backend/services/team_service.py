from typing import List, Optional

from sqlalchemy.orm import Session

from backend.exceptions import ForbiddenError, NotFoundError, ValidationError
from backend.models.team import Team, TeamMember, TeamRole
from backend.models.user import User, UserRole


def ensure_default_team(db: Session, user: User) -> Team:
    member = db.query(TeamMember).filter(TeamMember.user_id == user.id).first()
    if member:
        return member.team
    team = Team(name=f"{user.display_name or user.username}的团队")
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=user.id, role=TeamRole.OWNER))
    db.flush()
    return team


def get_user_team_ids(db: Session, user: User) -> List[str]:
    return [row[0] for row in db.query(TeamMember.team_id).filter(TeamMember.user_id == user.id).all()]


def get_team_member(db: Session, team_id: str, user_id: str) -> Optional[TeamMember]:
    return db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id).first()


def require_team_manager(db: Session, team_id: str, user: User) -> Optional[TeamMember]:
    if user.role == UserRole.ADMIN:
        return None
    member = get_team_member(db, team_id, user.id)
    if not member or member.role not in (TeamRole.OWNER, TeamRole.ADMIN):
        raise ForbiddenError("需要团队管理员权限")
    return member


def get_accessible_team(db: Session, team_id: str, user: User) -> Team:
    query = db.query(Team).filter(Team.id == team_id)
    if user.role != UserRole.ADMIN:
        query = query.join(TeamMember).filter(TeamMember.user_id == user.id)
    team = query.first()
    if not team:
        raise NotFoundError("团队不存在或无权访问")
    return team


def add_team_member(db: Session, team_id: str, user_id: str, role: str) -> TeamMember:
    if role not in (TeamRole.ADMIN, TeamRole.MEMBER):
        raise ValidationError("无效团队角色")
    existing = get_team_member(db, team_id, user_id)
    if existing:
        existing.role = role
        return existing
    member = TeamMember(team_id=team_id, user_id=user_id, role=role)
    db.add(member)
    db.flush()
    return member


def remove_team_member(db: Session, team_id: str, user_id: str):
    member = get_team_member(db, team_id, user_id)
    if not member:
        raise NotFoundError("团队成员不存在")
    if member.role == TeamRole.OWNER:
        owner_count = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.role == TeamRole.OWNER).count()
        if owner_count <= 1:
            raise ValidationError("至少保留一名团队所有者")
    db.delete(member)
