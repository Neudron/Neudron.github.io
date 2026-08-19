<#
  deploy.ps1 - the whole deploy, in one command.

      powershell -ExecutionPolicy Bypass -File _scripts\deploy.ps1

  Add -DryRun to do everything except commit and push. Everything
  before step 6 is safe to run at any time; it shows you exactly what
  would go live and then stops and asks.

  WHY THIS EXISTS
  ---------------
  Three things have gone wrong with this deploy before, and each one is
  a step below rather than a line in a doc nobody re-reads:

  1. Copy-Item ADDS files and never removes them, so syncing site\ to
     _deploy\ left deleted files behind and Act IV art sat at 2,284 KB
     against a 500 KB budget. This mirrors with robocopy /MIR, which
     deletes. /XD protects .git and node_modules from the mirror.

  2. A commit was once built from a snapshot of the wrong tree - flat
     js\, no core/act4/game/page, no Act IV art - and sat staged for
     days looking ready. Step 3 asserts the shape of the tree before
     it will commit anything.

  3. Pages deploys from a GitHub Action, so a push to main is live in
     under a minute and there is no staging step. Hence the prompt.

  It never force-pushes and it never rewrites history.

  NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads a
  UTF-8 file with no BOM as cp1252, and an em dash decodes to a byte
  that it treats as a quote character. That is not a hypothetical -
  the first version of this script would not parse because of it.
#>

param(
  [switch]$DryRun,
  [switch]$Yes,
  [string]$Message
)

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$site   = Join-Path $root 'site'
$deploy = Join-Path $root '_deploy'

function Step($n, $t) { Write-Host ""; Write-Host "== $n. $t" -ForegroundColor Cyan }
function Bad($m)  { Write-Host "   $m" -ForegroundColor Red; exit 1 }
function Good($m) { Write-Host "   $m" -ForegroundColor Green }

# -- 1. the folders exist and _deploy is a real clone -----------------
Step 1 'checking the folders'
if (-not (Test-Path $site))          { Bad "no site\ at $site" }
if (-not (Test-Path "$deploy\.git")) { Bad "_deploy has no .git. Re-clone it: git clone https://github.com/Neudron/Neudron.github.io.git _deploy" }

# Stale lock files. Git takes .git\index.lock, HEAD.lock and
# refs\heads\*.lock while it writes, and removes them when it is done.
# A process that dies mid-write - or a sandbox that can create files
# but not delete them - leaves them behind, and every later git command
# refuses with "Another git process seems to be running". Nothing here
# runs git concurrently, so a lock older than two minutes is litter.
#
# Only old ones are touched, and only inside _deploy\.git, so this can
# never interrupt a git command that is genuinely in flight.
$cut = (Get-Date).AddMinutes(-2)
$locks = @(Get-ChildItem "$deploy\.git" -Recurse -Force -ErrorAction SilentlyContinue |
           Where-Object { -not $_.PSIsContainer -and
                          ($_.Name -like '*.lock' -or $_.Name -like '*stale*') -and
                          $_.LastWriteTime -lt $cut })
if ($locks.Count -gt 0) {
  $locks | Remove-Item -Force -ErrorAction SilentlyContinue
  Good "cleared $($locks.Count) stale git lock file(s)"
}

Push-Location $deploy
$remote = (git remote get-url origin 2>$null)
if ($remote -notmatch 'Neudron\.github\.io') { Pop-Location; Bad "origin is '$remote', not the pages repo" }
$branch = (git rev-parse --abbrev-ref HEAD)
if ($branch -ne 'main') { Pop-Location; Bad "on branch '$branch', not main" }
Pop-Location
Good "origin $remote on $branch"

# -- 2. syntax gate: instant, catches most mistakes -------------------
Step 2 'syntax gate'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "   node not on PATH - SKIPPED" -ForegroundColor Yellow
} else {
  $bad = @()
  Get-ChildItem "$site\js" -Recurse -Filter *.js | ForEach-Object {
    node --check $_.FullName 2>$null
    if ($LASTEXITCODE -ne 0) { $bad += $_.FullName }
  }
  if ($bad.Count -gt 0) { Bad ("syntax errors in: " + ($bad -join ', ')) }
  Good "every js file parses"
}

# -- 3. mirror, then prove the tree is the right shape ----------------
Step 3 'mirroring site into _deploy'
robocopy $site $deploy /MIR /XD '.git' 'node_modules' /NFL /NDL /NJH /NJS /NP | Out-Null
$rc = $LASTEXITCODE
if ($rc -ge 8) { Bad "robocopy failed ($rc)" }
Good "mirrored (robocopy $rc)"

# The wrong-tree check. A flat js\ means somebody staged a pre-reorg
# snapshot; a missing img\act4\tiles means Act IV ships as flat colour.
$want = @('js\core\quest.js', 'js\core\music.js', 'js\act4\act4.js',
          'js\game\sans.js',  'js\page\main.js',  'img\act4\tiles',
          'index.html', 'CNAME')
foreach ($p in $want) {
  if (-not (Test-Path (Join-Path $deploy $p))) { Bad "the tree is wrong - missing $p" }
}
if (Test-Path (Join-Path $deploy 'js\sans.js')) { Bad "flat js\ detected - this is a pre-reorg tree" }
Good "tree shape is right"

# -- 4. nothing that must never ship is about to ship -----------------
Step 4 'leak check'
Push-Location $deploy
git add -A | Out-Null
$staged = @(git diff --cached --name-only)
# `memory/` is in .gitignore, so it should never reach this list. It is
# checked here anyway because .gitignore only stops what nobody forces,
# and memory/story.md is the entire walkthrough of the game.
# The source atlases are all `sr-*.png` by convention (see
# js/data/sheets.js NEU.sheetSources) and that rule blocks every one of
# them; a bare `deltarune` alternative also blocked the legitimately
# shipped crops that live beside the sources (tenna-idle/tenna-point).
$leak = $staged | Select-String 'node_modules|sr-.*\.png|\.env|\.pem$|\.key$|^memory/|\.orig$'
if ($leak) { git reset --quiet; Pop-Location; Bad ("these must not ship: " + ($leak -join ', ')) }
Good "$($staged.Count) file(s) staged, no leaks"

# -- 5. what is actually changing -------------------------------------
# A clean working tree does NOT mean there is nothing to deploy. Work
# can already be committed here and simply not pushed - that is exactly
# the state a session leaves behind when it is told to commit but not
# push. An earlier version of this script exited with "already in sync"
# in that case, which is the worst possible answer: the one moment you
# most need it to act, it politely does nothing and the site stays on
# the old commit.
Step 5 'what would go live'
git fetch --quiet origin main 2>$null
$ahead = @(git rev-list origin/main..HEAD)
$hasStaged = $staged.Count -gt 0

if (-not $hasStaged -and $ahead.Count -eq 0) {
  git reset --quiet; Pop-Location
  Write-Host "   nothing to deploy - already in sync" -ForegroundColor Yellow
  exit 0
}

if ($hasStaged) {
  Write-Host "   uncommitted changes:" -ForegroundColor Cyan
  git diff --cached --stat | Select-Object -Last 30
}
if ($ahead.Count -gt 0) {
  Write-Host "   already committed, waiting to be pushed:" -ForegroundColor Cyan
  git --no-pager log --oneline origin/main..HEAD | ForEach-Object { Write-Host "     $_" }
}

if ($DryRun) {
  git reset --quiet; Pop-Location
  Write-Host ""
  Write-Host "-- dry run: nothing committed, nothing pushed --" -ForegroundColor Yellow
  exit 0
}

# -- 6. ASK. Pages has no staging step --------------------------------
Step 6 'confirm'
if (-not $Yes) {
  Write-Host "   This goes LIVE at https://www.neu.ac in about a minute." -ForegroundColor Yellow
  Write-Host "   Close PR #1 first if it is still open - merged after this," -ForegroundColor Yellow
  Write-Host "   it overwrites the site with a 70-byte page." -ForegroundColor Yellow
  $a = Read-Host "   Type  deploy  to continue"
  # Normalise before comparing. PowerShell writes a UTF-8 BOM at the head
  # of a redirected pipeline, so `'deploy' | powershell -File deploy.ps1`
  # arrives as "<BOM>deploy" and a plain -ne comparison rejects it. The
  # failure looks like a refusal to deploy rather than an encoding bug,
  # which is a confusing place to lose ten minutes.
  $a = ($a -replace "^﻿", '').Trim()
  if ($a -ne 'deploy') {
    git reset --quiet; Pop-Location
    Write-Host "   cancelled, nothing committed"
    exit 0
  }
} else {
  Write-Host "   -Yes: proceeding (the confirmation was given when the command ran)" -ForegroundColor Cyan
}

if ($hasStaged) {
  if (-not $Message) { $Message = Read-Host "   commit message" }
  if (-not $Message) { $Message = 'Update the site' }
  git commit -q -m $Message
  Good "committed $(git rev-parse --short HEAD)"
} else {
  git reset --quiet          # nothing to commit; drop the staging from step 4
  Good "pushing $($ahead.Count) existing commit(s)"
}

git push origin main
if ($LASTEXITCODE -ne 0) { Pop-Location; Bad "push failed" }
Good "pushed"
Pop-Location

# -- 7. verify against the LIVE file, not the Actions API -------------
# gh is not on PATH here, and the API is not the point anyway: what
# matters is what the CDN serves. Cache-buster on every attempt.
Step 7 'verifying live'
Start-Sleep -Seconds 45
foreach ($try in 1..6) {
  try {
    $cb = Get-Random
    $r = Invoke-WebRequest "https://www.neu.ac/js/core/music.js?cb=$cb" -UseBasicParsing -TimeoutSec 20
    if ($r.StatusCode -eq 200 -and $r.Content -match 'NEU\.music') { Good "live (attempt $try)"; exit 0 }
  } catch { }
  Write-Host "   not up yet, retrying ($try/6)"
  Start-Sleep -Seconds 20
}
Write-Host "   still not visible after about 3 min; the Action may still be running." -ForegroundColor Yellow
Write-Host "   Check https://github.com/Neudron/Neudron.github.io/actions" -ForegroundColor Yellow
