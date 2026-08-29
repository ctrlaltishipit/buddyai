"""/reflector — non-directive companion turn."""
from __future__ import annotations

from fastapi import APIRouter

from .. import reflector
from ..schemas import ReflectorRequest, ReflectorResponse


router = APIRouter(tags=["reflector"])


@router.post("/reflector", response_model=ReflectorResponse)
def reflector_turn(body: ReflectorRequest) -> ReflectorResponse:
    result = reflector.generate(
        history_len=len(body.history),
        user_input=body.user_input,
        dominant_emotion=body.dominant_emotion,
    )
    return ReflectorResponse(**result)
