from alembic import op
import sqlalchemy as sa

revision = "0002_billing_usage"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "plans",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("case_limit", sa.Integer()),
        sa.Column("material_limit", sa.Integer()),
        sa.Column("ai_task_limit_monthly", sa.Integer()),
        sa.Column("member_limit", sa.Integer()),
        sa.Column("is_active", sa.Boolean()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_plans_code", "plans", ["code"])

    op.create_table(
        "team_subscriptions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("team_id", sa.String(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("plan_code", sa.String(50), sa.ForeignKey("plans.code"), nullable=False),
        sa.Column("status", sa.String(30)),
        sa.Column("current_period_start", sa.DateTime()),
        sa.Column("current_period_end", sa.DateTime()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.UniqueConstraint("team_id", name="uq_team_subscription_team"),
    )

    op.create_table(
        "usage_records",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("team_id", sa.String(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("metric", sa.String(50), nullable=False),
        sa.Column("quantity", sa.Integer()),
        sa.Column("period", sa.String(7), nullable=False),
        sa.Column("resource_type", sa.String(80)),
        sa.Column("resource_id", sa.String()),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_index("ix_usage_records_team_id", "usage_records", ["team_id"])
    op.create_index("ix_usage_records_metric", "usage_records", ["metric"])
    op.create_index("ix_usage_records_period", "usage_records", ["period"])


def downgrade():
    op.drop_index("ix_usage_records_period", table_name="usage_records")
    op.drop_index("ix_usage_records_metric", table_name="usage_records")
    op.drop_index("ix_usage_records_team_id", table_name="usage_records")
    op.drop_table("usage_records")
    op.drop_table("team_subscriptions")
    op.drop_index("ix_plans_code", table_name="plans")
    op.drop_table("plans")
