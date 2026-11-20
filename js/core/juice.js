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

  var reduced = (window.NEU && window.NEU.motion) ? window.NEU.motion.reduced() : matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* NEU.motion (motion.js) is the one source; it can change live. */
  var calmFlash = (window.NEU && window.NEU.motion) ? window.NEU.motion.calmFlash() : reduced;
  if (window.NEU && window.NEU.motion) window.NEU.motion.on(function (r, f) { reduced = r; calmFlash = f; });
  /* 0..1 from the settings slider. Scales the trauma each hit ADDS, so
     a stack still stacks; 0 is the same as no shake. */
  var shakeScale = 1;
  var customNoShake = false, customNoFlash = false;
  var customNoHitstop = false, customNoParticles = false;

  /* ── one accessibility surface, pushed here by settings.js ─────────
     The save file is the only store; these are just its live copies.
     particleCap is the active-particle ceiling (500 full, ~160 low).
     photosensitive zeroes shake, shrinks flashes and drops decoration;
     it never touches a telegraph or a hit tell. 0.5 = the normal overlay
     brightness, 0 turns every full-screen overlay off. */
  var particleCap = 500, overlayIntensity = 0.5, photosensitive = false;
var degrade = 0;   /* 0..2, set by perf.js when frame time collapses; never touches the particleCap setting */

  /* ── trauma ─────────────────────────────────────────────────────*/
  var trauma = 0, DECAY = 1.5;
  var MAXX = 14, MAXY = 10, MAXROLL = 0.045;
  var lastT = 0, phase = 0;

  /* ── impact direction ───────────────────────────────────────────
     The unit vector of the last hit's impact, or {0,0} when that hit
     had none. The next hit() without a direction clears it, so a stale
     lean never outlives the impact that made it. */
  var bias = { x: 0, y: 0 };

  /* How much of each axis comes from the impact rather than the waves.
     0.4 is a starting point, not a measured value: enough push to read
     as a direction, with the waves keeping 0.6 so the shake still
     wobbles. Tune it by feel if directed hits read too weak or too
     sliding. */
  var LEAN = 0.4;

  /* ── hit-stop ───────────────────────────────────────────────────
     `until` is a real timestamp. Modules ask `frozen()` at the top of
     their step and skip the simulation while it is true — the render
     still runs, which is what makes the freeze read as a held frame
     rather than a dropped one. */
  var freezeUntil = 0;
  /* Modal holders (Leave prompt, flash note) each add one freeze; a
     shared boolean would unfreeze while another holder is still up. */
  var paused = 0;
  function pause(on) { paused = on ? paused + 1 : Math.max(0, paused - 1); }

  /* ── flash ──────────────────────────────────────────────────────*/
  var flashUntil = 0, flashCol = '#FFFFFF', flashFrom = 0;
  /* WCAG 2.2 SC 2.3.1: no more than three opposing luminance changes in
     any one second. Count accepted flashes in a sliding 1 s window, so a
     burst of boss deaths cannot strobe the page. */
  var flashTimes = [], flashCount = 0;
  function canFlash(now) {
    while (flashTimes.length && now - flashTimes[0] >= 1000) flashTimes.shift();
    return flashTimes.length < 3;
  }

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

  /* Stores an impact direction as a unit vector. A missing, zero or
     non-finite direction stores {0,0}. "No direction" is the default, and
     it is the path every existing caller takes, so it must stay inert. */
  function setBias(dx, dy) {
    var len = Math.sqrt(dx * dx + dy * dy);
    if (!(len > 0) || !isFinite(len)) { bias = { x: 0, y: 0 }; return; }
    bias = { x: dx / len, y: dy / len };
  }

  /* ── haptics ────────────────────────────────────────────────────
     Only the two big tiers buzz. A phone that buzzes on every pickup
     stops meaning anything, and a buzz on every tick would be constant.
     The buzz rides the shake gate, so the setting that stops the screen
     moving also stops the phone. Durations are short on purpose (18ms
     and 30ms, felt as a tap, not a rumble). Browsers may refuse
     vibrate() without a user gesture or by policy, so a refusal is
     swallowed and the shake still lands. */
  function buzz(tier) {
    var ms = tier === 'huge' ? 30 : tier === 'large' ? 18 : 0;
    if (!ms) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
    } catch (e) { /* refused: the shake still lands */ }
  }

  function hit(tier, opts) {
    var t = TIER[tier] || TIER.small;
    opts = opts || {};
    var noShake = reduced || photosensitive || customNoShake || shakeScale <= 0;
    var noFlash = calmFlash || customNoFlash;
    /* Recorded even when shake is gated off, so `bias` always describes
       the last hit. A hit with no direction clears it. */
    setBias(opts.dx, opts.dy);
    if (!noShake) {
      /* Hits ADD. Two impacts in a row must stack, not reset — a reset
         makes the second hit feel weaker than the first, which is
         exactly backwards. */
      trauma = Math.min(1, trauma + (opts.shake != null ? opts.shake : t.shake) * shakeScale);
      buzz(tier);
    }
    if (!noFlash && t.flash && canFlash(performance.now())) {
      flashUntil = performance.now() + t.flash * 1000;
      flashFrom = t.flash * 1000;
      flashCol = opts.colour || '#FFFFFF';
      flashTimes.push(performance.now());
      flashCount++;
    }
    /* Hit-stop survives reduced-motion at a third the length: it does
       not move anything, and removing it entirely takes the weight out
       of every impact for people who only asked for less motion. */
    var stop = t.stop * (reduced ? 0.33 : 1);
    if (stop > 0 && !customNoHitstop) freezeUntil = Math.max(freezeUntil, performance.now() + stop * 1000);
    return t;
  }

  function frozen() { return paused > 0 || performance.now() < freezeUntil; }

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
    if (trauma <= 0 || reduced || photosensitive || customNoShake) return false;
    var s = amount();
    /* A directed hit leans the x and y offsets toward its impact. The
       mix is a weighted average, not an addition: the waves keep
       (1 - LEAN) of each axis and the impact takes LEAN. Because the bias
       is a unit vector, no axis can exceed its old ceiling. An undirected
       hit has lean 0, which leaves the offsets exactly as they were. The
       trauma² factor scales the impact with the waves, so the lean fades
       as the shake does. */
    var lean = (bias.x || bias.y) ? LEAN : 0;
    /* Three incommensurate frequencies. Sampled, never random. */
    var ox = MAXX * s * ((1 - lean) * Math.sin(phase * 1.00) + lean * bias.x);
    var oy = MAXY * s * ((1 - lean) * Math.sin(phase * 1.37 + 1.1) + lean * bias.y);
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
    if (now >= flashUntil || calmFlash || customNoFlash) return;
    var k = (flashUntil - now) / flashFrom;
    /* 0.5 is the shipped brightness, so the slider's middle is neutral
       while its left end is a real off. Never above 0.55 (0.28 with the
       photosensitivity opt-in). */
    var a = Math.min(photosensitive ? 0.28 : 0.55, k * (photosensitive ? 0.28 : 0.55)) *
            Math.min(2, overlayIntensity * 2);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = flashCol;
    if (photosensitive) {
      /* two slim bands instead of a full-screen wash: the tell stays,
         the combined flashing area drops under the WCAG allowance. */
      var band = Math.max(2, Math.round(h * 0.04));
      ctx.fillRect(0, 0, w, band); ctx.fillRect(0, h - band, w, band);
    } else ctx.fillRect(0, 0, w, h);
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
  var POOL = 500, parts = [], pi = 0;
  for (var i = 0; i < POOL; i++) parts.push({ life: 0 });

  /* Priority 0 is decoration and goes first; 2 is the feedback the player
     needs in order to act. One pool, per-family ceilings: a collision
     storm cannot starve a hit tell, and ambient dust cannot fill the cap. */
  var FAM = {
    ambient:    { cap: 40,  prio: 0 },
    dust:       { cap: 40,  prio: 0 },
    afterimage: { cap: 24,  prio: 0 },
    impact:     { cap: 260, prio: 1 },
    boom:       { cap: 56,  prio: 1 },
    hit:        { cap: 500, prio: 2 },
    telegraph:  { cap: 500, prio: 2 },
    bullet:     { cap: 500, prio: 2 }
  };
  function active() {
    var n = 0;
    for (var k = 0; k < POOL; k++) if (parts[k].life > 0) n++;
    return n;
  }
  function burst(x, y, n, col, spd, family) {
    if (reduced || customNoParticles) return;
    n = n || 8; spd = spd || 130;
    family = family || 'impact';
    var f = FAM[family] || FAM.impact, k, p, a, v, room = 0, same = 0;
    for (k = 0; k < POOL; k++) {
      if (parts[k].life <= 0) continue;
      room++;
      if (parts[k].f === family) same++;
    }
    /* The photosensitivity opt-in removes decoration, not tells. */
    if (((photosensitive || degrade >= 2) && f.prio === 0) || f.cap <= same) return;
    room = (degrade >= 1 ? particleCap >> 1 : particleCap) - room;
    if (room <= 0 && f.prio === 0) return;
    if (room <= 0) for (k = 0; k < POOL && room < n; k++) {
      /* Never retire gameplay feedback to make room for more feedback of
         the same tier; decoration and generic impact debris go first. */
      if (parts[k].life > 0 && parts[k].prio < f.prio) { parts[k].life = 0; room++; }
    }
    n = Math.min(n, room, f.cap - same);
    if (n <= 0) return;
    for (k = 0; k < n; k++) {
      p = parts[pi++ % POOL];
      a = Math.random() * Math.PI * 2;
      v = spd * (0.4 + Math.random() * 0.9);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 40;
      p.life = 0.32 + Math.random() * 0.38;
      p.max = p.life;
      p.c = col || '#EDE7DE';
      p.s = 2 + ((Math.random() * 2) | 0);
      p.f = family; p.prio = f.prio;
    }
  }

  /* ── boom: original ring + square debris + 2-frame smoke ──────────
     Drawn in code only. Visual only: it adds NO shake, hit-stop or
     flash, so the caller pairs it with hit(tier) and every flash and
     shake gate stays in one place (hit, canFlash, noFlash/calmFlash).
     Debris is the shared pool (family 'boom'), capped by the tier's
     `parts` (8..14 from medium up). The ring and smoke ride a small
     fixed list that drawParts steps. Reduced motion: no debris, no
     smoke, one still ring frame held 0.2 s. */
  var BOOM_N = 8, booms = [];
  for (var bi = 0; bi < BOOM_N; bi++) booms.push({ life: 0 });
  var RING_T = 0.3, SMOKE_T = 0.34, RING_STILL = 0.2;
  function boom(x, y, tier, opts) {
    opts = opts || {};
    var t = TIER[tier] || TIER.medium;
    var col = opts.col || '#FFD34E', R = opts.r || (14 + t.parts * 1.6);
    var still = reduced, b = null, k, n;
    for (k = 0; k < BOOM_N; k++) if (booms[k].life <= 0) { b = booms[k]; break; }
    if (!b) b = booms[0];                 // oldest-ish slot; 8 live booms is already a storm
    b.x = x; b.y = y; b.R = R; b.c = col; b.still = still;
    b.max = b.life = still ? RING_STILL : SMOKE_T;
    b.puffs = [];
    if (!still && !customNoParticles && !photosensitive) {
      n = Math.min(5, Math.ceil(t.parts / 4));
      for (k = 0; k < n; k++) {
        var a = Math.random() * Math.PI * 2, d = R * (0.15 + Math.random() * 0.4);
        b.puffs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 3 + ((Math.random() * 3) | 0) });
      }
    }
    n = Math.min(14, t.parts);
    if (n > 0) burst(x, y, n, col, 150 + t.parts * 4, 'boom');
    return b;
  }
  function drawBooms(ctx, dt) {
    var any = false, k, j;
    for (k = 0; k < BOOM_N; k++) if (booms[k].life > 0) { any = true; break; }
    if (!any) return;
    ctx.save();
    for (k = 0; k < BOOM_N; k++) {
      var b = booms[k];
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) continue;
      var age = b.max - b.life;
      var u = Math.min(1, age / RING_T);
      /* ring: expands and thins; still ring is one frame at 0.6 R */
      var rr = b.still ? b.R * 0.6 : 3 + (b.R - 3) * outCubic(u);
      var ra = b.still ? 0.85 : Math.max(0, 1 - u);
      if (ra > 0) {
        ctx.globalAlpha = ra;
        ctx.strokeStyle = b.c;
        ctx.lineWidth = b.still ? 2 : Math.max(1, 3 * (1 - u));
        ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, Math.PI * 2); ctx.stroke();
      }
      /* smoke: exactly two frames, small light then big dark */
      for (j = 0; j < b.puffs.length; j++) {
        var p = b.puffs[j], second = age >= SMOKE_T / 2;
        var r = second ? p.r + 3 : p.r, px = (b.x + p.x) | 0, py = (b.y + p.y - (second ? 4 : 0)) | 0;
        ctx.globalAlpha = second ? 0.45 : 0.7;
        ctx.fillStyle = second ? '#5E5668' : '#A79FB2';
        ctx.fillRect(px - r, py - r + 2, 2 * r, 2 * r - 4);
        ctx.fillRect(px - r + 2, py - r, 2 * r - 4, 2 * r);
      }
    }
    ctx.restore();
  }

  function drawParts(ctx, dt) {
    drawBooms(ctx, dt);
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
    if (!el || reduced || photosensitive || customNoShake) return;
    hit(tier || 'medium');
    el.classList.remove('is-shook');
    void el.offsetWidth;
    el.classList.add('is-shook');
    setTimeout(function () { el.classList.remove('is-shook'); }, 420);
  }

  /* ── DOM connect pop ────────────────────────────────────────────
     A page element that lands a blow: a static colour pop always (it
     does not move, so calm motion keeps it), plus a CSS spark burst
     only when particles are allowed. The burst rides the particle gate,
     not the shake gate, exactly like burst() above. */
  function popEl(el) {
    if (!el) return;
    var spark = !reduced && !photosensitive && !customNoParticles;
    el.classList.remove('is-pop', 'is-burst');
    void el.offsetWidth;
    el.classList.add('is-pop');
    if (spark) el.classList.add('is-burst');
    setTimeout(function () { el.classList.remove('is-pop', 'is-burst'); }, 280);
  }

  /* ── screen shatter (a boss's death beat) ───────────────────────
     Technique from Wrath of the Gods' ScreenShatterSystem, studied, not
     copied (see neu-room/references/wotg-visuals.md §6): snapshot the
     frame, cut ~12 radial wedges from the focal point, split each one
     into an inner and an outer shard, and fly them out spinning while
     they fade. Works in raw canvas pixels (identity transform), so the
     caller's own view scale does not matter. Call it AFTER the save is
     written: a tab closed mid-beat must not lose the kill.
     opts: canvas, x/y (canvas px, default centre), onDone, skippable
     (Z/X/Enter end it at once). Reduced motion: a hard cut to black,
     held 0.6 s. Returns { shards, skip }. */
  var SHATTER_MS = 1100, WEDGES = 12;
  function shatter(opts) {
    opts = opts || {};
    var cv = opts.canvas, c = cv && cv.getContext && cv.getContext('2d');
    var over = false, raf = 0, timer = 0;
    function finish() {
      if (over) return;
      over = true;
      removeEventListener('keydown', onKey, true);
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      clearTimeout(timer);
      if (opts.onDone) opts.onDone();
    }
    function onKey(e) {
      if (e.key === 'z' || e.key === 'Z' || e.key === 'x' || e.key === 'X' || e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation(); finish();
      }
    }
    if (opts.skippable) addEventListener('keydown', onKey, true);
    if (!c) { finish(); return { shards: 0, skip: finish }; }
    var W = cv.width, H = cv.height;
    function black() {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
      c.fillStyle = '#000000'; c.fillRect(0, 0, W, H); c.restore();
    }
    if (reduced) { black(); timer = setTimeout(finish, 600); return { shards: 0, skip: finish }; }
    var snap = document.createElement('canvas');
    snap.width = W; snap.height = H;
    var sc = snap.getContext && snap.getContext('2d');
    if (sc) sc.drawImage(cv, 0, 0);
    var fx = opts.x != null ? opts.x : W / 2, fy = opts.y != null ? opts.y : H / 2;
    var R = Math.sqrt(W * W + H * H), angs = [], shards = [], i;
    for (i = 0; i < WEDGES; i++) angs.push((i + (Math.random() - 0.5) * 0.6) * Math.PI * 2 / WEDGES);
    function at(a, r) { return [fx + Math.cos(a) * r, fy + Math.sin(a) * r]; }
    for (i = 0; i < WEDGES; i++) {
      var a0 = angs[i], a1 = i + 1 < WEDGES ? angs[i + 1] : angs[0] + Math.PI * 2, am = (a0 + a1) / 2;
      var cut = R * (0.18 + Math.random() * 0.14);
      var p0 = at(a0, cut), p1 = at(a1, cut);
      /* inner triangle, then the outer quad beyond the cut */
      shards.push({ pts: [[fx, fy], p0, p1], a: am, d: 0.35 });
      shards.push({ pts: [p0, at(a0, R), at(a1, R), p1], a: am, d: 1 });
    }
    for (i = 0; i < shards.length; i++) {
      var s = shards[i], sx = 0, sy = 0;
      for (var k = 0; k < s.pts.length; k++) { sx += s.pts[k][0]; sy += s.pts[k][1]; }
      s.cx = sx / s.pts.length; s.cy = sy / s.pts.length;
      s.spin = (Math.random() - 0.5) * 1.6;
      s.fly = (0.12 + Math.random() * 0.1) * R * s.d;
    }
    var t0 = performance.now();
    function frame(now) {
      if (over) return;
      var k = Math.min(1, (now - t0) / SHATTER_MS), e = outCubic(k);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1; c.fillStyle = '#000000'; c.fillRect(0, 0, W, H);
      c.globalAlpha = Math.max(0, 1 - k);
      for (var j = 0; j < shards.length; j++) {
        var q = shards[j], p = q.pts;
        c.save();
        c.translate(q.cx + Math.cos(q.a) * q.fly * e, q.cy + Math.sin(q.a) * q.fly * e);
        c.rotate(q.spin * e);
        c.scale(1 + 0.4 * e, 1 + 0.4 * e);
        c.translate(-q.cx, -q.cy);
        c.beginPath(); c.moveTo(p[0][0], p[0][1]);
        for (var m = 1; m < p.length; m++) c.lineTo(p[m][0], p[m][1]);
        c.closePath(); c.clip();
        c.drawImage(snap, 0, 0);
        c.restore();
      }
      c.restore();
      if (k >= 1) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return { shards: shards.length, skip: finish };
  }

  NEU.juice = {
    hit: hit, frozen: frozen, pause: pause, popEl: popEl, shatter: shatter,
    begin: begin, end: end, overlay: overlay,
    burst: burst, boom: boom, drawParts: drawParts,
    pop: pop, backOut: backOut, outCubic: outCubic, outElastic: outElastic,
    shakeEl: shakeEl,
    setNoShake: function (on) { customNoShake = !!on; },
    setShakeScale: function (k) { k = +k; shakeScale = isFinite(k) ? Math.max(0, Math.min(1, k)) : 1; },
    get shakeScale() { return shakeScale; },
    setNoFlash: function (on) { customNoFlash = !!on; },
    setNoHitstop: function (on) { customNoHitstop = !!on; },
    setNoParticles: function (on) { customNoParticles = !!on; },
    setParticleCap: function (n) {
      n = +n;
      particleCap = isFinite(n) ? Math.max(0, Math.min(POOL, Math.round(n))) : POOL;
    },
    setDegrade: function (n) { n = Math.floor(+n); degrade = isFinite(n) ? Math.max(0, Math.min(2, n)) : 0; },
    get degrade() { return degrade; },
    setOverlayIntensity: function (v) {
      v = +v;
      overlayIntensity = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
    },
    setPhotosensitive: function (on) { photosensitive = !!on; },
    get photosensitive() { return photosensitive; },
    get overlayIntensity() { return overlayIntensity; },
    get particleCap() { return particleCap; },
    get poolSize() { return POOL; },
    activeParticles: active,
    get activeBooms() { var n = 0; for (var k = 0; k < BOOM_N; k++) if (booms[k].life > 0) n++; return n; },
    get flashCount() { return flashCount; },
    get flashTimes() { return flashTimes.slice(); },
    get noShake() { return customNoShake || photosensitive; },
    /* Every flash gate in the game reads this one: the switch OR calm flashing. */
    get noFlash() { return customNoFlash || calmFlash; },
    get noHitstop() { return customNoHitstop; },
    get noParticles() { return customNoParticles; },
    get trauma() { return trauma; },
    /* A copy, so a caller cannot write into the live direction. */
    get bias() { return { x: bias.x, y: bias.y }; },
    get reduced() { return reduced; },
    get calmFlash() { return calmFlash; },
    tiers: TIER,
    /* tests + the dev console */
    _reset: function () {
      trauma = 0; bias = { x: 0, y: 0 }; freezeUntil = 0; flashUntil = 0;
      flashTimes = []; flashCount = 0;
      for (var k = 0; k < POOL; k++) parts[k].life = 0;
      for (k = 0; k < BOOM_N; k++) booms[k].life = 0;
    }
  };
})();
