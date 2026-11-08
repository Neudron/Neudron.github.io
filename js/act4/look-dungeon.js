/* look-dungeon.js — the dungeon: parallax wall and pillars, lit bricks, wall-mounted decor, live flames (vz-plat).
   Everything static is baked once (per band or per level). Per frame: a few drawImage calls, the flames and the glow. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat;
  if (!P || !P._kinds || !P.spr) return;
  var kinds = P._kinds, HZ = 2, INK = '#12081E', EX = 160, FLAME = ['#8A2A10', '#E4602A', '#FFB347', '#FFF2C4'];
  var BANDS = {
    blue: { i: 0, deep: '#0B1024', shadow: '#141C3A', wall: '#24325C', brick: '#2B3A67', light: '#3E5490', rim: '#6A82C4', mort: '#1A2340', cloth: ['#7A2038', '#A8304C', '#D0486A'] },
    green: { i: 1, deep: '#04140C', shadow: '#0E4A28', wall: '#124830', brick: '#1E5A34', light: '#158039', rim: '#3CAA68', mort: '#0A4020', moss: '#8EE0A8', cloth: ['#7A5A10', '#B08A20', '#D8B040'] },
    pink: { i: 2, deep: '#1E0A1E', shadow: '#4A1848', wall: '#602050', brick: '#7A2A6A', light: '#A84890', rim: '#D040A0', mort: '#602050', hot: '#F070C0', cloth: ['#2A1050', '#4A1C88', '#7A44C8'] }
  };
  var cur = BANDS.blue, last = null, lights = [], bg = {}, mixes = {};

  function reducedNow() { return P.reduced(); }
  function candleOn(t) { return reducedNow() ? 1 : (Math.floor(t * HZ) % 2) === 0 ? 1 : 0; }
  function bandOf(id) {
    var m = /^d(\d+)$/.exec(id || ''), n = m ? +m[1] : 0;
    return n >= 8 ? 'pink' : n >= 4 ? 'green' : 'blue';
  }
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function mix(a, b, t) {
    var k = a + b + t, x, y, v, i, s;
    if (mixes[k]) return mixes[k];
    x = hex(a); y = hex(b); s = '#';
    for (i = 0; i < 3; i++) { v = Math.round(x[i] + (y[i] - x[i]) * t); s += (v < 16 ? '0' : '') + v.toString(16); }
    s = s.toUpperCase();
    return (mixes[k] = s);
  }
  function R(c, col, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    c.fillStyle = col;
    if (last) last.colors[col] = (last.colors[col] || 0) + 1;
    c.fillRect(x | 0, y | 0, w | 0, h | 0);
  }
  function hs(x, y, z) { return P.hash(x, y, z); }

  /* ── baked per band: far wall, pillars, foreground chain ───────────── */
  function alcove(g, x, y, B) {
    var f = function (xx, yy, w, h, col) { g.fillStyle = col; g.fillRect(x + xx, y + yy, w, h); };
    f(4, 0, 40, 2, B.light); f(2, 2, 44, 2, B.light); f(0, 4, 48, 60, B.light);
    f(6, 2, 36, 2, B.deep); f(4, 4, 40, 2, B.deep); f(2, 6, 44, 58, B.deep);
    f(2, 6, 44, 6, B.mort); f(2, 12, 44, 4, B.shadow);
    f(0, 62, 48, 2, B.wall);
  }
  function farWall(B) {
    var cv = P.mk(640, 360 + EX * 2), g = cv.getContext('2d'), y, x, r, sh, bx, t, k;
    g.imageSmoothingEnabled = false;
    g.translate(0, EX);
    for (y = -EX, r = 0; y < 360 + EX; y += 16, r++) {
      sh = (r & 1) ? 16 : 0;
      for (x = -sh; x < 640; x += 32) {
        bx = (((x + sh) / 32) | 0) % 20;
        t = hs(bx, r, B.i + 40);
        g.fillStyle = t < 0.45 ? B.shadow : t < 0.7 ? B.deep : t < 0.9 ? B.wall : B.brick;
        g.fillRect(x, y, 32, 16);
        g.fillStyle = B.wall; g.fillRect(x, y, 32, 1);
        g.fillStyle = B.deep; g.fillRect(x, y + 15, 32, 1); g.fillRect(x, y, 1, 16);
      }
    }
    for (k = 0; k < 4; k++) alcove(g, 80 + k * 160, 164, B);
    g.globalAlpha = 0.45; g.fillStyle = B.deep;
    for (y = -EX; y < 70; y += 16) { g.globalAlpha = y < 20 ? 0.45 : 0.25; g.fillRect(0, y, 640, 16); }
    g.globalAlpha = 1;
    return cv;
  }
  function pillars(B) {
    var cv = P.mk(192, 360 + EX * 2), g = cv.getContext('2d');
    var f = function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y + EX, w, h); };
    g.imageSmoothingEnabled = false;
    f(8, 70, 4, 150, B.shadow); f(12, 70, 16, 150, B.wall); f(28, 70, 2, 150, B.light); f(30, 70, 2, 150, B.rim);
    f(17, 70, 1, 150, B.shadow); f(22, 70, 1, 150, B.shadow);
    f(6, 60, 28, 2, B.mort); f(4, 62, 32, 8, B.brick); f(4, 62, 32, 2, B.light); f(4, 68, 32, 2, B.deep);
    f(4, 220, 32, 8, B.brick); f(4, 220, 32, 2, B.light); f(4, 226, 32, 2, B.deep); f(6, 228, 28, 2, B.mort);
    return cv;
  }
  function chainStrip() {
    /* chains only paint from the top to about y=270 (world -EX..+110): a 280px strip, not the full 680px height */
    return P.spr('dchain', 320, 280, function (R2) {
      var y, i = 0;
      for (y = -EX; y < 100; y += 6, i++) {
        if (i & 1) { R2(142, y + EX, 2, 6, '#05070F'); R2(142, y + EX, 1, 6, '#1A2340'); }
        else { R2(140, y + EX, 6, 6, '#05070F'); R2(142, y + EX + 1, 2, 4, '#0B1024'); }
      }
      R2(138, 100 + EX, 10, 2, '#05070F'); R2(138, 102 + EX, 2, 6, '#05070F'); R2(146, 102 + EX, 2, 6, '#05070F');
    });
  }
  function band(B, key) {
    var b = bg[key];
    if (!b) b = bg[key] = { far: farWall(B), pil: pillars(B) };
    return b;
  }

  /* ── hooks ─────────────────────────────────────────────────────────── */
  function backdrop(c, camX, camY, level, now, a) {
    var key = bandOf(level.id), b = band(BANDS[key], key), x, w;
    w = 640; x = -P.mod(camX * 0.3, w) + Math.floor(a.x0 / w) * w;
    for (; x < a.x1; x += w) c.drawImage(b.far, x | 0, -EX);
    w = 192; x = -P.mod(camX * 0.6, w) + Math.floor(a.x0 / w) * w - w;
    for (; x < a.x1; x += w) c.drawImage(b.pil, x | 0, -EX);
  }
  function flame(c, x, y, now, seed) {
    var f = reducedNow() ? 1 : ((((now / 85) | 0) + seed) % 4), w = [0, 1, 2, 1][f];
    c.fillStyle = FLAME[0]; c.fillRect(x - 2, y - (3 + w), 4, 3 + w);
    c.fillStyle = FLAME[1]; c.fillRect(x - (2 - (f & 1)), y - (5 + w), 3, 4 + w);
    c.fillStyle = FLAME[2]; c.fillRect(x - 1, y - (6 + w), 2, 4 + w);
    c.fillStyle = FLAME[3]; c.fillRect(x, y - (3 + (w >> 1)), 1, 2);
  }
  function live(c, camX, camY, level, now, a) {
    var i, sx, sy;
    for (i = 0; i < lights.length; i += 2) {
      sx = (lights[i] - camX) | 0; sy = (lights[i + 1] - camY) | 0;
      if (sx < a.x0 - 48 || sx > a.x1 + 48) continue;
      P.glow(c, sx, sy, 56, '#F8A030', 0.10); P.glow(c, sx, sy, 34, '#F8A030', 0.14); P.glow(c, sx, sy, 18, '#F8A030', 0.20);
      flame(c, sx, sy + 1, now, i >> 1);
    }
  }
  function foreground(c, camX, camY, level, now, a) {
    var w = 320, x = -P.mod(camX * 1.25, w) + Math.floor(a.x0 / w) * w - w, s = chainStrip();
    for (; x < a.x1; x += w) c.drawImage(s.cv, x | 0, -EX);
    c.globalAlpha = 0.25; c.fillStyle = '#000000'; c.fillRect(a.x0, a.y1 - 16, a.x1 - a.x0, 8);
    c.globalAlpha = 0.15; c.fillRect(a.x0, a.y1 - 8, a.x1 - a.x0, 8);
    c.globalAlpha = 1;
  }
  function chainHook(name, fn) {
    var prev = P[name];
    P[name] = function (c, camX, camY, level, now, a) {
      if (level && level.tileset === 'dungeon') return fn(c, camX, camY, level, now, a);
      if (prev) return prev(c, camX, camY, level, now, a);
    };
  }
  chainHook('backdrop', backdrop); chainHook('live', live); chainHook('foreground', foreground);
  var prevSkin = P.skin;
  P.skin = function (level) {
    var B;
    if (level && level.tileset === 'dungeon') {
      B = BANDS[bandOf(level.id)];
      return { key: bandOf(level.id), ink: INK, deep: B.deep, base: B.brick, light: B.light, rim: B.rim };
    }
    return prevSkin ? prevSkin(level) : null;
  };
  P.pad.dungeon = 192;

  /* ── the baked level ───────────────────────────────────────────────── */
  function solid(level, x, y) {
    if (x < 0 || x >= level.w || y >= level.h) return true;
    if (y < 0) return false;
    var ch = (level.grid[y] || '').charAt(x);
    return ch === '#' || ch === 'x';
  }
  function warm(col, cx, cy) {
    var i;
    for (i = 0; i < lights.length; i += 2) if (Math.abs(lights[i] - cx) < 24 && Math.abs(lights[i + 1] - cy) < 24) return mix(col, '#F8A030', 0.18);
    return col;
  }
  function brickCell(c, cx, cy, px, inside, deepen) {
    var x0 = Math.max(cx, px), x1 = Math.min(cx + 15, px + 16), t = hs(cx, cy, cur.i), tone, hi, sh, w = x1 - x0, d;
    tone = t < 0.7 ? cur.brick : t < 0.85 ? mix(cur.brick, cur.deep, 0.4) : cur.light;
    if (t >= 0.85) tone = mix(cur.brick, cur.light, 0.5);
    hi = mix(tone, cur.rim, 0.35); sh = mix(tone, cur.deep, 0.5);
    if (deepen) { tone = mix(tone, cur.deep, 0.35); hi = mix(hi, cur.deep, 0.3); sh = mix(sh, cur.deep, 0.3); }
    tone = warm(tone, cx + 8, cy + 4);
    if (w <= 0) return;
    R(c, tone, x0, cy, w, 7);
    R(c, hi, x0, cy, w, 1);
    if (cx >= px) R(c, hi, cx, cy, 1, 7);
    R(c, sh, x0, cy + 6, w, 1);
    if (cx + 14 < px + 16) R(c, sh, cx + 14, cy, 1, 7);
    if (inside && w >= 15 && hs(cx, cy, cur.i + 9) < 0.11) {
      d = (hs(cx, cy, 5) * 8) | 0;
      if (cur.i === 0) { R(c, cur.deep, cx + 4 + (d & 3), cy + 2, 1, 1); R(c, cur.deep, cx + 5 + (d & 3), cy + 3, 1, 1); R(c, cur.deep, cx + 5 + (d & 3), cy + 4, 1, 2); }
      else if (cur.i === 1) { R(c, '#3CAA68', cx + 3 + (d & 7), cy, 2, 2); R(c, cur.moss, cx + 3 + (d & 7), cy, 1, 1); }
      else R(c, cur.hot, cx + 3 + d, cy + 3, 1, 1);
    }
  }
  function brickTile(c, level, x, y) {
    var px = x * 16, py = y * 16, up = !solid(level, x, y - 1), left = !solid(level, x - 1, y), right = !solid(level, x + 1, y), down = !solid(level, x, y + 1);
    var inside = !(up || left || right || down), r, cy, sh, base = hs(x, y, cur.i + 20) < 0.5 ? cur.mort : mix(cur.mort, cur.shadow, 0.4);
    R(c, base, px, py, 16, 16);
    for (r = 0; r < 2; r++) {
      cy = py + r * 8; sh = (((cy / 8) | 0) & 1);
      if (sh) { brickCell(c, px - 8, cy, px, inside, inside); brickCell(c, px + 8, cy, px, inside, inside); }
      else brickCell(c, px, cy, px, inside, inside);
    }
    if (left) R(c, cur.rim, px, py, 1, 16);
    if (right) R(c, cur.deep, px + 15, py, 1, 16);
    if (down) R(c, cur.deep, px, py + 15, 16, 1);
    if (up) { R(c, cur.rim, px, py, 16, 1); R(c, cur.light, px, py + 1, 16, 1); R(c, cur.deep, px, py + 2, 16, 1); }
    return inside;
  }
  function cracked(c, px, py) {
    R(c, INK, px + 7, py + 2, 1, 3); R(c, INK, px + 6, py + 5, 1, 3); R(c, INK, px + 8, py + 8, 1, 3); R(c, INK, px + 7, py + 11, 1, 3);
    R(c, INK, px + 3, py + 8, 3, 1); R(c, INK, px + 10, py + 5, 3, 1);
  }
  function slab(c, px, py) {
    R(c, cur.rim, px, py, 16, 1); R(c, cur.light, px, py + 1, 16, 1);
    R(c, cur.brick, px, py + 2, 16, 3); R(c, cur.mort, px + 8, py + 2, 1, 3); R(c, cur.mort, px + 3, py + 2, 1, 2);
    R(c, cur.deep, px, py + 5, 16, 1);
    R(c, cur.brick, px + 1, py + 6, 3, 3); R(c, cur.deep, px + 3, py + 6, 1, 3); R(c, cur.light, px + 1, py + 6, 3, 1);
    R(c, cur.brick, px + 12, py + 6, 3, 3); R(c, cur.deep, px + 14, py + 6, 1, 3); R(c, cur.light, px + 12, py + 6, 3, 1);
  }
  function beam(c, level) {
    var w = level.w * 16, x;
    R(c, '#2A1810', 0, 0, w, 10); R(c, '#5C4030', 0, 0, w, 1); R(c, '#3A2414', 0, 1, w, 2); R(c, INK, 0, 9, w, 1);
    for (x = 13; x < w - 8; x += 29) R(c, '#1E120A', x, 3 + ((x >> 3) & 3), 9, 1);
    for (x = 20; x < w; x += 48) { R(c, '#3A3A30', x, 0, 5, 10); R(c, '#6A6A5A', x + 1, 1, 1, 8); R(c, '#12081E', x + 3, 2, 1, 1); R(c, '#12081E', x + 3, 7, 1, 1); }
    c.globalAlpha = 0.4; R(c, '#000000', 0, 10, w, 2); c.globalAlpha = 1;
  }
  function chainDecor(c, level, px, py) {
    var cx = px + 8, yy, i = 0, end = py + 10;
    for (yy = 10; yy < end; yy += 6, i++) {
      if (i & 1) { R(c, '#8A8A6A', cx - 1, yy, 2, 6); R(c, '#C8C8A0', cx - 1, yy, 1, 6); }
      else { R(c, '#4A4A3A', cx - 2, yy, 4, 6); R(c, cur.shadow, cx - 1, yy + 1, 2, 4); R(c, '#8A8A6A', cx - 2, yy + 1, 1, 4); R(c, '#C8C8A0', cx - 2, yy + 1, 1, 1); }
    }
    R(c, '#4A4A3A', cx - 3, end, 6, 2); R(c, '#4A4A3A', cx - 3, end + 2, 2, 4); R(c, '#4A4A3A', cx + 1, end + 2, 2, 4);
    R(c, '#8A8A6A', cx - 3, end, 6, 1); R(c, '#C8C8A0', cx - 3, end, 2, 1);
    last.chains++;
  }
  function bannerDecor(c, px, py) {
    var q = cur.cloth, k;
    R(c, '#4A4A3A', px + 1, 10, 1, py - 10); R(c, '#4A4A3A', px + 14, 10, 1, py - 10);
    R(c, '#3A2A20', px, py + 1, 16, 2); R(c, '#5C4030', px, py + 1, 16, 1);
    R(c, '#C8A040', px, py, 2, 4); R(c, '#C8A040', px + 14, py, 2, 4); R(c, '#FFE080', px, py, 1, 1); R(c, '#FFE080', px + 14, py, 1, 1);
    R(c, q[1], px + 2, py + 3, 12, 12);
    for (k = 0; k < 3; k++) { R(c, q[0], px + 5 + k * 4, py + 3, 1, 12); R(c, q[2], px + 3 + k * 4, py + 3, 1, 11); }
    for (k = 0; k < 6; k++) if (!(k & 1)) R(c, q[1], px + 2 + k * 2, py + 15, 2, 2); else R(c, q[0], px + 2 + k * 2, py + 15, 2, 1);
    R(c, q[0], px + 2, py + 3, 12, 1);
    R(c, cur.rim, px + 6, py + 7, 4, 4); R(c, q[0], px + 7, py + 8, 2, 2); R(c, '#FFE080', px + 6, py + 7, 1, 1);
    last.banners++;
  }
  var SPINE = ['#A8304C', '#4060A0', '#C8B070', '#E8D8C8', '#3A7A5A', '#7A52B8', '#8A6040'];
  function shelfDecor(c, px, py) {
    var k, x, wd, t;
    R(c, '#2A1810', px + 1, py + 1, 14, 14);
    R(c, '#3A2414', px, py, 1, 16); R(c, '#3A2414', px + 15, py, 1, 16);
    R(c, '#8A6040', px, py, 16, 1); R(c, '#5C4030', px, py + 1, 16, 1);
    R(c, '#8A6040', px, py + 7, 16, 1); R(c, '#5C4030', px, py + 8, 16, 1);
    R(c, '#5C4030', px, py + 14, 16, 1); R(c, '#3A2414', px, py + 15, 16, 1);
    x = px + 1;
    for (k = 0; k < 6 && x < px + 14; k++) {
      t = hs(px, py + k, 3); wd = 2 + ((t * 2) | 0);
      R(c, SPINE[(t * 7) | 0], x, py + 2 + (k & 1), wd, 5 - (k & 1));
      R(c, mix(SPINE[(t * 7) | 0], '#FFFFFF', 0.3), x, py + 2 + (k & 1), 1, 5 - (k & 1));
      R(c, '#C8A040', x, py + 4, wd, 1);
      x += wd;
    }
    x = px + 1;
    for (k = 0; k < 3; k++) { t = hs(px, py + k, 8); R(c, SPINE[(t * 7) | 0], x, py + 10, 2, 4); R(c, '#C8A040', x, py + 11, 2, 1); x += 2 + (k & 1); }
    R(c, '#E8D2B0', px + 9, py + 9, 5, 5); R(c, '#C4A882', px + 9, py + 13, 5, 1);
    R(c, '#1A120C', px + 10, py + 10, 1, 2); R(c, '#1A120C', px + 12, py + 10, 1, 2);
    R(c, '#3A2414', px + 2, py + 16, 3, 3); R(c, '#5C4030', px + 2, py + 16, 3, 1);
    R(c, '#3A2414', px + 11, py + 16, 3, 3); R(c, '#5C4030', px + 11, py + 16, 3, 1);
    last.shelves++;
  }
  /* lit iron brazier on a wall bracket: the focal prop of each dungeon room; its flame and glow are drawn live from lights[] */
  function brazierDecor(c, px, py) {
    R(c, cur.shadow, px + 2, py + 3, 12, 11);
    R(c, '#2A2A36', px + 1, py + 7, 3, 1); R(c, '#2A2A36', px + 1, py + 8, 2, 1);
    R(c, INK, px + 3, py + 5, 10, 1);
    R(c, '#5A5A6A', px + 3, py + 6, 10, 2); R(c, '#8A8A9A', px + 4, py + 6, 8, 1);
    R(c, '#F8A030', px + 4, py + 7, 8, 1); R(c, '#C85A18', px + 4, py + 8, 8, 1);
    R(c, '#3A3A48', px + 4, py + 9, 8, 2); R(c, INK, px + 4, py + 11, 8, 1);
    R(c, '#2A2A36', px + 6, py + 12, 4, 2); R(c, INK, px + 5, py + 14, 6, 1); R(c, '#2A2A36', px + 5, py + 15, 6, 1);
    last.candles++;
  }
  function paintLevel(c, level) {
    var B, y, x, row, ch, px, py, i, e, inside;
    if (!level || level.tileset !== 'dungeon') return false;
    B = BANDS[bandOf(level.id)]; cur = B;
    last = { band: bandOf(level.id), back: 0, chains: 0, banners: 0, shelves: 0, candles: 0, spikes: 0, arch: 0, bone: false, colors: {} };
    NEU.dungeonLook.last = last;
    lights = [];
    for (y = 0; y < level.h; y++) for (x = 0; x < level.w; x++) if ((level.grid[y] || '').charAt(x) === 'w') lights.push(x * 16 + 8, y * 16 + 6);
    beam(c, level);
    for (y = 0; y < level.h; y++) {
      row = level.grid[y] || '';
      for (x = 0; x < level.w; x++) {
        ch = row.charAt(x); px = x * 16; py = y * 16;
        if (ch === '#' || ch === 'x') {
          inside = brickTile(c, level, x, y);
          if (ch === 'x') cracked(c, px, py);
          if (level.id === 'd0' && y <= 8) last.arch++;
          if (y === level.h - 1) for (i = 1; i <= 12; i++) brickTile(c, level, x, y + i);
        } else if (ch === '=') slab(c, px, py);
        else if (ch === 'c') chainDecor(c, level, px, py);
        else if (ch === 'b') bannerDecor(c, px, py);
        else if (ch === 'k') shelfDecor(c, px, py);
        else if (ch === 'w') brazierDecor(c, px, py);
        else if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') { P.spike(c, px, py, ch, null); last.spikes++; }
        if (ch === '.' || ch === ' ' || ch === 'n') last.back++;
      }
    }
    /* the brick below the floor is backdrop: shade a 32px band under the floor edge so the edge carries the eye, the rest stays lit */
    if (c.canvas && c.canvas.height > level.h * 16) {
      c.globalAlpha = 0.5; c.fillStyle = cur.deep;
      c.fillRect(0, level.h * 16, level.w * 16, Math.min(32, c.canvas.height - level.h * 16));
      c.globalAlpha = 1;
    }
    if (level.entities) for (i = 0; i < level.entities.length; i++) { e = level.entities[i]; if (e.t === 'bossdoor') last.bone = true; }
    return true;
  }
  P.painters.push(paintLevel);

  /* ── entity kinds that only the dungeon has ───────────────────────── */
  function arch(R2, x, y, w, h, col) { R2(x + 2, y, w - 4, 1, col); R2(x + 1, y + 1, w - 2, 1, col); R2(x, y + 2, w, h - 2, col); }
  function signSpr() {
    return P.spr('dsign', 16, 16, function (R2) {
      R2(3, 9, 2, 7, '#3A2418'); R2(11, 9, 2, 7, '#3A2418'); R2(3, 9, 1, 7, '#5C4030');
      R2(1, 2, 14, 9, INK); R2(2, 3, 12, 7, '#6B4423'); R2(2, 4, 12, 5, '#8A5A32'); R2(2, 3, 12, 1, '#C49060');
      R2(4, 4, 8, 1, '#2A1810'); R2(4, 6, 6, 1, '#2A1810'); R2(4, 8, 7, 1, '#2A1810');
    });
  }
  function mageSpr() {
    return P.spr('dmage', 32, 48, function (R2) {
      arch(R2, 0, 0, 32, 48, INK); arch(R2, 1, 1, 30, 47, '#4B2A78');
      R2(1, 6, 3, 41, '#7A52B8'); R2(28, 6, 3, 41, '#2A1640'); R2(13, 0, 6, 3, '#7A52B8'); R2(14, 3, 4, 1, '#2A1640');
      arch(R2, 5, 5, 22, 43, INK); arch(R2, 6, 6, 20, 42, '#1E1030');
      R2(9, 10, 2, 38, '#8A8598'); R2(15, 10, 2, 38, '#8A8598'); R2(21, 10, 2, 38, '#8A8598');
      R2(9, 10, 1, 38, '#C8C4D0'); R2(15, 10, 1, 38, '#C8C4D0'); R2(21, 10, 1, 38, '#C8C4D0');
      R2(5, 22, 22, 2, '#4A4658'); R2(5, 36, 22, 2, '#4A4658');
      R2(0, 45, 32, 3, INK); R2(1, 45, 30, 2, '#2A1640');
      var k, rx = [2, 2, 2, 29, 29, 29], ry = [12, 22, 32, 12, 22, 32];
      for (k = 0; k < 6; k++) R2(rx[k], ry[k], 1, 2, '#4B2A78');
    });
  }
  function bossSpr() {
    return P.spr('dboss', 32, 48, function (R2, g) {
      arch(R2, 0, 0, 32, 48, INK); arch(R2, 1, 1, 30, 47, '#4A3E30');
      R2(1, 6, 3, 41, '#C4A882'); R2(1, 6, 1, 41, '#E8D2B0'); R2(28, 6, 3, 41, '#8A7456'); R2(30, 6, 1, 41, '#C4A882');
      P.ell(g, 0, 0, 16, 12, 9, 8, INK); P.ell(g, 0, 0, 16, 12, 8, 7, '#C4A882'); P.ell(g, 0, 0, 15, 11, 6, 5, '#E8D2B0'); P.ell(g, 0, 0, 13, 9, 3, 2, '#F4E4CC');
      R2(10, 11, 4, 4, '#1A120C'); R2(18, 11, 4, 4, '#1A120C'); R2(15, 16, 2, 3, '#1A120C');
      R2(11, 20, 10, 3, INK); R2(12, 20, 8, 2, '#F4E4CC'); R2(14, 20, 1, 2, INK); R2(17, 20, 1, 2, INK);
      arch(R2, 6, 27, 20, 21, '#2A241C'); R2(6, 33, 20, 2, '#C4A882'); R2(6, 33, 20, 1, '#E8D2B0'); R2(6, 41, 20, 2, '#C4A882'); R2(6, 41, 20, 1, '#E8D2B0');
      R2(13, 35, 6, 7, '#C8A040'); R2(13, 35, 6, 1, '#FFE080'); R2(15, 37, 2, 3, INK);
      R2(0, 45, 32, 3, INK); R2(1, 45, 30, 2, '#4A3E30');
    });
  }
  function kd(name) { return kinds[name] || (kinds[name] = {}); }
  kd('sign').draw = function (c, px, py) { var s = signSpr(); if (s.cv) c.drawImage(s.cv, px, py); };
  kd('magegate').draw = function (c, px, py, e, now) {
    var s = mageSpr(), gx = px - 8, gy = py - 32, k = reducedNow() ? 0 : ((now / 600) | 0) % 6;
    if (s.cv) c.drawImage(s.cv, gx, gy);
    P.fr(c, gx + [2, 2, 2, 29, 29, 29][k], gy + [12, 22, 32, 12, 22, 32][k], 1, 2, '#B892FF');
    P.glow(c, gx + 16, gy + 24, 28, '#7A52B8', 0.10);
  };
  kd('bossdoor').draw = function (c, px, py, e) {
    var s = bossSpr(), gx = px - 8, gy = py - 32, has = !!(NEU.save && NEU.save.has && NEU.save.has('boss_key'));
    if (s.cv) c.drawImage(s.cv, gx, gy);
    P.fr(c, gx + 11, gy + 12, 2, 2, has ? '#FF8AC8' : '#3A2A20'); P.fr(c, gx + 19, gy + 12, 2, 2, has ? '#FF8AC8' : '#3A2A20');
    P.fr(c, gx + 10, gy + 9, 3, 1, '#E8D2B0');
  };

  /* preload: the three band backdrops (far wall + pillars) are built right after boot, not on the first entry into d0/d4/d8 */
  setTimeout(function () {
    ['blue', 'green', 'pink'].forEach(function (k) { band(BANDS[k], k); });
    P.prebake('d0'); P.prebake('m0');
  }, 0);

  NEU.dungeonLook = {
    tileset: 'dungeon', hz: HZ, candleOn: candleOn, last: null, canvas: null,
    paint: function (level) {
      var cv = P.bakedCanvas(), c = cv && cv.getContext && cv.getContext('2d');
      if (c && level && cv.width >= level.w * 16) paintLevel(c, level);
    },
    flick: function () {}, fillGap: function () {}
  };
})();
