/* dark.js — after the light goes.
   ───────────────────────────────────────────────────────────────────
   You hit a jammed light switch with a hammer and made it worse. Now
   you are inside the thing, in the dark, and the only way out is to
   walk to the switch's guts and fit the part you found.

   Two objects in here: the grey DOOR (answers four times, then hands
   over the clicker) and the SWITCH (the exit — stand on it, press E).
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
  var HAZARDS = [
    { x: 923,  y: 690,  s: 64, off: 0 },
    { x: 1459, y: 1020, s: 72, off: 1200 },
    { x: 1845, y: 1257, s: 64, off: 2400 }
  ];
  var HZ_PERIOD = 3600, HZ_TELE = 1800, HZ_LIVE = 2600, HZ_END = 3400;
  var HZ_COL = '#FF5A3C';
  function hazardPhase(i, t) {
    var k = ((t + HAZARDS[i].off) % HZ_PERIOD + HZ_PERIOD) % HZ_PERIOD;
    return k < HZ_TELE ? 'idle' : k < HZ_LIVE ? 'tele' : k < HZ_END ? 'live' : 'idle';
  }
  /* 0..1 through the telegraph, for the outline's brightness */
  function teleK(i, t) {
    var k = ((t + HAZARDS[i].off) % HZ_PERIOD + HZ_PERIOD) % HZ_PERIOD;
    return (k - HZ_TELE) / (HZ_LIVE - HZ_TELE);
  }
  var lastMark = 0, knocks = 0;

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

  function knockBack(h) {
    var L = LANDMARKS[lastMark];
    if (NEU.juice) NEU.juice.hit('small', { dx: L.x - h.x, dy: L.y - h.y });
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    px = L.x; py = L.y + 36; face = 'down';
    if (!knocks++) say('the floor bites. you come to by the ' + L.name + '.');
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
        if (Math.hypot(px - LANDMARKS[m].x, py - LANDMARKS[m].y) < 110) lastMark = m;
      }
      for (var hz = 0; hz < HAZARDS.length; hz++) {
        var H0 = HAZARDS[hz];
        if (Math.abs(px - H0.x) < H0.s && Math.abs(py - H0.y) < H0.s && hazardPhase(hz, now) === 'live') {
          knockBack(H0); break;
        }
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
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, w, h);

    /* Everything that never moves (floor, debris, door, the idle seams,
       the lamp posts) is one half-size bake, drawn up 2x with smoothing
       off: every sprite here is 2x art, so the pixels are identical. */
    if (!baked) bake();
    if (baked) ctx.drawImage(baked, (-camX) | 0, (-camY) | 0, W, H);

    var dx = (DOOR.x - camX) | 0, dy = (DOOR.y - camY) | 0;
    if (!endless && talks >= LINES.length) {
      ctx.fillStyle = CYAN;                       /* it answered: the doorway is lit */
      ctx.fillRect(dx + 12, dy + 12, DOOR.w - 24, DOOR.h - 18);
    }

    drawPlayer((px - camX) | 0, (py - camY) | 0);

    if (endless) {
      /* 132 down to a floor of 34 over ~1200 metres. The floor exists
         because a torch that reaches zero is not a challenge, it is a
         black screen. */
      torch = Math.max(34, LIGHT - (walked / 8) * 0.08);
    }
    var rad = Math.round(endless ? torch : LIGHT);
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

    for (var z = 0; z < HAZARDS.length; z++) {
      var ph = hazardPhase(z, now);
      if (ph === 'idle') continue;
      var Z = HAZARDS[z];
      var zx = (Z.x - Z.s - camX) | 0, zy = (Z.y - Z.s - camY) | 0, zs = Z.s * 2;
      if (zx > w || zy > h || zx + zs < 0 || zy + zs < 0) continue;
      ctx.fillStyle = HZ_COL;
      if (ph === 'tele') {
        /* the exact square that will hurt, outlined, brightening in
           three hard steps (stepped like the torch, no smooth fade) */
        var k = teleK(z, now);
        /* 0.45 floor: at 0.3 the first step was ~1.5:1 on the indigo,
           too faint to read as a warning; the last step clears 3:1 */
        ctx.globalAlpha = calm ? 0.75 : (k < 0.34 ? 0.45 : k < 0.67 ? 0.65 : 0.9);
        ctx.fillRect(zx, zy, zs, 3); ctx.fillRect(zx, zy + zs - 3, zs, 3);
        ctx.fillRect(zx, zy, 3, zs); ctx.fillRect(zx + zs - 3, zy, 3, zs);
      } else {
        ctx.globalAlpha = 0.45;
        ctx.fillRect(zx, zy, zs, zs);
        ctx.globalAlpha = 1;
        ctx.fillRect(zx, zy, zs, 3); ctx.fillRect(zx, zy + zs - 3, zs, 3);
        ctx.fillRect(zx, zy, 3, zs); ctx.fillRect(zx + zs - 3, zy, 3, zs);
      }
    }
    ctx.globalAlpha = 1;

    if (near(DOOR)) prompt(w / 2, h / 2 - 56);
  }

  var baked = null, grad = null, gradR = 0, gradW = 0, gradH = 0;
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
    ctx.fillText('press E', x, y);
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
    if (endless) { talks = 0; through = false; walked = 0; px = 420; py = 380; lastMark = 0; }
    knocks = 0;
    routeUntil = 0; idleSince = performance.now(); presence = 0;
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
    lastMark = 0; knocks = 0;
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
