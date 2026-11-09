/* crack.js — the last thing on the page.
   ───────────────────────────────────────────────────────────────────
   Bottom-right corner of the panel inside the cube. Four pixels. It
   does nothing until he sits down, and then it does not announce
   itself either.

   THE THREE-CLICK RULE IS THE WHOLE DESIGN:
     1st — a sound, and nothing else. You are not sure you did that.
     2nd — a worse sound, and it visibly widens. Now you are sure.
     3rd — it opens.

   One click would be a button. A dozen would be a chore. Three is the
   number where a person goes "...did that do something?" and clicks
   again, which is the exact feeling this is for.

   IT IS DISCOVERABLE BECAUSE THE MERCHANT TAUGHT YOU. One lit name in
   a list of junk, hours ago, established that this game points at
   things by making them glow. The crack glows, faintly, once armed.  */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var el = document.getElementById('crack');
  if (!el) { NEU.crack = { arm: function () {} }; return; }

  var armed = false, clicks = 0, opened = false, transitioning = false, timer = null, actx = null;
  var hintEl = null;
  var PORTAL_LINE = 'it is not a crack. it is a hole, and it is round now.';

  var NOISE = [
    'something behind the panel makes a noise. it is not a good noise.',
    'the crack widens. whatever is behind it has stopped pretending.',
    ''
  ];

  /* ── ART ─────────────────────────────────────────────────────────
     Baked into small canvases when state changes. No per-frame paint
     for the crack itself: glow pulses by opacity, portal by transform.
     Round 2: fracture is thin/tapering with a dark core, chrome ramp on
     one side and faint red only inside gaps; 96px armed, 128px at hit 2. */
  var S = 64, FX = 42, FY = 40;                       /* fracture centre */
  var CHROME = ['#F4F6FF', '#AEB6C8', '#6B7385', '#3A4050', '#0B0B12'];
  var MAIN = [[56, 58], [50, 52], [51, 46], [44, 42], [45, 34], [39, 30], [36, 24], [30, 18], [25, 12]];
  var BR = [
    [0, [[44, 42], [38, 44], [34, 40]]],
    [0, [[45, 34], [51, 30]]],
    [1, [[44, 42], [38, 44], [34, 40], [28, 41]]],
    [1, [[45, 34], [51, 30], [54, 25]]],
    [1, [[50, 52], [56, 50]]],
    [1, [[36, 24], [40, 18]]],
    [2, [[39, 30], [33, 32], [29, 28], [22, 30]]],
    [2, [[50, 52], [56, 50], [59, 45]]],
    [2, [[36, 24], [40, 18], [38, 12]]],
    [2, [[30, 18], [24, 16], [20, 12]]],
    [2, [[51, 46], [55, 43], [58, 44]]]
  ];
  var artC = null, glowC = null, portC = null, art = null, glow = null, port = null, flash = null, shards = [];

  function mk(cls) {
    var cv = document.createElement('canvas');
    cv.width = S; cv.height = S; cv.className = cls;
    cv.setAttribute('aria-hidden', 'true');
    el.appendChild(cv);
    try { return { cv: cv, c: cv.getContext('2d') }; } catch (e) { return { cv: cv, c: null }; }
  }
  function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x | 0, y | 0, w, h); }
  function disc(c, cx, cy, r, col) {
    var y, dx;
    c.fillStyle = col;
    for (y = -r; y <= r; y++) {
      dx = Math.floor(Math.sqrt(r * r - y * y + 0.5));
      c.fillRect(cx - dx, cy + y, dx * 2 + 1, 1);
    }
  }
  /* Bresenham, 1px steps. */
  function linePts(a, b) {
    var x0 = a[0], y0 = a[1], x1 = b[0], y1 = b[1], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, er = dx + dy, e2, pts = [], n = 0;
    for (;;) {
      pts.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      e2 = 2 * er;
      if (e2 >= dy) { er += dy; x0 += sx; }
      if (e2 <= dx) { er += dx; y0 += sy; }
      if (++n > 240) break;
    }
    return pts;
  }
  function paths(level) {
    var out = [MAIN], i;
    for (i = 0; i < BR.length; i++) if (level >= BR[i][0]) out.push(BR[i][1]);
    return out;
  }

  /* Thin, tapering fracture: dark core, chrome ramp on the upper-left side,
     faint red only inside gaps (2-4px soft band, <=35% alpha hugging lines).
     No blobs, no filled disc. */
  function drawFracture(level) {
    var c = artC.c, ps = paths(level), i, j, k, p, q, pts, pt, t, gap, nx, ny, dx, dy, len, ox, oy, shard, tx, ty, gx, gy;
    if (!c) return;
    c.clearRect(0, 0, S, S);
    for (i = 0; i < ps.length; i++) {
      for (j = 1; j < ps[i].length; j++) {
        p = ps[i][j - 1]; q = ps[i][j];
        pts = linePts(p, q);
        dx = q[0] - p[0]; dy = q[1] - p[1];
        len = Math.sqrt(dx * dx + dy * dy) || 1;
        nx = -dy / len; ny = dx / len; /* perpendicular, upper-left side */
        for (k = 0; k < pts.length; k++) {
          pt = pts[k];
          t = k / (pts.length - 1 || 1);
          gap = level === 0 ? (t < 0.8 ? 1 : 0) : level === 1 ? 1 : (t > 0.15 ? 2 : 1);
          ox = Math.round(nx); oy = Math.round(ny);
          /* faint red hug inside/beside the gap only, never a filled circle */
          if (gap >= 1 && level > 0) {
            gx = pt[0] - ox; gy = pt[1] - oy;
            px(c, gx, gy, 1, 1, 'rgba(255,42,58,0.18)');
            if (gap >= 2) {
              px(c, pt[0], pt[1], 1, 1, 'rgba(255,42,58,0.32)');
              px(c, gx - ox, gy - oy, 1, 1, 'rgba(255,42,58,0.12)');
              if (k % 3 === 0) px(c, pt[0] + ox, pt[1] + oy + 1, 1, 1, 'rgba(255,42,58,0.1)');
            }
          }
          /* dark core (#0B0B12), tapering to a point */
          px(c, pt[0], pt[1], 1, 1, '#0B0B12');
          if (gap >= 2 && t > 0.2 && t < 0.9) px(c, pt[0] - ox, pt[1] - oy, 1, 1, '#0B0B12');
          /* chrome highlight ramp on one side */
          px(c, pt[0] + ox, pt[1] + oy, 1, 1, k % 3 === 0 ? '#F4F6FF' : '#AEB6C8');
          if (level > 0 && k % 4 === 1) px(c, pt[0] + ox * 2, pt[1] + oy * 2, 1, 1, '#6B7385');
        }
      }
    }
    /* 3-5 tiny chrome shards around the fracture */
    for (i = 0; i < Math.min(5, 2 + level * 2); i++) {
      shard = [[26, 46], [36, 40], [46, 50], [50, 26], [22, 28], [42, 18]][i % 6];
      tx = shard[0] + ((i * 3) % 5) - 2; ty = shard[1] - ((i * 2) % 4);
      px(c, tx, ty, 2, 1, i % 2 ? '#F4F6FF' : '#AEB6C8');
      px(c, tx, ty, 1, 1, '#F4F6FF');
      px(c, tx + 1, ty + 1, 1, 1, '#6B7385');
      if (level > 0 && i % 2 === 0) px(c, tx - 1, ty, 1, 1, '#AEB6C8');
    }
  }

  /* No filled disc behind the crack. Only a faint red light that hugs fracture
     gaps (baked into the art pass) — see drawFracture. Keep canvas for compat. */
  function drawGlow(level) {
    var c = glowC.c;
    if (!c) return;
    c.clearRect(0, 0, S, S);
  }

  /* Seed of the rift (panel preview): black/deep crimson, thin rim, spiral. */
  var RING_COLS = ['#050008', '#1A0006', '#3A0008', '#8A0010', '#FF2A3A'];
  function drawPortal() {
    var c = portC.c, r, i, a, rr, X, Y, t, band, cols = RING_COLS;
    if (!c) return;
    c.clearRect(0, 0, S, S);
    /* rings from centre outward, 4-10px bands, black core */
    r = 28;
    for (i = cols.length - 1; i >= 0 && r > 2; i--) {
      band = i === 0 ? Math.max(6, r - 2) : 5;
      disc(c, 32, 32, r, cols[i]);
      r -= band;
    }
    /* thin 2px rim only */
    c.globalAlpha = 1;
    for (i = 0; i < 2; i++) ring(c, 32, 32, 28 - i, '#FFB0A0');
    /* 3 spiral arms */
    for (a = 0; a < 3; a++) {
      for (i = 0; i < 36; i++) {
        rr = 6 + i * 0.58; t = a * 2.094 + i * 0.16;
        X = (32 + Math.cos(t) * rr) | 0; Y = (32 + Math.sin(t) * rr) | 0;
        c.fillStyle = 'rgba(255,42,58,' + (0.85 - i * 0.018) + ')';
        c.fillRect(X, Y, i < 18 ? 2 : 1, i < 18 ? 2 : 1);
      }
    }
    /* chrome rim fragments */
    for (i = 0; i < 8; i++) {
      t = i * 0.785;
      X = (32 + Math.cos(t) * 26) | 0; Y = (32 + Math.sin(t) * 26) | 0;
      c.fillStyle = i % 2 ? '#F4F6FF' : '#AEB6C8';
      c.fillRect(X, Y, 2, 2); c.fillStyle = '#6B7385'; c.fillRect(X + 1, Y, 1, 1);
    }
    c.fillStyle = '#050008'; c.fillRect(31, 31, 2, 2);
  }
  function ring(c, cx, cy, r, col) {
    var y, dy, dx, x0, x1;
    c.fillStyle = col;
    for (y = cy - r; y <= cy + r; y++) {
      dy = y - cy; dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      x0 = cx - dx; x1 = cx + dx;
      c.fillRect(x0, y, 1, 1); c.fillRect(x1, y, 1, 1);
    }
  }
  function build() {
    var i, s;
    if (artC) return;
    glowC = mk('crack__glow'); artC = mk('crack__art'); portC = mk('crack__portal');
    flash = document.createElement('span'); flash.className = 'crack__flash'; flash.setAttribute('aria-hidden', 'true');
    el.appendChild(flash);
    for (i = 0; i < 8; i++) {
      s = document.createElement('span'); s.className = 'crack__shard'; s.setAttribute('aria-hidden', 'true');
      el.appendChild(s); shards.push(s);
    }
    art = artC.cv; glow = glowC.cv; port = portC.cv;
    drawPortal();
    paint();
  }
  function paint() {
    if (!artC) return;
    drawFracture(Math.min(2, clicks));
    drawGlow(opened ? 3 : Math.min(2, clicks));
  }

  function showHint() {
    if (hintEl) return;
    if (NEU.quest && NEU.quest.has('a4_crack')) return;
    hintEl = document.createElement('div');
    hintEl.className = 'crack-hint';
    hintEl.textContent = 'something cracked inside the cube';
    document.body.appendChild(hintEl);
  }

  function hideHint() {
    if (!hintEl) return;
    if (hintEl.parentNode) hintEl.parentNode.removeChild(hintEl);
    hintEl = null;
  }

  function reducedMotion() {
    try {
      if (NEU.motion && NEU.motion.reduced) return NEU.motion.reduced();
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function enterDungeon() {
    var panel = document.getElementById('panel');
    if (panel) {
      panel.hidden = true;
      if (panel.classList) {
        panel.classList.remove('is-open');
        panel.classList.remove('is-on');
      }
      panel.style.transform = '';
      panel.style.opacity = '';
    }
    if (NEU.plat && NEU.plat.open) NEU.plat.open('d0');
  }

  /* ── THE RIFT ────────────────────────────────────────────────────
     Full-viewport overlay (z 77). Opaque dark fill every frame so nothing
     behind bleeds through. Centre moves from crack to screen centre as it
     grows. Rings baked per size bucket; animated by rotation/embers/scale. */
  var GROW = 1000, FADE = 520, RING_B = ['#050008', '#1A0006', '#3A0008', '#8A0010', '#FF2A3A'];
  var ringBuckets = {};
  function ringBucket(r) {
    var key = Math.max(16, (Math.ceil(r / 16) * 16) | 0), cv, g, rr, i, band, cols = RING_B, sz;
    if (ringBuckets[key]) return ringBuckets[key];
    sz = key * 2 + 4;
    cv = document.createElement('canvas'); cv.width = sz; cv.height = sz;
    try { g = cv.getContext('2d'); } catch (e) { g = null; }
    if (g) {
      g.imageSmoothingEnabled = false;
      rr = key;
      /* bands from outer edge inward: crimson then deeper to black core */
      for (i = cols.length - 1; i >= 0 && rr > 2; i--) {
        band = i === 0 ? Math.max(6, rr - 1) : (4 + (i % 3) * 2);
        disc2(g, sz / 2, sz / 2, rr, cols[i], sz);
        rr -= band;
      }
      if (rr > 0) disc2(g, sz / 2, sz / 2, rr, '#050008', sz);
      /* thin 2px rim only (#FFB0A0) */
      ring2(g, sz / 2, sz / 2, key, '#FFB0A0');
      ring2(g, sz / 2, sz / 2, key - 1, '#FFB0A0');
    }
    ringBuckets[key] = { cv: cv, r: key, sz: sz };
    return ringBuckets[key];
  }
  function rift(cx, cy, done) {
    var box = document.createElement('div'), cv, c, SC = 4, W, H, R0 = 14, Rmax, t0, embers = [], i, last, entered = false, ocx, ocy;
    box.className = 'crack-rift';
    box.setAttribute('aria-hidden', 'true');
    box.style.background = '#050008';
    document.body.appendChild(box);
    function finish() { if (box.parentNode) box.parentNode.removeChild(box); }
    function enter() { if (entered) return; entered = true; done(); }
    if (reducedMotion()) {
      box.style.background = '#12030A';
      box.style.opacity = '0';
      box.style.transition = 'opacity .25s ease';
      window.setTimeout(function () { box.style.opacity = '1'; }, 20);
      window.setTimeout(function () { enter(); box.style.opacity = '0'; }, 320);
      window.setTimeout(finish, 700);
      return;
    }
    W = Math.max(80, Math.ceil(window.innerWidth / SC)); H = Math.max(60, Math.ceil(window.innerHeight / SC));
    cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    box.appendChild(cv);
    try { c = cv.getContext('2d'); } catch (e) { c = null; }
    if (!c) { window.setTimeout(function () { enter(); finish(); }, 400); return; }
    ocx = Math.round(cx / SC); ocy = Math.round(cy / SC);
    Rmax = Math.sqrt(W * W + H * H) / 2 + 24;
    for (i = 0; i < 48; i++) embers.push({ a: 0, rr: 0, life: 0, sp: 0, arm: 0 });
    t0 = last = performance.now();

    function frame(now) {
      var t = Math.max(0, now - t0), dt = Math.max(0, Math.min(0.05, (now - last) / 1000)), k = Math.min(1, t / GROW), r, j, rr, e, ang, er, col, ix, iy, ccx, ccy, b, sc, rot, arms = 4;
      last = now;
      r = R0 + (Rmax - R0) * Math.pow(k, 2.2);
      /* move centre from crack to screen centre as it grows */
      ccx = ocx + (W / 2 - ocx) * Math.pow(k, 0.8);
      ccy = ocy + (H / 2 - ocy) * Math.pow(k, 0.8);
      c.fillStyle = '#050008';
      c.fillRect(0, 0, W, H);
      /* baked ring set, animated by rotation + scale */
      b = ringBucket(r);
      sc = r / b.r;
      rot = t * 0.00055;
      c.save();
      c.translate(ccx, ccy);
      c.rotate(rot);
      c.scale(sc, sc);
      c.drawImage(b.cv, -b.sz / 2, -b.sz / 2);
      c.restore();
      /* 3-4 rotating spiral arms, #FF2A3A fading to transparent */
      c.save();
      c.translate(ccx, ccy);
      c.rotate(rot);
      for (j = 0; j < arms; j++) {
        for (er = 0; er < 70; er++) {
          rr = 6 + er * (r / 70);
          if (rr > r - 2) break;
          ang = j * (6.283 / arms) + er * 0.13;
          ix = (Math.cos(ang) * rr) | 0; iy = (Math.sin(ang) * rr) | 0;
          c.globalAlpha = Math.max(0, 0.75 - er * 0.01);
          c.fillStyle = '#FF2A3A';
          c.fillRect(ix, iy, er < 30 ? 2 : 1, er < 30 ? 2 : 1);
        }
      }
      c.globalAlpha = 1;
      c.restore();
      /* 6-10 chrome shards orbiting the rim */
      for (j = 0; j < 8; j++) {
        ang = j * 0.7854 - t * 0.0011 + rot;
        rr = r - 2;
        ix = (ccx + Math.cos(ang) * rr) | 0; iy = (ccy + Math.sin(ang) * rr) | 0;
        c.fillStyle = j % 2 ? '#F4F6FF' : '#AEB6C8';
        c.fillRect(ix, iy, 2, 2);
        c.fillStyle = '#6B7385'; c.fillRect(ix + 1, iy, 1, 1);
      }
      /* embers stream inward along spiral, 48 of them */
      for (j = 0; j < embers.length; j++) {
        e = embers[j];
        e.life -= dt;
        if (e.life <= 0) {
          e.arm = j % arms;
          e.rr = r * (0.72 + Math.random() * 0.28);
          e.a = e.arm * (6.283 / arms) + e.rr * 0.13 / Math.max(1, r / 70) + (Math.random() - 0.5) * 0.5;
          e.life = 0.45 + Math.random() * 0.7;
          e.sp = 18 + Math.random() * 22;
        }
        e.rr -= e.sp * dt;
        e.a += 0.55 * dt + (e.sp / Math.max(8, e.rr)) * dt * 0.12;
        ang = e.a + rot;
        ix = (ccx + Math.cos(ang) * e.rr) | 0; iy = (ccy + Math.sin(ang) * e.rr) | 0;
        col = e.life > 0.55 ? '#FFD0A0' : '#FF6A3A';
        c.fillStyle = col;
        c.fillRect(ix, iy, e.life > 0.4 ? 2 : 1, e.life > 0.4 ? 2 : 1);
      }
      if (t >= GROW) {
        enter();
        box.style.opacity = String(Math.max(0, 1 - (t - GROW) / FADE));
      }
      if (t >= GROW + FADE) { finish(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function disc2(c, cx, cy, r, col, H) {
    var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r)), y, dy, dx;
    c.fillStyle = col;
    for (y = y0; y <= y1; y++) {
      dy = y - cy; dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      c.fillRect(Math.floor(cx - dx), y, dx * 2 + 1, 1);
    }
  }
  function ring2(c, cx, cy, r, col) {
    var y, dy, dx, x0, x1;
    c.fillStyle = col;
    for (y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      dy = y - cy; dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      x0 = Math.floor(cx - dx); x1 = Math.floor(cx + dx);
      c.fillRect(x0, y, 1, 1); c.fillRect(x1, y, 1, 1);
    }
  }

  function transitionToDungeon() {
    var rect = el.getBoundingClientRect(), cx, cy;
    transitioning = true;
    if (rect && rect.width > 0) { cx = rect.left + rect.width / 2; cy = rect.top + rect.height / 2; }
    else { cx = window.innerWidth - 104; cy = window.innerHeight - 104; }
    /* allow the portal to pop for a beat before it swallows everything */
    timer = window.setTimeout(function () {
      timer = null;
      rift(cx, cy, function () {
        transitioning = false;
        enterDungeon();
      });
    }, reducedMotion() ? 0 : 380);
  }

  function arm() {
    if (armed) return;
    armed = true;
    el.hidden = false;
    if (!el.getAttribute('data-n')) el.setAttribute('data-n', '0');
    build();
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    if (NEU.save) NEU.save.flag('crack_armed', 1);
    showHint();
  }

  /* Hit feedback: WAAPI, so no forced reflow to restart an animation. */
  function feedback(n) {
    var i, ang, d, rm = reducedMotion(), tier = n === 1 ? 'small' : n === 2 ? 'medium' : 'huge';
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit(tier);
    if (!el.animate || !artC) return;
    if (flash && !(NEU.juice && NEU.juice.noFlash)) {
      flash.animate([{ opacity: n === 3 ? 1 : 0.8 }, { opacity: 0 }], { duration: n === 3 ? 420 : 300, easing: 'ease-out' });
    }
    if (rm) return;
    if (n === 3 && !(NEU.juice && NEU.juice.noShake)) {
      var pn = document.getElementById('panel');
      if (pn) { pn.classList.add('is-shook'); window.setTimeout(function () { pn.classList.remove('is-shook'); }, 450); }
    }
    art.style.transformOrigin = glow.style.transformOrigin = (FX / S * 100) + '% ' + (FY / S * 100) + '%';
    art.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + (1.14 + n * 0.06) + ')' }, { transform: 'scale(1)' }],
                { duration: 280, easing: 'cubic-bezier(.34,1.36,.64,1)' });
    for (i = 0; i < shards.length; i++) {
      ang = Math.PI * (0.55 + Math.random() * 0.95);   /* up and to the left */
      d = 30 + Math.random() * (24 + n * 22);
      shards[i].animate([
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: 'translate(' + Math.round(Math.cos(ang) * d) + 'px,' + Math.round(Math.sin(ang) * d - 10) + 'px) rotate(' + Math.round(Math.random() * 360 - 180) + 'deg) scale(.4)', opacity: 0 }
      ], { duration: 520 + Math.random() * 260, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
  }

  function hit() {
    if (!armed) return;
    /* The portal stays open across visits and reloads. */
    if (opened) {
      if (!transitioning) enterDungeon();
      return;
    }
    clicks++;
    if (NEU.save) NEU.save.flag('crack_clicks', clicks);

    /* Each knock is lower and longer than the last. Pitch dropping is
       what makes three identical clicks read as something getting
       closer rather than a button being pressed three times. */
    if (!(NEU.settings && NEU.settings.muted)) try {      /* the Sound switch */
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      var a = actx;
      var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(160 - clicks * 38, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, 60 - clicks * 14), t + 0.35);
      g.gain.setValueAtTime(0.10 + clicks * 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + 0.5);
    } catch (e) {}

    /* Re-trigger without a forced reflow: drop the class now, put it back next frame. */
    if (el.classList.contains('is-hit')) {
      el.classList.remove('is-hit');
      requestAnimationFrame(function () { el.classList.add('is-hit'); });
    } else el.classList.add('is-hit');
    window.setTimeout(function () { el.classList.remove('is-hit'); }, 340);
    el.setAttribute('data-n', String(clicks));

    if (clicks === 1 && NEU.quest) NEU.quest.mark('a4_crack');
    hideHint();
    if (clicks >= 3) {
      if (NEU.talk) NEU.talk([PORTAL_LINE], 'narr');
    } else if (NOISE[clicks - 1] && NEU.talk) {
      NEU.talk([NOISE[clicks - 1]], 'narr');
    }

    if (clicks >= 3) {
      opened = true;
      if (NEU.save) NEU.save.flag('crack_portal', 1);
      el.classList.add('is-portal');
      paint();
      feedback(3);
      transitionToDungeon();
    } else {
      paint();
      feedback(clicks);
    }
  }

  /* Keep the portal available even when other scenes return control. */
  function reset() {
    if (opened) return;
    if (!armed) return;
    clicks = 0;
    el.setAttribute('data-n', '0');
    if (timer) { window.clearTimeout(timer); timer = null; transitioning = false; }
    if (NEU.save) NEU.save.flag('crack_clicks', 0);
  }

  el.addEventListener('click', function (e) { e.stopPropagation(); hit(); });

  function showCrackPanel() {
    var panel = document.getElementById('panel');
    if (!panel) return;
    if (NEU.sans && NEU.sans.openPanel) { NEU.sans.openPanel(); return; }
    panel.hidden = false;
    if (panel.classList) panel.classList.add('is-open');
  }

  /* Restore across a reload — a crack that forgets you have hit it
     twice is a crack you have to hit five times. The crack lives inside
     the panel, so the panel has to come back with it. */
  if (NEU.save && NEU.save.flagged('crack_armed')) {
    arm();
    clicks = (NEU.save.flag('crack_clicks') || 0);
    el.setAttribute('data-n', String(Math.min(clicks, 3)));
    paint();
    if (clicks >= 3 || NEU.save.flagged('crack_portal')) {
      clicks = Math.max(3, clicks);
      opened = true;
      el.classList.add('is-portal');
      el.setAttribute('data-n', String(clicks));
      paint();
      if (!NEU.save.flagged('crack_portal')) NEU.save.flag('crack_portal', 1);
    }
    showCrackPanel();
  }

  NEU.crack = { arm: arm, hit: hit, reset: reset,
                get armed() { return armed; },
                get clicks() { return clicks; },
                get opened() { return opened; } };
})();
