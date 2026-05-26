from datetime import datetime
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.database import Base


class SubscriptionStatus:
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"


class UsageMetric:
    CASES = "cases"
    MATERIALS = "materials"
    AI_TASKS = "ai_tasks"
    MEMBERS = "members"


class BillingOrderStatus:
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class Plan(Base):
    __tablename__ = "plans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    case_limit = Column(Integer, default=10)
    material_limit = Column(Integer, default=50)
    ai_task_limit_monthly = Column(Integer, default=30)
    member_limit = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subscriptions = relationship("TeamSubscription", back_populates="plan")


class TeamSubscription(Base):
    __tablename__ = "team_subscriptions"
    __table_args__ = (UniqueConstraint("team_id", name="uq_team_subscription_team"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)
    plan_code = Column(String(50), ForeignKey("plans.code"), nullable=False)
    status = Column(String(30), default=SubscriptionStatus.TRIALING)
    current_period_start = Column(DateTime, default=datetime.utcnow)
    current_period_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    team = relationship("Team", back_populates="subscription")
    plan = relationship("Plan", back_populates="subscriptions")


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String, ForeignKey("teams.id"), nullable=False, index=True)
    metric = Column(String(50), nullable=False, index=True)
    quantity = Column(Integer, default=1)
    period = Column(String(7), nullable=False, index=True)
    resource_type = Column(String(80), default="")
    resource_id = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team", back_populates="usage_records")


class BillingOrder(Base):
    __tablename__ = "billing_orders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String, ForeignKey("teams.id"), nullable=False, index=True)
    plan_code = Column(String(50), ForeignKey("plans.code"), nullable=False, index=True)
    billing_period = Column(String(30), default="monthly")
    amount_cents = Column(Integer, default=0)
    currency = Column(String(10), default="CNY")
    status = Column(String(30), default=BillingOrderStatus.PENDING, index=True)
    paid_at = Column(DateTime, nullable=True)
    operator_id = Column(String, ForeignKey("users.id"), nullable=True)
    external_reference = Column(String(160), default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    team = relationship("Team", back_populates="billing_orders")
    plan = relationship("Plan")
    operator = relationship("User")
