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
    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) {
        var ch = rows[r][c];
        if (ch === '.') continue;
        ctx.fillStyle = (ch === 'o' && off) ? off : on;
        ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
      }
    }
  }

  function drawSoul(ctx, x, y, inv, col) {
    if (NEU.juice && (NEU.juice.noFlash || NEU.juice.reduced)) {
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
    var above = Math.min(maxH || 520, winH - padHeight() - 190);
    if (above < full && above >= full * 0.6) winH -= padHeight();
    var AW = Math.min(maxW || 760, winW - 48);
    var AH = Math.min(maxH || 520, winH - 190);
    var AX = ((winW - AW) / 2) | 0;
    var AY = ((winH - AH) / 2 + (padY !== undefined ? padY : 22)) | 0;
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

  function fight(x, y) {
    return { x: x, y: y, vy: 0, mode: 'red', modeT: 0, ground: false,
             fx: 0, fy: -1, dvx: 0, dvy: 0, dashT: 0, dashI: 0, dashCd: 0,
             trail: [], tapK: '', tapAt: -9, clock: 0,
             adren: 0, adrenT: 0, rage: 0, rageT: 0, rageFull: 0,
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
    F.dashT = DASH_T; F.dashI = DASH_I; F.dashCd = DASH_CD;
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    return true;
  }

  /* Double-tap a direction to dash (Terraria's Shield of Cthulhu). */
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
    var y0 = F.y, sp = keys.focus ? NEU.danmaku.FOCUS : NEU.danmaku.SPEED;
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
  /* Keys every fight shares. Returns what it did ('' = not ours). B
     returns 'rage' even on an empty shared bar, so a boss with a rage
     model of its own (Calamitas) can route B into it. */
  function key(F, e) {
    var k = e.key;
    if (k === 'c' || k === 'C') { dash(F); return 'dash'; }
    if (k === 'v' || k === 'V' || ((k === 'z' || k === 'Z') && e.shiftKey)) { adrenaline(F); return 'adren'; }
    if (k === 'b' || k === 'B') { rage(F); return 'rage'; }
    var d = keyName(e);
    if (d && d !== 'focus' && !e.repeat) tap(F, d);
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
    drawSoul(ctx, F.x, F.y, F.dashI > 0 ? 0 : inv, col);
    var qx = (F.x + 9) | 0, qy = (F.y - 11) | 0;
    var k = F.dashCd > 0 ? (6 * (1 - F.dashCd / DASH_CD)) | 0 : 6;
    ctx.fillStyle = '#4A4560'; ctx.fillRect(qx, qy, 2, 6);
    ctx.fillStyle = '#B8E6FF'; ctx.fillRect(qx, qy + 6 - k, 2, k);
    ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var j = 0; j < F.pops.length; j++) {
      var p = F.pops[j];
      ctx.globalAlpha = Math.max(0, 1 - p.age / POP_LIFE);
      ctx.fillStyle = p.c;
      ctx.fillText(String(p.n), Math.round(p.x), Math.round(p.y));
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  /* The boss's own hit flash, at its position (inside the shake). */
  function drawFlash(ctx, F, x, y, r) {
    if (F.flashT <= 0) return;
    if (NEU.juice && (NEU.juice.noFlash || NEU.juice.reduced)) return;
    glow(ctx, x, y, r, '#FFFFFF', F.flashT / 0.1);
  }

  function bar(ctx, x, y, w, h, r, track, fill) {
    ctx.fillStyle = track; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, r))), h);
  }

  /* The HUD, drawn outside the shake. Top: a Calamity boss bar (dark
     frame, red fill, a white chip that trails behind, phase ticks).
     Bottom: a Deltarune party panel for YOU, the adrenaline gauge on
     its left, rage (and tp, when the boss has one) inside it.
     o = { w, h, AY, AH, name, hp, max, ticks, invuln, php, pmax, phase,
           tp?, rage?, rageOn? } */
  function hud(ctx, F, o) {
    ctx.font = FONT; ctx.textBaseline = 'top';
    var r = Math.max(0, Math.min(1, o.hp / o.max));
    var d = Math.max(0, F.clock - F.hudAt); F.hudAt = F.clock;
    if (r > F.chip) F.chip = r;
    else if (F.clock - F.hitAt > 0.4) F.chip = Math.max(r, F.chip - d * 0.6);
    /* 160 keeps the bar clear of the esc button in the top-right corner */
    var bw = Math.min(480, o.w - 160) | 0, bx = ((o.w - bw) / 2) | 0, by = 36;
    ctx.fillStyle = '#05050A'; ctx.fillRect(bx - 4, by - 4, bw + 8, 20);
    ctx.fillStyle = '#5A5468'; ctx.fillRect(bx - 2, by - 2, bw + 4, 16);
    ctx.fillStyle = '#1A0A0E'; ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(bx, by, Math.round(bw * F.chip), 12);
    ctx.fillStyle = o.invuln ? '#6A6480' : '#C8202E'; ctx.fillRect(bx, by, Math.round(bw * r), 12);
    ctx.fillStyle = o.invuln ? '#8A8598' : '#FF5A4A'; ctx.fillRect(bx, by, Math.round(bw * r), 3);
    ctx.fillStyle = '#EDE7DE';
    for (var i = 0; o.ticks && i < o.ticks.length; i++)
      ctx.fillRect(bx + Math.round(bw * o.ticks[i]), by - 2, 2, 16);
    ctx.textAlign = 'left'; ctx.fillText(o.name, bx, by - 24);
    ctx.textAlign = 'right'; ctx.fillText(Math.ceil(r * 100) + '%', bx + bw, by - 24);

    var pw = Math.min(300, o.w - 64), ph = 48;
    var px = ((o.w - pw) / 2 + 12) | 0;
    var py = Math.min(o.AY + o.AH + 24, o.h - ph - 4) | 0;
    var tab = COL_SOUL;
    ctx.fillStyle = '#000000'; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = tab;
    ctx.fillRect(px, py, pw, 2); ctx.fillRect(px, py + ph - 2, pw, 2);
    ctx.fillRect(px, py, 2, ph); ctx.fillRect(px + pw - 2, py, 2, ph);
    ctx.fillRect(px + 8, py - 18, 56, 18);
    ctx.textAlign = 'left'; ctx.fillStyle = '#000000'; ctx.fillText('YOU', px + 18, py - 17);
    ctx.fillStyle = '#EDE7DE'; ctx.fillText('HP', px + 10, py + 6);
    ctx.textAlign = 'right'; ctx.fillText(Math.max(0, o.php) + '/' + o.pmax, px + pw - 10, py + 6);
    bar(ctx, px + 40, py + 8, pw - 110, 12, o.php / o.pmax, '#800000', '#FFFF00');
    var rg = o.rage !== undefined ? o.rage : F.rage;
    var rgOn = o.rageOn !== undefined ? o.rageOn : F.rageT > 0;
    var half = o.tp !== undefined ? ((pw - 20) / 2) | 0 : pw - 20;
    ctx.textAlign = 'left'; ctx.fillStyle = COL_RAGE; ctx.fillText('RAGE', px + 10, py + 26);
    bar(ctx, px + 58, py + 30, half - 52, 8, rgOn ? 1 : rg, '#3A0E0E', rgOn ? '#FFC46A' : COL_RAGE);
    if (o.tp !== undefined) {
      ctx.fillStyle = '#FF9E30'; ctx.fillText('TP', px + 14 + half, py + 26);
      bar(ctx, px + 40 + half, py + 30, half - 34, 8, o.tp, '#3A2008', '#FF9E30');
    }
    var gx = px - 22, ar = F.adrenT > 0 ? F.adrenT / ADREN_ON : F.adren;
    var fh = Math.round(ph * Math.max(0, Math.min(1, ar)));
    ctx.fillStyle = '#000000'; ctx.fillRect(gx - 2, py - 2, 18, ph + 4);
    ctx.fillStyle = '#0F2A18'; ctx.fillRect(gx, py, 14, ph);
    ctx.fillStyle = F.adrenT > 0 ? '#B8FFD0' : COL_ADREN; ctx.fillRect(gx, py + ph - fh, 14, fh);
    if (F.adren >= 1 || F.adrenT > 0) glow(ctx, gx + 7, py + ph / 2, 32, COL_ADREN, 0.5);
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
    glow: glow, drawFX: drawFX, drawFlash: drawFlash, hud: hud,
    DASH_CD: DASH_CD, ADREN_ON: ADREN_ON,
    TAP: 0.25,      /* double-tap window, s; 0 turns tap-dash off */
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
    FOCUS: 108
  };
})();
