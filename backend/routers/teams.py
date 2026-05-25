from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import require_user
from backend.exceptions import NotFoundError, ValidationError
from backend.models.team import Team, TeamMember, TeamRole
from backend.models.user import User, UserRole
from backend.services.audit_service import record_audit
from backend.services.team_service import add_team_member, ensure_default_team, get_accessible_team, require_team_manager, remove_team_member

router = APIRouter(prefix="/api/teams", tags=["teams"])


class TeamCreateRequest(BaseModel):
    name: str


class TeamMemberRequest(BaseModel):
    user_id: str
    role: str = TeamRole.MEMBER


class TeamMemberUpdateRequest(BaseModel):
    role: str


def _public_member(member: TeamMember) -> dict:
    return {
        "id": member.id,
        "team_id": member.team_id,
        "user_id": member.user_id,
        "username": member.user.username if member.user else "",
        "display_name": member.user.display_name if member.user else "",
        "role": member.role,
        "created_at": member.created_at.isoformat() if member.created_at else None,
    }


def _public_team(team: Team, member: Optional[TeamMember] = None) -> dict:
    return {
        "id": team.id,
        "name": team.name,
        "role": member.role if member else TeamRole.OWNER,
        "created_at": team.created_at.isoformat() if team.created_at else None,
        "updated_at": team.updated_at.isoformat() if team.updated_at else None,
    }


@router.get("")
def list_teams(db: Session = Depends(get_db), user: User = Depends(require_user)):
    if user.role == UserRole.ADMIN:
        return [_public_team(team) for team in db.query(Team).order_by(Team.created_at.desc()).all()]
    ensure_default_team(db, user)
    db.commit()
    rows = db.query(TeamMember).filter(TeamMember.user_id == user.id).all()
    return [_public_team(row.team, row) for row in rows]


@router.post("")
def create_team(req: TeamCreateRequest, db: Session = Depends(get_db), user: User = Depends(require_user)):
    name = req.name.strip()
    if not name:
        raise ValidationError("团队名称不能为空")
    team = Team(name=name)
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=user.id, role=TeamRole.OWNER))
    record_audit(db, "team.create", "team", team.id, f"创建团队：{team.name}")
    db.commit()
    db.refresh(team)
    return _public_team(team)


@router.get("/{team_id}/members")
def list_members(team_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    get_accessible_team(db, team_id, user)
    members = db.query(TeamMember).filter(TeamMember.team_id == team_id).order_by(TeamMember.created_at.asc()).all()
    return [_public_member(member) for member in members]


@router.post("/{team_id}/members")
def add_member(team_id: str, req: TeamMemberRequest, db: Session = Depends(get_db), user: User = Depends(require_user)):
    get_accessible_team(db, team_id, user)
    require_team_manager(db, team_id, user)
    target = db.query(User).filter(User.id == req.user_id, User.is_active == True).first()
    if not target:
        raise NotFoundError("用户不存在或已停用")
    member = add_team_member(db, team_id, target.id, req.role)
    record_audit(db, "team.add_member", "team", team_id, f"添加团队成员：{target.username}")
    db.commit()
    db.refresh(member)
    return _public_member(member)


@router.put("/{team_id}/members/{user_id}")
def update_member(team_id: str, user_id: str, req: TeamMemberUpdateRequest, db: Session = Depends(get_db), user: User = Depends(require_user)):
    get_accessible_team(db, team_id, user)
    require_team_manager(db, team_id, user)
    if req.role not in (TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER):
        raise ValidationError("无效团队角色")
    member = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id).first()
    if not member:
        raise NotFoundError("团队成员不存在")
    member.role = req.role
    record_audit(db, "team.update_member", "team", team_id, f"更新团队成员角色：{user_id}")
    db.commit()
    db.refresh(member)
    return _public_member(member)


@router.delete("/{team_id}/members/{user_id}")
def delete_member(team_id: str, user_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    get_accessible_team(db, team_id, user)
    require_team_manager(db, team_id, user)
    remove_team_member(db, team_id, user_id)
    record_audit(db, "team.remove_member", "team", team_id, f"移除团队成员：{user_id}")
    db.commit()
    return {"message": "已移除"}
