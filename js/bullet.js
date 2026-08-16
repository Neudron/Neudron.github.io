/* bullet.js — the room behind the door.
   ───────────────────────────────────────────────────────────────────
   A twenty-second survival, Touhou by way of Undertale: you are a
   small soul in a bounded box and several emitters are extremely
   interested in where you are standing.

   Why a full-screen overlay and not a canvas inside the panel: a
   bullet pattern needs room to be readable. Cramped into a 420px
   sidebar the same pattern stops being a pattern and becomes noise,
   and dodging turns into luck. The panel starts it; the game takes
   the screen.

   Conventions borrowed on purpose, because they are load-bearing:

     · SHIFT focuses — you move slower and your true hitbox is drawn.
       Every danmaku game does this, and it is the difference between
       "unfair" and "tight". The hitbox is much smaller than the
       sprite, and you cannot dodge well without being shown that.
     · Invulnerability frames after a hit, with the soul flashing.
       Without them one bad frame costs all three HP in a row.
     · Bullets spawn OUTSIDE the arena and are culled well beyond it,
       so nothing ever pops into existence on top of you.

   Everything is drawn with integer fillRect, matching the rest of the
   page — this site is made of hard pixels and a smooth anti-aliased
   circle would look like it came from a different website.          */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('bh');
  var cv   = document.getElementById('bhCanvas');
  if (!wrap || !cv) { NEU.bullet = { open: function () {}, close: function () {} }; return; }
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.bullet = { open: function () {}, close: function () {} }; return; }

  var hud  = document.getElementById('bhHud');
  var msg  = document.getElementById('bhMsg');

  var SURVIVE   = 20;          // seconds
  var PLAYER_R  = 3.2;         // the TRUE hitbox. the sprite is much bigger.
  var SPEED     = 258, FOCUS_SPEED = 112;
  var IFRAMES   = 1.15;
  var MAX_B     = 700;

  var COL = { bone: '#EDE7DE', lilac: '#B892FF', blood: '#C2405F',
              dim: '#8A8598', soul: '#E23B55', void_: '#08080B' };

  /* The soul, an actual heart rather than a square: 7x7 cells at 2px,
     so it sits on the same pixel grid as the rest of the site. The
     TRUE hitbox is still PLAYER_R at the centre — the sprite is
     decoration, and focus mode exists to show you the difference. */
  var HEART = [
    '.##.##.',
    '#######',
    '#######',
    '#######',
    '.#####.',
    '..###..',
    '...#...'
  ];
  /* Blaster skull. '#' is bone, 'o' is socket. */
  var SKULL = [
    '..#####..',
    '.#######.',
    '#oo###oo#',
    '#oo###oo#',
    '#########',
    '.#######.',
    '..#####..',
    '...#.#...'
  ];
  function stamp(rows, cx, cy, s, on, off) {
    var h = rows.length, w = rows[0].length;
    var x0 = (cx - w * s / 2) | 0, y0 = (cy - h * s / 2) | 0;
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) {
      var ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = (ch === 'o') ? off : on;
      ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
    }
  }

  var blasters = [];
  var BL_CHARGE = 0.85, BL_FIRE = 0.42, BL_HALF = 17;
  var dying = 0, shards = [];

  var running = false, won = false;
  var t = 0, hp = 3, inv = 0, last = 0;
  var px = 0, py = 0, keys = {};
  var bullets = [], emitters = [];
  var AW = 0, AH = 0, AX = 0, AY = 0;     // arena rect, canvas space
  var cheat = '';                          // the 69420 buffer

  /* ── layout ───────────────────────────────────────────────────────
     Fixed backing store at devicePixelRatio, arena derived from it.
     Recomputed on resize because a mid-run resize otherwise leaves the
     player outside the box. */
  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var w = innerWidth, h = innerHeight;
    cv.width = (w * dpr) | 0; cv.height = (h * dpr) | 0;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    AW = Math.min(760, w - 48);
    AH = Math.min(520, h - 190);
    AX = ((w - AW) / 2) | 0;
    AY = ((h - AH) / 2 + 22) | 0;
    px = Math.min(Math.max(px, AX + 12), AX + AW - 12);
    py = Math.min(Math.max(py, AY + 12), AY + AH - 12);
  }
  addEventListener('resize', function () { if (running) layout(); });

  /* ── emitters ─────────────────────────────────────────────────────
     Each has its own cadence and a phase, so they drift out of sync
     rather than all firing on the same beat — synchronised emitters
     produce corridors you can stand in forever. */
  function resetEmitters() {
    emitters = [
      { kind: 'ring',   every: 1.30, next: 0.8, ang: 0 },
      { kind: 'aimed',  every: 0.95, next: 1.6, ang: 0 },
      { kind: 'spiral', every: 0.075, next: 5.0, ang: 0 },
      { kind: 'wall',   every: 2.60, next: 10.0, ang: 0 },
      { kind: 'blaster',every: 3.10, next: 7.5,  ang: 0 }
    ];
    blasters = [];
  }

  function add(x, y, vx, vy, r, c) {
    if (bullets.length >= MAX_B) return;
    bullets.push({ x: x, y: y, vx: vx, vy: vy, r: r, c: c });
  }

  /* Difficulty ramp: 0 at the start, 1 at the end. Everything scales
     off this one number so the curve stays legible and tunable. */
  function ramp() { return Math.min(1, t / SURVIVE); }

  function fire(e) {
    var k = ramp();
    var cx = AX + AW / 2, cy = AY + AH / 2;

    if (e.kind === 'ring') {
      var n = 10 + Math.round(k * 12);
      var sp = 78 + k * 52;
      e.ang += 0.31;
      for (var i = 0; i < n; i++) {
        var a = e.ang + i * (Math.PI * 2 / n);
        add(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14,
            Math.cos(a) * sp, Math.sin(a) * sp, 4, COL.lilac);
      }
    } else if (e.kind === 'aimed') {
      /* Fired from a random edge point, spread around the player's
         current position. Aimed shots are what stop you parking in a
         corner; rings alone are dodgeable by standing still. */
      var side = (Math.random() * 4) | 0, sx, sy;
      if (side === 0) { sx = AX + Math.random() * AW; sy = AY - 16; }
      else if (side === 1) { sx = AX + AW + 16; sy = AY + Math.random() * AH; }
      else if (side === 2) { sx = AX + Math.random() * AW; sy = AY + AH + 16; }
      else { sx = AX - 16; sy = AY + Math.random() * AH; }
      var base = Math.atan2(py - sy, px - sx);
      var cnt = 3 + Math.round(k * 3), spd = 128 + k * 92;
      for (var j = 0; j < cnt; j++) {
        var off = (j - (cnt - 1) / 2) * 0.17;
        add(sx, sy, Math.cos(base + off) * spd, Math.sin(base + off) * spd, 4, COL.bone);
      }
    } else if (e.kind === 'spiral') {
      if (t < 5) return;
      e.ang += 0.42;
      var arms = 2 + Math.round(k * 2), s2 = 96 + k * 44;
      for (var m = 0; m < arms; m++) {
        var a2 = e.ang + m * (Math.PI * 2 / arms);
        add(cx, cy, Math.cos(a2) * s2, Math.sin(a2) * s2, 3, COL.blood);
      }
    } else if (e.kind === 'blaster') {
      if (t < 7) return;
      /* Axis-aligned, the way sans' own are: they line up on an edge
         and fire straight across. It also keeps the beam an
         axis-aligned rectangle, which makes the collision honest and
         the pixels square.

         The lane is offset from where you are RIGHT NOW rather than
         aimed exactly, so standing still is punished but the shot is
         still dodgeable during the charge — which is the entire job
         of the charge. */
      var horiz = Math.random() < 0.5, bl = { horiz: horiz, t: 0 };
      if (horiz) {
        bl.lane = Math.min(Math.max(py + (Math.random() - 0.5) * 110, AY + 34), AY + AH - 34);
        bl.from = Math.random() < 0.5 ? 'l' : 'r';
      } else {
        bl.lane = Math.min(Math.max(px + (Math.random() - 0.5) * 110, AX + 34), AX + AW - 34);
        bl.from = Math.random() < 0.5 ? 't' : 'b';
      }
      blasters.push(bl);
    } else if (e.kind === 'wall') {
      if (t < 10) return;
      /* A line with one gap. The gap is the entire point — a wall with
         no gap is not a pattern, it is a cutscene. */
      var vertical = Math.random() < 0.5;
      var gap = 0.18 + Math.random() * 0.5;
      var cells = 16, sp3 = 104 + k * 46;
      for (var q = 0; q < cells; q++) {
        var f = q / (cells - 1);
        if (Math.abs(f - gap) < 0.13) continue;
        if (vertical) {
          var fromTop = Math.random() < 0.5;
          add(AX + f * AW, fromTop ? AY - 14 : AY + AH + 14, 0, fromTop ? sp3 : -sp3, 4, COL.dim);
        } else {
          var fromLeft = Math.random() < 0.5;
          add(fromLeft ? AX - 14 : AX + AW + 14, AY + f * AH, fromLeft ? sp3 : -sp3, 0, 4, COL.dim);
        }
      }
    }
  }

  /* ── loop ─────────────────────────────────────────────────────────*/
  function step(now) {
    if (!running) return;
    requestAnimationFrame(step);

    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    t += dt;

    /* move */
    var vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }      // no free diagonal speed
    var sp = keys.focus ? FOCUS_SPEED : SPEED;
    px += vx * sp * dt; py += vy * sp * dt;
    px = Math.min(Math.max(px, AX + 7), AX + AW - 7);
    py = Math.min(Math.max(py, AY + 7), AY + AH - 7);

    /* fire */
    for (var i = 0; i < emitters.length; i++) {
      var e = emitters[i];
      if (t >= e.next) { e.next = t + e.every; fire(e); }
    }

    /* advance + cull + collide */
    if (inv > 0) inv -= dt;
    var keep = [];
    for (var b, n = 0; n < bullets.length; n++) {
      b = bullets[n];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < AX - 60 || b.x > AX + AW + 60 || b.y < AY - 60 || b.y > AY + AH + 60) continue;
      keep.push(b);
      if (inv <= 0) {
        var dx = b.x - px, dy = b.y - py, rr = b.r + PLAYER_R;
        if (dx * dx + dy * dy < rr * rr) {
          hp--; inv = IFRAMES;
          if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
          if (hp <= 0) { startDeath(); return; }
        }
      }
    }
    bullets = keep;

    /* blasters */
    var kb = [];
    for (var q = 0; q < blasters.length; q++) {
      var bl = blasters[q];
      bl.t += dt;
      if (bl.t > BL_CHARGE + BL_FIRE) continue;
      kb.push(bl);
      if (inv <= 0 && bl.t > BL_CHARGE) {
        var off = bl.horiz ? Math.abs(py - bl.lane) : Math.abs(px - bl.lane);
        if (off < BL_HALF + PLAYER_R) {
          hp--; inv = IFRAMES;
          if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
          if (hp <= 0) { startDeath(); return; }
        }
      }
    }
    blasters = kb;

    if (t >= SURVIVE) { finish(true); return; }
    draw();
  }

  function draw() {
    var w = innerWidth, h = innerHeight;
    ctx.fillStyle = 'rgba(8,8,11,0.92)';
    ctx.fillRect(0, 0, w, h);

    /* arena */
    ctx.fillStyle = COL.void_;
    ctx.fillRect(AX, AY, AW, AH);
    ctx.fillStyle = COL.bone;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3);
    ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH);
    ctx.fillRect(AX + AW, AY, 3, AH);

    /* bullets — squares on integer coords, like everything else here */
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i], s = (b.r * 2) | 0;
      ctx.fillStyle = b.c;
      ctx.fillRect((b.x - b.r) | 0, (b.y - b.r) | 0, s, s);
    }

    /* blasters: a warning line while charging, a beam while firing.
       The telegraph is not politeness — an untelegraphed instant beam
       is unreadable and the death feels arbitrary. */
    for (var q = 0; q < blasters.length; q++) {
      var bl = blasters[q];
      var charging = bl.t < BL_CHARGE;
      var k = charging ? bl.t / BL_CHARGE : 1;
      var sx2, sy2;
      if (bl.horiz) { sx2 = bl.from === 'l' ? AX - 26 : AX + AW + 26; sy2 = bl.lane; }
      else          { sx2 = bl.lane; sy2 = bl.from === 't' ? AY - 26 : AY + AH + 26; }

      if (charging) {
        if (((bl.t * 20) | 0) % 2 === 0) {
          ctx.fillStyle = 'rgba(237,231,222,0.22)';
          if (bl.horiz) ctx.fillRect(AX, (bl.lane - 1) | 0, AW, 2);
          else          ctx.fillRect((bl.lane - 1) | 0, AY, 2, AH);
        }
        stamp(SKULL, sx2, sy2, 2 + (k * 2) | 0, COL.bone, COL.void_);
      } else {
        var f = 1 - (bl.t - BL_CHARGE) / BL_FIRE;      // beam narrows as it dies
        var hh = (BL_HALF * f) | 0;
        ctx.fillStyle = COL.bone;
        if (bl.horiz) ctx.fillRect(AX, (bl.lane - hh) | 0, AW, hh * 2);
        else          ctx.fillRect((bl.lane - hh) | 0, AY, hh * 2, AH);
        ctx.fillStyle = '#FFFFFF';
        if (bl.horiz) ctx.fillRect(AX, (bl.lane - hh / 3) | 0, AW, Math.max(2, (hh / 1.5) | 0));
        else          ctx.fillRect((bl.lane - hh / 3) | 0, AY, Math.max(2, (hh / 1.5) | 0), AH);
        stamp(SKULL, sx2, sy2, 4, COL.bone, COL.void_);
      }
    }

    /* the soul. flashes while invulnerable so the state is visible. */
    if (inv <= 0 || ((inv * 14) | 0) % 2 === 0) stamp(HEART, px, py, 2, COL.soul, COL.soul);
    /* focus reveals the true hitbox — the whole reason focus exists */
    if (keys.focus) {
      ctx.fillStyle = COL.bone;
      ctx.fillRect((px - PLAYER_R) | 0, (py - PLAYER_R) | 0, 3, 3);
    }

    /* hud: time bar + hp */
    var bw = AW, bx = AX, by = AY - 22;
    ctx.fillStyle = '#22222E'; ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = COL.lilac; ctx.fillRect(bx, by, (bw * (t / SURVIVE)) | 0, 6);
    ctx.fillStyle = COL.bone;
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('HP ' + Math.max(0, hp) + '/3', AX, AY + AH + 12);
    var left = Math.max(0, SURVIVE - t).toFixed(1);
    ctx.fillText(left + 's', AX + AW - 44, AY + AH + 12);
  }

  /* ── start / finish ───────────────────────────────────────────────*/
  function begin() {
    layout();
    t = 0; hp = 3; inv = 0; won = false; cheat = '';
    bullets = []; resetEmitters();
    px = AX + AW / 2; py = AY + AH - 60;
    keys = {};
    running = true; last = performance.now();
    if (msg) msg.hidden = true;
    requestAnimationFrame(step);
  }

  /* ── death ────────────────────────────────────────────────────────
     Undertale holds the cracked soul for a beat before it goes, and
     that beat is the whole animation. Shatter it on the frame of the
     hit and it reads as a rendering glitch; hold it for ~400ms with a
     split down the middle and it reads as a death.

     The fragments are the heart's OWN cells, thrown outward from where
     each one sat, so the pieces visibly belong to the thing that
     broke rather than being generic debris. */
  function startDeath() {
    running = false;                 // stops the main loop's next frame
    dying = performance.now();
    shards = [];
    for (var r = 0; r < 7; r++) for (var c = 0; c < 7; c++) {
      if (HEART[r][c] !== '#') continue;
      var ox = (c - 3) * 2, oy = (r - 3) * 2;
      shards.push({ x: px + ox, y: py + oy,
                    vx: ox * 15 + (Math.random() - 0.5) * 70,
                    vy: oy * 10 - 155 - Math.random() * 90 });
    }
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    requestAnimationFrame(deathStep);
  }

  function arena() {
    ctx.fillStyle = 'rgba(8,8,11,0.92)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = COL.void_; ctx.fillRect(AX, AY, AW, AH);
    ctx.fillStyle = COL.bone;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3);
    ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH);
    ctx.fillRect(AX + AW, AY, 3, AH);
  }

  function deathStep(now) {
    var ms = now - dying;
    arena();

    if (ms < 420) {                            // the held beat, cracked
      stamp(HEART, px, py, 2, COL.soul, COL.soul);
      ctx.fillStyle = COL.void_;
      ctx.fillRect((px - 1) | 0, (py - 8) | 0, 2, 16);
      if (((ms / 55) | 0) % 2 === 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect((px - 1) | 0, (py - 8) | 0, 2, 6);
      }
      requestAnimationFrame(deathStep);
      return;
    }

    var k = (ms - 420) / 1000;                 // seconds since the shatter
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      ctx.globalAlpha = Math.max(0, 1 - k / 1.15);
      ctx.fillStyle = COL.soul;
      ctx.fillRect((s.x + s.vx * k) | 0, (s.y + s.vy * k + 900 * k * k) | 0, 2, 2);
    }
    ctx.globalAlpha = 1;

    if (ms > 1700) { dying = 0; finish(false, true); return; }
    requestAnimationFrame(deathStep);
  }

  function finish(good, quiet) {
    running = false; won = good;
    if (!quiet) draw();
    if (msg) {
      msg.hidden = false;
      msg.innerHTML = good
        ? '<b>you made it.</b><br>twenty seconds. take the dog food.<br><small>esc to leave</small>'
        : '<b>ouch.</b><br>enter to try again &middot; esc to leave';
    }
    if (good) {
      if (NEU.quest) NEU.quest.mark('survive');
      if (NEU.grantDogFood) NEU.grantDogFood();
    }
  }

  /* ── input ────────────────────────────────────────────────────────*/
  function keyName(e) {
    var k = e.key;
    if (k === 'ArrowLeft'  || k === 'a' || k === 'A') return 'left';
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
    if (k === 'ArrowUp'    || k === 'w' || k === 'W') return 'up';
    if (k === 'ArrowDown'  || k === 's' || k === 'S') return 'down';
    if (k === 'Shift') return 'focus';
    return null;
  }

  addEventListener('keydown', function (e) {
    if (wrap.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (!running && e.key === 'Enter') { begin(); return; }

    var n = keyName(e);
    if (n) { keys[n] = true; e.preventDefault(); }

    /* the code. buffered rather than matched per-key so it survives
       being typed while you are also dodging with the other hand. */
    if (running && /^[0-9]$/.test(e.key)) {
      cheat = (cheat + e.key).slice(-5);
      if (cheat === '69420') { t = SURVIVE; }
    }
  });
  addEventListener('keyup', function (e) {
    if (wrap.hidden) return;
    var n = keyName(e);
    if (n) keys[n] = false;
  });

  function open() {
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    begin();
  }
  function close() {
    running = false;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
  }

  var startBtn = document.getElementById('bhStart');
  if (startBtn) startBtn.addEventListener('click', open);
  var quitBtn = document.getElementById('bhQuit');
  if (quitBtn) quitBtn.addEventListener('click', close);

  NEU.bullet = { open: open, close: close, get running() { return running; },
                 get won() { return won; } };
})();
