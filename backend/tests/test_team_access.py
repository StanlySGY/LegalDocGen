from backend.dependencies import assign_case_owner, case_query_for_user
from backend.models.case import Case
from backend.models.team import TeamRole
from backend.models.user import User, UserRole
from backend.services.auth_service import hash_password
from backend.services.team_service import add_team_member, ensure_default_team


def _user(username: str) -> User:
    return User(username=username, display_name=username, password_hash=hash_password("password123"), role=UserRole.MEMBER)


def test_team_member_can_access_team_case(db_session):
    owner = _user("owner")
    member = _user("member")
    outsider = _user("outsider")
    db_session.add_all([owner, member, outsider])
    db_session.flush()

    team = ensure_default_team(db_session, owner)
    add_team_member(db_session, team.id, member.id, TeamRole.MEMBER)
    case = Case(name="团队案件", team_id=team.id, owner_id=owner.id)
    db_session.add(case)
    db_session.commit()

    assert case_query_for_user(db_session, member).filter(Case.id == case.id).first() is not None
    assert case_query_for_user(db_session, outsider).filter(Case.id == case.id).first() is None


def test_assign_case_owner_sets_default_team(db_session):
    user = _user("creator")
    db_session.add(user)
    db_session.flush()
    case = Case(name="新案件")

    assign_case_owner(case, user, db_session)

    assert case.owner_id == user.id
    assert case.team_id
