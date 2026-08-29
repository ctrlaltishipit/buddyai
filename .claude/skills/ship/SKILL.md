---
name: ship
description: Commit and push the current work to GitHub after a set of features is finished, with a hard audit that no secrets, .env files, databases or credentials go up. Use when the user says "push this", "save it to git", "ship it", or when a chunk of work is complete and worth committing.
---

# Ship to GitHub

Commit and push finished work to `ctrlaltishipit/buddyai`, refusing to proceed if
anything sensitive is staged.

## The rule that matters

**Never commit secrets.** This repo has real credentials on disk. If any of the
files below are ever staged, STOP and tell the user rather than committing:

- `web/.env.local` — Supabase URL and publishable key
- `web/backend/.env` — service-role key, JWT secret, database password, Resend key
- `web/backend/buddy.db*` — real user accounts and journal entries
- `web/.vercel/` — local project link
- Anything matching `sb_secret_`, `re_`, `sbp_`, `eyJhbGciOi`, `GOCSPX`, `postgresql+psycopg://…:…@`

These are covered by `web/.gitignore`. Verify, don't assume: `.gitignore` has been
silently rewritten before by the Vercel CLI appending `.env*` after the
`!.env.example` exception.

## Steps

1. **Check state**

   ```bash
   cd "/Users/deekshithasreerala/Downloads/Buddy app/web"
   git status --short
   ```

2. **Verify the app still works.** Do not push broken code.

   ```bash
   node node_modules/typescript/bin/tsc --noEmit
   node node_modules/vite/bin/vite.js build
   cd backend && .venv/bin/python -m pytest -q ; cd ..
   ```

3. **Stage, then audit.** Both checks must pass before committing.

   ```bash
   git add -A
   for f in .env.local backend/.env backend/buddy.db .vercel/project.json; do
     git check-ignore -q "$f" && echo "ignored ok: $f" || echo "!! EXPOSED: $f"
   done
   git diff --cached | grep -inE "sb_secret|sbp_|re_[A-Za-z0-9]{20}|eyJhbGciOi|GOCSPX|postgresql\+psycopg://[^ ]*:[^ ]*@" \
     && echo "!! SECRET IN DIFF, DO NOT PUSH" || echo "diff clean"
   ```

   If either line reports a problem, stop and report it. Do not "fix" it by
   force-adding or by rewriting `.gitignore` without telling the user.

4. **Commit.** Explain *why* the change was made, not just what changed. Wrap the
   body at 72 characters.

   ```bash
   git -c user.name="Deekshitha Sreerala" -c user.email="deekshitha.sreerala@gmail.com" \
     commit -q -m "$(cat <<'MSG'
   Short imperative summary

   What problem this solves and why this approach.

   Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
   MSG
   )"
   ```

5. **Push, then confirm what actually landed on the remote.**

   ```bash
   git push -q origin main
   git fetch -q origin
   git ls-tree -r origin/main --name-only | grep -iE "\.env|\.db$|\.vercel" || echo "remote clean"
   ```

   Only `.env.example` may appear. Anything else means a secret reached GitHub:
   tell the user immediately and treat the credential as compromised and needing
   rotation.

## Deploying

Pushing to `main` triggers a Vercel production deploy automatically. To deploy
without waiting, or to pick up changed environment variables (Vite bakes
`VITE_*` in at build time, so a fresh build is required):

```bash
vercel deploy --prod --yes
```

## When to use this

After finishing a coherent chunk of work: a feature, a fix, a copy pass. Prefer
several small commits that each tell a story over one large one. Do not commit
half-finished work that fails typecheck or build.
