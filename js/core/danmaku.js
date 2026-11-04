/* danmaku.js — shared bullet-hell layer.
   ───────────────────────────────────────────────────────────────────
   Extracted from bullet.js, boss-scal.js and boss-polt.js.
   One implementation of the soul, i-frames, death shatter, arena math,
   and bullet movement/collision.                                    */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var HEART = [
    '.##.##.',
    '#######',
    '#######',
    '#######',
    '.#####.',
    '..###..',
    '...#...'
  ];

  var COL_SOUL = '#E23B55';
  var COL_BONE = '#EDE7DE';
  var COL_VOID = '#08080B';

  function stamp(ctx, rows, cx, cy, s, on, off) {
    var h = rows.length, w = rows[0].length;
    var x0 = (cx - w * s / 2) | 0, y0 = (cy - h * s / 2) | 0;
    /* One colour for the whole sprite unless an off colour can change a
       cell. Same pixels as before, with fewer fillStyle writes. */
    if (!off) ctx.fillStyle = on;
    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) {
        var ch = rows[r][c];
        if (ch === '.') continue;
        if (off) ctx.fillStyle = ch === 'o' ? off : on;
        ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
      }
    }
  }

  function drawSoul(ctx, x, y, inv, col) {
    if (NEU.juice && NEU.juice.noFlash) {
      if (inv > 0) {
        ctx.globalAlpha = 0.45;
        stamp(ctx, HEART, x, y, 2, col || COL_SOUL);
        ctx.globalAlpha = 1;
        return;
      }
    }
    if (inv > 0 && ((inv * 14) | 0) % 2 !== 0) return;
    stamp(ctx, HEART, x, y, 2, col || COL_SOUL);
  }

  /* The touch pad is a fixed strip along the bottom of the window on a
     phone (touch.js builds it, style.css sizes it). It sits over whatever
     is under it, so an arena centred in the whole window lost its bottom
     edge to the pad. This measures the pad the way engine.js measurePad()
     does, so the arena and the play area agree on where it is. A hidden
     pad (every desktop, and a touch device with no pad showing) measures
     zero, and the arena stays exactly where it was. */
  function padHeight() {
    var el = document.querySelector && document.querySelector('.tpad');
    if (!el || el.hidden) return 0;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    } catch (e) {}
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (!r || !r.height) return 0;
    var vh = window.innerHeight || 600;
    return Math.max(0, Math.min(r.height, vh - r.top, vh * 0.45));
  }

  function arena(w, h, maxW, maxH, padY) {
    var winW = w || window.innerWidth || 800;
    var winH = h || window.innerHeight || 600;
    /* Fit above the pad, so the centre is the centre of the space the
       player can actually see. Only when that still leaves a fightable
       arena: a phone held sideways is too short for the pad AND the
       190px of HUD, and squeezing it gave a 52px arena (W7's caveat), so
       there the arena keeps its old size and the pad sits over its
       bottom corners, as it did before. */
    var full = Math.min(maxH || 520, winH - 190);
    var ph = padHeight();
    var above = Math.min(maxH || 520, winH - ph - 190);
    var hasPad = ph > 0 && above >= full * 0.6;
    if (hasPad) winH -= ph;
    var AW = Math.min(maxW || 760, winW - 48);
    var AH = Math.min(maxH || 520, winH - 190);
    var AX = ((winW - AW) / 2) | 0;
    var AY = ((winH - AH) / 2 + (padY !== undefined ? padY : 22)) | 0;
    /* SCal prints her dialogue line 96px under the arena (boss-scal dialY,
       16px type), so on a padded phone the arena shifts up to keep the
       line clear of the pad's TP button instead of sliding under it. */
    if (hasPad)
      AY = Math.max(36, Math.min(AY, winH - AH - 96));
    return { AX: AX, AY: AY, AW: AW, AH: AH };
  }

  function shot(list, x, y, vx, vy, r, colour, kind, maxCap) {
    if (list.length >= (maxCap || 900)) return null;
    var b = {
      x: x, y: y,
      vx: vx, vy: vy,
      r: r || 4,
      c: colour || COL_BONE,
      k: kind || 0,
      age: 0
    };
    list.push(b);
    return b;
  }

  function step(list, dt, bounds) {
    var keep = [];
    var minX = bounds ? bounds.AX - 60 : -60;
    var maxX = bounds ? bounds.AX + bounds.AW + 60 : 10000;
    var minY = bounds ? bounds.AY - 60 : -60;
    var maxY = bounds ? bounds.AY + bounds.AH + 60 : 10000;

    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      b.age = (b.age || 0) + dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < minX || b.x > maxX || b.y < minY || b.y > maxY) continue;
      keep.push(b);
    }
    return keep;
  }

  function hits(list, px, py, r) {
    var pr = r || 3.2;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var dx = b.x - px;
      var dy = b.y - py;
      var rr = b.r + pr;
      if (dx * dx + dy * dy < rr * rr) return b;
    }
    return null;
  }

  var cachedShards = null;
  var cachedShardsPos = { x: 0, y: 0 };

  function getShards(px, py) {
    if (cachedShards && cachedShardsPos.x === px && cachedShardsPos.y === py) {
      return cachedShards;
    }
    var list = [];
    for (var r = 0; r < 7; r++) {
      for (var c = 0; c < 7; c++) {
        if (HEART[r][c] !== '#') continue;
        var ox = (c - 3) * 2;
        var oy = (r - 3) * 2;
        list.push({
          x: px + ox,
          y: py + oy,
          vx: ox * 15 + (Math.random() - 0.5) * 70,
          vy: oy * 10 - 155 - Math.random() * 90
        });
      }
    }
    cachedShards = list;
    cachedShardsPos = { x: px, y: py };
    return list;
  }

  function death(ctx, px, py, sinceMs, col) {
    /* A death that was interrupted never reaches 1700ms, so the reset
       below never runs, and its shards stay cached on the same (px, py).
       The next death at those coordinates replayed that exact burst.
       Shards are only built after the 420ms held heart, so any frame
       still inside that window belongs to a new death: drop the old
       cache before it can be used. */
    if (sinceMs < 420) cachedShards = null;

    if (sinceMs > 1700) {
      cachedShards = null;
      return false;
    }

    var soulCol = col || COL_SOUL;

    if (sinceMs < 420) {
      // Held cracked heart
      stamp(ctx, HEART, px, py, 2, soulCol);
      ctx.fillStyle = COL_VOID;
      ctx.fillRect((px - 1) | 0, (py - 8) | 0, 2, 16);
      if (((sinceMs / 55) | 0) % 2 === 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect((px - 1) | 0, (py - 8) | 0, 2, 6);
      }
      return true;
    }

    var k = (sinceMs - 420) / 1000;
    var shards = getShards(px, py);
    ctx.fillStyle = soulCol;
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      ctx.globalAlpha = Math.max(0, 1 - k / 1.15);
      ctx.fillRect((s.x + s.vx * k) | 0, (s.y + s.vy * k + 900 * k * k) | 0, 2, 2);
    }
    ctx.globalAlpha = 1;
    return true;
  }

  function resetDeath() {
    cachedShards = null;
  }

  /* ── the shared fight feel ───────────────────────────────────────
     Terraria/Calamity movement and resources on top of the Undertale
     soul, one copy for every boss. A fight owns one plain state object
     (fight()) and hands it to move/tick/key every frame; the boss keeps
     its own damage model and only asks mul() how hard a strike lands.
     A dash is 0.12 s of travel, 0.18 s of i-frames, a 0.5 s cooldown.
     Adrenaline fills over 20 s untouched and burns for 5 s. Rage fills
     by standing near the boss and burns for 8 s. */
  var DASH_T = 0.12, DASH_I = 0.18, DASH_CD = 0.5, DASH_V = 640;
  var ADREN_FILL = 20, ADREN_ON = 5, ADREN_SLOW = 1.2, RAGE_FILL = 10, RAGE_ON = 8;
  var GRAV = 900, JUMP = 330, EDGE = 7;
  var COL_BLUE = '#3C6BFF', COL_ADREN = '#5CF08C', COL_RAGE = '#FF4A2A';
  var POP_MAX = 12, POP_LIFE = 0.7;
  var FONT = '16px "Determination Mono","Pixelify Sans",monospace';

  /* o.dashCd: this fight's dash cooldown (default DASH_CD). swings and
     grazes are the view's event lists: melee arcs and graze points. */
  function fight(x, y, o) {
    return { x: x, y: y, vy: 0, mode: 'red', modeT: 0, ground: false, focus: false,
             fx: 0, fy: -1, dvx: 0, dvy: 0, dashT: 0, dashI: 0, dashCd: 0,
             dashCdMax: (o && o.dashCd) || DASH_CD,
             trail: [], tapK: '', tapAt: -9, clock: 0,
             adren: 0, adrenT: 0, rage: 0, rageT: 0, rageFull: 0,
             swings: [], grazes: [], grazeFlashT: 0,
             pops: [], chip: 1, hitAt: -9, hudAt: 0, flashT: 0, flashAt: -9, live: '' };
  }

  function soulMode(F, m) {
    if (F.mode === m) return;
    F.mode = m; F.modeT = 0.3; F.vy = 0; F.ground = false;
  }

  function dash(F, ix, iy) {
    if (F.dashCd > 0) return false;
    if (ix === undefined) { ix = F.fx; iy = F.fy; }
    if (F.mode === 'blue') { iy = 0; ix = ix || F.fx || 1; }
    var l = Math.sqrt(ix * ix + iy * iy) || 1;
    F.dvx = ix / l * DASH_V; F.dvy = iy / l * DASH_V;
    F.dashT = DASH_T; F.dashI = DASH_I; F.dashCd = F.dashCdMax || DASH_CD;
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    return true;
  }

  /* Double-tap a direction to dash (Terraria's Shield of Cthulhu). Off now:
     TAP is 0 and the dash is X only. Kept so an old caller cannot break. */
  function tap(F, k) {
    var dbl = F.tapK === k && F.clock - F.tapAt < NEU.danmaku.TAP;
    F.tapK = dbl ? '' : k; F.tapAt = F.clock;
    if (!dbl || (F.mode === 'blue' && (k === 'up' || k === 'down'))) return false;
    return dash(F, k === 'right' ? 1 : k === 'left' ? -1 : 0, k === 'down' ? 1 : k === 'up' ? -1 : 0);
  }

  /* Red: free 8-way. Blue: gravity, up (or keys.jump) jumps, letting go
     early cuts the jump, and it lands on the box floor or on any
     { x, y, w } platform a pattern passes in. */
  function move(F, keys, dt, b, plats) {
    var ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (ix || iy) { F.fx = ix; F.fy = iy; }
    if (F.dashCd > 0) F.dashCd -= dt;
    if (F.dashI > 0) F.dashI -= dt;
    if (F.modeT > 0) F.modeT -= dt;
    /* Shift held: the soul's slow, precise speed. The dash has its own. */
    var y0 = F.y, sp = keys.focus ? NEU.danmaku.FOCUS : NEU.danmaku.SPEED;
    F.focus = !!keys.focus;
    var up = keys.up || keys.jump;
    if (F.dashT > 0) {
      F.dashT -= dt;
      F.x += F.dvx * dt; F.y += F.dvy * dt;
      F.trail.push({ x: F.x, y: F.y });
      if (F.trail.length > 6) F.trail.shift();
    } else {
      if (F.trail.length) F.trail.shift();
      if (F.mode === 'blue') {
        F.x += ix * sp * dt;
        if (up && F.ground) { F.vy = -JUMP; F.ground = false; }
        if (!up && F.vy < -JUMP * 0.4) F.vy = -JUMP * 0.4;
        F.vy += GRAV * dt; F.y += F.vy * dt;
      } else {
        if (ix && iy) { ix *= 0.7071; iy *= 0.7071; }
        F.x += ix * sp * dt; F.y += iy * sp * dt;
      }
    }
    F.x = Math.min(Math.max(F.x, b.AX + EDGE), b.AX + b.AW - EDGE);
    var floor = b.AY + b.AH - EDGE;
    F.y = Math.min(Math.max(F.y, b.AY + EDGE), floor);
    if (F.mode !== 'blue') return;
    F.ground = false;
    if (F.y >= floor && F.vy >= 0) { F.y = floor; F.vy = 0; F.ground = true; return; }
    for (var i = 0; plats && i < plats.length; i++) {
      var p = plats[i], top = p.y - EDGE;
      if (F.vy >= 0 && y0 <= top && F.y >= top && F.x >= p.x && F.x <= p.x + p.w) {
        F.y = top; F.vy = 0; F.ground = true; return;
      }
    }
  }

  function adrenaline(F) {
    if (F.adren < 1 || F.adrenT > 0) return false;
    F.adren = 0; F.adrenT = ADREN_ON;
    if (NEU.juice) NEU.juice.burst(F.x, F.y, 16, COL_ADREN, 1.2);
    return true;
  }
  function rage(F) {
    if (F.rage < 1 || F.rageT > 0) return false;
    F.rage = 0; F.rageT = RAGE_ON; F.rageFull = 0;
    if (NEU.juice) NEU.juice.burst(F.x, F.y, 14, COL_RAGE, 1.2);
    return true;
  }

  function keyName(e) {
    var k = e.key;
    if (k === 'ArrowLeft'  || k === 'a' || k === 'A') return 'left';
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
    if (k === 'ArrowUp'    || k === 'w' || k === 'W') return 'up';
    if (k === 'ArrowDown'  || k === 's' || k === 'S') return 'down';
    if (k === 'Shift') return 'focus';
    return null;
  }
  /* The soul's keys: X dashes, and only X. An arrow is for moving, so a
     double-tap no longer dashes. Shift is a held key, read through keyName
     as 'focus'. Returns 'dash' or '' (not ours). Adrenaline and rage fill
     and burn on their own; they have no key. */
  function key(F, e) {
    var k = e.key;
    if (k === 'x' || k === 'X') { dash(F); return 'dash'; }
    return '';
  }

  /* near: 0..1 closeness to the boss's hit area, or null when the boss
     runs a rage model of its own. A full bar burns itself after 3 s. */
  function tick(F, dt, near) {
    F.clock += dt;
    if (F.adrenT > 0) F.adrenT -= dt;
    else F.adren = Math.min(1, F.adren + dt / ADREN_FILL);
    if (F.rageT > 0) F.rageT -= dt;
    else if (near !== null && near !== undefined) {
      F.rage = Math.min(1, F.rage + dt * near / RAGE_FILL);
      if (F.rage >= 1 && (F.rageFull += dt) > 3) rage(F);
    }
    if (F.flashT > 0) F.flashT -= dt;
    if (F.grazeFlashT > 0) F.grazeFlashT -= dt;
    for (var sw = F.swings.length - 1; sw >= 0; sw--)
      if ((F.swings[sw].t += dt) >= F.swings[sw].dur) F.swings.splice(sw, 1);
    /* Terraria's arc: up out of the hit, then falling away. Reduced
       motion holds the number still. */
    var still = !!(NEU.settings && NEU.settings.reduced);
    for (var i = F.pops.length - 1; i >= 0; i--) {
      var p = F.pops[i];
      p.age += dt;
      if (p.age >= POP_LIFE) { F.pops.splice(i, 1); continue; }
      var a = p.age / POP_LIFE;
      if (!still) p.y = p.y0 - 64 * a + 80 * a * a;
    }
  }

  function hurt(F, x, y) { F.adren = 0; pop(F, x, y, 1, '#FF6B6B'); }
  function mul(F) { return (F.adrenT > 0 ? 2 : 1) * (F.rageT > 0 ? 2 : 1); }
  function slow(F) { return F.adrenT > ADREN_ON - ADREN_SLOW ? 0.45 : 1; }

  /* Reduce particles skips the numbers; at most twelve, oldest dropped. */
  function pop(F, x, y, n, col) {
    if (NEU.settings && NEU.settings.particles) return;
    if (F.pops.length >= POP_MAX) F.pops.shift();
    F.pops.push({ x: x, y0: y, y: y, n: Math.max(1, Math.round(n)), age: 0, c: col || '#FFC46A' });
  }
  /* A strike landed on the boss: the number, the bar's chip, and a
     white flash that never repeats faster than 3 Hz. */
  function bossHit(F, x, y, n) {
    pop(F, x, y, n);
    F.hitAt = F.clock;
    if (F.clock - F.flashAt >= 0.34) { F.flashAt = F.clock; F.flashT = 0.1; }
  }

  /* One radial sprite per colour+radius, stamped additively: cheap
     enough to put under every bullet on a phone. */
  var glowCache = {};
  function glow(ctx, x, y, r, col, a) {
    r = Math.max(1, r | 0);
    var k = col + r, c = glowCache[k];
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = r * 2;
      var g = c.getContext && c.getContext('2d');
      if (!g) return;
      var gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
      glowCache[k] = c;
    }
    var op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a === undefined ? 1 : a;
    ctx.drawImage(c, (x - r) | 0, (y - r) | 0);
    ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
  }

  /* The soul with its feel, drawn inside the shake: afterimages, the
     resource glows, the colour swap, the dash pip, the damage numbers. */
  function drawFX(ctx, F, inv) {
    var col = F.mode === 'blue' ? COL_BLUE : COL_SOUL;
    for (var i = 0; i < F.trail.length; i++) {
      ctx.globalAlpha = 0.12 * (i + 1);
      stamp(ctx, HEART, F.trail[i].x, F.trail[i].y, 2, col);
    }
    ctx.globalAlpha = 1;
    if (F.adrenT > 0) glow(ctx, F.x, F.y, 44, COL_ADREN, 0.7);
    if (F.rageT > 0) glow(ctx, F.x, F.y, 32, COL_RAGE, 0.6);
    if (F.modeT > 0) glow(ctx, F.x, F.y, 20, '#FFFFFF', F.modeT / 0.3);
    /* graze outline: a white heart one pixel-step around the soul, on
       the graze flash (at most 3 Hz, set by the fight) */
    if (F.grazeFlashT > 0) {
      stamp(ctx, HEART, F.x - 2, F.y, 2, '#FFFFFF');
      stamp(ctx, HEART, F.x + 2, F.y, 2, '#FFFFFF');
      stamp(ctx, HEART, F.x, F.y - 2, 2, '#FFFFFF');
      stamp(ctx, HEART, F.x, F.y + 2, 2, '#FFFFFF');
    }
    /* The dash pip that sat here (#B8E6FF, 2x6 at x+9, y-11) read as a
       stray blue-white line stuck to the heart; it now lives in the HUD
       panel (hud, DASH). Nothing but the heart is drawn on the soul. */
    drawSoul(ctx, F.x, F.y, F.dashI > 0 ? 0 : inv, col);
    /* focus (Shift) shows the true hitbox: three pixels of bone at the centre */
    if (F.focus) { ctx.fillStyle = COL_BONE; ctx.fillRect((F.x - 1) | 0, (F.y - 1) | 0, 3, 3); }
    ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var j = 0; j < F.pops.length; j++) {
      var p = F.pops[j], px = Math.round(p.x), py = Math.round(p.y);
      ctx.globalAlpha = Math.max(0, 1 - p.age / POP_LIFE);
      if (p.big) {
        /* a melee number: twice the size, a black outline, a pop-in */
        var sz = p.age < 0.08 ? 48 : 32;
        ctx.font = 'bold ' + sz + 'px "Determination Mono","Pixelify Sans",monospace';
        ctx.fillStyle = '#000000';
        ctx.fillText(String(p.n), px - 2, py); ctx.fillText(String(p.n), px + 2, py);
        ctx.fillText(String(p.n), px, py - 2); ctx.fillText(String(p.n), px, py + 2);
        ctx.fillStyle = p.c;
        ctx.fillText(String(p.n), px, py);
        ctx.font = FONT;
        continue;
      }
      ctx.fillStyle = p.c;
      ctx.fillText(String(p.n), px, py);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  /* The boss's own hit flash, at its position (inside the shake). */
  function drawFlash(ctx, F, x, y, r) {
    if (F.flashT <= 0) return;
    if (NEU.juice && NEU.juice.noFlash) return;
    glow(ctx, x, y, r, '#FFFFFF', F.flashT / 0.1);
  }

  function bar(ctx, x, y, w, h, r, track, fill) {
    ctx.fillStyle = track; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, r))), h);
  }
  /* K1 thin frame (2px rim, black inside) from the stage kit; a test
     page without stage.js just skips it */
  function fr(ctx, x, y, w, h, rim) {
    if (NEU.stage) NEU.stage.frame(ctx, x | 0, y | 0, w | 0, h | 0, true, rim);
  }
  /* an open-bottom plate (K2, no top bar) sitting on a frame's top edge */
  function tab(ctx, x, yBot, w) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, yBot - 30, w, 30);
    ctx.fillStyle = '#000000'; ctx.fillRect(x + 2, yBot - 28, w - 4, 28);
  }

  /* The HUD, drawn outside the shake. Top: a framed boss bar (red
     3-step fill, a white chip that trails behind, phase notches) with
     its name and % on plates. Bottom: one party strip band under the
     arena: the YOU cell (soul, HP) and RAGE / DASH / ADRN sub-bars.
     o = { w, h, AX?, AW?, AY, AH, name, hp, max, ticks, invuln, php,
           pmax, phase, tp?, rage?, rageOn?, frame? } */
  /* TP, Deltarune's meter: a vertical framed gauge left of the arena,
     ten cells filling bottom-up, gold at MAX. tp is 0..1. */
  function tpMeter(ctx, tp, AX, AY, AH) {
    var f = Math.max(0, Math.min(1, tp)), max = f >= 1, slim = AX < 92;
    var w = slim ? 12 : 24, h = Math.min(320, AH) | 0;
    var x = slim ? Math.max(6, (AX - 18) | 0) : Math.max(40, (AX - 52) | 0);
    var y = (AY + ((AH - h) >> 1)) | 0;
    fr(ctx, x, y, w, h, '#FFFFFF');
    fr(ctx, x + 2, y + 2, w - 4, h - 4, '#8C2F4A');
    /* 10 cells, 2px black gaps, inside the 4px rims */
    var ix = x + 4, iw = w - 8, ch = ((h - 8 - 2) / 10 | 0) - 2, n = f * 10, i, cy, part;
    for (i = 0; i < 10; i++) {
      cy = y + h - 4 - 2 - (i + 1) * (ch + 2) + 2;
      ctx.fillStyle = '#3A1A06'; ctx.fillRect(ix, cy, iw, ch);
      part = max ? ch : Math.round(ch * Math.max(0, Math.min(1, n - i)));
      if (part > 0) {
        ctx.fillStyle = max ? '#FFD34E' : '#FF8A1E';
        ctx.fillRect(ix, cy + ch - part, iw, part);
      }
    }
    ctx.textBaseline = 'top';
    var s = max ? 'MAX' : Math.floor(f * 100) + '%';
    if (slim) {
      ctx.textAlign = 'left'; ctx.fillStyle = max ? '#FFD34E' : '#EDE7DE';
      ctx.fillText('TP ' + s, x - 2, y - 24);
      return;
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#FF8A1E';
    ctx.fillText('T', x - 16, y + (h >> 1) - 16);
    ctx.fillText('P', x - 16, y + (h >> 1));
    var pw = Math.ceil((ctx.measureText(s).width + 32) / 8) * 8, px = (x + (w >> 1) - (pw >> 1)) | 0;
    tab(ctx, px, y, pw);
    ctx.fillStyle = max ? '#FFD34E' : '#EDE7DE';
    ctx.fillText(s, x + (w >> 1), y - 22);
    ctx.textAlign = 'left';
  }

  /* one width for every boss bar: clears the esc button with a gap
     down to 390 px. Takes the viewport width (number) or an object o.w. */
  function barW(o) {
    var w = typeof o === 'number' ? o : (o && o.w) || 0;
    return Math.min(480, w - 200) | 0;
  }

  function hud(ctx, F, o) {
    ctx.font = FONT; ctx.textBaseline = 'top';
    var r = Math.max(0, Math.min(1, o.hp / o.max));
    var d = Math.max(0, F.clock - F.hudAt); F.hudAt = F.clock;
    if (r > F.chip) F.chip = r;
    else if (F.clock - F.hitAt > 0.4) F.chip = Math.max(r, F.chip - d * 0.6);
    var bw = barW(o.w), bx = ((o.w - bw) / 2) | 0, by = 36, i;
    /* boss bar: 2px white rim, 2px inner rim (o.frame), 16px well */
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(bx - 4, by - 4, bw + 8, 24);
    ctx.fillStyle = o.frame || '#B892FF'; ctx.fillRect(bx - 2, by - 2, bw + 4, 20);
    ctx.fillStyle = '#1A0A0E'; ctx.fillRect(bx, by, bw, 16);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(bx, by, Math.round(bw * F.chip), 16);
    var fw = Math.round(bw * r);
    ctx.fillStyle = o.invuln ? '#6A6480' : '#C8202E'; ctx.fillRect(bx, by, fw, 16);
    ctx.fillStyle = o.invuln ? '#4A4458' : '#8C1A22'; ctx.fillRect(bx, by + 11, fw, 5);
    ctx.fillStyle = o.invuln ? '#8A8598' : '#FF5A4A'; ctx.fillRect(bx, by, fw, 2);
    /* phase ticks: 2px notches cut down through the top rim */
    ctx.fillStyle = '#000000';
    for (i = 0; o.ticks && i < o.ticks.length; i++)
      ctx.fillRect(bx + Math.round(bw * o.ticks[i]), by - 4, 2, 6);
    /* Glitch: the last phase look shivers her name at 2 Hz (two pinned
       positions per second, none under reduced motion). */
    var still = !!(NEU.settings && NEU.settings.reduced);
    var glx = (o.glitch && !still) ? ((Math.floor(F.clock * 2) & 1) ? 2 : -2) : 0;
    var pct = Math.ceil(r * 100) + '%';
    var nw = Math.min(bw - 80, Math.ceil((ctx.measureText(o.name).width + 32) / 8) * 8) | 0;
    var cw = Math.ceil((ctx.measureText(pct).width + 32) / 8) * 8;
    tab(ctx, bx - 4, by - 4, nw); tab(ctx, bx + bw + 4 - cw, by - 4, cw);
    ctx.fillStyle = '#EDE7DE';
    ctx.textAlign = 'left'; ctx.fillText(o.name, bx + 12 + glx, by - 26);
    ctx.textAlign = 'right'; ctx.fillText(pct, bx + bw - 12, by - 26);

    /* the party strip: one band, the arena's width, under the arena */
    var AW = o.AW || (o.AX !== undefined ? o.w - 2 * o.AX : Math.min(760, o.w - 48));
    AW = Math.max(240, Math.min(o.w - 16, AW)) | 0;
    var sx = ((o.w - AW) / 2) | 0, sy = Math.min(o.AY + o.AH + 8, o.h - 56 - 8) | 0;
    var yw = Math.min(256, AW - 120) | 0;
    fr(ctx, sx, sy, AW, 56, '#FFFFFF');
    ctx.fillStyle = COL_SOUL; ctx.fillRect(sx, sy, AW, 4);
    if (NEU.stage) {
      NEU.stage.strip(ctx, sx, sy, yw, [{ name: 'YOU', hp: Math.max(0, o.php), max: o.pmax, col: COL_SOUL,
        face: function (c, fx, fy) { stamp(c, HEART, fx + 20, fy + 20, 3, COL_SOUL); } }]);
      /* the cell's right rim would split the band: paint it out */
      ctx.fillStyle = '#000000'; ctx.fillRect(sx + yw - 2, sy + 4, 4, 50);
    }
    var rg = o.rage !== undefined ? o.rage : F.rage;
    var rgOn = o.rageOn !== undefined ? o.rageOn : F.rageT > 0;
    var dk = F.dashCd > 0 ? 1 - F.dashCd / (F.dashCdMax || DASH_CD) : 1;
    var ar = F.adrenT > 0 ? F.adrenT / ADREN_ON : F.adren;
    var lx = sx + yw + 8, bx2 = lx + 56, bw2 = sx + AW - 10 - bx2;
    var SUB = [
      ['RAGE', COL_RAGE, rgOn ? 1 : rg, '#3A0E0E', rgOn ? '#FFC46A' : COL_RAGE],
      ['DASH', dk >= 1 ? '#B8E6FF' : '#6A6480', dk, '#1A2230', dk >= 1 ? '#B8E6FF' : '#5A7A90'],
      ['ADRN', COL_ADREN, ar, '#0F2A18', F.adrenT > 0 || F.adren >= 1 ? '#B8FFD0' : COL_ADREN]
    ];
    ctx.textAlign = 'left';
    for (i = 0; i < 3; i++) {
      var ry = sy + 6 + i * 16;
      ctx.fillStyle = SUB[i][1]; ctx.fillText(SUB[i][0], lx, ry);
      bar(ctx, bx2, ry + 6, bw2, 4, SUB[i][2] || 0, SUB[i][3], SUB[i][4]);
    }
    if (o.tp !== undefined) tpMeter(ctx, o.tp, o.AX, o.AY, o.AH);
    /* the screen-reader line: HP and phase, written only on a change */
    var s = 'HP ' + Math.max(0, o.php) + '/' + o.pmax + ', ' + o.name + ' phase ' + o.phase;
    if (s !== F.live) {
      F.live = s;
      var el = document.getElementById('bhLive');
      if (el) el.textContent = s;
    }
  }

  NEU.danmaku = {
    arena: arena,
    fight: fight, move: move, dash: dash, tap: tap, key: key, keyName: keyName,
    tick: tick, hurt: hurt, mul: mul, slow: slow, pop: pop, bossHit: bossHit,
    adrenaline: adrenaline, rage: rage, soulMode: soulMode,
    glow: glow, drawFX: drawFX, drawFlash: drawFlash, hud: hud, barW: barW,
    DASH_CD: DASH_CD, ADREN_ON: ADREN_ON,
    TAP: 0,      /* double-tap window, s; 0 = off: X is the only dash */
    soul: {
      draw: drawSoul,
      R: 3.2,
      stamp: stamp,
      COL: COL_SOUL
    },
    shot: shot,
    step: step,
    hits: hits,
    death: death,
    resetDeath: resetDeath,
    IFRAMES: 1.1,
    SPEED: 250,
    FOCUS: 108    /* Shift held: the soul's slow, precise speed */
  };
})();
