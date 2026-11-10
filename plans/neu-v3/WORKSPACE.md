# Agent-friendly workspace migration — reversible

The repository already has `js/core`, `js/act4`, `css`, `img`, `audio`, `scripts` and `tests`. Do **not** move them just to achieve an aesthetic folder tree: the HTML source script order and build bundles have path-sensitive behavior.

Keep runtime paths stable; introduce `design/` for policies, `plans/neu-v3/` for handoffs, `assets/` for provenance, and `.claude/agents/` for bounded worker contracts. Proposed changes to JS folder structure require an inventory of every script, import/reference, asset URL, save ID and test before renaming.

The existing `.gitignore` intentionally ignores `memory/`, `.opencode/`, most `tests/`, `_scripts/` and `*.md`. Newly tracked V3 docs on this branch are tracked explicitly; agents creating *additional* Markdown files may need `git add -f <path>` after confirming that those files contain no secrets or sensitive private walkthrough. Do not broadly unignore `memory/`.

Local source may have many more tests and skill definitions than remote. Prefer to patch the actual local workshop after verifying its status; export only rights-cleared final artifacts. Ship `dist/` through existing main-only Pages workflow; never deploy documentation.
