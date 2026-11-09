/* cart.js — the mine ride after the painting. Four rails, oncoming
   carts, gaps you jump. Kernel scene "cart". One 60 Hz frame per step. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var STEP = 1 / 60, RIDE = 4500, MID = 2250, HOLE = 48, HIT = 18, TELE = 30, AIR = 36, RAIL = 27;
  var EV = [], CLEAR, overlay, canvas, ctx;
  var live = false, reduced = false;
  var spk = [], leanX = 0;
  var frames, lane, jumpN, dead, done, phase, holeN, checkpoint, cpLane, sparks, dust, held, sent;
  var deathT, respT, respLane, respFrames, deathLane, deathKind, respX, respY;

  (function () {
    var f = 180, n = 0, cartLane = 1;
    while (f < 4380) {
      if (n % 3 === 2) EV.push({ f: f, kind: 'gap' });
      else {
        EV.push({ f: f, kind: 'cart', lane: cartLane % 4 });
        cartLane++;
      }
      f += 186;
      n++;
    }
  })();

  function buildClear() {
    var rec = [], cursor = 0, here = 1, i, ev, dir;
    function emit(at, key) {
      var gap = (at - 1) - cursor;
      if (gap > 0) rec.push([gap, '']);
      rec.push([1, key]);
      cursor = at;
    }
    for (i = 0; i < EV.length; i++) {
      ev = EV[i];
      if (ev.kind === 'cart' && ev.lane === here) {
        dir = here < 3 ? 'down' : 'up';
        emit(ev.f - TELE, dir);
        here += dir === 'down' ? 1 : -1;
      } else if (ev.kind === 'gap') emit(ev.f - 10, 'jump');
    }
    if (cursor < RIDE + HOLE) rec.push([RIDE + HOLE - cursor, '']);
    return rec;
  }
  CLEAR = buildClear();

  function motion() {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function deathLen() { return reduced ? 40 : 66; }
  function respawnLen() { return reduced ? 28 : 48; }
  function reset() {
    frames = 0; lane = 1; jumpN = 0; dead = false; done = false;
    phase = 'ride'; holeN = 0; checkpoint = false; cpLane = 1;
    sparks = 0; dust = []; spk = []; leanX = 0; sent = false;
    deathT = 0; respT = 0; respLane = 1; respFrames = 0;
    deathLane = 1; deathKind = ''; respX = 0; respY = 0;
    held = { up: false, down: false, jump: false };
  }
  function ensure() {
    overlay = document.getElementById('cart');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cart';
      overlay.className = 'cart';
      overlay.hidden = true;
      canvas = document.createElement('canvas');
      canvas.id = 'cartCanvas';
      canvas.width = 480;
      canvas.height = 270;
      var hint = document.createElement('p');
      hint.className = 'cart__hint';
      hint.innerHTML = 'lanes <span data-k="a"></span>/<span data-k="d"></span>/←→  jump <span data-k="z"></span>/<span data-k="e"></span>/<span data-k="w"></span>/space/↑';
      overlay.appendChild(canvas);
      overlay.appendChild(hint);
      document.body.appendChild(overlay);
    }
    canvas = document.getElementById('cartCanvas');
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (ctx) ctx.imageSmoothingEnabled = false;
  }
  function keyString() {
    var s = '';
    if (keys.up) s += 'up ';
    if (keys.down) s += 'down ';
    if (keys.jump) s += 'jump ';
    return s;
  }
  function shift(dir) {
    lane += dir;
    sparks++;
    leanX = dir * 2;
    for (var q = 0; q < 6; q++) spk.push({ x: lx(lane, 226) - dir * 14, y: 220, vx: dir * (1 + q * 0.4), vy: -2 - (q % 3), life: 18 });
    if (NEU.juice) {
      NEU.juice.burst(240, 190, 10, '#ffb040', 160);
      NEU.juice.hit('small', { dx: dir, dy: 0 });
    }
  }
  function die(kind) {
    dead = true;
    jumpN = 0;
    phase = 'dying';
    deathT = 0;
    deathLane = lane;
    deathKind = kind || 'cart';
    respFrames = checkpoint ? MID : 0;
    respLane = checkpoint ? cpLane : 1;
    if (NEU.juice) {
      NEU.juice.hit('medium', { dx: 0, dy: 1 });
      if (NEU.juice.burst) NEU.juice.burst(lx(lane, 226), 176, 14, '#FFC46A', 180);
    }
  }
  function finish() {
    phase = 'done';
    done = true;
    if (sent) return;
    sent = true;
    if (NEU.save) NEU.save.flag('cart_done', 1);
    if (NEU.elevator && typeof NEU.elevator.open === 'function') NEU.elevator.open();
  }
  /* ── art: baked once, composed per frame ─────────────────────────── */
  var RING = ['#0A0806', '#0E0B08', '#14100C', '#1A140F', '#1E1812', '#241C15', '#2A2018', '#3A2C20'];
  var ZS = [12, 7.5, 5, 3.6, 2.7, 2, 1.6, 1.25];
  var IRON = ['#2A2420', '#4A3E34', '#6A5A4A', '#9A8A70', '#8A7A60'];
  var RUST = ['#5A2A18', '#8A4A2A', '#B06A3A', '#C8844E', '#8A5A32'];
  var art = null;
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function hs(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rect(z) {
    var s = 1 / z;
    return [Math.round(240 - 330 * s), Math.round(60 - 90 * s), Math.round(240 + 330 * s), Math.round(60 + 230 * s)];
  }
  function sc(y) { return (y - 60) / 230; }
  function lx(i, y) { return Math.round(240 + (i - 1.5) * 130 * sc(y)); }
  function halo(x, y, r, col, a) {
    var L = NEU.engineLook, k, prev;
    if (L && L.glow) { L.glow(ctx, x, y, r, col, a); return; }
    prev = ctx.globalAlpha;
    ctx.fillStyle = col;
    for (k = 3; k >= 1; k--) {
      ctx.globalAlpha = a * 0.5 / k * 1.5;
      ctx.fillRect(x - r * k / 3 | 0, y - r * k / 3 | 0, 2 * r * k / 3 | 0, 2 * r * k / 3 | 0);
    }
    ctx.globalAlpha = prev;
  }
  function bakeTunnel() {
    var c = mk(480, 270), g = c.getContext('2d'), k, r, p, n, bx, by, bw, e, t, i, col;
    function F(x, y, w, h, s) { g.fillStyle = s; g.fillRect(x, y, w, h); }
    for (k = 7; k >= 0; k--) {
      r = rect(ZS[k]);
      F(r[0], r[1], r[2] - r[0], r[3] - r[1], RING[k]);
      if (k < 7) {
        /* rim light upper-left, shade lower-right, on the ring's inner edge */
        F(r[0], r[1], r[2] - r[0], 1, RING[k + 1]);
        F(r[0], r[1], 1, r[3] - r[1], RING[k + 1]);
        F(r[0], r[3] - 1, r[2] - r[0], 1, RING[Math.max(0, k - 1)]);
        F(r[2] - 1, r[1], 1, r[3] - r[1], RING[Math.max(0, k - 1)]);
        /* rock bumps along the inner edge */
        n = 6 + (k & 3);
        for (i = 0; i < n; i++) {
          e = (hs(i, k, 7) * 4) | 0;
          t = hs(i, k, 9);
          bw = 2 + ((k * 4 / 7 * hs(i, k, 3) + 1) | 0);
          col = RING[k + 1];
          if (e === 0) { bx = r[0] + 1; by = r[1] + ((r[3] - r[1] - bw) * t | 0); }
          else if (e === 1) { bx = r[2] - 1 - bw; by = r[1] + ((r[3] - r[1] - bw) * t | 0); }
          else { bx = r[0] + ((r[2] - r[0] - bw) * t | 0); by = r[1] + 1; }
          F(bx, by, bw, bw, col);
          F(bx, by + bw, bw, 1, RING[k]);
          F(bx + bw, by, 1, bw, RING[Math.max(0, k - 1)]);
        }
      }
    }
    /* ballast specks on the floor */
    for (i = 0; i < 360; i++) {
      p = 64 + (hs(i, 1, 5) * 206 | 0);
      k = Math.min(7, 1 + ((p - 60) / 30 | 0));
      F((hs(i, 2, 5) * 478) | 0, p, 1 + (k >> 2), 1, RING[Math.min(7, k + 1)]);
    }
    return c;
  }
  function bakeRails(only, body, top) {
    var c = mk(480, 270), g = c.getContext('2d'), i, y, s, cx, hw, rw, side, x0;
    for (i = (only === undefined ? 0 : only); i < (only === undefined ? 4 : only + 1); i++) {
      for (y = 64; y < 270; y++) {
        s = sc(y); cx = lx(i, y); hw = Math.round(29 * s); rw = Math.max(1, Math.round(5 * s));
        for (side = -1; side <= 1; side += 2) {
          x0 = cx + side * hw - (rw >> 1);
          g.fillStyle = only === undefined ? '#2A2E34' : '#8A2A1C';
          g.fillRect(x0, y, rw, 1);
          g.fillStyle = body || '#5A6470';
          g.fillRect(x0, y, Math.max(1, rw - 1), 1);
          if (rw > 2) { g.fillStyle = top || '#9AA0A8'; g.fillRect(x0, y, 1, 1); }
        }
      }
    }
    return c;
  }
  function bakeCart(P, wheels) {
    var c = mk(64, 40), g = c.getContext('2d'), r, ins, x, y;
    function F(a, b, w, h, s) { g.fillStyle = s; g.fillRect(a, b, w, h); }
    for (r = 0; r < 28; r++) {
      ins = (6 * r / 27) | 0; y = 6 + r;
      F(ins, y, 64 - 2 * ins, 1, '#12081E');
      F(ins + 1, y, 62 - 2 * ins, 1, P[1]);
      F(ins + 1, y, 3, 1, P[2]);
      F(63 - ins - 4, y, 3, 1, P[0]);
      if (r > 23) F(ins + 1, y, 62 - 2 * ins, 1, P[0]);
    }
    F(2, 5, 60, 1, '#12081E');
    F(3, 6, 58, 1, P[3]);
    F(3, 7, 58, 2, P[2]);
    F(2, 18, 60, 1, P[0]);
    F(2, 19, 60, 1, P[2]);
    for (x = 8; x < 58; x += 8) { F(x, 10, 2, 2, P[4]); F(x, 22, 2, 2, P[4]); }
    if (!wheels) return c;
    return c;
  }
  function bakeWheels() {
    var out = [], f, c, g, W = [4, 8, 10, 12, 12, 12, 12, 12, 12, 10, 8, 4], y, i;
    for (f = 0; f < 4; f++) {
      c = mk(12, 12); g = c.getContext('2d');
      for (y = 0; y < 12; y++) { g.fillStyle = '#1A1614'; g.fillRect((12 - W[y]) >> 1, y, W[y], 1); }
      g.fillStyle = '#4A3E34';
      if (f & 1) { for (i = 2; i < 10; i++) { g.fillRect(i, i, 1, 1); g.fillRect(11 - i, i, 1, 1); } }
      else { g.fillRect(5, 2, 2, 8); g.fillRect(2, 5, 8, 2); }
      out.push(c);
    }
    return out;
  }
  function bakeCone() {
    var c = mk(120, 140), g = c.getContext('2d'), s, y, t, hw, A = [0.14, 0.09, 0.05], T = [14, 26, 40];
    for (s = 2; s >= 0; s--) {
      g.fillStyle = '#FFE8A0'; g.globalAlpha = A[s];
      for (y = 0; y < 140; y += 2) {
        t = y / 139; hw = Math.round(T[s] * (1 - t) + (4 + s * 2) * t);
        g.fillRect(60 - hw, y, hw * 2, 2);
      }
    }
    return c;
  }
  function ensureArt() {
    if (art) return;
    art = {
      tun: bakeTunnel(), rails: bakeRails(), hot: [], iron: bakeCart(IRON, true), rust: bakeCart(RUST, false),
      wheels: bakeWheels(), cone: bakeCone()
    };
    for (var i = 0; i < 4; i++) art.hot.push(bakeRails(i, '#FF5A3C', '#FFC46A'));
  }
  function railHot(i) {
    var k, ev, left;
    for (k = 0; k < EV.length; k++) {
      ev = EV[k];
      if (ev.kind !== 'cart' || ev.lane !== i) continue;
      left = ev.f - frames;
      if (left > 0 && left <= RAIL) return true;
    }
    return false;
  }
  /* reduced motion quantises approach to quarter steps (a 1.6 Hz hold) */
  function qu(u) { return reduced ? Math.floor(u * 4) / 4 : u; }
  function dispImg(im, x, y, w, h) { ctx.drawImage(im, Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function drawFrames(fr) {
    var ph = (fr * 0.06) % 1.9, nf = Math.floor(fr * 0.06 / 1.9), j, z, s, r, pw, lh, id, lx0, ly, lw, lhh;
    for (j = 5; j >= 0; j--) {
      z = 1.25 + j * 1.9 - ph; id = j + nf;
      if (z < 1.25) continue;
      s = 1 / z; r = rect(z);
      pw = Math.max(1, Math.round(40 * s)); lh = Math.max(1, Math.round(30 * s));
      ctx.fillStyle = '#3A2414';
      ctx.fillRect(r[0], r[1], pw, r[3] - r[1]);
      ctx.fillRect(r[2] - pw, r[1], pw, r[3] - r[1]);
      ctx.fillRect(r[0], r[1], r[2] - r[0], lh);
      if (pw > 2) {
        ctx.fillStyle = '#5A3418';
        ctx.fillRect(r[0] + 1, r[1] + lh, pw - 2, r[3] - r[1] - lh);
        ctx.fillRect(r[2] - pw + 1, r[1] + lh, pw - 2, r[3] - r[1] - lh);
        ctx.fillRect(r[0], r[1] + 1, r[2] - r[0], Math.max(1, lh - 2));
        ctx.fillStyle = '#8A5A32';
        ctx.fillRect(r[0] + 1, r[1] + lh, 1, r[3] - r[1] - lh);
        ctx.fillRect(r[2] - pw + 1, r[1] + lh, 1, r[3] - r[1] - lh);
        ctx.fillRect(r[0], r[1], r[2] - r[0], 1);
        ctx.fillStyle = '#3A2414';
        ctx.fillRect(r[0], r[1] + lh - 1, r[2] - r[0], 1);
      }
      if (id % 3 === 0) {
        lw = Math.max(2, Math.round(6 * s)); lhh = Math.max(3, Math.round(8 * s));
        lx0 = 240 - (lw >> 1); ly = r[1] + lh + Math.max(1, Math.round(4 * s));
        halo(240, ly + (lhh >> 1), Math.round(24 * s) + 4, '#FFB347', 0.2);
        ctx.fillStyle = '#3A2414'; ctx.fillRect(240, r[1] + lh, 1, ly - r[1] - lh);
        ctx.fillStyle = '#FFD060'; ctx.fillRect(lx0, ly, lw, lhh);
        if (lw > 2) { ctx.fillStyle = '#FFF6C0'; ctx.fillRect(240 - 0, ly + 1, 1, Math.max(1, lhh - 2)); }
      }
    }
  }
  function drawSleepers(fr) {
    var ph = (fr * 0.045) % 0.9, k, d, y, s, h, i, cx, hw;
    for (k = 12; k >= 0; k--) {
      d = 1.1 + k * 0.9 - ph;
      if (d < 1.1 || d > 12) continue;
      s = 1 / d; y = Math.round(60 + 230 * s);
      if (y > 268) continue;
      h = Math.max(1, Math.round(5 * s)); hw = Math.round(40 * s);
      for (i = 0; i < 4; i++) {
        cx = lx(i, y);
        ctx.fillStyle = '#3a2418';
        ctx.fillRect(cx - hw, y, hw * 2, h);
        if (h > 2) { ctx.fillStyle = '#5A3418'; ctx.fillRect(cx - hw, y, hw * 2, 1); }
      }
    }
  }
  /* the threatened lane: its rails carry a string of lamps marching at you */
  function drawLit(i, fr) {
    var y, s, cx, hw, rw, h, off = (fr * 0.5) % 14 | 0;
    ctx.fillStyle = '#ffe080';
    for (y = 64 + off; y < 262; y += 14) {
      s = sc(y); cx = lx(i, y); hw = Math.round(29 * s); rw = Math.max(1, Math.round(5 * s)); h = 6 + Math.round(6 * s);
      ctx.fillRect(cx - hw - (rw >> 1), y, rw, h);
      ctx.fillRect(cx + hw - (rw >> 1), y, rw, h);
    }
  }
  function drawHole(ev) {
    var t = frames - (ev.f - 40), u, s, y, h, x0, x1, i;
    if (t < 0 || frames > ev.f + HIT) return;
    u = qu(Math.min(1, t / 58));
    s = 0.12 + 0.88 * u;
    y = Math.round(64 + 176 * u * u * 0.98 + 14 * u);
    h = Math.max(3, Math.round(34 * s));
    x0 = lx(0, y + h) - Math.round(44 * s); x1 = lx(3, y + h) + Math.round(44 * s);
    ctx.fillStyle = '#E4602A'; ctx.fillRect(x0, y - 1, x1 - x0, 1);
    ctx.fillStyle = '#000'; ctx.fillRect(x0, y, x1 - x0, h);
    ctx.fillStyle = '#E4602A'; ctx.fillRect(x0, y + h, x1 - x0, 1);
    ctx.fillStyle = '#FFB347';
    for (i = 0; i < 3; i++) ctx.fillRect(x0 + 8 + ((hs(i, ev.f, 1) * (x1 - x0 - 16)) | 0), y + 1 + ((hs(i, ev.f, 2) * (h - 2)) | 0), 1, 1);
  }
  /* a heap of ore rides in every oncoming cart, so it grows with depth like the cart */
  function ore(cx, yt, s) {
    var r = function (dx, dy, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(cx + dx * s), Math.round(yt + dy * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))); };
    r(-20, 1, 40, 5, '#6a5038'); r(-13, -3, 26, 5, '#6a5038'); r(-3, -6, 8, 4, '#6a5038');
    r(-20, 1, 40, 1, '#8A6A48'); r(-13, -3, 26, 1, '#8A6A48'); r(-3, -6, 8, 1, '#8A6A48');
    r(-8, 3, 3, 2, '#3A2418'); r(6, 2, 4, 2, '#3A2418'); r(-1, -2, 2, 2, '#C8844E');
  }
  function drawCart(ev) {
    var u = qu(Math.max(0, Math.min(1, 1 - (ev.f - frames) / 150))), s = 0.3 + 0.7 * u, w = 64 * s, h = 40 * s, yt = 70 + 116 * u, cx = lx(ev.lane, yt + h);
    ctx.fillStyle = '#0A0806';
    ctx.fillRect(Math.round(cx - w / 2 + 2 * s), Math.round(yt + h - 3 * s), Math.round(w - 4 * s), Math.max(1, Math.round(4 * s)));
    dispImg(art.rust, cx - w / 2, yt, w, h);
    ore(cx, yt, s);
    ctx.fillStyle = '#1A1614';
    ctx.fillRect(Math.round(cx - w / 2 + 5 * s), Math.round(yt + h - 11 * s), Math.round(12 * s), Math.round(11 * s));
    ctx.fillRect(Math.round(cx + w / 2 - 17 * s), Math.round(yt + h - 11 * s), Math.round(12 * s), Math.round(11 * s));
    ctx.fillStyle = '#6A5A4A';
    ctx.fillRect(Math.round(cx - w / 2 + 9 * s), Math.round(yt + h - 7 * s), Math.max(1, Math.round(4 * s)), Math.max(1, Math.round(4 * s)));
    ctx.fillRect(Math.round(cx + w / 2 - 13 * s), Math.round(yt + h - 7 * s), Math.max(1, Math.round(4 * s)), Math.max(1, Math.round(4 * s)));
  }
  /* the hub is live so the socket, cap and sheen stay crisp over the spinning spokes */
  function hub(x, y) {
    ctx.fillStyle = '#14110e'; ctx.fillRect(x + 3, y + 3, 6, 6);
    ctx.fillStyle = '#6A5A4A'; ctx.fillRect(x + 4, y + 4, 4, 4);
    ctx.fillStyle = '#9A8A70'; ctx.fillRect(x + 4, y + 4, 2, 1);
  }
  function drawPlayerCart(px, py) {
    var L = NEU.engineLook, wf = reduced ? 0 : ((frames / 7) | 0) & 3, lean = reduced ? 0 : leanX;
    ctx.fillStyle = '#0A0806';
    ctx.fillRect(px - 28, py + 36, 56, 4);
    ctx.fillStyle = '#14100C';
    ctx.fillRect(px - 32, py + 38, 64, 2);
    if (L && L.drawPlayer) L.drawPlayer(ctx, px + lean, py + 16, 'up', 0, false, 2, reduced ? 0 : frames * 16);
    else {
      ctx.fillStyle = '#f0d8a8'; ctx.fillRect(px - 8 + lean, py - 8, 16, 14);
      ctx.fillStyle = '#3a2418'; ctx.fillRect(px - 8 + lean, py - 12, 16, 6);
    }
    dispImg(art.iron, px - 32, py, 64, 40);
    ctx.drawImage(art.wheels[wf], px - 27, py + 28);
    ctx.drawImage(art.wheels[wf], px + 15, py + 28);
    hub(px - 27, py + 28); hub(px + 15, py + 28);
    ctx.fillStyle = '#fff6c0'; ctx.fillRect(px + 20, py + 1, 6, 4);
    ctx.fillStyle = '#FFE8A0'; ctx.fillRect(px + 21, py, 4, 1);
  }
  function draw() {
    var i, ev, py, px, p, shook, lp, dk, fall, rk, ease, fade;
    if (!ctx) return;
    ensureArt();
    ctx.imageSmoothingEnabled = false;
    shook = NEU.juice && NEU.juice.begin ? NEU.juice.begin(ctx, 480, 270) : false;
    lp = reduced ? 0 : frames;
    ctx.drawImage(art.tun, 0, 0);
    drawFrames(lp);
    drawSleepers(lp);
    ctx.drawImage(art.rails, 0, 0);
    for (i = 0; i < 4; i++) if (railHot(i)) { ctx.drawImage(art.hot[i], 0, 0); drawLit(i, lp); }
    for (i = 0; i < EV.length; i++) {
      ev = EV[i];
      if (ev.kind === 'gap') { drawHole(ev); continue; }
      if (frames < ev.f - 150 || frames > ev.f + 8) continue;
      drawCart(ev);
    }
    py = 186 - (jumpN > 0 ? 18 : 0);
    px = lx(lane, 226);
    ctx.globalAlpha = 1;
    if (phase === 'dying') {
      dk = Math.min(1, deathT / deathLen());
      fall = reduced ? 0 : Math.round(dk * dk * (deathKind === 'gap' ? 64 : 40));
      px = lx(deathLane, 226) + (reduced ? 0 : Math.round(dk * dk * (deathLane < 1 ? -12 : 12)));
      py += fall;
      ctx.globalAlpha = Math.max(0.35, 1 - dk * 0.65);
      ctx.drawImage(art.cone, px + 23 - 60, py + 3 - 136);
      drawPlayerCart(px, py);
      ctx.globalAlpha = 1;
    } else if (phase === 'respawn') {
      rk = Math.min(1, respT / respawnLen());
      ease = 1 - Math.pow(1 - rk, 3);
      px = Math.round(respX + (lx(respLane, 226) - respX) * ease);
      py = Math.round(respY + (186 - respY) * ease);
      ctx.drawImage(art.cone, px + 23 - 60, py + 3 - 136);
      drawPlayerCart(px, py);
    } else {
      ctx.drawImage(art.cone, px + 23 - 60, py + 3 - 136);
      drawPlayerCart(px, py);
    }
    if (!reduced) {
      ctx.fillStyle = '#8A7A60';
      for (i = 0; i < dust.length; i++) {
        p = dust[i];
        ctx.fillRect(p.x | 0, p.y | 0, 1, 1 + (p.life > 20 ? 1 : 0));
      }
      ctx.fillStyle = '#FFC46A';
      for (i = 0; i < spk.length; i++) ctx.fillRect(spk[i].x | 0, spk[i].y | 0, 2, 2);
    }
    /* the dark mine: everything outside the headlamp cone is dimmed */
    ctx.beginPath();
    ctx.rect(0, 0, 480, 270);
    ctx.moveTo(px, py);
    ctx.lineTo(px - 78, 16);
    ctx.lineTo(px + 78, 16);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fill('evenodd');
    if (phase === 'hole' || phase === 'done') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 270 - (phase === 'done' ? 270 : holeN * 8), 480, 270);
    }
    fade = 0;
    if (phase === 'dying') fade = Math.max(0, Math.min(1, (deathT - (deathLen() - 18)) / 18));
    else if (phase === 'respawn') fade = Math.max(0, Math.min(1, 1 - respT / 18));
    if (fade > 0) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 480, 270);
      ctx.globalAlpha = 1;
    }
    if (NEU.juice && NEU.juice.drawParts) NEU.juice.drawParts(ctx, STEP);
    if (NEU.juice && NEU.juice.end) NEU.juice.end(ctx, shook);
  }
  function getState() {
    var g = [], i;
    for (i = 0; i < EV.length; i++) {
      if (EV[i].kind === 'cart' && frames >= EV[i].f - TELE && frames < EV[i].f) g.push(EV[i].lane);
    }
    return {
      t: frames / 60, frames: frames, lane: lane, jumping: jumpN > 0,
      dead: dead, done: done, phase: phase, checkpoint: checkpoint,
      glints: g, dust: dust.length, sparks: sparks, hole: phase === 'hole' || phase === 'done'
    };
  }
  function open() {
    ensure();
    if (live) close();
    motion();
    reset();
    if (NEU.save) NEU.save.flag('cart_mid', null);
    live = true;
    overlay.hidden = false;
    if (NEU.keys && NEU.keys.refresh) NEU.keys.refresh();
    NEU.activeMinigame = 'cart';
    document.body.classList.add('is-playing');
    if (NEU.kernel) NEU.kernel.push('cart');
    draw();
    return true;
  }
  function close() {
    if (!live && (!overlay || overlay.hidden)) return;
    live = false;
    if (overlay) overlay.hidden = true;
    if (NEU.activeMinigame === 'cart') NEU.activeMinigame = null;
    document.body.classList.remove('is-playing');
    if (NEU.kernel && NEU.kernel.current() === 'cart') NEU.kernel.pop();
  }
  function deathStep() {
    deathT++;
    if (deathT >= deathLen()) startRespawn();
  }
  function startRespawn() {
    frames = respFrames;
    lane = respLane;
    jumpN = 0;
    held = { up: false, down: false, jump: false };
    phase = 'respawn';
    respT = 0;
    respX = lx(deathLane, 226);
    respY = 186 + (reduced ? 0 : 54);
  }
  function respawnStep() {
    respT++;
    if (respT >= respawnLen()) {
      phase = 'ride';
      dead = false;
    }
  }
  function step(dt, input) {
    var up, down, jp, i, ev, p;
    if (!live) return null;
    /* ponytail: one fixed 60 Hz frame; kernel tick slices real time. */
    if (arguments.length < 2) input = keyString();
    if (phase === 'done') return getState();
    if (phase === 'hole') {
      holeN++;
      if (reduced || holeN >= HOLE) finish();
      draw();
      return getState();
    }
    if (phase === 'dying') {
      deathStep();
      draw();
      return getState();
    }
    if (phase === 'respawn') {
      respawnStep();
      draw();
      return getState();
    }
    dead = false;
    frames++;
    up = input.indexOf('up') >= 0;
    down = input.indexOf('down') >= 0;
    jp = input.indexOf('jump') >= 0;
    if (up && !held.up && lane > 0) shift(-1);
    if (down && !held.down && lane < 3) shift(1);
    if (jp && !held.jump && jumpN <= 0) jumpN = AIR;
    held.up = up; held.down = down; held.jump = jp;
    if (jumpN > 0) jumpN--;
    if (leanX) leanX += leanX > 0 ? -1 : 1;
    for (i = spk.length - 1; i >= 0; i--) {
      p = spk[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.5;
      if (--p.life <= 0) spk.splice(i, 1);
    }
    if (frames % 8 === 0) {
      if (dust.length > 40) dust.shift();
      dust.push({ x: lx(lane, 226) + 23 + ((frames * 17) % 60) - 30, y: 70 + (frames * 13) % 110, life: 36 });
    }
    for (i = dust.length - 1; i >= 0; i--) {
      p = dust[i];
      p.y += 1; p.x -= 1; p.life--;
      if (p.life <= 0) dust.splice(i, 1);
    }
    for (i = 0; i < EV.length; i++) {
      ev = EV[i];
      if (frames < ev.f || frames >= ev.f + HIT) continue;
      if (ev.kind === 'cart' && ev.lane === lane) { die('cart'); break; }
      if (ev.kind === 'gap' && jumpN <= 0) { die('gap'); break; }
    }
    if (!dead && !checkpoint && frames >= MID) {
      checkpoint = true;
      cpLane = lane;
      if (NEU.save) NEU.save.flag('cart_mid', { t: 37.5, lane: lane });
    }
    if (!dead && frames >= RIDE) {
      phase = 'hole';
      holeN = 0;
      if (reduced) finish();
    }
    draw();
    return getState();
  }
  function tick(dtMs) {
    var acc = tick.acc || 0, n = 0;
    if (!live) return;
    if (NEU.juice && NEU.juice.frozen && NEU.juice.frozen()) { draw(); return; }
    acc += Math.min(0.25, Math.max(0, dtMs) / 1000);
    while (acc >= STEP && n < 8) { step(STEP); acc -= STEP; n++; }
    tick.acc = acc;
  }
  function replay(recording) {
    var old = NEU.kernel ? NEU.kernel.stack.slice() : null;
    var i, j, pair, st, framesN = 0, deaths = 0, was = false, stop = false, cleared;
    open();
    for (i = 0; i < recording.length && !stop; i++) {
      pair = recording[i];
      for (j = 0; j < pair[0] && !stop; j++) {
        st = step(STEP, pair[1]);
        framesN++;
        if (st.dead && !was) deaths++;
        was = st.dead;
        if (st.done) stop = true;
      }
    }
    cleared = !!(st && st.done);
    close();
    if (old && NEU.kernel) {
      NEU.kernel.stack.length = 0;
      for (i = 0; i < old.length; i++) NEU.kernel.stack.push(old[i]);
    }
    return { cleared: cleared, deaths: deaths, frames: framesN };
  }
  var keys = { up: false, down: false, jump: false };
  function onKey(e) {
    var routed, k, kk, down;
    if (!live) return;
    routed = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (routed.swallow) return;
    k = routed.to;
    kk = k.length === 1 ? k.toLowerCase() : k;
    down = e.type === 'keydown';
    if (kk === 'a' || k === 'ArrowLeft') { keys.up = down; e.preventDefault(); }
    else if (kk === 'd' || k === 'ArrowRight') { keys.down = down; e.preventDefault(); }
    else if (kk === 'z' || kk === 'e' || kk === 'w' || k === ' ' || k === 'Spacebar' || k === 'ArrowUp') { keys.jump = down; e.preventDefault(); }
    else if (down && k === 'Escape') close();
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  NEU.cart = {
    open: open, close: close, step: step, replay: replay,
    get state() { return live ? getState() : null; },
    get running() { return live; },
    events: EV,
    CLEAR: CLEAR
  };
  if (NEU.kernel) NEU.kernel.register('cart', {
    tick: tick, open: open, close: close,
    running: function () { return live; }
  });
})();
