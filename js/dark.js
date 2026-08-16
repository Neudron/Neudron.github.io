/* dark.js — after the light goes.
   ───────────────────────────────────────────────────────────────────
   Smashing the Cosmolight drops the page into a blackout you can walk
   around in. There is a grey door somewhere in it. It answers four
   times before it opens.

   Three decisions worth writing down:

   1. THE LIGHT IS STEPPED, NOT SMOOTH. A radial gradient with a
      continuous falloff is the obvious way to do a torch and it looks
      wrong here — every other pixel on this site has a hard edge, and
      a soft vignette reads as a different program. The mask uses five
      discrete stops so the light has visible rings.

   2. THE DOOR GLOWS FAINTLY FROM BEYOND THE LIGHT. Without it the
      space is a uniform black field and finding anything is a random
      walk, which is not exploration, it is waiting. The glow is far
      dimmer than the torch, so you get a direction and not a map.

   3. THE DEBRIS IS SEEDED, NOT RANDOM PER FRAME. You need landmarks
      to navigate by; scenery that reshuffles every frame is worse
      than no scenery, because it actively lies about where you are. */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('dk');
  var cv   = document.getElementById('dkCanvas');
  if (!wrap || !cv) { NEU.dark = { open: function () {}, close: function () {} }; return; }
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.dark = { open: function () {}, close: function () {} }; return; }

  var W = 2600, H = 1800;                    // world
  var DOOR = { x: 2060, y: 1360, w: 74, h: 122 };
  var LIGHT = 132;

  var running = false, last = 0;
  var px = 420, py = 380, keys = {};
  var talks = 0, through = false, msg = null, msgT = 0, found = false;
  var debris = [];

  /* Deterministic scenery: same layout every visit, so the space can
     actually be learned. */
  (function seedDebris() {
    var s = 20250815;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = 0; i < 90; i++) {
      debris.push({
        x: rnd() * W, y: rnd() * H,
        w: 12 + rnd() * 90, h: 8 + rnd() * 70,
        c: rnd() < 0.25 ? '#191a24' : '#121219'
      });
    }
  })();

  var LINES = [
    'the door is warm. that is not how doors work.',
    'something behind it is counting. it is not counting up.',
    'it says you are early. it does not say what for.',
    'the handle turns now. it was always going to.'
  ];

  function say(s) { msg = s; msgT = performance.now(); }

  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = (innerWidth * dpr) | 0; cv.height = (innerHeight * dpr) | 0;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', function () { if (running) layout(); });

  function nearDoor() {
    var dx = px - (DOOR.x + DOOR.w / 2), dy = py - (DOOR.y + DOOR.h / 2);
    return Math.hypot(dx, dy) < 92;
  }

  function interact() {
    if (!nearDoor()) return;
    if (talks < LINES.length) {
      say(LINES[talks]);
      talks++;
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
      setTimeout(function () {
        say('"inter-conexion on-and-off wax free clicker". someone was proud of that.');
      }, 2600);
      return;
    }
    say('nothing else in here. the light is your problem now.');
  }

  function step(now) {
    if (!running) return;
    requestAnimationFrame(step);
    var dt = Math.min(0.033, (now - last) / 1000); last = now;

    var vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
    px = Math.min(Math.max(px + vx * 210 * dt, 20), W - 20);
    py = Math.min(Math.max(py + vy * 210 * dt, 20), H - 20);

    /* Finding it is its own step — reaching the door across a dark
       field is most of the work, and the tracker should credit that
       rather than only crediting the conversation afterwards. */
    if (!found && nearDoor()) {
      found = true;
      if (NEU.quest) NEU.quest.mark('greydoor');
    }

    draw(now);
  }

  function draw(now) {
    var w = innerWidth, h = innerHeight;
    var camX = px - w / 2, camY = py - h / 2;

    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, w, h);

    for (var i = 0; i < debris.length; i++) {
      var d = debris[i];
      ctx.fillStyle = d.c;
      ctx.fillRect((d.x - camX) | 0, (d.y - camY) | 0, d.w | 0, d.h | 0);
    }

    /* the door */
    var dx = (DOOR.x - camX) | 0, dy = (DOOR.y - camY) | 0;
    ctx.fillStyle = through ? '#3b3b48' : '#2a2a34';
    ctx.fillRect(dx, dy, DOOR.w, DOOR.h);
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(dx, dy, DOOR.w, 4);
    ctx.fillRect(dx, dy, 4, DOOR.h);
    ctx.fillRect(dx + DOOR.w - 4, dy, 4, DOOR.h);
    ctx.fillStyle = '#8A8598';
    ctx.fillRect(dx + DOOR.w - 20, dy + (DOOR.h / 2) | 0, 8, 8);
    if (talks >= LINES.length) {                    // it is open now
      ctx.fillStyle = '#B892FF';
      ctx.fillRect(dx + 6, dy + 6, DOOR.w - 12, DOOR.h - 10);
    }

    /* player */
    ctx.fillStyle = '#EDE7DE';
    ctx.fillRect((px - camX - 4) | 0, (py - camY - 6) | 0, 8, 12);
    ctx.fillStyle = '#8A8598';
    ctx.fillRect((px - camX - 4) | 0, (py - camY + 4) | 0, 8, 2);

    /* ── the dark ────────────────────────────────────────────────
       Painted over everything, then punched through. Five hard stops
       rather than a smooth falloff, so the torch has rings and reads
       as pixel art rather than as a photographic vignette. */
    var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, LIGHT);
    g.addColorStop(0.00, 'rgba(0,0,0,1)');
    g.addColorStop(0.45, 'rgba(0,0,0,1)');
    g.addColorStop(0.46, 'rgba(0,0,0,0.72)');
    g.addColorStop(0.70, 'rgba(0,0,0,0.72)');
    g.addColorStop(0.71, 'rgba(0,0,0,0.34)');
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    /* the door's own glow, dimmer than the torch — a direction, not a
       map. Without it the space is a uniform black field and finding
       anything is a random walk. */
    var gd = Math.hypot(px - (DOOR.x + DOOR.w / 2), py - (DOOR.y + DOOR.h / 2));
    if (gd > LIGHT * 0.6) {
      var pulse = 0.10 + 0.045 * Math.sin(now / 420);
      ctx.globalAlpha = Math.max(0, pulse * Math.min(1, 900 / gd));
      ctx.fillStyle = '#B892FF';
      ctx.fillRect(dx - 8, dy - 8, DOOR.w + 16, DOOR.h + 16);
      ctx.globalAlpha = 1;
    }

    if (nearDoor()) {
      ctx.fillStyle = '#EDE7DE';
      ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
      ctx.textAlign = 'center';
      ctx.fillText('press E', w / 2, h / 2 - 44);
      ctx.textAlign = 'left';
    }

    if (msg && now - msgT < 6000) {
      var bw = Math.min(680, w - 48), bx = ((w - bw) / 2) | 0, by = h - 132;
      ctx.fillStyle = '#000';       ctx.fillRect(bx, by, bw, 84);
      ctx.fillStyle = '#EDE7DE';
      ctx.fillRect(bx, by, bw, 3); ctx.fillRect(bx, by + 81, bw, 3);
      ctx.fillRect(bx, by, 3, 84); ctx.fillRect(bx + bw - 3, by, 3, 84);
      ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(msg, bx + 20, by + 30);
    }
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
    if (e.key === 'e' || e.key === 'E' || e.key === ' ') { e.preventDefault(); interact(); return; }
    var n = name(e); if (n) { keys[n] = true; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) {
    if (wrap.hidden) return;
    var n = name(e); if (n) keys[n] = false;
  });

  function open() {
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    layout();
    keys = {}; running = true; last = performance.now();
    if (NEU.quest) NEU.quest.mark('smash');
    requestAnimationFrame(step);
  }
  function close() {
    running = false;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
  }

  var q = document.getElementById('dkQuit');
  if (q) q.addEventListener('click', close);

  NEU.dark = { open: open, close: close,
               /* Dropped in for the dev console: the door is a deliberate
                  eight-second walk from spawn, which is the right length
                  once and the wrong length forty times. */
               warp: function () { px = DOOR.x - 46; py = DOOR.y + DOOR.h / 2; },
               interact: interact,
               get running() { return running; },
               get talks() { return talks; },
               get through() { return through; } };
})();
