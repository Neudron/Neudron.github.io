/* juice.js — the layer that makes it feel like something.
   ───────────────────────────────────────────────────────────────────
   Every mechanic in this site works. Almost none of them LAND. A hit
   registers, a number changes, nothing in the world reacts. This is
   the reaction.

   Adapted from the `game-feel` and `camera-systems` skills in
   gamedev-skills/awesome-gamedev-agent-skills (Apache-2.0), which are
   written for Godot/Unity tween and camera nodes. This project has
   neither, so the techniques are reimplemented against a raw 2D canvas
   and a fixed-position DOM.

   THE FIVE RULES, AND WHY EACH ONE IS HERE

   1. TRAUMA, NOT SHAKE. Hits ADD trauma (0..1); the offset is
      trauma SQUARED. Small hits barely move the screen, big ones
      punch. Trauma decays every frame, so shake always ends by itself
      and two hits in a row stack instead of the second resetting the
      first.

   2. SAMPLED SIN, NOT `Math.random()` PER FRAME. A fresh random offset
      every frame reads as static/buzz, not as impact. Three sin waves at
      incommensurate frequencies give smooth, non-repeating motion.

   3. SHAKE THE CAMERA, NEVER THE BODY. In a canvas scene that means a
      translate applied around the draw, and in DOM it means a
      transform on a wrapper. Moving the simulated position would
      desync collision and aim.

   4. HIT-STOP USES A REAL CLOCK. Freezing by scaling dt and then
      waiting on a dt-scaled timer never resumes — the classic
      `WaitForSeconds` bug. Everything here waits on
      `performance.now()`, which does not care that the game is
      frozen.

   5. TIERS, NOT ONE-OFFS. `small` / `medium` / `large` / `huge`. An
      event picks a tier; the tier decides how much of everything.
      Without this, juice gets tuned per call site and the game ends up
      shaking harder for a pickup than for a boss death.

   ACCESSIBILITY IS NOT OPTIONAL HERE. `prefers-reduced-motion` zeroes
   shake and flash entirely and shortens hit-stop to nothing. Screen
   shake is the single most common accessibility complaint in games and
   this site already promises AA in both themes.                     */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var customNoShake = false, customNoFlash = false;
  var customNoHitstop = false, customNoParticles = false;

  /* ── trauma ─────────────────────────────────────────────────────*/
  var trauma = 0, DECAY = 1.5;
  var MAXX = 14, MAXY = 10, MAXROLL = 0.045;
  var lastT = 0, phase = 0;

  /* ── hit-stop ───────────────────────────────────────────────────
     `until` is a real timestamp. Modules ask `frozen()` at the top of
     their step and skip the simulation while it is true — the render
     still runs, which is what makes the freeze read as a held frame
     rather than a dropped one. */
  var freezeUntil = 0;

  /* ── flash ──────────────────────────────────────────────────────*/
  var flashUntil = 0, flashCol = '#FFFFFF', flashFrom = 0;

  /* ── the tiers ──────────────────────────────────────────────────
     Tuned so a full boss death is roughly 5x a pickup, and a pickup is
     still noticeable. `stop` is in seconds, `shake` is trauma added. */
  var TIER = {
    tick:   { shake: 0.00, stop: 0,     flash: 0,    parts: 0 },
    small:  { shake: 0.14, stop: 0,     flash: 0,    parts: 4 },
    medium: { shake: 0.34, stop: 0.045, flash: 0,    parts: 9 },
    large:  { shake: 0.62, stop: 0.09,  flash: 0.05, parts: 22 },
    huge:   { shake: 1.00, stop: 0.16,  flash: 0.10, parts: 44 }
  };

  function hit(tier, opts) {
    var t = TIER[tier] || TIER.small;
    opts = opts || {};
    var noShake = reduced || customNoShake;
    var noFlash = reduced || customNoFlash;
    if (!noShake) {
      /* Hits ADD. Two impacts in a row must stack, not reset — a reset
         makes the second hit feel weaker than the first, which is
         exactly backwards. */
      trauma = Math.min(1, trauma + (opts.shake != null ? opts.shake : t.shake));
    }
    if (!noFlash && t.flash) {
      flashUntil = performance.now() + t.flash * 1000;
      flashFrom = t.flash * 1000;
      flashCol = opts.colour || '#FFFFFF';
    }
    /* Hit-stop survives reduced-motion at a third the length: it does
       not move anything, and removing it entirely takes the weight out
       of every impact for people who only asked for less motion. */
    var stop = t.stop * (reduced ? 0.33 : 1);
    if (stop > 0 && !customNoHitstop) freezeUntil = Math.max(freezeUntil, performance.now() + stop * 1000);
    return t;
  }

  function frozen() { return performance.now() < freezeUntil; }

  /* ── the camera ─────────────────────────────────────────────────
     Call `begin(ctx)` before drawing a scene and `end(ctx)` after.
     Between them the whole canvas is translated and rotated about its
     centre — the draw code never knows it happened, which is what
     keeps shake off the simulation. */
  function step(now) {
    if (!lastT) lastT = now;
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (trauma > 0) trauma = Math.max(0, trauma - DECAY * dt);
    phase += dt * 34;
  }

  function amount() { return trauma * trauma; }   // quadratic, see rule 1

  function begin(ctx, w, h) {
    step(performance.now());
    if (trauma <= 0 || reduced || customNoShake) return false;
    var s = amount();
    /* Three incommensurate frequencies. Sampled, never random. */
    var ox = MAXX * s * Math.sin(phase * 1.00);
    var oy = MAXY * s * Math.sin(phase * 1.37 + 1.1);
    var rot = MAXROLL * s * Math.sin(phase * 0.71 + 2.3);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rot);
    ctx.translate(-w / 2 + ox, -h / 2 + oy);
    return true;
  }
  function end(ctx, shook) { if (shook) ctx.restore(); }

  /* The white frame on a big impact. Drawn AFTER restore so the flash
     itself never shakes — a shaking flash reads as a rendering fault. */
  function overlay(ctx, w, h) {
    var now = performance.now();
    if (now >= flashUntil || reduced || customNoFlash) return;
    var k = (flashUntil - now) / flashFrom;
    ctx.globalAlpha = Math.min(0.55, k * 0.55);
    ctx.fillStyle = flashCol;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  /* ── squash & stretch ───────────────────────────────────────────
     Volume-conserving: stretch one axis, squash the other, spring back
     with overshoot. Returns a {sx, sy} to multiply into a draw.

     `k` is 0..1 elapsed. The back-ease is what makes it read as alive
     rather than mechanical — it passes 1.0 and settles back. */
  function pop(k, power) {
    if (reduced || k >= 1) return { sx: 1, sy: 1 };
    power = power == null ? 0.3 : power;
    var e = backOut(k);
    var over = 1 + (1 - e) * power;
    return { sx: over, sy: 1 / over };
  }

  /* c1 = 1.70158 is the standard back-overshoot constant. */
  function backOut(x) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }
  function outCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function outElastic(x) {
    if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1;
    var c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  }

  /* ── particles ──────────────────────────────────────────────────
     A shared pool. Every scene draws the same burst, so an impact
     looks like an impact wherever it happens. Pooled because a boss
     fight can spawn several hundred and allocating them per hit is
     how a 60fps canvas becomes a 40fps one. */
  var POOL = 260, parts = [], pi = 0;
  for (var i = 0; i < POOL; i++) parts.push({ life: 0 });

  function burst(x, y, n, col, spd) {
    if (reduced || customNoParticles) return;
    n = n || 8; spd = spd || 130;
    for (var k = 0; k < n; k++) {
      var p = parts[pi++ % POOL];
      var a = Math.random() * Math.PI * 2;
      var v = spd * (0.4 + Math.random() * 0.9);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 40;
      p.life = 0.32 + Math.random() * 0.38;
      p.max = p.life;
      p.c = col || '#EDE7DE';
      p.s = 2 + ((Math.random() * 2) | 0);
    }
  }

  function drawParts(ctx, dt) {
    for (var k = 0; k < POOL; k++) {
      var p = parts[k];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 620 * dt;                        // gravity; debris falls
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x | 0, p.y | 0, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  /* ── DOM shake ──────────────────────────────────────────────────
     For the page itself, which is not a canvas. Same trauma source, so
     a hit that shakes the fight also shakes the page if both are up. */
  function shakeEl(el, tier) {
    if (!el || reduced || customNoShake) return;
    hit(tier || 'medium');
    el.classList.remove('is-shook');
    void el.offsetWidth;
    el.classList.add('is-shook');
    setTimeout(function () { el.classList.remove('is-shook'); }, 420);
  }

  NEU.juice = {
    hit: hit, frozen: frozen,
    begin: begin, end: end, overlay: overlay,
    burst: burst, drawParts: drawParts,
    pop: pop, backOut: backOut, outCubic: outCubic, outElastic: outElastic,
    shakeEl: shakeEl,
    setNoShake: function (on) { customNoShake = !!on; },
    setNoFlash: function (on) { customNoFlash = !!on; },
    setNoHitstop: function (on) { customNoHitstop = !!on; },
    setNoParticles: function (on) { customNoParticles = !!on; },
    get noShake() { return customNoShake; },
    get noFlash() { return customNoFlash; },
    get noHitstop() { return customNoHitstop; },
    get noParticles() { return customNoParticles; },
    get trauma() { return trauma; },
    get reduced() { return reduced; },
    tiers: TIER,
    /* tests + the dev console */
    _reset: function () { trauma = 0; freezeUntil = 0; flashUntil = 0; }
  };
})();
