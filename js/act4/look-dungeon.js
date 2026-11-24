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
  var lights = [], sunTop = null, lc = null, lg = null, limg = null, map = null, cache = {};

  function reducedNow() { return P.reduced(); }
  /* Some externally prepared PNGs have an opaque black matte instead of
     transparent pixels. Clean only NPC and effect sheets, only when a
     frame's border is predominantly opaque black. Flood filling from the
     border preserves isolated black outlines/eyes inside the silhouette.
     Tiles and background walls are never keyed: black belongs in those. */
  var cleaned = {};
  function isActorSheet(k) {
    return /^dg(?:Keeper|Skull|Bones|BoneLee|Paladin|Sniper|Tactic|Commando|Necro|Ragged|Diabol|Warlock|Phantom|Spirit|Ball|Wheel|Hammer|Link|Fx)/.test(k);
  }
  function cleanMatte(im, sh) {
    var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    var fw = sh.fw || w, fh = sh.fh || h;
    if (!w || !h || fw > w || fh > h) return im;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var g = cv.getContext && cv.getContext('2d');
    if (!g || !g.drawImage || !g.getImageData || !g.putImageData) return im;
    try {
      g.drawImage(im, 0, 0);
      var id = g.getImageData(0, 0, w, h), d = id.data, changed = false;
      if (!d || d.length !== w * h * 4) return im;
      var cols = Math.floor(w / fw), rows = Math.floor(h / fh), col, row, x0, y0, x, y, n, dark, pos, q, seen, head, v;
      function black(px) {
        var j = px * 4;
        return d[j + 3] >= 250 && d[j] <= 12 && d[j + 1] <= 12 && d[j + 2] <= 12;
      }
      for (row = 0; row < rows; row++) for (col = 0; col < cols; col++) {
        x0 = col * fw; y0 = row * fh; n = 0; dark = 0;
        for (x = 0; x < fw; x++) {
          n += 2;
          if (black(y0 * w + x0 + x)) dark++;
          if (black((y0 + fh - 1) * w + x0 + x)) dark++;
        }
        for (y = 1; y < fh - 1; y++) {
          n += 2;
          if (black((y0 + y) * w + x0)) dark++;
          if (black((y0 + y) * w + x0 + fw - 1)) dark++;
        }
        if (!n || dark / n < 0.80) continue;
        q = []; seen = new Uint8Array(fw * fh); head = 0;
        function push(xx, yy) {
          if (xx < 0 || yy < 0 || xx >= fw || yy >= fh) return;
          var p = yy * fw + xx;
          if (seen[p] || !black((y0 + yy) * w + x0 + xx)) return;
          seen[p] = 1; q.push(p);
        }
        for (x = 0; x < fw; x++) { push(x, 0); push(x, fh - 1); }
        for (y = 1; y < fh - 1; y++) { push(0, y); push(fw - 1, y); }
        while (head < q.length) {
          v = q[head++]; x = v % fw; y = (v / fw) | 0;
          pos = ((y0 + y) * w + x0 + x) * 4;
          d[pos] = d[pos + 1] = d[pos + 2] = d[pos + 3] = 0;
          push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
        }
        if (q.length) changed = true;
      }
      if (changed) { g.putImageData(id, 0, 0); return cv; }
    } catch (e) { /* cross-origin or unsupported canvas: use original PNG */ }
    return im;
  }
  /* A sheet loaded after its chunk was baked invalidates that chunk. */
  function sheet(k) {
    var sh = NEU.dgSheets && NEU.dgSheets[k], im;
    if (!sh || !NEU.sheetReady) return null;
    im = NEU.sheetImg(sh.src);
    if (!im.__dg && im.addEventListener) { im.__dg = 1; im.addEventListener('load', function () { P.dropChunks(); }); }
    im = NEU.sheetReady(sh);
    if (!im || !isActorSheet(k)) return im;
    if (!cleaned[sh.src] || cleaned[sh.src].original !== im) {
      cleaned[sh.src] = { original: im, result: cleanMatte(im, sh) };
    }
    return cleaned[sh.src].result;
  }
  function mag(c, x, y, w, h) { c.fillStyle = MAG; c.fillRect(x | 0, y | 0, w, h); c.fillStyle = MAGD; c.fillRect(x | 0, (y | 0) + h - 1, w, 1); c.fillRect((x | 0) + w - 1, y | 0, 1, h); }
  /* Source frame in pixels; flip and rotation share the exact frame centre.
     Never sample outside an atlas or interpolate pixel art. */
  function cut(c, k, fx, fy, w, h, x, y, flip, rot) {
    var im = sheet(k), iw = im && (im.naturalWidth || im.width), ih = im && (im.naturalHeight || im.height);
    if (!im || fx < 0 || fy < 0 || fx + w > iw || fy + h > ih) { mag(c, x, y, w, h); return false; }
    c.save();
    c.imageSmoothingEnabled = false;
    if (rot) {
      c.translate(Math.round(x + w / 2), Math.round(y + h / 2));
      c.rotate(rot);
      if (flip) c.scale(-1, 1);
      c.drawImage(im, fx, fy, w, h, -w / 2, -h / 2, w, h);
    } else if (flip) {
      c.translate(Math.round(x) + w, Math.round(y));
      c.scale(-1, 1);
      c.drawImage(im, fx, fy, w, h, 0, 0, w, h);
    } else c.drawImage(im, fx, fy, w, h, Math.round(x), Math.round(y), w, h);
    c.restore();
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
    var x, y, ch, f, idx, k, i, d, rr;
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
    /* VOID MASS (WO-DGN): stepped rock tones over the back wall, with sparse roots,
       bones and fossils. ' ' cells are true shafts and stay black. Baked once, so
       the detail is deterministic (P.hash) and costs nothing per frame. */
    for (y = y0; y < y0 + h; y++) for (x = x0; x < x0 + w; x++) {
      ch = (L.grid[y] || '').charAt(x);
      if (!ch || ch === ' ' || ch === 'g') continue;
      rr = P.hash(x, y, 31);
      g.fillStyle = rr < 0.34 ? 'rgba(10,8,22,0.34)' : rr < 0.67 ? 'rgba(16,12,30,0.28)' : 'rgba(24,18,40,0.22)';
      g.fillRect(x * T, y * T, T, T);
      if (rr > 0.972) { /* a small fossil: three pale vertebrae in the brick */
        g.fillStyle = '#3E3850';
        g.fillRect(x * T + 3, y * T + 7, 3, 2); g.fillRect(x * T + 7, y * T + 8, 3, 2); g.fillRect(x * T + 11, y * T + 7, 2, 2);
      } else if (rr < 0.02) { /* a dangling root from the ceiling of the cell */
        g.fillStyle = '#2A2234';
        g.fillRect(x * T + 5, y * T, 1, 5); g.fillRect(x * T + 6, y * T + 4, 1, 3); g.fillRect(x * T + 9, y * T, 1, 3);
      } else if (rr > 0.94) { /* a bone crossing the cell */
        g.fillStyle = '#322E3E';
        g.fillRect(x * T + 2, y * T + 11, 10, 1); g.fillRect(x * T + 2, y * T + 9, 2, 3); g.fillRect(x * T + 11, y * T + 10, 2, 3);
      }
    }
    paintDress(g, L, x0, y0, w, h);
    for (y = y0; y < y0 + h; y++) for (x = x0; x < x0 + w; x++) {
      ch = (L.grid[y] || '').charAt(x);
      if (ch === '#') { f = frame(nb(L, x, y, isBrick), x, y); cut(g, BRICK[L.faction(x, y)], f[0] * 18, f[1] * 18, T, T, x * T, y * T); }
      else if (ch === 'g') { f = frame(nb(L, x, y, isGrass), x, y); cut(g, 'dgGrass', f[0] * 18, f[1] * 18, T, T, x * T, y * T); }
      else if (isSpike(ch)) {
        /* Each glyph is the direction of the teeth: only like glyphs join, and the tile turns to face its way. */
        f = frame(nb(L, x, y, function (other) { return other === ch; }), x, y);
        cut(g, 'dgSpike', f[0] * 18, f[1] * 18, T, T, x * T, y * T, false,
            ch === 'v' ? Math.PI : ch === '<' ? -Math.PI / 2 : ch === '>' ? Math.PI / 2 : 0);
        /* R18: a bright rim keeps spikes >=3:1 against even the lightest brick.
           Damage knockback is away from the spike tile and hurt() grants
           0.67 s i-frames, so a hit never chains into an adjacent spike. */
        g.fillStyle = '#FFE0E8';
        if (ch === '^') g.fillRect(x * T + 2, y * T + 2, 12, 1);
        else if (ch === 'v') g.fillRect(x * T + 2, y * T + T - 3, 12, 1);
        else if (ch === '<') g.fillRect(x * T + 2, y * T + 2, 1, 12);
        else g.fillRect(x * T + T - 3, y * T + 2, 1, 12);
      }
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

  /* ── DGN-02 set dressing, baked into the chunk. Back-wall values stay between the brick (INK) and the lit shelf cap. ── */
  function rc(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); }
  function near(d, x0, y0, w, h, mx, my) { return d.x + mx >= x0 && d.x - mx <= x0 + w && d.y + my >= y0 && d.y - my <= y0 + h; }
  /* masonry course: rows[0] is the bottom row, each one fainter; mortar offsets by row so it reads as laid brick */
  function course(g, L, x0, y0, w, h, cx, cy, cw, alphas, any) {   /* any: paint open air too (the chamber has no back wall) */
    var i, x, y, a, off;
    for (i = 0; i < alphas.length; i++) {
      y = cy - i; if (y < y0 || y >= y0 + h) continue;
      for (x = Math.max(cx, x0); x < Math.min(cx + cw, x0 + w); x++) {
        if (P.solid(x, y) || !any && !hasWall(L, x, y)) continue;
        a = alphas[i]; off = ((x + i) & 1) ? 8 : 0;
        g.globalAlpha = a; rc(g, x * T, y * T, T, T, '#221836');
        rc(g, x * T, y * T, T, 1, '#34264E'); rc(g, x * T, y * T + T - 1, T, 1, '#0E0818'); rc(g, x * T + off, y * T, 1, T, '#0E0818');
        if (P.hash(x, y, 57) > 0.7) rc(g, x * T + 3 + off, y * T + 5, 4, 2, '#2C2044');
        g.globalAlpha = 1;
      }
    }
  }
  /* a pier with a rib springing toward the door and breaking off: a thick violet rib with a lit upper edge and rubble at its foot. Ribs stay thin shapes and never run horizontal, so they cannot pass for a shelf. d.r is the arc radius (44 by default) */
  function ribPier(g, d) {
    var cxp = Math.round((d.x + 0.5) * T), floor = (d.y + 1) * T, top = floor - d.h * T, r = d.r || 44, i, th, ax, ay, lit = d.d > 0 ? cxp + 2 : cxp - 5, dk = d.d > 0 ? cxp - 8 : cxp + 5;
    rc(g, cxp - 8, top, 16, floor - top, '#3A2C5C');
    rc(g, lit, top, 3, floor - top, '#9A84D0'); rc(g, dk, top, 3, floor - top, '#120A20');
    rc(g, cxp - 2, top + 5, 1, floor - top - 12, '#1A1030'); rc(g, cxp + 2, top + 5, 1, floor - top - 12, '#1A1030');
    rc(g, cxp - 11, top - 4, 22, 5, '#4E3E80'); rc(g, cxp - 11, top - 4, 22, 1, '#A894E0');
    rc(g, cxp - 12, floor - 8, 24, 8, '#4E3E80'); rc(g, cxp - 12, floor - 8, 24, 1, '#A894E0');
    for (i = 0; i <= 30; i++) {
      th = d.b * i / 30; ax = cxp + d.d * (r - Math.round(r * Math.cos(th))); ay = top - 4 - Math.round(r * Math.sin(th));
      rc(g, ax - 3, ay - 3, 7, 7, '#6E5CA8'); rc(g, ax - 3, ay - 3, 7, 2, '#B0A0E0'); rc(g, ax - 3, ay + 3, 7, 1, '#1A1030');
    }
    rc(g, cxp + d.d * 14 - 3, floor - 5, 6, 5, '#4A3A76'); rc(g, cxp + d.d * 14 - 3, floor - 5, 6, 1, '#8A74C0');
    rc(g, cxp + d.d * 22 - 2, floor - 3, 4, 3, '#3E2E62'); rc(g, cxp + d.d * 28 - 1, floor - 2, 3, 2, '#3E2E62');
  }
  /* the door gap's jambs and sill: a lit edge on the stone either side and a worn threshold, so the opening reads as a doorway even with the slab raised */
  function jamb(g, d) {
    var x0 = d.x * T, x1 = (d.x + d.w) * T, y0 = d.y * T, y1 = (d.y + d.h) * T;
    rc(g, x0, y0, 3, y1 - y0, '#0E0818'); rc(g, x0 + 3, y0, 1, y1 - y0, '#5A4482');
    rc(g, x1 - 3, y0, 3, y1 - y0, '#0E0818'); rc(g, x1 - 4, y0, 1, y1 - y0, '#3A2A56');
    rc(g, x0, y0, x1 - x0, 3, '#0E0818'); rc(g, x0 + 3, y0 + 3, x1 - x0 - 6, 1, '#34264E');
    rc(g, x0, y1 - 2, x1 - x0, 2, '#5A4482');
  }
  /* mineral crust at the old water top (its upper half stays in the air gap while the hall is full), scalloped deposits and drips below it, and the trail down to the sluice lever */
  function tide(g, d) {
    var y = d.y * T, x = d.x * T, w = d.w * T, i, r;
    for (i = 0; i < w; i += 2) {
      r = P.hash(i, d.y, 41);
      g.globalAlpha = 0.95; rc(g, x + i, y - 3 - ((r * 3) | 0), 2, 3 + ((r * 3) | 0), '#C4EEE4'); rc(g, x + i, y, 2, 2, '#9AD8CC');
      g.globalAlpha = 0.7; rc(g, x + i, y + 2, 2, 2 + ((r * 5) | 0), '#6AAEA6');
      if (r > 0.82) { g.globalAlpha = 0.8; rc(g, x + i, y + 4, 2, 8 + ((r * 24) | 0), '#7AC0B8'); rc(g, x + i, y + 12 + ((r * 24) | 0), 2, 2, '#C4EEE4'); }
    }
    g.globalAlpha = 0.85;
    for (i = 0; y + i < d.ly * T; i += 6) { rc(g, d.lx * T + 6 + (((i / 6) | 0) % 3 === 1 ? 1 : 0), y + i, 3, 4, '#7AC0B8'); rc(g, d.lx * T + 7, y + i, 1, 4, '#C4EEE4'); }
    g.globalAlpha = 1;
  }
  /* the d0 bell's niche: a cold lit stone frame round a deep recess with a warm halo, so the bronze bell is the one warm landmark in the room */
  function bellFrame(g, d) {
    var cx = d.x * T + 8, y = d.y * T, hw = 46, hh = 58, i, k;
    rc(g, cx - hw - 5, y, 2 * hw + 10, hh + 6, '#34405E'); rc(g, cx - hw - 5, y, 2, hh + 6, '#9AAED8'); rc(g, cx + hw + 3, y, 2, hh + 6, '#1E2640');
    rc(g, cx - hw - 5, y, 2 * hw + 10, 2, '#9AAED8'); rc(g, cx - hw - 5, y + hh + 4, 2 * hw + 10, 2, '#9AAED8');
    rc(g, cx - hw, y + 2, 2 * hw, hh + 2, '#0E0A14');
    for (i = 0; i < 6; i++) { rc(g, cx - hw + i, y + 2 + i, 6 - i, 1, '#34405E'); rc(g, cx + hw - 6, y + 2 + i, 6 - i, 1, '#34405E'); }
    for (k = 3; k >= 0; k--) { g.globalAlpha = 0.24; rc(g, cx - 18 - k * 8, y + 22 - k * 3, 36 + k * 16, 34 + k * 6, '#8A4A18'); }
    g.globalAlpha = 1;
    rc(g, cx - hw, y + hh + 1, 2 * hw, 3, '#C8924F'); rc(g, cx - hw, y + hh + 1, 2 * hw, 1, '#F8C070');
  }
  /* a warm rim on the two floor tiles flanking the shaft mouth: the descent reads as a doorway */
  function pool(g, d) {
    var y = (d.y + 1) * T;
    rc(g, (d.x - 3) * T, y, T, 2, '#C8924F'); rc(g, (d.x + 2) * T, y, T, 2, '#C8924F');
    g.globalAlpha = 0.5; rc(g, (d.x - 3) * T, y + 2, T, 2, '#F8A030'); rc(g, (d.x + 2) * T, y + 2, T, 2, '#F8A030'); g.globalAlpha = 1;
  }
  function paintDress(g, L, x0, y0, w, h) {
    var ds = L.dress, i, d;
    if (!ds) return;
    for (i = 0; i < ds.length; i++) {
      d = ds[i];
      if (d.k === 'course') course(g, L, x0, y0, w, h, d.x, d.y, d.w, d.a, d.any);
      else if (!near(d, x0, y0, w, h, d.w || 4, 12)) continue;
      else if (d.k === 'arch') ribPier(g, d);
      else if (d.k === 'tide') tide(g, d);
      else if (d.k === 'jamb') jamb(g, d);
      else if (d.k === 'bellfrm') bellFrame(g, d);
      else if (d.k === 'pool') pool(g, d);
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
  /* GREEN WING: decorative flood water. It never changes movement (Celeste
     1:1, owner decision) — a lever drains it to uncover a secret (WO-DGN). */
  function water(c, cx, cy, L, now, a) {
    var ws = L.water, i, k, w, sx, sy, top, drained, t = reducedNow() ? 0 : now;
    if (!ws || !ws.length) return;
    drained = !!(NEU.save && NEU.save.flagged && NEU.save.flagged('dgn_drain'));
    for (i = 0; i < ws.length; i++) {
      w = ws[i]; sx = w.x * T - cx; sy = w.y * T - cy;
      if (sx > a.x1 || sx + w.w * T < a.x0) continue;
      c.globalAlpha = drained ? 0.16 : 0.42;
      if (drained) { /* a thin puddle at the bottom marks where the water was */
        c.fillStyle = '#143A50'; c.fillRect(sx, (w.y + w.h) * T - cy - 4, w.w * T, 4);
        c.fillStyle = '#2C7E9E'; c.fillRect(sx, (w.y + w.h) * T - cy - 4, w.w * T, 1);
      } else {
        c.fillStyle = '#123048'; c.fillRect(sx, sy, w.w * T, w.h * T);
        c.fillStyle = '#1D5680'; c.fillRect(sx, sy + 2, w.w * T, w.h * T - 4);
        top = sy + ((t / 300 + w.x) & 1);
        c.fillStyle = '#4FA8D0'; c.fillRect(sx, top, w.w * T, 2);
        c.fillStyle = '#9FE0F2';
        for (k = 0; k < w.w * T; k += 24) c.fillRect(sx + k + ((t / 500) & 3), top + 2, 8, 1);
      }
      c.globalAlpha = 1;
    }
  }
  function live(c, cx, cy, L, now, a) {
    var i, d, sx, sy, t = P.time() * 1000, f = reducedNow() ? 0 : ((t / 380) | 0);
    water(c, cx, cy, L, now, a);
    for (i = 0; i < L.decor.length; i++) {
      d = L.decor[i]; if (d.k !== 'w' && d.k !== 'L') continue;
      sx = d.x * T - cx; sy = d.y * T - cy;
      if (sx < a.x0 - 32 || sx > a.x1 + 32 || sy < a.y0 - 48 || sy > a.y1 + 32) continue;
      if (d.k === 'w') { P.glow(c, sx + 8, sy - 2, 22, '#7AA8FF', 0.16); P.fr(c, sx + 7, sy - 4 - ((f + d.x) & 1), 2, 3, '#BFD8FF'); P.fr(c, sx + 7, sy - 2, 2, 1, '#4A78E0'); }
      else P.glow(c, sx + 8, sy + 18, 34, '#F8A030', 0.14);
    }
    /* deep-zone haze: gigapack smoke loops drifting up, only under d7 —
       the upper dungeon stays clean. reducedNow() freezes them like the
       flames; sheetDraw no-ops until the png lands. */
    var s = P.state, z = s && L.zoneAt ? L.zoneAt(s.x, s.y - 11) : null;
    if (z && z.n >= 7 && !reducedNow() && NEU.sheetReady && NEU.sheetReady(NEU.sheets.fxGigSmoke)) {
      var i2, px, py;
      for (i2 = 0; i2 < 3; i2++) {
        px = a.x0 + P.mod(P.hash(i2, 7, z.n) * (a.x1 - a.x0) + t * 0.006 * (i2 + 1), a.x1 - a.x0);
        py = a.y1 - P.mod(P.hash(i2, 3, z.n) * (a.y1 - a.y0) + t * 0.012, a.y1 - a.y0 + 64);
        NEU.sheetDraw(c, 'fxGigSmoke', px, py, { scale: 1.6, alpha: 0.4, now: t + i2 * 373 });
      }
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
    /* TORCH MEMORY: a lit brazier is a permanent light source (WO-DGN). */
    if (L.entities && NEU.save && NEU.save.flagged) for (i = 0; i < L.entities.length; i++) {
      s = L.entities[i];
      if (s.t === 'brazier' && !s.dead && NEU.save.flagged('dgn_lit_' + s.n)) lights.push(s.x, s.y, 1.3);
    }
    if (L.dress) for (i = 0; i < L.dress.length; i++) { s = L.dress[i]; if (s.k === 'pool') lights.push(s.x, s.y, 0.95); else if (s.k === 'bellfrm') lights.push(s.x, s.y + 3, 0.8); }
    if (L.lights) L.lights(lights);
    /* DGN-02: a foe on a dark landing keeps a dim halo so its silhouette stays readable (the hero and shots already carry light) */
    if (L.id === 'dgn' && NEU.dgnFoes && NEU.dgnFoes.foes) for (i = 0; i < NEU.dgnFoes.foes.length; i++) { s = NEU.dgnFoes.foes[i]; lights.push(s.x / T, s.y / T, 0.5); }
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
    landings(L, M, tx0, ty0, cols, rows);
    map = { n: n, L: M, D: D, tx0: tx0, ty0: ty0, cols: cols, rows: rows };
    return map;
  }
  /* DGN-02: a Cel-owned landing (plate, crumble, spring, refill) never falls into the dark: its own cells keep a floor of light
     after the sweeps, so a bright cap still reads on a dark landing. Lit in place, not spread: no extra sweep, no allocation. */
  function landings(L, M, tx0, ty0, cols, rows) {
    var C = NEU.cel, es = L.cel && C && C.ents, i, e, b, x, y, xa, xb, ya;
    if (!es) return;
    for (i = 0; i < es.length; i++) {
      e = es[i];
      if (e.t !== 'movingPlatform' && e.t !== 'crumble' && e.t !== 'spring' && e.t !== 'refill') continue;
      if (e.coll === false && e.t !== 'refill') continue;
      b = e.box || e; xa = Math.floor(b.x / 8) - tx0; xb = Math.floor((b.x + b.w - 1) / 8) - tx0; ya = Math.floor(b.y / 8) - ty0;
      for (x = Math.max(0, xa); x <= xb && x < cols; x++) for (y = Math.max(0, ya - 1); y <= ya && y < rows; y++)
        if (M[y * cols + x] < (y === ya ? 0.62 : 0.4)) M[y * cols + x] = y === ya ? 0.62 : 0.4;
    }
  }
  function lightAt(m, x, y) { x = Math.max(0, Math.min(m.cols - 1, x)); y = Math.max(0, Math.min(m.rows - 1, y)); return m.L[y * m.cols + x]; }
  /* half-tile cells, six steps, unlit is black: one ImageData pixel per cell, scaled x8 with no smoothing */
  function shade(c, L, cx, cy, a) {
    var m = light(L, cx, cy, a.x1 - a.x0, a.y1 - a.y0), W2 = m.cols * 2, H2 = m.rows * 2, img, d, x, y, v, tx, ty, ox, oy, q, rk, cb = L.chamber && L.chamberHidden && L.chamberHidden() ? L.chamber : null;
    if (!lc || lc.width !== W2 || lc.height !== H2) { lc = P.mk(W2, H2); lg = lc.getContext && lc.getContext('2d'); limg = null; }
    if (!lg || !lg.createImageData) return;
    /* DGN-02: one ImageData per buffer size, not one per frame; every alpha is rewritten below and RGB stays 0 */
    img = limg || lg.createImageData(W2, H2);
    if (!img || !img.data) { limg = null; return; }   /* jsdom canvas stubs may define createImageData but return nothing */
    limg = img;
    d = img.data;
    for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) {
      tx = x >> 1; ty = y >> 1; ox = (x & 1) ? 1 : -1; oy = (y & 1) ? 1 : -1;
      v = lightAt(m, tx, ty) * 0.5625 + (lightAt(m, tx + ox, ty) + lightAt(m, tx, ty + oy)) * 0.1875 + lightAt(m, tx + ox, ty + oy) * 0.0625;
      q = Math.min(LEVELS - 1, Math.floor(v * LEVELS));
      /* VOID MASS: rock cells keep a low ambient step so the back layer stays
         visible; only true shafts (' ') fall to full black (WO-DGN). */
      rk = (L.grid[m.ty0 + ty] || '').charAt(m.tx0 + tx);
      if (rk === '#' || rk === '.' || isSpike(rk)) q = Math.max(q, rk === '#' ? 2 : isSpike(rk) ? 4 : 1);
      /* DGN-02: the top half of every tile a foot can stand on (brick or shelf, open above) never drops below step 3 */
      if ((rk === '#' || rk === '=') && !(y & 1) && ((L.grid[m.ty0 + ty - 1] || '').charAt(m.tx0 + tx) === '.' || (L.grid[m.ty0 + ty - 1] || '').charAt(m.tx0 + tx) === ' ')) q = Math.max(q, 3);
      if (cb && m.tx0 + tx >= cb.x + 2 && m.tx0 + tx < cb.x + cb.w && m.ty0 + ty >= cb.y && m.ty0 + ty < cb.y + cb.h - 2) q = 0;   /* a sealed chamber's air is black; its two floor rows stay lit, so the corridor floor runs on unbroken past the door */
      d[(y * W2 + x) * 4 + 3] = Math.round((LEVELS - 1 - q) / (LEVELS - 1) * 255);
    }
    lg.putImageData(img, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(lc, m.tx0 * T - cx, m.ty0 * T - cy, W2 * 8, H2 * 8);
  }
  function foreground(c, cx, cy, L, now, a) { shade(c, L, cx, cy, a); }

  /* ── HUD: the depth line top-left. Hearts, TP and the slots are the docked bar (tphud.js), one display each ─ */
  function hud(c, L, view, now, a) {
    var s = P.state, y = a.y0 + 12, z, depth;
    if (!s) return;
    z = L.zoneAt(s.x, s.y - 11); depth = Math.round((s.y / T - 15) * 2);
    c.font = FONT; c.textBaseline = 'top'; c.textAlign = 'left';
    var label = L.id === 't0' ? 'training room' : depth > 0 ? depth + "' underground" : 'surface';
    c.fillStyle = INK; c.fillText(label, a.x0 + 14, y + 2);
    c.fillStyle = '#E8DCC8'; c.fillText(label, a.x0 + 12, y);
    if (z) { c.fillStyle = '#8A7A9A'; c.fillText(z.id, a.x0 + 12, y + 18); }
    if (L.id === 'dgn' && NEU.dungeon && NEU.dungeon.mapOpen) minimap(c, L, a);
  }
  /* MAP REVEAL (WO-DGN): a key-toggled panel (no corner button). Cells light up
     as you pass; lit braziers mark themselves. One map cell = 4x4 tiles. */
  function minimap(c, L, a) {
    var seen = NEU.dungeon.mapSeen || {}, s = P.state;
    var cs = 3, cols = Math.ceil(L.w / 4), rows = Math.ceil(L.h / 4);
    var pw = cols * cs + 10, ph = rows * cs + 26, px = a.x1 - pw - 12, py = a.y0 + 72;   /* under the difficulty tag */
    var mcol = { B: '#3E5490', G: '#3E7A5A', P: '#8A4A70' };
    var i, j, k, key, f, ents = L.entities || [], e, ex, ey;
    c.fillStyle = '#0A0714'; c.fillRect(px, py, pw, ph);
    c.fillStyle = '#5A5468'; c.fillRect(px, py, pw, 2); c.fillRect(px, py + ph - 2, pw, 2);   /* the boss bar's frame grey, 2 px like the combat panels */
    c.fillRect(px, py, 2, ph); c.fillRect(px + pw - 2, py, 2, ph);
    c.font = FONT; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillStyle = '#C8BCE0'; if (NEU.glyph && NEU.glyph.compact()) { NEU.glyph.draw(c, 'map', px + 5, py + 5); c.fillText(NEU.glyph.key('e'), px + 25, py + 5); }
    else c.fillText('MAP  ' + (NEU.keys ? NEU.keys.label('e') : 'e'), px + 5, py + 5);
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      key = i + ',' + j;
      if (!seen[key]) continue;
      f = L.faction ? L.faction(i * 4 + 2, j * 4 + 2) : 'B';
      c.fillStyle = mcol[f] || '#3E5490';
      c.fillRect(px + 5 + i * cs, py + 21 + j * cs, cs, cs);
    }
    for (k = 0; k < ents.length; k++) {
      e = ents[k];
      if (e.t !== 'brazier' || !NEU.save || !NEU.save.flagged || !NEU.save.flagged('dgn_lit_' + e.n)) continue;
      ex = px + 5 + Math.floor(e.x / 4) * cs; ey = py + 21 + Math.floor(e.y / 4) * cs;
      c.fillStyle = '#FFD36A'; c.fillRect(ex, ey, 2, 2);
    }
    if (s) { c.fillStyle = '#FFFFFF'; c.fillRect(px + 5 + Math.floor(s.x / T / 4) * cs, py + 21 + Math.floor((s.y - 11) / T / 4) * cs, 2, 2); }
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
  /* TORCH MEMORY: a wall brazier. Walking past lights it and the flag is saved;
     the flame steps at ~3 Hz and freezes under reduced motion (WO-DGN). */
  kd('brazier').draw = function (c, x, y, e, now) {
    var lit = !!(NEU.save && NEU.save.flagged && NEU.save.flagged('dgn_lit_' + e.n));
    var fx = 0, fy = 0;
    P.fr(c, x + 6, y + 3, 4, 10, '#2E2C38'); P.fr(c, x + 7, y + 3, 2, 10, '#5A5866');
    P.fr(c, x + 3, y + 12, 10, 3, '#3E3C4A'); P.fr(c, x + 4, y + 12, 8, 1, '#7A7888');
    if (!lit) { P.fr(c, x + 6, y + 9, 4, 3, '#1A1422'); return; }
    if (!reducedNow()) { fx = ((now / 260 + e.n) | 0) & 1; fy = ((now / 190 + e.n) | 0) & 1; }
    P.glow(c, x + 8, y + 8, 30, '#FFB050', 0.16);
    P.fr(c, x + 6, y + 7, 4, 5 + fy, '#FF7A20'); P.fr(c, x + 7, y + 5 - fx, 2, 5, '#FFC860');
    P.fr(c, x + 7, y + 3 - fx, 1, 2, '#FFF0B0');
  };
  /* A hidden max-heart: collected on walk-over, raises the dock's heart cap. */
  kd('dgnheart').draw = function (c, x, y, e, now) {
    var bob = (!reducedNow() && ((now / 420) | 0) & 1) ? 1 : 0;
    if (e.dead) return;
    P.glow(c, x + 8, y + 6, 16, '#FF6A9A', 0.3);
    P.fr(c, x + 3, y + 3 - bob, 3, 2, '#FFD0DC'); P.fr(c, x + 10, y + 3 - bob, 3, 2, '#FFD0DC');
    P.fr(c, x + 2, y + 5 - bob, 12, 3, '#E8304A'); P.fr(c, x + 3, y + 8 - bob, 10, 2, '#C41038');
    P.fr(c, x + 5, y + 10 - bob, 6, 1, '#8A0828'); P.fr(c, x + 7, y + 6 - bob, 2, 2, '#FFC8D0');
  };
  /* The drain lever: amber before, cool blue once pulled. */
  kd('dgnlever').draw = function (c, x, y, e) {
    var on = !!(NEU.save && NEU.save.flagged && NEU.save.flagged('dgn_drain'));
    P.fr(c, x + 3, y + 7, 10, 9, INK); P.fr(c, x + 4, y + 8, 8, 8, '#3E3C4A'); P.fr(c, x + 5, y + 9, 6, 6, '#6A6878');
    P.fr(c, x + 6, y + 1, 4, 9, INK); P.fr(c, x + 7, y + 2, 2, 8, on ? '#5AC8E0' : '#C89A3A'); P.fr(c, x + 6, y + 1, 4, 2, on ? '#9FE0F2' : '#FFD36A');
    P.fr(c, x + (on ? 9 : 5), y + 9, 3, 2, on ? '#9FE0F2' : '#FFD36A');
  };
  kd('bench').draw = function (c, x, y) {
    P.fr(c, x, y + 6, 16, 3, '#8A5A32'); P.fr(c, x, y + 6, 16, 1, '#C8924F');
    P.fr(c, x + 1, y + 9, 2, 5, '#5C3A20'); P.fr(c, x + 13, y + 9, 2, 5, '#5C3A20');
    P.fr(c, x + 1, y, 2, 7, '#6B4A2E'); P.fr(c, x, y, 4, 2, '#8A5A32');
  };
  /* The eight chamber centrepieces and their inspectable plaques: palette
     drawn, no new sheets (R1/R15). */
  kd('dgnplaque').draw = function (c, x, y) {
    P.fr(c, x + 3, y + 2, 10, 8, '#3E3C4A'); P.fr(c, x + 4, y + 3, 8, 6, '#8A7A9A');
    P.fr(c, x + 5, y + 4, 6, 1, '#D8D0E4'); P.fr(c, x + 5, y + 6, 4, 1, '#A89ABE');
  };
  kd('dgnsecret').draw = function (c, x, y, e) {
    var on = !!(NEU.save && NEU.save.flagged && NEU.save.flagged(e.flag)), k = e.kind;
    if (k === 'bell') {
      /* DGN-02b: a 34 px bronze bell hung from an iron beam inside its niche: dome, band, flared lip, clapper. The entity box is the top 16 px */
      var cx = x + 8, r, hf, p, hi = on ? '#FFF6C0' : '#F0D070', mid = on ? '#FFD060' : '#C89A3A', lo = on ? '#C89A3A' : '#8A6420';
      P.fr(c, cx - 30, y + 3, 60, 5, INK); P.fr(c, cx - 29, y + 4, 58, 3, '#6A5238'); P.fr(c, cx - 29, y + 4, 58, 1, '#B8985A');
      P.fr(c, cx - 5, y + 8, 10, 3, INK); P.fr(c, cx - 3, y + 8, 6, 3, '#B8A070');
      for (r = 0; r < 34; r++) {
        hf = 5 + Math.round(11 * Math.sqrt(r / 33)) + (r > 29 ? 2 * (r - 29) : 0);
        P.fr(c, cx - hf - 1, y + 11 + r, 2 * hf + 2, 1, INK);
        P.fr(c, cx - hf, y + 11 + r, 2 * hf, 1, mid);
        P.fr(c, cx - hf, y + 11 + r, Math.max(2, hf >> 1), 1, hi);
        P.fr(c, cx + (hf >> 1) + 1, y + 11 + r, hf - (hf >> 1) - 1, 1, lo);
      }
      P.fr(c, cx - 15, y + 34, 30, 2, '#6A4A18'); P.fr(c, cx - 19, y + 43, 38, 2, on ? '#FFE890' : '#E8C060');
      P.fr(c, cx - 3, y + 46, 6, 6, INK); P.fr(c, cx - 2, y + 47, 4, 4, '#8A6420'); P.fr(c, cx - 2, y + 47, 2, 2, '#E8C060');
      P.glow(c, cx, y + 34, on ? 64 : 48, '#F8A030', on ? 0.3 : 0.2);
    } else if (k === 'book') {
      P.fr(c, x + 2, y + 2, 12, 14, '#4A3018'); P.fr(c, x + 3, y + 3, 10, 12, '#2A1C10');
      P.fr(c, x + 4, y + 4, 2, 10, '#8A5A32'); P.fr(c, x + 7, y + 4, 3, 10, '#5A8A6A'); P.fr(c, x + 11, y + 4, 1, 10, '#8A3A5A');
    } else if (k === 'bone') {
      P.fr(c, x + 2, y + 10, 12, 3, '#8A7456'); P.fr(c, x + 3, y + 7, 10, 3, '#C4A882');
      P.fr(c, x + 5, y + 5, 6, 2, '#E8D2B0'); P.fr(c, x + 7, y + 7, 2, 3, '#5A4A38');
    } else if (k === 'anvil') {
      P.fr(c, x + 2, y + 6, 12, 3, '#68707A'); P.fr(c, x + 5, y + 3, 6, 3, '#9AA2AE');
      P.fr(c, x + 6, y + 9, 4, 5, '#4A5058'); P.fr(c, x + 3, y + 14, 10, 2, '#3A3E44');
    } else if (k === 'chain') {
      P.fr(c, x + 7, y, 2, 7, '#9A98A8'); P.fr(c, x + 5, y + 7, 6, 4, '#6A6878');
      P.fr(c, x + 6, y + 8, 4, 2, '#D8D4E8');
    } else if (k === 'lever') {
      kd('dgnlever').draw(c, x, y, e);
    } else {
      P.fr(c, x + 1, y + 1, 14, 14, '#2A2432'); P.fr(c, x + 2, y + 2, 12, 12, '#5A5266');
      P.fr(c, x + 4, y + 5, 8, 1, on ? '#FFD36A' : '#8A7A9A'); P.fr(c, x + 7, y + 6, 1, 6, '#2A2432');
    }
  };
  /* the painting hangs IN the wall: a dark niche recess, a dust sheet over it
     until painting_found, then the gilt frame. The Z prompt floats above in
     reach (same band plat.js uses for the touch), drawn through engine-look so
     a rebound key shows its own letter. */
  kd('painting').draw = function (c, x, y, e, now) {
    var found = !!(NEU.save && NEU.save.flagged && NEU.save.flagged('painting_found'));
    var s;
    c.fillStyle = '#0A0614'; c.fillRect(x - 2, y - 2, 20, 20);
    c.fillStyle = '#1A1028'; c.fillRect(x - 1, y - 1, 18, 18);
    if (found) { s = paintingSpr(); c.drawImage(s.cv, x, y); }
    else {
      c.fillStyle = '#5A5664'; c.fillRect(x - 1, y - 1, 18, 20);
      c.fillStyle = '#77727E'; c.fillRect(x - 1, y - 1, 18, 1);
      c.fillStyle = '#46424E';
      c.fillRect(x + 2, y, 1, 18); c.fillRect(x + 7, y, 1, 18); c.fillRect(x + 12, y, 1, 18);
      c.fillStyle = INK; c.fillRect(x - 1, y + 17, 18, 1);
    }
  };
  /* the interact prompt must survive the light map: entities draw before the
     shade, so the key cap goes on a second foreground pass, after it. */
  function paintingPrompt(c, cx, cy, L, now) {
    var i, e, h = P.state, ex, ey;
    if (!h || !NEU.engineLook || !NEU.engineLook.drawPrompt || P.replaying()) return;
    for (i = 0; i < L.entities.length; i++) {
      e = L.entities[i];
      if (e.t !== 'painting' || e.dead) continue;
      ex = (e.x + 0.5) * T; ey = (e.y + 1) * T;
      if (Math.abs(h.x - ex) <= 22 && Math.abs((h.y - 11) - (ey - 8)) <= 48)
        NEU.engineLook.drawPrompt(c, e.x * T - cx + 8, e.y * T - cy - 3, 1, now);
    }
  }
  var prevFg2 = P.foreground;
  P.foreground = function (c, cx, cy, L, now, a) {
    if (prevFg2) prevFg2(c, cx, cy, L, now, a);
    if (L && L.tileset === 'dungeon') paintingPrompt(c, cx, cy, L, now);
  };
  kd('magegate').draw = function (c, x, y, e, now) {
    var s = mageSpr(), gx = x - 8, gy = y - 32, k = reducedNow() ? 0 : ((now / 600) | 0) % 6;
    c.drawImage(s.cv, gx, gy);
    P.fr(c, gx + [2, 2, 2, 29, 29, 29][k], gy + [12, 22, 32, 12, 22, 32][k], 1, 2, '#B892FF');
    P.glow(c, gx + 16, gy + 24, 28, '#7A52B8', 0.10);
  };
  /* the bone door: a slab in a 2x3 gap of the door wall (x is the gap's left edge). It rises into the lintel in ratchet steps (e.rise px, dungeon.js owns the steps and
     the six collision tiles); only the part still inside the gap is drawn, so above the opening it is masonry, never door. Two chains show where it hangs. */
  kd('bossdoor').draw = function (c, x, y, e) {
    var s = bossSpr(), gx = x, gy = y - 32, has = !!(NEU.save && NEU.save.has && NEU.save.has('boss_key')), rise = Math.min(40, (e && e.rise) || 0), yy;   /* raised, an 8 px lip of the slab stays in sight under the lintel */
    c.drawImage(s.cv, 0, rise, 32, 48 - rise, gx, gy, 32, 48 - rise);   /* what is left of the slab inside the gap */
    if (rise < 12) { P.fr(c, gx + 11, gy + 12 - rise, 2, 2, has ? '#FF8AC8' : '#3A2A20'); P.fr(c, gx + 19, gy + 12 - rise, 2, 2, has ? '#FF8AC8' : '#3A2A20'); }
    for (yy = gy - rise - 2; yy > gy - 30; yy -= 4) { P.fr(c, gx + 5, yy, 2, 3, yy & 4 ? '#8A7456' : '#C4A882'); P.fr(c, gx + 25, yy, 2, 3, yy & 4 ? '#8A7456' : '#C4A882'); }
  };
  kd('bossbar').draw = function () {};
  /* the rematch plinth: a cold stone step with an ecto flame. Only a cleared save ever sees it. */
  kd('rematch').draw = function (c, x, y, e, now) {
    var f = reducedNow() ? 0 : ((now / 200) | 0) % 4, up = f === 1 || f === 3 ? 1 : 0;
    P.fr(c, x + 1, y + 8, 14, 8, INK); P.fr(c, x + 2, y + 9, 12, 7, '#4A4660'); P.fr(c, x + 2, y + 9, 12, 2, '#8E88AC'); P.fr(c, x + 2, y + 14, 12, 2, '#2A2640');
    P.fr(c, x + 4, y + 5, 8, 4, INK); P.fr(c, x + 5, y + 6, 6, 3, '#6A6488');
    P.glow(c, x + 8, y - 2, 44, '#7FE3C4', 0.28);
    P.fr(c, x + 5, y - 3 - up, 6, 9, '#2E9A86'); P.fr(c, x + 6, y - 8 - up, 4, 6, '#2E9A86'); P.fr(c, x + 6, y - 5 - up, 4, 9, '#7FE3C4'); P.fr(c, x + 7, y - 2, 2, 5, '#E8FFF8');
  };
  /* a lift: a dungeon shelf on a chain that runs up out of sight */
  kd('lift').draw = function (c, x, y, e) {
    var i, on = e.top ? !!(NEU.save && NEU.save.flagged && NEU.save.flagged('dgn_lift_' + e.n)) : true;
    for (i = 1; i <= 4; i++) cut(c, 'dgChain', 5 * 18, 0, T, T, x, y - i * T);
    cut(c, 'dgShelf', 5 * 18, 6 * 18, T, T, x, y + 12);
    if (!on) { c.globalAlpha = 0.5; P.fr(c, x, y - 64, 16, 80, '#05030A'); c.globalAlpha = 1; }
  };
  kd('leave').draw = function () {};
  /* the surface bed (W10): wooden frame, pillow, faded wool blanket. */
  function bedSpr() {
    return P.spr('dbed', 32, 16, function (R) {
      var x;
      R(0, 12, 32, 4, INK); R(1, 11, 30, 3, '#4A3018');            /* frame + legs shadow */
      R(0, 4, 4, 8, INK); R(1, 4, 2, 8, '#6B4A2E');               /* headboard */
      R(1, 5, 30, 6, INK); R(2, 6, 28, 4, '#E8DCC8');             /* mattress */
      R(2, 6, 8, 4, '#F4F0E8');                                   /* pillow */
      R(10, 6, 20, 4, '#5A6A9A'); R(10, 6, 20, 1, '#7A8ABA');     /* blanket */
      for (x = 12; x < 30; x += 4) R(x, 9, 1, 2, '#4A5A8A');       /* blanket fold */
      R(1, 11, 30, 1, '#8A5A32');                                 /* frame top edge */
    });
  }
  kd('bed').draw = function (c, x, y) {
    var s = bedSpr();
    c.drawImage(s.cv, 0, 0, 32, 16, x - 8, y, 32, 16);
  };
  /* W20 tutorial room props: palette-drawn, no sheet yet (art pass later). Dead props draw nothing. */
  kd('tdoor').draw = function (c, x, y) { P.fr(c, x - 4, y - 16, 24, 32, '#5C3A20'); P.fr(c, x - 2, y - 14, 20, 30, '#12081E'); };
  kd('tcrate').draw = function (c, x, y, e) { if (e.dead) return; P.fr(c, x + 1, y + 1, 14, 14, e.hp < 2 ? '#7A4E2A' : '#8A5A32'); P.fr(c, x + 3, y + 5, 10, 1, '#C8924F'); };
  kd('tarm').draw = function (c, x, y, e) { if (e.dead) return; P.fr(c, x + 1, y + 1, 14, 14, '#5A6270'); P.fr(c, x + 1, y + 6, 14, 2, '#AEB8C8'); };
  kd('tbridge').draw = function (c, x, y, e) { if (e.dead) return; P.fr(c, x, y, 16, 6, '#8A5A32'); P.fr(c, x, y + 6, 16, 1, '#5C3A20'); };
  kd('tbar').draw = function (c, x, y, e) { if (e.dead) return; P.fr(c, x + 2, y, 3, 16, '#FF5FA8'); P.fr(c, x + 11, y, 3, 16, '#FF5FA8'); };
  kd('tgate').draw = function (c, x, y, e) { if (e.dead) return; P.fr(c, x + 3, y, 2, 16, '#7A8CA0'); P.fr(c, x + 11, y, 2, 16, '#7A8CA0'); };
  kd('tchest').draw = function (c, x, y, e) { P.fr(c, x + 1, y + 6, 14, 10, e.opened ? '#5C3A20' : '#8A5A32'); P.fr(c, x + 7, y + 5, 2, 3, '#FFD36A'); };
  kd('ttgt').draw = function (c, x, y) { P.glow(c, x + 8, y + 8, 12, '#9AF0FF', 0.5); P.fr(c, x + 5, y + 5, 6, 6, '#E8FBFF'); };
  kd('tcry').draw = function (c, x, y, e) { if (e.used) return; P.glow(c, x + 8, y + 8, 14, '#9AF0FF', 0.6); P.fr(c, x + 6, y + 4, 4, 8, '#9AF0FF'); };
  kd('tcp').draw = function (c, x, y) { P.fr(c, x + 7, y + 6, 2, 10, '#C8B890'); P.fr(c, x + 9, y + 6, 4, 3, '#FFD36A'); };
  kd('tleave').draw = function () {};
  var crumbleDraw = kd('crumble').draw;
  kd('crumble').draw = function (c, x, y, e, now) {
    var L = P.level0(), f, j;
    if (!inDungeon()) { if (crumbleDraw) crumbleDraw(c, x, y, e, now); else P.ent('crumble', c, x, y, e, now); return; }
    j = P.fallOf(e); if (j < 0) return;
    f = frame((e.x > 0 && /k/.test(L.cracks[(e.y | 0) + ',' + ((e.x | 0) - 1)] || '') ? 2 : 0) | (/k/.test(L.cracks[(e.y | 0) + ',' + ((e.x | 0) + 1)] || '') ? 4 : 0), e.x | 0, e.y | 0);
    cut(c, CRACK[L.faction(e.x | 0, e.y | 0)], f[0] * 18, f[1] * 18, T, T, x + (e.cs === 1 && !reducedNow() ? ((((now / 40) | 0) & 1) ? 1 : -1) : 0), y + j);
  };
  /* PINK WING: the telegraphed crumble (0.4 s shake, 3 s respawn). Same pink
     cracked sheet, but a slower shake so the warning reads before it drops. */
  kd('dgncrumb').draw = function (c, x, y, e, now) {
    var f = P.fallOf(e), j = e.cs === 1 && !reducedNow() ? (((now / 60) | 0) & 1 ? 1 : -1) : 0;
    if (f < 0) return;
    f = frame(5, e.x | 0, e.y | 0);
    cut(c, CRACK.P, f[0] * 18, f[1] * 18, T, T, x + j, y + f);
    if (e.cs === 1) { P.fr(c, x + 3 + j, y + 3 + f, 10, 1, '#FFA8D8'); P.fr(c, x + 3 + j, y + 12 + f, 10, 1, '#FFA8D8'); }
  };


  /* ── DGN-02: Cel-owned entity skins, painted by cel-view.js on the live collision bounds (host draw only; the cel.html route keeps its own art).
     celSkin(c, e, x, y, k): c is in cel pixels, so we scale back to screen pixels. One painter per entity: a true return tells cel-view to skip its box. ── */
  function chain(c, ax, ay, bx, by, fade) {
    var n = Math.max(1, Math.round(Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) / 4)), i;
    for (i = 0; i <= n; i++) {
      c.globalAlpha = fade ? 0.7 + 0.3 * i / n : 1;
      rc(c, ax + (bx - ax) * i / n - 1, ay + (by - ay) * i / n - 1, 3, 4, i & 1 ? '#8A889C' : '#D8D6E8');
    }
    c.globalAlpha = 1;
  }
  /* plate: a bright worn cap exactly on the collision top, a bronze body, a chain V up to an anchor */
  function skinMover(c, e, X, Y, k) {
    var W = Math.round(e.w * k), H = Math.round((e.h || 8) * k), mx = ((e.nx !== undefined ? (e.x0 + e.nx) / 2 : e.x) + e.w / 2) * k, my = Math.min(e.y0 !== undefined ? e.y0 : e.y, e.ny !== undefined ? e.ny : e.y) * k - 80, i, rl, rr;
    X = Math.round(X); Y = Math.round(Y);
    mx = Math.max(X + W / 2 - 48, Math.min(X + W / 2 + 48, mx));   /* a long traverse hangs from a trolley overhead, not a 45 degree swing */
    my = Math.max(my, Y - 96);   /* a trolley rides at most 6 tiles above the plate, so the chain never fades into the dark */
    if (e.nx !== undefined && Math.abs(e.nx - e.x0) > 4) {
      /* a horizontal traverse: the trolley rides a fixed rail the whole length of the travel, so the plate is never anchored to bare air */
      rl = Math.round(Math.min(e.x0, e.nx) * k + W / 2) - 10; rr = Math.round(Math.max(e.x0, e.nx) * k + W / 2) + 10;
      rc(c, rl, my - 2, rr - rl, 5, INK); rc(c, rl + 1, my - 1, rr - rl - 2, 2, '#7A6C58'); rc(c, rl + 1, my - 1, rr - rl - 2, 1, '#C8B890');
      for (i = rl; i <= rr - 2; i += 48) rc(c, i, my - 5, 2, 3, '#5A4E3E');   /* hangers */
      rc(c, rl - 2, my - 6, 4, 11, INK); rc(c, rl - 1, my - 5, 2, 9, '#9A8A70'); rc(c, rr - 2, my - 6, 4, 11, INK); rc(c, rr - 1, my - 5, 2, 9, '#9A8A70');   /* end stops */
      mx = X + W / 2;
    }
    chain(c, mx, my, X + 4, Y, true); chain(c, mx, my, X + W - 4, Y, true);
    rc(c, mx - 9, my - 4, 18, 6, INK); rc(c, mx - 8, my - 3, 16, 3, '#9A8A70'); rc(c, mx - 8, my - 3, 16, 1, '#E8D8A8'); rc(c, mx - 6, my, 2, 2, INK); rc(c, mx + 4, my, 2, 2, INK);
    rc(c, X, Y, W, H, INK);
    rc(c, X + 1, Y + 3, W - 2, H - 5, '#5E4E3A'); rc(c, X + 1, Y + H - 4, W - 2, 2, '#3E3226');
    for (i = 0; i < W - 2; i += 2) rc(c, X + 1 + i, Y + 1, 2, 2, P.hash(i, e.y0 | 0, 11) < 0.14 ? '#8A7650' : '#F0E0B0');
    rc(c, X + 1, Y + 3, W - 2, 1, '#B89A58');
    for (i = 16; i < W - 8; i += 16) rc(c, X + i, Y + 4, 1, H - 8, '#3A2E20');
    rc(c, X + 3, Y + 6, 2, 2, '#D8C08A'); rc(c, X + W - 5, Y + 6, 2, 2, '#D8C08A');
  }
  /* crumble: faction stone, a bright cap split by a crack that widens when it starts to go; a faint ghost while it is gone */
  var CRP = { B: ['#9AB4F0', '#3E5490', '#1E2A50'], G: ['#9AD0A8', '#3E7A5A', '#1C3A2A'], P: ['#F0A8D0', '#8A4A70', '#4A2038'] };
  function skinCrumble(c, e, X, Y, k, now) {
    var L = P.level0(), p = CRP[L.faction(Math.floor(e.x / 8), Math.floor(e.y / 8))] || CRP.B, W = Math.round(e.w * k), H = Math.round(e.h * k), g, j;
    X = Math.round(X); Y = Math.round(Y);
    if (e.coll === false) {
      c.globalAlpha = 0.35;
      for (j = 0; j < W; j += 4) { rc(c, X + j, Y, 2, 1, p[0]); rc(c, X + j, Y + H - 1, 2, 1, p[0]); }
      for (j = 0; j < H; j += 4) { rc(c, X, Y + j, 1, 2, p[0]); rc(c, X + W - 1, Y + j, 1, 2, p[0]); }
      c.globalAlpha = 1; return;
    }
    if (e.cs === 1 && !reducedNow()) X += (((now / 40) | 0) & 1) ? 1 : -1;
    g = e.cs === 1 ? 2 : 1;
    rc(c, X, Y, W, H, INK); rc(c, X + 1, Y + 3, W - 2, H - 4, p[1]); rc(c, X + 1, Y + 1, W - 2, 2, p[0]);
    rc(c, X + 1, Y + H - 3, W - 2, 2, p[2]);
    rc(c, X + (W >> 1) - 1, Y + 1, g, 3, INK); rc(c, X + (W >> 1) - 1 + g, Y + 4, 1, 3, INK); rc(c, X + (W >> 1) - 2, Y + 7, 2, 2, INK);
    rc(c, X + 3, Y + 5, 2, 1, p[2]); rc(c, X + W - 6, Y + 9, 3, 1, p[2]);
  }
  /* spring: pad, coil, base. At rest the coil is compressed under the pad; on a bounce the pad snaps down and the coil closes */
  function skinSpring(c, e, X, Y, k) {
    var W = Math.round(e.box.w * k), H = Math.round(e.box.h * k), px = Math.round(e.box.x * k), py = Math.round(e.box.y * k), f = e.flash > 0 ? 1 : 0, r, off;
    if (e.o !== 'F') return false;
    rc(c, px, py + f * 3, W, H - f * 3, INK);
    rc(c, px + 2, py + 1 + f * 3, W - 4, 3, '#F0C040'); rc(c, px + 2, py + 1 + f * 3, W - 4, 1, '#FFF0A0');
    for (r = 0; r < H - 7 - f * 3; r++) { off = (r & 3) < 2 ? (r & 3) * 3 : (4 - (r & 3)) * 3; rc(c, px + 6 + off, py + 4 + f * 3 + r, W - 12 - (off ? 3 : 0), 1, r & 1 ? '#8A84A0' : '#D8D4E8'); }
    rc(c, px + 1, py + H - 3, W - 2, 3, '#4A4250'); rc(c, px + 1, py + H - 3, W - 2, 1, '#9A94AC');
  }
  /* refill: a solid gem while ready, a hollow outline with a centre dot while empty; two-dash gems add spikes */
  function skinRefill(c, e, X, Y, k) {
    var half = 9, r, wv, two = !!e.two, full = e.coll !== false, bob = (full && !reducedNow() && ((((P.time() * 1000) / 420) | 0) & 1)) ? 1 : 0, col = two ? '#FF6DEF' : '#5EF05E', dk = two ? '#B02EA8' : '#2E9A3A';
    X = Math.round(X); Y = Math.round(Y) - bob;
    if (!full) {
      c.globalAlpha = 0.6;
      for (r = -half; r <= half; r += 2) { wv = half - Math.abs(r); rc(c, X - wv, Y + r, 1, 1, '#7A9A8A'); rc(c, X + wv, Y + r, 1, 1, '#7A9A8A'); }
      rc(c, X - 1, Y - 1, 2, 2, '#7A9A8A'); c.globalAlpha = 1; return;
    }
    P.glow(c, X, Y, 24, col, 0.28);
    for (r = -half; r <= half; r++) { wv = half - Math.abs(r); rc(c, X - wv - 1, Y + r, 2 * wv + 3, 1, INK); }
    for (r = -half; r <= half; r++) { wv = half - Math.abs(r); rc(c, X - wv, Y + r, wv + 1, 1, col); rc(c, X + 1, Y + r, wv, 1, dk); if (r <= 0) rc(c, X - wv, Y + r, 2, 1, '#E8FFE8'); }
    if (two) { rc(c, X - 1, Y - half - 4, 2, 3, col); rc(c, X - 1, Y + half + 2, 2, 3, col); }
  }
  var SKIN = { movingPlatform: skinMover, crumble: skinCrumble, spring: skinSpring, refill: skinRefill };
  /* the kernel draws every entity of the level each frame, and the whole dungeon holds a hundred: one wholly off screen is skipped as handled (a mover's path and chain count) */
  function offscreen(e) {
    var cam = P.cam(), v = P.view(), b = e.box || e, w = b.w || 18, h = b.h || 18, xs = [b.x, e.x0, e.nx], ys = [b.y, e.y0, e.ny], x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i;
    for (i = 0; i < 3; i++) {
      if (xs[i] !== undefined) { x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i]); }
      if (ys[i] !== undefined) { y0 = Math.min(y0, ys[i]); y1 = Math.max(y1, ys[i]); }
    }
    return x1 + w < cam.x / 2 - 40 || x0 - w > (cam.x + v.w) / 2 + 40 || y1 + h < cam.y / 2 - 40 || y0 - 56 > (cam.y + v.h) / 2 + 40;
  }
  P.celSkin = function (c, e, x, y) {
    var L = P.level0(), fn = SKIN[e.t], ok, k = 2;   /* plat.js hosts the kernel at 2 screen px per cel px */
    if (!fn || !L || L.tileset !== 'dungeon') return false;
    if (offscreen(e)) return true;
    c.save(); c.scale(1 / k, 1 / k); ok = fn(c, e, x * k, y * k, k, P.time() * 1000); c.restore();
    return ok !== false;
  };

  NEU.dungeonLook = {
    tileset: 'dungeon', frames: FR, centre: CW, frame: frame, sheet: sheet, cut: cut, mag: mag,
    light: light, lightMap: function () { return map; }, levels: LEVELS, air: AIR, solid: SOLID,
    minimap: minimap
  };
})();
