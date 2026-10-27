/* boss-scal.js — Supreme Witch, Calamitas.
   ───────────────────────────────────────────────────────────────────
   The body, the soul, the HP and the drawing. HER ATTACKS are in
   js/act4/scal-attacks.js.

   Attack patterns ported from InfernumMode (InfernumTeam, @399342f, MIT).

   She runs Infernum's attack machine: phase gates at 75%, 45% and 25% HP,
   each with a transition (a shadow demon, the brothers, the seekers); a
   quiet opening with the Sepulcher; and five desperation substates at the
   end. Every attack is one function there, citing the Infernum file and
   line it ports. The density, cadence and aim are the source's; only the
   units are converted to this arena.

   WHAT MAKES IT FUN HERE:
   1. YOU ALREADY KNOW HOW TO PLAY. Same soul, the dash, the shift-to-focus.
   2. SHE IS INVULNERABLE AT PREDICTABLE TIMES, AND SAYS SO. Transitions,
      specials and the desperation phase all say so before they start.
   3. EIGHT HP, ONE PER HIT. Dash i-frames get the soul out of a wall; a
      fight takes several attempts, and each one teaches a new pattern.   */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('bh');          // reuses the room's canvas
  var cv   = document.getElementById('bhCanvas');
  if (!wrap || !cv) { NEU.scal = { open: function () {} }; return; }
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.scal = { open: function () {} }; return; }
  var msg = document.getElementById('bhMsg');

  var dm = NEU.danmaku || {};
  var COL = { bone: '#EDE7DE', soul: '#E23B55', dim: '#8A8598', void_: '#0C0306',
              brim: '#FF4A2A', brimHi: '#FFC46A', dark: '#8C2F4A' };

  var PLAYER_R = (dm.soul && dm.soul.R) || 6, IFRAMES = dm.IFRAMES || 1.1;
  var MAXHP = 8;

  /* Fair hitboxes: every enemy projectile's collision radius, derived
     from the REAL Terraria hitbox each `.cs` declares (sheets.js's
     `hitRadius`), converted through the same 150/224 Terraria-to-site
     ratio the burst-proximity trigger already uses, with a light 0.85
     inset kept for forgiveness. These used to be hand-picked constants
     with no tie to the drawn art at all, and drifted in both
     directions — hellblast drew 27x22 on screen with a hit radius of 5
     (a ratio of 2.2, meaning a dart could visibly pass through the
     soul with no hit), gigablast the same at 1.6x. Real numbers now
     replace every guess. Falls back to the old hand-picked constants
     only if sheets.js failed to load. */
  var HB = {
    dart:      (NEU.hitRadius && NEU.hitRadius('dart', 0.85))      || 4,
    hellblast: (NEU.hitRadius && NEU.hitRadius('hellblast', 0.85)) || 5,
    fireblast: (NEU.hitRadius && NEU.hitRadius('fireblast', 0.85)) || 8,
    gigablast: (NEU.hitRadius && NEU.hitRadius('gigablast', 0.85)) || 12,
    /* the brothers' STRIKE reach (the player's own hit check against
       them), from their real 120x120 Terraria hitbox — both
       SupremeCataclysm.cs and SupremeCatastrophe.cs declare it. This one
       needs to grow, not shrink: they used to draw as their own 50x22 /
       67x20 thrown-attack sprites (see the brother body-sprite fix
       below) with a 28px reach that was already too small for THAT art;
       now that they draw their real ~80px body, 28px would only let a
       strike land near their exact centre. No inset — a full-inset
       generous reach on the PLAYER's own attack is a fairness feature,
       matching how Calamitas's own 40px strike reach already works. */
    broReach:  (NEU.hitRadius && NEU.hitRadius('cataclysm', 1))    || 28
  };



  var running = false, last = 0, t = 0, lastDt = 1 / 60;
  var px = 0, py = 0, keys = {}, hp = MAXHP, inv = 0;
  /* U1/U2: your two resources. Rage builds while you are missing
     hearts and is SPENT by z — a full bar buys eight seconds of
     doubled strikes. TP builds by grazing bullets and spends itself
     as a barrier that takes one hit (x). Both are the fight rewarding
     you for doing what the fight already asked you to do. */
  var rage = 0, tp = 0, shieldT = 0;
  var rageMode = 0, rageModeT = 0;
  /* The shared fight feel (core/danmaku.js): dash, adrenaline, damage
     numbers, the HUD. Her rage and tp stay her own; the HUD shows them. */
  var F = dm.fight(0, 0);
  /* What the meters DRAW. A bar that snaps to its value reads as a
     counter; one that sweeps toward it reads as charging, which is the
     whole point of RipperUI's presentation. */
  var rageShown = 0, tpShown = 0, grazeT = 0;
  /* Body grazes cannot feed the funnel directly: fightTick runs BEFORE
     moveBullets every frame, so a direct feed is erased by that same
     frame's no-bullet-in-range reset before it accumulates anything.
     They latch here; moveBullets' single end-of-frame call is the only
     place grazeT advances or resets. */
  var grazedByBody = false;
  var AX = 0, AY = 0, AW = 0, AH = 0;
  var bullets = [], phase = 1;
  /* test hook: NEU.scal.hold freezes the frame loop for a manual simulate() */
  var held = false, shotsFired = 0;
  /* test hook: NEU.scal.invincible(true) makes the soul untouchable */
  var god = false;
  var bossHP = 1, bossMax = 1, invuln = false;
  var mode = 'intro';        // intro | fight | wall | brothers | dead | won
  var hearts = [], sep = null, bros = [];
  /* scal-worm.js delegation flag: true between open()'s init and
     close()'s reset, so init runs once per fight, not once per frame. */
  var scalWormReady = false;
  /* scal-seekers.js delegation flag — same once-per-fight contract as
     scalWormReady: init in open(), reset here-in-close(). */
  var seekersReady = false;
  /* The player's own homing shots (V5 phase 2). Deliberately NOT
     `bullets` — NEU.scal.bullets feeds the test dodge AI, and mixing
     friendly fire into it would teach the bot to dodge its own gun. */
  var myShots = [], charging = false, chargeF = 0, shotCd = 0;
  var line = '', lineT = 0;
  var bx = 0, by = 0;        // her position
  var dying = 0;
  var showHitboxes = false;  // F3 toggle
  /* Attack timers outlive the attack that scheduled them — a gigablast
     that is mid-spread when she phases out would keep dropping bullets
     into the wall interlude. Track them so a phase transition can kill
     the stragglers. */
  var sched = [];
  function later(fn, ms) { var id = setTimeout(fn, ms); sched.push(id); return id; }
  function clearSched() {
    for (var i = 0; i < sched.length; i++) clearTimeout(sched[i]);
    sched = [];
  }

  /* ── her voice ──────────────────────────────────────────────────
     Six real Calamity .ogg files, one per attack family. The pooled
     pattern from sans.js: four copies of the SAME file, because one
     element cuts itself off and different files read as a flam.
     Pools are built in open() so the first attack never waits. */
  var SFX = null, sfxI = 0;
  function preloadSfx() {
    SFX = {};
    var names = ['hellblast', 'fireblast', 'fireblast-hit', 'giga', 'giga-hit', 'maelstrom'];
    for (var n = 0; n < names.length; n++) {
      var pool = [];
      try {
        for (var i = 0; i < 4; i++) {
          var a = new Audio('audio/act4/' + names[n] + '.ogg');
          a.preload = 'auto'; a.volume = 0.5;
          pool.push(a);
        }
      } catch (e) { pool = []; }
      SFX[names[n]] = pool;
    }
  }
  function sfxPlay(name) {
    var pool = SFX && SFX[name];
    if (!pool || !pool.length) return;
    if (NEU.settings && NEU.settings.muted) return;       /* the Sound switch */
    var a = pool[sfxI++ % pool.length];
    try {
      a.currentTime = 0;
      /* the same scatter sans.js gives its text blips: a voice played
         at one fixed pitch every time reads as a recording, and the
         four pooled copies would otherwise sound like one clip */
      a.playbackRate = 1 + (Math.random() * 0.1 - 0.05);
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function say(s) { line = s; lineT = performance.now(); }

  /* ── the look (W3c) ─────────────────────────────────────────────
     Infernum dresses this fight in a dark-red void with brimstone cinders
     drifting up, every projectile on an additive bloom, and a red flash
     on each phase change. All of it is drawn here, under the HUD. */
  function rm() { return !!(NEU.juice && NEU.juice.reduced); }
  /* A bullet's look: its own `look`, else its tag. spin is how the
     source's PreDraw turns the art: +PI/2 for art that points up, 0 for
     art that points right, null for art that never turns. */
  var LOOK = {
    arrow: { key: 'scalArrow', sc: 0.6, spin: Math.PI / 2, glow: '#FF2A1A' },
    flame: { key: 'scalFlame', sc: 0.5, spin: null, glow: '#FF4A8A' },
    demon: { key: 'scalDemon', sc: 0.6, spin: 0, glow: '#FF3A2A' },
    soul:  { key: 'scalSoul',  sc: 0.5, spin: 0, glow: '#D0203A' }
  };
  var embers = [];
  function seedEmbers() {
    embers = [];
    for (var i = 0; i < 40; i++)
      embers.push({ x: Math.random(), y: Math.random(), s: 1 + (i % 3), v: 0.03 + Math.random() * 0.05, ph: Math.random() * 6 });
  }
  seedEmbers();
  function driftEmbers(dt) {
    if (rm()) return;
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      e.y -= e.v * dt; e.ph += dt;
      if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
    }
  }
  /* DemonicExplosion: an eight-frame SuicideBomberDemonExplosion and a
     bloom, wherever a ring of darts bursts */
  var booms = [];
  function boom(x, y) {
    if (booms.length >= 24) booms.shift();
    booms.push({ x: x, y: y, t: 0 });
  }
  /* the phase flash: one per gate, never closer than 0.34 s (3 Hz), and
     a fifth as bright under reduced motion or the no-flash setting */
  var flashAt = -9, FLASH_LEN = 0.35;
  function phaseFlash() { if (t - flashAt >= 0.34) flashAt = t; }
  function flashAlpha() {
    var a = t - flashAt;
    if (a < 0 || a >= FLASH_LEN) return 0;
    var peak = (rm() || (NEU.juice && NEU.juice.noFlash)) ? 0.2 : 0.55;
    return peak * (1 - a / FLASH_LEN);
  }

  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = (innerWidth * dpr) | 0; cv.height = (innerHeight * dpr) | 0;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    var ar = dm.arena ? dm.arena(innerWidth, innerHeight, 700, 460, 24) : null;
    if (ar) {
      AW = ar.AW; AH = ar.AH; AX = ar.AX; AY = ar.AY;
    } else {
      AW = Math.min(700, innerWidth - 60);
      AH = Math.min(460, innerHeight - 190);
      AX = ((innerWidth - AW) / 2) | 0;
      AY = ((innerHeight - AH) / 2 + 24) | 0;
    }
    px = Math.min(Math.max(px, AX + 12), AX + AW - 12);
    py = Math.min(Math.max(py, AY + 12), AY + AH - 12);
    /* keep the worm's arena in step with resizes */
    if (NEU.scalWorm && scalWormReady) NEU.scalWorm.setArena(AX, AY, AW, AH);
    if (NEU.scalSeekers && seekersReady) NEU.scalSeekers.setArena(AX, AY, AW, AH);
  }
  addEventListener('resize', function () { if (running) layout(); });

  function stamp(rows, cx, cy, s, col) {
    if (dm.soul && dm.soul.stamp) {
      dm.soul.stamp(ctx, rows, cx, cy, s, col);
      return;
    }
    var h = rows.length, w = rows[0].length;
    var x0 = (cx - w * s / 2) | 0, y0 = (cy - h * s / 2) | 0;
    ctx.fillStyle = col;
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++)
      if (rows[r][c] === '#') ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
  }

  /* One bullet. k picks the sprite (the draw map) and its radius. o adds
     optional fields: fuse (seconds), onEnd (runs when the bullet ends),
     prox (ends it when the soul is this close), acc (speed multiplier per
     second), vmax (speed cap), tag (for clearTag). The cap is dm.shot's. */
  function spawn(x, y, vx, vy, k, o) {
    var r = k === 2 ? HB.gigablast : (k === 3 || k === 5) ? HB.hellblast : HB.dart;
    var c = k === 2 ? COL.dark : COL.brim;
    var n = bullets.length;
    if (dm.shot) dm.shot(bullets, x, y, vx, vy, r, c, k, 900);
    else if (n < 900) bullets.push({ x: x, y: y, vx: vx, vy: vy, r: r, c: c, k: k, age: 0 });
    if (bullets.length === n) return null;
    var b = bullets[n];
    for (var key in o) if (o.hasOwnProperty(key)) b[key] = o[key];
    shotsFired++;
    return b;
  }

  var willCharge = false;
  var scalAnimState = 'idle', scalAnimFrame = 0, scalAnimTimer = 0, scalAnimPrevState = 'idle';

  /* The opening: she is quiet for the Sepulcher's 270 f delay, then the
     Sepulcher comes up (SupremeCalamitas.cs:341). Mode 'wall' is the name
     this lead-in has always had; no walls are fired in it any more. */
  function startLead() {
    mode = 'wall'; invuln = true;
    clearSched();
    sfxPlay('maelstrom');
    NEU.scalAtk.start();
  }

  function spawnSepulcher() {
    mode = 'fight'; invuln = true;
    /* Position marker only — movement, trail, act machine and darts
       all live in js/act4/scal-worm.js now. Everything else reads `sep`
       for truthiness alone (resolveTarget, moveMyShots, fightTick,
       draw's layer gate). */
    sep = { x: AX + AW / 2, y: AY + AH - 40 };
    if (NEU.scalWorm && scalWormReady) NEU.scalWorm.spawn(sep.x, sep.y);
    /* Ten immobile hearts in the two upper corners — SepulcherHead.cs and
       BrimstoneHeart.cs, read directly: NPC.damage = 0 on the head (it
       hurts nothing on touch) and the mod spawns ten hearts fixed at the
       arena's upper corners, not attached to the worm's body at all.
       They used to ride the body in a chain, which meant reaching one
       put the soul inside the head's own (invented, non-source) contact
       zone — you had to trade a hit to break a heart. Fixed corner
       positions make every heart reachable for free, same as the source. */
    hearts = [];
    for (var i = 0; i < 10; i++) {
      var left = i < 5, idx = i % 5;
      hearts.push({
        /* Three bolts each. The heart pool IS the length of the worm
           phase — the Sepulcher's own 6-step SCRIPT (scal-worm.js:49-56)
           runs about 25s a lap, and one-shot hearts ended the phase
           before a single lap finished. */
        hp: 3,
        x: (left ? AX + 44 : AX + AW - 44) + (idx % 2 ? (left ? 18 : -18) : 0),
        y: AY + 46 + idx * 28
      });
    }
    say("* she is behind it. kill the hearts.");
  }

  /* ── the ring ───────────────────────────────────────────────────
     20% health: ten Supreme Soul Seekers on a rotating ring, and she is
     invulnerable until the last one dies (official wiki; the module in
     scal-seekers.js holds the source cites). She parks at arena centre
     for it — fightTick returns above her hover/orbit chain while ringOn,
     so nothing moves bx/by until the last seeker dies — which is what
     the source does anyway (she is immobile here), and her resting
     position (by = AY - 24) is ABOVE the frame, where a ring would not
     fit. */
  var ringOn = false;
  function startSeekers() {
    if (!NEU.scalSeekers) return;         /* module absent: skip the phase */
    ringOn = true; invuln = true; bullets = [];
    clearSched();
    bx = AX + AW / 2; by = AY + AH * 0.34;
    NEU.scalSeekers.spawn();
    sfxPlay('maelstrom');
    say("* she puts ten eyes between you and her.");
  }

  /* ── the brothers ───────────────────────────────────────────────*/
  function startBrothers() {
    mode = 'brothers'; invuln = true; bullets = [];
    clearSched();
    bros = [
      { side: -1, x: AX + 60, y: AY + AH / 2, hp: 8, t: 0, kind: 'slash', attackCount: 0, enraged: false, volley: 0, barrageCd: 0 },
      { side:  1, x: AX + AW - 60, y: AY + AH / 2, hp: 8, t: 0, kind: 'fist', attackCount: 0, enraged: false, volley: 0, barrageCd: 0 }
    ];
    say("* she calls her brothers. she does not fight while they do.");
  }

  /* ── loop ───────────────────────────────────────────────────────*/
  function stepFn(now) {
    if (!running) return;   /* startDeath() owns the death loop; handing off here started a second one */
    requestAnimationFrame(stepFn);
    if (held) return;
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    lastDt = dt;
    /* Hit-stop: hold the frame, keep rendering. Skipping the render
       too would read as a dropped frame rather than a held one. */
    if (NEU.juice && NEU.juice.frozen()) { draw(now); return; }
    update(dt);
    draw(now);
  }

  function update(dt) {
    t += dt;
    driftEmbers(dt);
    for (var bi = booms.length - 1; bi >= 0; bi--) if ((booms[bi].t += dt) >= 0.8) booms.splice(bi, 1);

    /* Rage: PROXIMITY fills the bar (RipperUI's rage is earned by
       staying in the fight, so fastest point-blank ~10s, slowest at
       max range ~50s). A full bar is spent by z (activateRage) — it no
       longer spends itself, because a resource that fires without the
       player's say-so is a timer, not a choice. */
    if (!dying && (mode === 'fight' || mode === 'wall' || mode === 'brothers')) {
      var rd = Math.hypot(px - bx, py - by);
      var near = 1 - Math.min(1, rd / 420);
      /* Calamity wiki: the Rage Meter fills by proximity, bosses triple
         the rate, and a full bar takes 30s. 0.0333/s base x3 at
         point-blank = 10s close, 30s far. It does NOT drain here — a
         ratchet, by design decision, unlike the mod's 3.33%/s bleed. */
      rage = Math.min(1, rage + dt * 0.0333 * (1 + 2 * near));
    }
    if (rageModeT > 0) {
      rageModeT -= dt;
      if (rageModeT <= 0) { rageMode = 0; say('* the rage burns out. it wants to be earned again.'); }
    }
    if (shieldT > 0) shieldT -= dt;
    /* Charging the shot: f held accumulates power over ~0.9s (capped),
       released by keyup → tryHit(). shotCd keeps taps from machine-
       gunning bolts. */
    if (charging) chargeF = Math.min(1, chargeF + dt);
    if (shotCd > 0) shotCd -= dt;
    /* null: her rage is her own, the shared bar stays out of it */
    dm.tick(F, dt, null);
    /* The sweep. Six per second converges in about half a second —
       fast enough to feel responsive, slow enough to read as charging. */
    var ease = Math.min(1, dt * 6);
    rageShown += (rage - rageShown) * ease;
    tpShown   += (tp   - tpShown)   * ease;

    if (mode !== 'intro' && mode !== 'won') movePlayer(dt);
    if (inv > 0) inv -= dt;

    if (mode === 'intro') { if (t > 2.6) startLead(); }
    else if (mode === 'wall') NEU.scalAtk.tick(dt);
    else if (mode === 'brothers') brothersTick(dt);
    else if (mode === 'fight') fightTick(dt);

    moveBullets(dt * dm.slow(F));
    moveMyShots(dt);
  }

  function movePlayer(dt) {
    F.x = px; F.y = py;
    dm.move(F, keys, dt, { AX: AX, AY: AY, AW: AW, AH: AH });
    px = F.x; py = F.y;
  }

  /* One frame of the fight proper. The seekers' ring and the Sepulcher hold
     the attack clock; when they are down, the clock runs again. */
  function fightTick(dt) {
    if (ringOn && NEU.scalSeekers) {
      /* She holds still; the ring is the attack. Both callbacks are the same
         ones the worm uses, so a graze and a hit take the same paths. */
      NEU.scalSeekers.setPlayer(px, py);
      NEU.scalSeekers.tick(dt);
      NEU.scalSeekers.tickDarts(dt, px, py,
        function () { grazedByBody = true; },
        function () { if (inv <= 0 && mode !== 'won') hitPlayer(); });
      if (!NEU.scalSeekers.alive()) {
        ringOn = false; invuln = false;
        say("* the eyes go out. she is exposed again.");
      }
      return;
    }
    if (sep) {
      /* Delegated worm: js/act4/scal-worm.js owns its movement and darts.
         Its body deals no contact damage (SepulcherHead.cs sets NPC.damage = 0). */
      if (NEU.scalWorm) {
        NEU.scalWorm.setPlayer(px, py);
        NEU.scalWorm.tick(dt);
        NEU.scalWorm.tickDarts(dt, px, py,
          function () { grazedByBody = true; },
          function () { if (inv <= 0 && mode !== 'won') hitPlayer(); });
      }
      if (!hearts.length) {
        sep = null; invuln = false;
        say("* she steps out from behind it.");
      }
      return;
    }
    NEU.scalAtk.tick(dt);
  }

  function brothersTick(dt) {
    /* Both alive: 25% DR (handled in tryHit). Fire in barrages with
       pauses — every 0.83s (50 frames) while active, then a hold while
       they swap sides. Every 7th volley = big attack. When one dies,
       the survivor enrages: faster volleys, shorter pauses. */
    for (var i = 0; i < bros.length; i++) {
      var b = bros[i];
      if (b.hp <= 0) continue; // dead, will be cleaned up below

      var interval = b.enraged ? 0.7 : 0.83; // enraged = faster
      b.t -= dt;
      b.y += Math.sin(t * 1.6 + i) * 22 * dt;
      if (b.barrageCd > 0) {
        b.barrageCd -= dt;
        if (b.barrageCd <= 0) {
          b.side *= -1;
          b.x = b.side < 0 ? AX + 60 : AX + AW - 60;
          if (NEU.juice) NEU.juice.hit('small');
        }
      }
      if (b.t <= 0 && b.barrageCd <= 0) {
        b.t = interval;
        b.attackCount++;
        b.volley = (b.volley || 0) + 1;
        if (b.volley >= (b.enraged ? 2 : 5)) {
          b.volley = 0;
          b.barrageCd = b.enraged ? 0.9 : 1.2;
        }
        var isBigAttack = (b.attackCount % 7 === 0);
        var a = Math.atan2(py - b.y, px - b.x);

        if (isBigAttack) {
          /* Big attack every 7th: fist = 2 fists, slash = predictive lunge (3 slashes ahead) */
          if (b.kind === 'fist') {
            /* Two fists from opposite sides */
            for (var s = -1; s <= 1; s += 2) {
              var aa = a + s * 0.25;
              spawn(b.x, b.y, Math.cos(aa) * 280, Math.sin(aa) * 280, 0);
            }
          } else {
            /* Slash: predictive lunge - aim ahead of player */
            var pvx = 0, pvy = 0; // could track player velocity
            var predX = px + pvx * 0.5, predY = py + pvy * 0.5;
            var aa = Math.atan2(predY - b.y, predX - b.x);
            for (var j = -1; j <= 1; j++)
              spawn(b.x, b.y, Math.cos(aa + j * 0.12) * 340, Math.sin(aa + j * 0.12) * 340, 0);
          }
        } else {
          /* Normal attack */
          if (b.kind === 'fist') {
            spawn(b.x, b.y, Math.cos(a) * 240, Math.sin(a) * 240, 0);
          } else {
            var spread = b.enraged ? 0.1 : 0.16;
            var count = b.enraged ? 1 : 3;
            var start = -(count - 1) / 2;
            for (var j = 0; j < count; j++)
              spawn(b.x, b.y, Math.cos(a + (start + j) * spread) * 300, Math.sin(a + (start + j) * spread) * 300, 0);
          }
        }
      }
    }

    /* Remove dead brothers */
    for (var i = bros.length - 1; i >= 0; i--) {
      if (bros[i].hp <= 0) {
        var dead = bros.splice(i, 1)[0];
        if (NEU.juice) NEU.juice.burst(dead.x, dead.y, 15, dead.kind === 'fist' ? COL.brimHi : COL.brim, 1.5);
        /* Survivor enrages */
        if (bros.length === 1) {
          bros[0].enraged = true;
          say(dead.kind === 'fist' ? "* the swordsman falls. the mage rages." : "* the mage falls. the swordsman rages.");
        }
      }
    }

    if (!bros.length) {
      invuln = false; mode = 'fight';
      if (NEU.sfx && NEU.sfx.stinger) NEU.sfx.stinger(2);
      say("* she laughs. that is the first noise she has made.");
      later(function () { if (running) say("* now she is trying."); }, 2200);
    }
  }

  /* One damage source for bullets and contact alike. A standing
     barrier eats the hit instead of you — one hit, then it is gone,
     and it does not hand you invulnerability for free. */
  function hitPlayer() {
    if (god || F.dashI > 0) return false;          /* a dash passes through */
    if (shieldT > 0) {
      shieldT = 0;
      inv = IFRAMES;
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(px, py, 12, '#B8E6FF'); }
      return false;
    }
    hp--; inv = IFRAMES;
    dm.hurt(F, px, py - 12);
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    /* Taking a hit is a MEDIUM event. The player needs to feel it
       without the screen becoming unreadable mid-pattern. */
    if (NEU.juice) { NEU.juice.hit('medium'); NEU.juice.burst(px, py, 10, COL.soul); }
    if (hp <= 0) { startDeath(); return true; }
    return false;
  }

  /* Deltarune's rule, from the wiki: "More TP is earned as the SOUL
     continues to graze bullets for longer." This used to be a flat
     `tp += dt * 0.4` written out TWICE — once in moveBullets and once in
     the worm's graze callback — which is two copies of a rule free to
     drift apart. One funnel; every hostile body calls it. */
  function feedGraze(dt, grazing) {
    if (!grazing) { grazeT = 0; return; }
    grazeT += dt;
    tp = Math.min(1, tp + dt * (0.25 + 0.35 * Math.min(1, grazeT / 1.5)));
  }

  /* Bullets move, graze and hit. A bullet with a fuse ends when the fuse runs
     out, or at once when a proximity fuse reaches the soul. Its onEnd runs
     after the list is rebuilt, so the ring it drops is not lost. */
  function moveBullets(dt) {
    var keep = [], fire = [];
    var grazedThisFrame = false;
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      b.age += dt;
      if (b.fuse !== undefined) {
        b.fuse -= dt;
        var pdx = px - b.x, pdy = py - b.y;
        var near = b.prox !== undefined && pdx * pdx + pdy * pdy < b.prox * b.prox;
        if (b.fuse <= 0 || near) { b.fuse = 0; if (b.onEnd) fire.push(b); continue; }
      }
      if (b.acc !== undefined) { var am = Math.pow(b.acc, dt); b.vx *= am; b.vy *= am; }
      if (b.vmax !== undefined) {
        var vs = Math.hypot(b.vx, b.vy);
        if (vs > b.vmax) { b.vx *= b.vmax / vs; b.vy *= b.vmax / vs; }
      }
      /* sprites face their travel; the flat ones keep the angle they had */
      if (b.vx * b.vx + b.vy * b.vy > 4) {
        b.rot = (b.k === 1 || b.k === 2 || b.k === 4)
          ? Math.atan2(b.vy, b.vx) + Math.PI / 2
          : Math.atan2(b.vy, b.vx);
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < AX - 60 || b.x > AX + AW + 60 || b.y < AY - 60 || b.y > AY + AH + 60) continue;
      keep.push(b);
      if (inv <= 0 && mode !== 'won') {
        var dx = b.x - px, dy = b.y - py, rr = b.r + PLAYER_R;
        /* Graze: a bullet within 26px of the soul feeds TP, hit or not. */
        if (dx * dx + dy * dy < (b.r + 26) * (b.r + 26)) grazedThisFrame = true;
        if (dx * dx + dy * dy < rr * rr && hitPlayer()) return;
      }
    }
    /* Body grazes latched during fightTick count here too: one clock, one cap. */
    feedGraze(dt, grazedThisFrame || grazedByBody);
    grazedByBody = false;
    bullets = keep;
    for (var f = 0; f < fire.length; f++) fire[f].onEnd(fire[f]);
  }

  /* ── hitting her ────────────────────────────────────────────────
     You DO have a weapon now (V5 phase 2): hold f to charge, release
     to fire a homing shot. A tap is a weak bolt; a full ~0.9s charge
     is an orb that bursts into eight darts on impact. The soul still
     shatters hearts on touch? No — everything goes through the gun
     now, which is what makes the brothers beatable and melee-vs-strike-
     ring geometry problem moot. */

  function startCharge() {
    if (charging || dying || mode === 'intro' || mode === 'won') return;
    charging = true; chargeF = 0;
  }

  /* Target selection mirrors the old tryHit branch order exactly:
     the ring while it stands, hearts while the sepulcher stands, then
     the brothers, then her. */
  function resolveTarget() {
    if (ringOn && NEU.scalSeekers && NEU.scalSeekers.alive()) {
      var ss = NEU.scalSeekers.seekers(), bs = null, bsd = Infinity;
      for (var s = 0; s < ss.length; s++) {
        var sd = Math.hypot(px - ss[s].x, py - ss[s].y);
        if (sd < bsd) { bsd = sd; bs = ss[s]; }
      }
      if (bs) return { x: bs.x, y: bs.y };
    }
    if (sep && hearts.length) {
      var bh = null, bd = Infinity;
      for (var i = 0; i < hearts.length; i++) {
        var d = Math.hypot(px - hearts[i].x, py - hearts[i].y);
        if (d < bd) { bd = d; bh = hearts[i]; }
      }
      if (bh) return { x: bh.x, y: bh.y };
    }
    if (mode === 'brothers' && bros.length) {
      var bb = null, bdd = Infinity;
      for (var j = 0; j < bros.length; j++) {
        var dd = Math.hypot(px - bros[j].x, py - bros[j].y);
        if (dd < bdd) { bdd = dd; bb = bros[j]; }
      }
      if (bb) return { x: bb.x, y: bb.y };
    }
    if (mode === 'fight' && !invuln) return { x: bx, y: by };
    return null;
  }

  /* keyup: release the charge as a homing shot. */
  function tryHit() {
    if (!charging) return;
    charging = false;
    var power = Math.min(1, chargeF / 0.9);
    chargeF = 0;
    if (shotCd > 0 || dying || mode === 'intro' || mode === 'won') return;
    shotCd = 0.3;
    var tg = resolveTarget();
    var ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    var ang = tg ? Math.atan2(tg.y - py, tg.x - px)
                 : ((ix || iy) ? Math.atan2(iy, ix) : -Math.PI / 2);
    var heavy = power >= 0.35;
    var sp = heavy ? 300 : 260;
    myShots.push({ x: px, y: py, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                   r: heavy ? 12 : 5, k: heavy ? 'orb' : 'bolt', age: 0 });
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
  }

  /* An orb that lands bursts into eight darts — each one homes too,
     so the burst total is deterministic against a stationary target. */
  function burstShots(x, y) {
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      myShots.push({ x: x, y: y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
                     r: 4, k: 'burst', age: 0 });
    }
  }

  function moveMyShots(dt) {
    for (var i = myShots.length - 1; i >= 0; i--) {
      var s = myShots[i];
      s.age += dt;
      var dead = s.age > (s.k === 'burst' ? 1.2 : 4);
      /* dt-correct version of moveBullets' speed-preserving steering
         kernel: rotate velocity toward the target without changing its
         magnitude, so homing curves instead of snapping. */
      if (!dead) {
        var tg = resolveTarget();
        if (tg) {
          var dx = tg.x - s.x, dy = tg.y - s.y;
          var dist = Math.hypot(dx, dy);
          if (dist > 0.001) {
            var sp = Math.hypot(s.vx, s.vy) || 260;
            var k = Math.min(1, dt * 6);
            s.vx += (dx / dist * sp - s.vx) * k;
            s.vy += (dy / dist * sp - s.vy) * k;
          }
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.x < AX - 40 || s.x > AX + AW + 40 ||
            s.y < AY - 80 || s.y > AY + AH + 60) dead = true;
      }
      /* Collisions mirror the old tryHit gating: whatever the melee
         could touch, the shot can reach. The ring branch comes first:
         while she is invulnerable behind the seekers, every shot that
         touches one kills it (orbs burst into their eight darts right
         there — how the phase is played through). */
      if (!dead) {
        if (ringOn && NEU.scalSeekers) {
          if (NEU.scalSeekers.hit(s.x, s.y, s.r)) {
            if (s.k === 'orb') burstShots(s.x, s.y);
            dead = true;
          }
        } else if (sep) {
          for (var q = 0; q < hearts.length; q++) {
            if (Math.hypot(hearts[q].x - s.x, hearts[q].y - s.y) < 18 + s.r) {
              damageTarget('heart', hearts[q], 1);
              if (s.k === 'orb') burstShots(s.x, s.y);
              dead = true; break;
            }
          }
        } else if (mode === 'brothers') {
          for (var w = 0; w < bros.length; w++) {
            if (Math.hypot(bros[w].x - s.x, bros[w].y - s.y) < HB.broReach + s.r) {
              damageTarget('bro', bros[w], 1);
              if (s.k === 'orb') burstShots(s.x, s.y);
              dead = true; break;
            }
          }
        } else if (mode === 'fight' && !invuln &&
                   Math.hypot(bx - s.x, by - s.y) < 40 + s.r) {
          damageTarget('her', null, 1);
          if (s.k === 'orb') burstShots(s.x, s.y);
          dead = true;
        }
      }
      if (dead) myShots.splice(i, 1);
    }
  }

  /* One damage funnel for all three target kinds. Her phase gates run
     from here: each HP share she crosses calls NEU.scalAtk.gate, which
     starts the transition (scal-attacks.js, GATE and AFTER_PT). */
  function damageTarget(kind, ref, amount) {
    var eff = amount * (rageMode ? 2 : 1);
    if (kind === 'heart') {
      var hi = hearts.indexOf(ref);
      if (hi < 0) return;
      ref.hp -= eff;
      dm.pop(F, ref.x, ref.y, eff);
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(ref.x, ref.y, 4, COL.brimHi); }
      if (ref.hp > 0) return;              /* cracked, not broken */
      var hx = ref.x, hy = ref.y;
      hearts.splice(hi, 1);
      if (NEU.juice) NEU.juice.burst(hx, hy, 8, COL.brimHi);
      return;
    }
    if (kind === 'bro') {
      if (bros.indexOf(ref) < 0) return;
      /* the number shows the strike, not the 25% DR split: the brother's
         own bar still moves by the real amount */
      dm.pop(F, ref.x, ref.y, eff);
      /* 25% DR while both brothers alive */
      var dmg = (bros.length === 2 ? 0.75 : 1) * eff;
      ref.dmgAccum = (ref.dmgAccum || 0) + dmg;
      if (ref.dmgAccum >= 1) {
        var hits = Math.floor(ref.dmgAccum);
        ref.hp -= hits;
        ref.dmgAccum -= hits;
      }
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(ref.x, ref.y, 8, COL.brimHi); }
      /* Death handled in brothersTick */
      return;
    }
    if (invuln || mode !== 'fight') return;
    bossHP -= eff;
    dm.bossHit(F, bx, by, eff);
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    /* Landing one is SMALL — it happens often, and shaking hard on
       every strike would drown out the phase transitions. */
    if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(bx, by, 7, COL.brimHi); }
    bossHP = Math.max(0, bossHP);
    NEU.scalAtk.gate(bossHP / bossMax);
  }

  function win() {
    mode = 'won'; running = false; bullets = [];
    /* the ring cannot outlive her: drop it so nothing ticks or draws
       into the victory lap */
    if (NEU.scalSeekers) NEU.scalSeekers.clear();
    ringOn = false;
    clearSched();
    if (NEU.juice) { NEU.juice.hit('huge', { colour: '#FF6B4A' });
                     NEU.juice.burst(bx, by, 60, COL.brim, 260); }
    if (NEU.save) { NEU.save.give('ashes'); NEU.save.flag('scal_dead', 1); }
    if (NEU.quest) NEU.quest.mark('a4_scal');
    if (msg) {
      msg.hidden = false;
      msg.innerHTML = '<b>she sits back down.</b><br>' +
        '"the small one was me. obviously."<br>' +
        'she leaves you a handful of ash.<br>' +
        '<small>esc to leave</small>';
    }
    draw(performance.now());
  }

  function startDeath() {
    running = false; dying = performance.now();
    clearSched();
    if (dm.resetDeath) dm.resetDeath();
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    requestAnimationFrame(deathStep);
  }

  function deathStep(now) {
    var ms = now - dying;
    ctx.fillStyle = COL.void_; ctx.fillRect(0, 0, innerWidth, innerHeight);
    frame();
    var playing = dm.death ? dm.death(ctx, px, py, ms, COL.soul) : (ms <= 1700);
    if (!playing) {
      dying = 0;
      if (msg) { msg.hidden = false;
        msg.innerHTML = '<b>she waits.</b><br>enter to try again &middot; esc to leave'; }
      return;
    }
    requestAnimationFrame(deathStep);
  }

  /* ── draw ───────────────────────────────────────────────────────*/
  function rect(c, x, y, w, h, d) {
    ctx.fillStyle = c;
    ctx.fillRect(x - d, y - d, w + d * 2, d); ctx.fillRect(x - d, y + h, w + d * 2, d);
    ctx.fillRect(x - d, y, d, h); ctx.fillRect(x + w, y, d, h);
  }
  /* The void: four stepped red bands towards the arena, the field, then
     the forcefield border, a dark rim, a brimstone line and a hot inner
     edge, breathing at 0.3 Hz (still under reduced motion). */
  function frame() {
    var w = innerWidth, h = innerHeight;
    for (var i = 0; i < 4; i++) {
      var g = 40 + i * 28;
      ctx.fillStyle = 'rgba(110,12,22,0.14)';
      ctx.fillRect((AX - g * 1.6) | 0, (AY - g) | 0, (AW + g * 3.2) | 0, (AH + g * 2) | 0);
    }
    ctx.fillStyle = '#14050A'; ctx.fillRect(AX, AY, AW, AH);
    for (var e = 0; e < embers.length; e++) {
      var m = embers[e], ex = (m.x * w + Math.sin(m.ph) * 6) | 0, ey = (m.y * h) | 0;
      ctx.fillStyle = m.s === 3 ? '#FFB050' : '#FF5A2A';
      ctx.globalAlpha = 0.35 + 0.4 * (1 - m.y);
      ctx.fillRect(ex, ey, m.s, m.s);
    }
    ctx.globalAlpha = 1;
    var br = rm() ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.9);
    ctx.globalAlpha = 0.1 + 0.1 * br; rect('#FF3A2A', AX - 6, AY - 6, AW + 12, AH + 12, 8);
    ctx.globalAlpha = 0.2 + 0.15 * br; rect('#FF3A2A', AX - 3, AY - 3, AW + 6, AH + 6, 3);
    ctx.globalAlpha = 1;
    rect('#FF3A2A', AX, AY, AW, AH, 3);
    rect('#FFB070', AX, AY, AW, AH, 1);
  }

  function draw(now) {
    var w = innerWidth, h = innerHeight;
    ctx.fillStyle = COL.void_; ctx.fillRect(0, 0, w, h);
    /* Everything between begin/end is shaken as one image. The draw
       code below has no idea it is happening, which is what keeps the
       shake off the simulation. */
    var shook = NEU.juice ? NEU.juice.begin(ctx, w, h) : false;
    frame();

    /* Frame mapping from the mod source (SupremeCalamitas.cs): the
       sheet is 21 rows x 2 columns and frame.Y = frameCounter(0-5) +
       FrameType*6, so each FrameType is a 6-frame band that wraps
       into column 1 when it crosses row 20. Bands:
         0 UpwardDraft (idle)         — col 0 rows 0-5
         1 FasterUpwardDraft (dash)   — col 0 rows 6-11
         2 Casting                    — col 0 rows 12-17
         3 BlastCast (gigablast)      — col 0 rows 18-20, col 1 rows 0-2
         4 BlastPunchCast (P2 giga)   — col 1 rows 3-8
         5 OutwardHandCast (hellblast)— col 1 rows 9-14
         6 PunchHandCast (P2 hell)    — col 1 rows 15-20
       The old mapping here was invented from the row count alone and
       showed the wrong poses for every state. */
    function getScalAnim() {
      if (scalAnimState !== scalAnimPrevState) {
        scalAnimTimer = 0;
        scalAnimPrevState = scalAnimState;
      }
      /* Was a fixed 1/60 regardless of real frame time, so animation
         speed silently drifted with the display's actual refresh rate
         instead of following the simulation's own dt. */
      scalAnimTimer += lastDt;
      var st = scalAnimState;
      if (st === 'gigablast' && phase === 2) st = 'gigablast_p2';
      if (st === 'hellblast' && phase === 2) st = 'hellblast_p2';
      var b = BANDS[st] || BANDS.idle;
      var c = b.rev
        ? 5 - Math.floor(scalAnimTimer * b.fps) % 6
        : Math.floor(scalAnimTimer * b.fps) % 6;
      var fy = b.t * 6 + c;             // frame.Y, 0-41
      return { frame: fy % 21, col: (fy / 21) | 0 };
    }
    var BANDS = {
      idle:            { t: 0, fps: 4 },
      idle_fast:       { t: 1, fps: 6 },
      /* SupremeCalamitas.cs: the whole charging state — telegraph
         through dash — is one continuous FrameType.FasterUpwardDraft
         (confirmed in-file), band 1, the same band the dash itself
         uses. The telegraph used to sit on band 0 (idle), so the
         wind-up before every dash showed her standing still — the
         tracker's "melee attack sprites aren't used" for the half of
         the charge a player actually has time to read. Same band as
         `charging`, slower fps so the wind-up still reads as distinct
         from the dash it leads into. */
      charge_telegraph:{ t: 1, fps: 8 },
      charging:        { t: 1, fps: 16 },
      charge_recovery: { t: 1, fps: 8, rev: true },
      casting:         { t: 2, fps: 10 },
      gigablast:       { t: 3, fps: 10 },
      gigablast_p2:    { t: 4, fps: 10 },
      hellblast:       { t: 5, fps: 10 },
      hellblast_p2:    { t: 6, fps: 10 }
    };

    /* her */
    if (mode !== 'won') {
      var bodyKey = mode === 'intro' ? 'scalHood' : 'scal';
      var anim = (mode === 'intro') ? { frame: 0, col: 0 } : getScalAnim();
      if (!sprite(bodyKey, bx, by, 2, 0, phase === 2, anim.col, anim.frame)) {
        ctx.fillStyle = '#FF00A0';
        ctx.fillRect((bx - 20) | 0, (by - 26) | 0, 40, 52);
      }
    } else {
      /* the drop. she is done; the sheet stays. */
      if (!sprite('ashes', bx, by + 34, 1, 0)) {
        ctx.fillStyle = COL.brim;
        ctx.fillRect((bx - 10) | 0, (by + 20) | 0, 20, 20);
      }
    }

    /* her shield. The mod summons the forcefield bubble and the two
       arcs around the charge telegraph; here it also marks the whole
       "she cannot be touched" state — walls, brothers, the worm. */
    if ((invuln || willCharge) && mode !== 'intro') {
      var shk = Math.sin(now / 160) * 3;
      sprite('scalShield', bx, by, 1.35, 0, false, 0, 0, 0.55);
      sprite('scalShieldTop', bx, by - 6 + shk, 1.15, 0);
      sprite('scalShieldBot', bx, by + 30 - shk, 1.15, 0);
    }

    NEU.scalAtk.draw(ctx);
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i], sz = (b.r * 2) | 0;
      /* k picks the sheet; everything else is a brimstone dart. */
      var key = b.k === 1 ? 'fireblast' : b.k === 2 ? 'gigablast'
              : (b.k === 3 || b.k === 5) ? 'hellblast' : 'dart';
      var sc = b.k === 1 ? 0.65 : b.k === 2 ? 0.75
            : (b.k === 3 || b.k === 5) ? 0.5 : 0.55;
      /* b.rot tracks real travel (set in moveBullets, seeded at spawn
         for k1/k2) — NOT a live atan2(vy,vx) here, which used to lock
         to a single angle for every homing blast's entire wind-up and
         burst pause, since both spawn and pause at vx:vy:0. */
      var brot = b.rot || 0;
      var lk = LOOK[b.look || b.tag];
      var gc = lk ? lk.glow : b.k === 2 ? '#C03070' : '#FF4A2A';
      if (lk) {
        key = lk.key; sc = lk.sc;
        var va = Math.atan2(b.vy, b.vx);
        if (lk.spin === null) brot = 0;
        else if (b.vx || b.vy) brot = lk.key === 'scalDemon'
          ? Math.atan(b.vy / (b.vx || 1e-6)) : va + lk.spin;
      }
      /* CondemnationArrowSCal.PreDraw: a red line ahead of a fresh
         arrow for its first 20 f, swelling 0.3 -> 3 -> 0.3 */
      if (b.look === 'arrow' && b.age < 1 / 3) {
        var ak = Math.sin(Math.PI * b.age * 3), aa = Math.atan2(b.vy, b.vx);
        ctx.save(); ctx.beginPath(); ctx.rect(AX, AY, AW, AH); ctx.clip();
        ctx.strokeStyle = 'rgba(255,0,0,0.8)'; ctx.lineWidth = Math.max(1, Math.round(0.3 + 2.7 * ak));
        ctx.beginPath(); ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + Math.cos(aa) * 1200, b.y + Math.sin(aa) * 1200); ctx.stroke();
        ctx.restore();
      }
      /* DemonicBomb.PreDraw: a hollow circle the size of the burst,
         purple pulsing to red over the last stretch of its fuse */
      if (b.tag === 'bomb' && b.fuse !== undefined && b.fuse < 1.6) {
        var bk = Math.min(1, (1.6 - b.fuse) / 0.4), hot = b.fuse < 0.6;
        ctx.strokeStyle = hot && Math.sin(t * 6.3) > 0 ? 'rgba(255,40,40,' + bk.toFixed(2) + ')'
                                                       : 'rgba(160,40,200,' + bk.toFixed(2) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x | 0, b.y | 0, 56, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (dm.glow) dm.glow(ctx, b.x, b.y, Math.max(10, b.r * 3) | 0, gc, 0.55);
      if (!sprite(key, b.x, b.y, sc, brot)) {
        ctx.fillStyle = b.c;
        ctx.fillRect((b.x - b.r) | 0, (b.y - b.r) | 0, sz, sz);
        if (b.k === 2) { ctx.fillStyle = COL.brimHi; ctx.fillRect((b.x - 3) | 0, (b.y - 3) | 0, 6, 6); }
      }
    }
    for (var bm = 0; bm < booms.length; bm++) {
      var o = booms[bm];
      if (dm.glow) dm.glow(ctx, o.x, o.y, 56, '#FF5A2A', 1 - o.t / 0.8);
      sprite('scalBoom', o.x, o.y, 1.2, 0, false, 0, Math.min(7, (o.t / 0.1) | 0));
    }
    /* The player's homing shots (V5 phase 2). */
    for (var ms = 0; ms < myShots.length; ms++) {
      var s = myShots[ms];
      var sang = Math.atan2(s.vy, s.vx);
      if (s.k === 'orb') {
        var osc = 1 + 0.15 * Math.sin(now / 90);
        if (!sprite('gigablast', s.x, s.y, osc, sang, true)) {
          ctx.fillStyle = '#B48CFF';
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        var ssc = s.k === 'burst' ? 0.35 : 0.5;
        if (!sprite('dart', s.x, s.y, ssc, sang)) {
          ctx.fillStyle = '#E4C46A';
          ctx.fillRect((s.x - s.r) | 0, (s.y - s.r) | 0, s.r * 2, s.r * 2);
        }
      }
    }
    if (sep && NEU.scalWorm) {
      /* The worm draws itself — segments, arms, tail, head, the dash
         telegraph line and ITS OWN DARTS (scal-worm.js draw() renders
         every dart it spawns). Same layer slot as the old inline
         renderer: in front of the bullets, behind the hearts below. */
      NEU.scalWorm.draw(now);
    }
    /* the ring draws itself — darts, then seekers with their glow
       stacked, same layer slot as the worm: in front of bullets,
       behind the hearts below */
    if (ringOn && NEU.scalSeekers) NEU.scalSeekers.draw(now);
    /* hearts ride ON the body — drawn after it, so the six of them
       read against the worm instead of disappearing under it. */
    for (var q = 0; q < hearts.length; q++) {
      var hx = hearts[q].x, hy = hearts[q].y;
      if (!sprite('heart', hx, hy, 0.45, 0)) {
        ctx.fillStyle = '#C2405F';
        ctx.fillRect((hx - 7) | 0, (hy - 7) | 0, 14, 14);
      }
    }
    /* Their BODIES, not their thrown attacks. This used to draw
       'fist'/'slashTop' — SupremeCataclysmFist.png and
       SupremeCatastropheSlashAlt.png, the projectiles each brother
       THROWS — because SupremeCataclysm.png / SupremeCatastrophe.png
       (their real NPC art, both confirmed 636x1872/9 rows and
       800x1840/8 rows in the mod's own .cs) were never copied into the
       manifest at all. Their real thrown-attack sprites stay in the
       manifest under cataclysmFist/catastropheSlash for the projectile
       switch below, correctly used there. Glow masks stack the same way
       Polterghast's already do (glowKeys, additive). */
    for (var r = 0; r < bros.length; r++) {
      var br = bros[r], rot = Math.atan2(py - br.y, px - br.x);
      var bKey = br.kind === 'fist' ? 'cataclysm' : 'catastrophe';
      var bGlow = br.kind === 'fist' ? ['cataclysmGlow'] : ['catastropheGlow'];
      var bSh = NEU.sheets[bKey];
      var bSc = bSh ? 80 / bSh.fw : 0.4;
      if (!sprite(bKey, br.x, br.y, bSc, rot, false, undefined, undefined, undefined, bGlow)) {
        ctx.fillStyle = br.kind === 'fist' ? COL.brimHi : COL.brim;
        ctx.fillRect((br.x - 14) | 0, (br.y - 14) | 0, 28, 28);
      }
    }

    dm.drawFlash(ctx, F, bx, by, 64);
    if (mode !== 'won') dm.drawFX(ctx, F, inv);

    /* rage: the soul burns gold while it is up */
    if (rageMode > 0) {
      ctx.fillStyle = 'rgba(228,196,106,0.35)';
      ctx.beginPath();
      ctx.arc(px, py, 14 + Math.sin(now / 80) * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    /* U2: the barrier ring, drawn over the soul so the shield reads
       as worn by her rather than painted on the arena. */
    if (shieldT > 0) {
      ctx.strokeStyle = 'rgba(184,230,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 16 + Math.sin(now / 90) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    if (NEU.juice) NEU.juice.drawParts(ctx, 1 / 60);
    if (NEU.juice) NEU.juice.end(ctx, shook);
    if (NEU.juice) NEU.juice.overlay(ctx, w, h);

    var fa = flashAlpha();
    if (fa > 0) { ctx.fillStyle = 'rgba(255,70,50,' + fa.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }

    /* The shared HUD, outside the shake. Her bar DOES move — that is
       the difference between this fight and the one on the television.
       Ticks sit at every phase gate in damageTarget. */
    dm.hud(ctx, F, { w: w, h: h, AY: AY, AH: AH,
                     /* her Infernum title; a phone's 230 px bar holds only her name */
                     name: (w < 560 ? 'Calamitas' : 'Supreme Witch, Calamitas') + (invuln ? ' — shielded' : ''),
                     hp: bossHP, max: bossMax, invuln: invuln,
                     ticks: [0.75, 0.45, 0.25],
                     php: hp, pmax: MAXHP, phase: phase,
                     tp: tpShown, rage: rageShown, rageOn: rageMode > 0 });

    var dialY = AY + AH + 80;
    if (line && now - lineT < 5200) {
      ctx.fillStyle = COL.bone;
      ctx.font = '16px "Undertale Sans","Comic Sans MS",cursive';
      ctx.fillText(line, AX, dialY);
    }

    /* F3 hitbox debug */
    if (showHitboxes) {
      ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 1;
      /* player */
      ctx.beginPath(); ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2); ctx.stroke();
      /* SC */
      if (mode === 'fight' && !invuln) {
        ctx.strokeStyle = '#FF4444';
        ctx.beginPath(); ctx.arc(bx, by, 34, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#00FF00';
        ctx.beginPath(); ctx.arc(bx, by, 40, 0, Math.PI * 2); ctx.stroke();
      }
      /* bullets */
      for (var i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      }
      /* hearts */
      for (var q = 0; q < hearts.length; q++) {
        var h = hearts[q];
        ctx.beginPath(); ctx.arc(h.x, h.y, 18, 0, Math.PI * 2); ctx.stroke();
      }
      /* sepulcher */
      if (sep && NEU.scalWorm) {
        var wh = NEU.scalWorm.head();
        ctx.beginPath(); ctx.arc(wh.x, wh.y, 30, 0, Math.PI * 2); ctx.stroke();
      }
      /* brothers */
      for (var r = 0; r < bros.length; r++) {
        var br = bros[r];
        ctx.beginPath(); ctx.arc(br.x, br.y, HB.broReach, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  /* ── the real art ────────────────────────────────────────────────
     Every sheet is keyed in data/sheets.js. Her body gets a magenta
     fallback (a silently absent sprite gets mistaken for a logic bug
     and costs an hour); her projectiles keep their coloured squares
     so a missing file degrades to the old look rather than to a
     blob. Projectiles rotate to face travel — the sheets are drawn
     upright and Terraria spins them in code. */
  /* One blitter for the whole site, in data/sheets.js — see the note
     there. The local copy this replaces pinned source x at 0, which is
     why her two-column sheet drew as two overlapping women. */
  function sprite(key, x, y, scale, rot, glow, col, frame, alpha, glowKeys) {
    if (!NEU.sheetDraw) return false;
    return NEU.sheetDraw(ctx, key, x, y, {
      scale: scale, rot: rot, glow: glow, col: col, frame: frame,
      alpha: alpha, glowKeys: glowKeys,
      now: performance.now()
    });
  }
  /* ── input ──────────────────────────────────────────────────────*/
  addEventListener('keydown', function (e) {
    if (wrap.hidden || !NEU.scal.active || NEU.activeMinigame !== 'scal') return;
    if (e.key === 'F3') { showHitboxes = !showHitboxes; return; }
    if (e.key === 'Escape') {
      /* ESC works through the whole fight now. Leaving mid-fight costs
         the run, so that is the confirmed exit; the win and death
         screens are over and close clean. */
      if (mode === 'won' || dying) { close(); return; }
      if (NEU.engine && NEU.engine.confirmExit) {
        NEU.engine.confirmExit('Supreme Calamitas', close);
      } else { close(); }
      return;
    }
    if (!running && !dying && e.key === 'Enter') {
      /* The document-level retry of the bullet minigame used to hear
         this too and restarted its own timer over the death screen. */
      e.preventDefault(); e.stopPropagation();
      open(); return;
    }
    /* c dash, v (or shift+z) adrenaline, b rage: the shared keys */
    var act = running && mode !== 'intro' ? dm.key(F, e) : '';
    if (act === 'dash' || act === 'adren') { e.preventDefault(); return; }
    if (e.key === 'z' || e.key === 'Z' || act === 'rage') {
      /* U1: rage. A full bar buys eight seconds of doubled strikes —
         and only that. z never strikes; f is the strike key. */
      e.preventDefault();
      if (rageMode > 0) { say('* the rage is still burning.'); return; }
      if (rage < 1) { say('* the rage wants a full bar. miss hearts to fill it.'); return; }
      rage = 0; rageMode = 1; rageModeT = 8;
      sfxPlay('giga-hit');
      if (NEU.juice) NEU.juice.burst(px, py, 14, '#E4C46A', 1.2);
      say('* rage. everything strikes twice.');
      return;
    }
    /* f is still the strike key — but striking is now charge-and-
       release: keydown starts the charge (guarded against OS repeat
       autofire), keyup releases it as tryHit(). */
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); if (!e.repeat) startCharge(); return; }
    if (e.key === 'x' || e.key === 'X') {
      /* U2: the barrier. Full tp spends itself as one held hit. */
      e.preventDefault();
      if (shieldT > 0) { say('* the barrier is already up.'); return; }
      if (tp < 1) { say('* the barrier wants full tp. graze to fill it.'); return; }
      tp = 0; shieldT = 2.5;
      if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
      say('* the barrier blooms. it will take one hit.');
      return;
    }
    var n = dm.keyName(e); if (n) { keys[n] = true; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) {
    /* Same three-condition guard as keydown — the old one checked only
       wrap.hidden, so a release could fire while another minigame held
       the input lock. */
    if (wrap.hidden || !NEU.scal.active || NEU.activeMinigame !== 'scal') return;
    var n = dm.keyName(e); if (n) keys[n] = false;
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); tryHit(); return; }
  });

  /* ── the attack machine's hands (scal-attacks.js) ─────────────────
     Everything she does reaches the fight through this object. The getters
     are live, so the machine reads this frame's positions every frame. */
  var ADAPT = {
    get px() { return px; }, get py() { return py; },
    get bx() { return bx; }, get by() { return by; },
    get AX() { return AX; }, get AY() { return AY; },
    get AW() { return AW; }, get AH() { return AH; },
    shot: spawn,
    clearAll: function () { bullets = []; },
    clearTag: function (tag) { bullets = bullets.filter(function (b) { return b.tag !== tag; }); },
    setBoss: function (x, y) { bx = x; by = y; },
    setHP: function (n) { bossHP = n; },
    level: function (n) { phase = n >= 2 ? 2 : 1; phaseFlash(); },
    boom: boom,
    anim: function (s) { scalAnimState = s; },
    willCharge: function (v) { willCharge = v; },
    invuln: function (v) { invuln = v; },
    shake: function (s) {
      if (!NEU.juice) return;
      if (s === 'medium') NEU.juice.hit('medium'); else NEU.juice.hit('small');
    },
    sfx: function (n) { sfxPlay(n); },
    hit: function () { if (inv <= 0 && mode !== 'won') hitPlayer(); },
    over: function () { return !running; },
    win: function () { win(); },
    special: function (kind) {
      if (kind === 'worm') spawnSepulcher();
      else if (kind === 'brothers') startBrothers();
      else startSeekers();
    },
    specialDone: function (kind) {
      if (kind === 'worm') return !sep;
      if (kind === 'brothers') return mode === 'fight' && !bros.length;
      return !ringOn;
    }
  };
  NEU.scalAtk.attach(ADAPT);

  /* debug hook: drop every special, then run one attack now */
  function clearSpecials() {
    sep = null; hearts = []; bros = []; ringOn = false; invuln = false;
    if (NEU.scalSeekers) NEU.scalSeekers.clear();
    if (mode !== 'won') mode = 'fight';
  }

  /* ── open / close ───────────────────────────────────────────────*/
  var active = false;
  var keysOrig = null;
  function open() {
    active = true;
    NEU.activeMinigame = 'scal';
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (msg) msg.hidden = true;
    /* This wrapper's hint belongs to the bullet minigame ("survive 20s")
       and she shares the wrapper with it — say what this fight does. */
    var keysEl = document.querySelector('#bh .bh__keys');
    if (keysEl) {
      if (keysOrig === null) keysOrig = keysEl.innerHTML;
      keysEl.innerHTML = 'arrows / wasd &middot; shift focus &middot; f to strike (hold to charge) &middot; c dash &middot; v adrenaline &middot; z for rage &middot; x to shield &middot; esc to leave';
    }
    layout();
    t = 0; hp = MAXHP; inv = 0; bullets = []; keys = {}; booms = []; flashAt = -9;
    rage = 0; tp = 0; shieldT = 0;
    rageMode = 0; rageModeT = 0;
    rageShown = 0; tpShown = 0; grazeT = 0;
    myShots = []; charging = false; chargeF = 0; shotCd = 0;
    willCharge = false;
    /* x10 (2026-08-24). A charged orb deals 9 — one on impact plus eight
       burst darts that spawn AT the impact point and all land the next
       frame — so 24 HP was three orbs, about three seconds, and at most
       3 of her 24 cycle steps ever played. 240 is ~27 orbs: a 70-90s
       fight and roughly one full lap of the cycle. Every phase gate in
       damageTarget is a FRACTION of bossMax, so they rescale for free,
       and core/music.js takes hpMax from the first reading per fight. */
    bossMax = 240; bossHP = bossMax; phase = 1; held = false; shotsFired = 0;
    hearts = []; sep = null; bros = []; invuln = true; dying = 0;
    ringOn = false;
    /* Hand the Sepulcher module its canvas + arena once per fight;
       close() clears the flag so a reopened fight re-inits fresh. The
       target closure reads bx/by live — she is what the worm charges. */
    if (NEU.scalWorm && !scalWormReady) {
      NEU.scalWorm.init({ ctx: ctx, AX: AX, AY: AY, AW: AW, AH: AH,
                          target: function () { return { x: bx, y: by }; } });
      scalWormReady = true;
    }
    /* Same once-per-fight handoff for the ring module; close() clears
       the flag so a reopened fight re-inits fresh. The target closure
       reads bx/by live — startSeekers parks her at arena centre and
       the ring spins around THAT. */
    if (NEU.scalSeekers && !seekersReady) {
      NEU.scalSeekers.init({ ctx: ctx, AX: AX, AY: AY, AW: AW, AH: AH,
                             target: function () { return { x: bx, y: by }; } });
      seekersReady = true;
    }
    preloadSfx();
    mode = 'intro';
    px = AX + AW / 2; py = AY + AH - 60;
    F = dm.fight(px, py);
    bx = AX + AW / 2; by = AY - 24;
    say('* the small one was not small.');
    running = true; last = performance.now();
    requestAnimationFrame(stepFn);
  }
  function close() {
    active = false; running = false; dying = 0;
    F.pops = [];
    clearSched();
    scalWormReady = false;
    seekersReady = false;
    NEU.scalAtk.reset();
    /* Guarded, like every other minigame's close() — an unconditional
       clear here could null out a DIFFERENT minigame's lock if close()
       ever ran after something else had already claimed the input lock
       (e.g. a quit racing an open elsewhere). */
    if (NEU.activeMinigame === 'scal') NEU.activeMinigame = null;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    /* her fight borrowed the bullet minigame's hint; give it back */
    if (keysOrig !== null) {
      var keysEl = document.querySelector('#bh .bh__keys');
      if (keysEl) keysEl.innerHTML = keysOrig;
      keysOrig = null;
    }
    /* Back to the room you came from, win or lose. */
    if (NEU.engine) NEU.engine.enter(NEU.save && NEU.save.flagged('scal_dead') ? 'b7_altar' : 'b8_arena',
                                     NEU.save && NEU.save.flagged('scal_dead') ? 'north' : 'west');
  }

  /* The quit button is the bullet minigame's, shared with this fight —
     route it like the keyboard ESC instead of letting the other game's
     handler run against a fight it knows nothing about. */
  var bhQuitBtn = document.getElementById('bhQuit');
  if (bhQuitBtn) bhQuitBtn.addEventListener('click', function () {
    if (!active || NEU.activeMinigame !== 'scal') return;
    if (mode === 'won' || dying) { close(); return; }
    if (NEU.engine && NEU.engine.confirmExit) {
      NEU.engine.confirmExit('Supreme Calamitas', close);
    } else { close(); }
  });

  /* F8 opens the fight from anywhere — a dev command for testing the
     fight without re-walking the castle. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F8' && NEU.scal && !NEU.scal.active) {
      e.preventDefault();
      if (NEU.engine) NEU.engine.enter('b8_arena', 'west');
      open();
    }
  });

  NEU.scal = { open: open, close: close,
               get running() { return running; },
               get active() { return active; },
               get hp() { return bossHP; },
               get booms() { return booms.length; },
               get embers() { return embers; },
               get flashA() { return flashAlpha(); },
               get phase() { return phase; },
               get mode() { return mode; },
               get hearts() { return hearts.length; },
               get bros() { return bros.length; },
               /* live positions for the win-path test: it walks the
                  soul, and she and the worm move with the fight */
               get px() { return px; },
               get py() { return py; },
               get soulHP() { return hp; },
               get rage() { return rage; },
               /* test-only read (same class as wormSegs/wormAct): the
                  fixes8 drive refuses to fire during a doubling window
                  so its ladder taps stay exactly one point */
               get rageMode() { return rageMode; },
               get tp() { return tp; },
               get rageShown() { return rageShown; },
               get tpShown() { return tpShown; },
               get shieldT() { return shieldT; },
               get bx() { return bx; },
               get by() { return by; },
               get charging() { return !!NEU.scalAtk.beam(); },
               get wormBusy() { return NEU.scalWorm ? NEU.scalWorm.busy() : false; },
               get wormPos() { return sep && NEU.scalWorm ? NEU.scalWorm.head() : null; },
               get wormVel() {
                 var wh = sep && NEU.scalWorm ? NEU.scalWorm.head() : null;
                 return wh ? { vx: wh.vx, vy: wh.vy } : null;
               },
                get wormSegs() { return NEU.scalWorm ? NEU.scalWorm.segs() : []; },
                get wormAct() { return NEU.scalWorm ? NEU.scalWorm.act() : ''; },
                get wormDarts() { return NEU.scalWorm ? NEU.scalWorm.darts() : []; },
               get heartPos() { return hearts.map(function (h) { return { x: h.x, y: h.y }; }); },
               get seekers() { return NEU.scalSeekers ? NEU.scalSeekers.alive() : 0; },
               get seekerPos() { return NEU.scalSeekers ? NEU.scalSeekers.seekers() : []; },
               get seekerDarts() { return NEU.scalSeekers ? NEU.scalSeekers.darts() : []; },
               get broPos() { return bros.map(function (b) { return { x: b.x, y: b.y }; }); },
                get bullets() { return bullets.map(function (b) { return { x: b.x, y: b.y, vx: b.vx, vy: b.vy }; }); },
                get myShots() { return myShots.map(function (s) { return { x: s.x, y: s.y, vx: s.vx, vy: s.vy, k: s.k }; }); },
                /* test-only read (same class as wormSegs): the damage
                   numbers in flight, copied so a caller cannot write into
                   the live list */
                get _pops() { return F.pops.map(function (p) { return { x: p.x, y: p.y, y0: p.y0, n: p.n, age: p.age, c: p.c }; }); },
                /* the shared feel state (core/danmaku.js), for tests */
                get feel() { return F; },
                get level() { return NEU.scalAtk.level(); },
                get attack() { return NEU.scalAtk.attack(); },
                get lastAttack() { return NEU.scalAtk.last(); },
                get sub() { return NEU.scalAtk.sub(); },
                get invuln() { return invuln; },
                get shots() { return shotsFired; },
                get attacks() { return NEU.scalAtk.names(); },
                force: function (name) { clearSpecials(); return NEU.scalAtk.force(name); },
                hold: function (v) { held = !!v; },
                invincible: function (v) { god = !!v; },
                simulate: function (sec) {
                  var n = Math.round(sec * 60);
                  for (var i = 0; i < n && running; i++) update(1 / 60);
                },
                hurtBoss: function (n) { damageTarget('her', null, n); } };
})();