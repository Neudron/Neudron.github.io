/* dark.js — after the light goes.
   You hit a jammed light switch with a hammer and made it worse. Now you
   are inside it, in the dark. Walk to the switch's guts, fit the part.

   Two objects: the grey DOOR (answers four times, then hands over the
   clicker) and the SWITCH (the exit, press Z). The space is crossed twice.

   1. LIGHT IS STEPPED, NOT SMOOTH. Every other pixel here is hard-edged,
      so a soft vignette reads as a different program. Visible rings.
   2. LANDMARKS GLOW FROM BEYOND THE TORCH, in different hues. Without
      them the field is a random walk, which is waiting, not exploring.
   3. DEBRIS IS SEEDED. Scenery that reshuffles every frame lies about
      where you are.
   4. THE WALK CYCLE ADVANCES ON DISTANCE. Stepping on time makes the
      legs keep moving when you stop and slide when you change speed.  */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('dk');
  var cv   = document.getElementById('dkCanvas');
  if (!wrap || !cv) { NEU.dark = { open: function () {}, close: function () {} }; return; }
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.dark = { open: function () {}, close: function () {} }; return; }

  var W = 2600, H = 1800;
  var DOOR = { x: 2060, y: 1360, w: 72, h: 104 };   /* darkDoor 36x52 at 2x */
  var LIGHT = 132;
  var LEN_R = Math.hypot(1676, 1032), UX = 1676 / LEN_R, UY = 1032 / LEN_R;
  var phase = 0, phaseMax = 0, phaseAt = -1e9;   /* progress phase 0..3, furthest reached, last change */
  var PH_COL = ['#B892FF', '#7BE38A', '#FF5A3C', '#FF3FD0'];
  var gauntOn = false;                            /* WO3: the final gauntlet is running */
  var gauntQ = 0, gauntNext = 0, gauntBase = 0;  /* WO3: pulses left, next fire time, answer count it began at */
  var pulses = [];                                /* WO3: live square pulses, cap 6 */
  var surgeAt = 0, surge2At = 0, surge2Side = 0;  /* WO4: next endless surge, pending second pulse and its side */
  /* WO2: one table drives every speed. sw: sweeper px/s, wat: watcher px/s,
     idle: ms still before the watcher comes, hz: seam period multiplier */
  var RAMP = [
    { sw: 90,  wat: 75,  idle: 2500, hz: 1.00 },
    { sw: 115, wat: 95,  idle: 2100, hz: 0.92 },
    { sw: 140, wat: 120, idle: 1700, hz: 0.84 },
    { sw: 165, wat: 140, idle: 1500, hz: 0.78 }
  ];

  /* ── landmarks and hazards ──────────────────────────────────────
     The ~2000 px walk from the drop point to the door is a straight
     diagonal, so everything sits on or beside that line.

     LANDMARKS glow from beyond the torch in three different hues, so
     you can tell them apart from across the room: lilac where you land,
     green halfway, magenta at the door. Reaching one records it.

     HAZARDS are floor seams. Idle they are dim cracks baked into the
     floor (only the torch shows them). Then the exact square that will
     hurt is outlined in red, brightening, for 0.8 s (WotG gives 0.4 s
     minimum; this is a walking room, so twice that). Then it fills for
     0.8 s. Touching a filled seam is the fail state, and it is gentle:
     you are put back at the last landmark you reached, never at the
     start. Staggered offsets so the three never fire together. */
  var LANDMARKS = [
    { x: 420,  y: 380,  col: '#B892FF', name: 'lilac lamp' },
    { x: 1174, y: 844,  col: '#7BE38A', name: 'green lamp' },
    { x: 2096, y: 1412, col: '#FF3FD0', name: 'door' }
  ];
  /* D1: three zones of three seams, each pushed 90 px off the line, the
     side alternating. Later zones cycle faster and stay live longer. */
  var HZ_ZONE = [
    { per: 3600, live: 800,  t: [0.2, 0.3, 0.4] },
    { per: 3000, live: 900,  t: [0.5, 0.6, 0.7] },
    { per: 2400, live: 1000, t: [0.8, 0.86, 0.92] }
  ];
  var HZ_TELE = 800, HZ_COL = '#FF5A3C';
  var HAZARDS = [], SWEEPS = [];
  (function () {
    /* unit route direction and its normal; the normal is the push */
    var LEN = Math.hypot(1676, 1032), ux = 1676 / LEN, uy = 1032 / LEN;
    for (var z = 0; z < 3; z++) for (var k = 0; k < 3; k++) {
      var i = z * 3 + k, t = HZ_ZONE[z].t[k], sg = i % 2 ? -1 : 1;
      /* ponytail: offsets are k*per/2, not /3: at /3 zone 2 (live 1000 of 2400) overlaps itself */
      HAZARDS.push({ x: 420 + 1676 * t - sg * 90 * uy, y: 380 + 1032 * t + sg * 90 * ux,
                     s: 64, per: HZ_ZONE[z].per, live: HZ_ZONE[z].live,
                     tele: HZ_TELE, off: k * HZ_ZONE[z].per / 2 });
    }
    /* D2: two sweepers cross the route, perpendicular, 360 px long */
    var ts = [0.65, 0.89];
    for (var q = 0; q < 2; q++) {
      var cx = 420 + 1676 * ts[q], cy = 380 + 1032 * ts[q];
      SWEEPS.push({ x0: cx + 180 * uy, y0: cy - 180 * ux, x1: cx - 180 * uy, y1: cy + 180 * ux,
                    speed: 90, len: 56, off: 0 });
    }
  })();
  var FDIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var BO_X = 420 + 1676 * 0.75;          /* D3: blackouts start past the line's t = 0.75 */
  var lit = [false, false, false];       /* D6: landmarks relit this run */
  var watch = { on: false, x: 0, y: 0, fadeAt: 0 };   /* D4; at = spawn time */
  var hzPh = [];                         /* D3: last phase per seam, for the live-edge frame and the graze */
  var motes = [];                        /* D8, filled by seedDebris */
  var lastMark = 0, knocks = 0;
  var charge = 3, spent = false;         /* WO2: lamp 1 survives 3 knocks, then is spent for this run */
  var ax = 420, ay = 380;                /* D4: where the idle clock last reset */
  var flashUntil = 0, fadeUntil = 0, bkStep = -1, hzBurst = [];
  var rings = [];                        /* D5/D6: shockwaves, see ringAdd */
  var popAt = -1e9, beamAt = -1e9;       /* last knock-back, last door opening */

  /* D9: periods stretch with distance walked in endless, never below 55% */
  function hzScale() { return endless ? Math.max(0.55, 1 - walked / 8 / 1500) : 1; }
  /* ms into the hazard's cycle, 0..period */
  function hazardK(i, t) {
    var H0 = HAZARDS[i], P = H0.per * hzScale() * (endless ? 1 : RAMP[phaseMax].hz);
    return ((t + H0.off) % P + P) % P;
  }
  function hazardPhase(i, t) {
    var k = hazardK(i, t), H0 = HAZARDS[i];
    return k < H0.tele ? 'tele' : k < H0.tele + H0.live ? 'live' : 'idle';
  }
  /* D2: ping-pong at 90 px/s. Shared result object: callers read .x/.y at once */
  var SP = { x: 0, y: 0 };
  function sweepPos(i, t) {
    var S = SWEEPS[i], L = Math.hypot(S.x1 - S.x0, S.y1 - S.y0), d = ((t / 1000 * S.speed + S.off) % (2 * L) + 2 * L) % (2 * L);
    if (d > L) d = 2 * L - d;
    SP.x = S.x0 + (S.x1 - S.x0) * d / L; SP.y = S.y0 + (S.y1 - S.y0) * d / L;
    return SP;
  }
  /* WO2: change sweeper speed at `now` without moving them: keep the phase offset continuous */
  function sweepSpeed(v, now) {
    for (var i = 0; i < SWEEPS.length; i++) { var S = SWEEPS[i]; S.off += now / 1000 * (S.speed - v); S.speed = v; }
  }
  /* WO3: contracting square pulses. Telegraph 900 ms, then the square shrinks
     from r0 at v px/s. A cyan wedge on one side is the safe lane. */
  var PULSE = { tele: 900, r0: 320, v: 400, band: 14, gap: 500 };
  function pulseAdd(cx, cy, side, t0) {
    if (pulses.length >= 6) pulses.shift();
    pulses.push({ x: cx, y: cy, side: side, t0: t0 });
  }
  /* -1 during the telegraph, then the half-size; dead once it is below 0 */
  function pulseR(P, now) { var k = now - P.t0 - PULSE.tele; return k < 0 ? -1 : PULSE.r0 - PULSE.v * k / 1000; }
  /* the wedge out from the centre on the gap side (0 up, 1 right, 2 down, 3 left) */
  function inGap(P, x, y) {
    var dx = x - P.x, dy = y - P.y;
    return P.side === 0 ? dy < 0 && Math.abs(dx) <= -dy : P.side === 2 ? dy > 0 && Math.abs(dx) <= dy
      : P.side === 1 ? dx > 0 && Math.abs(dy) <= dx : dx < 0 && Math.abs(dy) <= -dx;
  }
  /* the cyan gap side: a bar along one side of the square, optional 8 px corner blocks */
  function pulseGap(side, cx, cy, hs, t, corners) {
    var x0 = cx - hs, y0 = cy - hs, s = hs * 2, bx = x0, by = y0, bw = s, bh = t, horiz = side === 0 || side === 2;
    if (side === 2) by = cy + hs - t;
    else if (side === 1) { bx = cx + hs - t; bw = t; bh = s; }
    else if (side === 3) { bw = t; bh = s; }
    ctx.fillStyle = CYAN;
    ctx.fillRect(bx, by, bw, bh);
    if (corners) {
      ctx.fillRect(horiz ? x0 : bx, horiz ? by : y0, 8, 8);
      ctx.fillRect(horiz ? x0 + s - 8 : bx, horiz ? by : y0 + s - 8, 8, 8);
    }
  }

  /* D3: 'tele' 600 ms before every 'dark' (torch at 34 px for 1.2 s, each 7 s) */
  /* WO4: endless phase 3 blacks out on a 4.5 s cycle, story and earlier phases keep 7 s */
  function bkPer() { return endless && phase >= 3 ? 4500 : 7000; }
  function blackout(t) {
    if (endless ? walked / 8 <= 300 : px <= BO_X) return null;
    var BK = bkPer(), k = t % BK;
    return k < 1200 ? 'dark' : k >= BK - 600 ? 'tele' : null;
  }

  /* progress along the route, 0..1 (projected onto the diagonal) */
  function routeT() { return Math.min(1, Math.max(0, ((px - 420) * UX + (py - 380) * UY) / LEN_R)); }
  /* 0..3: story by route t and door answers, endless by metres walked */
  function phaseNow() {
    if (endless) { var m = walked / 8; return m >= 600 ? 3 : m >= 350 ? 2 : m >= 150 ? 1 : 0; }
    if (gauntOn) return 3;
    var t = routeT();
    return t >= 0.75 ? 2 : t >= 0.45 ? 1 : 0;
  }
  /* a new phase: big hit (at most one per 340 ms, the 3 Hz rule), screen ring, tick */
  function setPhase(p, now) {
    var prev = phaseAt;
    phaseAt = now;
    sweepSpeed(RAMP[p].sw, now);
    if (NEU.juice && now - prev >= 340) NEU.juice.hit('large', { colour: PH_COL[p] });
    ringAdd(innerWidth / 2, innerHeight / 2, PH_COL[p], 0, Math.max(innerWidth, innerHeight) / 2, 600, 1);
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
  }

  /* Two modes share this file because they share the character and its
     walk cycle. 'dark' is the black field with the grey door in it;
     'walk' drops the same character onto the REAL PAGE, over the top of
     it, so the cosmolight you have to reach is the actual button in
     the corner rather than a drawing of one. */
  var mode = 'dark';
  var running = false, last = 0;
  var px = 420, py = 380, keys = {};
  var talks = 0, through = false, fixed = false;
  var found = false;
  var face = 'down', walked = 0, moving = false;
  var routeUntil = 0, idleSince = 0, presence = 0;
  var debris = [];

  /* YOU is the youWalk sheet: one column per facing, one row per step,
     and the step is picked by distance (16 px each), never the clock. */
  var COL = { down: 0, up: 1, left: 2, right: 3 };
  function walkFrame(dist, mov) { return mov ? ((dist / 16) | 0) % 4 : 0; }
  function drawFigure(sx, sy) {
    if (NEU.sheetDraw && NEU.sheetDraw(ctx, 'youWalk', sx, sy,
        { frame: walkFrame(walked, moving), col: COL[face], scale: 2 })) return;
    /* image still loading: the engine's figure stands in for a frame or two */
    if (NEU.engine && NEU.engine.drawPlayer) NEU.engine.drawPlayer(ctx, sx, sy, face, walked, moving, false, 2);
  }
  /* D5: squash-pop after a knock-back */
  function drawPlayer(sx, sy) {
    var pk = (performance.now() - popAt) / 300;
    if (mode === 'walk' || pk < 0 || pk >= 1 || !NEU.juice) return drawFigure(sx, sy);
    var sc = NEU.juice.pop(pk, 0.35);
    ctx.save(); ctx.translate(sx, sy); ctx.scale(sc.sx, sc.sy); ctx.translate(-sx, -sy);
    drawFigure(sx, sy);
    ctx.restore();
  }

  (function seedDebris() {
    var s = 20250815;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = 0; i < 90; i++) {
      debris.push({ x: rnd() * W, y: rnd() * H, f: rnd() < 0.25 ? 0 : 1 });   /* 0 hole, 1 pebbles */
    }
    for (var m = 0; m < 28; m++) motes.push({ x: rnd() * 2600, y: rnd() * 1800 });
  })();

  var LINES = [
    'the door is warm. that is not how doors work.',
    'something behind it is counting. it is not counting up.',
    'it says you are early. it does not say what for.',
    'the handle turns now. it was always going to.'
  ];

  /* the one textbox on the site, never a canvas copy of it */
  function say(s) { if (NEU.talk) NEU.talk([s], 'narr'); }

  function layout() {
    var dpr = 1;   /* pixel art, smoothing off: a 2x backing store is 4x the fill for nothing */
    cv.width = (innerWidth * dpr) | 0; cv.height = (innerHeight * dpr) | 0;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', function () { if (running) layout(); });

  function near(o, r) {
    return Math.hypot(px - (o.x + o.w / 2), py - (o.y + o.h / 2)) < (r || 92);
  }
  /* In walk mode the target is the real switch element, so its box is
     read from the DOM rather than stored — it is position:fixed, so
     this works at any scroll offset. */
  function swRect() {
    var el = document.getElementById('lightsToggle');
    return el ? el.getBoundingClientRect() : null;
  }
  function onSwitch(r) {
    r = r || swRect();
    if (!r) return false;
    var m = 26;
    return px >= r.left - m && px <= r.right + m && py >= r.top - m && py <= r.bottom + m;
  }

  function fitSwitch() {
    var sr = swRect();
    if (!onSwitch(sr)) return;
    if (fixed) { say('it works. go on.'); return; }
    fixed = true;
    var scx = sr.left + sr.width / 2, scy = sr.top + sr.height / 2;
    ringAdd(scx, scy, '#C9A227', 10, 120, 500, 1);
    if (NEU.juice) { NEU.juice.burst(scx, scy, 30, '#C9A227', 200); NEU.juice.hit('large', { colour: '#FFE08A' }); }
    say('the clicker seats with a click. of course it does.');
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    if (NEU.fitClicker) NEU.fitClicker();
    setTimeout(function () { if (running && mode === 'walk') close(); }, 1500);
  }

  function interact() {
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    if (mode === 'walk') return fitSwitch();
    /* endless: no door, see below */
    if (endless) return;
    if (!near(DOOR)) return;
    if (gauntQ > 0 || pulses.length) return;
    var dcx = DOOR.x + DOOR.w / 2, dcy = DOOR.y + DOOR.h / 2;
    if (talks < LINES.length) {
      var pipX = innerWidth / 2 + DOOR.x - px + 12 + talks * 16, pipY = innerHeight / 2 + DOOR.y - py - 22;
      say(LINES[talks]); talks++;
      gauntOn = true; gauntQ = talks; gauntBase = talks; gauntNext = 0;
      ringAdd(dcx, dcy, CYAN, 20, 90, 350);
      if (NEU.juice) { NEU.juice.burst(pipX, pipY, 8, CYAN); NEU.juice.hit('small'); }
      if (NEU.quest) NEU.quest.bump('answers', talks);
      if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
      return;
    }
    if (!through) {
      through = true;
      beamAt = performance.now();
      ringAdd(dcx, dcy, CYAN, 0, 260, 600);
      ringAdd(dcx, dcy, '#FFFFFF', 0, 140, 400);
      if (NEU.juice) { NEU.juice.burst(innerWidth / 2 + dcx - px, innerHeight / 2 + dcy - py, 40, CYAN, 220); NEU.juice.hit('large', { colour: CYAN }); }
      say('you step through. there is a small plastic thing on the floor.');
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.quest) NEU.quest.mark('clicker');
      if (NEU.grantClicker) NEU.grantClicker();
      /* Through the door is not another room — it is back out onto the
         page, still holding the character. The switch you have to reach
         is the one that was in the corner the whole time. */
      setTimeout(function () { if (running && mode === 'dark') toWalk(); }, 1800);
      return;
    }
    say('nothing else in here.');
  }

  /* D7: a hit is a medium shake, a 14-spark burst, a 250 ms red flash
     (unless calm or noFlash), then a 400 ms fade up from ink at the lamp */
  function unwatch(now) { if (watch.on) { watch.on = false; watch.fadeAt = now; } }
  /* WO4: screen point of the meter's fill marker (endless, same math as drawMeter) */
  function meterTip(w) {
    var mw = Math.min(240, w - 200), mx = ((w - mw) / 2) | 0, SEG = [0.40, 0.25, 0.20, 0.15];
    var EB = [[0, 150], [150, 350], [350, 600], [600, 1000]], e = EB[phase], acc = 0, i;
    var kk = Math.min(1, Math.max(0, (walked / 8 - e[0]) / (e[1] - e[0])));
    for (i = 0; i < phase; i++) acc += SEG[i];
    return { x: mx + mw * acc + 2 + (mw * SEG[phase] - 4) * kk, y: 18 };
  }
  function knockBack(h, now) {
    /* WO4: endless knock costs 25 m of score, visual burst at the meter tip */
    if (endless) {
      walked = Math.max(0, walked - 200);
      if (NEU.juice) { var tip = meterTip(innerWidth); NEU.juice.burst(tip.x, tip.y, 12, HZ_COL, 180); }
    }
    /* WO3: during the gauntlet a knock costs one answer, never the run */
    if (gauntOn && (gauntQ > 0 || pulses.length)) {
      pulses.length = 0; gauntQ = 0; talks = Math.max(0, talks - 1);
      if (NEU.juice) NEU.juice.burst(innerWidth / 2 + DOOR.x - px + 12 + talks * 16, innerHeight / 2 + DOOR.y - py - 22, 10, CYAN, 120);
    }
    if (lastMark === 1 && --charge <= 0) {
      lit[1] = false; lastMark = 0; spent = true;
      ringAdd(LANDMARKS[1].x, LANDMARKS[1].y - 42, '#5a5378', 120, 0, 500);
      if (NEU.juice) NEU.juice.burst(innerWidth / 2 + LANDMARKS[1].x - px, innerHeight / 2 + LANDMARKS[1].y - 42 - py, 24, '#5a5378', 160);
    }
    var L = LANDMARKS[lastMark];
    if (NEU.juice) {
      NEU.juice.hit('medium', { dx: L.x - h.x, dy: L.y - h.y });
      NEU.juice.burst(innerWidth / 2, innerHeight / 2, 14, HZ_COL, 180);
    }
    if (!(NEU.motion && NEU.motion.calmFlash && NEU.motion.calmFlash()) && !(NEU.juice && NEU.juice.noFlash))
      flashUntil = now + 250;
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    px = L.x; py = L.y + 36; face = 'down'; fadeUntil = now + 400;
    ringAdd(L.x, L.y - 42, L.col, 60, 0, 400);
    popAt = performance.now();
    ax = px; ay = py; idleSince = now; unwatch(now);
    if (!knocks++) say('the floor bites. you come to by the ' + L.name + '.');
  }
  /* D6: first arrival at a lamp relights it with a checkpoint hit */
  function relight(m) {
    var L = LANDMARKS[m];
    lit[m] = true;
    ringAdd(L.x, L.y - 42, L.col, 0, 180, 500);
    if (NEU.juice) {
      NEU.juice.hit('medium', { colour: L.col });
      NEU.juice.burst(innerWidth / 2 + L.x - px, innerHeight / 2 + L.y - 42 - py, 24, L.col, 180);
    }
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
  }

  function step(now) {
    if (!running) return;
    if (!NEU.kernel) raf = requestAnimationFrame(step);
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (NEU.juice && NEU.juice.frozen()) { draw(now); return; }

    var vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
    /* textbox up: no walking, hazards or watcher */
    var talk = mode !== 'walk' && !!(NEU.tboxOpen && NEU.tboxOpen());
    if (talk) { vx = 0; vy = 0; }
    moving = !!(vx || vy);

    /* Vertical wins ties so diagonal movement picks one sprite rather
       than flickering between two every frame. */
    if (vy < 0) face = 'up'; else if (vy > 0) face = 'down';
    else if (vx < 0) face = 'left'; else if (vx > 0) face = 'right';

    var dx = vx * 210 * dt, dy = vy * 210 * dt;
    var ox = px, oy = py;
    if (mode === 'walk') {
      px = Math.min(Math.max(px + dx, 12), innerWidth - 12);
      py = Math.min(Math.max(py + dy, 12), innerHeight - 12);
      if (moving) { idleSince = now; presence = 0; }
      else if (now - idleSince > 6000) {
        var reducedMotion = !!(NEU.motion && NEU.motion.reduced && NEU.motion.reduced());
        presence = reducedMotion ? 1 : Math.min(1, (now - idleSince - 6000) / 5000);
      }
    } else {
      px = Math.min(Math.max(px + dx, 20), W - 20);
      py = Math.min(Math.max(py + dy, 20), H - 20);
      for (var m = 0; m < LANDMARKS.length; m++) {
        if (Math.hypot(px - LANDMARKS[m].x, py - LANDMARKS[m].y) < 110) {
          if (m === 1 && spent) continue;
          if (m < 2) lastMark = m;   /* the door is never a checkpoint */
          if (!lit[m]) relight(m);
        }
      }
      var pn = phaseNow();
      if (pn > phaseMax) { phaseMax = pn; setPhase(pn, now); }
      phase = pn;
      if (!talk && gauntQ > 0) {
        if (gauntNext === 0) gauntNext = now;
        if (now >= gauntNext) {
          pulseAdd(DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h / 2, (gauntBase + gauntQ) % 4, now);
          gauntQ--; gauntNext = now + PULSE.tele + 700 + PULSE.gap;
        }
      }
      /* WO4: endless surges, a pulse centred on you with its gap toward the goal */
      if (endless && phase >= 2 && !talk && now >= surgeAt && pulses.length === 0) {
        var g = goal(), gs = Math.abs(g.x - px) > Math.abs(g.y - py) ? (g.x > px ? 1 : 3) : (g.y > py ? 2 : 0);
        pulseAdd(px, py, gs, now);
        surgeAt = now + (phase >= 3 ? 3500 : 5000);
        if (phase >= 3) { surge2At = now + 1200; surge2Side = (gs + 1) % 4; }
      }
      if (surge2At && !talk && now >= surge2At) { surge2At = 0; pulseAdd(px, py, surge2Side, now); }
      if (talk) { idleSince = now; unwatch(now); }
      else {
        for (var hz = 0; hz < HAZARDS.length; hz++) {
          var H0 = HAZARDS[hz];
          if (Math.abs(px - H0.x) < H0.s && Math.abs(py - H0.y) < H0.s && hazardPhase(hz, now) === 'live') {
            H0.hitAt = now; knockBack(H0, now); break;
          }
        }
        for (var sw = 0; sw < SWEEPS.length; sw++) {
          var hp = sweepPos(sw, now);
          if (Math.abs(px - hp.x) < 28 && Math.abs(py - hp.y) < 28) { knockBack(hp, now); break; }
        }
        for (var pu = 0; pu < pulses.length; pu++) {
          var PP = pulses[pu];
          if (now - PP.t0 > PULSE.tele + PULSE.r0 / PULSE.v * 1000) { pulses.splice(pu, 1); pu--; continue; }
          var pr = pulseR(PP, now), pc = Math.max(Math.abs(px - PP.x), Math.abs(py - PP.y));
          if (pr >= 0 && Math.abs(pc - pr) < PULSE.band && !inGap(PP, px, py)) { knockBack(PP, now); break; }
        }
        /* D4: any movement dismisses the watcher; stillness for 2.5 s brings it */
        if (moving || Math.hypot(px - ax, py - ay) > 40) { idleSince = now; ax = px; ay = py; unwatch(now); }
        else if (!watch.on && now - idleSince > RAMP[phase].idle) {
          var rr = (endless ? torch : LIGHT) + 20, fv = FDIR[face];
          watch.on = true; watch.x = px - fv[0] * rr; watch.y = py - fv[1] * rr;
        }
        if (watch.on) {
          var wd = Math.hypot(px - watch.x, py - watch.y);
          if (wd < 12) knockBack(watch, now);
          else { watch.x += (px - watch.x) / wd * RAMP[phase].wat * dt; watch.y += (py - watch.y) / wd * RAMP[phase].wat * dt; }
        }
      }
      /* D8: dust drifts down and wraps */
      for (var mo = 0; mo < motes.length; mo++) {
        motes[mo].y += 6 * dt;
        if (motes[mo].y > H) motes[mo].y -= H;
      }
    }
    /* walked = distance really moved, so walls stop the legs */
    var mv = Math.hypot(px - ox, py - oy);
    walked += mv; moving = mv > 0.01;

    if (!found && mode === 'dark' && !endless && near(DOOR)) {
      found = true;
      if (NEU.quest) NEU.quest.mark('greydoor');
    }
    draw(now);
  }

  /* Deltarune dark-world palette: indigo-black field, real tiles,
     magenta door, cyan for anything you can act on. */
  var INK = '#07061a', CYAN = '#5FF2FF', MAG = '#FF3FD0', TILE = 80;

  /* a lamp or sweeper this far off the screen is not drawn */
  function far(x, y, w, h) { return x < -170 || x > w + 170 || y < -170 || y > h + 170; }
  /* hollow square at screen point (x,y), half-size hs, bar thickness t */
  function frame(x, y, hs, t) {
    var s = hs * 2;
    ctx.fillRect(x - hs, y - hs, s, t); ctx.fillRect(x - hs, y + hs - t, s, t);
    ctx.fillRect(x - hs, y - hs, t, s); ctx.fillRect(x + hs - t, y - hs, t, s);
  }

  /* D5/D6: shockwave; oldest drops at 8 */
  function ringAdd(x, y, col, r0, r1, dur, s) {
    if (rings.length >= 8) rings.shift();
    rings.push({ x: x, y: y, col: col, t0: performance.now(), dur: dur, r0: r0, r1: r1, s: s ? 1 : 0 });
  }
  /* world rings take the camera, s:1 rings do not; 3 px squares */
  function drawRings(now, camX, camY, wm) {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = rings.length - 1; i >= 0; i--) {
      var R = rings[i], k = (now - R.t0) / R.dur;
      if (k >= 1) { rings.splice(i, 1); continue; }
      if (k < 0 || !!R.s !== wm) continue;
      var r = R.r0 + (R.r1 - R.r0) * (1 - Math.pow(1 - k, 3));
      ctx.globalAlpha = 1 - k; ctx.fillStyle = R.col;
      frame((R.s ? R.x : R.x - camX) | 0, (R.s ? R.y : R.y - camY) | 0, r | 0, 3);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  /* D2: the one thing to walk toward, as a world point. null when done. */
  function goal() {
    if (endless) return { x: px < W / 2 ? W : 0, y: py < H / 2 ? H : 0, col: CYAN };
    if (through) return null;
    for (var m = 0; m < 2; m++) if (!lit[m]) return LANDMARKS[m];
    return LANDMARKS[2];
  }

  function draw(now) {
    var w = innerWidth, h = innerHeight;

    if (mode === 'walk') {
      /* Transparent: the page itself is the backdrop. Only the
         character and the prompt are painted, so you are genuinely
         walking around on the site rather than on a picture of it. */
      ctx.clearRect(0, 0, w, h);
      var shook = NEU.juice ? NEU.juice.begin(ctx, w, h) : false;
      var r = swRect();
      if (r && now < routeUntil) {
        var tx = r.left + r.width / 2, ty = r.top + r.height / 2;
        ctx.save();
        ctx.globalAlpha = 0.68;
        ctx.strokeStyle = '#D8C8FF';
        ctx.lineWidth = 2;
        if (ctx.setLineDash) ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
        if (ctx.setLineDash) ctx.setLineDash([]);
        ctx.restore();
      }
      if (r) {
        var on = onSwitch(r);
        ctx.globalAlpha = on ? 0.9 : (0.34 + 0.12 * Math.sin(now / 380));
        ctx.fillStyle = '#C9A227';
        ctx.fillRect((r.left - 8) | 0, (r.top - 8) | 0, (r.width + 16) | 0, 3);
        ctx.fillRect((r.left - 8) | 0, (r.bottom + 5) | 0, (r.width + 16) | 0, 3);
        ctx.fillRect((r.left - 8) | 0, (r.top - 8) | 0, 3, (r.height + 16) | 0);
        ctx.fillRect((r.right + 5) | 0, (r.top - 8) | 0, 3, (r.height + 16) | 0);
        if (!on) {
          /* stand here: inward ticks, 0..4 px, 700 ms */
          var ins = NEU.motion && NEU.motion.reduced && NEU.motion.reduced() ? 0 : 2 - 2 * Math.cos(now * 2 * Math.PI / 700), mcx = r.left + r.width / 2, mcy = r.top + r.height / 2;
          var mids = [[mcx, r.top - 8, 0, 1], [mcx, r.bottom + 8, 0, -1], [r.left - 8, mcy, 1, 0], [r.right + 8, mcy, -1, 0]];
          for (var mi = 0; mi < 4; mi++) {
            var M4 = mids[mi], bx4 = M4[0] + M4[2] * ins, by4 = M4[1] + M4[3] * ins;
            ctx.beginPath(); ctx.moveTo(bx4 + M4[2] * 6, by4 + M4[3] * 6);
            ctx.lineTo(bx4 - M4[3] * 3, by4 + M4[2] * 3); ctx.lineTo(bx4 + M4[3] * 3, by4 - M4[2] * 3); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      if (presence > 0) {
        var calm = !!(NEU.motion && NEU.motion.reduced && NEU.motion.reduced());
        var ghostX = px - 74 + (calm ? 0 : presence * 34);
        ctx.globalAlpha = 0.34 * presence;
        ctx.fillStyle = '#8B78A8';
        ctx.beginPath(); ctx.ellipse(ghostX, py - 4, 15 + 7 * presence, 28, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      drawRings(now, 0, 0, true);
      drawPlayer(px | 0, py | 0);
      if (NEU.juice) { NEU.juice.drawParts(ctx, 1 / 60); NEU.juice.end(ctx, shook); NEU.juice.overlay(ctx, w, h); }
      if (onSwitch(r)) prompt(px | 0, (py - 40) | 0);
      return;
    }

    var camX = px - w / 2, camY = py - h / 2;
    if (endless) {
      /* 132 down to a floor of 34 over ~1200 metres. The floor exists
         because a torch that reaches zero is not a challenge, it is a
         black screen. */
      torch = Math.max(34, LIGHT - (walked / 8) * 0.08);
    }
    var bk = blackout(now), rad = Math.round(endless ? torch : LIGHT);
    if (bk === 'dark') rad = 34;
    else if (bk === 'tele') {
      /* the flicker: 132, 96, 132, 96, one step per 150 ms, with a tick */
      var BK = bkPer(), bs = ((now % BK - (BK - 600)) / 150) | 0;
      rad = bs % 2 ? 96 : 132;
      if (bs !== bkStep) { bkStep = bs; if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick(); }
    }

    /* Everything that never moves (floor, debris, door, the idle seams,
       the lamp posts) is one half-size bake, drawn up 2x with smoothing
       off: every sprite here is 2x art, so the pixels are identical. */
    if (!baked) bake();
    var shook = NEU.juice ? NEU.juice.begin(ctx, w, h) : false;
    var stillKey = !moving && !shook && now - popAt >= 300;

    /* Everything up to and including the torch mask depends only on these
       inputs. Same inputs, same pixels: reuse the finished frame instead of
       repainting and re-masking the whole canvas. */
    var dx = (DOOR.x - camX) | 0, dy = (DOOR.y - camY) | 0;
    var litNow = [px, py, w, h, cv.width, cv.height, rad, face, walkFrame(walked, moving),
                  !endless && talks >= LINES.length, !!baked, lit.join(''),
                  bk === 'tele' ? Math.floor(now / 150) : ''].join('|');
    if (!stillKey) litNow = null;
    if (litCv && litNow && litNow === litKey) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);      /* else last frames' overlays stack up */
      ctx.drawImage(litCv, 0, 0); ctx.restore();
    } else {
      litKey = litNow;
      /* only the torch box shows: clear past both edges (shake moves the origin) */
      ctx.clearRect(-w, -h, 3 * w, 3 * h);
      var bx = w / 2 - rad, by = h / 2 - rad, bs = 2 * rad;
      if (baked) {
        var sx = (camX + bx) / 2, sy = (camY + by) / 2, sw2 = bs / 2, sh2 = bs / 2, ox2 = bx, oy2 = by;
        if (sx < 0) { ox2 -= sx * 2; sw2 += sx; sx = 0; }
        if (sy < 0) { oy2 -= sy * 2; sh2 += sy; sy = 0; }
        if (sw2 > 0 && sh2 > 0) ctx.drawImage(baked, sx, sy, sw2, sh2, ox2 | 0, oy2 | 0, sw2 * 2, sh2 * 2);
      }
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bs, bs); ctx.clip();
      if (!endless && talks >= LINES.length) {
        ctx.fillStyle = CYAN;                       /* it answered: the doorway is lit */
        ctx.fillRect(dx + 12, dy + 12, DOOR.w - 24, DOOR.h - 18);
      }
      drawPlayer((px - camX) | 0, (py - camY) | 0);
      ctx.restore();

      if (rad !== gradR || w !== gradW || h !== gradH) {      /* rebuilt only on resize or a shrinking torch */
        gradR = rad; gradW = w; gradH = h;
        grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, rad);
        grad.addColorStop(0.00, 'rgba(0,0,0,1)');
        grad.addColorStop(0.45, 'rgba(0,0,0,1)');
        grad.addColorStop(0.46, 'rgba(0,0,0,0.72)');
        grad.addColorStop(0.70, 'rgba(0,0,0,0.72)');
        grad.addColorStop(0.71, 'rgba(0,0,0,0.34)');
        grad.addColorStop(1.00, 'rgba(0,0,0,0)');
      }
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = grad; ctx.fillRect(bx, by, bs, bs);
      ctx.globalCompositeOperation = 'source-over';

      /* keep the finished, masked frame for the still frames that repeat it */
      if (stillKey) {
        if (!litCv) litCv = document.createElement('canvas');
        if (litCv.width !== cv.width) litCv.width = cv.width;
        if (litCv.height !== cv.height) litCv.height = cv.height;
        var lc = litCv.getContext && litCv.getContext('2d');
        if (lc) { lc.drawImage(cv, 0, 0); } else { litCv = null; litKey = null; }
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    /* Drawn after the torch mask, so they read from across the room. */
    var calm = !!(NEU.motion && NEU.motion.reduced && NEU.motion.reduced());
    var breathe = calm ? 0 : 0.045 * Math.sin(now / 420);   /* ~2.6 s, never a flash */
    for (var m = 0; m < LANDMARKS.length; m++) {
      var L = LANDMARKS[m];
      if (m === 2 && endless) continue;
      var gd = Math.hypot(px - L.x, py - L.y);
      if (gd < LIGHT * 0.6) continue;
      var fade = Math.min(1, 900 / gd) * (m === 1 && spent ? 0.3 : 1);
      ctx.fillStyle = L.col;
      if (m === 2) {
        ctx.globalAlpha = Math.max(0, (0.16 + 0.08 * talks + breathe) * fade);
        ctx.fillRect(dx - 8, dy - 8, DOOR.w + 16, DOOR.h + 16);
        continue;
      }
      /* stepped halo, two rings, then a solid beacon you can steer by */
      var lx = (L.x - camX) | 0, ly = (L.y - camY - 42) | 0;
      ctx.globalAlpha = Math.max(0, (0.08 + breathe * 0.5) * fade);
      ctx.fillRect(lx - 36, ly - 36, 72, 72);
      ctx.globalAlpha = Math.max(0, (0.18 + breathe) * fade);
      ctx.fillRect(lx - 18, ly - 18, 36, 36);
      ctx.globalAlpha = Math.max(0.5, 0.9 * fade);
      ctx.fillRect(lx - 4, ly - 4, 8, 8);
      /* WO2: lamp 1's knock charges, filled while they last, outlined once spent */
      if (m === 1 && (lit[1] || spent)) {
        ctx.globalAlpha = 1;
        for (var pc = 0; pc < 3; pc++) {
          var cx3 = lx - 14 + pc * 12, cy3 = ly + 10;
          if (pc < charge) { ctx.fillStyle = L.col; ctx.fillRect(cx3, cy3, 6, 6); }
          else if (spent) { ctx.strokeStyle = '#5a5378'; ctx.lineWidth = 1; ctx.strokeRect(cx3 + 0.5, cy3 + 0.5, 5, 5); }
        }
      }
    }
    ctx.globalAlpha = 1;

    /* D2: door pips, filled one per answer, and the bracket that says Z works */
    if (!endless) {
      for (var pi = 0; pi < LINES.length; pi++) {
        var ppx = dx + 7 + pi * 16, ppy = dy - 27;
        if (pi < talks) {
          ctx.fillStyle = CYAN; ctx.fillRect(ppx, ppy, 10, 10);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(ppx + 3, ppy + 3, 4, 4);
        } else {
          ctx.strokeStyle = '#5a5378'; ctx.lineWidth = 2; ctx.strokeRect(ppx + 1, ppy + 1, 8, 8);
        }
      }
      if (!through && near(DOOR)) {
        var be = calm ? 0 : 2 + 2 * Math.sin(now * 2 * Math.PI / 600);   /* 0..4 px */
        var bx0 = dx - 10 - be, by0 = dy - 10 - be, bx1 = dx + DOOR.w + 10 + be, by1 = dy + DOOR.h + 10 + be;
        var busy = gauntQ > 0 || pulses.length > 0;
        ctx.fillStyle = busy ? '#5a5378' : CYAN;
        ctx.fillRect(bx0, by0, 12, 3); ctx.fillRect(bx0, by0, 3, 12);
        ctx.fillRect(bx1 - 12, by0, 12, 3); ctx.fillRect(bx1 - 3, by0, 3, 12);
        ctx.fillRect(bx0, by1 - 3, 12, 3); ctx.fillRect(bx0, by1 - 12, 3, 12);
        ctx.fillRect(bx1 - 12, by1 - 3, 12, 3); ctx.fillRect(bx1 - 3, by1 - 12, 3, 12);
      }
    }

    /* D2: objective. On screen, a bobbing chevron over the goal. Off screen,
       a chevron clamped to the edge (bottom 140 px kept clear), pointing at it. */
    var gl = goal();
    if (gl) {
      var gx = gl.x - camX, gy = gl.y - camY;
      ctx.fillStyle = gl.col; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      if (gx >= 40 && gx <= w - 40 && gy >= 40 && gy <= h - 140) {
        var tipY = gy - 6 - (calm ? 0 : 3 * (1 + Math.sin(now * 2 * Math.PI / 700)));
        ctx.beginPath(); ctx.moveTo(gx - 7, tipY - 18); ctx.lineTo(gx + 7, tipY - 18); ctx.lineTo(gx, tipY);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        var ax2 = Math.min(Math.max(gx, 40), w - 40), ay2 = Math.min(Math.max(gy, 40), h - 150);
        var sc = calm ? 1.1 : 1 + 0.125 * (1 + Math.sin(now * 2 * Math.PI / 900));
        ctx.save(); ctx.translate(ax2, ay2); ctx.rotate(Math.atan2(gy - ay2, gx - ax2)); ctx.scale(sc, sc);
        for (var tr = 1; tr <= 3; tr++) {
          ctx.globalAlpha = [0.6, 0.35, 0.15][tr - 1];
          ctx.fillRect(-(9 + 10 * tr) - 2, -2, 4, 4);
        }
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-9, -7); ctx.lineTo(-9, 7); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }

    /* D5 and D2/D4/D6/D8: additive, after the mask, so they read from across
       the room. The safe lane is always drawn so the way stays findable. */
    ctx.globalCompositeOperation = 'lighter';
    if (gl) {
      ctx.strokeStyle = '#D8C8FF'; ctx.lineWidth = 3; ctx.globalAlpha = 0.45;
      if (ctx.setLineDash) ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = calm ? 0 : -(now / 30) % 16;
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.lineTo(gl.x - camX, gl.y - camY);
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    for (var pl = 0; pl < LANDMARKS.length; pl++) {
      if (!lit[pl]) continue;
      var PL = LANDMARKS[pl], pr = [160, 100, 50], pa = [0.10, 0.18, 0.28];
      if (far(PL.x - camX, PL.y - camY, w, h)) continue;
      ctx.fillStyle = PL.col;
      for (var q = 0; q < 3; q++) {
        ctx.globalAlpha = pa[q]; ctx.beginPath();
        ctx.arc(PL.x - camX, PL.y - camY, pr[q], 0, Math.PI * 2); ctx.fill();
      }
    }

    var nearD = 1e9, sr = [28, 18, 8], sa = [0.15, 0.35, 0.9];
    ctx.fillStyle = HZ_COL;
    for (var sw = 0; sw < SWEEPS.length; sw++) {
      var hp = sweepPos(sw, now), bx = hp.x, by = hp.y;
      nearD = Math.min(nearD, Math.hypot(px - bx, py - by));
      if (far(bx - camX, by - camY, w, h)) continue;
      for (var g = 0; g < 3; g++) {
        ctx.globalAlpha = sa[g]; ctx.beginPath();
        ctx.arc(bx - camX, by - camY, sr[g], 0, Math.PI * 2); ctx.fill();
      }
    }

    for (var z = 0; z < HAZARDS.length; z++) {
      var Z = HAZARDS[z], ph = hazardPhase(z, now), was = hzPh[z] || 'idle';
      var zx = (Z.x - Z.s - camX) | 0, zy = (Z.y - Z.s - camY) | 0, zs = Z.s * 2;
      var dz = Math.hypot(px - Z.x, py - Z.y), fd = Math.min(1, 900 / dz);
      hzPh[z] = ph;
      if (ph === 'live' && was !== 'live') {
        Z.liveAt = now;   /* live edge: the tick sounds, a kick fires when you are close */
        if (dz < 260 && NEU.juice) NEU.juice.hit('tick');
      }
      /* graze: the seam went quiet with you close, and it never caught you this run */
      if (was === 'live' && ph === 'idle' && dz < 120 && !(Z.hitAt >= Z.liveAt) && NEU.juice) {
        NEU.juice.burst(w / 2, h / 2, 6, CYAN, 110); NEU.juice.hit('tick');
      }
      if (ph === 'idle') continue;
      if (ph === 'live') nearD = Math.min(nearD, dz);
      if (zx > w || zy > h || zx + zs < 0 || zy + zs < 0) continue;
      ctx.fillStyle = HZ_COL;
      if (ph === 'tele') {
        /* stepped halo, then the exact square that will hurt, outlined,
           brightening in three hard steps (no smooth fade) */
        ctx.globalAlpha = 0.12 * fd; ctx.fillRect(zx - 12, zy - 12, zs + 24, zs + 24);
        ctx.globalAlpha = 0.22 * fd; ctx.fillRect(zx - 6, zy - 6, zs + 12, zs + 12);
        var kk = hazardK(z, now) / Z.tele;
        /* 0.45 floor: at 0.3 the first step was ~1.5:1 on the indigo,
           too faint to read as a warning; the last step clears 3:1 */
        ctx.globalAlpha = (calm ? 0.75 : kk < 0.34 ? 0.45 : kk < 0.67 ? 0.65 : 0.9) * fd;
        ctx.fillRect(zx, zy, zs, 3); ctx.fillRect(zx, zy + zs - 3, zs, 3);
        ctx.fillRect(zx, zy, 3, zs); ctx.fillRect(zx + zs - 3, zy, 3, zs);
      } else {
        ctx.globalAlpha = 0.55; ctx.fillRect(zx, zy, zs, zs);
        ctx.fillStyle = '#FFE08A';
        for (var j = 0; j < 4; j++) {
          var fh = 20 + 12 * Math.sin(now / 60 + j);
          ctx.fillRect(zx + 16 + j * 28, zy + zs - fh, 6, fh);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = HZ_COL;
        if (now - (hzBurst[z] || 0) >= 180 && NEU.juice) {
          hzBurst[z] = now; NEU.juice.burst(zx + zs / 2, zy + zs / 2, 3, HZ_COL, 120);
        }
      }
    }

    /* WO3: pulse rings. Telegraph = the exact square that will hit, cyan wedge
       is the safe lane. Live = the square contracts, its gap side overpainted. */
    for (var pq = 0; pq < pulses.length; pq++) {
      var PQ = pulses[pq], pr2 = pulseR(PQ, now), age = now - PQ.t0;
      if (pr2 < 0 && age >= PULSE.tele) continue;
      var pcx = (PQ.x - camX) | 0, pcy = (PQ.y - camY) | 0;
      if (pr2 < 0) {
        var kp = age / PULSE.tele;
        var pa = calm ? 0.6 : Math.max(0, Math.min(kp / 0.08, 1, (0.75 - kp) / 0.48));
        ctx.globalAlpha = 0.9 * pa; ctx.fillStyle = HZ_COL; frame(pcx, pcy, PULSE.r0, 3);
        ctx.globalAlpha = 0.9; pulseGap(PQ.side, pcx, pcy, PULSE.r0, 5, true);
      } else {
        ctx.globalAlpha = 0.85; ctx.fillStyle = HZ_COL; frame(pcx, pcy, pr2 | 0, 4);
        ctx.globalAlpha = 1; ctx.fillStyle = '#FFE08A'; frame(pcx, pcy, Math.max(0, (pr2 - 5) | 0), 1);
        ctx.globalAlpha = 0.5; pulseGap(PQ.side, pcx, pcy, pr2 | 0, 4, false);
      }
    }
    ctx.globalAlpha = 1;

    if (nearD < 160) {
      ctx.globalAlpha = 0.5 * (1 - nearD / 160); ctx.fillStyle = phase >= 2 ? PH_COL[phase] : HZ_COL;
      ctx.fillRect(0, 0, w, 6); ctx.fillRect(0, h - 6, w, 6);
      ctx.fillRect(0, 0, 6, h); ctx.fillRect(w - 6, 0, 6, h);
    }

    /* D4: the watcher, two eyes with pupils, fading out over 300 ms after a reset */
    var wa = watch.on ? 1 : Math.max(0, 1 - (now - watch.fadeAt) / 300);
    if (wa > 0) {
      var wx = (watch.x - camX) | 0, wy = (watch.y - camY) | 0;
      ctx.globalAlpha = wa; ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(wx - 7, wy - 2, 4, 4); ctx.fillRect(wx + 3, wy - 2, 4, 4);
      ctx.fillStyle = MAG;
      ctx.fillRect(wx - 6, wy, 2, 2); ctx.fillRect(wx + 4, wy, 2, 2);
    }

    /* D8: dust motes, only inside the torch, never with reduced motion */
    if (!calm) {
      for (var mo = 0; mo < motes.length; mo++) {
        var M = motes[mo], md = Math.hypot(M.x - px, M.y - py);
        if (md >= rad) continue;
        ctx.globalAlpha = 0.5 * (1 - md / rad); ctx.fillStyle = '#D8C8FF';
        ctx.fillRect((M.x - camX) | 0, (M.y - camY) | 0, 2, 2);
      }
    }

    /* door beam, 1.8 s */
    var bt = (now - beamAt) / 1800;
    if (bt >= 0 && bt < 1) { ctx.globalAlpha = 0.35; ctx.fillStyle = CYAN; ctx.fillRect(dx + DOOR.w / 2, dy + 9, w * bt, DOOR.h - 18); }
    drawRings(now, camX, camY, false);
    ctx.globalCompositeOperation = 'source-over';
    if (flashUntil > now) { ctx.globalAlpha = 0.35; ctx.fillStyle = HZ_COL; ctx.fillRect(0, 0, w, h); }
    if (fadeUntil > now) { ctx.globalAlpha = (fadeUntil - now) / 400; ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h); }
    ctx.globalAlpha = 1;
    if (NEU.juice) { NEU.juice.drawParts(ctx, 1 / 60); NEU.juice.end(ctx, shook); NEU.juice.overlay(ctx, w, h); }
    drawMeter(now, w);

    if (!endless && !through && near(DOOR)) prompt(w / 2, h / 2 - 56, gauntQ > 0 || pulses.length ? '#5a5378' : CYAN);
  }

  var baked = null, grad = null, gradR = 0, gradW = 0, gradH = 0;
  var litCv = null, litKey = null;   /* last finished masked frame, and the inputs it was drawn from */
  function bake() {
    var S = NEU.sheets || {};
    var fl = NEU.sheetReady && NEU.sheetReady(S.darkFloor);
    if (!fl || !NEU.sheetReady(S.darkDebris) || !NEU.sheetReady(S.darkDoor)) return;
    var c = document.createElement('canvas');
    c.width = W / 2; c.height = H / 2;
    var b = c.getContext && c.getContext('2d');
    if (!b) return;
    b.imageSmoothingEnabled = false;
    b.fillStyle = INK; b.fillRect(0, 0, W / 2, H / 2);
    /* the real tile, at a third strength so the torch is the only light */
    b.globalAlpha = 0.35;
    for (var ty = 0; ty < H / 2; ty += TILE / 2)
      for (var tx = 0; tx < W / 2; tx += TILE / 2) b.drawImage(fl, tx, ty, TILE / 2, TILE / 2);
    b.globalAlpha = 1;
    for (var i = 0; i < debris.length; i++) {
      var d = debris[i];
      NEU.sheetDraw(b, 'darkDebris', (d.x / 2) | 0, (d.y / 2) | 0, { frame: d.f, scale: 1 });
    }
    NEU.sheetDraw(b, 'darkDoor', (DOOR.x + DOOR.w / 2) / 2, (DOOR.y + DOOR.h / 2) / 2, { scale: 1 });
    /* idle seams: a dim cracked square, only ever seen inside the torch */
    b.fillStyle = '#3a1410';
    for (var z = 0; z < HAZARDS.length; z++) {
      var Z = HAZARDS[z], x0 = ((Z.x - Z.s) / 2) | 0, y0 = ((Z.y - Z.s) / 2) | 0, s = Z.s | 0;
      b.fillRect(x0, y0, s, 1); b.fillRect(x0, y0 + s - 1, s, 1);
      b.fillRect(x0, y0, 1, s); b.fillRect(x0 + s - 1, y0, 1, s);
      for (var j = 4; j < s - 4; j += 3) b.fillRect(x0 + j, y0 + ((j * 7) % (s - 8)) + 4, 2, 1);
    }
    /* lamp posts for the two open-floor landmarks */
    for (var m = 0; m < 2; m++) {
      var L = LANDMARKS[m];
      b.fillStyle = '#2a2640'; b.fillRect((L.x / 2 - 1) | 0, (L.y / 2 - 18) | 0, 2, 18);
      b.fillStyle = L.col;     b.fillRect((L.x / 2 - 3) | 0, (L.y / 2 - 24) | 0, 6, 6);
    }
    baked = c;
  }

  /* progress meter: four segments, the current one fills, a triangle marks it.
     Drawn after juice.end so it never shakes. No text. */
  function drawMeter(now, w) {
    var mw = Math.min(240, w - 200), mx = ((w - mw) / 2) | 0, my = 14;
    var calm = !!(NEU.motion && NEU.motion.reduced && NEU.motion.reduced());
    var SEG = [0.40, 0.25, 0.20, 0.15], kk = 0, acc = 0, i, sx, sw, col;
    if (endless) {
      var EB = [[0, 150], [150, 350], [350, 600], [600, 1000]], e = EB[phase], m = walked / 8;
      kk = Math.min(1, Math.max(0, (m - e[0]) / (e[1] - e[0])));
    } else if (phase < 3) {
      var sb = [[0, 0.45], [0.45, 0.75], [0.75, 1]], b = sb[phase], rt = routeT();
      kk = Math.min(1, Math.max(0, (rt - b[0]) / (b[1] - b[0])));
    } else kk = Math.min(1, talks / 4);
    for (i = 0; i < 4; i++) {
      sx = mx + mw * acc + 2; sw = mw * SEG[i] - 4; col = PH_COL[i]; acc += SEG[i];
      if (i < phase) { ctx.globalAlpha = 0.9; ctx.fillStyle = col; ctx.fillRect(sx, my, sw, 8); continue; }
      ctx.globalAlpha = 1; ctx.fillStyle = INK; ctx.fillRect(sx, my, sw, 8);
      if (i > phase) { ctx.globalAlpha = 0.35; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, my + 1, sw - 2, 6); continue; }
      ctx.globalAlpha = 0.9; ctx.fillStyle = col; ctx.fillRect(sx, my, sw * kk, 8);
      if (!calm) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 200); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(sx, my, sw, 1); }
      ctx.globalAlpha = 1; ctx.fillStyle = PH_COL[phase];
      var tx = sx + sw * kk;
      ctx.beginPath(); ctx.moveTo(tx - 3, my + 12); ctx.lineTo(tx + 3, my + 12); ctx.lineTo(tx, my + 18); ctx.closePath(); ctx.fill();
    }
    /* 400 ms outline around the whole bar on each phase change */
    var fk = (now - phaseAt) / 400;
    if (fk >= 0 && fk < 1) { ctx.globalAlpha = 1 - fk; ctx.fillStyle = PH_COL[phase]; frame(mx + mw / 2, my + 4, mw / 2 + 4, 2); }
    ctx.globalAlpha = 1;
  }

  function prompt(x, y, col) {
    ctx.fillStyle = col || CYAN;
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textAlign = 'center';
    ctx.fillText('press ' + (NEU.keys ? NEU.keys.label('z') : 'z').toUpperCase(), x, y);
    ctx.textAlign = 'left';
  }

  function name(e) {
    var k = e.key;
    if (k === 'ArrowLeft'  || k === 'a' || k === 'A') return 'left';
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
    if (k === 'ArrowUp'    || k === 'w' || k === 'W') return 'up';
    if (k === 'ArrowDown'  || k === 's' || k === 'S') return 'down';
    return null;
  }
  addEventListener('keydown', function (e) {
    if (wrap.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'z' || e.key === 'Z' || e.key === 'e' || e.key === 'E') { e.preventDefault(); interact(); return; }
    var n = name(e); if (n) { keys[n] = true; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) {
    if (wrap.hidden) return;
    var n = name(e); if (n) keys[n] = false;
  });
  addEventListener('blur', function () { keys = {}; });

  /* Out of the door and onto the page, still driving the character. */
  function toWalk() {
    mode = 'walk';
    wrap.classList.add('is-walk');
    px = innerWidth / 2; py = innerHeight * 0.62;
    routeUntil = performance.now() + 6000;
    idleSince = performance.now(); presence = 0;
    face = 'up'; walked = 0;
    say('you are back on the page. the switch is where you left it.');
  }

  /* endless: no door, no way out but quitting. The torch shrinks as you
     walk, so the light kills the run. Score is metres walked. */
  var endless = false, torch = LIGHT, raf = 0;

  function open(opts) {
    if (running) return;                 /* chip-spam / double-click must not stack a second loop */
    endless = !!(opts && opts.endless);
    var wasWalk = mode === 'walk';
    mode = 'dark';
    torch = LIGHT;
    if (endless) { talks = 0; through = false; walked = 0; px = 420; py = 380; lastMark = 0; lit = [false, false, false]; charge = 3; spent = false; }
    knocks = 0; phase = phaseMax = 0; phaseAt = -1e9;
    sweepSpeed(90, 0); for (var so = 0; so < SWEEPS.length; so++) SWEEPS[so].off = 0;
    routeUntil = 0; idleSince = performance.now(); presence = 0;
    ax = px; ay = py; watch.on = false; rings.length = 0;
    pulses.length = 0; gauntOn = false; gauntQ = 0; surgeAt = 0; surge2At = 0;
    wrap.classList.remove('is-walk');
    wrap.hidden = false;
    NEU.activeMinigame = 'dark';        /* the room underneath must not move or take Escape */
    document.body.classList.add('is-playing');
    layout();
    /* reopen on the page, not at its screen coords */
    if (!endless && through && !fixed) toWalk();
    else if (!endless && wasWalk) { px = 420; py = 380; }
    keys = {}; moving = false; running = true; last = performance.now();
    /* Only the story run is an objective. Marking 'smash' from the
       library would tick a step you never earned. */
    if (NEU.quest) { if (!endless) NEU.quest.mark('smash'); NEU.quest.lock(true); }
    if (endless) say('the light is going. see how far you get.');
    if (!NEU.kernel) raf = requestAnimationFrame(step);
    if (NEU.kernel) NEU.kernel.push('dark');
  }
  function close() {
    if (!NEU.kernel) cancelAnimationFrame(raf);   /* close+reopen inside one frame must not run two loops */
    if (NEU.kernel && NEU.kernel.current() === 'dark') NEU.kernel.pop();
    if (endless && NEU.save) NEU.save.best('dark', walked / 8);
    running = false;
    endless = false;
    wrap.hidden = true;
    if (NEU.activeMinigame === 'dark') NEU.activeMinigame = null;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
  }

  /* Replay resets the errand: a kept `through`/`fixed` makes the second
     blackout unescapable. */
  function reset() {
    mode = 'dark';
    talks = 0; through = false; fixed = false; found = false;
    routeUntil = 0; idleSince = 0; presence = 0;
    px = 420; py = 380; walked = 0; face = 'down';
    lastMark = 0; knocks = 0; lit = [false, false, false]; watch.on = false;
    charge = 3; spent = false;
    phase = phaseMax = 0; phaseAt = -1e9;
    sweepSpeed(90, 0); for (var so = 0; so < SWEEPS.length; so++) SWEEPS[so].off = 0;
    pulses.length = 0; gauntOn = false; gauntQ = 0;
    if (wrap) wrap.classList.remove('is-walk');
  }

  if (NEU.tune) {
    NEU.tune.table('dark.ramp', RAMP);
    NEU.tune.table('dark.hzZone', HZ_ZONE);
    NEU.tune.table('dark.hazards', HAZARDS);
    NEU.tune.table('dark.sweeps', SWEEPS);
  }

  NEU.dark = {
    open: open, close: close, reset: reset,
    get mode() { return mode; },
    /* dev: the door is a deliberate long walk, which is right once and
       wrong the fortieth time. */
    warp:   function () { px = DOOR.x - 46; py = DOOR.y + DOOR.h / 2; },
    warpSw: function () {
      if (mode !== 'walk') toWalk();
      var r = swRect();
      if (r) { px = r.left + r.width / 2; py = r.top + r.height / 2; }
    },
    interact: interact, walkFrame: walkFrame,
    pulses: pulses, pulseR: pulseR, inGap: inGap,
    get gauntQ() { return gauntQ; },
    hazards: HAZARDS, landmarks: LANDMARKS, hazardPhase: hazardPhase,
    sweeps: SWEEPS, sweepPos: sweepPos, blackout: blackout,
    get watcher() { return watch; },
    get phase() { return phase; },
    routeT: routeT,
    get lit() { return lit; },
    get lastLandmark() { return lastMark; },
    get charge() { return charge; },
    get pos() { return { x: px, y: py }; },
    _at: function (x, y) { px = x; py = y; },   /* tests */
    _walk: function (m) { walked = m * 8; },    /* tests: endless metres */
    get running() { return running; },
    get endless() { return endless; },
    get talks() { return talks; },
    get through() { return through; },
    get fixed() { return fixed; }
  };
  if (NEU.kernel) NEU.kernel.register('dark', {
    tick: function (dt) { if (running) step(performance.now()); },
    open: open, close: close,
    running: function () { return running; }
  });

})();
