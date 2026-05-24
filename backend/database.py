from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings

engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _ensure_existing_columns():
    inspector = inspect(engine)
    if "cases" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("cases")}
    if "template_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE cases ADD COLUMN template_id VARCHAR(36)"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from backend.models import case, material, workflow, prompt, channel, case_template  # noqa
    Base.metadata.create_all(bind=engine)
    _ensure_existing_columns()
