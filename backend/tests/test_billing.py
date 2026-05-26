import pytest
from fastapi import HTTPException

from backend.models.billing import Plan, SubscriptionStatus, UsageMetric
from backend.models.case import Case
from backend.models.user import User, UserRole
from backend.routers.billing import billing_status
from backend.services.auth_service import hash_password
from backend.services.billing_service import enforce_quota, seed_default_plans, update_team_subscription
from backend.services.team_service import ensure_default_team


def _user(username: str, role: str = UserRole.MEMBER) -> User:
    return User(username=username, display_name=username, password_hash=hash_password("password123"), role=role)


def _usage(status: dict, metric: str) -> dict:
    return next(item for item in status["usage"] if item["metric"] == metric)


def test_seed_default_plans(db_session):
    seed_default_plans(db_session)
    db_session.commit()

    plans = {plan.code: plan for plan in db_session.query(Plan).all()}

    assert set(plans) == {"free", "team", "business"}
    assert plans["free"].case_limit == 5
    assert plans["team"].member_limit == 5
    assert plans["business"].ai_task_limit_monthly == 3000


def test_billing_status_creates_free_subscription_and_usage(db_session):
    user = _user("creator")
    db_session.add(user)
    db_session.flush()
    team = ensure_default_team(db_session, user)
    db_session.add(Case(name="案件一", owner_id=user.id, team_id=team.id))
    db_session.commit()

    status = billing_status(db_session, user)

    assert status["team"]["id"] == team.id
    assert status["subscription"]["plan_code"] == "free"
    assert status["subscription"]["status"] == SubscriptionStatus.TRIALING
    assert _usage(status, UsageMetric.CASES)["used"] == 1
    assert _usage(status, UsageMetric.CASES)["limit"] == 5
    assert _usage(status, UsageMetric.CASES)["percent"] == 20
    assert _usage(status, UsageMetric.MEMBERS)["used"] == 1


def test_free_plan_blocks_case_creation_at_limit(db_session):
    user = _user("limited")
    db_session.add(user)
    db_session.flush()
    team = ensure_default_team(db_session, user)
    for index in range(5):
        db_session.add(Case(name=f"案件{index}", owner_id=user.id, team_id=team.id))
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        enforce_quota(db_session, team.id, UsageMetric.CASES)

    assert exc.value.status_code == 402
    assert exc.value.detail["code"] == "quota_exceeded"
    assert exc.value.detail["metric"] == UsageMetric.CASES
    assert exc.value.detail["used"] == 5
    assert exc.value.detail["limit"] == 5


def test_admin_subscription_switch_changes_quota(db_session):
    admin = _user("admin", UserRole.ADMIN)
    owner = _user("owner")
    db_session.add_all([admin, owner])
    db_session.flush()
    team = ensure_default_team(db_session, owner)
    for index in range(5):
        db_session.add(Case(name=f"案件{index}", owner_id=owner.id, team_id=team.id))
    seed_default_plans(db_session)
    db_session.commit()

    subscription = update_team_subscription(db_session, team.id, "team", SubscriptionStatus.ACTIVE, admin)
    db_session.commit()

    assert subscription.plan_code == "team"
    assert subscription.status == SubscriptionStatus.ACTIVE
    enforce_quota(db_session, team.id, UsageMetric.CASES)


def test_member_cannot_update_subscription(db_session):
    owner = _user("owner")
    db_session.add(owner)
    db_session.flush()
    team = ensure_default_team(db_session, owner)
    seed_default_plans(db_session)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        update_team_subscription(db_session, team.id, "team", SubscriptionStatus.ACTIVE, owner)

    assert exc.value.status_code == 403
