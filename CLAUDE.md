# NEU agent entry point

Read `AGENTS.md` and `plans/neu-v3/PLAN.md` first. Work in the designated branch/worktree. The public checkout does **not** include the author's local `memory/` walkthrough, `.opencode/` plans or full `tests/` directory.

## Delegation policy
- **Architecture role:** architecture decisions, integration review and visual approval.
- **Implementation role:** bounded behavior, state changes, data transformations and validation.
- **Research and verification role:** source inspection, asset/license research, regression checks and independent review.
Use roles required by current task instructions; model assignment comes from current task context.
Never send visual implementation to a nonvisual builder and treat its output as art-direction approval.
Independent research can run concurrently; code work must respect file ownership and dependency order.

## Current entry
`plans/neu-v3/STATUS.md` is the handoff ledger. `plans/neu-v3/work-orders/` defines next tasks. Do not assume any proposed feature is already coded. Report evidence, not opinions.
