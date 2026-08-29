"""Service layer: business logic shared by routers.

Also home to the tiny datetime helpers every service uses. The DB stores naive
UTC; the API returns aware UTC (serialized by Pydantic with a trailing "Z").
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional


def now_utc() -> datetime:
    """Naive UTC 'now' — the DB convention."""
    return datetime.utcnow()


def aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Naive-UTC (DB) -> aware UTC (API). Aware inputs are normalized to UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def naive_utc(dt: datetime) -> datetime:
    """Aware or naive -> naive UTC (DB)."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def parse_iso_utc(value: str) -> Optional[datetime]:
    """Parse an ISO-8601 timestamp (accepts trailing 'Z') into naive UTC."""
    raw = value.strip()
    if raw.endswith("Z") or raw.endswith("z"):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    return naive_utc(parsed)


def local_date(dt: datetime, tz_offset: int):
    """The caller's local calendar date for a naive-UTC instant."""
    return (dt + timedelta(minutes=tz_offset)).date()
