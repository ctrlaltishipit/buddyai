# buddy.ai — Notes for Claude (and future-you)

Read this once before making changes. It is the memory layer for working in `web/`.

> **Tagline:** The journal that listens back.
> buddy.ai is a journaling app with a non-directive AI companion ("The Reflector") and an
> emotion map. v2 (Aug 2026) is a full redesign: dark marketing/auth surfaces, a light
> signed-in app, a morphing gradient mascot, and a real per-user backend.

The **visual spec** is `design/buddy-redesign.reference.html` (Claude Design export).
Every color, radius, size and line of copy comes from there. When in doubt, open it.

---

## Project layout

```
web/
├── index.html                    Google Fonts (Bricolage Grotesque + Plus Jakarta Sans), PWA meta
├── design/buddy-redesign.reference.html   THE DESIGN SPEC (read-only reference)
├── public/                       manifest + icons
├── src/
│   ├── main.tsx                  BrowserRouter + StoreProvider
│   ├── styles/
│   │   ├── index.css             @import tailwindcss + globals.css
│   │   └── globals.css           @theme tokens + all shared classes (.btn-grad, .card-light, .app-shell …)
│   └── app/
│       ├── App.tsx               Routes + guards (RequireOnboarded / AuthGate / RedirectIfOnboarded), toast host
│       ├── routes/               Landing, Auth, SignupFlow (7-step wizard), AppShell,
│       │                         Home, Journal, EmotionMap, Reflector, Settings
│       ├── components/           BuddyBlob (mascot), Logo, EmotionPill, FieldDark, CrisisModal, EmotionChart
│       └── lib/
│           ├── types.ts          MIRROR of backend/app/schemas.py — keep in sync
│           ├── api.ts            fetch wrapper; JWT in localStorage `buddy_token`; 401 → `buddy:unauthorized`
│           ├── store.tsx         session (user + settings), crisis modal, toasts, entriesVersion
│           ├── constants.ts      COMPANIONS, TOPICS, TEMPLATES, greetings/date helpers
│           ├── mood-colors.ts    the ONLY place emotion → color lives
│           └── useAsync.ts       tiny fetch hook
└── backend/                      FastAPI + SQLAlchemy 2.0 + SQLite (Python 3.9!)
    ├── requirements.txt / requirements-dev.txt (pytest, httpx)
    ├── app/
    │   ├── main.py               app factory, CORS, routers
    │   ├── config.py             env-driven settings; tiny .env loader
    │   ├── db.py                 engine (WAL, foreign_keys, busy_timeout), session, Base
    │   ├── models.py             users, user_settings, email_verifications, journal_entries, entry_emotions
    │   ├── schemas.py            THE API CONTRACT (Pydantic) — mirrored by src/app/lib/types.ts
    │   ├── deps.py               get_current_user (Bearer JWT)
    │   ├── security.py           bcrypt + JWT
    │   ├── mailer.py             SMTP, console fallback in dev
    │   ├── nlp.py / crisis.py / reflector.py   stateless analysis
    │   ├── services/             settings defaults, insights (streak, leaning, map, cards, noticings)
    │   └── routers/              auth, settings, entries, insights, export, analyze, reflector, crisis, health
    └── tests/                    pytest: auth, settings, entries, isolation, concurrency, insights
```

Removed in v2 (Aug 2026): everything from the Figma Make export — prototype components, shadcn `ui/`,
Supabase/config leftovers, `default_theme.css`, `guidelines/`, the root `figma-make-bundle/`.
A tarball of the pre-redesign tree is at the repo root (`_backup-pre-redesign-2026-08-27.tgz`).

---

## How to run

```bash
# one-time
npm install
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && cd ..

# terminal 1 — API on :8000 (cwd = backend so it uses backend/buddy.db)
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# terminal 2 — Vite on :5173
npm run dev            # add `-- --host` for phone testing on the LAN
```

Checks: `npm run typecheck` · `npm run build` · `cd backend && .venv/bin/pytest -q`.
API docs: http://localhost:8000/docs.

The **Python venv is 3.9** (Apple CLT). Write `Optional[X]` / `List[X]`, never `X | None`, in anything
Pydantic/FastAPI evaluates at runtime.

---

## Environment variables

| Var | Where | Default |
|---|---|---|
| `VITE_API_BASE_URL` | frontend | `http://localhost:8000` |
| `BUDDY_SECRET_KEY` | backend | dev string in `config.py` — override in prod |
| `BUDDY_DATABASE_URL` | backend | `sqlite:///./buddy.db` |
| `BUDDY_SMTP_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_FROM` | backend | unset → mailer logs to console **and** signup responses include `verification.dev_code` (dev only; never set in prod without SMTP) |

---

## Data model + privacy (v2)

Every row except `users` carries `user_id` and is deleted with the user (cascade).
**Every read/write is filtered by the signed-in user's id. Cross-user ids return 404, never 403.**

- `users` — id, email, hashed_password, verified, plan_tier, created_at (unchanged from v1; don't add columns — the live DB has rows; put new fields in new tables so `create_all` upgrades in place).
- `user_settings` — display_name, companion (sage|sol|ember), topics, reminder_time/days/enabled, region (IN|US|OTHER), tone (warm|neutral|brief), consents (nlp/voice/crash), onboarding_step, onboarding_complete.
- `email_verifications` — hashed 6-digit code, expiry, attempts, last_sent_at.
- `journal_entries` — template, text, word_count, sentiment, intensity, keywords, is_crisis_flagged, timestamps.
- `entry_emotions` — emotion, score, confirmed, source (ai|user); user_id denormalized for cheap aggregation.

Privacy rules (still enforced):
1. `/analyze`, `/reflector`, `/crisis-check` are stateless — nothing is written.
2. Reflector chat history lives only in the browser tab; it is never saved.
3. Crisis detection runs **before** analysis; crisis-flagged text is never analyzed or saved from the client, and the crisis modal opens immediately.
4. Reflector output passes `_strip_violations()` — no diagnosing, no advice, no claiming to be human.
5. Forgot-password always returns the same 200 (no enumeration). Verification codes are stored hashed.
6. Users can export (`GET /me/export`) and delete (`DELETE /auth/me`) everything, one click.

Copy on the site says "private to your account" — never "stays on your device" (entries are server-side in v2).

---

## Auth + onboarding flow

`POST /auth/signup` → user (unverified) + settings(`onboarding_step="verify"`) + code emailed (console in dev) →
`POST /auth/verify {code}` → verified, step `name` → the wizard PATCHes `/settings` at each step
(`name → companion → goals → reminder → done`) → "Enter Buddy" sets `onboarding_complete=true`.

Routing guards in `App.tsx`: `/app/*` requires authed **and** onboarded (else → `/auth` or resume `/signup`);
`/auth` and `/signup` redirect onboarded users to `/app/home`. Legacy users (no settings row) resume at `name`.

Insights endpoints take `?tz_offset=<minutes east of UTC>` (sent automatically by `api.ts`) so
"today", streaks and buckets use the browser's local day.

---

## Design system (globals.css)

- **Type:** `--font-display` Bricolage Grotesque (headings, `.h-display`, `.font-display`), `--font-sans` Plus Jakarta Sans.
- **Dark surface** (`.surface-dark`): night `#0A0908`, snow `#F7F3EA`, fog `#B9B1A3`, dim `#7D766B`; brand gradient sun `#FFD23F` → orange `#FF7A1A` → ember `#F24E1E` (`.btn-grad`, `.text-gradient`, `.panel-grad`). Palette v2.1 (2026-08-28) is black / yellow / orange; light-app primary buttons (`.btn-acc`) are black, orange is the accent (`--color-acc` for fills, `--color-acc-ink` for text).
- **Light surface** (`.surface-light`): bg `#FAF7F1`, cards `#FFF` + line `#ECE6DC`, ink `#141210`, sub `#6B645A`, faint `#A39C90`, accent `--color-acc #E8590C` (+ `--color-acc2 #FFD23F`).
- **Emotion colors** only via `lib/mood-colors.ts` (`moodColor`, `moodDeep`, `moodTint`) → pills, chart threads, entry rails, "leaning".
- **Mascot:** `<BuddyBlob size colors eyes speed float />` — CSS morph + inset lighting + blinking, pointer-following eyes. Companion colors live in `constants.ts` (`COMPANIONS`).
- **Layout:** `.split-screen` (auth/signup; panel hides < 900px), `.app-shell` (264px sidebar → bottom `.app-tabbar` < 860px), `.grid-3/.grid-2` collapse < 720px, `.page` padding.
- Motion: keyframes `fade-up`, `drift-1/2`, `morph`, `float`, `dot-bounce`, `spark`, `blink`; reduced-motion handled globally.

Conventions: routes are PascalCase in `src/app/routes`; import from `"react-router"` (not `-dom`);
allowed deps are react, react-router, motion, lucide-react, clsx — nothing else without a reason.

---

## Verifying a change

1. `npm run typecheck && npm run build`.
2. `cd backend && .venv/bin/pytest -q` (isolation + concurrency tests must stay green).
3. Manual smoke: signup → verify with the dev code → finish the wizard → Journal: "I feel anxious about Monday" → confirm anxiety → Home shows 1 entry / streak 1 → Map shows the thread.
4. Crisis smoke: a crisis phrase in Journal or Reflector → modal opens, **nothing analyzed or saved**.

---

## Intentionally not in v2

Google sign-in (button shown, disabled; Apple removed on 2026-08-28), voice journaling, a persisted Reflector, time-off mode,
plan upgrades, real email delivery (until SMTP env vars are set).
