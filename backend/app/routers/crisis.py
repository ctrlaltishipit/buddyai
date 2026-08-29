"""/crisis-check — keyword + region resource lookup."""
from __future__ import annotations

from fastapi import APIRouter

from .. import crisis as crisis_lib
from ..schemas import CrisisCheckRequest, CrisisCheckResponse, CrisisResource


router = APIRouter(tags=["crisis"])


@router.post("/crisis-check", response_model=CrisisCheckResponse)
def crisis_check(body: CrisisCheckRequest) -> CrisisCheckResponse:
    flagged, phrase = crisis_lib.detect(body.text)
    resources = [CrisisResource(**r) for r in crisis_lib.resources_for(body.locale)]
    return CrisisCheckResponse(flagged=flagged, matched_phrase=phrase, resources=resources)
