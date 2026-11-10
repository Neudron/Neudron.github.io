# NEU agent entry point

Read `AGENTS.md` and `plans/neu-v3/PLAN.md` first. Work in the designated branch/worktree. The public checkout does **not** include the author's local `memory/` walkthrough, `.opencode/` plans or full `tests/` directory.

## Delegation policy
- **Opus 5.5:** architecture, final integration and **all player-visible rendering, room composition, camera, animations, VFX, UI and visual asset approvals**.
- **Sonnet 5.5:** bounded nonvisual mechanics, save migrations, deterministic state, data transformations and graph validation.
- **Haiku 5.5:** inventory, asset/license research, regression tests, source inspection and independent verification.
Never send visual implementation to a nonvisual builder and treat its output as art-direction approval.
Independent research can run concurrently; code work must respect file ownership and dependency order.

## Current entry
`plans/neu-v3/STATUS.md` is the handoff ledger. `plans/neu-v3/work-orders/` defines next tasks. Do not assume any proposed feature is already coded. Report evidence, not opinions.

## References
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5
