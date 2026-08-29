"""Runtime configuration. In production these come from env vars."""
from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path
from typing import List, Optional


def _load_dotenv() -> None:
    """Tiny .env loader (no extra dep).

    Looks for a .env file in cwd. Lines like KEY=value are loaded into
    os.environ unless already set. Quotes around values are stripped.
    """
    candidates = [Path.cwd() / ".env", Path(__file__).resolve().parents[1] / ".env"]
    p = next((c for c in candidates if c.exists()), None)
    if p is None:
        return
    try:
        for raw in p.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception:
        # Bad .env shouldn't crash the server.
        pass


_load_dotenv()


# The placeholder that used to ship as the fallback. It is public (it is in
# this file's history), so a token signed with it must never be honored.
_PLACEHOLDER_SECRETS = {
    "dev-secret-change-me-in-production-this-is-only-for-local",
}
MIN_SECRET_KEY_LENGTH = 32


def require_secret_key(value: Optional[str]) -> str:
    """Fail fast on a missing, placeholder, or weak JWT secret.

    Every access token and verification code hash is keyed on this value, so a
    known secret means anyone can mint a token for any user id. Refusing to
    boot is the only safe default.
    """
    key = (value or "").strip()
    if not key or key in _PLACEHOLDER_SECRETS or len(key) < MIN_SECRET_KEY_LENGTH:
        raise RuntimeError(
            "BUDDY_SECRET_KEY is missing, a known placeholder, or shorter than "
            "%d characters. Set a strong random secret per deployment, e.g. "
            "python3 -c 'import secrets; print(secrets.token_urlsafe(48))' "
            "and put BUDDY_SECRET_KEY=<value> in backend/.env or the environment."
            % MIN_SECRET_KEY_LENGTH
        )
    return key


class Settings:
    PROJECT_NAME: str = "Buddy API"
    VERSION: str = "0.1.0"

    # Auth. No fallback on purpose: see require_secret_key.
    SECRET_KEY: str = require_secret_key(os.getenv("BUDDY_SECRET_KEY"))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRES: timedelta = timedelta(days=14)

    # Email verification
    VERIFICATION_TTL: timedelta = timedelta(minutes=15)
    VERIFICATION_MAX_ATTEMPTS: int = 5
    VERIFICATION_RESEND_COOLDOWN: timedelta = timedelta(seconds=30)

    # DB
    DATABASE_URL: str = os.getenv(
        "BUDDY_DATABASE_URL", "sqlite:///./buddy.db"
    )

    # CORS — Vite dev server + common LAN dev origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        # phone-on-same-wifi access falls back to wildcard regex below
    ]
    CORS_ORIGIN_REGEX: str = r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$"


settings = Settings()
