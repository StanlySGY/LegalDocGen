from alembic import op
import sqlalchemy as sa

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("username", sa.String(80), nullable=False),
        sa.Column("display_name", sa.String(120)),
        sa.Column("password_hash", sa.String(300), nullable=False),
        sa.Column("role", sa.String(30)),
        sa.Column("is_active", sa.Boolean()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "case_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("materials_checklist", sa.Text()),
        sa.Column("default_prompts", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("is_default", sa.Boolean()),
    )

    op.create_table(
        "teams",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table(
        "team_members",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("team_id", sa.String(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(30)),
        sa.Column("created_at", sa.DateTime()),
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_member"),
    )

    op.create_table(
        "cases",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("case_type", sa.String(100)),
        sa.Column("template_id", sa.String(36), sa.ForeignKey("case_templates.id")),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id")),
        sa.Column(
            "status", sa.Enum("DRAFT", "IN_PROGRESS", "COMPLETED", name="casestatus")
        ),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table(
        "materials",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.id"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("file_size", sa.Integer()),
        sa.Column("parsed_content", sa.Text()),
        sa.Column("structured_data", sa.Text()),
        sa.Column("parse_task_id", sa.String(36)),
        sa.Column("parse_status", sa.String(50)),
        sa.Column("created_at", sa.DateTime()),
    )

    op.create_table(
        "background_tasks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.id")),
        sa.Column("task_type", sa.String(80), nullable=False),
        sa.Column("status", sa.String(30)),
        sa.Column("message", sa.Text()),
        sa.Column("result", sa.Text()),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("completed_at", sa.DateTime()),
    )

    op.create_table(
        "case_documents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("doc_type", sa.String(50), server_default="complaint"),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("final_file_path", sa.String(1000), nullable=True),
        sa.Column("final_file_name", sa.String(500), nullable=True),
        sa.Column("final_uploaded_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table(
        "workflow_nodes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.id"), nullable=False),
        sa.Column(
            "document_id",
            sa.String(),
            sa.ForeignKey("case_documents.id"),
            nullable=True,
        ),
        sa.Column("stage", sa.String(50), nullable=False),
        sa.Column("prompt", sa.Text()),
        sa.Column("output", sa.Text()),
        sa.Column("model_used", sa.String(100)),
        sa.Column("version", sa.Integer()),
        sa.Column("is_current", sa.Boolean()),
        sa.Column("parent_version_id", sa.String(), sa.ForeignKey("workflow_nodes.id")),
        sa.Column("status", sa.String(50)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table(
        "channels",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("base_url", sa.String(500), nullable=False),
        sa.Column("api_key", sa.String(500)),
        sa.Column("models", sa.Text()),
        sa.Column("default_model", sa.String(200)),
        sa.Column("status", sa.Integer()),
        sa.Column("test_status", sa.String(50)),
        sa.Column("balance", sa.String(100)),
        sa.Column("priority", sa.Integer()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("stage", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer()),
        sa.Column("is_default", sa.Boolean()),
        sa.Column("created_at", sa.DateTime()),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("resource_type", sa.String(80)),
        sa.Column("resource_id", sa.String()),
        sa.Column("summary", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
    )

    op.create_table(
        "legal_articles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("law_name", sa.String(200), nullable=False),
        sa.Column("article_no", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200)),
        sa.Column("content", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.UniqueConstraint("law_name", "article_no", name="uq_legal_article"),
    )


def downgrade():
    op.drop_table("legal_articles")
    op.drop_table("audit_logs")
    op.drop_table("prompt_templates")
    op.drop_table("channels")
    op.drop_table("workflow_nodes")
    op.drop_table("case_documents")
    op.drop_table("background_tasks")
    op.drop_table("materials")
    op.drop_table("cases")
    op.drop_table("team_members")
    op.drop_table("teams")
    op.drop_table("case_templates")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
    sa.Enum(name="casestatus").drop(op.get_bind(), checkfirst=True)
