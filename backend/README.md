# Buddy Backend

FastAPI + SQLAlchemy 2.0 + SQLite backend for buddy.ai. Python 3.9.

Everything a user owns (settings, journal entries, emotions) is stored **per user** and
deleted with the account. Every owner-scoped query filters by the signed-in user's id —
another user's row is a plain `404`, never a `403`, never a leak.

## Setup

```bash
cd web/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt          # + requirements-dev.txt for tests
uvicorn app.main:app --reload --port 8000
```

API docs at http://localhost:8000/docs

Env vars: `BUDDY_SECRET_KEY` (REQUIRED, 32+ random chars, no fallback; generate one with
`python3 -c 'import secrets; print(secrets.token_urlsafe(48))'` and put it in `backend/.env`; the server refuses to boot
without it), `BUDDY_DATABASE_URL` (default `sqlite:///./buddy.db`),
`BUDDY_SMTP_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_FROM` / `_TLS`. Without `BUDDY_SMTP_HOST`
emails are printed to the console and signup/resend responses include `verification.dev_code`
(never when SMTP is configured).

## Tests

```bash
.venv/bin/pytest -q
```

`tests/conftest.py` points `BUDDY_DATABASE_URL` at a temp file before importing the app, so the
suite never touches `buddy.db`. It covers auth + verification, settings validation, entry CRUD and
cursor pagination, cross-user isolation, concurrent writes across users, account-deletion cascade,
and insights (streak / leaning / buckets) with timezone offsets.

## Endpoints

Auth = `Authorization: Bearer <JWT>`. Timestamps are ISO-8601 UTC with a trailing `Z`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | – | Create account (201). Returns token, user, settings, verification info (`dev_code` in local dev). 409 if email exists. |
| POST | `/auth/login` | – | Get JWT + user + settings. 401 on bad credentials. |
| GET | `/auth/me` | ✓ | Current user + settings. |
| POST | `/auth/verify` | ✓ | Submit 6-digit code. 400 wrong, 429 after 5 wrong, 410 expired. Idempotent once verified. |
| POST | `/auth/resend-code` | ✓ | New code (429 within 30 s of the last one). `{sent:false}` if already verified. |
| POST | `/auth/forgot-password` | – | Emails a temporary password. Always 200. |
| POST | `/auth/change-password` | ✓ | `{current_password,new_password}`. 400 if current is wrong. |
| DELETE | `/auth/me` | ✓ | `{password}` → 204. Deletes the user and everything they own. |
| GET | `/settings` | ✓ | User settings (lazily created with defaults). |
| PATCH | `/settings` | ✓ | Partial update; only provided fields change. `onboarding_complete:true` also sets `onboarding_step:"done"`. |
| GET | `/entries?limit=20&cursor=` | ✓ | Newest first; `next_cursor` = `created_at` of the last item when more exist; `total` = user's count. |
| POST | `/entries` | ✓ | Create (201). Server computes word count, sentiment, intensity, keywords, crisis flag; AI emotions if none sent. |
| GET | `/entries/{id}` | ✓ | One entry (404 if not yours). |
| PATCH | `/entries/{id}` | ✓ | Update text/template/emotions; analysis recomputed when text changes. |
| DELETE | `/entries/{id}` | ✓ | 204. |
| GET | `/insights/summary?tz_offset=` | ✓ | This week / today / streak / leaning / totals. `tz_offset` = minutes east of UTC. |
| GET | `/insights/map?range=week\|month\|all&tz_offset=` | ✓ | Buckets, top-3 emotion series, mix, 3 cards, rule-based noticings. |
| GET | `/me/export` | ✓ | Everything the user owns as one JSON payload. |
| POST | `/analyze` | – | Stateless emotion analysis (text discarded after response). |
| POST | `/reflector` | – | Non-directive Reflector turn. |
| POST | `/crisis-check` | – | Crisis keyword check + region resources. |
| GET | `/health` | – | Liveness. |

## Data model

SQLite (WAL, `foreign_keys=ON`, `busy_timeout=5000`). `Base.metadata.create_all()` runs on startup
and upgrades an existing `buddy.db` in place — the `users` table keeps its original columns; all new
data lives in new tables with `ON DELETE CASCADE`.

| Table | Notes |
|---|---|
| `users` | id, email, hashed_password, verified, plan_tier, created_at |
| `user_settings` | 1:1 with users. Lazily created; legacy verified users start at `onboarding_step="name"`. |
| `email_verifications` | 1:1. `code_hash` = sha256(code + SECRET_KEY), 15-minute expiry, attempt counter, resend cooldown. |
| `journal_entries` | Per-user entries + analysis fields. Indexed on `(user_id, created_at)`. |
| `entry_emotions` | Per-entry emotions with a denormalized `user_id` for cheap aggregation. Indexed on `(user_id, emotion)`. |

## Concurrency

One DB session per request (`get_db`), `expire_on_commit=False`, explicit commit per request.
Uvicorn runs the sync endpoints in a threadpool; SQLite WAL + `busy_timeout` serializes writes safely.

## Privacy commitments

- `/analyze`, `/reflector`, `/crisis-check` are stateless — request bodies are never written to disk.
- Journal data is only ever readable by its owner, and `DELETE /auth/me` removes all of it.
- All Reflector outputs pass through a hard-constraint filter (no diagnose, no prescribe, no advice).
