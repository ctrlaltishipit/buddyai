"""/settings — per-user preferences (owner-scoped)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import SettingsPatch, UserSettingsOut
from ..services import now_utc
from ..services.settings import get_or_create_settings, settings_out


router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=UserSettingsOut)
def get_settings(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserSettingsOut:
    return settings_out(get_or_create_settings(db, user))


@router.patch("", response_model=UserSettingsOut)
def patch_settings(
    body: SettingsPatch,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserSettingsOut:
    row = get_or_create_settings(db, user)
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None:
            continue  # explicit nulls are not meaningful for any field; ignore
        setattr(row, field, value)
    if changes.get("onboarding_complete") is True:
        row.onboarding_step = "done"
    row.updated_at = now_utc()
    db.commit()
    return settings_out(row)
