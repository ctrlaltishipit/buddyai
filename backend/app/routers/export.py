"""/me/export — everything the signed-in user owns, as one JSON payload."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import get_current_user
from ..models import JournalEntry, User
from ..schemas import ExportPayload
from ..services import aware, now_utc
from ..services.entries import entry_out
from ..services.settings import get_or_create_settings, settings_out
from .auth import _to_public


router = APIRouter(prefix="/me", tags=["export"])


@router.get("/export", response_model=ExportPayload)
def export_all(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ExportPayload:
    entries = (
        db.query(JournalEntry)
        .options(selectinload(JournalEntry.emotions))
        .filter(JournalEntry.user_id == user.id)
        .order_by(JournalEntry.created_at.desc(), JournalEntry.id.desc())
        .all()
    )
    n = len(entries)
    note = (
        "This export contains your account details, your settings, and all %d journal "
        "%s with their emotions, keywords and analysis. Everything Buddy stores about you."
        % (n, "entry" if n == 1 else "entries")
    )
    return ExportPayload(
        exported_at=aware(now_utc()),
        user=_to_public(user),
        settings=settings_out(get_or_create_settings(db, user)),
        entries=[entry_out(e) for e in entries],
        note=note,
    )
