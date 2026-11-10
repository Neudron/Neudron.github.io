# Story canon and gating — public-safe control rules

This file intentionally records **guardrails**, not the private complete walkthrough.

- Separate **page/TV launcher**, **in-game post-boss story Console**, and **developer debug/cheat console**. A dev command must never silently unlock the post-boss story Console.
- The HOME bedroom and console exit are actual player-world locations. Recall potion returns to the current canonical bedroom's bed-safe spawn, never an arbitrary corridor.
- Flags such as `witch_met`, `solved:b4_ice`, `tv_restored` and `bed_free` appear in the tracked code. Preserve actual meaning and check the local canonical story before renaming or granting them.
- All story gates are one-way or reversible **only when intended**; e.g., a locked late-game prize cannot be opened by visual effects alone.
- A save records obtained rewards once, unlocked pathways and boss completion; a cutscene replay does not mint duplicate items.
- Dad mystery and late revelations require the private `memory/story.md` before significant rewrites. Do not improvise answers, reveal spoilers in the root page or bake experimental twists into code.
- When sources conflict, append a decision to `plans/neu-v3/DECISIONS.md` with exact evidence, source recency and affected flags.
