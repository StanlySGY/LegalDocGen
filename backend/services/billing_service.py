from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.billing import BillingOrder, BillingOrderStatus, Plan, SubscriptionStatus, TeamSubscription, UsageMetric, UsageRecord
from backend.models.case import Case
from backend.models.material import Material
from backend.models.team import Team, TeamMember
from backend.models.user import User, UserRole
from backend.services.audit_service import record_audit
from backend.services.team_service import ensure_default_team, get_accessible_team

DEFAULT_PLANS = [
    {
        "code": "free",
        "name": "免费体验版",
        "case_limit": 5,
        "material_limit": 30,
        "ai_task_limit_monthly": 20,
        "member_limit": 1,
    },
    {
        "code": "team",
        "name": "团队专业版",
        "case_limit": 50,
        "material_limit": 500,
        "ai_task_limit_monthly": 300,
        "member_limit": 5,
    },
    {
        "code": "business",
        "name": "商业旗舰版",
        "case_limit": 500,
        "material_limit": 5000,
        "ai_task_limit_monthly": 3000,
        "member_limit": 30,
    },
]

LIMIT_FIELDS = {
    UsageMetric.CASES: "case_limit",
    UsageMetric.MATERIALS: "material_limit",
    UsageMetric.AI_TASKS: "ai_task_limit_monthly",
    UsageMetric.MEMBERS: "member_limit",
}

METRIC_LABELS = {
    UsageMetric.CASES: "案件数",
    UsageMetric.MATERIALS: "材料数",
    UsageMetric.AI_TASKS: "AI 生成次数",
    UsageMetric.MEMBERS: "团队成员数",
}


def current_period() -> str:
    return datetime.utcnow().strftime("%Y-%m")


def seed_default_plans(db: Session):
    for item in DEFAULT_PLANS:
        plan = db.query(Plan).filter(Plan.code == item["code"]).first()
        if not plan:
            db.add(Plan(**item))
            continue
        for key, value in item.items():
            setattr(plan, key, value)
        plan.is_active = True
    db.flush()


def ensure_team_subscription(db: Session, team_id: str) -> TeamSubscription:
    seed_default_plans(db)
    subscription = db.query(TeamSubscription).filter(TeamSubscription.team_id == team_id).first()
    if subscription:
        return subscription
    subscription = TeamSubscription(team_id=team_id, plan_code="free", status=SubscriptionStatus.TRIALING)
    db.add(subscription)
    db.flush()
    return subscription


def ensure_user_subscription(db: Session, user: User) -> TeamSubscription:
    team = ensure_default_team(db, user)
    return ensure_team_subscription(db, team.id)


def metric_limit(plan: Plan, metric: str) -> int:
    field = LIMIT_FIELDS.get(metric)
    return int(getattr(plan, field, 0) or 0) if field else 0


def metric_used(db: Session, team_id: str, metric: str, period: Optional[str] = None) -> int:
    if metric == UsageMetric.CASES:
        return db.query(Case).filter(Case.team_id == team_id).count()
    if metric == UsageMetric.MATERIALS:
        return db.query(Material).join(Case).filter(Case.team_id == team_id).count()
    if metric == UsageMetric.MEMBERS:
        return db.query(TeamMember).filter(TeamMember.team_id == team_id).count()
    query = db.query(func.coalesce(func.sum(UsageRecord.quantity), 0)).filter(
        UsageRecord.team_id == team_id,
        UsageRecord.metric == metric,
    )
    if period:
        query = query.filter(UsageRecord.period == period)
    return int(query.scalar() or 0)


def _quota_detail(metric: str, used: int, limit: int) -> dict:
    return {
        "code": "quota_exceeded",
        "metric": metric,
        "label": METRIC_LABELS.get(metric, metric),
        "used": used,
        "limit": limit,
        "upgrade_required": True,
        "message": f"{METRIC_LABELS.get(metric, metric)}已达到当前套餐上限，请升级套餐后继续。",
    }


def enforce_quota(db: Session, team_id: Optional[str], metric: str):
    if not team_id:
        return
    subscription = ensure_team_subscription(db, team_id)
    plan = subscription.plan or db.query(Plan).filter(Plan.code == subscription.plan_code).first()
    if not plan:
        return
    period = current_period() if metric == UsageMetric.AI_TASKS else None
    used = metric_used(db, team_id, metric, period)
    limit = metric_limit(plan, metric)
    if limit > 0 and used >= limit:
        record_audit(db, "quota.exceeded", "team", team_id, _quota_detail(metric, used, limit)["message"])
        db.flush()
        raise HTTPException(status_code=402, detail=_quota_detail(metric, used, limit))


def record_usage(db: Session, team_id: Optional[str], metric: str, resource_type: str, resource_id: str, quantity: int = 1):
    if not team_id:
        return None
    ensure_team_subscription(db, team_id)
    record = UsageRecord(
        team_id=team_id,
        metric=metric,
        quantity=quantity,
        period=current_period(),
        resource_type=resource_type,
        resource_id=resource_id,
    )
    db.add(record)
    db.flush()
    record_audit(db, "usage.recorded", "team", team_id, f"记录{METRIC_LABELS.get(metric, metric)}用量：{quantity}")
    return record


def public_plan(plan: Plan) -> dict:
    return {
        "id": plan.id,
        "code": plan.code,
        "name": plan.name,
        "case_limit": plan.case_limit,
        "material_limit": plan.material_limit,
        "ai_task_limit_monthly": plan.ai_task_limit_monthly,
        "member_limit": plan.member_limit,
        "is_active": plan.is_active,
    }


def require_billing_admin(user: User):
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="需要管理员权限")


def public_order(order: BillingOrder) -> dict:
    return {
        "id": order.id,
        "team": {"id": order.team.id, "name": order.team.name} if order.team else {"id": order.team_id, "name": ""},
        "plan_code": order.plan_code,
        "plan_name": order.plan.name if order.plan else order.plan_code,
        "billing_period": order.billing_period,
        "amount_cents": order.amount_cents,
        "currency": order.currency,
        "status": order.status,
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "operator_id": order.operator_id,
        "external_reference": order.external_reference or "",
        "notes": order.notes or "",
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
    }


def usage_summary(db: Session, team_id: str, plan: Plan) -> list[dict]:
    items = []
    for metric in (UsageMetric.CASES, UsageMetric.MATERIALS, UsageMetric.AI_TASKS, UsageMetric.MEMBERS):
        period = current_period() if metric == UsageMetric.AI_TASKS else None
        used = metric_used(db, team_id, metric, period)
        limit = metric_limit(plan, metric)
        percent = min(100, round(used / limit * 100)) if limit else 0
        items.append({
            "metric": metric,
            "label": METRIC_LABELS[metric],
            "used": used,
            "limit": limit,
            "percent": percent,
            "period": period or "all",
        })
    return items


def billing_status_for_team(db: Session, team_id: str, user: Optional[User] = None) -> dict:
    team = db.query(Team).filter(Team.id == team_id).first() if user and user.role == UserRole.ADMIN else None
    if not team:
        if not user:
            team = db.query(Team).filter(Team.id == team_id).first()
        else:
            team = get_accessible_team(db, team_id, user)
    if not team:
        raise HTTPException(status_code=404, detail="团队不存在")
    subscription = ensure_team_subscription(db, team.id)
    plan = subscription.plan or db.query(Plan).filter(Plan.code == subscription.plan_code).first()
    return {
        "team": {"id": team.id, "name": team.name},
        "subscription": {
            "id": subscription.id,
            "plan_code": subscription.plan_code,
            "status": subscription.status,
            "current_period_start": subscription.current_period_start.isoformat() if subscription.current_period_start else None,
            "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
        },
        "plan": public_plan(plan),
        "usage": usage_summary(db, team.id, plan),
        "period": current_period(),
    }


def get_billing_status(db: Session, user: User) -> dict:
    subscription = ensure_user_subscription(db, user)
    return billing_status_for_team(db, subscription.team_id, user)


def _get_active_plan(db: Session, plan_code: str) -> Plan:
    plan = db.query(Plan).filter(Plan.code == plan_code, Plan.is_active == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail="套餐不存在")
    return plan


def _ensure_team(db: Session, team_id: str) -> Team:
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="团队不存在")
    return team


def update_team_subscription(db: Session, team_id: str, plan_code: str, status: str, user: User) -> TeamSubscription:
    require_billing_admin(user)
    if status not in (SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELLED):
        raise HTTPException(status_code=422, detail="无效订阅状态")
    _ensure_team(db, team_id)
    plan = _get_active_plan(db, plan_code)
    subscription = ensure_team_subscription(db, team_id)
    subscription.plan_code = plan.code
    subscription.status = status
    subscription.updated_at = datetime.utcnow()
    record_audit(db, "billing.subscription.updated", "team", team_id, f"切换套餐为：{plan.name}")
    db.flush()
    return subscription


def create_billing_order(db: Session, team_id: str, plan_code: str, billing_period: str, amount_cents: int, currency: str, operator: User, external_reference: str = "", notes: str = "") -> BillingOrder:
    require_billing_admin(operator)
    _ensure_team(db, team_id)
    _get_active_plan(db, plan_code)
    if amount_cents < 0:
        raise HTTPException(status_code=422, detail="订单金额不能为负数")
    order = BillingOrder(
        team_id=team_id,
        plan_code=plan_code,
        billing_period=billing_period or "monthly",
        amount_cents=amount_cents,
        currency=(currency or "CNY").upper(),
        operator_id=operator.id,
        external_reference=external_reference.strip(),
        notes=notes.strip(),
    )
    db.add(order)
    db.flush()
    record_audit(db, "billing.order.created", "billing_order", order.id, f"创建线下订单：{plan_code}")
    return order


def update_billing_order_status(db: Session, order_id: str, status: str, operator: User, notes: str = "") -> BillingOrder:
    require_billing_admin(operator)
    if status not in (BillingOrderStatus.PENDING, BillingOrderStatus.PAID, BillingOrderStatus.CANCELLED, BillingOrderStatus.REFUNDED):
        raise HTTPException(status_code=422, detail="无效订单状态")
    order = db.query(BillingOrder).filter(BillingOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status == status and not notes:
        return order
    order.status = status
    order.operator_id = operator.id
    order.notes = notes.strip() or order.notes
    order.updated_at = datetime.utcnow()
    if status == BillingOrderStatus.PAID:
        order.paid_at = order.paid_at or datetime.utcnow()
        update_team_subscription(db, order.team_id, order.plan_code, SubscriptionStatus.ACTIVE, operator)
    record_audit(db, f"billing.order.{status}", "billing_order", order.id, f"订单状态更新为：{status}")
    db.flush()
    return order


def list_billing_orders(db: Session, user: User, status: str = "", limit: int = 50) -> list[dict]:
    require_billing_admin(user)
    query = db.query(BillingOrder).order_by(BillingOrder.created_at.desc())
    if status:
        query = query.filter(BillingOrder.status == status)
    return [public_order(order) for order in query.limit(min(max(limit, 1), 200)).all()]


def operations_summary(db: Session, user: User) -> dict:
    require_billing_admin(user)
    paid_statuses = (SubscriptionStatus.ACTIVE,)
    paid_team_count = db.query(TeamSubscription.team_id).filter(TeamSubscription.status.in_(paid_statuses), TeamSubscription.plan_code != "free").distinct().count()
    paid_amount = db.query(func.coalesce(func.sum(BillingOrder.amount_cents), 0)).filter(BillingOrder.status == BillingOrderStatus.PAID).scalar() or 0
    pending_count = db.query(BillingOrder).filter(BillingOrder.status == BillingOrderStatus.PENDING).count()
    trialing_count = db.query(TeamSubscription).filter(TeamSubscription.status == SubscriptionStatus.TRIALING).count()
    recent_orders = db.query(BillingOrder).order_by(BillingOrder.created_at.desc()).limit(5).all()
    near_limit = []
    for subscription in db.query(TeamSubscription).limit(100).all():
        plan = subscription.plan or db.query(Plan).filter(Plan.code == subscription.plan_code).first()
        if not plan:
            continue
        high_usage = [item for item in usage_summary(db, subscription.team_id, plan) if item["limit"] > 0 and item["percent"] >= 80]
        if high_usage:
            team_name = subscription.team.name if subscription.team else subscription.team_id
            near_limit.append({"team_id": subscription.team_id, "team_name": team_name, "usage": high_usage})
    return {
        "team_count": db.query(Team).count(),
        "paid_team_count": paid_team_count,
        "trialing_subscription_count": trialing_count,
        "pending_order_count": pending_count,
        "paid_amount_cents": int(paid_amount),
        "currency": "CNY",
        "recent_orders": [public_order(order) for order in recent_orders],
        "near_limit_teams": near_limit[:10],
    }
