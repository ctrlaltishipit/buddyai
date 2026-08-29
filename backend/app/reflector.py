"""The Reflector — non-directive companion turn generator.

Hard rules (PRD §13.2):
  - Never diagnose, prescribe, or give medical/legal/financial advice.
  - Never claim to be human.
  - On crisis content, return only crisis redirect — never reflect.

Each turn is one of: validate / mirror / ask. Output is run through
`_strip_violations` as a defense-in-depth check before returning.
"""
from __future__ import annotations

import random
import re
from typing import Literal

from . import crisis


Turn = Literal["validate", "mirror", "ask", "crisis"]


# ---------- Banned content patterns ----------

_BANNED_PATTERNS = [
    # Diagnostic claims
    re.compile(r"\byou\s+(sound|seem|are|might be|may be)\s+(depressed|anxious|bipolar|ocd|adhd|ptsd)\b", re.I),
    re.compile(r"\bthis\s+(is|sounds like)\s+(depression|anxiety|trauma|ptsd|ocd|adhd)\b", re.I),
    # Prescriptive advice
    re.compile(r"\byou\s+should\b", re.I),
    re.compile(r"\bhave\s+you\s+tried\b", re.I),
    re.compile(r"\bi\s+(suggest|recommend|advise)\b", re.I),
    re.compile(r"\bthe\s+best\s+thing\s+(is|would be|to do)\b", re.I),
    # Claiming to be human
    re.compile(r"\bas\s+a\s+(person|human|friend)\b", re.I),
    re.compile(r"\bi'?m\s+(a\s+)?(human|person)\b", re.I),
]


def _violates(text: str) -> bool:
    return any(p.search(text) for p in _BANNED_PATTERNS)


# ---------- Templates ----------

_VALIDATE_TEMPLATES = [
    "What you're carrying sounds heavy. It makes sense that you'd feel this way.",
    "That's a lot to sit with. Your feelings about it are valid.",
    "It sounds like this is taking real space in you right now. That's okay.",
    "I hear you. What you're feeling is real, and it's allowed to be here.",
]

# Used instead of the heavy set when the message reads as clearly positive.
_VALIDATE_POSITIVE_TEMPLATES = [
    "That sounds like it landed well. What made today feel that way?",
    "It's good to hear something lighter in there. That deserves a moment too.",
    "There's some warmth in what you wrote. It's worth noticing when that shows up.",
    "That sounds like a good place to be. What helped it feel that way?",
]

_POSITIVE_WORDS = re.compile(
    r"\b(good|great|calm|calmer|grateful|gratitude|better|proud|relieved|relief|happy|"
    r"joy|joyful|peaceful|content|lighter|hopeful|excited|glad|nice|lovely|okay|ok)\b",
    re.I,
)
_NEGATIVE_WORDS = re.compile(
    r"\b(not|no|never|isn't|wasn't|don't|didn't|can't|couldn't|but|sad|anxious|anxiety|heavy|hard|"
    r"awful|bad|terrible|tired|exhausted|worried|scared|afraid|angry|lonely|hurt|stressed|"
    r"stress|overwhelmed|numb|empty|hopeless|guilty|ashamed|frustrated|upset|cry|crying)\b",
    re.I,
)


def _is_positive(text: str, dominant_emotion: str | None) -> bool:
    """Simple valence check: positive words present, no negative or hedging words."""
    if dominant_emotion in ("joy", "gratitude", "calm", "pride", "relief", "love", "hope"):
        return not _NEGATIVE_WORDS.search(text)
    return bool(_POSITIVE_WORDS.search(text)) and not _NEGATIVE_WORDS.search(text)


_MIRROR_TEMPLATES = [
    "So {feeling} is showing up around this. {fragment}",
    "I'm hearing {feeling} in what you wrote, especially when you mention {fragment}",
    "There's {feeling} threaded through this. {fragment}",
]

_ASK_TEMPLATES = [
    "When you notice this feeling, where do you feel it in your body?",
    "If this feeling could speak, what do you think it would want you to know?",
    "What was happening in the moments just before this feeling showed up?",
    "Is there a part of you that knows what it needs right now, even if it's small?",
    "What would it mean to give yourself a little more room with this?",
    "Has this feeling visited you before? What did it look like then?",
]

_GREETING_TEMPLATES = [
    "I'm here. Take your time. Whatever's on your mind is okay to bring.",
    "Hi. Whatever's here for you today, I'm listening.",
    "Hey. There's no agenda here. What's present for you?",
]


def _pick_feeling(dominant_emotion: str | None, text: str) -> str:
    if dominant_emotion:
        return dominant_emotion
    # Light fallback: look for an emotion word in text.
    lower = text.lower()
    for word in ("anxious", "sad", "frustrated", "tired", "grateful", "lonely", "angry", "scared"):
        if word in lower:
            return word
    return "something"


def _short_fragment(text: str) -> str:
    """Pull a brief noun-ish fragment to mirror back, without analyzing."""
    cleaned = re.sub(r"[\n\r]+", " ", text).strip()
    # Take the first 8 words after stripping leading filler.
    words = cleaned.split()
    if not words:
        return ""
    snippet = " ".join(words[:10])
    if len(words) > 10:
        snippet = snippet + "…"
    return snippet


def _choose_turn(history_len: int) -> Turn:
    """Cycle validate → mirror → ask so turns vary across a conversation."""
    rotation: list[Turn] = ["validate", "mirror", "ask"]
    return rotation[history_len % len(rotation)]


def _strip_violations(text: str) -> str:
    """If a template somehow includes a banned pattern, replace with a safe fallback."""
    if _violates(text):
        return "I hear you. I want to make sure I'm really listening before saying more. What's most present for you right now?"
    return text


def generate(history_len: int, user_input: str, dominant_emotion: str | None) -> dict:
    # 1. Crisis takes priority over anything else.
    flagged, _ = crisis.detect(user_input)
    if flagged:
        return {
            "turn": "crisis",
            "text": (
                "What you just shared sounds really hard. Before we go further, "
                "I want to make sure you can reach someone who's trained to help "
                "right now."
            ),
            "redirect_to_crisis": True,
        }

    # 2. First turn → warm greeting.
    if history_len == 0 and len(user_input.strip()) < 12:
        return {
            "turn": "validate",
            "text": _strip_violations(random.choice(_GREETING_TEMPLATES)),
            "redirect_to_crisis": False,
        }

    turn = _choose_turn(history_len)
    feeling = _pick_feeling(dominant_emotion, user_input)
    fragment = _short_fragment(user_input)

    if turn == "validate":
        pool = _VALIDATE_POSITIVE_TEMPLATES if _is_positive(user_input, dominant_emotion) else _VALIDATE_TEMPLATES
        text = random.choice(pool)
    elif turn == "mirror":
        template = random.choice(_MIRROR_TEMPLATES)
        text = template.format(feeling=feeling, fragment=f'"{fragment}"' if fragment else "what you shared.")
    else:  # ask
        text = random.choice(_ASK_TEMPLATES)

    return {
        "turn": turn,
        "text": _strip_violations(text),
        "redirect_to_crisis": False,
    }
