# neu — agent team protocol

The repo carries a six-worker agent team in `.opencode/agents/`, all pinned
to the same free model. This file is the orchestration contract: how work
enters the team, what each worker may do, and what must be true before
anything is committed.

## Roster

| Agent | Reads | Writes | Runs | Role |
|---|---|---|---|---|
| `neu-scout` | yes | no | no | recon, bug hunts (parallel-safe) |
| `neu-researcher` | web only | no | no | best practices, platform quirks, upstream sources |
| `neu-builder` | yes | `js/ css/ tests/ index.html` only | syntax gate only | implements ONE bounded work order |
| `neu-verifier` | yes | no | tests + syntax check | executable gate; reports, never fixes |
| `neu-reviewer` | diff/code | no | git read-only | independent SHIP/REJECT on a fixed checklist |
| `neu-docs` | yes | `README.md memory/*.md .opencode/plans/` (not story.md) | git read-only | keeps docs true to the code after a change |

Hands-off for every worker: `memory/ _sources/ .github/ _deploy/ CNAME
manifest.json og.png robots.txt sitemap.xml`. The orchestrator (primary
session) is the only role that commits or pushes.

## Protocol

1. **Wave A — parallel reads.** Up to 3 scout/researcher dispatches with
   structured briefs (objective, scope, output format, budget). Workers are
   blind to each other; briefs must not require them to coordinate.
2. **Synthesis.** The orchestrator merges Wave A into ONE work-order file:
   `.opencode/plans/<task>.md` — objective, acceptance criteria, touched
   paths, budget.
3. **Wave B — serial writes.** One builder at a time. New behaviour starts
   as a failing test (TDD); the builder makes it green.
4. **Boolean gate.** Done requires ALL of: suites green (`node
   tests/run-all.mjs`) ∧ diff non-empty ∧ reviewer verdict SHIP with scope
   match. A REJECT needs a concrete failing check; if the verifier
   reproduces green, the reject is overruled and logged. Gate failure rolls
   the builder wave back to its checkpoint — never stack on broken state.
5. **Ledger.** Every cycle appends briefs + worker summaries to
   `.opencode/log/YYYY-MM-DD.md`; open items land in memory/pending.md.

## Standing rules (machine-enforced by permissions)

- Every shell command carries an explicit timeout. A wedged script once
  hung a session indefinitely.
- `git push` asks, always. Local commits happen only after the gate.
- Two failed builder cycles on one task → the orchestrator takes it over.
- The gate is also a git hook: `git config core.hooksPath .githooks` once
  per clone, and `.githooks/pre-commit` runs `node tests/run-all.mjs` (the
  ES5 gate + every suite) before any commit lands.

## Smoke test

After editing `.opencode/agents/*.md`: `opencode agent list` must show all
six `neu-*` agents. Headless run shape:
`opencode run --agent <name> "<brief>"` (wrap in an explicit timeout).

## Delegation routing (plugins installed 2026-08-22)

| Worker | Dispatch path | Why |
|---|---|---|
| `neu-scout`, `neu-researcher` | `delegate()` from background-agents plugin | read-only → persisted to disk, survives compaction, notifies on done |
| `neu-verifier`, `neu-reviewer`, `neu-builder` | native Task tool | bash-allowlisted or write-capable agents are barred from `delegate()` by design (undo safety) |
| any, headless/cron fallback | `opencode run --agent <name>` | works without a TUI session |

Rules:
- Read-only agents MUST go through `delegate()` — the plugin blocks their
  native task calls and vice-versa for writers.
- Results land in `~/.local/share/opencode/delegations/<projectId>/`;
  `delegation_list()` scans past work by title/summary.
- Notifications: opencode-notify fires on session idle/error/permission
  (Windows Toast via SnoreToast). Quiet hours configurable in
  `~/.config/opencode/kdco-notify.json`.
- Shell discipline: the shell-strategy instruction file is loaded via
  `instructions:` in opencode.json — non-interactive flags only, editors
  and pagers banned.
- Plugin sources were reviewed before install; updates require re-review
  (manual copy from the ocx monorepo paths listed in workflow.md).

## Worked example (one real cycle, 2026-10-23)

1. **Wave A.** Three read-only scouts audited the open ultraplan items. The
   "web" scout's row for G6 said there was no executable v1 save fixture.
2. **Synthesis.** `.opencode/plans/ultra-batches.md` put G6 into work
   order W1b, which also held G7, G8, A13 and H3. The order listed the
   files, the suite numbers (23–25) and the acceptance checks.
3. **Wave B.** One builder ran in its own worktree. It wrote
   `tests/fixtures/save-v1.json` and `tests/fixes23.mjs` *first*, so the
   new suite was red. The red was real: renaming rank flags in place made
   A+ → A, and then A → A– deleted the A it had just written.
4. **Gate.** The orchestrator applied the diff 3-way and fixed
   `save.js` (translate from a snapshot). It then ran
   `node tests/run-all.mjs` (all green) and reviewed the diff.
5. **Commit + ledger.** One commit names the bug, the fix and the suite,
   and the item is ticked in `ultraplan-124.md`. The builder's two false
   alarms (a contrast check measuring the wrong surface, a gzip budget
   measured on an old base) were corrected in the suite, not hidden.
