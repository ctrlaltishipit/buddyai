"""/insights — owner-scoped summary + emotion map."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, get_tz_offset
from ..models import User
from ..schemas import InsightsMap, InsightsSummary, MapRange
from ..services import insights as svc


router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/summary", response_model=InsightsSummary)
def summary(
    tz_offset: int = Depends(get_tz_offset),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InsightsSummary:
    return svc.summary(db, user.id, tz_offset)


@router.get("/map", response_model=InsightsMap)
def emotion_map(
    range: MapRange = Query("week"),
    tz_offset: int = Depends(get_tz_offset),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InsightsMap:
    return svc.emotion_map(db, user.id, range, tz_offset)
