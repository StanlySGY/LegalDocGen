from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings

engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _ensure_existing_columns():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "cases" in table_names:
        columns = {column["name"] for column in inspector.get_columns("cases")}
        if "template_id" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE cases ADD COLUMN template_id VARCHAR(36)"))
        if "owner_id" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE cases ADD COLUMN owner_id VARCHAR(36)"))

    if "channels" in table_names:
        from backend.models.channel import Channel
        from backend.services.secret_service import encrypt_secret
        db = SessionLocal()
        try:
            changed = False
            for channel in db.query(Channel).all():
                if channel.api_key and not channel.api_key.startswith("enc:"):
                    channel.api_key = encrypt_secret(channel.api_key)
                    changed = True
            if changed:
                db.commit()
        finally:
            db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from backend.models import case, material, workflow, prompt, channel, case_template, audit, user  # noqa
    Base.metadata.create_all(bind=engine)
    _ensure_existing_columns()
