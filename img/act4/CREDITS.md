# Art credits — downloaded fan art (`img/act4/fan/**`)

Status for every group below: **OWNER-APPROVED FAN USE (2026-11-21), NOT CLEARED** for the rows marked "yes" in the *Ships in dist* column. Rows marked "no" are not shipped and stay **OWNER-ACCEPTED-FAN-USE, NOT CLEARED** (local development only).

These are Deltarune / Friday Night Funkin' rips downloaded from
The Spriters Resource on 2026-11-20 and staged on branch `dl-assets`
(commit d89c5ab). Rightsholders: **Toby Fox** (Deltarune, © 2018-2026,
all rights reserved) and **The Funkin' Crew** (Friday Night Funkin').

No rightsholder licence is claimed for any group. No redistribution
permission is asserted. Nothing here is CLEARED. Full per-file evidence,
including the verbatim source-page licence text, lives in
`scripts/v3/out/wc-final/DL-ASSET-RIGHTS-LEDGER.md`.

`CLEARED` is never a correct status for these rows: no written permission
from Toby Fox or The Funkin' Crew exists in this repository.

## Groups

| Group | Shipped path | Source | Rightsholder | Licence | Ships in dist | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Deltarune HUD + battle menu sheet | `img/act4/fan/deltarune/hud.png`, `img/act4/fan/deltarune/battle-menu.png` | The Spriters Resource, Deltarune UI (assets 110733, 110943) | Toby Fox | none claimed | no | OWNER-ACCEPTED-FAN-USE, NOT CLEARED (not shipped) |
| Deltarune battle background frame sequence (100 PNG frames) | `img/act4/fan/deltarune/bg/frame-000.png` … `frame-099.png` | The Spriters Resource, Deltarune UI "Battle Background" (asset 175637) | Toby Fox | none claimed | yes | OWNER-APPROVED FAN USE (2026-11-21), NOT CLEARED |
| Deltarune battle box frame sequence (46 PNG frames) | `img/act4/fan/deltarune/box/frame-000.png` … `frame-045.png` | The Spriters Resource, Deltarune UI "Battle Box" (asset 167406) | Toby Fox | none claimed | yes | OWNER-APPROVED FAN USE (2026-11-21), NOT CLEARED |
| Deltarune Chapter 3 intro frame sequence (158 PNG frames) | `img/act4/fan/deltarune/intro/frame-000.png` … `frame-157.png` | The Spriters Resource, Deltarune cutscenes "Chapter 3 Intro (TV Time)" (asset 487588). Wired as the TV TIME quiz opening (`fanIntro` in `js/act4/quiz.js`). | Toby Fox | none claimed | yes | OWNER-APPROVED FAN USE (2026-11-21), NOT CLEARED |
| Tenna's Funny Text frame sequences (Eng + JP, 35 folders) | `img/act4/fan/deltarune/funny-text/Tenna Funny Text/**` | The Spriters Resource, Deltarune misc "Tenna's Funny Text" (asset 273270) | Toby Fox / Temmie Chang (sprite text) | none claimed | no | OWNER-ACCEPTED-FAN-USE, NOT CLEARED (not shipped) |
| Deltarune single-image cutscene / character rips | `img/act4/fan/deltarune/tenna.png` | The Spriters Resource, Deltarune "Tenna" character/animation sheet (asset 273063) | Toby Fox | none claimed | no | OWNER-ACCEPTED-FAN-USE, NOT CLEARED (not shipped) |
| Deltarune single-image character rip | `img/act4/fan/deltarune/sans.png` | The Spriters Resource, Deltarune "Sans" NPC sheet (asset 113663) | Toby Fox | none claimed | no | OWNER-ACCEPTED-FAN-USE, NOT CLEARED (not shipped) |
| Deltarune single-image cutscene rip | `img/act4/fan/deltarune/spelling-bee-crowd.png` | The Spriters Resource, Deltarune "Spelling Bee Crowd" cutscene sheet (asset 183609) | Toby Fox | none claimed | no | OWNER-ACCEPTED-FAN-USE, NOT CLEARED (not shipped) |
| Deltarune single-image cutscene FX rip | `img/act4/fan/deltarune/weird-route-fx.png` | The Spriters Resource, Deltarune "Weird Route FX (Chapter 4)" cutscene sheet (asset 504105) | Toby Fox | none claimed | no | OWNER-ACCEPTED-FAN-USE, NOT CLEARED (not shipped) |
| Deltarune single-image effects sheet | `img/act4/fan/deltarune/effects.png` | The Spriters Resource, Deltarune "Effects" sheet (asset 113349) | Toby Fox | none claimed | no | OWNER-ACCEPTED-FAN-USE, NOT CLEARED (not shipped) |
| Deltarune single-image explosion sheet | `img/act4/fan/deltarune/explosion.png` | The Spriters Resource, Deltarune "Realistic Explosion" sheet (asset 162192) | Toby Fox | none claimed | no | OWNER-ACCEPTED-FAN-USE, NOT CLEARED (not shipped). Page comments claim a GameMaker stock / 1998 library origin; upstream origin UNVERIFIED, so this stays uncleared. |
| **Week 4-only FNF arrow strip** (FNF "Arrows" sheet, week 4 palette, cut to the Week 4 strip) | `img/act4/fan/fnf-week4/strip.png` (only file referenced by code). `up.png`, `down.png`, `left.png`, `right.png` are local-only and do NOT ship. | The Spriters Resource, Friday Night Funkin' misc "Arrows" (asset 151105); cropped here to the Week 4 arrow set only | The Funkin' Crew | none claimed | strip.png only | OWNER-APPROVED FAN USE (2026-11-21) for `strip.png`, NOT CLEARED. Other four files: OWNER-ACCEPTED-FAN-USE, NOT CLEARED (not shipped). |

## Owner decision (2026-11-21)

The owner ships the fan files marked "yes" above, with credit to Toby Fox
(Deltarune) and The Funkin' Crew (Friday Night Funkin'), and accepts the
fan-use risk. Takedown requests from either rightsholder will be honoured by
removing the affected files. This is a risk decision. It is not a licence,
a clearance, or a redistribution right, and no rightsholder permission has
been obtained.

## Jar (not art, recorded so the boundary is explicit)

`turnbattle-2.0.29.jar` (Soulbound Turn Battle, Fabric mod by Pixelcite) was
downloaded and analysed for its fighting-box mechanics only. Its code is MIT;
its bundled 52 OGG/WAV files and 298 PNG textures are UNKNOWN and are **NOT
shipped** — not into `img/`, not into `audio/`, not into `dist/`.

## Local-development vs shipping

The owner accepted the non-commercial fan-use risk for the shipped rows
above. That is a risk decision, not a clearance, and it does not convert into
a licence or a redistribution right. The Funkin' Crew's own asset licence says
the content "may not be publicly distributed for free or for profit by anyone
but the copyright owner". Public GitHub Pages publication is a formal
publication, so this tension is recorded here rather than resolved.

Rows marked "no" in *Ships in dist* are not in `dist/` and are for local
development only.

See `plans/neu-v3/ASSET_MANIFEST.md` for the repo-wide asset inventory.

# Art credits — earlier batches (unchanged, also NOT CLEARED)

Status: **OWNER-ACCEPTED-FAN-USE**. Original game art ships on the owner's
explicit non-commercial fan-use risk acceptance. No rightsholder licence is
claimed for any row below; none is APPROVED. See `plans/neu-v3/ASSET_MANIFEST.md`.

| Art source | Shipped path | Rightsholder / note | Licence |
| --- | --- | --- | --- |
| Terraria HD texture pack and wiki item icons | `img/act4/terraria/` | Re-Logic; HD texture pack by Andras Suller. Dungeon tile pack crops re-encoded from the HD texture pack with alpha restored. | none claimed |
| Calamity Mod (Supreme Calamitas, Polterghast, projectiles, 5 dungeon NPCs) | `img/act4/calamity/` | Calamity Team / Azafure, LLC. Proprietary, all rights reserved. | none claimed |
| Undertale sprites (Act I–III and props) | `img/act123/`, `img/act4/undertale/` | Toby Fox. | none claimed |
| Deltarune atlases (TV Time, equipment icons, zone tiles) | `img/act4/deltarune/`, `img/act4/tiles/` | Toby Fox. | none claimed |
| Super Pixel Effects Gigapack (free tier) + BDragon free-tier effects | `img/act4/vfx/` | Will Tice / unTied Games; BDragon. Bundle-with-attribution terms only; no rightsholder clearance. | none claimed |
| TownNPC witch portrait crop | `img/act4/witch-face.png` | Toby Fox (Deltarune atlas crop). | none claimed |
| Root franchise assets | `img/Sans_sprite.webp`, `img/totem.webp`, `img/annoying-dog.gif`, `img/cat.gif` | Toby Fox / Undertale. | none claimed |

AI-generated replacements under `img/act4/original/` and their generators were
removed. itch.io gap filling is a later step; no itch.io pack was downloaded
for these changes.