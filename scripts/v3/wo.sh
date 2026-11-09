#!/bin/sh
# wo.sh begin|rollback|serve <ID> — run from the v3-integration worktree root.
# begin:    remember HEAD and snapshot the untracked tests/ so a failed work order can be undone.
# rollback: drop every uncommitted change of the current work order and restore tests/.
# serve:    static server for this worktree on :8766 (8765 serves the main checkout).
set -e
case "$PWD" in */.claude/worktrees/v3-integration) ;; *) echo "wo.sh: run from the v3-integration worktree root, not $PWD" >&2; exit 2 ;; esac
S=scripts/v3/out/snap
mkdir -p "$S" scripts/v3/out/shots
# Keep local outputs under the classified scripts/ directory.
[ -f scripts/v3/out/.gitignore ] || echo "*" > scripts/v3/out/.gitignore
case "$1" in
  begin)
    [ -n "$2" ] || { echo "usage: wo.sh begin <ID>" >&2; exit 2; }
    git rev-parse HEAD > "$S/$2.head"
    tar -C tests --exclude node_modules -cf "$S/$2-tests.tar" .
    echo "begin $2 at $(cat "$S/$2.head")"
    ;;
  rollback)
    [ -f "$S/$2-tests.tar" ] || { echo "wo.sh: no snapshot for $2, nothing rolled back" >&2; exit 2; }
    git checkout -- .
    git clean -fdq -- js css img audio scripts
    find tests -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
    tar -C tests -xf "$S/$2-tests.tar"
    echo "rolled back $2 to $(git rev-parse --short HEAD)"
    ;;
  serve)
    curl -s -o /dev/null http://127.0.0.1:8766/ || (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 &)
    echo "serving $PWD on http://127.0.0.1:8766/"
    ;;
  *) echo "usage: wo.sh begin|rollback|serve <ID>" >&2; exit 2 ;;
esac
