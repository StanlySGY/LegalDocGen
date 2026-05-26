from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.billing import Plan, SubscriptionStatus, TeamSubscription, UsageMetric, UsageRecord
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


def get_billing_status(db: Session, user: User) -> dict:
    subscription = ensure_user_subscription(db, user)
    team = subscription.team or get_accessible_team(db, subscription.team_id, user)
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


def update_team_subscription(db: Session, team_id: str, plan_code: str, status: str, user: User) -> TeamSubscription:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    if status not in (SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELLED):
        raise HTTPException(status_code=422, detail="无效订阅状态")
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="团队不存在")
    plan = db.query(Plan).filter(Plan.code == plan_code, Plan.is_active == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail="套餐不存在")
    subscription = ensure_team_subscription(db, team_id)
    subscription.plan_code = plan.code
    subscription.status = status
    subscription.updated_at = datetime.utcnow()
    record_audit(db, "billing.subscription.updated", "team", team_id, f"切换套餐为：{plan.name}")
    db.flush()
    return subscription
