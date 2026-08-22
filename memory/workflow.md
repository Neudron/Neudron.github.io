# Workflow

## Deploy — ASK FIRST

**Do not commit or push without being asked in that message.** Rule set
2026-08-16 after an unprompted push. Pages source is *GitHub Actions*, so any
push to `main` is live in under a minute — there is no staging step to catch
a mistake.

When permission is given (current flow — the workshop repo at
`Documents\neu` **is** the deploy source; `_deploy\` is a stale vestigial
clone kept only for `deploy.ps1` history):

```powershell
git add <files> ; git commit -m "..." ; git push origin main
# then verify by fetching the LIVE file with a cache-buster:
Invoke-WebRequest "https://www.neu.ac/js/sans.js?cb=$(Get-Random)" -UseBasicParsing
```

The workflow `.github/workflows/deploy.yml` stages only web-facing files to
`_stage/` before uploading, so `memory/`, `tests/`, `_scripts/` never ship.
Watch the run: `https://api.github.com/repos/Neudron/Neudron.github.io/actions/runs?per_page=3`.

`gh` is not on PATH in this session — verify by fetching the live file, not
by CLI.

The remote prints "This repository moved" — the canonical name is
`Neudron/Neudron.github.io` (capital N). Harmless, but push with the correct
case to silence it.

**Always give shell commands an explicit timeout.** A boot-check script once
wedged a session indefinitely; every exec now carries one.

## DNS (done, do not re-do)

Registrar: spaceship.com. **The site is `www.neu.ac`, not `neu.ac`.**

- Apex `neu.ac` → four A records to GitHub Pages, which 301 to www
- `www` → CNAME to `neudron.github.io`
- `CNAME` file in the repo contains `www.neu.ac`

## Testing

```
node tests/run-all.mjs     # every suite, hard 60s timeout each (~90s total)
npm install jsdom --prefix tests   # once per session — the sandbox is wiped between runs
```

### jsdom traps that have cost real time

1. **`runScripts: 'outside-only'` is required.** Without it `window.eval` runs
   in a context with no `window` global and every module throws
   "window is not defined". `outside-only` also keeps the page's own
   `<script type="module">` (three.js off a CDN) from executing, which is
   what we want.
2. **The 2d context stub must NOT return null.** `bullet.js`, `dark.js` and
   `deck.js` all bail out of their entire module if `getContext` fails, so a
   `null` stub silently removes half the API and the failures look like site
   bugs. Return a Proxy of no-ops.
3. **`getBoundingClientRect` must return a real box.** jsdom's default is all
   zeroes and any layout maths divides into nothing.
4. **Drive `IntersectionObserver` by hand.** It never fires on its own. That
   is a feature here — it is exactly the control the sleep test needs.
5. **Warp before pressing E.** In walk mode `interact()` tests the character
   against the live `#lightsToggle` box; use `NEU.dark.warpSw()`, not
   `warp()`, or the press silently does nothing.
6. **Anchor CSS selector searches to a line start.** `CSS.indexOf('.tbox {')`
   found the phrase quoted inside an explanatory comment and read the wrong
   block. Use `'\n' + sel + ' {'`.

### PowerShell traps

- `-clike` treats `[hidden]` as a wildcard character class — false negatives.
- `-match` is case-insensitive by default.
- `cmd && python <<EOF` — if `cmd` fails the heredoc never runs and the
  silence looks like the edit succeeded.

### opencode agent permission traps

- **Glob-form `edit:` rules silently hide the whole edit tool on Windows.**
  Edit resources arrive as absolute `C:\...` paths; relative globs like
  `js/**` never match, and a trailing `"*": deny` then wins everything —
  the worker sees no edit tool at all and burns its steps probing bash.
  Until upstream normalises path separators, give trusted builders plain
  `"edit": "allow"` and enforce scope via the work order + reviewer gate.
  Found 2026-08-22 (builder cycle 1 blocked); recorded in the builder's
  own config comment.

## Verification habit

Every change ships with a jsdom test that drives the actual state machine, and
where a loop is replayable the test runs it **twice**. Three separate dead
ends in this project were only caught that way.

When a test fails, check the harness before the site. Five of the failures so
far have been test bugs reporting working code as broken.
