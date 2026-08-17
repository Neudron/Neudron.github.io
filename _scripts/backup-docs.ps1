<#
  backup-docs.ps1 — commit the documentation and scripts to the local
  workshop repo at Documents\neu.

  WHY THIS EXISTS, AND WHY YOU CANNOT JUST RUN `git add -A`.

  site\.gitignore contains `memory/`, because memory\story.md is the
  complete walkthrough of the game and it must never reach the public
  Pages repo. Git gives a lower-level .gitignore precedence over any
  rule written in a parent directory, so that one line also hides
  memory\ from THIS repo — the repo whose entire purpose is to back it
  up. No warning, no error; `git add -A` just quietly skips it.

  The files already tracked are safe: .gitignore only affects untracked
  files, so edits to story.md are picked up normally. The gap is a NEW
  file. Write memory\combat.md tomorrow and `git add -A` will ignore it
  forever, and you will not find out until you need it.

  So this script force-adds memory\ every time. That is the whole trick.

  Run it whenever you have changed the docs. It is safe to run when
  nothing has changed — it says so and stops.
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

function Good($m) { Write-Host "  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  $m" -ForegroundColor Yellow }
function Bad($m)  { Write-Host "  $m" -ForegroundColor Red; exit 1 }

Write-Host "`nbacking up docs + scripts" -ForegroundColor Cyan
Push-Location $root

if (-not (Test-Path '.git')) {
  Bad "no repo at $root. Run: git init -b main"
}

# The force-add. Everything else is ordinary.
git add -A
git add -f site\memory

$staged = @(git diff --cached --name-only)
if ($staged.Count -eq 0) {
  Warn "nothing changed"
  Pop-Location
  exit 0
}

# The one thing that must be true, checked rather than assumed. If a
# future edit to a .gitignore starts hiding memory\ in a way force-add
# cannot reach, this catches it instead of silently backing up nothing.
$docs = @(git ls-files site\memory)
if ($docs.Count -lt 10) {
  Bad "only $($docs.Count) files tracked under site\memory - expected the whole folder. Something is excluding it."
}
Good "$($docs.Count) doc file(s) tracked"

# And the inverse: this repo is private-by-absence today. If someone
# adds a public remote later, the walkthrough goes public and undoes the
# reason memory\ was excluded from the site.
$remotes = @(git remote)
if ($remotes.Count -gt 0) {
  Write-Host ""
  Warn "this repo has a remote: $($remotes -join ', ')"
  Warn "it contains memory\story.md, the complete walkthrough."
  Warn "make sure that remote is PRIVATE before pushing."
}

Write-Host ""
Write-Host "  changing:" -ForegroundColor Cyan
$staged | Select-Object -First 15 | ForEach-Object { Write-Host "    $_" }
if ($staged.Count -gt 15) { Write-Host "    ... and $($staged.Count - 15) more" }

Write-Host ""
$msg = Read-Host "  commit message (blank = 'docs: update')"
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = 'docs: update' }

git -c user.name='Neudron' -c user.email='neudron.troll@gmail.com' commit -q -m $msg
Good "committed $(git rev-parse --short HEAD)"

if ($remotes.Count -eq 0) {
  Write-Host ""
  Warn "local-only: still no copy off this machine."
  Write-Host "    to fix, create a PRIVATE repo and:" -ForegroundColor DarkGray
  Write-Host "    git remote add origin git@github.com:Neudron/neu-workshop.git" -ForegroundColor DarkGray
  Write-Host "    git push -u origin main" -ForegroundColor DarkGray
}

Pop-Location
Write-Host ""
