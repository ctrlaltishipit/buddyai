"""Server-side mirror of the client NLP heuristics.

Mirrors `src/app/lib/nlp-processor.ts` so the web fallback (PRD §9.3, §11.4)
produces results consistent with the on-device path.

This is intentionally a simple keyword + sentiment scorer for v1. The PRD
allows replacing this endpoint with a real model later; the contract stays
the same.
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Iterable


EMOTION_KEYWORDS: dict[str, list[str]] = {
    "joy": [
        "happy", "joyful", "excited", "delighted", "cheerful",
        "wonderful", "amazing", "great", "fantastic", "glad",
    ],
    "sadness": [
        "sad", "down", "depressed", "blue", "unhappy",
        "heartbroken", "miserable", "tearful", "low", "grief",
    ],
    "anxiety": [
        "anxious", "worried", "nervous", "stressed", "uneasy",
        "afraid", "panic", "tense", "overwhelmed", "restless",
    ],
    "frustration": [
        "frustrated", "annoyed", "angry", "irritated", "upset",
        "furious", "mad", "resentful", "exasperated",
    ],
    "gratitude": [
        "grateful", "thankful", "appreciate", "blessed",
        "fortunate", "lucky", "thanks",
    ],
    "love": ["love", "loved", "adore", "cherish", "fond", "warm"],
    "hope": [
        "hopeful", "optimistic", "looking forward", "excited about",
        "promising", "bright",
    ],
    "tiredness": [
        "tired", "exhausted", "drained", "sleepy", "fatigued",
        "burnt out", "worn out",
    ],
    "shame": ["ashamed", "embarrassed", "humiliated", "guilty", "regretful"],
}

POSITIVE_WORDS = {
    "happy", "good", "great", "love", "wonderful", "amazing",
    "fantastic", "excellent", "joyful", "grateful", "blessed",
    "hopeful", "calm", "peaceful", "content", "glad", "thankful",
    "proud", "confident", "warm",
}
NEGATIVE_WORDS = {
    "sad", "bad", "terrible", "hate", "awful", "horrible",
    "angry", "depressed", "anxious", "stressed", "worried",
    "scared", "fear", "lonely", "hopeless", "tired", "exhausted",
    "frustrated", "miserable",
}

STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
    "for", "of", "with", "by", "from", "is", "was", "are", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "i", "me", "my", "myself", "we", "us", "our", "you", "your",
    "he", "she", "it", "they", "them", "this", "that", "these",
    "those", "am", "as", "if", "then", "than", "so", "just",
    "really", "very", "too", "also", "about", "can", "will",
}


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\b[\w']+\b", text.lower())


def _emotion_scores(tokens: list[str]) -> list[dict]:
    counts: dict[str, int] = {}
    for emotion, kws in EMOTION_KEYWORDS.items():
        kw_set = set(kws)
        c = sum(1 for t in tokens if t in kw_set)
        if c:
            counts[emotion] = c

    if not counts:
        return []

    results: list[dict] = []
    for emotion, c in counts.items():
        score = min(0.5 + c * 0.15, 0.95)
        results.append({"emotion": emotion, "score": round(score, 3)})
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:3]


def _sentiment(tokens: list[str]) -> float:
    pos = sum(1 for t in tokens if t in POSITIVE_WORDS)
    neg = sum(1 for t in tokens if t in NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return 0.0
    return round((pos - neg) / total, 3)


def _keywords(tokens: Iterable[str], top_n: int = 8) -> list[str]:
    filtered = [t for t in tokens if t not in STOP_WORDS and len(t) > 2]
    return [w for w, _ in Counter(filtered).most_common(top_n)]


def _intensity(scores: list[dict]) -> float:
    if not scores:
        return 0.0
    return round(sum(s["score"] for s in scores) / len(scores), 3)


def analyze(text: str) -> dict:
    tokens = _tokenize(text)
    scores = _emotion_scores(tokens)
    return {
        "emotions": scores,
        "sentiment": _sentiment(tokens),
        "intensity": _intensity(scores),
        "keywords": _keywords(tokens),
    }
