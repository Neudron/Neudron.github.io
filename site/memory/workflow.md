# Workflow

## Deploy — ASK FIRST

**Do not commit or push without being asked in that message.** Rule set
2026-08-16 after an unprompted push. Pages source is *GitHub Actions*, so any
push to `main` is live in under a minute — there is no staging step to catch
a mistake.

When permission is given:

```powershell
# 1. copy changed files from the session scratch into BOTH local copies
$src = "<session>\outputs\neu-site"
foreach ($f in @('index.html','css\style.css','js\sans.js', ...)) {
  Copy-Item "$src\$f" "$env:USERPROFILE\Documents\neu\site\$f" -Force
  Copy-Item "$src\$f" "$env:USERPROFILE\Documents\neu\_deploy\$f" -Force
}
# 2. commit and push from _deploy
cd "$env:USERPROFILE\Documents\neu\_deploy"
git add -A; git commit -m "..."; git push origin main
# 3. verify by fetching the LIVE file with a cache-buster
Invoke-WebRequest "https://www.neu.ac/js/sans.js?cb=$(Get-Random)" -UseBasicParsing
```

`gh` is not on PATH in the PowerShell session — verify by fetching the live
file, not by querying the Actions API.

The remote prints "This repository moved" — the canonical name is
`Neudron/Neudron.github.io` (capital N). Harmless, but push with the correct
case to silence it.

## DNS (done, do not re-do)

Registrar: spaceship.com. **The site is `www.neu.ac`, not `neu.ac`.**

- Apex `neu.ac` → four A records to GitHub Pages, which 301 to www
- `www` → CNAME to `neudron.github.io`
- `CNAME` file in the repo contains `www.neu.ac`

## Testing

```
cd outputs/tests
npm install jsdom     # once per session — the sandbox is wiped between runs
node fixes5.mjs       # sleep timing, dock, voices, replay regression
node fixes6.mjs       # z-order, carried console, the deck
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

## Verification habit

Every change ships with a jsdom test that drives the actual state machine, and
where a loop is replayable the test runs it **twice**. Three separate dead
ends in this project were only caught that way.

When a test fails, check the harness before the site. Five of the failures so
far have been test bugs reporting working code as broken.
