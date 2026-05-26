from alembic import op
import sqlalchemy as sa

revision = "0003_billing_orders"
down_revision = "0002_billing_usage"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "billing_orders",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("team_id", sa.String(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("plan_code", sa.String(50), sa.ForeignKey("plans.code"), nullable=False),
        sa.Column("billing_period", sa.String(30)),
        sa.Column("amount_cents", sa.Integer()),
        sa.Column("currency", sa.String(10)),
        sa.Column("status", sa.String(30)),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("operator_id", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("external_reference", sa.String(160)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )
    op.create_index("ix_billing_orders_team_id", "billing_orders", ["team_id"])
    op.create_index("ix_billing_orders_plan_code", "billing_orders", ["plan_code"])
    op.create_index("ix_billing_orders_status", "billing_orders", ["status"])


def downgrade():
    op.drop_index("ix_billing_orders_status", table_name="billing_orders")
    op.drop_index("ix_billing_orders_plan_code", table_name="billing_orders")
    op.drop_index("ix_billing_orders_team_id", table_name="billing_orders")
    op.drop_table("billing_orders")
