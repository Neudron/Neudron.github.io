/* scal-seekers.js — the Supreme Soul Seeker ring, as a stage prop.
   ───────────────────────────────────────────────────────────────────
   At 20% health she summons ten Soul Seekers in a rotating ring and is
   invulnerable until they die (official wiki; spawn ring at
   SupremeCalamitas.cs:2011-2018, per-seeker AI in SoulSeekerSupreme.cs).

   Same contract as scal-worm.js: this module owns the ring, the volley
   clock, its darts and its drawing, and NOTHING about the player. The
   fight drives tick()/tickDarts() and decides what the callbacks mean.

   THE RING RADIUS IS NOT THE SOURCE'S. SoulSeekerSupreme spawns at 225
   Terraria px from SCal — about 151 site px on this project's 224:150
   ratio — but she rests at `by = AY - 24`, ABOVE the arena frame, and a
   151px ring around her would put half the seekers off-screen. The
   fight parks her inside the arena for this phase (which is what the
   source does anyway: she is immobile and invulnerable while the
   seekers work) and the radius is trimmed to 110 so the whole ring
   stays inside a 700x460 box.                                       */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  /* ── tuning ────────────────────────────────────────────────────── */
  var SEEKERS   = 10;          // wiki: "a large rotating ring of 10"
  var RING_R    = 110;         // see the header note
  var RING_SPIN = Math.PI / 6; // SoulSeekerSupreme.cs:208, 0.5 deg/frame = 30 deg/s
  var SEEKER_R  = 20;          // source hitbox is 40x40
  var SEEKER_HP = 1;

  var VOLLEY_EVERY = 3;        // SoulSeekerSupreme.cs:143, shootRate = 180 frames
  var DART_SPEED   = 200;      // source velocity 5 T-px/frame = 300 T-px/s
  var DART_R       = 4;
  var GRAZE_R = 28, HIT_PAD = 8, CULL = 48;

  /* ── state ─────────────────────────────────────────────────────── */
  var ctx = null;
  var AX = 0, AY = 0, AW = 640, AH = 480;
  var targetFn = null;
  var seekers = [], darts = [];
  var ringAng = 0, volleyCd = 0, spawned = false;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function dist(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function tgt() {
    var p = targetFn ? targetFn() : null;
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number')
      p = { x: AX + AW / 2, y: AY + AH / 2 };
    return p;
  }
  /* one blitter call site, mirroring scal-worm's */
  function sprite(key, x, y, scale, rot, now, glowKeys) {
    if (!NEU.sheetDraw || !ctx) return false;
    return NEU.sheetDraw(ctx, key, x, y, {
      scale: scale, rot: rot, now: now, glowKeys: glowKeys
    });
  }

  /* ── lifecycle ─────────────────────────────────────────────────── */
  function spawn() {
    seekers.length = 0;
    darts.length = 0;
    ringAng = 0;                          // fixed: deterministic open
    volleyCd = VOLLEY_EVERY;              // one beat of grace before the first volley
    for (var i = 0; i < SEEKERS; i++)
      seekers.push({ a: i * Math.PI * 2 / SEEKERS, x: 0, y: 0, hp: SEEKER_HP });
    spawned = true;
    place();
  }
  function clear() {
    seekers.length = 0;
    darts.length = 0;
    spawned = false;
  }
  function place() {
    var p = tgt();
    for (var i = 0; i < seekers.length; i++) {
      var s = seekers[i];
      s.x = clamp(p.x + Math.cos(ringAng + s.a) * RING_R, AX + 8, AX + AW - 8);
      s.y = clamp(p.y + Math.sin(ringAng + s.a) * RING_R, AY + 8, AY + AH - 8);
    }
  }

  /* ── tick ──────────────────────────────────────────────────────── */
  function tick(dt) {
    if (!spawned || !(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    ringAng += RING_SPIN * dt;
    place();
    volleyCd -= dt;
    if (volleyCd > 0) return;
    volleyCd = VOLLEY_EVERY;
    /* Synchronous volley — every living seeker fires one dart at the
       player at once (wiki: "fire synchronous volleys of Brimstone
       Darts"). The site's own arena is small, so the ring is the wall:
       ten darts converging from a circle, once every three seconds. */
    var p = plX === null ? tgt() : { x: plX, y: plY };
    for (var i = 0; i < seekers.length; i++) {
      var s = seekers[i];
      if (s.hp <= 0) continue;
      var a = Math.atan2(p.y - s.y, p.x - s.x);
      darts.push({ x: s.x, y: s.y,
                   vx: Math.cos(a) * DART_SPEED,
                   vy: Math.sin(a) * DART_SPEED,
                   r: DART_R });
    }
  }

  var plX = null, plY = 0;

  /* ── darts ─────────────────────────────────────────────────────── */
  /* Identical contract to scal-worm.tickDarts: grazeCb takes no
     arguments, hitCb takes the dart. The fight routes both set-pieces
     through the same two callbacks. */
  function tickDarts(dt, soulX, soulY, grazeCb, hitCb) {
    if (!(dt > 0)) return;
    for (var i = darts.length - 1; i >= 0; i--) {
      var d = darts[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      var ds = dist(d.x, d.y, soulX, soulY);
      if (ds <= d.r + HIT_PAD) {
        darts.splice(i, 1);
        if (hitCb) hitCb(d);
        continue;
      }
      if (ds <= GRAZE_R && grazeCb) grazeCb();
      if (d.x < AX - CULL || d.x > AX + AW + CULL ||
          d.y < AY - CULL || d.y > AY + AH + CULL) darts.splice(i, 1);
    }
  }

  /* ── damage ───────────────────────────────────────────────────── */
  function hit(x, y, r) {
    for (var i = 0; i < seekers.length; i++) {
      var s = seekers[i];
      if (s.hp <= 0) continue;
      if (dist(s.x, s.y, x, y) < SEEKER_R + r) {
        s.hp--;
        if (s.hp <= 0) {
          if (NEU.juice) NEU.juice.burst(s.x, s.y, 10, '#FF4A2A', 1.2);
          seekers.splice(i, 1);
        }
        return true;
      }
    }
    return false;
  }
  function alive() { return seekers.length; }

  /* ── drawing ──────────────────────────────────────────────────── */
  function draw(now) {
    if (!ctx || !spawned) return;
    var i, d, s;
    for (i = 0; i < darts.length; i++) {
      d = darts[i];
      if (!sprite('dart', d.x, d.y, 0.5, Math.atan2(d.vy, d.vx) + Math.PI / 2, now)) {
        ctx.fillStyle = '#FF4A2A';
        ctx.fillRect((d.x - d.r) | 0, (d.y - d.r) | 0, d.r * 2, d.r * 2);
      }
    }
    /* Glow mask stacked additively — the same way the brothers' glows
       already stack in boss-scal.js:1270. */
    for (i = 0; i < seekers.length; i++) {
      s = seekers[i];
      var rot = Math.atan2(s.y - (AY + AH / 2), s.x - (AX + AW / 2));
      if (!sprite('soulSeeker', s.x, s.y, 0.7, rot, now, ['soulSeekerGlow'])) {
        ctx.fillStyle = '#8C2F4A';
        ctx.fillRect((s.x - 12) | 0, (s.y - 12) | 0, 24, 24);
      }
    }
  }

  function setArena(ax, ay, aw, ah) {
    if (isFinite(ax)) AX = ax;
    if (isFinite(ay)) AY = ay;
    if (isFinite(aw) && aw > 0) AW = aw;
    if (isFinite(ah) && ah > 0) AH = ah;
    if (spawned) place();
  }

  NEU.scalSeekers = {
    init: function (opts) {
      opts = opts || {};
      ctx = opts.ctx || null;
      setArena(opts.AX, opts.AY, opts.AW, opts.AH);
      targetFn = typeof opts.target === 'function' ? opts.target : null;
      seekers = [];
      darts = [];
      ringAng = 0;
      volleyCd = 0;
      plX = null;
      spawned = false;
      return true;
    },
    setArena: setArena,
    setPlayer: function (x, y) { plX = x; plY = y; },
    spawn: spawn,
    clear: clear,
    tick: tick,
    tickDarts: tickDarts,
    draw: draw,
    hit: hit,
    alive: alive,
    seekers: function () {
      var out = [], i;
      for (i = 0; i < seekers.length; i++)
        out.push({ x: seekers[i].x, y: seekers[i].y, hp: seekers[i].hp });
      return out;
    },
    darts: function () {
      var out = [], i;
      for (i = 0; i < darts.length; i++)
        out.push({ x: darts[i].x, y: darts[i].y, vx: darts[i].vx,
                   vy: darts[i].vy, r: darts[i].r });
      return out;
    }
  };
})();
