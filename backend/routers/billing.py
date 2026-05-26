from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import require_user
from backend.models.billing import BillingOrderStatus, Plan, SubscriptionStatus
from backend.models.user import User
from backend.services.billing_service import (
    billing_status_for_team,
    create_billing_order,
    get_billing_status,
    list_billing_orders,
    operations_summary,
    public_order,
    public_plan,
    seed_default_plans,
    update_billing_order_status,
    update_team_subscription,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])


class SubscriptionUpdateRequest(BaseModel):
    plan_code: str
    status: str = SubscriptionStatus.ACTIVE


class BillingOrderCreateRequest(BaseModel):
    team_id: str
    plan_code: str
    billing_period: str = "monthly"
    amount_cents: int = 0
    currency: str = "CNY"
    external_reference: str = ""
    notes: str = ""


class BillingOrderUpdateRequest(BaseModel):
    status: str = BillingOrderStatus.PAID
    notes: str = ""


@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    seed_default_plans(db)
    db.commit()
    plans = db.query(Plan).filter(Plan.is_active == True).order_by(Plan.case_limit.asc()).all()
    return [public_plan(plan) for plan in plans]


@router.get("/status")
def billing_status(db: Session = Depends(get_db), user: User = Depends(require_user)):
    status = get_billing_status(db, user)
    db.commit()
    return status


@router.get("/operations/summary")
def operations_dashboard_summary(db: Session = Depends(get_db), user: User = Depends(require_user)):
    summary = operations_summary(db, user)
    db.commit()
    return summary


@router.get("/operations/orders")
def operations_orders(status: str = "", limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db), user: User = Depends(require_user)):
    orders = list_billing_orders(db, user, status, limit)
    db.commit()
    return orders


@router.post("/operations/orders")
def create_operations_order(req: BillingOrderCreateRequest, db: Session = Depends(get_db), user: User = Depends(require_user)):
    order = create_billing_order(
        db,
        req.team_id,
        req.plan_code,
        req.billing_period,
        req.amount_cents,
        req.currency,
        user,
        req.external_reference,
        req.notes,
    )
    db.commit()
    db.refresh(order)
    return public_order(order)


@router.put("/operations/orders/{order_id}")
def update_operations_order(order_id: str, req: BillingOrderUpdateRequest, db: Session = Depends(get_db), user: User = Depends(require_user)):
    order = update_billing_order_status(db, order_id, req.status, user, req.notes)
    db.commit()
    db.refresh(order)
    return public_order(order)


@router.put("/teams/{team_id}/subscription")
def update_subscription(team_id: str, req: SubscriptionUpdateRequest, db: Session = Depends(get_db), user: User = Depends(require_user)):
    update_team_subscription(db, team_id, req.plan_code, req.status, user)
    db.commit()
    return billing_status_for_team(db, team_id, user)
