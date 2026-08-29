"""Journal entry helpers shared by the entries + export routers."""
from __future__ import annotations

import re
from typing import List, Optional

from .. import crisis, nlp
from ..models import EntryEmotion, JournalEntry
from ..schemas import EmotionScore, EntryOut
from . import aware

MAX_EMOTIONS = 8


def word_count(text: str) -> int:
    return len(re.findall(r"\S+", text))


def apply_analysis(entry: JournalEntry, text: str) -> List[dict]:
    """Recompute server-side analysis fields for `text`; returns nlp emotions."""
    result = nlp.analyze(text)
    flagged, _ = crisis.detect(text)
    entry.text = text
    entry.word_count = word_count(text)
    entry.sentiment = float(result["sentiment"])
    entry.intensity = float(result["intensity"])
    entry.keywords = list(result["keywords"])
    entry.is_crisis_flagged = bool(flagged)
    return list(result["emotions"])


def set_emotions(
    entry: JournalEntry,
    user_id: str,
    client_emotions: Optional[List[EmotionScore]],
    ai_emotions: List[dict],
) -> None:
    """Replace the entry's emotion set.

    Client-provided emotions are stored verbatim (they already carry
    confirmed/source). If the client sent none, fall back to the analyzer's top
    emotions as unconfirmed "ai" suggestions.
    """
    rows: List[EntryEmotion] = []
    if client_emotions:
        for e in client_emotions[:MAX_EMOTIONS]:
            rows.append(
                EntryEmotion(
                    user_id=user_id,
                    emotion=e.emotion,
                    score=float(e.score),
                    confirmed=bool(e.confirmed),
                    source=e.source,
                )
            )
    else:
        for e in ai_emotions[:MAX_EMOTIONS]:
            rows.append(
                EntryEmotion(
                    user_id=user_id,
                    emotion=str(e["emotion"]).strip().lower(),
                    score=float(e["score"]),
                    confirmed=False,
                    source="ai",
                )
            )
    entry.emotions = rows


def entry_out(entry: JournalEntry) -> EntryOut:
    return EntryOut(
        id=entry.id,
        created_at=aware(entry.created_at),
        updated_at=aware(entry.updated_at),
        template=entry.template,
        text=entry.text,
        word_count=entry.word_count,
        sentiment=entry.sentiment,
        intensity=entry.intensity,
        keywords=entry.keywords,
        is_crisis_flagged=entry.is_crisis_flagged,
        emotions=[
            EmotionScore(
                emotion=em.emotion,
                score=max(0.0, min(1.0, em.score)),
                confirmed=em.confirmed,
                source=em.source if em.source in ("ai", "user") else "ai",
            )
            for em in entry.emotions
        ],
    )
