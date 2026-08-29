"""Reflector turn generator: valence-aware validation."""
from app import reflector


def _validate_turn(text, dominant=None):
    out = reflector.generate(history_len=0, user_input=text, dominant_emotion=dominant)
    assert out["turn"] == "validate" and not out["redirect_to_crisis"]
    return out["text"]


def test_positive_message_gets_positive_validation():
    for _ in range(20):
        text = _validate_turn("Today was actually kind of good, I felt calm for once")
        assert text in reflector._VALIDATE_POSITIVE_TEMPLATES
        assert "heavy" not in text


def test_negative_message_keeps_heavy_validation():
    for _ in range(20):
        text = _validate_turn("Everything feels heavy and I am so tired of it all")
        assert text in reflector._VALIDATE_TEMPLATES


def test_hedged_positive_is_not_treated_as_positive():
    for _ in range(20):
        text = _validate_turn("I guess today was good but I still feel anxious underneath")
        assert text in reflector._VALIDATE_TEMPLATES


def test_no_dashes_in_templates():
    for pool in (reflector._VALIDATE_TEMPLATES, reflector._VALIDATE_POSITIVE_TEMPLATES,
                 reflector._MIRROR_TEMPLATES, reflector._ASK_TEMPLATES, reflector._GREETING_TEMPLATES):
        for t in pool:
            assert "\u2014" not in t and "\u2013" not in t
