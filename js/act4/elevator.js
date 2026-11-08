/* elevator.js — dusty cabin after the mine. Buttons 0 and ?.
   Kernel scene "elevator". One 60 Hz frame per step. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var STEP = 1 / 60;
  var W = 480, H = 270;
  var overlay, canvas, ctx, screen, live, reduced;
  var phase, y, yFrom, t, door, light, lightT, gear, piston, mountain, sent;
  var sirenOn, dust, actx, sirenOsc, sirenGain;

  function motion() {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function reset() {
    phase = 'cabin'; y = 0; yFrom = 0; t = 0; door = 0; gear = 0; piston = 0;
    light = false; lightT = 0; mountain = false; sent = false; sirenOn = false;
    dust = [];
    stopSiren();
    if (screen) screen.textContent = '';
  }
  function ensure() {
    var pad, b0, bq;
    overlay = document.getElementById('elevator');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'elevator';
      overlay.className = 'elv';
      overlay.hidden = true;
      canvas = document.createElement('canvas');
      canvas.id = 'elvCanvas';
      canvas.width = W;
      canvas.height = H;
      screen = document.createElement('p');
      screen.id = 'elvScreen';
      screen.className = 'elv__screen';
      pad = document.createElement('div');
      pad.className = 'elv__pad';
      b0 = document.createElement('button');
      b0.type = 'button';
      b0.id = 'elv0';
      b0.textContent = '0';
      bq = document.createElement('button');
      bq.type = 'button';
      bq.id = 'elvQ';
      bq.textContent = '?';
      pad.appendChild(b0);
      pad.appendChild(bq);
      overlay.appendChild(canvas);
      overlay.appendChild(screen);
      overlay.appendChild(pad);
      document.body.appendChild(overlay);
      b0.addEventListener('click', function () { press('0'); });
      bq.addEventListener('click', function () { press('?'); });
    }
    canvas = document.getElementById('elvCanvas');
    screen = document.getElementById('elvScreen');
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (ctx) ctx.imageSmoothingEnabled = false;
  }
  function audio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!actx) {
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended' && actx.resume) actx.resume();
    return actx;
  }
  function buzz(freq, type, dur, hold) {
    var a = audio(), o, g, t0;
    if (!a) return null;
    o = a.createOscillator();
    g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.06;
    o.connect(g);
    g.connect(a.destination);
    t0 = a.currentTime || 0;
    o.start(t0);
    if (!hold) o.stop(t0 + dur);
    return { o: o, g: g };
  }
  function grind() { buzz(55, 'sawtooth', 0.35, false); }
  function startSiren() {
    var node;
    if (sirenOsc) { sirenOn = true; return; }
    node = buzz(740, 'square', 0, true);
    if (!node) return;
    sirenOsc = node.o;
    sirenGain = node.g;
    sirenGain.gain.value = 0.06;
    sirenOn = true;
  }
  function stopSiren() {
    sirenOn = false;
    if (!sirenOsc) return;
    try { sirenOsc.stop(actx && actx.currentTime ? actx.currentTime : 0); } catch (e) {}
    sirenOsc = null;
    sirenGain = null;
  }
  function pulse() {
    if (sirenGain) sirenGain.gain.value = light ? 0.06 : 0;
  }
  function press(which) {
    if (!live || sent) return;
    if (which === '0') {
      if (phase !== 'cabin' && phase !== 'floor') return;
      phase = 'floor';
      if (screen) screen.textContent = 'YOU ARE ON FLOOR 0';
      if (NEU.save) NEU.save.flag('elevator_floor', 1);
      if (NEU.talk) NEU.talk(['* YOU ARE ON FLOOR 0.'], 'narr');
      draw();
      return;
    }
    if (which !== '?' || phase === 'drop' || phase === 'rise' || phase === 'doors' || phase === 'vista') return;
    phase = 'drop';
    t = 0;
    yFrom = y;
    light = true;
    lightT = 0;
    grind();
    startSiren();
    if (!reduced && NEU.juice && NEU.juice.hit) NEU.juice.hit('large', { dy: 1, colour: '#ff2040' });
    draw();
  }
  function finish() {
    var opened = false;
    if (sent) return;
    sent = true;
    phase = 'vista';
    door = 1;
    piston = 1;
    mountain = true;
    stopSiren();
    if (NEU.save) NEU.save.flag('elevator_out', 1);
    if (NEU.plat && typeof NEU.plat.open === 'function') opened = NEU.plat.open('m0') === true;
    if (!opened) return;
    live = false;
    if (overlay) overlay.hidden = true;
    if (NEU.activeMinigame === 'elevator') NEU.activeMinigame = null;
    if (document.body && !(NEU.cart && NEU.cart.running)) document.body.classList.remove('is-playing');
    if (NEU.kernel && NEU.kernel.stack) {
      var i = NEU.kernel.stack.indexOf('elevator');
      if (i >= 0) NEU.kernel.stack.splice(i, 1);
    }
    if (NEU.cart && NEU.cart.close) NEU.cart.close();
  }
  /* ── art: every static layer is baked once ───────────────────────── */
  var art = null;
  var STEEL = ['#3A4048', '#5c656e', '#8e98a2', '#B8C2CA', '#d5dde4'];
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
  function F(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function bakeVista() {
    var c = mk(W, H), g = c.getContext('2d'), B = ['#0E1B2A', '#13263A', '#1B3A4B', '#3D6E8C', '#87A8B8', '#B8CCD6'];
    var i, x, y, h, k, top, a, b;
    for (i = 0; i < 6; i++) F(g, 0, i * 36, W, 36, B[i]);
    /* 2px ordered dither on every band seam */
    for (i = 1; i < 6; i++) for (x = 0; x < W; x += 2) F(g, x, i * 36 + ((x >> 1) & 1) * 2, 2, 2, B[i - 1]);
    g.globalAlpha = 0.3; F(g, 0, 176, W, 14, '#F8C890'); g.globalAlpha = 0.18; F(g, 0, 164, W, 12, '#F8C890'); g.globalAlpha = 1;
    /* stars in the upper sky */
    for (i = 0; i < 18; i++) F(g, (hs(i, 1, 2) * 478) | 0, (hs(i, 2, 2) * 60) | 0, 1, 1, '#B8CCD6');
    /* far ridge with snow caps */
    for (x = 0; x < W; x += 2) {
      top = 176 - Math.round(34 * Math.abs(Math.sin(x / 61)) + 18 * Math.abs(Math.sin(x / 23 + 1)) + 8 * Math.sin(x / 9));
      F(g, x, top, 2, 200 - top, '#2A4258');
      if (top < 150) F(g, x, top, 2, Math.min(7, 150 - top), '#E6EEF2');
      else if (top < 158) F(g, x, top, 2, 1, '#E6EEF2');
    }
    /* mid peak: lit face, body, snow */
    for (y = 58; y < 232; y++) {
      h = Math.round((y - 58) * 0.9);
      a = 330 - h; b = 330 + h;
      F(g, a, y, Math.round(h * 0.55), 1, '#314858');
      F(g, a + Math.round(h * 0.55), y, b - a - Math.round(h * 0.55), 1, '#1A2832');
      if (y < 98) {
        F(g, a + ((y & 4) ? 2 : 0), y, Math.round(h * 0.55) + 4, 1, '#EEF3F6');
        F(g, b - Math.round(h * 0.45), y, Math.round(h * 0.45) - ((y & 4) ? 3 : 0), 1, '#C9D8E0');
      }
    }
    F(g, 18, 140, 1, 1, '#1A2832');
    /* pine line */
    F(g, 0, 226, W, 44, '#0E1820');
    for (x = 0; x < W; x += 6) {
      k = 12 + ((hs(x, 5, 1) * 14) | 0);
      for (i = 0; i < k; i += 2) F(g, x + 3 - ((i / 3) | 0) - 1, 226 - k + i, 2 + (((i / 3) | 0) << 1), 2, '#0E1820');
    }
    F(g, 0, 262, W, 8, '#0A1018');
    return c;
  }
  /* ov: the big opening leaf is texture only; drawDoors lays the 3-step ramp and the rivets live */
  function bakeLeaf(w, h, mirror, ov) {
    var c = mk(w, h), g = c.getContext('2d'), x, y, k, hz = 12, L = mirror ? 1 : 0;
    if (ov) {
      for (x = 0; x < w; x++) {
        k = hs(x, 3, 4);
        if (k < 0.2) F(g, x, 0, 1, h, STEEL[0]);
        else if (k > 0.8) F(g, x, 0, 1, h, STEEL[3]);
      }
    } else for (x = 0; x < w; x += 2) {
      k = hs(x, 3, 4);
      /* light falls from the upper left: streaks lighter toward the outer edge */
      k = Math.min(4, Math.max(0, ((k * 3) | 0) + ((mirror ? (w - x) : x) > w * 0.6 ? 0 : 1)));
      F(g, x, 0, 2, h, STEEL[k]);
    }
    F(g, 0, 0, w, 2, STEEL[4]);
    F(g, 0, h - hz - 2, w, 2, STEEL[0]);
    /* inset panel frames */
    F(g, 10, 12, w - 24, 1, '#1c2128'); F(g, 10, h - hz - 14, w - 24, 1, '#1c2128');
    F(g, 10, 12, 1, h - hz - 25, '#1c2128'); F(g, w - 15, 12, 1, h - hz - 25, '#1c2128');
    F(g, 11, 13, w - 26, 1, STEEL[3]);
    /* rivet rows */
    if (!ov) for (y = 24; y < h - hz - 8; y += 24) for (x = 16; x < w - 12; x += 24) {
      F(g, x, y, 2, 2, '#242c34'); F(g, x - 1, y - 1, 1, 1, '#E8EEF2');
    }
    /* hazard strip */
    for (x = 0; x < w; x += 4) for (y = 0; y < hz; y += 4) F(g, x, h - hz + y, 4, 4, ((x + y) >> 2) & 1 ? '#E2B84A' : '#1A1614');
    F(g, 0, h - hz, w, 1, '#1A1614');
    /* seam side + outer jamb */
    F(g, L ? 0 : w - 2, 0, 2, h, '#14110e');
    F(g, L ? 2 : w - 3, 0, 1, h - hz, '#242c34');
    F(g, L ? w - 1 : 0, 0, 1, h, '#242c34');
    return c;
  }
  function bakeGear(f) {
    var c = mk(32, 32), g = c.getContext('2d'), x, y, dx, dy, d, i, a, tx, ty;
    for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) {
      dx = x - 15.5; dy = y - 15.5; d = Math.sqrt(dx * dx + dy * dy);
      if (d > 12) continue;
      if (d <= 3) F(g, x, y, 1, 1, '#14110e');
      else if (d <= 5.5) F(g, x, y, 1, 1, '#2A2E34');
      else if (d > 10.2) F(g, x, y, 1, 1, dx + dy < 0 ? '#8e98a2' : '#3A4048');
      else F(g, x, y, 1, 1, (Math.abs(dx) < 1.5 || Math.abs(dy) < 1.5) ? '#3A4048' : '#5c656e');
    }
    for (i = 0; i < 8; i++) {
      a = i * Math.PI / 4 + f * Math.PI / 16;
      tx = Math.round(15.5 + Math.cos(a) * 13.5 - 2); ty = Math.round(15.5 + Math.sin(a) * 13.5 - 2);
      F(g, tx, ty, 4, 4, '#5c656e'); F(g, tx, ty, 4, 1, '#8e98a2'); F(g, tx, ty + 3, 4, 1, '#3A4048');
    }
    return c;
  }
  /* 5x7 glyph rows for the engraved buttons */
  var GLYPH = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100']
  };
  function glyph(g, ch, x, y, c) {
    var r, q, row = GLYPH[ch];
    for (r = 0; r < 7; r++) for (q = 0; q < 5; q++) if (row[r].charAt(q) === '1') F(g, x + q, y + r, 1, 1, c);
  }
  function bakeCabin() {
    var c = mk(W, H), g = c.getContext('2d'), x, y, r, i, rowH = [8, 8, 7, 7], tw = [12, 16, 22, 30], yy;
    /* back wall panels */
    for (x = 0; x < W; x += 24) {
      F(g, x, 24, 24, 216, '#3A2C20');
      F(g, x, 24, 24, 1, '#4A3828'); F(g, x, 24, 1, 216, '#4A3828');
      F(g, x + 23, 24, 1, 216, '#2A1E14');
      F(g, x + 1, 25, 22, 1, '#22180F');
      F(g, x + 5, 60, 14, 1, '#2A1E14'); F(g, x + 5, 200, 14, 1, '#2A1E14');
      F(g, x + 5, 61, 14, 1, '#4A3828');
      for (i = 0; i < 4; i++) F(g, x + 3 + ((hs(x, i, 6) * 17) | 0), 70 + ((hs(x, i, 7) * 120) | 0), 1, 3 + i, '#33261A');
    }
    /* wainscot + baseboard */
    F(g, 0, 214, W, 18, '#2A1E14'); F(g, 0, 214, W, 1, '#4A3828'); F(g, 0, 231, W, 1, '#22180F');
    F(g, 0, 232, W, 8, '#22180F'); F(g, 0, 232, W, 1, '#4A3828');
    /* ceiling band */
    F(g, 0, 0, W, 24, '#2A2420'); F(g, 0, 0, W, 2, '#3A3430'); F(g, 0, 22, W, 2, '#14110e');
    for (x = 0; x < W; x += 40) F(g, x, 2, 1, 20, '#1A1614');
    /* floor tiles in perspective */
    yy = 240;
    for (r = 0; r < 4; r++) {
      for (x = -((r * 7) % tw[r]); x < W; x += tw[r]) {
        F(g, x, yy, tw[r], rowH[r], (((x / tw[r]) | 0) + r) & 1 ? '#2A2420' : '#3A3430');
        F(g, x, yy, 1, rowH[r], '#1A1614');
      }
      F(g, 0, yy, W, 1, '#1A1614');
      yy += rowH[r];
    }
    /* brass handrail + brackets */
    for (x = 48; x < W; x += 96) { F(g, x, 184, 4, 8, '#8A6A30'); F(g, x, 184, 1, 8, '#C8A050'); }
    F(g, 0, 180, W, 4, '#8A6A30'); F(g, 0, 181, W, 2, '#C8A050'); F(g, 0, 180, W, 1, '#FFE8A0');
    F(g, 0, 184, W, 1, '#22180F');
    /* door frame + two leaves */
    F(g, 114, 50, 252, 190, '#1A1614'); F(g, 114, 50, 252, 2, '#8A6A30'); F(g, 114, 52, 252, 1, '#C8A050');
    F(g, 114, 50, 6, 190, '#22180F'); F(g, 360, 50, 6, 190, '#22180F');
    g.drawImage(art.leafS[0], 120, 56); g.drawImage(art.leafS[1], 240, 56);
    /* dial plate */
    F(g, 212, 22, 56, 28, '#8A6A30'); F(g, 212, 22, 56, 1, '#C8A050'); F(g, 212, 49, 56, 1, '#22180F');
    for (y = 0; y < 24; y++) {
      r = Math.round(Math.sqrt(24 * 24 - (24 - y) * (24 - y)));
      if (r > 0) F(g, 240 - r, 26 + y, r * 2, 1, y < 2 ? '#C8A050' : '#E8DCC8');
    }
    for (i = 0; i < 5; i++) {
      x = Math.round(240 - Math.cos(i * Math.PI / 4) * 19); y = Math.round(48 - Math.sin(i * Math.PI / 4) * 19);
      F(g, x - 1, y - 1, 2, 2, '#3A2414');
    }
    F(g, 238, 46, 5, 3, '#8A6A30');
    /* side brass plate */
    F(g, 388, 96, 44, 68, '#8A6A30'); F(g, 388, 96, 44, 2, '#C8A050'); F(g, 388, 96, 2, 68, '#C8A050');
    F(g, 388, 162, 44, 2, '#5A4420'); F(g, 430, 96, 2, 68, '#5A4420');
    for (i = 0; i < 4; i++) F(g, 391 + (i & 1) * 36, 99 + (i >> 1) * 59, 2, 2, '#FFE8A0');
    /* porthole frame */
    F(g, 60, 96, 40, 40, '#8A6A30'); F(g, 60, 96, 40, 2, '#C8A050'); F(g, 60, 134, 40, 2, '#5A4420');
    /* side vignette */
    g.globalAlpha = 0.2;
    for (i = 0; i < 3; i++) { F(g, 0, 24, 16 * (3 - i), 216, '#000'); F(g, W - 16 * (3 - i), 24, 16 * (3 - i), 216, '#000'); }
    g.globalAlpha = 1;
    return c;
  }
  function ensureArt() {
    var i;
    if (art) return;
    art = { leafS: [bakeLeaf(120, 184, 0), bakeLeaf(120, 184, 1)], gears: [], big: [bakeLeaf(240, H, 0, 1), bakeLeaf(240, H, 1, 1)], vista: bakeVista() };
    art.cabin = bakeCabin();
    for (i = 0; i < 4; i++) art.gears.push(bakeGear(i));
  }
  function drawButtons() {
    var lit0 = phase !== 'cabin', litQ = phase === 'drop' || phase === 'rise' || phase === 'doors' || phase === 'vista';
    F(ctx, 396, 104, 12, 12, lit0 ? '#ffe080' : '#E8DCC8'); F(ctx, 396, 104, 12, 1, '#fff6c0'); F(ctx, 396, 115, 12, 1, '#8A6A30');
    glyph(ctx, '0', 399, 106, '#3A2414');
    F(ctx, 396, 146, 12, 12, litQ ? '#ffe080' : '#E8DCC8'); F(ctx, 396, 146, 12, 1, '#fff6c0'); F(ctx, 396, 157, 12, 1, '#8A6A30');
    glyph(ctx, '?', 399, 148, '#3A2414');
  }
  function drawDial() {
    var idx = { cabin: 2, floor: 0, drop: 3, rise: 4, doors: 4, vista: 4 }[phase] || 0, a = Math.PI * (1 - idx / 4), k, x, y;
    for (k = 4; k <= 17; k += 1) {
      x = Math.round(240 + Math.cos(a) * k); y = Math.round(48 - Math.sin(a) * k);
      F(ctx, x, y, 1, 1, '#8A6A30');
    }
    F(ctx, 238, 46, 5, 3, '#8A6A30'); F(ctx, 239, 47, 2, 1, '#FFE8A0');
  }
  function drawShaft() {
    var ox = 64, oy = 100, off = ((Math.round(y) % 12) + 12) % 12, k, row;
    F(ctx, ox, oy, 32, 32, '#242c34');
    for (k = -1; k < 4; k++) {
      row = oy + k * 12 + off;
      if (row < oy || row > oy + 31) continue;
      F(ctx, ox, row, 32, 1, '#3A3430');
      F(ctx, ox + ((k & 1) ? 8 : 18), row + 1, 1, 11 - (row + 12 > oy + 32 ? row + 12 - oy - 32 : 0), '#3A3430');
      F(ctx, ox + ((k & 1) ? 24 : 4), row + 1, 1, 11 - (row + 12 > oy + 32 ? row + 12 - oy - 32 : 0), '#3A3430');
    }
    F(ctx, ox, oy, 32, 2, '#1c2128'); F(ctx, ox, oy, 2, 32, '#1c2128');
    F(ctx, ox + 4, oy + 4, 6, 1, '#5c656e');
  }
  function halo(x, y, w, h, col, a) {
    var i, prev = ctx.globalAlpha;
    for (i = 3; i >= 1; i--) {
      ctx.globalAlpha = a * (4 - i) / 3;
      F(ctx, x - i * 8, y - i * 5, w + i * 16, h + i * 10, col);
    }
    ctx.globalAlpha = prev;
  }
  function drawLight() {
    var alarm = phase === 'drop' || phase === 'rise' || phase === 'doors', on = light;
    var col = alarm ? (on ? '#FF4A3A' : '#5A1E1A') : '#FFF6C0';
    if (!alarm || on) halo(180, 8, 120, 8, alarm ? '#FF4A3A' : '#FFF6C0', alarm ? 0.12 : 0.09);
    F(ctx, 180, 8, 120, 8, col);
    F(ctx, 180, 8, 120, 1, alarm ? (on ? '#FF9A8A' : '#7A2A24') : '#FFFFFF');
    F(ctx, 180, 15, 120, 1, alarm ? '#5A1E1A' : '#C9B98A');
    F(ctx, 178, 6, 124, 2, '#14110e'); F(ctx, 178, 16, 124, 2, '#14110e');
  }
  function drawDustLayer(bob) {
    var i, p;
    ctx.fillStyle = '#c8b49a';
    for (i = 0; i < dust.length; i++) {
      p = dust[i];
      ctx.fillRect(p.x | 0, (p.y + bob) | 0, 1, 1 + (i & 1));
    }
  }
  function drawCabin() {
    var bob = reduced ? 0 : ((phase === 'drop' || phase === 'rise') ? Math.round(Math.sin(t * 18) * 1) : 0);
    ctx.drawImage(art.cabin, 0, bob);
    drawShaft();
    drawLight();
    drawButtons();
    drawDial();
    if (!reduced) drawDustLayer(bob);
  }
  /* one leaf: a 3-step steel ramp (light at the seam), a dark seam, the baked texture, live rivets */
  function leaf(x0, w0, right, over) {
    var st = (w0 / 3) | 0, i, x, y, rw, ox = right ? x0 + over : w0 - 240 - over;
    for (i = 0; i < 3; i++) {
      rw = i === 2 ? w0 - st * 2 : st;
      x = right ? (i === 2 ? x0 : x0 + w0 - (i + 1) * st) : x0 + i * st;
      F(ctx, x, 0, rw, H, STEEL[[1, 2, 4][i]]);
    }
    F(ctx, right ? x0 : x0 + w0 - 4, 0, 4, H, '#1c2128');
    ctx.drawImage(art.big[right ? 1 : 0], ox, 0);
    for (y = 24; y < H - 28; y += 24) for (x = 16; x < 228; x += 24) {
      if (ox + x < 0 || ox + x > W - 2) continue;
      F(ctx, ox + x, y, 2, 2, '#242c34'); F(ctx, ox + x - 1, y - 1, 1, 1, '#E8EEF2');
    }
  }
  function drawDoors() {
    var e = 1 - Math.pow(1 - door, 3), span = Math.round((1 - e) * (W / 2)), ext = (piston * 48) | 0, gf = reduced ? 0 : (Math.floor(door * 8) & 3);
    var over = (door > 0.96 && door < 1 && !reduced) ? 2 : 0;
    var seamGlow = door > 0 && door < 1;
    ctx.drawImage(art.vista, 0, 0);
    if (!reduced) drawDustLayer(0);
    if (span > 0 || over) {
      leaf(0, span, 0, over);
      leaf(W - span, span, 1, over);
      if (seamGlow && span > 2) {
        F(ctx, span - 3 - over, 0, 1, H, '#6a5038'); F(ctx, W - span + 2 + over, 0, 1, H, '#6a5038');
      }
    }
    if (span > 36) {
      ctx.drawImage(art.gears[gf], 28, 48);
      ctx.drawImage(art.gears[3 - gf], W - 60, 48);
    }
    /* pistons */
    F(ctx, 8, 150, 14, 28 + ext, '#5c656e'); F(ctx, 8, 150, 3, 28 + ext, '#8e98a2'); F(ctx, 19, 150, 3, 28 + ext, '#242c34');
    F(ctx, W - 22, 150, 14, 28 + ext, '#5c656e'); F(ctx, W - 22, 150, 3, 28 + ext, '#8e98a2'); F(ctx, W - 11, 150, 3, 28 + ext, '#242c34');
    F(ctx, 12, 154, 6, 16 + ext, '#d5dde4'); F(ctx, W - 18, 154, 6, 16 + ext, '#d5dde4');
    F(ctx, 8, 150, 14, 2, '#3a2418'); F(ctx, W - 22, 150, 14, 2, '#3a2418');
  }
  function draw() {
    var shook;
    if (!ctx) return;
    ensureArt();
    ctx.imageSmoothingEnabled = false;
    shook = NEU.juice && NEU.juice.begin ? NEU.juice.begin(ctx, W, H) : false;
    if (phase === 'doors' || phase === 'vista') drawDoors();
    else drawCabin();
    if (NEU.juice && NEU.juice.drawParts) NEU.juice.drawParts(ctx, STEP);
    if (NEU.juice && NEU.juice.end) NEU.juice.end(ctx, shook);
    if (NEU.juice && NEU.juice.overlay) NEU.juice.overlay(ctx, W, H);
    if (screen && phase === 'floor' && !screen.textContent) screen.textContent = 'YOU ARE ON FLOOR 0';
  }
  function getState() {
    if (!live) return null;
    return {
      phase: phase, y: y, door: door, light: light, siren: sirenOn,
      dust: dust.length, gear: gear, piston: piston, mountain: mountain
    };
  }
  function step(dt, key) {
    var span, raw, u, period;
    if (!live) return null;
    if (key === '0' || key === '?') press(key);
    if (!live) return null;
    if (dt > 0.05) dt = 0.05;
    if (phase === 'drop' || phase === 'rise' || phase === 'doors') {
      t += dt;
      lightT += dt;
      period = reduced ? 0.7 : 0.4;
      if (lightT >= period) {
        lightT -= period;
        light = !light;
        pulse();
      }
    }
    if (phase === 'drop') {
      span = reduced ? 0.2 : 0.8;
      raw = t / span;
      if (raw > 1) raw = 1;
      y = yFrom + 64 * raw;
      if (t >= span) { phase = 'rise'; t = 0; yFrom = y; }
    } else if (phase === 'rise') {
      span = reduced ? 0.35 : 1.6;
      raw = t / span;
      if (raw > 1) raw = 1;
      u = raw * raw * (3 - 2 * raw);
      y = yFrom + (-96 - yFrom) * u;
      if (t >= span) { phase = 'doors'; t = 0; mountain = true; }
    } else if (phase === 'doors') {
      span = reduced ? 0.4 : 2.8;
      raw = t / span;
      if (raw > 1) raw = 1;
      door = raw;
      piston = raw;
      gear += 1;
      if (dust.length < 36) dust.push({ x: (dust.length * 23 + 40) % W, y: (dust.length * 17 + 24) % (H - 8) });
      if (t >= span) finish();
    } else if (dust.length < 8 && phase !== 'vista') {
      dust.push({ x: (dust.length * 37 + 24) % W, y: 60 + (dust.length * 19) % 140 });
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
  function open() {
    ensure();
    if (live) close();
    motion();
    reset();
    live = true;
    overlay.hidden = false;
    if (NEU.keys && NEU.keys.refresh) NEU.keys.refresh();
    NEU.activeMinigame = 'elevator';
    document.body.classList.add('is-playing');
    if (NEU.kernel) NEU.kernel.push('elevator');
    draw();
    return true;
  }
  function close() {
    if (!live && (!overlay || overlay.hidden)) return;
    live = false;
    stopSiren();
    if (overlay) overlay.hidden = true;
    if (NEU.activeMinigame === 'elevator') NEU.activeMinigame = null;
    if (document.body) document.body.classList.remove('is-playing');
    if (NEU.kernel && NEU.kernel.current() === 'elevator') NEU.kernel.pop();
  }
  function onKey(e) {
    var routed, k;
    if (!live || e.repeat || e.type !== 'keydown') return;
    routed = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (routed.swallow) return;
    k = routed.to;
    if (k === '0' || k === 'Digit0') { press('0'); e.preventDefault(); }
    else if (k === '?' || k === '/') { press('?'); e.preventDefault(); }
    else if (k === 'Escape') close();
  }
  window.addEventListener('keydown', onKey);

  NEU.elevator = {
    open: open, close: close, step: step,
    get state() { return getState(); },
    get running() { return live; }
  };
  if (NEU.kernel) NEU.kernel.register('elevator', {
    tick: tick, open: open, close: close,
    running: function () { return live; }
  });
})();
