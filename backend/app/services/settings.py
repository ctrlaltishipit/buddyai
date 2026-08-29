"""User settings: lazy get-or-create with sensible defaults."""
from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import User, UserSettings
from ..schemas import UserSettingsOut
from . import aware


def get_or_create_settings(db: Session, user: User) -> UserSettings:
    """Return the user's settings row, creating defaults if missing.

    Legacy users (created before settings existed, already verified) start at
    onboarding_step="name" so they still walk name -> companion -> goals ->
    reminder. Unverified users start at "verify".

    Safe under concurrent first requests: a lost race on INSERT is caught via
    a savepoint and the winner's row is returned.
    """
    row = db.get(UserSettings, user.id)
    if row is not None:
        return row

    row = UserSettings(
        user_id=user.id,
        onboarding_step="name" if user.verified else "verify",
    )
    try:
        with db.begin_nested():
            db.add(row)
            db.flush()
    except IntegrityError:
        db.expire_all()
        existing = db.get(UserSettings, user.id)
        if existing is None:  # pragma: no cover - defensive
            raise
        return existing
    db.commit()
    return row


def settings_out(row: UserSettings) -> UserSettingsOut:
    return UserSettingsOut(
        display_name=row.display_name,
        companion=row.companion,
        topics=row.topics,
        reminder_time=row.reminder_time,
        reminder_days=row.reminder_days,
        reminders_enabled=row.reminders_enabled,
        region=row.region,
        tone=row.tone,
        consent_nlp=row.consent_nlp,
        consent_voice=row.consent_voice,
        consent_crash=row.consent_crash,
        onboarding_step=row.onboarding_step,
        onboarding_complete=row.onboarding_complete,
        updated_at=aware(row.updated_at),
    )
