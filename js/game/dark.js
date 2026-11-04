/* dark.js — after the light goes.
   ───────────────────────────────────────────────────────────────────
   You hit a jammed light switch with a hammer and made it worse. Now
   you are inside the thing, in the dark, and the only way out is to
   walk to the switch's guts and fit the part you found.

   Two objects in here: the grey DOOR (answers four times, then hands
   over the clicker) and the SWITCH (the exit — stand on it, press Z).
   Neither is near the other, so the space has to be crossed twice.

   Decisions worth writing down:

   1. THE LIGHT IS STEPPED, NOT SMOOTH. A continuous radial falloff is
      the obvious way to do a torch and it looks wrong here — every
      other pixel on this site has a hard edge, so a soft vignette
      reads as a different program. Five discrete stops, visible rings.

   2. BOTH LANDMARKS GLOW FAINTLY FROM BEYOND THE TORCH, in different
      colours. Without that the space is a uniform black field and
      finding anything is a random walk, which is not exploration, it
      is waiting. Different hues so you can tell which is which from
      across the room.

   3. THE DEBRIS IS SEEDED, NOT RANDOM PER FRAME. You need landmarks
      to navigate by; scenery that reshuffles every frame is worse than
      no scenery, because it actively lies about where you are.

   4. THE WALK CYCLE ADVANCES ON DISTANCE, NOT ON TIME. Stepping every
      N milliseconds means the legs keep moving when you stop and slide
      when you change speed. Tying the frame to distance travelled
      makes the feet look like they are pushing the ground.          */

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
                    speed: 90, len: 56 });
    }
  })();
  var FDIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var BO_X = 420 + 1676 * 0.75;          /* D3: blackouts start past the line's t = 0.75 */
  var lit = [false, false, false];       /* D6: landmarks relit this run */
  var watch = { on: false, x: 0, y: 0, fadeAt: 0 };   /* D4 */
  var motes = [];                        /* D8, filled by seedDebris */
  var lastMark = 0, knocks = 0;
  var ax = 420, ay = 380;                /* D4: where the idle clock last reset */
  var flashUntil = 0, fadeUntil = 0, bkStep = -1, hzBurst = [];

  /* D9: periods stretch with distance walked in endless, never below 55% */
  function hzScale() { return endless ? Math.max(0.55, 1 - walked / 8 / 1500) : 1; }
  /* ms into the hazard's cycle, 0..period */
  function hazardK(i, t) {
    var H0 = HAZARDS[i], P = H0.per * hzScale();
    return ((t + H0.off) % P + P) % P;
  }
  function hazardPhase(i, t) {
    var k = hazardK(i, t), H0 = HAZARDS[i];
    return k < H0.tele ? 'tele' : k < H0.tele + H0.live ? 'live' : 'idle';
  }
  /* D2: ping-pong along the segment at 90 px/s */
  function sweepPos(i, t) {
    var S = SWEEPS[i], L = Math.hypot(S.x1 - S.x0, S.y1 - S.y0), d = (t / 1000 * S.speed) % (2 * L);
    if (d > L) d = 2 * L - d;
    return { x: S.x0 + (S.x1 - S.x0) * d / L, y: S.y0 + (S.y1 - S.y0) * d / L };
  }
  /* D3: 'tele' 600 ms before every 'dark' (torch at 34 px for 1.2 s, each 7 s) */
  function blackout(t) {
    if (endless ? walked / 8 <= 300 : px <= BO_X) return null;
    var k = t % 7000;
    return k < 1200 ? 'dark' : k >= 6400 ? 'tele' : null;
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
  function drawPlayer(sx, sy) {
    if (NEU.sheetDraw && NEU.sheetDraw(ctx, 'youWalk', sx, sy,
        { frame: walkFrame(walked, moving), col: COL[face], scale: 2 })) return;
    /* image still loading: the engine's figure stands in for a frame or two */
    if (NEU.engine && NEU.engine.drawPlayer) NEU.engine.drawPlayer(ctx, sx, sy, face, walked, moving, false, 2);
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
    var dpr = Math.min(devicePixelRatio || 1, 2);
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
  function onSwitch() {
    var r = swRect();
    if (!r) return false;
    var m = 26;
    return px >= r.left - m && px <= r.right + m && py >= r.top - m && py <= r.bottom + m;
  }

  function interact() {
    if (mode === 'walk') {
      if (!onSwitch()) return;
      if (fixed) { say('it works. go on.'); return; }
      fixed = true;
      say('the clicker seats with a click. of course it does.');
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.fitClicker) NEU.fitClicker();
      setTimeout(function () { close(); }, 1500);
      return;
    }

    /* Endless has no grey door and nothing behind it — see the
       endless block below. */
    if (endless) return;
    if (!near(DOOR)) return;
    if (talks < LINES.length) {
      say(LINES[talks]); talks++;
      if (NEU.quest) NEU.quest.bump('answers', talks);
      if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
      return;
    }
    if (!through) {
      through = true;
      say('you step through. there is a small plastic thing on the floor.');
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.quest) NEU.quest.mark('clicker');
      if (NEU.grantClicker) NEU.grantClicker();
      /* Through the door is not another room — it is back out onto the
         page, still holding the character. The switch you have to reach
         is the one that was in the corner the whole time. */
      setTimeout(function () { toWalk(); }, 1800);
      return;
    }
    say('nothing else in here.');
  }

  /* D7: a hit is a medium shake, a 14-spark burst, a 250 ms red flash
     (unless calm or noFlash), then a 400 ms fade up from ink at the lamp */
  function unwatch(now) { if (watch.on) { watch.on = false; watch.fadeAt = now; } }
  function knockBack(h, now) {
    var L = LANDMARKS[lastMark];
    if (NEU.juice) {
      NEU.juice.hit('medium', { dx: L.x - h.x, dy: L.y - h.y });
      NEU.juice.burst(innerWidth / 2, innerHeight / 2, 14, HZ_COL, 180);
    }
    if (!(NEU.motion && NEU.motion.calmFlash && NEU.motion.calmFlash()) && !(NEU.juice && NEU.juice.noFlash))
      flashUntil = now + 250;
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    px = L.x; py = L.y + 36; face = 'down'; fadeUntil = now + 400;
    ax = px; ay = py; idleSince = now; unwatch(now);
    if (!knocks++) say('the floor bites. you come to by the ' + L.name + '.');
  }
  /* D6: first arrival at a lamp relights it with a checkpoint hit */
  function relight(m) {
    var L = LANDMARKS[m];
    lit[m] = true;
    if (NEU.juice) {
      NEU.juice.hit('small');
      NEU.juice.burst(innerWidth / 2 + L.x - px, innerHeight / 2 + L.y - py, 24, L.col, 180);
    }
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
  }

  function step(now) {
    if (!running) return;
    requestAnimationFrame(step);
    var dt = Math.min(0.033, (now - last) / 1000); last = now;

    var vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
    moving = !!(vx || vy);

    /* Vertical wins ties so diagonal movement picks one sprite rather
       than flickering between two every frame. */
    if (vy < 0) face = 'up'; else if (vy > 0) face = 'down';
    else if (vx < 0) face = 'left'; else if (vx > 0) face = 'right';

    var dx = vx * 210 * dt, dy = vy * 210 * dt;
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
          lastMark = m;
          if (!lit[m]) relight(m);
        }
      }
      for (var hz = 0; hz < HAZARDS.length; hz++) {
        var H0 = HAZARDS[hz];
        if (Math.abs(px - H0.x) < H0.s && Math.abs(py - H0.y) < H0.s && hazardPhase(hz, now) === 'live') {
          knockBack(H0, now); break;
        }
      }
      for (var sw = 0; sw < SWEEPS.length; sw++) {
        var hp = sweepPos(sw, now);
        if (Math.abs(px - hp.x) < 28 && Math.abs(py - hp.y) < 28) { knockBack(hp, now); break; }
      }
      /* D4: any movement dismisses the watcher; stillness for 2.5 s brings it */
      if (moving || Math.hypot(px - ax, py - ay) > 40) { idleSince = now; ax = px; ay = py; unwatch(now); }
      else if (!watch.on && now - idleSince > 2500) {
        var rr = (endless ? torch : LIGHT) + 20, fv = FDIR[face];
        watch.on = true; watch.x = px - fv[0] * rr; watch.y = py - fv[1] * rr;
      }
      if (watch.on) {
        var wd = Math.hypot(px - watch.x, py - watch.y);
        if (wd < 12) knockBack(watch, now);
        else { watch.x += (px - watch.x) / wd * 60 * dt; watch.y += (py - watch.y) / wd * 60 * dt; }
      }
      /* D8: dust drifts down and wraps */
      for (var mo = 0; mo < motes.length; mo++) {
        motes[mo].y += 6 * dt;
        if (motes[mo].y > H) motes[mo].y -= H;
      }
    }
    walked += Math.hypot(dx, dy);

    if (!found && near(DOOR)) {
      found = true;
      if (NEU.quest) NEU.quest.mark('greydoor');
    }
    draw(now);
  }

  /* Deltarune dark-world palette: indigo-black field, real tiles,
     magenta door, cyan for anything you can act on. */
  var INK = '#07061a', CYAN = '#5FF2FF', MAG = '#FF3FD0', TILE = 80;

  function draw(now) {
    var w = innerWidth, h = innerHeight;

    if (mode === 'walk') {
      /* Transparent: the page itself is the backdrop. Only the
         character and the prompt are painted, so you are genuinely
         walking around on the site rather than on a picture of it. */
      ctx.clearRect(0, 0, w, h);
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
        var on = onSwitch();
        ctx.globalAlpha = on ? 0.9 : (0.34 + 0.12 * Math.sin(now / 380));
        ctx.fillStyle = '#C9A227';
        ctx.fillRect((r.left - 8) | 0, (r.top - 8) | 0, (r.width + 16) | 0, 3);
        ctx.fillRect((r.left - 8) | 0, (r.bottom + 5) | 0, (r.width + 16) | 0, 3);
        ctx.fillRect((r.left - 8) | 0, (r.top - 8) | 0, 3, (r.height + 16) | 0);
        ctx.fillRect((r.right + 5) | 0, (r.top - 8) | 0, 3, (r.height + 16) | 0);
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
      drawPlayer(px | 0, py | 0);
      if (onSwitch()) prompt(px | 0, (py - 40) | 0);
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
      var bs = ((now % 7000 - 6400) / 150) | 0;
      rad = bs % 2 ? 96 : 132;
      if (bs !== bkStep) { bkStep = bs; if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick(); }
    }

    /* Everything that never moves (floor, debris, door, the idle seams,
       the lamp posts) is one half-size bake, drawn up 2x with smoothing
       off: every sprite here is 2x art, so the pixels are identical. */
    if (!baked) bake();

    /* Everything up to and including the torch mask depends only on these
       inputs. Same inputs, same pixels: reuse the finished frame instead of
       repainting and re-masking the whole canvas. */
    var litNow = [px, py, w, h, cv.width, cv.height, rad, face, walkFrame(walked, moving),
                  !endless && talks >= LINES.length, !!baked, lit.join(''),
                  bk === 'tele' ? Math.floor(now / 150) : ''].join('|');
    if (litCv && litNow === litKey) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(litCv, 0, 0); ctx.restore();
    } else {
      litKey = litNow;
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, w, h);
      if (baked) ctx.drawImage(baked, (-camX) | 0, (-camY) | 0, W, H);

      var dx = (DOOR.x - camX) | 0, dy = (DOOR.y - camY) | 0;
      if (!endless && talks >= LINES.length) {
        ctx.fillStyle = CYAN;                       /* it answered: the doorway is lit */
        ctx.fillRect(dx + 12, dy + 12, DOOR.w - 24, DOOR.h - 18);
      }

      drawPlayer((px - camX) | 0, (py - camY) | 0);

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
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      /* keep the finished, masked frame for the frames that repeat it */
      if (!litCv) litCv = document.createElement('canvas');
      if (litCv.width !== cv.width) litCv.width = cv.width;
      if (litCv.height !== cv.height) litCv.height = cv.height;
      var lc = litCv.getContext && litCv.getContext('2d');
      if (lc) { lc.drawImage(cv, 0, 0); } else { litCv = null; litKey = null; }
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
      var fade = Math.min(1, 900 / gd);
      ctx.fillStyle = L.col;
      if (m === 2) {
        ctx.globalAlpha = Math.max(0, (0.16 + breathe) * fade);
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
    }
    ctx.globalAlpha = 1;

    /* D5 and D2/D4/D6/D8: additive, after the mask, so they read from across
       the room. The route is always drawn so the way stays findable. */
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = HZ_COL; ctx.lineWidth = 2; ctx.globalAlpha = 0.35;
    if (ctx.setLineDash) ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(LANDMARKS[0].x - camX, LANDMARKS[0].y - camY);
    ctx.lineTo(LANDMARKS[2].x - camX, LANDMARKS[2].y - camY);
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);

    for (var pl = 0; pl < LANDMARKS.length; pl++) {
      if (!lit[pl]) continue;
      var PL = LANDMARKS[pl], pr = [160, 100, 50], pa = [0.10, 0.18, 0.28];
      ctx.fillStyle = PL.col;
      for (var q = 0; q < 3; q++) {
        ctx.globalAlpha = pa[q]; ctx.beginPath();
        ctx.arc(PL.x - camX, PL.y - camY, pr[q], 0, Math.PI * 2); ctx.fill();
      }
    }

    var nearD = 1e9, sr = [28, 18, 8], sa = [0.15, 0.35, 0.9];
    ctx.fillStyle = HZ_COL;
    for (var sw = 0; sw < SWEEPS.length; sw++) {
      var hp = sweepPos(sw, now);
      nearD = Math.min(nearD, Math.hypot(px - hp.x, py - hp.y));
      for (var g = 0; g < 3; g++) {
        ctx.globalAlpha = sa[g]; ctx.beginPath();
        ctx.arc(hp.x - camX, hp.y - camY, sr[g], 0, Math.PI * 2); ctx.fill();
      }
    }

    for (var z = 0; z < HAZARDS.length; z++) {
      var ph = hazardPhase(z, now);
      if (ph === 'idle') continue;
      var Z = HAZARDS[z];
      var zx = (Z.x - Z.s - camX) | 0, zy = (Z.y - Z.s - camY) | 0, zs = Z.s * 2;
      var dz = Math.hypot(px - Z.x, py - Z.y), fd = Math.min(1, 900 / dz);
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
        ctx.fillStyle = HZ_COL;
        if (now - (hzBurst[z] || 0) >= 180 && NEU.juice) {
          hzBurst[z] = now; NEU.juice.burst(zx + zs / 2, zy + zs / 2, 3, HZ_COL, 120);
        }
      }
    }

    if (nearD < 160) {
      ctx.globalAlpha = 0.5 * (1 - nearD / 160); ctx.fillStyle = HZ_COL;
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

    ctx.globalCompositeOperation = 'source-over';
    if (flashUntil > now) { ctx.globalAlpha = 0.35; ctx.fillStyle = HZ_COL; ctx.fillRect(0, 0, w, h); }
    if (fadeUntil > now) { ctx.globalAlpha = (fadeUntil - now) / 400; ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h); }
    ctx.globalAlpha = 1;

    if (near(DOOR)) prompt(w / 2, h / 2 - 56);
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

  function prompt(x, y) {
    ctx.fillStyle = CYAN;
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

  /* ── endless ────────────────────────────────────────────────────
     Launched from the console's library there is no grey door and no
     way out but quitting. The torch shrinks the further you walk, so
     the thing that kills a run is the light, not a hazard — which
     suits a walking sim better than bolting an enemy onto it.

     Score is metres walked. `walked` is already being accumulated for
     the walk cycle, so the score is a number the game was computing
     anyway. */
  var endless = false, torch = LIGHT;

  function open(opts) {
    if (running) return;                 /* chip-spam / double-click must not stack a second loop */
    endless = !!(opts && opts.endless);
    mode = 'dark';
    torch = LIGHT;
    if (endless) { talks = 0; through = false; walked = 0; px = 420; py = 380; lastMark = 0; lit = [false, false, false]; }
    knocks = 0;
    routeUntil = 0; idleSince = performance.now(); presence = 0;
    ax = px; ay = py; watch.on = false;
    wrap.classList.remove('is-walk');
    wrap.hidden = false;
    NEU.activeMinigame = 'dark';        /* the room underneath must not move or take Escape */
    document.body.classList.add('is-playing');
    layout();
    keys = {}; moving = false; running = true; last = performance.now();
    /* Only the story run is an objective. Marking 'smash' from the
       library would tick a step you never earned. */
    if (NEU.quest) { if (!endless) NEU.quest.mark('smash'); NEU.quest.lock(true); }
    if (endless) say('the light is going. see how far you get.');
    requestAnimationFrame(step);
  }
  function close() {
    if (endless && NEU.save) NEU.save.best('dark', walked / 8);
    running = false;
    endless = false;
    wrap.hidden = true;
    if (NEU.activeMinigame === 'dark') NEU.activeMinigame = null;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
  }

  var q = document.getElementById('dkQuit');
  if (q) q.addEventListener('click', close);

  /* Replaying the hammer must replay the whole errand. Without this
     the module keeps `through` and `fixed` from the first run, the
     grey door has nothing left to give, and the second blackout is
     unescapable — which is exactly the trap that got reported. */
  function reset() {
    mode = 'dark';
    talks = 0; through = false; fixed = false; found = false;
    routeUntil = 0; idleSince = 0; presence = 0;
    px = 420; py = 380; walked = 0; face = 'down';
    lastMark = 0; knocks = 0; lit = [false, false, false]; watch.on = false;
    if (wrap) wrap.classList.remove('is-walk');
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
    hazards: HAZARDS, landmarks: LANDMARKS, hazardPhase: hazardPhase,
    sweeps: SWEEPS, sweepPos: sweepPos, blackout: blackout,
    get watcher() { return watch; },
    get lit() { return lit; },
    get lastLandmark() { return lastMark; },
    get pos() { return { x: px, y: py }; },
    _at: function (x, y) { px = x; py = y; },   /* tests */
    get running() { return running; },
    get endless() { return endless; },
    get talks() { return talks; },
    get through() { return through; },
    get fixed() { return fixed; }
  };
})();
