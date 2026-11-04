/* stage.js: canvas stage kit (spec K1-K11). Art px * scale s (required, integer); static when reduced. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var FONT = '16px "Determination Mono","Pixelify Sans",monospace';
  var C = {
    gold: '#FFD34E', goldLo: '#C8901E', bulbOff: '#3A3252', curtainLo: '#5A1E2E',
    blood: '#8C2F4A', curtainHi: '#C2405F', plankHi: '#E8DCC8', plank: '#C9B9A2',
    plankLo: '#BFA98C', bone: '#EDE7DE', ink: '#14141C', crypt: '#22222E',
    ghost: '#8A8598', lilac: '#B892FF', edge: '#5C5C70', can: '#241D2E', dark: '#2A2236'
  };
  var cache = {}, cn = 0, bobAt = -1e9;

  function calm() { return !!(NEU.motion && NEU.motion.reduced()); }
  function R(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function txt(c, t, x, y, col, al) {
    c.font = FONT; c.fillStyle = col; c.textAlign = al || 'left'; c.textBaseline = 'top';
    c.fillText(String(t).toUpperCase(), x, y);
  }

  function rng(seed) {
    var a = Math.abs(seed | 0) % 2147483646 + 1;
    return function () { a = a * 16807 % 2147483647; return (a - 1) / 2147483646; };
  }
  /* K1; thin = 2px rim */
  function frame(c, x, y, w, h, thin, rim) {
    var B = thin ? [0, 2] : [0, 4, 8, 10], i;
    for (i = 0; i < B.length; i++) R(c, i % 2 ? '#000' : i ? '#fff' : rim || '#fff', x + B[i], y + B[i], w - 2 * B[i], h - 2 * B[i]);
  }
  /* K2; o = {bar, open, cx, col} */
  function plate(c, x, y, text, o) {
    o = o || {};
    c.font = FONT;
    var w = Math.ceil((c.measureText(String(text).toUpperCase()).width + 32) / 8) * 8, t = o.open === 'top';
    x = (o.cx ? x - w / 2 : x) | 0;
    R(c, '#fff', x, y, w, 32);
    R(c, '#000', x + 2, y + (t ? 0 : 2), w - 4, 30);
    if (o.bar !== false) R(c, C.gold, x, y, w, 4);
    txt(c, text, x + 16, y + 8, o.col || '#fff');
    return w;
  }
  /* K3 */
  function curtain(c, x, y, w, h, side, s) {
    var P = [C.curtainLo, C.blood, C.curtainHi, C.blood], cw = 4 * s, i, a;
    for (i = 0; i * cw < w; i++) {
      a = side === 'r' ? x + w - (i + 1) * cw : x + i * cw;
      R(c, P[i % 4], Math.max(a, x), y, Math.min(a + cw, x + w) - Math.max(a, x), h - 4 * s);
    }
    R(c, C.goldLo, x, y + h - 4 * s, w, 4 * s);
  }
  /* K3 valance */
  function valance(c, x, y, w, s) {
    var k, r;
    R(c, C.blood, x, y, w, 16 * s);
    for (k = 16 * s; k < w; k += 16 * s) for (r = 0; r < 4; r++)
      R(c, C.curtainLo, x + k - (4 - r) * s, y + (15 - r) * s, (4 - r) * 2 * s, s);
    R(c, C.goldLo, x, y + 16 * s, w, 2 * s);
  }
  /* K4; dir 1 right, -1 left */
  function lamp(c, x, y, s, dir) {
    R(c, C.can, x + 4 * s, y, 2 * s, 6 * s);
    R(c, C.can, x, y + 6 * s, 10 * s, 7 * s);
    R(c, C.bulbOff, x, y + 6 * s, 10 * s, s);
    R(c, C.bone, x + 2 * s, y + 13 * s, 6 * s, s);
    R(c, C.bone, x + (dir < 0 ? 1 : 3) * s, y + 14 * s, 6 * s, s);
  }
  /* K4 cone */
  function cone(c, x, y, len, dir, s) {
    var i, a, h;
    for (i = 0; i < len / s; i++) {
      a = x + (dir < 0 ? -1 : 1) * (i >> 2) * s; h = 3 + i;
      R(c, 'rgba(237,231,222,.08)', a - h * s, y + i * s, 2 * h * s, s);
      h = (h >> 1) + 1;
      R(c, 'rgba(237,231,222,.14)', a - h * s, y + i * s, 2 * h * s, s);
    }
  }
  /* K5 */
  function bulbs(c, x, y, w, t, s) {
    var st = calm() ? 0 : ((t / 250) | 0), i, b;
    for (i = 0; (i + 1) * 8 * s <= w; i++) {
      b = x + i * 8 * s + s;
      R(c, '#000', b, y, 6 * s, 6 * s);
      R(c, (i + st) % 2 ? C.bulbOff : C.gold, b + s, y + s, 4 * s, 4 * s);
    }
  }
  /* ponytail: flushes at 24 keys; a resize storm rebakes */
  function bake(key, w, h, paint) {
    if (cache[key]) return cache[key];
    if (++cn > 24) { cache = {}; cn = 1; }
    var cv = document.createElement('canvas'), g;
    cv.width = w; cv.height = h; g = cv.getContext('2d');
    if (g) { g.imageSmoothingEnabled = false; paint(g); }
    return (cache[key] = cv);
  }
  /* K6 */
  function floor(c, x, y, w, h, variant, s) {
    var d = variant === 'dark';
    c.drawImage(bake('fl' + w + 'x' + h + variant + s, w, h, function (g) {
      var H = h - 6 * s, m = w >> 1, y0 = 0, rh = 4, i = 0, k, hh, f, rw, sx;
      while (y0 < H) {
        hh = Math.min(rh * s, H - y0); f = (y0 + hh) / H; rw = (w * (0.7 + 0.3 * f)) >> 1;
        R(g, i++ % 2 ? (d ? C.crypt : C.plankLo) : (d ? C.dark : C.plank), m - rw, y0, 2 * rw, hh);
        if (24 * f >= 4) for (k = -60; k <= 60; k++) {
          sx = m + Math.round(k * 24 * s * f);
          if (Math.abs(sx - m) < rw) R(g, d ? C.ink : C.ghost, sx, y0, s, hh);
        }
        y0 += hh; rh = rh < 6 ? rh + 1 : Math.round(rh * 1.25);
      }
      R(g, d ? C.bulbOff : C.plankHi, 0, H, w, 4 * s);
      R(g, C.curtainLo, 0, H + 4 * s, w, 2 * s);
    }), x, y);
  }
  /* K7 */
  function crowd(c, x, y, w, t, seed, s) {
    var z = calm(), r = rng(seed), fr = z ? 0 : ((t / 500) | 0) % 2,
        base = y + 40 * s - (!z && t >= bobAt && t - bobAt < 250 ? 2 * s : 0),
        px = x - 8 * s, O = [[-s, 0], [s, 0], [0, -s], [0, s], [0, 0]], j, q, o;
    while (px < x + w) {
      var sh = 18 + ((r() * 7) | 0), hd = 10 + ((r() * 5) | 0), top = base - (20 + ((r() * 7) | 0)) * s,
          arm = r() < 1 / 3, stk = r() < 1 / 5, k = r() < 0.5,
          hx = px + ((sh - hd) >> 1) * s, hy = top - (hd + 2) * s,
          ax = px + (k ? 1 : sh - 4) * s, ay = hy - 6 * s - ((fr ^ k) ? 2 * s : 0);
      var rs = [[px + 2 * s, top, (sh - 4) * s, s], [px, top + s, sh * s, base - top],
        [hx + s, hy, (hd - 2) * s, s], [hx, hy + s, hd * s, (hd - 1) * s],
        [hx + 2 * s, hy + hd * s, (hd - 4) * s, 2 * s]];
      if (arm || stk) rs.push([ax, ay + 4 * s, 3 * s, top - ay - 3 * s], [ax - s, ay, 5 * s, 5 * s]);
      for (j = 0; j < 5; j++) for (q = 0; q < rs.length; q++) {
        o = rs[q]; R(c, j < 4 ? C.bone : '#000', o[0] + O[j][0], o[1] + O[j][1], o[2], o[3]);
      }
      if (stk) { R(c, '#000', ax + s, ay - 6 * s, s, 6 * s); R(c, C.lilac, ax + s, ay - 8 * s, 2 * s, 2 * s); }
      px += (sh - 4 + r() * 6) * s | 0;
    }
  }
  function bob(t) { bobAt = t == null ? Date.now() : t; }
  /* K8 */
  function podium(c, x, y, name, s) {
    var i, by = y + 4 * s;
    R(c, C.goldLo, x, y, 32 * s, 4 * s);
    for (i = 0; i < 7; i++) R(c, i % 2 ? C.blood : C.curtainLo, x + (2 + i * 4) * s, by, 4 * s, 30 * s);
    R(c, C.goldLo, x + 2 * s, by + 20 * s, 28 * s, 2 * s);
    R(c, C.curtainLo, x, by + 30 * s, 32 * s, 6 * s);
    R(c, C.bone, x + 4 * s, by + 4 * s, 24 * s, 10 * s);
    R(c, '#000', x + 5 * s, by + 5 * s, 22 * s, 8 * s);
    txt(c, name, x + 16 * s, by + 9 * s - 8, C.bone, 'center');
  }
  /* K9: cells {name, hp, max, col, face(ctx,x,y)} */
  function strip(c, x, y, w, cells) {
    var cw = Math.min(256, ((w / cells.length) | 0)), i, e, a, bw, f;
    for (i = 0; i < cells.length; i++) {
      e = cells[i]; a = x + i * cw; bw = cw - 96;
      f = Math.max(0, Math.min(bw, (bw * e.hp / (e.max || 1)) | 0));
      frame(c, a, y, cw, 56, true);
      R(c, e.col || C.gold, a, y, cw, 4);
      R(c, C.ink, a + 8, y + 8, 40, 40);
      if (e.face) e.face(c, a + 8, y + 8);
      txt(c, e.name, a + 56, y + 8, C.bone);
      txt(c, 'HP', a + 56, y + 28, C.gold);
      txt(c, e.hp + '/' + e.max, a + cw - 8, y + 8, C.bone, 'right');
      R(c, C.curtainLo, a + 88, y + 32, bw, 8);
      R(c, C.gold, a + 88, y + 32, f, 8);
      R(c, '#FFF2C4', a + 88, y + 32, f, 2);
    }
  }
  /* K10: state 0 off 1 usable 2 on; glyph 7 rows of 0/1 */
  function cmd(c, x, y, glyph, state, caption) {
    var on = state === 2, r, k;
    frame(c, x, y, 40, 40, true, state ? C.goldLo : C.edge);
    if (on) R(c, C.gold, x + 2, y + 2, 36, 36);
    c.fillStyle = on ? '#000' : state ? C.bone : C.edge;
    for (r = 0; r < 7; r++) for (k = 0; k < 7; k++)
      if (glyph[r].charAt(k) === '1') c.fillRect(x + 6 + k * 4, y + 6 + r * 4, 4, 4);
    if (on && caption) plate(c, x + 20, y + 44, caption, { bar: false, cx: true, col: C.gold });
  }

  NEU.stage = {
    C: C, rng: rng, frame: frame, plate: plate, curtain: curtain, valance: valance, lamp: lamp,
    cone: cone, bulbs: bulbs, floor: floor, crowd: crowd, bob: bob, podium: podium, strip: strip,
    cmd: cmd, bake: bake
  };
})();
