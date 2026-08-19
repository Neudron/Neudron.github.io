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

  function arena(w, h, maxW, maxH, padY) {
    var winW = w || window.innerWidth || 800;
    var winH = h || window.innerHeight || 600;
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

  NEU.danmaku = {
    arena: arena,
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
