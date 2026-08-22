# Workflow for future chats

Paste-able opener, and the loop every session follows.

---

## Start a session with this

> Working on **neu** (`Documents\neu` — repo root IS the site since the
> 2026-08-21 flatten). Read `memory/` first, starting at `PLAN.md`.
> Do not commit or push unless I say so in that message.
> Current state and open items are in `memory/pending.md`.

---

## The loop

1. **Orient.** Read `CLAUDE.md`, then `memory/pending.md`. Do not re-derive
   what is already written down.
2. **Clarify once, up front.** If the request has a real fork in it, ask
   before building — not after.
3. **Task list.** Anything with more than two steps gets one.
4. **Build.** House rules from `neu-site`; room format from `neu-room`.
5. **Syntax gate.** `node --check` every touched file. Instant, catches most.
6. **Test.** The relevant `fixesN.mjs` suite, plus a new section for new
   behaviour. See `neu-verify`.
7. **Report honestly.** Say what did NOT get done. If a test failure turned
   out to be a harness bug, say that rather than quietly rewriting it.
8. **Update `memory/pending.md`.** Anything left open goes in it before the
   session ends.
9. **Ask before pushing.** Always.

## Skills installed for this project

| Skill | Fires when |
|---|---|
| `neu-site` | any file under the project — house rules, z-index, namespace, tone |
| `neu-room` | adding or editing a room, puzzle, tileset, NPC or boss |
| `neu-verify` | before saying "done"; writing tests; deploying |

They are saved to the account, so they follow you into every new chat without
being re-explained.

## Skill sources reviewed

The user supplied 15 skill repositories. **Only `mgechev/skills-best-practices`
was pulled in full** — its guidance shaped the three skills above (trigger-
optimised descriptions with negative triggers, <500-line SKILL.md, third-person
imperative, progressive disclosure, no README/CHANGELOG files inside a skill).

The rest were **assessed and deliberately not installed**, because this project
is zero-build vanilla JS with Canvas 2D and one three.js scene:

| Repo | Verdict |
|---|---|
| `pixijs/pixijs-skills` | not used — no PixiJS in this project |
| `phaserjs/phaser` v3→v4 migration | not used — no Phaser |
| `onmax/nuxt-skills` | not used — no Nuxt, no build step |
| `CloudAI-X/threejs-skills` | **candidate** — `scene.js` uses three.js r185 |
| `gamedev-skills/awesome-gamedev-agent-skills` | **candidate** — game-design skills |
| `leigest519/OpenGame` | **candidate** — worth a look for loop/state patterns |
| `anthropics/skills` | already present in this environment |
| `openai/skills`, `addyosmani/agent-skills`, `VoltAgent`, `heilcheng`, `hoodini`, `agentskills`, `eigent-ai` | general-purpose collections; nothing specific to this stack |

**Not fetched, and this mattered for a while:** the three candidates were
judged from names and scope, not from reading them — **resolved
2026-08-17**: all three were then read properly, verdicts in `PLAN.md`
§1.10 (`threejs-skills` maybe-later; `threejs-game-skills` no — build step;
`OpenGame` no). Nothing left open here.
