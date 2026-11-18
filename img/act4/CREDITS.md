# Act IV art credits

Every sprite in `img/act4/` is someone else's art. This file records where
each set came from, under what terms it is used, and what was changed on
the way in. Keep one row per source set; add a row when a new set lands.
`null` means the fact is not documented — it is not a guess or an approval.

Tags: **APPROVED** (rightsholder clearance on file), **RIGHTS_PENDING** (no
rightsholder licence), **GENERATED_UNREVIEWED** (generated art not yet
reviewed), **REJECTED**. Availability online is not a licence; screenshots
and search hits are research links, not permission.

| Set | Files | Creator | Exact source URL | Stated use terms | Modification | Attribution | Redistribution | Tag |
|---|---|---|---|---|---|---|---|---|
| Terraria 1.4.5 HD tile pack (the dungeon tile pack) | `terraria/Tiles_*.png`, `terraria/Wall_*.png` (19 sheets) | Re-Logic; HD pack by **Andras Suller** | `null` — Terraria forums thread *High definition version of all textures up to Terraria 1.4.5*, exact URL not recorded; local zip `_sources/TexturePack-v0.16.5-1.4.5.zip` (gitignored) | Terraria assets © Re-Logic. No reuse/redistribution licence located. A free pack download is a source, not a licence. | None. Re-encoded from the pack's own RGBA on 2026-11-09 (pixel-identical; the first shipment had been palette-quantized with the alpha dropped, which turned every transparent pixel opaque black). | This file, creator index | Not redistributed as a pack; no rightsholder licence | RIGHTS_PENDING |
| Terraria 1.4.5 NPC / projectile art | `terraria/NPC_*.png`, `terraria/Projectile_300.png`, `terraria/Chain.png` (19 sheets) | Re-Logic; HD pack by Andras Suller | `null` — same HD pack, `Content/Images/`; exact thread URL not recorded | Same as above | `tRNS` added on 2026-11-09 so palette index 0 (the rip's black background) is transparent; no pixel values changed. | This file, creator index | Same as above | RIGHTS_PENDING |
| Terraria 1.4.5 item icons | `terraria/axe.png`, `terraria/recall-potion.png`, `terraria/slot.png`, `terraria/mushroom.png` | Re-Logic (wiki rips) | `null` — Terraria wiki rips, not in the HD pack; exact URL not recorded | Terraria assets © Re-Logic, same terms as above | Untrimmed rips; alpha already present. | This file, creator index | Same as above | RIGHTS_PENDING |
| Calamity Mod NPCs | `calamity/*.png` (59 sheets) | Calamity Team and CalamityModPublic contributors; proprietary owner **Azafure, LLC** | `https://github.com/CalamityTeam/CalamityModPublic` (branch `1.4.4`, commit `1a8cebd`); terms `https://github.com/CalamityTeam/CalamityModPublic/blob/1.4.4/LICENSE.md` | Proprietary / "Other", all rights reserved to Azafure, LLC. Source may be used as reference only; lifted code must credit "Azafure, LLC". The mod "cannot be redistributed in any form or in any location". No asset licence granted. Each sheet's `from:` in `js/data/sheets.js` cites the exact `.cs`/file that states its frame count. | Copied byte-for-byte under the mod's own filename. `tRNS` added on 2026-11-09 to the five NPC sheets whose palette index 0 is the background. | This file, creator index; "Azafure, LLC" per licence | NOT permitted; no rightsholder licence | RIGHTS_PENDING |
| Undertale | `undertale/armchair.png`, `firedoor.png`, `gasterblaster.png`, `mushroom-dance.png`, `newhome-corridor.png`, `plant.png`, `soul.png`; `act123/sans-*.png`, `you-walk.png`, `dark-*.png`, `sleep-*.png` | Toby Fox | `null` — sprite rips (`spr_*`, `bg_*`), exact extraction URL not recorded. UndertaleModTool (`https://github.com/UnderminersTeam/UndertaleModTool/`) is GPL tool code, not art permission. | Undertale assets © Toby Fox. No licence granted. | Trimmed/re-mapped onto the site's palette; `armchair.png` was regenerated 2026-11-09 (the shipped file was a corrupted placeholder with no source in `_sources/`). | This file, creator index | NOT permitted; no rightsholder licence | RIGHTS_PENDING |
| Deltarune | `deltarune/bench.png`, `equip-icons.png`, `deltarune/tvtime/*.png` (17 sheets) | Toby Fox | `null` — Deltarune Chapters 1–3 extracted atlas art, exact extraction URL not recorded. Research links only (NOT permission): `https://github.com/ThatsYar/Deltarune-Source-Code`, `https://code.deltarune.wiki`. | Deltarune assets © Toby Fox. No licence granted. `equip-icons.png` provenance unknown within this set; not approved. | Cropped from the chapters' own atlases; `tvtime/` sheets are the raw extracted frames. | This file, creator index | NOT permitted; no rightsholder licence | RIGHTS_PENDING |
| Super Pixel Effects Gigapack | `vfx/Gig*.png`, `vfx/FxHoly.png` | **Will Tice / unTied Games** | `null` — free version, local zip `_sources/gigapack.zip` (gitignored); exact public source URL not recorded | Free tier: bundle in a game with attribution ("Super Pixel Effects Gigapack – Will Tice / unTied Games"); do not reupload. No owner sign-off on file. | Re-sliced from the pack's horizontal rows into this site's vertical-strip convention; `FxHoly` is row 2 of sheet 00 re-sliced. | This file, creator index | Bundling with attribution per free tier; no standalone reupload | RIGHTS_PENDING |
| BDragon | `vfx/FxHoly.png` (holy smite strip) | BDragon | `null` — BDragon asset pack; exact public source URL not recorded | Free tier: non-commercial use with attribution. No owner sign-off on file. | Cropped to the one strip used. | This file, creator index | Bundling with attribution per free tier; no standalone reupload | RIGHTS_PENDING |
| Original / generated here | `tiles/*.png`, `witch-face.png`, `act123/*.png` crops | Crops of the rips above (Toby Fox); site palette remap | `null` — crops of the Deltarune atlases / TownNPC witch portrait; see Undertale and Deltarune rows | Toby Fox atlas crops © Toby Fox. No licence granted. | The `tiles/` atlases are picked from the Deltarune atlases and re-mapped onto the site's own palette; `witch-face.png` is a crop of the TownNPC witch portrait. | This file, creator index | NOT permitted; no rightsholder licence | RIGHTS_PENDING |

## Creator index (non-commercial fan work)

No licence or redistribution right has been granted by the original rightsholders for the Calamity, Terraria, Deltarune or Undertale art below. It is bundled here as attributed fan art in a free, non-commercial project; all rights remain with the respective creators. Contact the site owner if any use here is objectionable. The VFX packs carry their own free-tier attribution terms, and the Act IV audio is site-owned.

These folders are rights-review queues, not evidence of permission. Do not reuse or redistribute the franchise assets outside this non-commercial project.

| Set | Creator(s) |
|---|---|
| Calamity sprites | Calamity Team and CalamityModPublic contributors; proprietary owner Azafure, LLC |
| Terraria tiles / NPC / item art | Re-Logic; HD texture pack by Andras Suller |
| Deltarune art | Toby Fox |
| Undertale art | Toby Fox |
| Pixel VFX | Will Tice / unTied Games (Super Pixel Effects Gigapack); BDragon |
| Tiles / palette remaps | Toby Fox atlas crops, re-mapped for this site |
| Act IV audio | Site-owned, owner-authorized (claim not independently verified in this audit) |

## Audit notes (W9-ASSETS, 2026-11-19)

- Counts: APPROVED 0, RIGHTS_PENDING 9 (table rows), GENERATED_UNREVIEWED 0, REJECTED 0. No generated art shipped; `plans/neu-v3/IMAGE_PROMPTS.md` are prompts, not output.
- No set is CLEARED. The prior rights correction is preserved: franchise art is attributed fan use in a non-commercial project, not licensed reuse.
- `scripts/build.mjs` copies every tracked `img/`/`audio/` file except `.md` into `dist/`; the `verify-dist.mjs` allowlist accepts those paths. Rights-pending art is NOT currently excluded from the published artifact. See `scripts/v3/out/W9-ASSETS/AUDIT.md`.
- Coverage gap: root `img/` files (`Sans_sprite.webp`, `totem.webp`, `annoying-dog.gif`, `cat.gif`, site-authored SVGs) ship but are not rows above; attribution not audited.
