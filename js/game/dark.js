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
  var DOOR = { x: 2060, y: 1360, w: 74, h: 122 };
  var LIGHT = 132;

  /* Two modes share this file because they share the character and its
     walk cycle. 'dark' is the black field with the grey door in it;
     'walk' drops the same character onto the REAL PAGE, over the top of
     it, so the cosmolight you have to reach is the actual button in
     the corner rather than a drawing of one. */
  var mode = 'dark';
  var running = false, last = 0;
  var px = 420, py = 380, keys = {};
  var talks = 0, through = false, fixed = false;
  var msg = null, msgT = 0, found = false;
  var face = 'down', walked = 0, moving = false;
  var debris = [];

  function drawPlayer(sx, sy) {
    /* Frame from distance walked, not from the clock — engine owns the character sprite. */
    if (NEU.engine && NEU.engine.drawPlayer) {
      NEU.engine.drawPlayer(ctx, sx, sy, face, walked, moving, false, 2);
    }
  }

  (function seedDebris() {
    var s = 20250815;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = 0; i < 90; i++) {
      debris.push({ x: rnd() * W, y: rnd() * H,
                    w: 12 + rnd() * 90, h: 8 + rnd() * 70,
                    c: rnd() < 0.25 ? '#191a24' : '#121219' });
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
    } else {
      px = Math.min(Math.max(px + dx, 20), W - 20);
      py = Math.min(Math.max(py + dy, 20), H - 20);
    }
    walked += Math.hypot(dx, dy);

    if (!found && near(DOOR)) {
      found = true;
      if (NEU.quest) NEU.quest.mark('greydoor');
    }
    draw(now);
  }

  function glow(ox, oy, ow, oh, col, dist) {
    if (dist <= LIGHT * 0.6) return;
    ctx.globalAlpha = Math.max(0, (0.10 + 0.045 * Math.sin(performance.now() / 420)) *
                                  Math.min(1, 900 / dist));
    ctx.fillStyle = col;
    ctx.fillRect(ox - 8, oy - 8, ow + 16, oh + 16);
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    var w = innerWidth, h = innerHeight;

    if (mode === 'walk') {
      /* Transparent: the page itself is the backdrop. Only the
         character and the prompt are painted, so you are genuinely
         walking around on the site rather than on a picture of it. */
      ctx.clearRect(0, 0, w, h);
      var r = swRect();
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
      drawPlayer(px | 0, py | 0);
      if (onSwitch()) {
        ctx.fillStyle = '#EDE7DE';
        ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
        ctx.textAlign = 'center';
        ctx.fillText('press E', px | 0, (py - 30) | 0);
        ctx.textAlign = 'left';
      }
      drawMsg(now);
      return;
    }

    var camX = px - w / 2, camY = py - h / 2;
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, w, h);

    for (var i = 0; i < debris.length; i++) {
      var d = debris[i];
      ctx.fillStyle = d.c;
      ctx.fillRect((d.x - camX) | 0, (d.y - camY) | 0, d.w | 0, d.h | 0);
    }

    var dx = (DOOR.x - camX) | 0, dy = (DOOR.y - camY) | 0;
    ctx.fillStyle = through ? '#3b3b48' : '#2a2a34';
    ctx.fillRect(dx, dy, DOOR.w, DOOR.h);
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(dx, dy, DOOR.w, 4); ctx.fillRect(dx, dy, 4, DOOR.h);
    ctx.fillRect(dx + DOOR.w - 4, dy, 4, DOOR.h);
    ctx.fillStyle = '#8A8598';
    ctx.fillRect(dx + DOOR.w - 20, dy + ((DOOR.h / 2) | 0), 8, 8);
    if (!endless && talks >= LINES.length) {
      ctx.fillStyle = '#B892FF';
      ctx.fillRect(dx + 6, dy + 6, DOOR.w - 12, DOOR.h - 10);
    }

    drawPlayer((px - camX) | 0, (py - camY) | 0);

    if (endless) {
      /* 132 down to a floor of 34 over ~1200 metres. The floor exists
         because a torch that reaches zero is not a challenge, it is a
         black screen. */
      torch = Math.max(34, LIGHT - (walked / 8) * 0.08);
    }
    var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, endless ? torch : LIGHT);
    g.addColorStop(0.00, 'rgba(0,0,0,1)');
    g.addColorStop(0.45, 'rgba(0,0,0,1)');
    g.addColorStop(0.46, 'rgba(0,0,0,0.72)');
    g.addColorStop(0.70, 'rgba(0,0,0,0.72)');
    g.addColorStop(0.71, 'rgba(0,0,0,0.34)');
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    /* Only the door glows now. There is nothing else in here. */
    var gd = Math.hypot(px - (DOOR.x + DOOR.w / 2), py - (DOOR.y + DOOR.h / 2));
    if (gd > LIGHT * 0.6) {
      ctx.globalAlpha = Math.max(0, (0.10 + 0.045 * Math.sin(now / 420)) * Math.min(1, 900 / gd));
      ctx.fillStyle = '#B892FF';
      ctx.fillRect(dx - 8, dy - 8, DOOR.w + 16, DOOR.h + 16);
      ctx.globalAlpha = 1;
    }

    if (near(DOOR)) {
      ctx.fillStyle = '#EDE7DE';
      ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
      ctx.textAlign = 'center';
      ctx.fillText('press E', w / 2, h / 2 - 46);
      ctx.textAlign = 'left';
    }
    drawMsg(now);
  }

  function drawMsg(now) {
    if (!msg || now - msgT > 6000) return;
    var w = innerWidth, h = innerHeight;
    var bw = Math.min(680, w - 48), bx = ((w - bw) / 2) | 0, by = h - 132;
    ctx.fillStyle = '#000'; ctx.fillRect(bx, by, bw, 84);
    ctx.fillStyle = '#EDE7DE';
    ctx.fillRect(bx, by, bw, 3); ctx.fillRect(bx, by + 81, bw, 3);
    ctx.fillRect(bx, by, 3, 84); ctx.fillRect(bx + bw - 3, by, 3, 84);
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(msg, bx + 20, by + 30);
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

  /* Out of the door and onto the page, still driving the character. */
  function toWalk() {
    mode = 'walk';
    wrap.classList.add('is-walk');
    px = innerWidth / 2; py = innerHeight * 0.62;
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
    endless = !!(opts && opts.endless);
    mode = 'dark';
    torch = LIGHT;
    if (endless) { talks = 0; through = false; walked = 0; px = 420; py = 380; }
    wrap.classList.remove('is-walk');
    wrap.hidden = false;
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
    px = 420; py = 380; walked = 0; face = 'down';
    msg = null;
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
    interact: interact,
    get running() { return running; },
    get endless() { return endless; },
    get talks() { return talks; },
    get through() { return through; },
    get fixed() { return fixed; }
  };
})();
