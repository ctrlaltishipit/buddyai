"""/analyze — stateless emotion + crisis analysis (PRD §9.3, §11.4).

Request body is processed in-memory and discarded. No DB writes.
"""
from __future__ import annotations

from fastapi import APIRouter

from .. import crisis, nlp
from ..schemas import AnalyzeRequest, AnalyzeResponse, EmotionScore


router = APIRouter(tags=["analyze"])


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    flagged, _ = crisis.detect(body.text)
    result = nlp.analyze(body.text)
    return AnalyzeResponse(
        emotions=[EmotionScore(**e) for e in result["emotions"]],
        sentiment=result["sentiment"],
        intensity=result["intensity"],
        keywords=result["keywords"],
        is_crisis_flagged=flagged,
    )
