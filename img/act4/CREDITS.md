# Act IV art credits

Every sprite in `img/act4/` is someone else's art. This file records where
each set came from, under what licence it is used, and what was changed on
the way in. Keep one row per source set; add a row when a new set lands.

| Set | Files | Source | Licence / terms | Changes |
|---|---|---|---|---|
| Terraria 1.4.5 HD tile pack (the dungeon tile pack) | `terraria/Tiles_*.png`, `terraria/Wall_*.png` (19 sheets) | "HD Textures v0.16.5-1.4.5" by **Andras Suller** — `Content/Images/` of the tModLoader 1.4.5 texture pack (from the Terraria forums thread *High definition version of all textures up to Terraria 1.4.5*). Source zip: `_sources/TexturePack-v0.16.5-1.4.5.zip` | Terraria assets © Re-Logic. Used here as unmodified game art in a free non-commercial fan work; not redistributed as a pack. | None. Re-encoded from the pack's own RGBA on 2026-11-09 (pixel-identical; the first shipment had been palette-quantized with the alpha dropped, which turned every transparent pixel opaque black). |
| Terraria 1.4.5 NPC / projectile art | `terraria/NPC_*.png`, `terraria/Projectile_300.png`, `terraria/Chain.png` (19 sheets) | Same HD texture pack, `Content/Images/` | Same as above | `tRNS` added on 2026-11-09 so palette index 0 (the rip's black background) is transparent; no pixel values changed. |
| Terraria 1.4.5 item icons | `terraria/axe.png`, `terraria/recall-potion.png`, `terraria/slot.png`, `terraria/mushroom.png` | Terraria wiki rips (not in the HD pack) | Terraria assets © Re-Logic, same terms as above | Untrimmed rips; alpha already present. |
| Calamity Mod NPCs | `calamity/*.png` (59 sheets) | **CalamityModPublic** (`github.com/CalamityTeam/CalamityModPublic`), branch `1.4.4`, commit `1a8cebd` (2026-08-24). Each sheet's `from:` in `js/data/sheets.js` cites the exact `.cs`/file that states its frame count | Calamity Mod is free and its art is used here in a free non-commercial fan work; not redistributed as a pack. | Copied byte-for-byte under the mod's own filename. `tRNS` added on 2026-11-09 to the five NPC sheets whose palette index 0 is the background. |
| Undertale | `undertale/armchair.png`, `firedoor.png`, `gasterblaster.png`, `mushroom-dance.png`, `newhome-corridor.png`, `plant.png`, `soul.png`; `act123/sans-*.png`, `you-walk.png`, `dark-*.png`, `sleep-*.png` | Undertale, Toby Fox — sprite rips (`spr_*`, `bg_*`) | Undertale assets © Toby Fox. Free non-commercial fan work. | Trimmed/re-mapped onto the site's palette; `armchair.png` was regenerated 2026-11-09 (the shipped file was a corrupted placeholder with no source in `_sources/`). |
| Deltarune | `deltarune/bench.png`, `equip-icons.png`, `deltarune/tvtime/*.png` (17 sheets) | Deltarune Chapters 1–3, Toby Fox — extracted atlas art | Deltarune assets © Toby Fox. Free non-commercial fan work. | Cropped from the chapters' own atlases; `tvtime/` sheets are the raw extracted frames. |
| Super Pixel Effects Gigapack | `vfx/Gig*.png`, `vfx/FxHoly.png` | **Super Pixel Effects Gigapack** (free version) by **Will Tice / unTied Games** — `_sources/gigapack.zip` | Free tier: bundle in a game with attribution ("Super Pixel Effects Gigapack – Will Tice / unTied Games"); do not reupload. | Re-sliced from the pack's horizontal rows into this site's vertical-strip convention; `FxHoly` is row 2 of sheet 00 re-sliced. |
| BDragon | `vfx/FxHoly.png` (holy smite strip) | BDragon asset pack, free tier | Free tier: non-commercial use with attribution. | Cropped to the one strip used. |
| Original / generated here | `tiles/*.png`, `witch-face.png`, `act123/*.png` crops | Drawn for this site, or cropped from the rips above | — | The `tiles/` atlases are picked from the Deltarune atlases and re-mapped onto the site's own palette; `witch-face.png` is a crop of the TownNPC witch portrait. |

## Creator index (cleared 2026-11-16)

Owner has granted permission for every bundled asset set. Rights restriction removed from `assets/manifest.v3.json`; credits below name the creators.

| Set | Creator(s) |
|---|---|
| Calamity sprites | Calamity Team and CalamityModPublic contributors |
| Terraria tiles / NPC / item art | Re-Logic; HD texture pack by Andras Suller |
| Deltarune art | Toby Fox |
| Undertale art | Toby Fox |
| Pixel VFX | Will Tice / unTied Games (Super Pixel Effects Gigapack); BDragon |
| Tiles / palette remaps | Toby Fox atlas crops, re-mapped for this site |
| Act IV audio | Site-owned, owner-authorized |
