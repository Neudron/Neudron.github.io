# Work order V3-000 — private workshop audit

**Base:** `bbb4331e9`. **Owner:** Haiku 5.5 research/test; Opus integration. **Files allowed:** `plans/neu-v3/{STATUS,requirements.csv,WORLD_GRAPH,DECISIONS,BUGS}.md` (requirements file is CSV) and independent audit notes. **Forbidden:** shipped `js/`, `css/`, `img/`, `audio/`, `index.html`, `memory/story.md` contents in public PR.

1. On actual host `git status --short; git branch --show-current; git log --oneline -20; git worktree list; git remote -v`. Stop if worktree dirty; isolate.
2. Read local private `memory/PLAN.md`, `story.md`, `design.md`, `architecture.md`, `decisions.md`, `workflow.md`, `assets.md`, `.opencode/plans`, trackers and original user specifications. Record missing files explicitly.
3. Map each explicit requirement to source paragraph, actual file/symbol, flag, owner and test; do not mark WORKING from commit prose alone.
4. Run `npm ci`, `npm run check/build/verify` and local `node tests/run-all.mjs` **if present**. Save actual stdout and failures.
5. Record asset provenance queue and spoiler handling. Produce exact room ID/gate graph, including dynamic rooms and challenge modes.
6. Opus resolves conflicts in decisions ledger; do not publish private story contents.
**Done:** no unknown critical source files, baseline captured, all gates reported PASS/FAIL/NOT RUN. **Rollback:** docs-only commit revert.
