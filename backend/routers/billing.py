from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import require_user
from backend.models.billing import Plan, SubscriptionStatus
from backend.models.user import User
from backend.services.billing_service import get_billing_status, public_plan, seed_default_plans, update_team_subscription

router = APIRouter(prefix="/api/billing", tags=["billing"])


class SubscriptionUpdateRequest(BaseModel):
    plan_code: str
    status: str = SubscriptionStatus.ACTIVE


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


@router.put("/teams/{team_id}/subscription")
def update_subscription(team_id: str, req: SubscriptionUpdateRequest, db: Session = Depends(get_db), user: User = Depends(require_user)):
    subscription = update_team_subscription(db, team_id, req.plan_code, req.status, user)
    db.commit()
    db.refresh(subscription)
    return get_billing_status(db, user)
