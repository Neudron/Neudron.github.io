# neu

A personal site at **[www.neu.ac](https://www.neu.ac)**. Black pixel art, one
piece of rotating glass, a short list of work underneath.

It is also, quietly, a game — a few hours of one, hidden behind the contact
section. That is as much as this file will say about it. Finding the way in
is the first puzzle and spoiling it here would be the one unrecoverable bug.

**No build step.** No npm, no bundler, no framework, no transpile. Plain
`<script>` tags; three.js arrives from jsDelivr through an importmap. Edit a
file, refresh the browser. That is the whole loop, and it is a constraint the
project is built around rather than a stage it has not reached yet.

---

## Run it

```bash
cd site
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` straight off disk mostly works, but `js/page/scene.js`
is an ES module and some browsers refuse those on `file://`. The one-line
server above avoids the question.

Nothing to install. There is no `package.json` outside `tests/`.

## Test it

The suites run in **jsdom under node**, against the real files — no browser,
no headless Chrome.

```bash
cd site/tests
npm install jsdom        # once; this is the only dependency in the project
node fixes5.mjs          # ... through fixes17.mjs
node playthrough.mjs     # a full scripted run of the whole game
```

Run them one at a time; the whole set takes a few minutes. **1237 checks
across 14 files**, all passing.

Before anything else, the syntax gate — it is instant and catches most
mistakes:

```bash
cd site
for f in js/**/*.js; do node --check "$f" || echo "FAIL $f"; done
```

## Deploy it

```powershell
powershell -ExecutionPolicy Bypass -File _scripts\deploy.ps1
```

That mirrors `site/` into `_deploy/`, checks the tree is the right shape,
refuses to ship anything that must not ship, shows you the diff, **asks**,
then pushes and verifies against the live URL. Add `-DryRun` to do everything
except the last three steps.

GitHub Pages deploys from an Action, so a push to `main` is live in about a
minute and there is no staging step. Hence the prompt.

---

## Layout

```
site/
  index.html            every <script> tag, in load order
  css/style.css         one stylesheet, ~1700 lines, with a TOC at the top
  js/
    core/   quest save juice danmaku engine music perf settings touch dev
    page/   main stars scene            the website itself
    game/   sword sans bullet dark deck  acts I-III
    act4/   act4 rooms-* boss-* quiz rhythm craft crack
    data/   data sheets                  projects list, sprite manifest
  img/ audio/ fonts/    assets, all self-hosted
  memory/               ALL the documentation. Start at PLAN.md
  tests/                the jsdom suites
_deploy/                a clone of the Pages repo. Push from here, via the script
_scripts/               one-off tools; not part of the site
```

**Load order matters** and is enforced by the order of the `<script>` tags.
`core/quest.js` is first because it owns the single copy of progress;
`core/dev.js` is last because it drives everything else.

Every module is an IIFE hanging its surface off one global, `NEU`, and guards
its own DOM lookups, so a missing element degrades to a no-op instead of a
thrown error.

## Changing the things you are most likely to want to change

| Want to | File |
|---|---|
| Edit the project list | `js/data/data.js` |
| Change a colour or a font | `css/style.css` (semantic tokens at the top) |
| Add or edit a room | `js/act4/rooms-*.js` — rooms are **data**, not code |
| Add a sprite sheet | `js/data/sheets.js` |
| Look at anything in the game without playing to it | dev console, below |

**The dev console is `Ctrl + Shift + `** (backquote). Type `help`. It can
skip the whole opening errand, jump to any room, open any scene, overlay the
cell grid on a sprite sheet, dump the save file, and turn on the frame-time
meter (`fps`).

## Rules this project actually holds itself to

These are not aspirations; there are tests that fail when they are broken.

- **No build step.** If a fix needs tooling, it is the wrong fix.
- **ES5 syntax in `js/`.** `var`, function declarations, no arrow functions,
  no `const`/`let`. The test harness may use modern syntax; the shipped site
  may not.
- **Font sizes are multiples of 16px.** The Undertale faces are drawn on a
  16px grid and 15px resamples the bitmap into mush. Never `clamp()` one.
- **One source of truth.** Progress lives only in `core/quest.js`, world state
  only in `core/save.js`. The one time a module kept its own copy it produced
  an unfinishable dead end.
- **WCAG AA in both themes, every scene keyboard-only,
  `prefers-reduced-motion` honoured, nothing flashing above 3Hz** — the last
  one measured rather than assumed.
- **Act IV art stays under 500 KB.** Currently 313 KB.
- **The soundtrack downloads nothing.** It is synthesised in Web Audio,
  because eight zones of recorded loops is about ten megabytes and this is a
  site people open on a phone.

## Documentation

This file is the front door. Everything else is in `memory/` — which is
**deliberately not published**. `memory/story.md` is the complete walkthrough
of the game in plain prose, and `chain.md`, `plan-act4.md` and
`build-notes.md` between them give away every room, boss and mechanic. They
were shipping by accident, because `memory/` sits inside `site/` and the
mirror took everything; `site/.gitignore` now excludes the folder and the
reasoning is written out there. Delete two lines to undo it.

So if you are reading this on the web, the table below is a map of a folder
you cannot see. Clone it and you get the lot.

| File | What |
|---|---|
| `memory/PLAN.md` | **start here** — context, outstanding work, the phase plan |
| `memory/story.md` | the whole game, start to finish. Spoilers, obviously |
| `memory/architecture.md` | modules, load order, the z-index ladder |
| `memory/decisions.md` | approaches that were rejected, and why |
| `memory/design.md` | colour, type, motion, the accessibility floor |
| `memory/assets.md` | every sprite and sound, and where it came from |
| `memory/build-notes.md` | the old 772-line README, kept whole |

## Credit

The sprites are Toby Fox's (Undertale, Deltarune) and the Calamity Mod team's,
used here for a personal fan page and not redistributed as assets — the
source atlases are gitignored and never ship. The fonts are 8-Bit Operator
JVE by Jayvee Enaguas and Determination Mono, self-hosted. Everything else —
the engine, the rooms, the music, the puzzles — was written for this site.
