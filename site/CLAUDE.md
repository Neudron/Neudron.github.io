# neu — working memory

Personal site for **Neu** (neudron.troll@gmail.com). Live at **https://www.neu.ac**.

Read this first. The `memory/` files hold the detail; this page holds the things
that are true every single session.

---

## Rules that override defaults

1. **NEVER commit or push to GitHub without being asked in that message.**
   Set 2026-08-16 after I pushed unprompted. Building, editing and testing
   locally is always fine. Deploying is not. Ask, then push.
2. **No build step, ever.** No npm, no bundler, no framework, no transpile.
   Plain HTML/CSS/JS served straight off disk. Three.js arrives through an
   `<script type="importmap">` from jsDelivr. If a fix needs tooling, it is
   the wrong fix.
3. **Use the user's own sprites.** Undertale/Minecraft assets are already
   downloaded in `img/` and `audio/`. Do not generate replacements. New art
   only when explicitly asked, and then in pixel art matching the existing set.
4. **Font sizes are multiples of 16px.** The Undertale faces are drawn on a
   16px grid; 15px or 17.4px resamples the bitmap and destroys the typeface.
   Never `clamp()` a font-size. 16, 32, 48, 96.
5. **The dialogue box is the top layer.** `z-index: 96`. Anything new goes
   below it. See `memory/architecture.md` for the whole ladder.

---

## Where things live

| What | Where |
|---|---|
| Session scratch (edit here) | `outputs/neu-site/` |
| User's working copy | `Documents\neu\site\` |
| Git clone that deploys | `Documents\neu\_deploy\` |
| Repo | `github.com/Neudron/Neudron.github.io`, branch `main` |
| Tests | `site/tests/fixes*.mjs` (jsdom, run with node) |

Pages source is **GitHub Actions**, not "deploy from a branch" — the workflow
is `.github/workflows/deploy.yml`. Any push to `main` is live in about a
minute. That is exactly why rule 1 exists.

---

## The shape of it

A single scrolling page: boot screen → hero with a 3D refractive glass "neu"
cube (three.js) → about → work → contact. Hidden behind the contact section
is a long chain of interactive scenes — sword, dog, hammer, blackout, console
— tracked by a 16-step objectives panel.

Aesthetic: **black goth-cute, tone 6/10 toward cute.** Goth lives in the
colour and the material; cute lives in the motion and the silhouette. Nothing
decorative carries the cute — no bows, no charms.

---

## Skills for this project

Three saved skills carry the rules into every new chat:

- **`neu-site`** — house rules, z-index ladder, `NEU` namespace, design tone
- **`neu-room`** — room data format, entity types, puzzle/boss design rules
- **`neu-verify`** — jsdom harness, known false-failure traps, deploy gate

Session opener and the per-session loop are in `memory/workflow-chat.md`.

## Memory index

- `memory/design.md` — colour, type, motion, the tone rule, accessibility floor
- `memory/architecture.md` — module layout, the `NEU` namespace, z-index ladder
- `memory/chain.md` — the full interaction chain and objective list
- `memory/assets.md` — sprites, fonts, audio, and where each came from
- `memory/decisions.md` — why things are the way they are, and what was rejected
- `memory/workflow.md` — deploy, DNS, testing, and the traps that cost time
- `memory/plan-act4.md` — the Act IV design doc. **All phases now built**
- `memory/assets-wanted.md` — the Act IV asset list (delivered)
- **`memory/PLAN.md` — THE HANDOFF. Full context + every outstanding item + the 7-phase plan. Start here.**
- `memory/story.md` — the whole game, start to finish, and why each beat works
- `memory/workflow-chat.md` — session opener, the loop, skill sources reviewed
- **`memory/pending.md` — everything still open. READ THIS FIRST.**

---

## Open items (not actioned — needs the user)

- The six remaining SVGs (`hammer.svg`, `clicker.svg`, `hand.svg`,
  `blanket.svg`, `switch2.svg`, `tv.svg`) are **original props, not
  placeholders**. They were redrawn as pixel art on 2026-08-17 and have
  no game counterparts to gather. They are finished.
- 3.5: human playthrough — needs the user to play it with eyes and ears
  (nobody has heard the soundtrack out loud; every music check is jsdom
  against a recording stub).

Resolved: `dog.svg` replaced with the real Undertale Annoying Dog sprite
(`img/annoying-dog.gif` — 44x38, 2-frame, from undertale.wiki.gg);
all BUG Tracker items audited and resolved 2026-08-21; Sepulcher sprite
entries restored; SC attack cycle rebuilt to match the official wiki;
`.well-known/discord` is **live** (deployed 2026-08-21, commit `9c95e00`);
**Enforce HTTPS is ticked** (2026-08-19 — http answers 301 → https, TLS
serves 200). Since the 2026-08-19 deploy the repo root *is* the site content
(the `site/` subfolder, `_scripts/` and `_removed-from-main/`
were dropped from `main`; `_scripts/` and the docs live in the local workshop
repo at `Documents
eu`).
