"""Crisis detection + region-aware resource cards.

Hybrid keyword check (PRD §13.1). v1 is keyword-only with light context
heuristics; a small classifier replaces this in v1.5.
"""
from __future__ import annotations

import re

# Order matters — longer phrases first so we report the most specific match.
CRISIS_PATTERNS: list[str] = [
    r"\bi\s+want\s+to\s+die\b",
    r"\bi\s+wish\s+i\s+(was|were)\s+dead\b",
    r"\bkill\s+myself\b",
    r"\bend\s+(it|my\s+life|things)\b",
    r"\b(cant|can'?t)\s+go\s+on\b",
    r"\bsuicide\b",
    r"\bsuicidal\b",
    r"\bself[\s-]?harm\b",
    r"\bhurt(ing)?\s+myself\b",
    r"\bcutting\s+myself\b",
    r"\boverdose\b",
    r"\bno\s+reason\s+to\s+live\b",
    r"\bgive\s+up\s+on\s+life\b",
]

# Light "joking-context" allowlist — phrases that defuse a match.
FALSE_POSITIVE_HINTS = [
    "laughing", "lmao", "lol", "meme", "joke", "kidding",
    "this song", "this scene", "in the movie", "in the show",
]


_compiled = [re.compile(p, re.IGNORECASE) for p in CRISIS_PATTERNS]


def detect(text: str) -> tuple[bool, str | None]:
    """Return (flagged, matched_phrase). Treat joking contexts conservatively."""
    if not text:
        return False, None
    lower = text.lower()
    for pat in _compiled:
        m = pat.search(lower)
        if m:
            # If a joking-context hint sits within ~40 chars, downgrade.
            window_start = max(0, m.start() - 40)
            window_end = min(len(lower), m.end() + 40)
            window = lower[window_start:window_end]
            if any(h in window for h in FALSE_POSITIVE_HINTS):
                # Stay conservative — only downgrade for very clear joking cues.
                if "laughing" in window or "lmao" in window or "this song" in window:
                    continue
            return True, m.group(0)
    return False, None


def resources_for(locale: str) -> list[dict]:
    locale = (locale or "").upper()
    if locale == "IN":
        return [
            {
                "label": "NIMHANS Helpline (India)",
                "phone": "080-46110007",
                "note": "National Institute of Mental Health and Neuro-Sciences",
            },
            {
                "label": "AASRA (India)",
                "phone": "+91-9820466726",
                "note": "24/7 helpline",
            },
            {
                "label": "iCall (India)",
                "phone": "+91-9152987821",
                "note": "Mon to Sat, 8am to 10pm",
            },
            {
                "label": "Vandrevala Foundation",
                "phone": "1860-2662-345",
                "note": "24/7 mental health helpline",
            },
        ]
    if locale == "US":
        return [
            {
                "label": "988 Suicide & Crisis Lifeline",
                "phone": "988",
                "text_line": "Text 988",
                "note": "24/7, US",
            },
            {
                "label": "Crisis Text Line",
                "text_line": "Text HOME to 741741",
                "note": "24/7, US/CA/UK/IE",
            },
            {
                "label": "Emergency",
                "phone": "911",
            },
        ]
    # Generic international fallback
    return [
        {
            "label": "Find a helpline (Find A Helpline)",
            "url": "https://findahelpline.com",
            "note": "Free, confidential support, worldwide",
        },
        {
            "label": "International Association for Suicide Prevention",
            "url": "https://www.iasp.info/resources/Crisis_Centres/",
        },
    ]
