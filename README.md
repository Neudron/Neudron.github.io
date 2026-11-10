# neu

<!-- badges:start -->
**Validation commands:** `npm ci` · `npm run check` · `npm run build` · `npm run verify`
<!-- badges:end -->

A personal site at **[www.neu.ac](https://www.neu.ac)**. Black pixel art, one
piece of rotating glass, and a short list of work.

**Build step (migration).** The source is still plain `<script>` tags, but
production is built: `npm run build` writes `dist/` — a small portfolio shell,
a lazy game chunk that is not downloaded until a visitor enters the game, and
a self-hosted three.js bundle. `npm run verify` checks the artifact allowlist
and public surface. three.js is no longer pulled from jsDelivr at runtime.

---

## Run it

For local preview from source:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

For local preview of the production artifact:

```bash
npm ci
npm run build
npm run verify
python3 -m http.server 8000 --directory dist
```

Opening `index.html` straight off disk may not work in every browser because
`js/page/scene.js` is an ES module. A local server avoids that issue.

## Tests and checks

The project provides jsdom suites and build checks. These commands run them;
no current pass status or suite count is asserted here.

```bash
node tests/run-all.mjs
npm run check
npm run build && npm run verify
# or one suite at a time:
node tests/fixes5.mjs    # ... through fixes111.mjs
node tests/playthrough.mjs
```

`npm run check` parses tracked `js/` files for the project's ES5 syntax
constraints. `npm run build` creates `dist/`; `npm run verify` checks the
artifact allowlist and public surface.

## Deploy

GitHub Actions builds the site on pushes to `main`, runs `npm ci`,
`npm run check`, `npm run build`, and `npm run verify`, then publishes `dist/`
to GitHub Pages. The workflow can also be run manually from GitHub Actions.

---

## Layout

```
index.html              every <script> tag, in load order
css/style.css           one stylesheet, ~1900 lines, with a TOC at the top
js/
  core/   quest save juice danmaku engine(-look,-kinds) music perf settings touch dev
  page/   main stars scene            the website itself
  game/   sword sans bullet dark deck  interactive components
  act4/   act4 rooms-* boss-* quiz rhythm craft crack shop
  data/   data sheets                  projects list, sprite manifest
img/ audio/ fonts/    assets, all self-hosted
tests/                the jsdom suites
scripts/              build, checks, and artifact verification
dist/                 build output, gitignored
```

(The repo was flattened 2026-08-21 — everything that used to live under
`site/` is now at the root.)

**Load order matters** and is enforced by the order of the `<script>` tags.
`core/quest.js` is first because it owns the single copy of progress;
`core/dev.js` is last because it drives everything else.

Every module is an IIFE hanging its surface off one global, `NEU`, and guards
its own DOM lookups, so a missing element degrades to a no-op instead of a
thrown error.

## Rules this project actually holds itself to

- **Source stays ES5.** `js/` is still `var`/function — no arrow functions,
  no `const`/`let`. `npm run check` enforces the syntax gate (acorn,
  ES2015 Annex B dup-key rules skipped — see `scripts/check.mjs`). The test
  harness may use modern syntax; the shipped source may not.
- **Font sizes are multiples of 16px.** The Undertale faces are drawn on a
  16px grid and 15px resamples the bitmap into mush. Never `clamp()` one.
- **One source of truth.** Progress lives only in `core/quest.js`, world state
  only in `core/save.js`. The one time a module kept its own copy it produced
  an unfinishable dead end.
- **WCAG AA in both themes, every scene keyboard-only,
  `prefers-reduced-motion` honoured, nothing flashing above 3Hz** — the last
  one measured rather than assumed.
- **The soundtrack downloads nothing.** It is synthesised in Web Audio,
  because eight zones of recorded loops is about ten megabytes and this is a
  site people open on a phone.

## Documentation and deployment

GitHub Pages builds the site and uploads only `dist/`. Build and verification
commands above describe the public artifact workflow.

## Roadmap

- **Real phones.** A walk through every page on Android Chrome and iOS
  Safari, portrait and landscape, by hand.
- **Field numbers.** Core Web Vitals from real visits once there are
  enough of them; the lab numbers (LCP about 0.1–0.2 s, CLS 0) are not
  the same thing.
- **Upkeep.** A dependency review every three months: three.js, the test
  tools and the deploy actions, one bump at a time, gate green after each.
- **More work in the list** as it gets finished.

## Credit

The sprites are Toby Fox's (Undertale, Deltarune) and the Calamity Mod team's,
used here for a personal fan page and not redistributed as assets — the
source atlases are gitignored and never ship. The fonts are 8-Bit Operator
JVE by Jayvee Enaguas and Determination Mono, self-hosted. Other site work
was written for this project.
