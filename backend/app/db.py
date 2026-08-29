"""SQLAlchemy engine, session, declarative Base.

SQLite in WAL mode with foreign keys ON and a 5s busy timeout so that
concurrent requests (uvicorn runs sync endpoints in a threadpool) serialize
their writes safely instead of raising "database is locked".

Datetimes are stored as naive UTC (datetime.utcnow). Outputs are converted to
aware UTC at the API boundary (see app.services.aware).
"""
from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


_connect_args: dict = {}
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
if _is_sqlite:
    _connect_args = {"check_same_thread": False, "timeout": 5}

engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args, echo=False)


if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record) -> None:  # pragma: no cover - trivial
        cur = dbapi_conn.cursor()
        try:
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA busy_timeout=5000")
        finally:
            cur.close()


SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, expire_on_commit=False, bind=engine
)


class Base(DeclarativeBase):
    """Declarative base for ORM models."""


def get_db():
    """FastAPI dependency that yields a request-scoped DB session.

    One session per request; endpoints commit explicitly. Anything left
    uncommitted is rolled back when the request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables on startup (idempotent; upgrades an existing DB in place).

    Only *new* tables are created — the legacy `users` table keeps its columns.
    """
    # Import models so they register with the metadata.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
