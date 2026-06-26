from alembic import op
import sqlalchemy as sa

revision = "0004_personal_lawyer"
down_revision = "0003_billing_orders"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("cases", sa.Column("document_type", sa.String(50), server_default=""))
    op.add_column("cases", sa.Column("archived_at", sa.DateTime(), nullable=True))
    op.add_column("cases", sa.Column("archive_note", sa.Text(), server_default=""))

    op.create_table(
        "case_deadlines",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("reminder_days", sa.Integer(), server_default="3"),
        sa.Column("note", sa.Text(), server_default=""),
        sa.Column("is_completed", sa.Boolean(), server_default="0"),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_index("ix_case_deadlines_case_id", "case_deadlines", ["case_id"])
    op.create_index("ix_case_deadlines_due_date", "case_deadlines", ["due_date"])

    op.create_table(
        "case_notes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), server_default=""),
        sa.Column("content", sa.Text(), server_default=""),
        sa.Column("pinned", sa.Boolean(), server_default="0"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )
    op.create_index("ix_case_notes_case_id", "case_notes", ["case_id"])


def downgrade():
    op.drop_index("ix_case_notes_case_id", table_name="case_notes")
    op.drop_table("case_notes")
    op.drop_index("ix_case_deadlines_due_date", table_name="case_deadlines")
    op.drop_index("ix_case_deadlines_case_id", table_name="case_deadlines")
    op.drop_table("case_deadlines")
    op.drop_column("cases", "archive_note")
    op.drop_column("cases", "archived_at")
    op.drop_column("cases", "document_type")
