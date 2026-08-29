"""/entries — journal entries. Every query is scoped to the current user."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import get_current_user
from ..models import JournalEntry, User
from ..schemas import EntryCreate, EntryList, EntryOut, EntryPatch
from ..services import aware, now_utc, parse_iso_utc
from ..services.entries import apply_analysis, entry_out, set_emotions


router = APIRouter(prefix="/entries", tags=["entries"])


def _encode_cursor(entry: JournalEntry) -> str:
    """Opaque page cursor: "<created_at ISO Z>|<id>" (id breaks created_at ties)."""
    stamp = aware(entry.created_at).isoformat().replace("+00:00", "Z")
    return "%s|%s" % (stamp, entry.id)


def _decode_cursor(cursor: str) -> Optional[Tuple[datetime, Optional[str]]]:
    """Parse a cursor; a bare ISO timestamp (pre-tiebreak clients) still works."""
    raw, _, last_id = cursor.partition("|")
    stamp = parse_iso_utc(raw)
    if stamp is None:
        return None
    return stamp, (last_id or None)


def _owned(db: Session, user: User, entry_id: str) -> JournalEntry:
    """Fetch an entry by id *and* owner. Anyone else's entry is a plain 404."""
    entry = (
        db.query(JournalEntry)
        .options(selectinload(JournalEntry.emotions))
        .filter(JournalEntry.id == entry_id, JournalEntry.user_id == user.id)
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.get("", response_model=EntryList)
def list_entries(
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="next_cursor from the previous page"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EntryList:
    q = (
        db.query(JournalEntry)
        .options(selectinload(JournalEntry.emotions))
        .filter(JournalEntry.user_id == user.id)
    )
    if cursor:
        decoded = _decode_cursor(cursor)
        if decoded is None:
            raise HTTPException(status_code=422, detail="cursor must be a next_cursor value from a previous page")
        cursor_dt, last_id = decoded
        if last_id:
            # Keyset on (created_at desc, id desc): identical timestamps can't be skipped or repeated.
            q = q.filter(
                or_(
                    JournalEntry.created_at < cursor_dt,
                    and_(JournalEntry.created_at == cursor_dt, JournalEntry.id < last_id),
                )
            )
        else:
            q = q.filter(JournalEntry.created_at < cursor_dt)

    rows = (
        q.order_by(JournalEntry.created_at.desc(), JournalEntry.id.desc())
        .limit(limit + 1)
        .all()
    )
    has_more = len(rows) > limit
    rows = rows[:limit]
    total = (
        db.query(func.count(JournalEntry.id))
        .filter(JournalEntry.user_id == user.id)
        .scalar()
        or 0
    )
    next_cursor = _encode_cursor(rows[-1]) if has_more and rows else None
    return EntryList(items=[entry_out(r) for r in rows], next_cursor=next_cursor, total=total)


@router.post("", response_model=EntryOut, status_code=status.HTTP_201_CREATED)
def create_entry(
    body: EntryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EntryOut:
    now = now_utc()
    entry = JournalEntry(
        id=str(uuid.uuid4()),
        user_id=user.id,
        template=body.template,
        created_at=now,
        updated_at=now,
    )
    ai_emotions = apply_analysis(entry, body.text)
    set_emotions(entry, user.id, body.emotions, ai_emotions)
    db.add(entry)
    db.commit()
    return entry_out(entry)


@router.get("/{entry_id}", response_model=EntryOut)
def get_entry(
    entry_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EntryOut:
    return entry_out(_owned(db, user, entry_id))


@router.patch("/{entry_id}", response_model=EntryOut)
def patch_entry(
    entry_id: str,
    body: EntryPatch,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EntryOut:
    entry = _owned(db, user, entry_id)
    changes = body.model_dump(exclude_unset=True)

    ai_emotions = None
    if changes.get("text") is not None:
        ai_emotions = apply_analysis(entry, body.text)
    if changes.get("template") is not None:
        entry.template = body.template
    if changes.get("emotions") is not None:
        # Replace the set with exactly what the client sent (empty list -> AI fallback).
        set_emotions(entry, user.id, body.emotions, ai_emotions if ai_emotions is not None else [])
    entry.updated_at = now_utc()
    db.commit()
    db.refresh(entry)
    return entry_out(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_entry(
    entry_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    entry = _owned(db, user, entry_id)
    db.delete(entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
