# buddy.ai — web

React + Vite + Tailwind 4 frontend, FastAPI + SQLite backend.

The visual spec lives in [`design/buddy-redesign.reference.html`](design/buddy-redesign.reference.html).
Working notes for contributors (and Claude) are in [`CLAUDE.md`](CLAUDE.md).

## Run it

```bash
# one-time
npm install
(cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt)

# terminal 1 — API on :8000
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# terminal 2 — web on :5173
npm run dev
```

Open http://localhost:5173. API docs: http://localhost:8000/docs.

## Scripts

| command | what |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | production build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `cd backend && .venv/bin/pytest` | backend test-suite |
