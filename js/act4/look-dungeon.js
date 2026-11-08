/* look-dungeon.js — the dungeon's Terraria view (B2): native sheet framing, back walls, a light map, dusk sky, HUD.
   Static paint (walls, blocks, shelves, chains, banners, bookcases) bakes lazily into 32x32-tile chunks (plat.js).
   Per frame: the chunks, flames, the light map (one stepped half-tile overlay) and the HUD.
   Every tile and foe reads its sheet from NEU.dgSheets; a sheet that is not on disk yet draws a LOUD magenta box. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat;
  if (!P || !P._kinds || !P.spr) return;
  var kinds = P._kinds, T = 16, INK = '#12081E', MAG = '#FF00FF', MAGD = '#9A009A';
  var FONT = '16px "Determination Mono","Pixelify Sans",monospace';
  /* Terraria's 4-neighbour frame table (Framing.cs wallFrameLookup, the same cells WorldGen.TileFrame picks for a
     plain block): index = up 1 | left 2 | right 4 | down 8 -> [frameX, frameY, stepX, stepY] in frame units,
     three variants. 16..19 are the wall-only centre variants chosen by (x % 3, y % 3). */
  var FR = [[9, 3, 1, 0], [6, 3, 1, 0], [12, 0, 0, 1], [1, 4, 2, 0], [9, 0, 0, 1], [0, 4, 2, 0], [6, 4, 1, 0], [1, 2, 1, 0],
    [6, 0, 1, 0], [5, 0, 0, 1], [1, 3, 2, 0], [4, 0, 0, 1], [0, 3, 2, 0], [0, 0, 0, 1], [1, 0, 1, 0], [1, 1, 1, 0],
    [6, 1, 1, 0], [6, 2, 1, 0], [10, 0, 0, 1], [11, 0, 0, 1]];
  var CW = [[2, 0, 0], [0, 1, 4], [0, 3, 0]];
  var BRICK = { B: 'dgBlue', G: 'dgGreen', P: 'dgPink' }, CRACK = { B: 'dgCrackB', G: 'dgCrackG', P: 'dgCrackP' };
  var WALLK = { B: 'dgWallB', G: 'dgWallG', P: 'dgWallP' };
  /* Banners (Tiles_91) 10-15 are the six dungeon faction flags; bookcases (Tiles_101) 1-3 blue/green/pink dungeon;
     platforms (Tiles_19) rows 6/8/7 blue/green/pink brick; pots (Tiles_28) row 10 dungeon; lanterns (Tiles_42) row 0 chain */
  var BANNER = { B: 10, G: 12, P: 14 }, BOOKS = { B: 1, G: 2, P: 3 }, SHELF = { B: 6, G: 8, P: 7 };
  var SKY = ['#0B0716', '#140D26', '#1E1434', '#2A1B44', '#3A2652', '#4E3260', '#66406A'];
  var lights = [], sunTop = null, lc = null, lg = null, map = null, cache = {};

  function reducedNow() { return P.reduced(); }
  /* a sheet that lands after a chunk baked magenta drops the chunk cache, so the next frame rebakes with art */
  function sheet(k) {
    var sh = NEU.dgSheets && NEU.dgSheets[k], im;
    if (!sh || !NEU.sheetReady) return null;
    im = NEU.sheetImg(sh.src);
    if (!im.__dg && im.addEventListener) { im.__dg = 1; im.addEventListener('load', function () { P.dropChunks(); }); }
    return NEU.sheetReady(sh);
  }
  function mag(c, x, y, w, h) { c.fillStyle = MAG; c.fillRect(x | 0, y | 0, w, h); c.fillStyle = MAGD; c.fillRect(x | 0, (y | 0) + h - 1, w, 1); c.fillRect((x | 0) + w - 1, y | 0, 1, h); }
  /* blit one frame (fx, fy in pixels) or the magenta box of the same size */
  function cut(c, k, fx, fy, w, h, x, y, flip) {
    var im = sheet(k);
    if (!im) { mag(c, x, y, w, h); return false; }
    if (flip) { c.save(); c.translate((x | 0) + w, y | 0); c.scale(-1, 1); c.drawImage(im, fx, fy, w, h, 0, 0, w, h); c.restore(); }
    else c.drawImage(im, fx, fy, w, h, x | 0, y | 0, w, h);
    return true;
  }
  function frame(idx, x, y) { var f = FR[idx], v = (P.hash(x, y, 7) * 3) | 0; return [f[0] + f[2] * v, f[1] + f[3] * v]; }
  function nb(L, x, y, same) {
    return (same(L.grid[y - 1] ? L.grid[y - 1].charAt(x) : '#') ? 1 : 0) | (same((L.grid[y] || '').charAt(x - 1)) ? 2 : 0) |
      (same((L.grid[y] || '').charAt(x + 1)) ? 4 : 0) | (same(L.grid[y + 1] ? L.grid[y + 1].charAt(x) : '#') ? 8 : 0);
  }
  function isBrick(ch) { return ch === '#' || ch === ''; }
  function isGrass(ch) { return ch === 'g' || ch === '#' || ch === ''; }
  function isSpike(ch) { return ch === '^' || ch === 'v' || ch === '<' || ch === '>'; }
  function hasWall(L, x, y) { var ch = (L.grid[y] || '').charAt(x); return !!ch && ch !== ' ' && ch !== 'g'; }

  /* ── the chunk painter ─────────────────────────────────────────────── */
  function paintChunk(g, L, x0, y0, w, h) {
    var x, y, ch, f, idx, k, i, d;
    for (y = y0 - 1; y <= y0 + h; y++) for (x = x0 - 1; x <= x0 + w; x++) {
      if (!hasWall(L, x, y)) continue;
      idx = (hasWall(L, x, y - 1) ? 1 : 0) | (hasWall(L, x - 1, y) ? 2 : 0) | (hasWall(L, x + 1, y) ? 4 : 0) | (hasWall(L, x, y + 1) ? 8 : 0);
      if (idx === 15) idx += CW[x % 3][y % 3];
      f = frame(idx, x, y); k = WALLK[L.faction(x, y)];
      if (sheet(k)) g.drawImage(sheet(k), f[0] * 36, f[1] * 36, 32, 32, x * T - 8, y * T - 8, 32, 32);
      else if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) { g.fillStyle = '#3A003A'; g.fillRect(x * T, y * T, T, T); g.fillStyle = '#7A007A'; g.fillRect(x * T, y * T, T, 1); g.fillRect(x * T, y * T, 1, T); }
    }
    /* back walls sit a step darker than blocks, as in Terraria, so a corridor reads against the brick */
    g.fillStyle = 'rgba(5,3,10,0.5)';
    for (y = y0; y < y0 + h; y++) for (x = x0; x < x0 + w; x++) if (hasWall(L, x, y) && !P.solid(x, y)) g.fillRect(x * T, y * T, T, T);
    for (y = y0; y < y0 + h; y++) for (x = x0; x < x0 + w; x++) {
      ch = (L.grid[y] || '').charAt(x);
      if (ch === '#') { f = frame(nb(L, x, y, isBrick), x, y); cut(g, BRICK[L.faction(x, y)], f[0] * 18, f[1] * 18, T, T, x * T, y * T); }
      else if (ch === 'g') { f = frame(nb(L, x, y, isGrass), x, y); cut(g, 'dgGrass', f[0] * 18, f[1] * 18, T, T, x * T, y * T); }
      else if (isSpike(ch)) { f = frame(nb(L, x, y, isSpike), x, y); cut(g, 'dgSpike', f[0] * 18, f[1] * 18, T, T, x * T, y * T); }
      else if (ch === '=') { cut(g, 'dgShelf', shelfX(L, x, y) * 18, SHELF[L.faction(x, y)] * 18, T, T, x * T, y * T); }
    }
    for (i = 0; i < L.decor.length; i++) {
      d = L.decor[i];
      if (d.x < x0 - 3 || d.x > x0 + w + 1 || d.y < y0 - 1 || d.y > y0 + h + 4) continue;
      paintDecor(g, L, d);
    }
    return true;
  }
  /* Tiles_19 frame by neighbours: 0 run, 1 right end, 2 left end, 3 left on a block, 4 right on a block, 5 alone */
  function shelfX(L, x, y) {
    var row = L.grid[y] || '', l = row.charAt(x - 1), r = row.charAt(x + 1);
    if (l === '=' && r === '=') return 0;
    if (l === '=') return r === '#' ? 4 : 1;
    if (r === '=') return l === '#' ? 3 : 2;
    return 5;
  }
  function decorAt(L, x, y) { var i; for (i = 0; i < L.decor.length; i++) if (L.decor[i].x === x && L.decor[i].y === y) return L.decor[i].k; return ''; }
  function paintDecor(g, L, d) {
    var x = d.x * T, y = d.y * T, s, i, up, dn, f;
    if (d.k === 'c') {
      up = decorAt(L, d.x, d.y - 1) === 'c' || P.solid(d.x, d.y - 1); dn = /[cL]/.test(decorAt(L, d.x, d.y + 1) || '.');
      f = frame((up ? 1 : 0) | (dn ? 8 : 0), d.x, d.y); cut(g, 'dgChain', f[0] * 18, f[1] * 18, T, T, x, y);
    } else if (d.k === 'L') { cut(g, 'dgLantern', 0, 0, T, T, x, y); cut(g, 'dgLantern', 0, 18, T, T, x, y + T); }
    else if (d.k === 'w') cut(g, 'dgCandle', 0, 0, T, 20, x, y - 4);
    else if (d.k === 'b') {
      s = BANNER[d.f] + ((P.hash(d.x, d.y, 3) * 2) | 0);
      for (i = 0; i < 3; i++) cut(g, 'dgBanner', (s % 111) * 18, ((s / 111) | 0) * 54 + i * 18, T, T, x, y + i * T);
    } else if (d.k === 'B') {
      s = BOOKS[d.f];
      for (i = 0; i < 12; i++) cut(g, 'dgBooks', s * 54 + (i % 3) * 18, ((i / 3) | 0) * 18, T, T, x + (i % 3) * T, y - 3 * T + ((i / 3) | 0) * T);
    }
  }
  P.painters.push(function (g, L, x0, y0, w, h) { if (!L || L.tileset !== 'dungeon' || x0 === undefined) return false; return paintChunk(g, L, x0, y0, w, h); });

  /* ── sky, flames ──────────────────────────────────────────────────── */
  function layer(name, fn) { return cache[name] || (cache[name] = fn()); }
  function ridge(name, col, base, amp, seed, trees) {
    return layer(name, function () {
      var cv = P.mk(640, 200), g = cv.getContext('2d'), x, top, k, hh;
      g.imageSmoothingEnabled = false; g.fillStyle = col;
      for (x = 0; x < 640; x += 2) {
        top = base - Math.round((Math.sin(x / 640 * Math.PI * 2 * 2 + seed) * 0.5 + 0.5) * amp + P.hash(x >> 4, 0, seed) * 6);
        g.fillRect(x, top, 2, 200 - top);
      }
      if (trees) for (k = 0; k < 40; k++) {
        x = (k * 16 + ((P.hash(k, 1, seed) * 10) | 0)) % 640; hh = 18 + ((P.hash(k, 2, seed) * 22) | 0);
        for (top = 0; top < hh; top += 2) g.fillRect(x + 4 - ((top / hh * 5) | 0), base - 8 - hh + top, 2 + ((top / hh * 10) | 0), 2);
      }
      return cv;
    });
  }
  function backdrop(c, cx, cy, L, now, a) {
    var hz = 15 * T - cy, k, x, w = 640, layers = [['far', '#1A1230', 150, 40, 1, 0.2, 0], ['near', '#0B0716', 170, 24, 3, 0.5, 1]], q, cv;
    c.fillStyle = '#05030A'; c.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    if (hz <= a.y0) return;
    for (k = 0; k < SKY.length; k++) { c.fillStyle = SKY[k]; c.fillRect(a.x0, Math.floor(a.y0 + k * (hz - a.y0) / SKY.length), a.x1 - a.x0, Math.ceil((hz - a.y0) / SKY.length) + 1); }
    P.ell(c, 0, 0, (a.x1 - 120 - cx * 0.05) | 0, (Math.max(a.y0 + 40, hz - 150)) | 0, 9, 9, '#E8E0F4'); P.ell(c, 0, 0, (a.x1 - 116 - cx * 0.05) | 0, (Math.max(a.y0 + 40, hz - 150) - 2) | 0, 7, 7, '#1E1434');
    for (k = 0; k < 14; k++) P.fr(c, ((P.hash(k, 0, 9) * 900 - cx * 0.02) % (a.x1 - a.x0)) + a.x0 | 0, (a.y0 + P.hash(k, 1, 9) * Math.max(10, hz - a.y0 - 60)) | 0, 1, 1, k & 1 ? '#B8A8D8' : '#6A5A8A');
    for (q = 0; q < layers.length; q++) {
      cv = ridge(layers[q][0], layers[q][1], layers[q][2], layers[q][3], layers[q][4], layers[q][6]);
      x = -P.mod(cx * layers[q][5], w) + Math.floor(a.x0 / w) * w - w;
      for (; x < a.x1; x += w) c.drawImage(cv, x | 0, (hz - 200 + 8) | 0);
    }
  }
  /* water candles burn blue, chain lanterns amber; the flame steps at 2-3 Hz so nothing strobes */
  function live(c, cx, cy, L, now, a) {
    var i, d, sx, sy, f = reducedNow() ? 0 : ((now / 380) | 0);
    for (i = 0; i < L.decor.length; i++) {
      d = L.decor[i]; if (d.k !== 'w' && d.k !== 'L') continue;
      sx = d.x * T - cx; sy = d.y * T - cy;
      if (sx < a.x0 - 32 || sx > a.x1 + 32 || sy < a.y0 - 48 || sy > a.y1 + 32) continue;
      if (d.k === 'w') { P.glow(c, sx + 8, sy - 2, 22, '#7AA8FF', 0.16); P.fr(c, sx + 7, sy - 4 - ((f + d.x) & 1), 2, 3, '#BFD8FF'); P.fr(c, sx + 7, sy - 2, 2, 1, '#4A78E0'); }
      else P.glow(c, sx + 8, sy + 18, 34, '#F8A030', 0.14);
    }
  }

  /* ── the light map: Terraria's four sweeps over the view + a 4-tile margin ── */
  var AIR = 0.91, SOLID = 0.55, LEVELS = 6;
  function sun(L) {
    var x, y;
    if (sunTop && sunTop.id === L.id) return sunTop;
    sunTop = { id: L.id, top: [] };
    for (x = 0; x < L.w; x++) { for (y = 0; y < L.h && (L.grid[y].charAt(x) === ' '); y++); sunTop.top.push(y); }
    return sunTop;
  }
  function light(L, cx, cy, vw, vh) {
    var tx0 = Math.floor(cx / T) - 4, ty0 = Math.floor(cy / T) - 4, cols = Math.ceil(vw / T) + 9, rows = Math.ceil(vh / T) + 9;
    var n = cols * rows, M = map && map.n === n ? map.L : new Float32Array(n), D = map && map.n === n ? map.D : new Float32Array(n);
    var x, y, i, l, top = sun(L).top, s, tx, ty;
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      i = y * cols + x; tx = tx0 + x; ty = ty0 + y;
      D[i] = P.solid(tx, ty) ? SOLID : AIR;
      M[i] = (tx >= 0 && tx < L.w && ty < (top[tx] === undefined ? 0 : top[tx])) ? 1 : 0;
    }
    lights.length = 0;
    for (i = 0; i < L.decor.length; i++) { s = L.decor[i]; if (s.k === 'w') lights.push(s.x, s.y, 0.8); else if (s.k === 'L') lights.push(s.x, s.y + 1, 1); }
    if (L.lights) L.lights(lights);
    for (i = 0; i < lights.length; i += 3) {
      x = Math.floor(lights[i]) - tx0; y = Math.floor(lights[i + 1]) - ty0;
      if (x >= 0 && y >= 0 && x < cols && y < rows && M[y * cols + x] < lights[i + 2]) M[y * cols + x] = lights[i + 2];
    }
    for (y = 0; y < rows; y++) {
      for (l = 0, x = 0; x < cols; x++) { i = y * cols + x; l = Math.max(l * D[i], M[i]); M[i] = l; }
      for (l = 0, x = cols - 1; x >= 0; x--) { i = y * cols + x; l = Math.max(l * D[i], M[i]); M[i] = l; }
    }
    for (x = 0; x < cols; x++) {
      for (l = 0, y = 0; y < rows; y++) { i = y * cols + x; l = Math.max(l * D[i], M[i]); M[i] = l; }
      for (l = 0, y = rows - 1; y >= 0; y--) { i = y * cols + x; l = Math.max(l * D[i], M[i]); M[i] = l; }
    }
    map = { n: n, L: M, D: D, tx0: tx0, ty0: ty0, cols: cols, rows: rows };
    return map;
  }
  function lightAt(m, x, y) { x = Math.max(0, Math.min(m.cols - 1, x)); y = Math.max(0, Math.min(m.rows - 1, y)); return m.L[y * m.cols + x]; }
  /* half-tile cells, six steps, unlit is black: one ImageData pixel per cell, scaled x8 with no smoothing */
  function shade(c, L, cx, cy, a) {
    var m = light(L, cx, cy, a.x1 - a.x0, a.y1 - a.y0), W2 = m.cols * 2, H2 = m.rows * 2, img, d, x, y, v, tx, ty, ox, oy, q;
    if (!lc || lc.width !== W2 || lc.height !== H2) { lc = P.mk(W2, H2); lg = lc.getContext && lc.getContext('2d'); }
    if (!lg || !lg.createImageData) return;
    img = lg.createImageData(W2, H2); d = img.data;
    for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) {
      tx = x >> 1; ty = y >> 1; ox = (x & 1) ? 1 : -1; oy = (y & 1) ? 1 : -1;
      v = lightAt(m, tx, ty) * 0.5625 + (lightAt(m, tx + ox, ty) + lightAt(m, tx, ty + oy)) * 0.1875 + lightAt(m, tx + ox, ty + oy) * 0.0625;
      q = Math.min(LEVELS - 1, Math.floor(v * LEVELS));
      d[(y * W2 + x) * 4 + 3] = Math.round((LEVELS - 1 - q) / (LEVELS - 1) * 255);
    }
    lg.putImageData(img, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(lc, m.tx0 * T - cx, m.ty0 * T - cy, W2 * 8, H2 * 8);
  }
  function foreground(c, cx, cy, L, now, a) { shade(c, L, cx, cy, a); }

  /* ── HUD: hearts top-right (kit HP), a TP star column under them, the depth line ─ */
  var HEART = ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
  var STAR = ['...k...', '..kyk..', 'kkkyykk', 'kyyyyyk', '.kyyyk.', 'kyk.kyk', 'k.....k'];
  function heartSpr(on) { return P.spr('dh' + on, 7, 7, function (R) { P.rows(R, HEART, on ? { k: INK, r: '#E8304A', w: '#FFC8D0' } : { k: INK, r: '#3A2030', w: '#4A2A3A' }, 0, 0); }); }
  function starSpr(on) { return P.spr('ds' + on, 7, 7, function (R) { P.rows(R, STAR, on ? { k: INK, y: '#5AB8FF' } : { k: INK, y: '#1A2A48' }, 0, 0); }); }
  function hud(c, L, view, now, a) {
    var s = P.state, i, x, y = a.y0 + 12, tp = L.tp ? L.tp() : 0, n, depth, z;
    if (!s) return;
    for (i = 0; i < (L.hp || 6); i++) { x = a.x1 - 20 - (L.hp - 1 - i) * 16; c.drawImage(heartSpr(i < s.hp).cv, 0, 0, 7, 7, x, y, 14, 14); }
    n = Math.round(tp * 5);
    for (i = 0; i < 5; i++) c.drawImage(starSpr(i < n).cv, 0, 0, 7, 7, a.x1 - 20, y + 22 + i * 16, 14, 14);
    z = L.zoneAt(s.x, s.y - 11); depth = Math.round((s.y / T - 15) * 2);
    c.font = FONT; c.textBaseline = 'top'; c.textAlign = 'left';
    c.fillStyle = INK; c.fillText(depth > 0 ? depth + "' underground" : 'surface', a.x0 + 14, y + 2);
    c.fillStyle = '#E8DCC8'; c.fillText(depth > 0 ? depth + "' underground" : 'surface', a.x0 + 12, y);
    if (z) { c.fillStyle = '#8A7A9A'; c.fillText(z.id, a.x0 + 12, y + 18); }
  }

  function chainHook(name, fn) {
    var prev = P[name];
    P[name] = function (c, cx, cy, L, now, a) {
      if (L && L.tileset === 'dungeon') return fn(c, cx, cy, L, now, a);
      if (prev) return prev(c, cx, cy, L, now, a);
    };
  }
  chainHook('backdrop', backdrop); chainHook('live', live); chainHook('foreground', foreground);
  var prevHud = P.hud;
  P.hud = function (c, L, view, now, a) { if (L && L.tileset === 'dungeon') return hud(c, L, view, now, a); if (prevHud) prevHud(c, L, view, now, a); };
  var prevSkin = P.skin;
  P.skin = function (L) {
    if (L && L.tileset === 'dungeon') return { key: 'dgn', ink: INK, deep: '#0B1024', base: '#2B3A67', light: '#3E5490', rim: '#6A82C4' };
    return prevSkin ? prevSkin(L) : null;
  };

  /* ── entity looks: sheet props, story props ───────────────────────── */
  function arch(R, x, y, w, h, col) { R(x + 2, y, w - 4, 1, col); R(x + 1, y + 1, w - 2, 1, col); R(x, y + 2, w, h - 2, col); }
  function mageSpr() {
    return P.spr('dmage', 32, 48, function (R) {
      var k, rx = [2, 2, 2, 29, 29, 29], ry = [12, 22, 32, 12, 22, 32];
      arch(R, 0, 0, 32, 48, INK); arch(R, 1, 1, 30, 47, '#4B2A78');
      R(1, 6, 3, 41, '#7A52B8'); R(28, 6, 3, 41, '#2A1640'); R(13, 0, 6, 3, '#7A52B8'); R(14, 3, 4, 1, '#2A1640');
      arch(R, 5, 5, 22, 43, INK); arch(R, 6, 6, 20, 42, '#1E1030');
      R(9, 10, 2, 38, '#8A8598'); R(15, 10, 2, 38, '#8A8598'); R(21, 10, 2, 38, '#8A8598');
      R(9, 10, 1, 38, '#C8C4D0'); R(15, 10, 1, 38, '#C8C4D0'); R(21, 10, 1, 38, '#C8C4D0');
      R(5, 22, 22, 2, '#4A4658'); R(5, 36, 22, 2, '#4A4658'); R(0, 45, 32, 3, INK); R(1, 45, 30, 2, '#2A1640');
      for (k = 0; k < 6; k++) R(rx[k], ry[k], 1, 2, '#4B2A78');
    });
  }
  function bossSpr() {
    return P.spr('dboss', 32, 48, function (R, g) {
      arch(R, 0, 0, 32, 48, INK); arch(R, 1, 1, 30, 47, '#4A3E30');
      R(1, 6, 3, 41, '#C4A882'); R(1, 6, 1, 41, '#E8D2B0'); R(28, 6, 3, 41, '#8A7456'); R(30, 6, 1, 41, '#C4A882');
      P.ell(g, 0, 0, 16, 12, 9, 8, INK); P.ell(g, 0, 0, 16, 12, 8, 7, '#C4A882'); P.ell(g, 0, 0, 15, 11, 6, 5, '#E8D2B0');
      R(10, 11, 4, 4, '#1A120C'); R(18, 11, 4, 4, '#1A120C'); R(15, 16, 2, 3, '#1A120C');
      R(11, 20, 10, 3, INK); R(12, 20, 8, 2, '#F4E4CC'); R(14, 20, 1, 2, INK); R(17, 20, 1, 2, INK);
      arch(R, 6, 27, 20, 21, '#2A241C'); R(6, 33, 20, 2, '#C4A882'); R(6, 41, 20, 2, '#C4A882');
      R(13, 35, 6, 7, '#C8A040'); R(13, 35, 6, 1, '#FFE080'); R(15, 37, 2, 3, INK); R(0, 45, 32, 3, INK); R(1, 45, 30, 2, '#4A3E30');
    });
  }
  /* gilt frame, a mountain inside: the one prop that opens the cart */
  function paintingSpr() {
    return P.spr('dpaint', 16, 16, function (R) {
      R(0, 0, 16, 16, '#8A6820'); R(1, 1, 14, 14, '#E8C85A'); R(2, 2, 12, 12, '#6A5018'); R(3, 3, 10, 10, '#F4E0A0');
      R(4, 4, 8, 8, '#7EB0D8'); R(4, 9, 8, 3, '#3A6A40'); R(6, 6, 4, 5, '#5A7A68'); R(7, 5, 2, 2, '#E8EEF2');
      R(1, 1, 2, 2, '#FFF4C8'); R(13, 1, 2, 2, '#FFF4C8'); R(1, 13, 2, 2, '#FFF4C8'); R(13, 13, 2, 2, '#FFF4C8');
    });
  }
  function kd(name) { return kinds[name] || (kinds[name] = {}); }
  function inDungeon() { var L = P.level0(); return !!L && L.tileset === 'dungeon'; }
  kd('sign').draw = function (c, x, y) { cut(c, 'dgSign', 0, 0, 32, 32, x - 8, y - 16); };
  kd('keeper').draw = function (c, x, y) { cut(c, 'dgKeeper', 0, 0, 40, 56, x - 12, y + 16 - 56); };
  kd('pot').draw = function (c, x, y, e) { var v = (P.hash(e.x, e.y, 5) * 3) | 0; cut(c, 'dgPot', v * 36, 10 * 36, 32, 32, x, y - 16); };
  kd('painting').draw = function (c, x, y) { var s = paintingSpr(); c.drawImage(s.cv, x, y); };
  kd('magegate').draw = function (c, x, y, e, now) {
    var s = mageSpr(), gx = x - 8, gy = y - 32, k = reducedNow() ? 0 : ((now / 600) | 0) % 6;
    c.drawImage(s.cv, gx, gy);
    P.fr(c, gx + [2, 2, 2, 29, 29, 29][k], gy + [12, 22, 32, 12, 22, 32][k], 1, 2, '#B892FF');
    P.glow(c, gx + 16, gy + 24, 28, '#7A52B8', 0.10);
  };
  kd('bossdoor').draw = function (c, x, y) {
    var s = bossSpr(), gx = x - 8, gy = y - 32, has = !!(NEU.save && NEU.save.has && NEU.save.has('boss_key'));
    c.drawImage(s.cv, gx, gy);
    P.fr(c, gx + 11, gy + 12, 2, 2, has ? '#FF8AC8' : '#3A2A20'); P.fr(c, gx + 19, gy + 12, 2, 2, has ? '#FF8AC8' : '#3A2A20');
  };
  /* a lift: a dungeon shelf on a chain that runs up out of sight */
  kd('lift').draw = function (c, x, y, e) {
    var i, on = e.top ? !!(NEU.save && NEU.save.flagged && NEU.save.flagged('dgn_lift_' + e.n)) : true;
    for (i = 1; i <= 4; i++) cut(c, 'dgChain', 5 * 18, 0, T, T, x, y - i * T);
    cut(c, 'dgShelf', 5 * 18, 6 * 18, T, T, x, y + 12);
    if (!on) { c.globalAlpha = 0.5; P.fr(c, x, y - 64, 16, 80, '#05030A'); c.globalAlpha = 1; }
  };
  kd('leave').draw = function () {};
  var crumbleDraw = kd('crumble').draw;
  kd('crumble').draw = function (c, x, y, e, now) {
    var L = P.level0(), f, j;
    if (!inDungeon()) { if (crumbleDraw) crumbleDraw(c, x, y, e, now); else P.ent('crumble', c, x, y, e, now); return; }
    j = P.fallOf(e); if (j < 0) return;
    f = frame((e.x > 0 && /k/.test(L.cracks[(e.y | 0) + ',' + ((e.x | 0) - 1)] || '') ? 2 : 0) | (/k/.test(L.cracks[(e.y | 0) + ',' + ((e.x | 0) + 1)] || '') ? 4 : 0), e.x | 0, e.y | 0);
    cut(c, CRACK[L.faction(e.x | 0, e.y | 0)], f[0] * 18, f[1] * 18, T, T, x + (e.cs === 1 && !reducedNow() ? ((((now / 40) | 0) & 1) ? 1 : -1) : 0), y + j);
  };

  NEU.dungeonLook = {
    tileset: 'dungeon', frames: FR, centre: CW, frame: frame, sheet: sheet, cut: cut, mag: mag,
    light: light, lightMap: function () { return map; }, levels: LEVELS, air: AIR, solid: SOLID
  };
})();
