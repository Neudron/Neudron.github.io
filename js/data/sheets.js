/* sheets.js — the sprite manifest for Act IV.
   ───────────────────────────────────────────────────────────────────
   RE-SOURCED 2026-08-24. Every entry below used to be measured by
   alpha-thresholding pixel rows and guessing at divisors, because the
   only art on hand was rip-site output with no frame counts attached.
   That whole apparatus is gone. Every Calamity file here is now copied
   BYTE-FOR-BYTE from the mod's own public repository, filename
   unchanged, and every `frames`/`w`/`h`/`fw`/`fh` is read straight out
   of the `.cs` that ships beside it — `Main.npcFrameCount[Type]` for
   NPCs, `Main.projFrames[Type]` for projectiles, both in the same
   directory as the PNG.

     git clone --depth 1 https://github.com/CalamityTeam/CalamityModPublic
     commit: see _sources/calamity-src-commit.txt (1a8cebd, 2026-08-24)

   RENAMING WAS THE BUG. The previous manifest renamed files for
   brevity (`scal-forcefield.png` for `ForcefieldTexture.png`,
   `scal-head.png` for `HoodlessHeadIcon.png`) and that is what let
   PROJECTILE art get used to draw an NPC BODY without anyone
   noticing: the brothers were drawn from `SupremeCataclysmFist.png` /
   `SupremeCatastropheSlash.png` — their own thrown attacks — because
   nothing on disk said `SupremeCataclysm.png` (their actual body)
   existed. Every `src` below keeps the mod's filename verbatim so a
   file's name is still true once it is sitting in this folder.

   THE ENTITY TRAP. Three different NPCs in the mod are called some
   form of "Calamitas". Only one is this fight:
     NPCs/SupremeCalamitas/  — Supreme Witch, Calamitas, THE BOSS. ✅
     NPCs/CalClone/          — Calamitas Clone, an earlier, different
                                boss. Never this fight. ❌
     NPCs/TownNPCs/          — the witch who moves in after SCal dies.
                                Used for the pre-fight `witch` portrait
                                only, deliberately (rooms-a.js has her
                                as an ordinary NPC before the reveal —
                                see js/act4/rooms-a.js:238). ❌ for
                                anything fight-related.
   Every fight sprite below has a `from:` starting with
   `NPCs/SupremeCalamitas/` or `Projectiles/Boss/`. If a future entry
   doesn't, that is a sign it came from the wrong directory.

   `fw`/`fh` are the CELL size, not the drawn sprite — cells are
   padded. `fps` is the animation rate the game plays them at; 0 means
   the frame is chosen by state (a phase, a direction) rather than by
   a clock. `cols` is for sheets with more than one column — see the
   note on `scal` below for why that field exists at all.            */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var IMG = 'img/act4/';

  NEU.sheets = {

    /* ── Supreme Witch, Calamitas ────────────────────────────────
       NPCs/SupremeCalamitas/SupremeCalamitas.cs:276 —
       Main.npcFrameCount[Type] = 21. NPC.width = NPC.height = 44 is
       Terraria's collision box for tile/knockback purposes; it is not
       used here, because this fight's soul-touches-her mechanic is a
       custom stand-in for Terraria's ranged combat and was never a
       contact fight in the source game.

       TWO COLUMNS. The file is 120 wide and holds two 60px-wide pose
       sets side by side. `fw` used to be 120, so the blitter drew
       BOTH poses at once and she rendered as a double exposure of two
       overlapping women — which is what "Calamitas has no sprite"
       actually looked like on screen. `cols` makes the second half
       addressable; the mod's own FrameAnimationType enum (same file,
       line ~49) assigns row bands: 0 UpwardDraft (idle), 1
       FasterUpwardDraft (charge/dash — ALSO the dart-burst hover,
       confirmed at line ~2223, `FrameType = FasterUpwardDraft` under
       `ai[1]==0`), 2 Casting, 3 BlastCast (gigablast), 4
       BlastPunchCast (phase-2 gigablast), 5 OutwardHandCast
       (hellblast, confirmed line ~2461), 6 PunchHandCast (phase-2
       hellblast). Phase 2 is the same art drawn a second time with a
       'lighter' composite — that is how the mod itself shows it too,
       not an invented shortcut. */
    scal:      { src: IMG + 'calamity/SupremeCalamitas.png',
                 from: 'NPCs/SupremeCalamitas/SupremeCalamitas.png',
                 w: 120, h: 1260, frames: 21, cols: 2, fw: 60, fh: 60, fps: 12 },
    scalHood:  { src: IMG + 'calamity/SupremeCalamitasHooded.png',
                 from: 'NPCs/SupremeCalamitas/SupremeCalamitasHooded.png',
                 w: 120, h: 1302, frames: 21, cols: 2, fw: 60, fh: 62, fps: 12,
                 note: 'the hooded intro pose' },
    /* her two portrait icons — used by the talk-box FACE map in
       sans.js, not by the fight canvas */
    scalFace:     { src: IMG + 'calamity/HoodlessHeadIcon.png',
                 from: 'NPCs/SupremeCalamitas/HoodlessHeadIcon.png',
                 w: 36, h: 40, frames: 1, fw: 36, fh: 40, fps: 0 },
    scalFaceHood: { src: IMG + 'calamity/HoodedHeadIcon.png',
                 from: 'NPCs/SupremeCalamitas/HoodedHeadIcon.png',
                 w: 36, h: 40, frames: 1, fw: 36, fh: 40, fps: 0 },

    /* her projectiles — Projectiles/Boss/. Each `.cs` sets its own
       hitbox via Projectile.width/height, separate from the sprite
       cell; those real hitboxes are what B6 (fair-hitbox pass) reads,
       converted at ~0.67 site-px per Terraria-px (the ratio the
       existing 224 Terraria px ≈ 150 site px proximity trigger uses). */
    dart:      { src: IMG + 'calamity/BrimstoneBarrage.png',
                 from: 'Projectiles/Boss/BrimstoneBarrage.cs',
                 w: 18,  h: 176,  frames: 4,  fw: 18,  fh: 44, fps: 14,
                 hitTerraria: { w: 18, h: 44 } },
    hellblast: { src: IMG + 'calamity/BrimstoneHellblast2.png',
                 from: 'Projectiles/Boss/BrimstoneHellblast2.cs',
                 w: 54,  h: 176,  frames: 4,  fw: 54,  fh: 44, fps: 14,
                 hitTerraria: { w: 40, h: 40 } },
    fireblast: { src: IMG + 'calamity/SCalBrimstoneFireblast.png',
                 from: 'Projectiles/Boss/SCalBrimstoneFireblast.cs',
                 w: 36,  h: 250,  frames: 5,  fw: 36,  fh: 50, fps: 12,
                 hitTerraria: { w: 36, h: 36 },
                 note: 'inertia 100, homeSpeed 9; bursts within 224px or after 4s (both confirmed in-file)' },
    gigablast: { src: IMG + 'calamity/SCalBrimstoneGigablast.png',
                 from: 'Projectiles/Boss/SCalBrimstoneGigablast.cs',
                 w: 52,  h: 492,  frames: 6,  fw: 52,  fh: 82, fps: 12,
                 hitTerraria: { w: 50, h: 50 } },

    /* the brothers — real NPC bodies, not their thrown attacks.
       NPCs/SupremeCalamitas/SupremeCataclysm.cs:61 — frameCount 9;
       CurrentFrame runs 0-21 (idle loops 0-11, punch lerps to 21;
       line ~131/137), unpacked as xFrame = CurrentFrame/9 (0-2, three
       columns), yFrame = CurrentFrame%9 (0-8, nine rows) — line
       ~140-141. 636/3 = 212, 1872/9 = 208.
       SupremeCatastrophe.cs:54 — frameCount 8; CurrentFrame 0-15
       (idle 0-5, slash lerps to 15), xFrame = CurrentFrame/8 (0-1,
       two columns), yFrame = CurrentFrame%8 (0-7, eight rows).
       800/2 = 400, 1840/8 = 230.
       Real NPC.width/height for both is 120 (used for the strike-reach
       check in boss-scal.js, replacing the old sprite-derived guess
       now that the source states it directly). Glow masks stack
       additively via `glowKeys`, the same path Polterghast already
       uses for its phase glows. */
    cataclysm:     { src: IMG + 'calamity/SupremeCataclysm.png',
                 from: 'NPCs/SupremeCalamitas/SupremeCataclysm.cs',
                 w: 636, h: 1872, frames: 9, cols: 3, fw: 212, fh: 208, fps: 10,
                 hitTerraria: { w: 120, h: 120 } },
    cataclysmGlow: { src: IMG + 'calamity/SupremeCataclysmGlow.png',
                 from: 'NPCs/SupremeCalamitas/SupremeCataclysmGlow.png',
                 w: 636, h: 1872, frames: 9, cols: 3, fw: 212, fh: 208, fps: 10 },
    catastrophe:     { src: IMG + 'calamity/SupremeCatastrophe.png',
                 from: 'NPCs/SupremeCalamitas/SupremeCatastrophe.cs',
                 w: 800, h: 1840, frames: 8, cols: 2, fw: 400, fh: 230, fps: 10,
                 hitTerraria: { w: 120, h: 120 } },
    catastropheGlow: { src: IMG + 'calamity/SupremeCatastropheGlow.png',
                 from: 'NPCs/SupremeCalamitas/SupremeCatastropheGlow.png',
                 w: 800, h: 1840, frames: 8, cols: 2, fw: 400, fh: 230, fps: 10 },
    /* their thrown attacks — Projectiles/Boss/*.cs, projFrames 4 each.
       Pose identified 2026-08-17 by rendering both files at 4x onto a
       checkerboard with the cell grid drawn over them
       (`_scripts/contact-sheet.mjs`): SupremeCatastropheSlash.png is
       a bar along the BOTTOM of its cell hooking upward — the lower
       jaw of the pincer; SupremeCatastropheSlashAlt.png is a bar
       along the TOP curving down — the upper jaw. That reading is
       kept; only the manifest keys changed, from the pose-guess names
       (`slashTop`/`slashBot`) to the mod's own filenames. */
    cataclysmFist:    { src: IMG + 'calamity/SupremeCataclysmFist.png',
                 from: 'Projectiles/Boss/SupremeCataclysmFist.cs',
                 w: 126, h: 224,  frames: 4,  fw: 126, fh: 56, fps: 16,
                 hitTerraria: { w: 126, h: 54 } },
    cataclysmFistAlt: { src: IMG + 'calamity/SupremeCataclysmFistAlt.png',
                 from: 'Projectiles/Boss/SupremeCataclysmFistAlt.png',
                 w: 126, h: 224,  frames: 4,  fw: 126, fh: 56, fps: 16 },
    catastropheSlash:    { src: IMG + 'calamity/SupremeCatastropheSlash.png',
                 from: 'Projectiles/Boss/SupremeCatastropheSlash.cs',
                 w: 168, h: 240,  frames: 4,  fw: 168, fh: 60, fps: 16,
                 hitTerraria: { w: 100, h: 60 },
                 note: 'seen 2026-08-17: bar along the bottom, hooking up — the lower jaw' },
    catastropheSlashAlt: { src: IMG + 'calamity/SupremeCatastropheSlashAlt.png',
                 from: 'Projectiles/Boss/SupremeCatastropheSlashAlt.png',
                 w: 192, h: 232,  frames: 4,  fw: 192, fh: 58, fps: 16,
                 note: 'seen 2026-08-17: bar along the top, curving down — the upper jaw' },

    /* the spawn gate — the heart on the worm's body.
       NPCs/SupremeCalamitas/BrimstoneHeart.cs:22 — frameCount 6.
       The FILE IS 370px TALL, NOT 372. The previous manifest padded a
        370-row rip-site file to 372 on the theory that six frames must
       divide evenly; they do not, in the mod's own math. Terraria's
       core AI loop computes `frameHeight = texture.Height /
       npcFrameCount` with ORDINARY INTEGER DIVISION and calls
       `FindFrame(frameHeight)` — see BrimstoneHeart.cs:97 — so
       370 / 6 = 61 with 4 leftover pixels simply left undrawn at the
       bottom. That is normal Terraria sheet layout, not damage. The
       372px file and pad-sheet.mjs step are gone; this is the file
       exactly as the mod ships it. */
    heart:     { src: IMG + 'calamity/BrimstoneHeart.png',
                 from: 'NPCs/SupremeCalamitas/BrimstoneHeart.cs',
                 w: 44,  h: 370,  frames: 6,  fw: 44,  fh: 61, fps: 10 },
    /* the OTHER heart sprite — the one that actually rides the worm's
       body in the mod (BrimstoneHeart is the free-floating spawn-gate
       heart; this is SepulcherBodyEnergyBall, alternated with
       SepulcherBody along the segment chain). Previously copied to
       disk but absent from every manifest — the worm has never drawn
       its real body-heart art until now.
       NPCs/SupremeCalamitas/SepulcherBodyEnergyBall.cs:23 — frameCount 5. */
    sepulHeart: { src: IMG + 'calamity/SepulcherBodyEnergyBall.png',
                 from: 'NPCs/SupremeCalamitas/SepulcherBodyEnergyBall.cs',
                 w: 22, h: 120, frames: 5, fw: 22, fh: 24, fps: 8 },

    /* the Sepulcher — the worm she hides behind.
       NPCs/SupremeCalamitas/SepulcherHead.cs:45-48 — NPC.damage = 0,
       NPC.width = 62, NPC.height = 64 (the sprite file is 62x88; the
       hitbox is smaller than the art). `NPC.damage = 0` is not a
       simplification — the mod's own worm deals NO contact damage,
       full stop. sepMaxSpeed = 20 (line 202) is a lunge, not a drift.
       minLength = 51, maxLength = 52 (lines 22-23): the mod spawns
       50-51 body segments; here 6 stand in for readability at this
       screen size. All single-frame, no `.cs` frame count needed. */
    sepulcher: { src: IMG + 'calamity/SepulcherHead.png',
                 from: 'NPCs/SupremeCalamitas/SepulcherHead.cs',
                 w: 62,  h: 88,   frames: 1,  fw: 62,  fh: 88, fps: 0 },
    sepulBody: { src: IMG + 'calamity/SepulcherBody.png',
                 from: 'NPCs/SupremeCalamitas/SepulcherBody.png',
                 w: 82,  h: 72,   frames: 1,  fw: 82,  fh: 72, fps: 0 },
    sepulBodyAlt: { src: IMG + 'calamity/SepulcherBodyAlt.png',
                 from: 'NPCs/SupremeCalamitas/SepulcherBodyAlt.png',
                 w: 86,  h: 82,   frames: 1,  fw: 86,  fh: 82, fps: 0 },
    sepulTail: { src: IMG + 'calamity/SepulcherTail.png',
                 from: 'NPCs/SupremeCalamitas/SepulcherTail.cs',
                 w: 54,  h: 54,   frames: 1,  fw: 54,  fh: 54, fps: 0 },
    /* arms — the mod spawns these every 4 body segments (SepulcherArm.cs);
       present on disk since the original rip but wired into no
       manifest until now, so the worm has never had them. */
    sepulArm:     { src: IMG + 'calamity/SepulcherArm.png',
                 from: 'NPCs/SupremeCalamitas/SepulcherArm.png',
                 w: 20,  h: 62,   frames: 1,  fw: 20,  fh: 62, fps: 0 },
    sepulForearm: { src: IMG + 'calamity/SepulcherForearm.png',
                 from: 'NPCs/SupremeCalamitas/SepulcherForearm.png',
                 w: 18,  h: 60,   frames: 1,  fw: 18,  fh: 60, fps: 0 },
    sepulHand:    { src: IMG + 'calamity/SepulcherHand.png',
                 from: 'NPCs/SupremeCalamitas/SepulcherHand.png',
                 w: 34,  h: 48,   frames: 1,  fw: 34,  fh: 48, fps: 0 },

    /* a real SCal attack this fight does not implement yet (Phase 7).
       NPCs/SupremeCalamitas/SoulSeekerSupreme.cs:35 — frameCount 6. */
    soulSeeker:     { src: IMG + 'calamity/SoulSeekerSupreme.png',
                 from: 'NPCs/SupremeCalamitas/SoulSeekerSupreme.cs',
                 w: 96,  h: 780,  frames: 6,  fw: 96,  fh: 130, fps: 10 },
    soulSeekerGlow: { src: IMG + 'calamity/SoulSeekerSupremeGlow.png',
                 from: 'NPCs/SupremeCalamitas/SoulSeekerSupremeGlow.png',
                 w: 96,  h: 780,  frames: 6,  fw: 96,  fh: 130, fps: 10 },

    /* the drop */
    ashes:     { src: IMG + 'calamity/AshesofAnnihilation.png',
                 from: 'Items/Materials/AshesofAnnihilation.png',
                 w: 56,  h: 360,  frames: 6,  fw: 56,  fh: 60, fps: 8 },

    /* her shield (the boss is "shielded" behind it while invincible —
       the mod summons ForcefieldTexture + the top/bottom arcs around
       the charge telegraph, from SupremeCalamitas.cs) */
    scalShield: { src: IMG + 'calamity/ForcefieldTexture.png',
                 from: 'NPCs/SupremeCalamitas/ForcefieldTexture.png',
                 w: 72,  h: 72,   frames: 1,  fw: 72,  fh: 72,  fps: 0 },
    scalShieldTop: { src: IMG + 'calamity/SupremeShieldTop.png',
                 from: 'NPCs/SupremeCalamitas/SupremeShieldTop.png',
                 w: 76,  h: 86,   frames: 1,  fw: 76,  fh: 86,  fps: 0 },
    scalShieldBot: { src: IMG + 'calamity/SupremeShieldBottom.png',
                 from: 'NPCs/SupremeCalamitas/SupremeShieldBottom.png',
                 w: 50,  h: 42,   frames: 1,  fw: 50,  fh: 42,  fps: 0 },

    /* the rage / TP meters. UI/Rippers/RipperUI.cs:56-62 names these
       files directly. Rage is the mod's own Rage meter, used as-is.
       TP ("a TP feature similar to Deltarune") has no Calamity
       equivalent by that name — the nearest real analogue is the
       mod's Adrenaline meter (same build-a-bar-for-a-payoff shape),
       so the TP bar draws Adrenaline's real art rather than a
       renamed, unsourced placeholder. RipperUI.cs:25/27 — both
       animations are 10 frames (`RageAnimFrames`/`AdrenAnimFrames`). */
    rageBar:   { src: IMG + 'calamity/RageBar.png',
                 from: 'UI/Rippers/RageBar.png',
                 w: 80,  h: 36,   frames: 1, fw: 80,  fh: 36,  fps: 0 },
    rageBorder:{ src: IMG + 'calamity/RageBarBorder.png',
                 from: 'UI/Rippers/RageBarBorder.png',
                 w: 104, h: 36,   frames: 1, fw: 104, fh: 36,  fps: 0 },
    rageAnim:  { src: IMG + 'calamity/RageFullAnimation.png',
                 from: 'UI/Rippers/RageFullAnimation.png',
                 w: 152, h: 380,  frames: 10, fw: 152, fh: 38,  fps: 10 },
    tpBar:     { src: IMG + 'calamity/AdrenalineBar.png',
                 from: 'UI/Rippers/AdrenalineBar.png',
                 w: 80,  h: 36,   frames: 1, fw: 80,  fh: 36,  fps: 0 },
    tpBorder:  { src: IMG + 'calamity/AdrenalineBarBorder.png',
                 from: 'UI/Rippers/AdrenalineBarBorder.png',
                 w: 104, h: 480,  frames: 10, fw: 104, fh: 48,  fps: 10 },
    tpAnim:    { src: IMG + 'calamity/AdrenalineFullAnimation.png',
                 from: 'UI/Rippers/AdrenalineFullAnimation.png',
                 w: 172, h: 700,  frames: 10, fw: 172, fh: 70,  fps: 10 },

    /* ── Polterghast ─────────────────────────────────────────────
       Three files, identical geometry: body, glowmask, second
       glowmask. Drawn stacked — body normal, glows additive — which
       is how the phase changes read without any new art.
       NPCs/Polterghast/Polterghast.cs — frames unchanged by the
       re-source (file bytes refreshed from source, geometry already
       correct). */
    polter:    { src: IMG + 'calamity/Polterghast.png',
                 from: 'NPCs/Polterghast/Polterghast.cs',
                 w: 90, h: 1800, frames: 12, fw: 90, fh: 150, fps: 10 },
    polterG1:  { src: IMG + 'calamity/PolterghastGlow.png',
                 from: 'NPCs/Polterghast/PolterghastGlow.png',
                 w: 90, h: 1800, frames: 12, fw: 90, fh: 150, fps: 10 },
    polterG2:  { src: IMG + 'calamity/PolterghastGlow2.png',
                 from: 'NPCs/Polterghast/PolterghastGlow2.png',
                 w: 90, h: 1800, frames: 12, fw: 90, fh: 150, fps: 10 },
    hook:      { src: IMG + 'calamity/PolterghastHook.png',
                 from: 'NPCs/Polterghast/PolterghastHook.cs',
                 w: 44, h: 88,   frames: 2,  fw: 44, fh: 44,  fps: 8 },
    chain:     { src: IMG + 'calamity/PolterghastChain.png',
                 from: 'NPCs/Polterghast/PolterghastChain.png',
                 w: 20, h: 26,   frames: 1,  fw: 20, fh: 26,  fps: 0 },

    /* his projectiles — all single-frame, rotated in code.
       Projectiles/Boss/*.cs — none of these set Main.projFrames, so
       Terraria defaults each to a single frame. */
    pShot:     { src: IMG + 'calamity/PhantomHookShot.png',
                 from: 'Projectiles/Boss/PhantomHookShot.cs',
                 w: 14, h: 28, frames: 1, fw: 14, fh: 28, fps: 0 },
    pBlast:    { src: IMG + 'calamity/PhantomBlast.png',
                 from: 'Projectiles/Boss/PhantomBlast.cs',
                 w: 18, h: 24, frames: 1, fw: 18, fh: 24, fps: 0 },
    pShotHi:   { src: IMG + 'calamity/PhantomGhostShot.png',
                 from: 'Projectiles/Boss/PhantomGhostShot.cs',
                 w: 14, h: 28, frames: 1, fw: 14, fh: 28, fps: 0 },
    /* alias — boss-polt asks for the potent shot by this name */
    potentShot:{ src: IMG + 'calamity/PhantomGhostShot.png',
                 from: 'Projectiles/Boss/PhantomGhostShot.cs',
                 w: 14, h: 28, frames: 1, fw: 14, fh: 28, fps: 0 },
    pBlastHi:  { src: IMG + 'calamity/PhantomBlast2.png',
                 from: 'Projectiles/Boss/PhantomBlast2.cs',
                 w: 18, h: 24, frames: 1, fw: 18, fh: 24, fps: 0 },
    pOrb:      { src: IMG + 'calamity/PhantomMine.png',
                 from: 'Projectiles/Boss/PhantomMine.cs',
                 w: 30, h: 30, frames: 1, fw: 30, fh: 30, fps: 0 },

    /* ── items ───────────────────────────────────────────────────
       Not yet re-sourced — see js/data/sheets.js history / the bug
       plan's Phase 0d. This machine has no local Terraria, Undertale
       or Deltarune install and no UndertaleModTool/TExtract to run
       against one, so these four plus the Undertale/Deltarune set
       below are UNCHANGED rip-site files pending a session with
       access to the actual game data. Left in place rather than
       deleted, since deleting them with nothing to replace them
       would just trade a wrong-provenance sprite for a missing one. */
    recall:    { src: IMG + 'terraria/recall-potion.png', w: 16, h: 16, frames: 1, fw: 16, fh: 16, fps: 0 },
    axe:       { src: IMG + 'terraria/axe.png',           w: 34, h: 30, frames: 1, fw: 34, fh: 30, fps: 0 },
    mushroom:  { src: IMG + 'terraria/mushroom.png',      w: 22, h: 24, frames: 1, fw: 22, fh: 24, fps: 0 },
    slot:      { src: IMG + 'terraria/slot.png',          w: 52, h: 52, frames: 1, fw: 52, fh: 52, fps: 0 },

    /* ── characters and set dressing — same caveat as above ──────*/
    tenna:     { src: IMG + 'deltarune/tenna-idle.png',  w: 70, h: 92,  frames: 1, fw: 70, fh: 92,  fps: 0 },
    tennaPt:   { src: IMG + 'deltarune/tenna-point.png', w: 90, h: 120, frames: 1, fw: 90, fh: 120, fps: 0 },
    firedoor:  { src: IMG + 'undertale/firedoor.png',    w: 55, h: 70,  frames: 1, fw: 55, fh: 70,  fps: 0 },
    armchair:  { src: IMG + 'undertale/armchair.png',    w: 45, h: 83,  frames: 1, fw: 45, fh: 83,  fps: 0 },
    corridor:  { src: IMG + 'undertale/newhome-corridor.png', w: 743, h: 76, frames: 1, fw: 743, fh: 76, fps: 0 }
  };

  /* ── ONE blitter, and one image cache ──────────────────────────────
     This lives here rather than in engine.js because the manifest is
     what defines the contract, and because three modules need it
     against three different canvases: engine.js for entities,
     boss-scal.js and boss-polt.js for their own fights.

     It replaces four copies of the same frame formula and three copies
     of the same `img()` cache — and the copies are why `cols` did not
     exist: every one of them hardcoded a source x of 0, so a sheet with
     two columns had no way to say so and Calamitas drew both of her
     pose sets on top of each other.

     `o` accepts: frame (else the fps clock), col, scale, rot, glow,
     anchor ('feet' | 'centre'), alpha. Returns false when the image is
     not ready, so callers keep their own fallback. */
  var imgs = {};
  NEU.sheetImg = function (src) {
    if (imgs[src]) return imgs[src];
    var i = new Image();
    i.onerror = function () { i.__failed = true; };
    i.src = src;
    imgs[src] = i;
    return i;
  };

  NEU.sheetReady = function (sh) {
    if (!sh) return null;
    var im = NEU.sheetImg(sh.src);
    return (im.complete && im.naturalWidth && !im.__failed) ? im : null;
  };

  NEU.sheetDraw = function (ctx, key, x, y, o) {
    o = o || {};
    var sh = NEU.sheets[key];
    var im = NEU.sheetReady(sh);
    if (!im) return false;
    var n = sh.frames || 1;
    var fr = (o.frame === undefined || o.frame === null)
      ? (sh.fps ? ((((o.now === undefined ? Date.now() : o.now) / (1000 / sh.fps)) | 0) % n) : 0)
      : (((o.frame % n) + n) % n);
    /* cols is the whole point: source x moves across the sheet instead
       of being pinned at 0 */
    var cols = sh.cols || 1;
    var col = ((o.col || 0) % cols + cols) % cols;
    var sxi = col * sh.fw, syi = fr * sh.fh;
    var sc = o.scale || 1;
    var dw = sh.fw * sc, dh = sh.fh * sc;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    var dx = (-dw / 2) | 0;
    var dy = (o.anchor === 'feet' ? -dh : -dh / 2) | 0;
    ctx.drawImage(im, sxi, syi, sh.fw, sh.fh, dx, dy, dw | 0, dh | 0);
    if (o.glow) {
      /* the same art added over itself — what phase 2 is, and what the
         game does too */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * 0.5;
      ctx.drawImage(im, sxi, syi, sh.fw, sh.fh, dx, dy, dw | 0, dh | 0);
    }
    /* Separate glowmask FILES stacked additively on the same frame —
       Polterghast escalates by adding one per phase, which is how the
       fight shows a phase change without any new art. */
    if (o.glowKeys) {
      ctx.globalCompositeOperation = 'lighter';
      for (var g = 0; g < o.glowKeys.length; g++) {
        var gs = NEU.sheets[o.glowKeys[g]], gi = NEU.sheetReady(gs);
        if (!gi) continue;
        ctx.globalAlpha = 0.55;
        ctx.drawImage(gi, ((o.col || 0) % (gs.cols || 1)) * gs.fw,
                      (fr % (gs.frames || 1)) * gs.fh, gs.fw, gs.fh,
                      dx, dy, dw | 0, dh | 0);
      }
    }
    ctx.restore();
    return true;
  };

  /* Terraria-px -> site-px hitbox conversion. The site's arena is 700
     wide against the mod's much larger world, and the one fixed point
     of reference already in this file is the 224 Terraria px == 150
     site px proximity trigger on the fireblast/gigablast burst (both
     confirmed directly in SCalBrimstoneFireblast.cs /
     SCalBrimstoneGigablast.cs). 150 / 224 = 0.6696. B6 (fair hitboxes)
     reads `hitTerraria` off a manifest entry through this rather than
     re-deriving a ratio per entity. */
  NEU.TERRARIA_PX = 150 / 224;
  NEU.hitRadius = function (key, inset) {
    var sh = NEU.sheets[key];
    if (!sh || !sh.hitTerraria) return null;
    var w = sh.hitTerraria.w * NEU.TERRARIA_PX, h = sh.hitTerraria.h * NEU.TERRARIA_PX;
    return Math.min(w, h) / 2 * (inset === undefined ? 1 : inset);
  };

  /* SOURCE-ONLY. Big atlases that crops come out of. They must NEVER
     be referenced at runtime and must NEVER be deployed — the Tenna
     sheet alone is 1.6 MB, four times the weight of the entire rest
     of the site. Listed here so the build check can assert they are
     absent from the deploy.

     STILL RIP-SITE SOURCED (see the "items"/"characters" comment
     above) — unlike the Calamity set, these have no code-paired
     source available from this machine. */
  NEU.sheetSources = [
    'deltarune/sr-Tenna-273063.png',
    'deltarune/sr-Board_Games-274913.png',
    'deltarune/sr-Card_Castle-110766.png',
    'deltarune/sr-Purple_Cliffs-273345.png',
    'deltarune/sr-Scarlet_Forest-110841.png',
    'deltarune/sr-Tree_Tiles-111897.png',
    'deltarune/sr-Great_Board-110849.png',
    'deltarune/sr-Mancountry-273193.png',
    'undertale/sr-Undertale-Home_and_New_Home-76337.png',
    'undertale/sr-Undertale-Papyrus_and_Sans_House-77169.png',
    'terraria/sr-Terraria-Inventory_Back.png',
    'terraria/sr-Terraria-Item_10-IronAxe.png',
    'terraria/sr-Terraria-Item_5-Mushroom.png',
    'terraria/sr-Terraria-Item_662-RecallPotion.png'
  ];
})();
