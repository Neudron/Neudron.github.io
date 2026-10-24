# Incident playbook

For when the live site (www.neu.ac) is broken — a blank page, a soft-lock
that blocks the game, a 404 on a shipped file. Calm, in this order.

## 1. Triage (5 minutes)
- **What is broken, for whom?** Load the live page in a private window,
  desktop AND phone width. Note the first console error verbatim.
- **Since when?** `git log --oneline -10 main` — the most recent deploy is
  the prime suspect. GitHub Actions shows which commit is live.
- **How bad?** Page blank / site unusable = SEV1, roll back now.
  Game soft-lock = SEV2, fix forward today. Cosmetic = SEV3, normal flow.

## 2. Roll back (SEV1)
- `git revert <bad-commit>` on `main` — never force-push `main`.
- The deploy is the Actions workflow on push to `main`; it stages only
  web-facing files (see `.github/workflows/deploy.yml`). Watch the run
  finish, then re-verify live with a cache-buster
  (`https://www.neu.ac/js/core/engine.js?cb=<random>`).
- Pushing to `main` deploys. It always needs the owner's yes (AGENTS.md).

## 3. Fix forward (SEV2/SEV3)
- Reproduce in a test first: a new `tests/fixesNN.mjs`
  (`node tests/newfix.mjs "<title>"`) that fails on the bug.
- Fix, then `node tests/run-all.mjs` — the ES5 gate plus every suite.
- Human-paced check in a real browser for anything a player touches.

## 4. Afterwards (always)
Append to `memory/pending.md`:
```
## YYYY-MM-DD — incident: <one line>
Impact: who saw what, for how long.
Cause: the actual root cause (not "a typo").
Fix: commit(s).
Why tests missed it: and the suite that now would not.
Follow-ups: owner + item.
```
