"""SQLAlchemy ORM models.

Every table except `users` carries a `user_id` and is removed with the user
(ON DELETE CASCADE at the DB level; SQLite has foreign_keys=ON, see db.py).

`users` keeps its original columns so `Base.metadata.create_all()` can
upgrade an existing buddy.db in place — everything new lives in new tables.

Datetimes are naive UTC (datetime.utcnow) throughout.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _loads(value: Optional[str], default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except ValueError:
        return default


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    plan_tier: Mapped[str] = mapped_column(String, default="free", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships exist for convenience; deletion is handled by the DB's
    # ON DELETE CASCADE (passive_deletes) so a single DELETE removes everything.
    settings: Mapped[Optional["UserSettings"]] = relationship(
        "UserSettings", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )
    verification: Mapped[Optional["EmailVerification"]] = relationship(
        "EmailVerification", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )
    entries: Mapped[List["JournalEntry"]] = relationship(
        "JournalEntry", cascade="all, delete-orphan", passive_deletes=True
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str] = mapped_column(String, default="", nullable=False)
    companion: Mapped[str] = mapped_column(String, default="sage", nullable=False)
    topics_json: Mapped[str] = mapped_column("topics", Text, default="[]", nullable=False)
    reminder_time: Mapped[str] = mapped_column(String, default="21:00", nullable=False)
    reminder_days_json: Mapped[str] = mapped_column(
        "reminder_days", Text, default="[true, true, true, true, true, false, false]", nullable=False
    )
    reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    region: Mapped[str] = mapped_column(String, default="IN", nullable=False)
    tone: Mapped[str] = mapped_column(String, default="warm", nullable=False)
    consent_nlp: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    consent_voice: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consent_crash: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    onboarding_step: Mapped[str] = mapped_column(String, default="verify", nullable=False)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    @property
    def topics(self) -> List[str]:
        return list(_loads(self.topics_json, []))

    @topics.setter
    def topics(self, value: List[str]) -> None:
        self.topics_json = _dumps(list(value))

    @property
    def reminder_days(self) -> List[bool]:
        return list(_loads(self.reminder_days_json, [True, True, True, True, True, False, False]))

    @reminder_days.setter
    def reminder_days(self, value: List[bool]) -> None:
        self.reminder_days_json = _dumps([bool(v) for v in value])


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    code_hash: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_sent_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        Index("ix_journal_entries_user_created", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    template: Mapped[str] = mapped_column(String, default="freeform", nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sentiment: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    intensity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    keywords_json: Mapped[str] = mapped_column("keywords", Text, default="[]", nullable=False)
    is_crisis_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    emotions: Mapped[List["EntryEmotion"]] = relationship(
        "EntryEmotion",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="EntryEmotion.id",
    )

    @property
    def keywords(self) -> List[str]:
        return list(_loads(self.keywords_json, []))

    @keywords.setter
    def keywords(self, value: List[str]) -> None:
        self.keywords_json = _dumps(list(value))


class EntryEmotion(Base):
    __tablename__ = "entry_emotions"
    __table_args__ = (
        Index("ix_entry_emotions_user_emotion", "user_id", "emotion"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entry_id: Mapped[str] = mapped_column(
        String, ForeignKey("journal_entries.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Denormalized owner for cheap per-user aggregation (insights).
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    emotion: Mapped[str] = mapped_column(String, nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[str] = mapped_column(String, default="ai", nullable=False)
