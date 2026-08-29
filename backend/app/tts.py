"""Gemini text-to-speech.

Calls Gemini's REST API directly via urllib so we don't pull a heavyweight
SDK that may have Python-version constraints. Returns audio as WAV
(24 kHz, 16-bit, mono) ready to drop into an HTML <audio> tag.

Privacy note: the Reflector's response text is sent to Google to synthesize.
The /reflector/tts endpoint is only called when the user has explicitly
turned on the `voiceCloudTTS` consent in Settings.
"""
from __future__ import annotations

import base64
import json
import logging
import struct
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .config import settings


log = logging.getLogger("buddy.tts")

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_SAMPLE_RATE = 24000
_CHANNELS = 1
_BITS = 16


class TTSConfigError(RuntimeError):
    """GEMINI_API_KEY isn't set."""


class TTSCallError(RuntimeError):
    """Gemini returned an error or an unexpected response shape."""


def _wav_header(pcm_len: int) -> bytes:
    """44-byte WAV header for raw 24kHz / 16-bit / mono PCM."""
    byte_rate = _SAMPLE_RATE * _CHANNELS * _BITS // 8
    block_align = _CHANNELS * _BITS // 8
    return (
        b"RIFF"
        + struct.pack("<I", 36 + pcm_len)
        + b"WAVE"
        + b"fmt "
        + struct.pack(
            "<IHHIIHH",
            16,            # subchunk size
            1,             # PCM format
            _CHANNELS,
            _SAMPLE_RATE,
            byte_rate,
            block_align,
            _BITS,
        )
        + b"data"
        + struct.pack("<I", pcm_len)
    )


def synthesize(text: str, voice: Optional[str] = None) -> bytes:
    """Synthesize `text` and return WAV bytes.

    Raises TTSConfigError if no API key is set, TTSCallError on any
    upstream failure.
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise TTSConfigError(
            "GEMINI_API_KEY is not configured. Add it to ./.env or set it in your shell."
        )

    voice_name = voice or settings.GEMINI_TTS_VOICE
    url = f"{_GEMINI_BASE}/{settings.GEMINI_TTS_MODEL}:generateContent?key={api_key}"

    body = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": voice_name}
                }
            },
        },
    }

    req = Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:500]
        log.warning("Gemini TTS HTTP %s: %s", e.code, err_body)
        raise TTSCallError(
            f"Gemini TTS responded {e.code}. Check your API key + billing."
        ) from e
    except URLError as e:
        log.warning("Gemini TTS network: %s", e.reason)
        raise TTSCallError(f"Could not reach Gemini TTS: {e.reason}") from e

    try:
        b64 = payload["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
    except (KeyError, IndexError, TypeError) as e:
        log.warning("Gemini TTS payload shape: %s", payload)
        raise TTSCallError("Unexpected Gemini TTS response shape.") from e

    pcm = base64.b64decode(b64)
    return _wav_header(len(pcm)) + pcm


VOICES_HINT = {
    # The named voices that work well for the Reflector's warm, listening tone.
    "Kore": "warm, mid-pitch (default)",
    "Aoede": "softer, breathy",
    "Leda": "calm, slightly higher",
    "Callirhoe": "even, grounded",
    "Zephyr": "bright, conversational",
    "Charon": "lower, steady",
}
