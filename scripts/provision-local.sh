#!/usr/bin/env bash
# Copy the author's local-only (gitignored) fixtures from a provisioned checkout
# into a fresh worktree. Idempotent: re-running overwrites in place, never nests.
# usage: scripts/provision-local.sh SRC_CHECKOUT [DST_CHECKOUT=.]
set -euo pipefail
src=$(cd "${1:?usage: provision-local.sh SRC_CHECKOUT [DST_CHECKOUT]}" && pwd)
dst=$(cd "${2:-.}" && pwd)
[ "$src" != "$dst" ] || { echo "provision-local: SRC and DST are the same" >&2; exit 2; }
for d in tests memory _scripts .opencode plans scripts/v3/out; do
  [ -d "$src/$d" ] || { echo "provision-local: missing $src/$d" >&2; exit 1; }
  mkdir -p "$dst/$d"
  cp -a "$src/$d/." "$dst/$d/"   # src/. into dst/: no dst/d/d nesting on re-run
done
for f in .well-known/README.md audio/README.txt img/act4/CREDITS.md; do
  [ -f "$src/$f" ] || { echo "provision-local: missing $src/$f" >&2; exit 1; }
  mkdir -p "$dst/$(dirname "$f")"
  cp -a "$src/$f" "$dst/$f"
done
[ -e "$dst/node_modules" ] || ln -s "$(readlink -f "$src/node_modules")" "$dst/node_modules"
echo "provision-local: $(ls "$dst"/tests/fixes*.mjs | wc -l) fixes suites -> $dst"
