import pytest
from fastapi import HTTPException

from backend.models.billing import BillingOrderStatus, Plan, SubscriptionStatus, UsageMetric
from backend.models.case import Case
from backend.models.user import User, UserRole
from backend.routers.billing import billing_status
from backend.services.auth_service import hash_password
from backend.services.billing_service import billing_status_for_team, create_billing_order, enforce_quota, operations_summary, seed_default_plans, update_billing_order_status, update_team_subscription
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


def test_paid_order_activates_target_team_subscription(db_session):
    admin = _user("admin", UserRole.ADMIN)
    owner = _user("owner")
    db_session.add_all([admin, owner])
    db_session.flush()
    team = ensure_default_team(db_session, owner)
    seed_default_plans(db_session)
    db_session.commit()

    order = create_billing_order(db_session, team.id, "business", "yearly", 199900, "cny", admin, "offline-001", "线下转账")
    assert order.status == BillingOrderStatus.PENDING
    assert order.currency == "CNY"

    paid = update_billing_order_status(db_session, order.id, BillingOrderStatus.PAID, admin, "已确认到账")
    status = billing_status_for_team(db_session, team.id, admin)

    assert paid.status == BillingOrderStatus.PAID
    assert paid.paid_at is not None
    assert status["team"]["id"] == team.id
    assert status["subscription"]["plan_code"] == "business"
    assert status["subscription"]["status"] == SubscriptionStatus.ACTIVE
    assert status["plan"]["case_limit"] == 500


def test_refunded_paid_order_reverts_team_to_free_subscription(db_session):
    admin = _user("admin", UserRole.ADMIN)
    owner = _user("owner")
    db_session.add_all([admin, owner])
    db_session.flush()
    team = ensure_default_team(db_session, owner)
    seed_default_plans(db_session)
    db_session.commit()

    order = create_billing_order(db_session, team.id, "business", "yearly", 199900, "CNY", admin)
    update_billing_order_status(db_session, order.id, BillingOrderStatus.PAID, admin)

    refunded = update_billing_order_status(db_session, order.id, BillingOrderStatus.REFUNDED, admin, "客户退款")
    status = billing_status_for_team(db_session, team.id, admin)

    assert refunded.status == BillingOrderStatus.REFUNDED
    assert status["subscription"]["plan_code"] == "free"
    assert status["subscription"]["status"] == SubscriptionStatus.TRIALING
    assert status["plan"]["case_limit"] == 5


def test_refunded_latest_paid_order_reverts_to_previous_paid_plan(db_session):
    admin = _user("admin", UserRole.ADMIN)
    owner = _user("owner")
    db_session.add_all([admin, owner])
    db_session.flush()
    team = ensure_default_team(db_session, owner)
    seed_default_plans(db_session)
    db_session.commit()

    first_order = create_billing_order(db_session, team.id, "team", "monthly", 29900, "CNY", admin)
    update_billing_order_status(db_session, first_order.id, BillingOrderStatus.PAID, admin)
    second_order = create_billing_order(db_session, team.id, "business", "yearly", 199900, "CNY", admin)
    update_billing_order_status(db_session, second_order.id, BillingOrderStatus.PAID, admin)

    update_billing_order_status(db_session, second_order.id, BillingOrderStatus.REFUNDED, admin, "较新订单退款")
    status = billing_status_for_team(db_session, team.id, admin)

    assert status["subscription"]["plan_code"] == "team"
    assert status["subscription"]["status"] == SubscriptionStatus.ACTIVE
    assert status["plan"]["case_limit"] == 50


def test_cancelled_pending_order_does_not_change_manual_subscription(db_session):
    admin = _user("admin", UserRole.ADMIN)
    owner = _user("owner")
    db_session.add_all([admin, owner])
    db_session.flush()
    team = ensure_default_team(db_session, owner)
    seed_default_plans(db_session)
    update_team_subscription(db_session, team.id, "business", SubscriptionStatus.ACTIVE, admin)
    order = create_billing_order(db_session, team.id, "team", "monthly", 29900, "CNY", admin)
    db_session.commit()

    update_billing_order_status(db_session, order.id, BillingOrderStatus.CANCELLED, admin, "未到账取消")
    status = billing_status_for_team(db_session, team.id, admin)

    assert status["subscription"]["plan_code"] == "business"
    assert status["subscription"]["status"] == SubscriptionStatus.ACTIVE


def test_member_cannot_create_billing_order(db_session):
    owner = _user("owner")
    db_session.add(owner)
    db_session.flush()
    team = ensure_default_team(db_session, owner)
    seed_default_plans(db_session)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        create_billing_order(db_session, team.id, "team", "monthly", 29900, "CNY", owner)

    assert exc.value.status_code == 403


def test_operations_summary_counts_paid_and_pending_orders(db_session):
    admin = _user("admin", UserRole.ADMIN)
    owner = _user("owner")
    other = _user("other")
    db_session.add_all([admin, owner, other])
    db_session.flush()
    paid_team = ensure_default_team(db_session, owner)
    pending_team = ensure_default_team(db_session, other)
    seed_default_plans(db_session)
    db_session.commit()

    paid_order = create_billing_order(db_session, paid_team.id, "team", "monthly", 29900, "CNY", admin)
    create_billing_order(db_session, pending_team.id, "business", "yearly", 199900, "CNY", admin)
    update_billing_order_status(db_session, paid_order.id, BillingOrderStatus.PAID, admin)

    summary = operations_summary(db_session, admin)

    assert summary["team_count"] == 2
    assert summary["paid_team_count"] == 1
    assert summary["pending_order_count"] == 1
    assert summary["paid_amount_cents"] == 29900
    assert summary["recent_orders"]
