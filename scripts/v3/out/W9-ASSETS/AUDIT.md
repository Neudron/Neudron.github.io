# W9-ASSETS — visual dependency / licence truthfulness audit

Date 2026-11-19. Work order W9-ASSETS, base `999541d`, branch `visual/w9-assets`.
Scope: shipped visual dependencies only. No code, art, README or index copy changed.

## Method

Tracked files audited with `git ls-files`; source terms cross-checked against
`VISUAL_IMPROVEMENT_RESEARCH.md` VIP-11 and its licensing stream. Availability
online is not a licence; screenshots and search hits are research links, not
permission. Unknown source URLs, dimensions, pivots and frame counts recorded
as `null`, not guessed. No licence or approval invented; the prior rights
correction (no rightsholder licence, non-commercial fan use) is preserved.

## Counts per tag

| Tag | Manifest groups (7) | CREDITS rows (9) | Meaning |
|---|---|---|---|
| APPROVED | 0 | 0 | Rightsholder clearance on file — none |
| RIGHTS_PENDING | 7 | 9 | No rightsholder licence; fan-use attribution only |
| GENERATED_UNREVIEWED | 0 | 0 | No generated art shipped; prompts are not output |
| REJECTED | 0 | 0 | None formally rejected |

Manifest groups cover 165 tracked files: calamity 59, terraria 42, deltarune
19, undertale 7, vfx 26, tiles 6, audio 6. CREDITS rows add the per-use
breakdown (9 source sets).

## Must replace / exclude before a rights-cleared public release

1. `img/act4/calamity/` (59) — proprietary, Azafure, LLC; "cannot be
   redistributed in any form or in any location" [1].
2. `img/act4/terraria/` (42) — © Re-Logic; no reuse licence found.
3. `img/act4/deltarune/` (19) and `img/act4/tiles/` (6) — © Toby Fox; no
   licence. `equip-icons.png` provenance still unknown.
4. `img/act4/undertale/` (7) and `img/act123/` (11) — © Toby Fox; no licence.
5. `img/act4/vfx/` (26) — free-tier terms exist, but no exact public source
   URL or owner sign-off recorded; do not mark APPROVED.
6. `img/act4/witch-face.png` — TownNPC witch crop (Toby Fox).
7. Root `img/` franchise files (`Sans_sprite.webp`, `totem.webp`,
   `annoying-dog.gif`, `cat.gif`) — shipped, not yet attributed/audited.

Infernum MIT covers its code only, not the Calamity/Terraria art it depends
on; WOTG shows no licence at all [1]. Neither is clearance for these sets.

## Verified release blocker — build ships RHS-pending art

VERIFIED (not assumed): `scripts/build.mjs` copies every tracked file under
`img/` and `audio/` except `.md` (via `git ls-files`) into `dist/`, and
`scripts/verify-dist.mjs` allowlist accepts `img/`/`audio/` paths without
excluding review queues. A fresh `npm run build` produced `dist/` containing
59 calamity, 42 terraria, 19 deltarune, 7 undertale, 6 tiles and 26 vfx
files plus 11 `img/act123/` files. **No rights-pending asset exclusion is
configured.** `npm run verify` allowlist passes because it does not test
rights status. No build exclusion exists to rely on. This work order owns no
code files, so `build.mjs` / `verify-dist.mjs` were left unchanged; owner must
add an exclusion or obtain licences before a rights-cleared release.

## Sources

1. https://github.com/CalamityTeam/CalamityModPublic/blob/1.4.4/LICENSE.md — proprietary terms, Azafure, LLC, no redistribution (quoted in `VISUAL_IMPROVEMENT_RESEARCH.md` §"Terraria mod source repos", lines 1578-1650).
2. https://github.com/ThatsYar/Deltarune-Source-Code — extracted asset dump, "for fan games", no licence field; rights-review only (`VISUAL_IMPROVEMENT_RESEARCH.md`, line 1671).
3. https://github.com/UnderminersTeam/UndertaleModTool/ — GPL tool code, not permission for extracted art (`VISUAL_IMPROVEMENT_RESEARCH.md`, line 1663).
