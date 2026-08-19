/* sheets.js — the sprite manifest for Act IV.
   ───────────────────────────────────────────────────────────────────
   Terraria and Calamity ship NPC and projectile art as a single PNG
   with the frames stacked VERTICALLY, one column, a couple of pixels
   of transparent gutter between cells. Nothing in the file says how
   many cells there are — that number lives in the mod's C#
   (`Main.npcFrameCount[type]`) and does not travel with the image.

   So it lives here instead, measured rather than assumed.

   HOW THESE WERE DERIVED
   Alpha-thresholded row scan (alpha > 12, because faint antialiasing
   in the gutters was welding adjacent cells together), then the frame
   height is the smallest divisor of the sheet height that fully
   contains every block of content. That is exact when the gutters are
   clean and ambiguous when a sprite bleeds into its neighbour's cell,
   which is why some entries below are marked provisional.

   PROVISIONAL entries are best-fit, not guesses: each is the only
   divisor of the sheet height that is both >= the tallest content
   block and consistent with the sibling sheets from the same weapon.
   Confirm them in one look with the dev sprite inspector (`sheet
   <name>` in the dev console), which overlays the cell grid on the
   image. Fixing a wrong number is a one-line edit here — no other
   file knows these dimensions.                                      */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var IMG = 'img/act4/';

  /* fw/fh are the CELL size, not the drawn sprite — cells are padded.
     `fps` is the animation rate the game plays them at; 0 means the
     frame is chosen by state (a phase, a direction) rather than by a
     clock. */
  NEU.sheets = {

    /* ── Supreme Witch, Calamitas ────────────────────────────────
       ONE sheet for both phases. The wiki shows four images but they
       are crops of two files — the phase-2 look is the same body with
       an additive glow, not different art. So phase 2 is drawn as
       this sheet plus a second pass in 'lighter' composite, which is
       also how the game does it. */
    /* TWO COLUMNS, not one. Both of these sheets are 120 wide and hold
       two 60px-wide pose sets side by side — measured, by decoding the
       PNG and counting opaque columns inside one cell: there is a figure
       at x 12-53 and a second at x 72-115 with 24 transparent columns
       between them, in all 21 rows, and the two halves differ from each
       other in every row. `fw` was 120, so the blitter drew BOTH poses
       at once and she rendered as a double exposure of two overlapping
       women — which is what "Calamitas has no sprite" actually looked
       like on screen. `cols` makes the second half addressable instead
       of accidental; `frames` stays the row count. */
    scal:      { src: IMG + 'calamity/SupremeCalamitas.png',
                 w: 120, h: 1260, frames: 21, cols: 2, fw: 60, fh: 60, fps: 12,
                 note: 'measured: 21 rows x 2 columns of 60x60' },
    scalHood:  { src: IMG + 'calamity/SupremeCalamitasHooded.png',
                 w: 120, h: 1302, frames: 21, cols: 2, fw: 60, fh: 62, fps: 12,
                 note: 'measured: 21 rows x 2 columns of 60x62. the hooded intro' },

    /* her projectiles */
    dart:      { src: IMG + 'calamity/BrimstoneBarrage.png',
                 w: 18,  h: 176,  frames: 4,  fw: 18,  fh: 44, fps: 14, confirmed: true },
    hellblast: { src: IMG + 'calamity/BrimstoneHellblast2.png',
                 w: 54,  h: 176,  frames: 4,  fw: 54,  fh: 44, fps: 14, confirmed: true },
    fireblast: { src: IMG + 'calamity/SCalBrimstoneFireblast.png',
                 w: 36,  h: 250,  frames: 5,  fw: 36,  fh: 50, fps: 12, confirmed: true,
                 note: 'measured 2026-08-17: period 50px, r 0.89' },
    gigablast: { src: IMG + 'calamity/SCalBrimstoneGigablast.png',
                 w: 52,  h: 492,  frames: 6,  fw: 52,  fh: 82, fps: 12, confirmed: true,
                 note: 'measured 2026-08-17: period 82px, r 0.89' },

    /* the brothers */
    fist:      { src: IMG + 'calamity/SupremeCataclysmFist.png',
                 w: 126, h: 224,  frames: 4,  fw: 126, fh: 56, fps: 16, confirmed: true },
    fistAlt:   { src: IMG + 'calamity/SupremeCataclysmFistAlt.png',
                 w: 126, h: 224,  frames: 4,  fw: 126, fh: 56, fps: 16, confirmed: true },
    /* Which of these is "top" and which is "bottom" is an assumption
       carried over from the download report — in the mod the Alt is
       used when ai[1] == 0. Verify visually before shipping; if they
       are swapped, swap the two src strings and nothing else.

       MEASURED 2026-08-17, and it leans toward swapped without proving
       it: in frame 0 the sheet currently called slashTop carries its
       centre of mass 67% of the way DOWN its cell, and slashBot
       carries it 45% down — so the one named "top" is the low one.
       Both frame counts are confirmed (4 each, 60px and 58px cells).

       NOT ACTED ON. Centre of mass says where ink sits inside a cell,
       not which arc the mod draws above the other, and 45% is nearly
       centred rather than clearly high. The real answer is `ai[1] == 0`
       in the mod's C# and it does not travel with the PNG. One look at
       `sheet slashTop` in the dev inspector settles it.

       ── RESOLVED 2026-08-17. THEY WERE SWAPPED, AND NOW THEY ARE NOT.

       Rendered at 4x onto a checkerboard with the cell rules drawn
       across them (`_scripts/contact-sheet.mjs`) the shapes are
       unmistakable, and they agree with the centre-of-mass reading
       above: `SupremeCatastropheSlash.png` is a bar along the BOTTOM of
       its cell hooking upward at the right — the lower jaw of the
       pincer — and `...SlashAlt.png` is a bar along the TOP curving
       down, the upper jaw. The names had them the wrong way round.

       THE FIX WAS NOT "swap the two src strings and nothing else",
       which is what the note above told the next person to do. The two
       files are different sizes — 168x240 against 192x232 — so
       `w/h/fw/fh` describe the FILE, not the role, and had to move with
       the `src`. Swapping only the strings would have left each entry
       claiming the other one's geometry and sliced both arcs off-grid.

       TO REVERT: swap these two `src` values AND their four geometry
       numbers back, together. */
    slashTop:  { src: IMG + 'calamity/SupremeCatastropheSlashAlt.png',
                 w: 192, h: 232,  frames: 4,  fw: 192, fh: 58, fps: 16, confirmed: true,
                 note: 'seen 2026-08-17: bar along the top, curving down. was mislabelled slashBot' },
    slashBot:  { src: IMG + 'calamity/SupremeCatastropheSlash.png',
                 w: 168, h: 240,  frames: 4,  fw: 168, fh: 60, fps: 16, confirmed: true,
                 note: 'seen 2026-08-17: bar along the bottom, hooking up. was mislabelled slashTop' },

    /* the spawn gate */
    /* BOTH SETTLED 2026-08-17, by rendering the sheets at 5x onto a
       checkerboard with the candidate cell rules drawn across them
       (`_scripts/contact-sheet.mjs`) and looking at the result. The
       statistics could not separate these two; one glance could.

       sepulcher was NOT two frames. It is a single beetle-like head —
         horns, mandibles, three eyes — and the 44px rule cuts it
         through the face, between the horns and the eyes. One frame.

       heart was NOT five. There are six heartbeat frames and the 62px
         grid puts every rule cleanly in the gap between two of them,
         while the 74px grid the manifest used cut through frames
         three, four and five. The file was 370 rows, two short of
         6 x 62 = 372, so it had been trimmed of its trailing
         transparent rows by whatever scraped it. `pad-sheet.mjs` put
         them back; the original is kept at
         `_scripts/orig/BrimstoneHeart.png.orig`. */
    sepulcher: { src: IMG + 'calamity/SepulcherHead.png',
                 w: 62,  h: 88,   frames: 1,  fw: 62,  fh: 88, fps: 0,  confirmed: true,
                 note: 'seen 2026-08-17: one head, not two frames. fps 0 — nothing to animate' },
    /* the worm's body and tail. Single frames each, measured directly
       2026-08-18: Body 82x72, BodyAlt 86x82, Tail 54x54. The fight used
       to draw the head alone because these were never registered. */
    sepulBody: { src: IMG + 'calamity/SepulcherBody.png',
                 w: 82,  h: 72,   frames: 1,  fw: 82,  fh: 72, fps: 0,  confirmed: true },
    sepulBodyAlt: { src: IMG + 'calamity/SepulcherBodyAlt.png',
                 w: 86,  h: 82,   frames: 1,  fw: 86,  fh: 82, fps: 0,  confirmed: true },
    sepulTail: { src: IMG + 'calamity/SepulcherTail.png',
                 w: 54,  h: 54,   frames: 1,  fw: 54,  fh: 54, fps: 0,  confirmed: true },
    heart:     { src: IMG + 'calamity/BrimstoneHeart.png',
                 w: 44,  h: 372,  frames: 6,  fw: 44,  fh: 62, fps: 10, confirmed: true,
                 note: 'seen 2026-08-17: six beats, 62px grid. sheet re-padded 370 -> 372' },

    /* the drop */
    ashes:     { src: IMG + 'calamity/AshesofAnnihilation.png',
                 w: 56,  h: 360,  frames: 6,  fw: 56,  fh: 60, fps: 8,  confirmed: true },

    /* ── Polterghast ─────────────────────────────────────────────
       Three files, identical geometry: body, glowmask, second
       glowmask. Drawn stacked — body normal, glows additive — which
       is how the phase changes read without any new art. */
    polter:    { src: IMG + 'calamity/Polterghast.png',
                 w: 90, h: 1800, frames: 12, fw: 90, fh: 150, fps: 10, confirmed: true },
    polterG1:  { src: IMG + 'calamity/PolterghastGlow.png',
                 w: 90, h: 1800, frames: 12, fw: 90, fh: 150, fps: 10, confirmed: true },
    polterG2:  { src: IMG + 'calamity/PolterghastGlow2.png',
                 w: 90, h: 1800, frames: 12, fw: 90, fh: 150, fps: 10, confirmed: true },
    hook:      { src: IMG + 'calamity/PolterghastHook.png',
                 w: 44, h: 88,   frames: 2,  fw: 44, fh: 44,  fps: 8,  confirmed: true,
                 note: 'measured 2026-08-17: period 44px, r 0.88' },
    chain:     { src: IMG + 'calamity/PolterghastChain.png',
                 w: 20, h: 26,   frames: 1,  fw: 20, fh: 26,  fps: 0,  confirmed: true },

    /* his projectiles — all single-frame, rotated in code */
    pShot:     { src: IMG + 'calamity/PhantomHookShot.png', w: 14, h: 28, frames: 1, fw: 14, fh: 28, fps: 0 },
    pBlast:    { src: IMG + 'calamity/PhantomBlast.png',    w: 18, h: 24, frames: 1, fw: 18, fh: 24, fps: 0 },
    pShotHi:   { src: IMG + 'calamity/PhantomGhostShot.png',w: 14, h: 28, frames: 1, fw: 14, fh: 28, fps: 0 },
    /* alias — boss-polt asks for the potent shot by this name */
    potentShot:{ src: IMG + 'calamity/PhantomGhostShot.png',w: 14, h: 28, frames: 1, fw: 14, fh: 28, fps: 0 },
    pBlastHi:  { src: IMG + 'calamity/PhantomBlast2.png',   w: 18, h: 24, frames: 1, fw: 18, fh: 24, fps: 0 },
    pOrb:      { src: IMG + 'calamity/PhantomMine.png',     w: 30, h: 30, frames: 1, fw: 30, fh: 30, fps: 0 },

    /* ── items ───────────────────────────────────────────────────*/
    recall:    { src: IMG + 'terraria/recall-potion.png', w: 16, h: 16, frames: 1, fw: 16, fh: 16, fps: 0 },
    axe:       { src: IMG + 'terraria/axe.png',           w: 34, h: 30, frames: 1, fw: 34, fh: 30, fps: 0 },
    mushroom:  { src: IMG + 'terraria/mushroom.png',      w: 22, h: 24, frames: 1, fw: 22, fh: 24, fps: 0 },
    slot:      { src: IMG + 'terraria/slot.png',          w: 52, h: 52, frames: 1, fw: 52, fh: 52, fps: 0 },

    /* ── characters and set dressing ─────────────────────────────*/
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

  /* SOURCE-ONLY. Big atlases that crops come out of. They must NEVER
     be referenced at runtime and must NEVER be deployed — the Tenna
     sheet alone is 1.6 MB, four times the weight of the entire rest
     of the site. Listed here so the build check can assert they are
     absent from the deploy. */
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
