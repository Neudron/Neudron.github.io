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
  /* A2 combat state. stripOpen: the C menu (time runs at STRIP_SCALE).
     healCd: seconds of fight time until HEAL is ready again. meleeCd: the
     slash cooldown. There is no DEFEND: it handed out +16 % TP for a key
     press, so spamming it (under the menu's slowed clock) filled the bar
     for free. TP comes only from grazing and melee now. */
  var stripOpen = false, stripSel = 0, stripAt = 0, healCd = 0, healToast = 0;
  var meleeCd = 0, grazeAt = -9;
  var STRIP_SCALE = 0.2, MELEE_DMG = 6, MELEE_R = 56, FIRE_DMG = 1.5, BUSTER_DMG = 40;
  var MELEE_CD = 0.3, FIRE_CD = 1.2, FIRE_HOLD = 0.45, HEAL_CD = 30;
  /* TP, Deltarune's numbers (maps/tp.md). The wiki's scale is 0..250
     and reads as 0..100 %; tp here is 0..1. Each bullet grazed gives
     GRAZE_PTS once on first entry, then GRAZE_PTS per second while it
     stays in range (the wiki's points/30 per frame at its 30 fps). The
     points value is not on the wiki, so 8/250 (3.2 %) is ours [D]. */
  var TP_UNIT = 1 / 250, GRAZE_PTS = 8 * TP_UNIT, GRAZE_PAD = 8;
  /* The shared fight feel (core/danmaku.js): dash, adrenaline, damage
     numbers, the HUD. Her rage and tp stay her own; the HUD shows them. */
  var F = dm.fight(0, 0);
  /* What the meters DRAW. A bar that snaps to its value reads as a
     counter; one that sweeps toward it reads as charging, which is the
     whole point of RipperUI's presentation. */
  var rageShown = 0, tpShown = 0;
  /* Body grazes (worm and seeker darts) have no bullet record to hold
     a first-graze flag, so they latch here and moveBullets' single
     end-of-frame pass pays them the continued trickle. */
  var grazedByBody = false;
  /* the soul's velocity (screen px/s), measured each frame: the attacks lead
     their aim by it (NEU.scalAtk predict()) */
  var pvx = 0, pvy = 0;
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

  /* ── the look, track V (2026-10-28) ────────────────────────────────
     Calamity's bar: additive glows stacked on cached sprites (dm.glow),
     afterimages, shake through juice, colour flashes never past 3 Hz.
     Reduced motion keeps every telegraph and drops the motion: no view
     split, no storm drift, no shake (juice gates that). */
  /* the brothers: drawn BRO_H tall from their real sheets */
  var BRO_H = 168;
  var BRO_NAME = { slash: 'Supreme Catastrophe', fist: 'Supreme Cataclysm' };
  var BRO_COL = { fist:  { aura: '#FF4A14', hot: '#FFB040', bar: '#FF6A2A', ink: '#FFC890' },
                  slash: { aura: '#7A5CFF', hot: '#C8D4FF', bar: '#9A86FF', ink: '#D8D0FF' } };
  function broW(kind) {
    var sh = NEU.sheets && NEU.sheets[kind === 'fist' ? 'cataclysm' : 'catastrophe'];
    return sh ? Math.round(sh.fw * BRO_H / sh.fh) : BRO_H;
  }
  /* Where a brother stands against a wall: half his drawn width in, so
     the sprite never hangs past the arena edge (or under the TP meter).
     On a narrow screen the 8 px breathing room gives way first, and the
     half-width is the floor: a sprite wider than the arena overlaps, it
     does not hang out. */
  function broX(kind, side) {
    var half = broW(kind) / 2;
    var inset = Math.max(half, Math.min(half + 8, AW / 2));
    return side < 0 ? AX + inset : AX + AW - inset;
  }
  /* The next volley, read off the same clock brothersTick fires on, so
     the wind-up pose is a true telegraph of what comes. */
  function broNext() {
    if (mode !== 'brothers' || !bros.length || broT > 0.45) return null;
    var k = 1 - Math.max(0, broT) / 0.45, nx = broStep + 1, out = [];
    if (bros.length === 2 && nx % 3 === 0) {
      for (var i = 0; i < 2; i++) out.push({ b: bros[i], pat: bros[i].kind === 'fist' ? 'rocket' : 'crescent', k: k });
    } else {
      var b = bros[nx % bros.length];
      out.push({ b: b, pat: BRO_PATS[b.kind][b.n % 3], k: k });
    }
    return out;
  }
  function drawBro(br, pose) {
    var c = BRO_COL[br.kind], rot = Math.atan2(py - br.y, px - br.x), k = pose ? pose.k : 0;
    var bw = broW(br.kind), still = rm();
    /* the trail: where he was over the last few frames (dashes smear) */
    br.vt = br.vt || [];
    br.vt.push({ x: br.x, y: br.y });
    if (br.vt.length > 7) br.vt.shift();
    var lift = pose && pose.pat === 'pound' ? -14 * k : 0;
    var aura = 0.4 + 0.15 * (still ? 0 : Math.sin(t * 3 + br.side)) + 0.4 * k + (br.enraged ? 0.2 : 0);
    if (dm.glow) {
      dm.glow(ctx, br.x, br.y + lift, 120, c.aura, Math.min(1, aura));
      dm.glow(ctx, br.x, br.y + lift, 60, c.hot, 0.25 + 0.4 * k);
    }
    var bKey = br.kind === 'fist' ? 'cataclysm' : 'catastrophe';
    var bSh = NEU.sheets && NEU.sheets[bKey];
    var bSc = bSh ? BRO_H / bSh.fh : 1;
    for (var i = 0; i < br.vt.length - 1; i++) {
      var g = br.vt[i];
      if (Math.abs(g.x - br.x) + Math.abs(g.y - br.y) < 6) continue;
      sprite(bKey, g.x, g.y + lift, bSc, rot, false, undefined, undefined, 0.08 * (i + 1));
      if (dm.glow) dm.glow(ctx, g.x, g.y, 40, c.aura, 0.12 * (i + 1));
    }
    var glowK = [br.kind === 'fist' ? 'cataclysmGlow' : 'catastropheGlow'];
    if (!sprite(bKey, br.x, br.y + lift, bSc, rot, k > 0.6, undefined, undefined, undefined, glowK)) {
      ctx.fillStyle = br.kind === 'fist' ? '#5A1A0A' : '#241A40';
      ctx.fillRect((br.x - bw / 2) | 0, (br.y + lift - BRO_H / 2) | 0, bw, BRO_H);
      ctx.fillStyle = c.bar;
      ctx.fillRect((br.x - bw / 2) | 0, (br.y + lift - BRO_H / 2) | 0, bw, 4);
    }
    /* the weapon: Cataclysm's fist burns at the front of him, the
       Catastrophe's blade leaves a cold edge */
    if (br.kind === 'fist' && dm.glow) {
      var fx = br.x + Math.cos(rot) * bw * 0.36, fy = br.y + lift + Math.sin(rot) * bw * 0.36;
      dm.glow(ctx, fx, fy, 34, c.hot, 0.5 + 0.5 * k);
    } else if (dm.glow && br.dash > 0) {
      /* the blade's cold wake while he dashes */
      dm.glow(ctx, br.x, br.y, 90, '#C8D4FF', 0.5);
    }
    if (pose) broTelegraph(br, pose, rot, c);
  }
  /* the wind-up for each A1 volley, drawn over the brother, readable
     before the volley lands (k runs 0 -> 1 across the last 0.45 s) */
  function broTelegraph(br, pose, rot, c) {
    var k = pose.k, i, a, op = ctx.globalCompositeOperation;
    ctx.save();
    ctx.lineWidth = 1 + Math.round(2 * k);
    ctx.strokeStyle = 'rgba(' + (br.kind === 'fist' ? '255,120,40' : '170,150,255') + ',' + (0.35 + 0.5 * k).toFixed(2) + ')';
    if (pose.pat === 'pound') {
      ctx.beginPath(); ctx.arc(br.x, br.y, 30 + 90 * k, 0, Math.PI * 2); ctx.stroke();
    } else if (pose.pat === 'rocket' || pose.pat === 'crescent') {
      ctx.beginPath(); ctx.moveTo(br.x, br.y);
      ctx.lineTo(br.x + Math.cos(rot) * 900, br.y + Math.sin(rot) * 900); ctx.stroke();
      if (pose.pat === 'crescent') {
        ctx.beginPath(); ctx.arc(br.x, br.y, 70, rot - 0.45, rot + 0.45); ctx.stroke();
      }
    } else if (pose.pat === 'uppercut') {
      var gx = px + pvx * 0.5;
      ctx.fillStyle = 'rgba(255,90,30,' + (0.12 + 0.25 * k).toFixed(2) + ')';
      ctx.fillRect((gx - 10) | 0, AY, 20, AH);
    } else if (pose.pat === 'dash') {
      var to = broX(br.kind, br.x < AX + AW / 2 ? 1 : -1);
      ctx.beginPath(); ctx.moveTo(br.x, br.y); ctx.lineTo(to, br.y); ctx.stroke();
    } else if (pose.pat === 'ring') {
      for (i = 0; i < 10; i++) {
        a = i * Math.PI / 5 + t * 0.5;
        ctx.beginPath(); ctx.arc(br.x + Math.cos(a) * 150, br.y + Math.sin(a) * 150, 4 + 4 * k, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = op;
    ctx.restore();
  }
  /* their own bars, under hers: name, HP, enraged tag */
  function drawBroBars(w) {
    if (mode !== 'brothers' || !bros.length) return;
    var bw = Math.min(480, w - 160) | 0, x0 = ((w - bw) / 2) | 0, half = ((bw - 16) / 2) | 0;
    ctx.font = FONT_UI; ctx.textBaseline = 'top';
    var order = ['slash', 'fist'];
    for (var i = 0; i < 2; i++) {
      var br = null;
      for (var j = 0; j < bros.length; j++) if (bros[j].kind === order[i]) br = bros[j];
      var x = x0 + i * (half + 16), y = 76, c = BRO_COL[order[i]];
      ctx.textAlign = 'left';
      ctx.fillStyle = br ? c.ink : '#6A6480';
      ctx.fillText(w < 560 ? BRO_NAME[order[i]].split(' ')[1] : BRO_NAME[order[i]], x, y - 20);
      ctx.fillStyle = '#05050A'; ctx.fillRect(x - 2, y - 2, half + 4, 12);
      ctx.fillStyle = '#1A0A0E'; ctx.fillRect(x, y, half, 8);
      if (br) {
        ctx.fillStyle = c.bar; ctx.fillRect(x, y, Math.round(half * Math.max(0, br.hp) / 90), 8);
        ctx.fillStyle = c.hot; ctx.fillRect(x, y, Math.round(half * Math.max(0, br.hp) / 90), 2);
        if (br.enraged) { ctx.textAlign = 'right'; ctx.fillStyle = c.hot; ctx.fillText('ENRAGED', x + half, y - 20); }
      }
    }
    ctx.textAlign = 'left';
  }

  /* The soul's shots: cyan-white soul fire, never SCal's sheets. A
     white core in a diamond, a cyan trail of particles behind it, a
     cyan ring where it lands. */
  var rings = [];
  function shotRing(x, y, big) { if (rings.length > 16) rings.shift(); rings.push({ x: x, y: y, t: 0, big: big }); }
  function drawSoulShot(s) {
    var big = s.kind === 'buster', r = big ? 14 : 8;
    var a = Math.atan2(s.vy, s.vx), ca = Math.cos(a), sa = Math.sin(a);
    s.vt = s.vt || [];
    s.vt.push({ x: s.x, y: s.y });
    if (s.vt.length > (big ? 10 : 7)) s.vt.shift();
    for (var i = 0; i < s.vt.length - 1; i++) {
      var p = s.vt[i], k = (i + 1) / s.vt.length;
      if (dm.glow) dm.glow(ctx, p.x, p.y, (r * 1.4 * k) | 0, '#2AB8FF', 0.45 * k);
      ctx.fillStyle = 'rgba(160,240,255,' + (0.6 * k).toFixed(2) + ')';
      var j = (i * 7) % 5 - 2;
      ctx.fillRect((p.x - sa * j) | 0, (p.y + ca * j) | 0, 2, 2);
    }
    if (dm.glow) { dm.glow(ctx, s.x, s.y, r * 3, '#1A6AFF', 0.5); dm.glow(ctx, s.x, s.y, r * 2, '#7FE6FF', 0.8); }
    /* the diamond: long along travel, a white core */
    ctx.fillStyle = '#7FE6FF';
    ctx.beginPath();
    ctx.moveTo(s.x + ca * r * 1.6, s.y + sa * r * 1.6);
    ctx.lineTo(s.x - sa * r * 0.8, s.y + ca * r * 0.8);
    ctx.lineTo(s.x - ca * r, s.y - sa * r);
    ctx.lineTo(s.x + sa * r * 0.8, s.y - ca * r * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(s.x + ca * r * 0.9, s.y + sa * r * 0.9);
    ctx.lineTo(s.x - sa * r * 0.4, s.y + ca * r * 0.4);
    ctx.lineTo(s.x - ca * r * 0.5, s.y - sa * r * 0.5);
    ctx.lineTo(s.x + sa * r * 0.4, s.y - ca * r * 0.4);
    ctx.closePath(); ctx.fill();
  }
  function drawRings(dt) {
    for (var i = rings.length - 1; i >= 0; i--) {
      var o = rings[i];
      o.t += dt;
      var u = o.t / 0.3;
      if (u >= 1) { rings.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(127,230,255,' + (1 - u).toFixed(2) + ')';
      ctx.lineWidth = o.big ? 4 : 2;
      ctx.beginPath(); ctx.arc(o.x, o.y, (o.big ? 14 : 6) + u * (o.big ? 40 : 22), 0, Math.PI * 2); ctx.stroke();
      if (dm.glow && u < 0.4) dm.glow(ctx, o.x, o.y, o.big ? 40 : 22, '#B8F4FF', 1 - u / 0.4);
    }
    ctx.lineWidth = 1;
  }

  /* The slash: a wide crescent, three additive layers (deep blue, cyan,
     white core) on the live edge and an 8-step smear behind it. Hit
     sparks are straight cyan-white streaks thrown off the target. */
  var sparks = [];
  function slashSparks(x, y, ang) {
    for (var i = 0; i < 8; i++) {
      var a = ang + (i - 3.5) * 0.35;
      sparks.push({ x: x, y: y, vx: Math.cos(a) * (180 + i * 22), vy: Math.sin(a) * (180 + i * 22), t: 0 });
    }
    if (sparks.length > 48) sparks.splice(0, sparks.length - 48);
  }
  function drawSwing(sw) {
    var p = Math.min(1, sw.t / sw.dur), SPAN = 1.15, R = MELEE_R * 0.9;
    var lead = sw.ang - SPAN + 2 * SPAN * Math.min(1, p * 1.6);
    var fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
    var op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    var LAY = [['30,70,255', 16, 0.35], ['64,224,255', 9, 0.6], ['255,255,255', 3, 0.95]];
    for (var s = 7; s >= 0; s--) {
      var a1 = lead - s * 0.16, a0 = Math.max(sw.ang - SPAN, a1 - 0.5);
      if (a1 <= a0) continue;
      var k = fade * (1 - s / 8);
      for (var l = 0; l < LAY.length; l++) {
        ctx.strokeStyle = 'rgba(' + LAY[l][0] + ',' + (LAY[l][2] * k).toFixed(2) + ')';
        ctx.lineWidth = LAY[l][1] * (s === 0 ? 1 : 0.7);
        ctx.beginPath(); ctx.arc(sw.x, sw.y, R - s * 1.5, a0, a1); ctx.stroke();
      }
    }
    ctx.lineCap = 'butt'; ctx.lineWidth = 1;
    ctx.globalCompositeOperation = op;
  }
  function drawSparks(dt) {
    ctx.strokeStyle = '#C8F6FF'; ctx.lineWidth = 2;
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.86; s.vy *= 0.86;
      if (s.t > 0.22) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - s.t / 0.22;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }

  /* Brimstone, hers: a dark core and a smoke trail behind the big ones */
  function smoke(b) {
    if (b.k !== 2 && b.k !== 3 && b.k !== 5) return;
    var sp = Math.hypot(b.vx, b.vy);
    if (sp < 1) return;
    var ux = b.vx / sp, uy = b.vy / sp;
    for (var i = 1; i <= 4; i++) {
      ctx.fillStyle = 'rgba(30,6,8,' + (0.32 - i * 0.06).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(b.x - ux * i * b.r * 0.9, b.y - uy * i * b.r * 0.9, b.r * (0.8 + i * 0.15), 0, Math.PI * 2); ctx.fill();
    }
  }

  /* Calamitous Rend's view split: the frame is cut along the rift and
     the halves slide apart 8 px for its first 0.15 s, closing by 0.25 s.
     Off under reduced motion (the rift's glow still fades in and out). */
  function splitOffset(age, reduced) {
    if (reduced || age < 0 || age >= 0.25) return 0;
    return age < 0.15 ? 8 : 8 * (0.25 - age) / 0.1;
  }
  var splitBuf = null;
  function splitView(r, off) {
    if (!splitBuf) splitBuf = document.createElement('canvas');
    if (splitBuf.width !== cv.width || splitBuf.height !== cv.height) {
      splitBuf.width = cv.width; splitBuf.height = cv.height;
    }
    var b = splitBuf.getContext && splitBuf.getContext('2d');
    if (!b) return;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, splitBuf.width, splitBuf.height);
    b.drawImage(cv, 0, 0);
    var ca = Math.cos(r.ang), sa = Math.sin(r.ang), nx = -sa, ny = ca, L = (VW + VH) * 2;
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, VW, VH);
    for (var side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(r.cx - ca * L, r.cy - sa * L);
      ctx.lineTo(r.cx + ca * L, r.cy + sa * L);
      ctx.lineTo(r.cx + ca * L + nx * L * side, r.cy + sa * L + ny * L * side);
      ctx.lineTo(r.cx - ca * L + nx * L * side, r.cy - sa * L + ny * L * side);
      ctx.closePath(); ctx.clip();
      ctx.drawImage(splitBuf, 0, 0, splitBuf.width, splitBuf.height, nx * off * side, ny * off * side, VW, VH);
      ctx.restore();
    }
    /* the seam itself, white-hot */
    var op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,90,40,0.6)'; ctx.lineWidth = off * 2 + 6;
    ctx.beginPath(); ctx.moveTo(r.cx - ca * L, r.cy - sa * L); ctx.lineTo(r.cx + ca * L, r.cy + sa * L); ctx.stroke();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(2, off);
    ctx.stroke();
    ctx.globalCompositeOperation = op; ctx.lineWidth = 1;
  }

  /* Desperation (A1's stage chain): each stage tightens the vignette,
     shifts the field toward brimstone, thickens the storm behind the
     arena and lights her up in flame. */
  var DESP = ['lightning', 'rend', 'gravity', 'final'];
  function despLevel() {
    var s = NEU.scalAtk && NEU.scalAtk.stage ? NEU.scalAtk.stage() : '';
    return s ? DESP.indexOf(s) + 1 : 0;
  }
  function drawStorm(w, h, lv) {
    /* streaks of brimstone rain outside the arena, falling at a slant */
    var n = 18 + lv * 10, op = ctx.globalCompositeOperation, still = rm();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,70,30,' + (0.12 + lv * 0.05).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var sx = ((i * 0.6180339) % 1) * (w + 200) - 100;
      var sy = (((i * 0.4142) % 1) * h + (still ? 0 : t * (260 + (i % 4) * 60))) % (h + 80) - 40;
      ctx.moveTo(sx, sy); ctx.lineTo(sx - 14, sy + 34);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = op; ctx.lineWidth = 1;
  }
  function drawVignette(w, h, lv) {
    var r0 = Math.max(w, h) * (0.62 - lv * 0.07);
    var g = ctx.createRadialGradient(w / 2, h / 2, r0 * 0.45, w / 2, h / 2, r0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,0,2,' + (0.45 + lv * 0.1).toFixed(2) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function drawAura(lv) {
    if (!dm.glow) return;
    var p = rm() ? 0 : Math.sin(t * 5.1) * 0.5 + 0.5;
    dm.glow(ctx, bx, by, 70 + lv * 12, '#FF3A1A', 0.45 + 0.1 * lv);
    dm.glow(ctx, bx, by - 20, 44 + 8 * p, '#FFB040', 0.3 + 0.08 * lv);
    /* flame tongues: six rising teardrops round her, slow under rm */
    ctx.fillStyle = 'rgba(255,120,40,' + (0.35 + 0.08 * lv).toFixed(2) + ')';
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3 + (rm() ? 0 : t * 0.8);
      var fx = bx + Math.cos(a) * 46, fy = by + Math.sin(a) * 52 - (((rm() ? 0 : t * 60) + i * 13) % 26);
      ctx.beginPath(); ctx.moveTo(fx - 5, fy + 8); ctx.lineTo(fx, fy - 12 - lv * 2); ctx.lineTo(fx + 5, fy + 8); ctx.closePath(); ctx.fill();
    }
  }

  /* The view scale (V). The fight is laid out in logical px (VW x VH)
     and drawn VS times larger. VS is the largest quarter step in DEVICE
     px that still fits the 700x460 arena plus its HUD (860x660), so
     ctrl- does not shrink the fight and ctrl+ never clips it: when even
     1x does not fit, VS stays 1 and dm.arena shrinks the arena as it
     always did. Pixel art is drawn with smoothing off, so a quarter
     step only ever doubles a pixel column now and then. */
  var VS = 1, VW = 800, VH = 600, NEED_W = 860, NEED_H = 660;
  function scaleFor(vw, vh, dpr) {
    var d = Math.min(dpr || 1, 2), raw = Math.min(vw / NEED_W, vh / NEED_H);
    if (raw <= 1) return 1;
    return Math.max(1, Math.floor(raw * d * 4) / 4 / d);
  }
  var dprMq = null;
  function watchDpr() {
    /* a zoom or a monitor move changes devicePixelRatio, sometimes with
       no resize; one resolution query per ratio, swapped on each change */
    if (!window.matchMedia) return;
    if (dprMq && dprMq.removeEventListener) dprMq.removeEventListener('change', onDpr);
    dprMq = matchMedia('(resolution: ' + (devicePixelRatio || 1) + 'dppx)');
    if (dprMq && dprMq.addEventListener) dprMq.addEventListener('change', onDpr);
  }
  function onDpr() { watchDpr(); if (running) layout(); }
  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    VS = scaleFor(innerWidth, innerHeight, devicePixelRatio || 1);
    VW = innerWidth / VS; VH = innerHeight / VS;
    cv.width = (innerWidth * dpr) | 0; cv.height = (innerHeight * dpr) | 0;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr * VS, 0, 0, dpr * VS, 0, 0);
    ctx.imageSmoothingEnabled = false;
    var ar = dm.arena ? dm.arena(VW, VH, 700, 460, 24) : null;
    if (ar) {
      AW = ar.AW; AH = ar.AH; AX = ar.AX; AY = ar.AY;
    } else {
      AW = Math.min(700, VW - 60);
      AH = Math.min(460, VH - 190);
      AX = ((VW - AW) / 2) | 0;
      AY = ((VH - AH) / 2 + 24) | 0;
    }
    px = Math.min(Math.max(px, AX + 12), AX + AW - 12);
    py = Math.min(Math.max(py, AY + 12), AY + AH - 12);
    /* keep the worm's arena in step with resizes */
    if (NEU.scalWorm && scalWormReady) NEU.scalWorm.setArena(AX, AY, AW, AH);
    if (NEU.scalSeekers && seekersReady) NEU.scalSeekers.setArena(AX, AY, AW, AH);
  }
  addEventListener('resize', function () { if (running) layout(); });
  watchDpr();

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
    var r = k === 2 ? HB.gigablast : k === 1 ? HB.fireblast : (k === 3 || k === 5) ? HB.hellblast : HB.dart;
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
    /* dev `skip` to a phase: start in it, not four transitions short of it
       (and not behind the opening worm either) */
    if (skipFrac && NEU.scalAtk.setLevel) {
      clearSpecials();
      NEU.scalAtk.setLevel(NEU.scalAtk.levelFor(skipFrac));
    }
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
        /* Eighteen HP: three melee slashes (6 each), which is the 3
           bolts the heart pool was sized for. One-shot hearts ended the
           phase before a single lap of the Sepulcher's script finished. */
        hp: 18,
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
  /* 90 HP each (SCal rework; was 8). The volley clock and the step count. */
  var broT = 0, broStep = 0;
  /* the dev `skip` share this fight opened at (0 = a normal fight) */
  var skipFrac = 0;
  function startBrothers() {
    mode = 'brothers'; invuln = true; bullets = [];
    clearSched();
    bros = [
      { side: -1, x: broX('slash', -1), y: AY + AH / 2, hp: 90, t: 0, kind: 'slash', n: 0, dash: 0, dashTo: 0, enraged: false },
      { side:  1, x: broX('fist', 1), y: AY + AH / 2, hp: 90, t: 0, kind: 'fist', n: 0, dash: 0, dashTo: 0, enraged: false }
    ];
    broT = 1.0; broStep = 0;
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
    /* The C strip slows the whole fight to a fifth. Cooldowns below run
       on this same scaled clock, so HEAL's 30 s is fight time. */
    if (stripOpen) dt *= STRIP_SCALE;
    t += dt;
    driftEmbers(dt);
    if (meleeCd > 0) meleeCd -= dt;
    if (shotCd > 0) shotCd -= dt;
    if (healCd > 0) {
      healCd -= dt;
      if (healCd <= 0) { healCd = 0; healToast = 1.6; if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick(); }
    }
    if (healToast > 0) healToast -= dt;
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
    /* the barrier is up until it takes a hit; the 30 s is a backstop */
    if (shieldT > 0) shieldT -= dt;
    /* Z held counts toward the fireball's hold (FIRE_HOLD); the release
       in keyup decides slash or fireball. */
    if (charging) chargeF += dt;
    /* null: her rage is her own, the shared bar stays out of it */
    dm.tick(F, dt, null);
    /* The sweep. Six per second converges in about half a second —
       fast enough to feel responsive, slow enough to read as charging. */
    var ease = Math.min(1, dt * 6);
    rageShown += (rage - rageShown) * ease;
    tpShown   += (tp   - tpShown)   * ease;

    /* the C strip holds the soul still: arrows drive the menu instead */
    if (mode !== 'intro' && mode !== 'won' && !stripOpen) {
      var ox = px, oy = py;
      movePlayer(dt);
      if (dt > 0) { pvx = (px - ox) / dt; pvy = (py - oy) / dt; }
    }
    if (inv > 0) inv -= dt;

    if (mode === 'intro') { if (t > 2.6) startLead(); }
    else if (mode === 'wall') NEU.scalAtk.tick(dt);
    else if (mode === 'brothers') brothersTick(dt);
    else if (mode === 'fight') fightTick(dt);

    moveBullets(dt * dm.slow(F));
    moveMyShots(dt);
  }

  /* Blue soul is gravity: dm.move runs it when F.mode is 'blue', with
     the optional platforms a pattern sets on NEU.scalSoul. */
  function movePlayer(dt) {
    F.x = px; F.y = py;
    dm.move(F, keys, dt, { AX: AX, AY: AY, AW: AW, AH: AH }, NEU.scalSoul.platforms);
    px = F.x; py = F.y;
  }

  /* One frame of the fight proper. The seekers' ring holds the attack clock;
     the Sepulcher does not: she orbits the soul while the worm is up, so the
     clock runs and her worm attack (scal-attacks.js) steps with it. */
  function fightTick(dt) {
    if (ringOn && NEU.scalSeekers) {
      /* She holds still; the ring is the attack. Both callbacks are the same
         ones the worm uses, so a graze and a hit take the same paths. */
      NEU.scalSeekers.setPlayer(px, py, pvx, pvy);
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
    }
    /* the attack clock runs in every state that is not a body's own (the
       ring above). The worm's attack is the one stepping here while sep is up. */
    NEU.scalAtk.tick(dt);
  }

  /* ── the brothers' patterns ──────────────────────────────────────────
     Cataclysm is the fist (the brawler) and Catastrophe the slash (the
     blade). Each takes its three patterns in turn. The volleys alternate
     between them, and every third volley both fire together: a pincer from
     the two walls. */
  var BRO_PATS = { fist: ['pound', 'rocket', 'uppercut'], slash: ['crescent', 'dash', 'ring'] };
  function ringBurst(x, y, n, sp, a0) {
    for (var i = 0; i < n; i++) {
      var a = a0 + i * Math.PI * 2 / n;
      spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0);
    }
  }
  /* the crescent turns back once, from where its fuse ended */
  function boomerang(b) { spawn(b.x, b.y, -b.vx * 0.9, -b.vy * 0.9, 0, { fuse: 0.8 }); }
  function broAttack(b, pat) {
    var a = Math.atan2(py - b.y, px - b.x), i, k, q, gx;
    if (pat === 'pound') {
      /* ground pound: a ring of darts, then a slower one behind it */
      ringBurst(b.x, b.y, 14, 220, 0);
      later(function () { ringBurst(b.x, b.y, 8, 130, Math.PI / 8); }, 400);
    } else if (pat === 'rocket') {
      /* rocket fist: one fast bolt that bounces off the arena walls */
      spawn(b.x, b.y, Math.cos(a) * 340, Math.sin(a) * 340, 0, { bounce: 3, fuse: 6 });
    } else if (pat === 'uppercut') {
      /* flame pillars: a column of darts rising where the soul is going */
      gx = px + pvx * 0.5;
      for (i = 0; i < 5; i++) spawn(gx, AY + AH - 10 - i * 36, 0, -120, 0, { fuse: 1.1 });
    } else if (pat === 'crescent') {
      /* crescent wave: seven slashes in an arc; each comes back once */
      for (k = -3; k <= 3; k++)
        spawn(b.x, b.y, Math.cos(a + k * 0.14) * 260, Math.sin(a + k * 0.14) * 260, 0,
              { fuse: 0.8, onEnd: boomerang });
    } else if (pat === 'dash') {
      /* blade dash across to the far wall; then a cross-cut of darts along
         the soul's row, with a gap where the soul was */
      b.dashTo = broX(b.kind, b.x < AX + AW / 2 ? 1 : -1);
      b.dash = 0.35;
      gx = px; q = py;
      later(function () {
        for (var x = AX + 10; x < AX + AW - 10; x += 26)
          if (Math.abs(x - gx) > 40) spawn(x, q, 0, 0, 0, { fuse: 0.7 });
      }, 450);
    } else if (pat === 'ring') {
      /* spinning swords: ten on a circle about the brother, closing in over 2.6 s */
      for (i = 0; i < 10; i++) {
        q = i * Math.PI * 2 / 10;
        spawn(b.x + Math.cos(q) * 150, b.y + Math.sin(q) * 150, 0, 0, 0,
              { fuse: 2.6, orb: { cx: b.x, cy: b.y, a0: q, r0: 150, r1: 30, w: 2.2, T: 2.6 } });
      }
    }
  }
  function brothersTick(dt) {
    var i, b;
    /* the hover bob, and the blade's dash toward the far wall */
    for (i = 0; i < bros.length; i++) {
      b = bros[i];
      b.y += Math.sin(t * 1.6 + i) * 22 * dt;
      if (b.dash > 0) { b.dash -= dt; b.x += (b.dashTo - b.x) * Math.min(1, dt * 8); }
    }
    /* the volleys: one brother a turn every 1.1 s (0.7 s for a survivor, who
       also has the whole clock), and every third volley both at once */
    broT -= dt;
    if (broT <= 0 && bros.length) {
      broT = bros.length === 1 ? 0.7 : 1.1;
      broStep++;
      if (bros.length === 2 && broStep % 3 === 0) {
        for (i = 0; i < 2; i++) broAttack(bros[i], bros[i].kind === 'fist' ? 'rocket' : 'crescent');
      } else {
        b = bros[broStep % bros.length];
        broAttack(b, BRO_PATS[b.kind][b.n++ % 3]);
      }
    }

    /* Remove dead brothers */
    for (i = bros.length - 1; i >= 0; i--) {
      if (bros[i].hp <= 0) {
        var dead = bros.splice(i, 1)[0];
        if (NEU.juice) NEU.juice.burst(dead.x, dead.y, 15, dead.kind === 'fist' ? COL.brimHi : COL.brim, 1.5);
        /* Survivor enrages */
        if (bros.length === 1) {
          bros[0].enraged = true;
          say(dead.kind === 'fist' ? "* the brawler falls. the blade rages." : "* the blade falls. the brawler rages.");
        }
      }
    }

    if (!bros.length) {
      phase = 2; mode = 'fight'; invuln = false;
      if (NEU.sfx && NEU.sfx.stinger) NEU.sfx.stinger(2);
      say("* she laughs. that is the first noise she has made.");
      later(function () { if (running) say("* now she is trying."); }, 2200);
    }
  }

  /* One damage source for bullets and contact alike. A standing
     barrier eats the hit instead of you — one hit, then it is gone,
     and it does not hand you invulnerability for free. */
  function hitPlayer() {
    if (god || (NEU.cheat && NEU.cheat.god) || F.dashI > 0) return false;   /* a dash passes through; dev `god` (dev.js) */
    if (shieldT > 0) {
      shieldT = 0;
      inv = IFRAMES;
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(px, py, 12, '#B8E6FF'); }
      return false;
    }
    inv = IFRAMES;
    hp--;
    dm.hurt(F, px, py - 12);
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    /* Taking a hit is a MEDIUM event. The player needs to feel it
       without the screen becoming unreadable mid-pattern. */
    if (NEU.juice) { NEU.juice.hit('medium'); NEU.juice.burst(px, py, 10, COL.soul); }
    if (hp <= 0) { startDeath(); return true; }
    return false;
  }

  /* One funnel for every TP gain, so the caps and the MAX state agree. */
  function addTp(v) { tp = Math.min(1, tp + v); }
  /* A new graze: the outline flash (never faster than 3 Hz), a tick,
     and the point for the view to draw. */
  function grazeFlash(x, y) {
    if (t - grazeAt < 0.34) return;
    grazeAt = t;
    F.grazeFlashT = 0.12;
    F.grazes.push({ x: x, y: y, t: t });
    if (F.grazes.length > 12) F.grazes.shift();
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
  }

  /* Bullets move, graze and hit. A bullet with a fuse ends when the fuse runs
     out, or at once when a proximity fuse reaches the soul. Its onEnd runs
     after the list is rebuilt, so the ring it drops is not lost. */
  function moveBullets(dt) {
    var keep = [], fire = [];
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
      if (b.orb) {
        /* a spinning sword: on a circle about its brother, its radius
           closing from r0 to r1 over its fuse (the Catastrophe ring) */
        var ou = Math.min(1, b.age / b.orb.T), oa = b.orb.a0 + b.orb.w * b.age;
        var orr = b.orb.r0 + (b.orb.r1 - b.orb.r0) * ou;
        b.x = b.orb.cx + Math.cos(oa) * orr; b.y = b.orb.cy + Math.sin(oa) * orr;
      } else { b.x += b.vx * dt; b.y += b.vy * dt; }
      /* a bouncing bolt (the Cataclysm rocket) turns off each wall it meets,
         for as many bounces as it has */
      if (b.bounce > 0 && (b.x < AX || b.x > AX + AW || b.y < AY || b.y > AY + AH)) {
        if (b.x < AX || b.x > AX + AW) { b.vx = -b.vx; b.x = Math.min(AX + AW, Math.max(AX, b.x)); }
        if (b.y < AY || b.y > AY + AH) { b.vy = -b.vy; b.y = Math.min(AY + AH, Math.max(AY, b.y)); }
        b.bounce--;
      }
      if (b.x < AX - 60 || b.x > AX + AW + 60 || b.y < AY - 60 || b.y > AY + AH + 60) continue;
      keep.push(b);
      if (inv <= 0 && mode !== 'won') {
        var dx = b.x - px, dy = b.y - py, rr = b.r + PLAYER_R;
        /* Graze region: the bullet's edge within 8 px of the soul's
           contact distance. The first entry pays GRAZE_PTS once per
           bullet (b.grazed is the per-bullet cooldown); staying in the
           region pays the per-second trickle every frame. */
        var gz = rr + GRAZE_PAD;
        if (dx * dx + dy * dy < gz * gz) {
          if (!b.grazed) { b.grazed = true; addTp(GRAZE_PTS); grazeFlash(b.x, b.y); }
          addTp(GRAZE_PTS * dt);
        }
        if (dx * dx + dy * dy < rr * rr && hitPlayer()) return;
      }
    }
    /* Body grazes latched during fightTick: continued trickle only. */
    if (grazedByBody) addTp(GRAZE_PTS * dt);
    grazedByBody = false;
    bullets = keep;
    for (var f = 0; f < fire.length; f++) fire[f].onEnd(fire[f]);
  }

  /* ── hitting her ────────────────────────────────────────────────
     Two strikes, both on Z. A tap (released before FIRE_HOLD) is the
     melee slash: 6 damage, reach MELEE_R toward the nearest target.
     Holding Z to FIRE_HOLD and releasing throws a fireball: 1.5 damage,
     homing, FIRE_CD cooldown. Brimstone Buster is in the C strip. */

  function startCharge() {
    if (charging || dying || mode === 'intro' || mode === 'won') return;
    charging = true; chargeF = 0;
  }

  /* Z released: a slash if it was a tap, a fireball if it was held. */
  function release() {
    if (!charging) return;
    charging = false;
    var held = chargeF;
    chargeF = 0;
    if (held < FIRE_HOLD) melee(); else fireball();
  }

  /* Target selection mirrors the old tryHit branch order exactly:
     the ring while it stands, hearts while the sepulcher stands, then
     the brothers, then her. */
  function resolveTarget() {
    var best = null, bd = Infinity;
    function pick(kind, ref, x, y, r) {
      var d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = { kind: kind, ref: ref, x: x, y: y, r: r }; }
    }
    if (ringOn && NEU.scalSeekers && NEU.scalSeekers.alive()) {
      var ss = NEU.scalSeekers.seekers();
      for (var s = 0; s < ss.length; s++) pick('seeker', ss[s], ss[s].x, ss[s].y, 12);
      if (best) return best;
    }
    if (sep && hearts.length) {
      for (var i = 0; i < hearts.length; i++) pick('heart', hearts[i], hearts[i].x, hearts[i].y, 18);
      if (best) return best;
    }
    if (mode === 'brothers' && bros.length) {
      for (var j = 0; j < bros.length; j++) pick('bro', bros[j], bros[j].x, bros[j].y, HB.broReach);
      return best;
    }
    if (mode === 'fight' && !invuln) return { kind: 'her', ref: null, x: bx, y: by, r: 40 };
    return null;
  }

  function facingAng() { return (F.fx || F.fy) ? Math.atan2(F.fy, F.fx) : -Math.PI / 2; }

  /* The slash. Reach is MELEE_R from the soul to the target's edge; the
     arc is drawn toward the nearest target, or where you face. A landed
     slash gives +1 % TP. Cooldown MELEE_CD. */
  function melee() {
    if (meleeCd > 0 || dying || mode === 'intro' || mode === 'won') return;
    meleeCd = MELEE_CD;
    var tg = resolveTarget();
    var ang = tg ? Math.atan2(tg.y - py, tg.x - px) : facingAng();
    var sw = { x: px, y: py, ang: ang, t: 0, dur: 0.15, hit: false };
    F.swings.push(sw);
    var n0 = F.pops[F.pops.length - 1];   /* the newest pop before the hit */
    if (tg && Math.hypot(tg.x - px, tg.y - py) <= MELEE_R + tg.r &&
        damageTarget(tg.kind, tg.ref, MELEE_DMG)) {
      sw.hit = true;
      addTp(0.01);
      /* V: the true-melee feel. Sparks, a 3-frame hit-stop with a small
         shake leaning along the cut, and a big number (danmaku p.big). */
      slashSparks(tg.x, tg.y, ang);
      if (NEU.juice) NEU.juice.hit('medium', { shake: 0.16, dx: Math.cos(ang), dy: Math.sin(ang) });
      /* only a pop this hit pushed (a seeker hit pushes none) */
      /* a pop is new when the newest one is not the one we saw before (a full
         list shifts, so the length alone cannot tell) */
      var lp = F.pops[F.pops.length - 1];
      if (lp === n0) lp = null;
      if (lp) { lp.big = true; lp.c = '#E8FBFF'; }
    }
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
  }

  /* The fireball: a homing soul-fire shot. Cooldown FIRE_CD. */
  function fireball() {
    if (shotCd > 0 || dying || mode === 'intro' || mode === 'won') return;
    shotCd = FIRE_CD;
    var tg = resolveTarget();
    var ang = tg ? Math.atan2(tg.y - py, tg.x - px) : facingAng();
    myShots.push({ owner: 'soul', kind: 'fireball', x: px, y: py,
                   vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260,
                   r: 9, dmg: FIRE_DMG, age: 0, hitRefs: [] });
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
  }

  /* The buster: 40 damage, piercing, owner 'soul'. Called from the strip,
     which has already checked and paid for it. */
  function buster() {
    var tg = resolveTarget();
    var ang = tg ? Math.atan2(tg.y - py, tg.x - px) : facingAng();
    myShots.push({ owner: 'soul', kind: 'buster', x: px, y: py,
                   vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420,
                   r: 16, dmg: BUSTER_DMG, pierce: true, age: 0, hitRefs: [] });
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
  }

  function moveMyShots(dt) {
    for (var i = myShots.length - 1; i >= 0; i--) {
      var s = myShots[i];
      s.age += dt;
      var dead = s.age > 4;
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
      /* Collisions mirror the melee gating: whatever a slash can touch,
         a shot can reach. The ring first: while she is shielded behind
         the seekers, a shot that touches one takes it. A buster passes
         through, hitting each target once (hitRefs). Any other shot
         stops at the first target it hits. */
      if (!dead) {
        if (ringOn && NEU.scalSeekers) {
          if (NEU.scalSeekers.hit(s.x, s.y, s.r)) dead = true;
        } else if (sep) {
          for (var q = 0; q < hearts.length && !dead; q++) {
            if (s.hitRefs.indexOf(hearts[q]) >= 0) continue;
            if (Math.hypot(hearts[q].x - s.x, hearts[q].y - s.y) < 18 + s.r) {
              s.hitRefs.push(hearts[q]);
              damageTarget('heart', hearts[q], s.dmg);
              dead = !s.pierce;
            }
          }
        } else if (mode === 'brothers') {
          for (var w = 0; w < bros.length && !dead; w++) {
            if (s.hitRefs.indexOf(bros[w]) >= 0) continue;
            if (Math.hypot(bros[w].x - s.x, bros[w].y - s.y) < HB.broReach + s.r) {
              s.hitRefs.push(bros[w]);
              damageTarget('bro', bros[w], s.dmg);
              dead = !s.pierce;
            }
          }
        } else if (mode === 'fight' && !invuln && s.hitRefs.indexOf('her') < 0 &&
                   Math.hypot(bx - s.x, by - s.y) < 40 + s.r) {
          s.hitRefs.push('her');
          damageTarget('her', null, s.dmg);
          dead = !s.pierce;
        }
      }
      if (dead) { if (s.hitRefs.length || !s.pierce) shotRing(s.x, s.y, s.kind === 'buster'); myShots.splice(i, 1); }
    }
  }

  /* One damage funnel for all three target kinds. Her phase gates run
     from here: each HP share she crosses calls NEU.scalAtk.gate, which
     starts the transition (scal-attacks.js, GATE and AFTER_PT). */
  function damageTarget(kind, ref, amount) {
    /* Returns true when the strike landed (a melee's +1 % TP needs it). */
    /* dev `dmg` multiplier (dev.js); absent or 1 is the normal fight */
    var eff = amount * (rageMode ? 2 : 1) * ((NEU.cheat && NEU.cheat.dmgMul) || 1);
    if (kind === 'seeker') {
      if (!NEU.scalSeekers || !NEU.scalSeekers.hit(ref.x, ref.y, 0)) return false;
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(ref.x, ref.y, 4, COL.brimHi); }
      return true;
    }
    if (kind === 'heart') {
      var hi = hearts.indexOf(ref);
      if (hi < 0) return false;
      ref.hp -= eff;
      dm.pop(F, ref.x, ref.y, eff);
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(ref.x, ref.y, 4, COL.brimHi); }
      if (ref.hp > 0) return true;         /* cracked, not broken */
      var hx = ref.x, hy = ref.y;
      hearts.splice(hi, 1);
      if (NEU.juice) NEU.juice.burst(hx, hy, 8, COL.brimHi);
      return true;
    }
    if (kind === 'bro') {
      if (bros.indexOf(ref) < 0) return false;
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
      return true;
    }
    if (invuln || mode !== 'fight') return false;
    bossHP -= eff;
    dm.bossHit(F, bx, by, eff);
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    /* Landing one is SMALL — it happens often, and shaking hard on
       every strike would drown out the phase transitions. */
    if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(bx, by, 7, COL.brimHi); }
    bossHP = Math.max(0, bossHP);
    NEU.scalAtk.gate(bossHP / bossMax);
    return true;
  }

  function win() {
    mode = 'won'; running = false; bullets = []; stripOpen = false;
    /* the ring cannot outlive her: drop it so nothing ticks or draws
       into the victory lap */
    if (NEU.scalSeekers) NEU.scalSeekers.clear();
    ringOn = false;
    clearSched();
    if (NEU.juice) { NEU.juice.hit('huge', { colour: '#FF6B4A' });
                     NEU.juice.burst(bx, by, 60, COL.brim, 260); }
    if (NEU.save) { NEU.save.give('ashes'); NEU.save.flag('scal_dead', 1); }
    if (NEU.quest) { NEU.quest.mark('a4_scal'); NEU.quest.mark('a4_ashes'); }
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
    running = false; dying = performance.now(); stripOpen = false;
    clearSched();
    if (dm.resetDeath) dm.resetDeath();
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    requestAnimationFrame(deathStep);
  }

  function deathStep(now) {
    var ms = now - dying;
    ctx.fillStyle = COL.void_; ctx.fillRect(0, 0, VW, VH);
    frame();
    var playing = dm.death ? dm.death(ctx, px, py, ms, COL.soul) : (ms <= 1700);
    if (!playing) {
      dying = 0;
      if (msg) { msg.hidden = false;
        msg.innerHTML = '<b>she waits.</b><br>press Z to try again &middot; esc to leave'; }
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
    var w = VW, h = VH;
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
    var w = VW, h = VH;
    ctx.fillStyle = COL.void_; ctx.fillRect(0, 0, w, h);
    /* Everything between begin/end is shaken as one image. The draw
       code below has no idea it is happening, which is what keeps the
       shake off the simulation. */
    var shook = NEU.juice ? NEU.juice.begin(ctx, w, h) : false;
    var lv = despLevel();
    if (lv) drawStorm(w, h, lv);
    frame();
    if (lv) { ctx.fillStyle = 'rgba(120,18,0,' + (0.05 * lv).toFixed(2) + ')'; ctx.fillRect(AX, AY, AW, AH); }

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
      if (lv) drawAura(lv);
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
      smoke(b);
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
      drawSoulShot(myShots[ms]);    /* soul fire: never SCal's own sheets */
    }
    drawRings(lastDt);
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
    /* the brothers, BRO_H tall, aura, trail and the wind-up pose of
       the volley about to fire (broNext) */
    var poses = broNext() || [];
    for (var r = 0; r < bros.length; r++) {
      var pz = null;
      for (var pq = 0; pq < poses.length; pq++) if (poses[pq].b === bros[r]) pz = poses[pq];
      drawBro(bros[r], pz);
    }

    dm.drawFlash(ctx, F, bx, by, 64);
    if (mode !== 'won') dm.drawFX(ctx, F, inv);
    for (var sw = 0; sw < F.swings.length; sw++) drawSwing(F.swings[sw]);
    drawSparks(lastDt);

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

    /* the fireball's charge: a ring that closes as Z is held */
    if (charging && chargeF > 0.05) {
      var fr = Math.min(1, chargeF / FIRE_HOLD);
      ctx.strokeStyle = fr >= 1 ? '#E8FBFF' : '#7FE6FF'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fr);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    if (NEU.juice) NEU.juice.drawParts(ctx, 1 / 60);
    if (NEU.juice) NEU.juice.end(ctx, shook);
    var rift = NEU.scalAtk.rift ? NEU.scalAtk.rift() : null;
    var off = rift ? splitOffset(rift.t / 60, rm()) : 0;
    if (off > 0) splitView(rift, off);
    if (lv) drawVignette(w, h, lv);
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
                     tp: tpShown, rage: rageShown, rageOn: rageMode > 0, AX: AX });
    drawBroBars(w);
    if (stripOpen) drawStrip(ctx);
    if (healToast > 0) {
      ctx.font = FONT_UI; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#B8FFD0';
      ctx.fillText('HEAL READY', AX + AW / 2, AY - 56);
      ctx.textAlign = 'left';
    }

    var dialY = AY + AH + 80;
    /* the key hint (#bhMsg) sits on the same line; it steps aside while
       she is talking so the two never print over each other */
    var talking = !!(line && now - lineT < 5200);
    var kh = document.querySelector('#bh .bh__keys');
    if (kh && kh.__v !== talking) { kh.__v = talking; kh.style.visibility = talking ? 'hidden' : ''; }
    if (talking) {
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
  /* ── the C strip ───────────────────────────────────────────────
     Deltarune's TP menu. Time runs at STRIP_SCALE while it is open and
     the soul stands still. HEAL: +1 HP, no TP, 30 s of fight time
     between uses, and it stays on cooldown when the strip is reopened.
     BRIMSTONE BUSTER: 50 % TP for a 40-damage piercing shot. SOUL
     SHIELD: 32 % TP for a barrier that takes one hit. RAGE: free once
     the bar is full. Using any option closes the strip. There is no
     DEFEND: a free +16 % TP on a key press was the whole TP economy. */
  var FONT_UI = '16px "Determination Mono","Pixelify Sans",monospace';
  /* each row: its icon (7x7, '#' lit), its colour, whether it can be
     used now, the cost shown in TP orange when it can, and the reason
     shown in grey when it cannot. cost: the TP share it spends (for the
     gauge's preview). */
  var ICON = {
    heal:   ['..#..', '..#..', '#####', '..#..', '..#..'],
    buster: ['..#....', '.##..#.', '.###.#.', '######.', '#######', '.#####.', '..###..'],
    shield: ['#######', '#######', '#######', '.#####.', '.#####.', '..###..', '...#...'],
    rage:   ['...##..', '..##...', '.#####.', '...##..', '..##...', '.##....', '##.....']
  };
  var STRIP = [
    { name: 'HEAL', icon: 'heal', col: '#5CF08C', cost: 0,
      ok: function () { return hp < MAXHP && healCd <= 0; },
      tag: function () { return 'FREE'; },
      why: function () { return healCd > 0 ? 'WAIT ' + Math.ceil(healCd) + 's' : 'HP FULL'; } },
    { name: 'BRIMSTONE BUSTER', icon: 'buster', col: '#FF6A2A', cost: 0.5,
      ok: function () { return tp >= 0.5; },
      tag: function () { return '50% TP'; },
      why: function () { return 'NEED 50%'; } },
    { name: 'SOUL SHIELD', icon: 'shield', col: '#8FD8FF', cost: 0.32,
      ok: function () { return tp >= 0.32 && shieldT <= 0; },
      tag: function () { return '32% TP'; },
      why: function () { return shieldT > 0 ? 'ALREADY UP' : 'NEED 32%'; } },
    { name: 'RAGE', icon: 'rage', col: '#E4C46A', cost: 0,
      ok: function () { return rage >= 1 && rageMode === 0; },
      tag: function () { return 'FREE'; },
      why: function () { return rageMode ? 'BURNING' : Math.floor(rage * 100) + '% FULL'; } }
  ];
  function arrowName(e) {
    var k = e.key;
    if (k === 'ArrowLeft') return 'left';
    if (k === 'ArrowRight') return 'right';
    if (k === 'ArrowUp') return 'up';
    if (k === 'ArrowDown') return 'down';
    return null;
  }
  function useStrip(i) {
    var o = STRIP[i];
    if (!o.ok()) {
      say(i === 0 && hp >= MAXHP ? '* you are already whole.' : '* not now.');
      stripShake = performance.now();
      return;
    }
    if (i === 0) {
      hp += 1; healCd = HEAL_CD;
      if (NEU.juice) NEU.juice.burst(px, py, 10, '#B8FFD0');
      say('* a little warmth. one heart back.');
    } else if (i === 1) {
      tp = Math.max(0, tp - 0.5); buster();
      say('* brimstone, from your own soul.');
    } else if (i === 2) {
      tp = Math.max(0, tp - 0.32); shieldT = 30;
      say('* the barrier blooms. it will take one hit.');
    } else {
      rage = 0; rageMode = 1; rageModeT = 8;
      sfxPlay('giga-hit');
      if (NEU.juice) NEU.juice.burst(px, py, 14, '#E4C46A', 1.2);
      say('* rage. everything strikes twice.');
    }
    stripOpen = false;
  }
  var stripShake = -1e9;
  function stripKey(e) {
    var k = e.key;
    if (k === 'ArrowUp' || k === 'ArrowLeft') stripSel = (stripSel + STRIP.length - 1) % STRIP.length;
    else if (k === 'ArrowDown' || k === 'ArrowRight') stripSel = (stripSel + 1) % STRIP.length;
    else if (k === 'z' || k === 'Z' || k === 'Enter') { useStrip(stripSel); return; }
    else if (k === 'x' || k === 'X' || k === 'c' || k === 'C') { stripOpen = false; return; }
    else return;
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
  }
  /* Deltarune's battle menu, in her colours. A black panel with a double
     rim (white outside, brimstone inside), a tab with the title, one row
     per action: its icon, its name, the TP cost right-aligned in orange,
     or, greyed, why it cannot be used. The selected row carries a stepped
     brimstone highlight and the soul as the cursor, bobbing. Under the
     rows: HP, and a segmented TP gauge that previews what the selected
     action would spend. It drops in with a small overshoot. */
  function drawStrip(ctx) {
    var now = performance.now(), u = Math.min(1, (now - stripAt) / 140);
    var ease = 1 + 0.12 * Math.sin(u * Math.PI) * (1 - u);       /* overshoot, then rest */
    var reduce = !!(NEU.juice && NEU.juice.reduced);
    var i, o, y, can, sel;
    ctx.fillStyle = 'rgba(4,0,2,' + (0.62 * u).toFixed(2) + ')'; ctx.fillRect(AX, AY, AW, AH);
    var rowH = 40, bw = Math.min(AW - 48, 464) | 0, bh = rowH * STRIP.length + 132;
    var bx = (AX + (AW - bw) / 2) | 0;
    var by = (AY + Math.max(40, (AH - bh) / 2) - (reduce ? 0 : (1 - u) * 24)) | 0;
    var shake = now - stripShake < 180 && !reduce ? Math.round(Math.sin((now - stripShake) * 0.12) * 4) : 0;
    bx += shake;
    ctx.save();
    if (!reduce && ease !== 1) {
      ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(ease, ease); ctx.translate(-(bx + bw / 2), -(by + bh / 2));
    }
    /* drop shadow, panel, double rim */
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx + 6, by + 6, bw, bh);
    ctx.fillStyle = '#050104'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(bx, by, bw, 3); ctx.fillRect(bx, by + bh - 3, bw, 3);
    ctx.fillRect(bx, by, 3, bh); ctx.fillRect(bx + bw - 3, by, 3, bh);
    ctx.fillStyle = '#8C1A22';
    ctx.fillRect(bx + 6, by + 6, bw - 12, 2); ctx.fillRect(bx + 6, by + bh - 8, bw - 12, 2);
    ctx.fillRect(bx + 6, by + 6, 2, bh - 12); ctx.fillRect(bx + bw - 8, by + 6, 2, bh - 12);
    /* corner studs */
    ctx.fillStyle = '#FF9E30';
    ctx.fillRect(bx + 6, by + 6, 4, 4); ctx.fillRect(bx + bw - 10, by + 6, 4, 4);
    ctx.fillRect(bx + 6, by + bh - 10, 4, 4); ctx.fillRect(bx + bw - 10, by + bh - 10, 4, 4);
    /* the title tab, sat on the top rim */
    ctx.font = FONT_UI; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    var title = 'TP  ACTIONS', tw = (ctx.measureText ? ctx.measureText(title).width : 120) + 24 | 0;
    ctx.fillStyle = '#050104'; ctx.fillRect(bx + 20, by - 12, tw, 24);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(bx + 20, by - 12, tw, 2); ctx.fillRect(bx + 20, by - 12, 2, 14); ctx.fillRect(bx + 18 + tw, by - 12, 2, 14);
    ctx.fillStyle = '#FF9E30'; ctx.fillText(title, bx + 32, by - 8);
    for (i = 0; i < STRIP.length; i++) {
      o = STRIP[i]; y = by + 28 + i * rowH; can = o.ok(); sel = i === stripSel;
      if (sel) {
        /* a stepped highlight: three bands, hot at the cursor end */
        ctx.fillStyle = 'rgba(192,20,10,0.42)'; ctx.fillRect(bx + 12, y - 4, (bw - 24) * 0.34 | 0, 32);
        ctx.fillStyle = 'rgba(192,20,10,0.24)'; ctx.fillRect(bx + 12 + ((bw - 24) * 0.34 | 0), y - 4, (bw - 24) * 0.33 | 0, 32);
        ctx.fillStyle = 'rgba(192,20,10,0.12)'; ctx.fillRect(bx + 12 + ((bw - 24) * 0.67 | 0), y - 4, (bw - 24) * 0.33 | 0, 32);
        ctx.fillStyle = can ? '#FF3A1A' : '#5A5668'; ctx.fillRect(bx + 12, y - 4, 2, 32);
        var bob = reduce ? 0 : Math.round(Math.sin(now * 0.008) * 2);
        stamp(['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
              bx + 28 + bob, y + 12, 2, COL.soul);
      }
      /* the icon in a small socket */
      ctx.fillStyle = can ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
      ctx.fillRect(bx + 46, y - 1, 22, 22);
      stamp(ICON[o.icon], bx + 57, y + 10, 2, can ? o.col : '#3E3A48');
      ctx.fillStyle = can ? (sel ? '#FFFF00' : '#FFFFFF') : '#5A5668';
      ctx.fillText(o.name, bx + 80, y + 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = can ? '#FF9E30' : '#6A6480';
      ctx.fillText(can ? o.tag() : o.why(), bx + bw - 24, y + 2);
      ctx.textAlign = 'left';
      if (i === 0 && healCd > 0) {
        ctx.fillStyle = '#1A3A24'; ctx.fillRect(bx + 80, y + 21, 128, 3);
        ctx.fillStyle = '#5CF08C'; ctx.fillRect(bx + 80, y + 21, Math.round(128 * (1 - healCd / HEAL_CD)), 3);
      }
    }
    /* divider */
    var fy = by + 28 + STRIP.length * rowH + 4;
    ctx.fillStyle = '#3A1016'; ctx.fillRect(bx + 16, fy, bw - 32, 2);
    /* HP as hearts, TP as a number, then the gauge across the panel */
    ctx.fillStyle = '#C0BCC8'; ctx.fillText('HP', bx + 24, fy + 14);
    for (i = 0; i < MAXHP; i++) {
      stamp(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
            bx + 66 + i * 16, fy + 22, 2, i < hp ? COL.soul : '#2A1A20');
    }
    ctx.textAlign = 'right'; ctx.fillStyle = '#FF9E30';
    ctx.fillText('TP ' + (tp >= 1 ? 'MAX' : Math.floor(tp * 100) + '%'), bx + bw - 24, fy + 14);
    /* the TP gauge: cells across the panel, orange; the share the
       selected action would spend blinks pale over the top of the fill */
    var gx = bx + 24, gy = fy + 40, gw = bw - 48, cells = 25, cw = gw / cells, fill = tp * cells;
    var cost = STRIP[stripSel].ok() ? STRIP[stripSel].cost : 0;
    var blink = reduce ? 1 : (Math.floor(now / 260) % 2 ? 1 : 0.55);
    ctx.fillStyle = '#3A1016'; ctx.fillRect(gx - 2, gy - 2, gw + 2, 16);
    for (i = 0; i < cells; i++) {
      var cx0 = Math.round(gx + i * cw), cx1 = Math.round(gx + (i + 1) * cw) - 2;
      var on = i < Math.floor(fill + 1e-6), spend = cost > 0 && on && i >= Math.floor((tp - cost) * cells + 1e-6);
      ctx.fillStyle = '#1E0E06'; ctx.fillRect(cx0, gy, cx1 - cx0, 12);
      if (on) {
        ctx.fillStyle = spend ? 'rgba(255,240,208,' + blink + ')' : (tp >= 1 ? '#FFD040' : '#FF9E30');
        ctx.fillRect(cx0, gy, cx1 - cx0, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(cx0, gy, cx1 - cx0, 3);
        ctx.fillStyle = 'rgba(90,0,0,0.35)'; ctx.fillRect(cx0, gy + 9, cx1 - cx0, 3);
      }
    }
    ctx.textAlign = 'left'; ctx.fillStyle = COL.dim;
    ctx.fillText('z use  ·  x back', bx + 24, fy + 64);
    ctx.textAlign = 'right'; ctx.fillStyle = '#5A5668';
    ctx.fillText('graze bullets for TP', bx + bw - 24, fy + 64);
    ctx.textAlign = 'left';
    ctx.restore();
  }
  /* X: a dash along the held arrows, or the way you face. */
  function dashKey() {
    if (dying || mode === 'intro' || mode === 'won') return;
    var ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (ix || iy) dm.dash(F, ix, iy); else dm.dash(F);
  }

  /* The blue soul, for the attacks. setMode('blue') turns on gravity,
     Up jumps (letting go early cuts the jump), and platforms is an
     optional array of { x, y, w } the soul can land on. */
  NEU.scalSoul = {
    setMode: function (m) { dm.soulMode(F, m); },
    mode: function () { return F.mode; },
    platforms: null
  };

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
    if (!running && !dying && !e.repeat &&
        (e.key === 'z' || e.key === 'Z' || e.key === 'Enter')) {
      /* The document-level retry of the bullet minigame used to hear
         this too and restarted its own timer over the death screen. */
      e.preventDefault(); e.stopPropagation();
      open(); return;
    }
    if (!running || mode === 'intro') return;
    /* The C strip owns the keys while it is open. */
    if (stripOpen) { e.preventDefault(); stripKey(e); return; }
    var d = arrowName(e);
    if (d) { keys[d] = true; e.preventDefault(); return; }
    if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); if (!e.repeat) startCharge(); return; }
    if (e.key === 'x' || e.key === 'X') { e.preventDefault(); if (!e.repeat) dashKey(); return; }
    if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      if (!e.repeat && !dying) { stripOpen = true; stripSel = 0; stripAt = performance.now(); keys = {}; }
    }
  });
  addEventListener('keyup', function (e) {
    /* Same three-condition guard as keydown — the old one checked only
       wrap.hidden, so a release could fire while another minigame held
       the input lock. */
    if (wrap.hidden || !NEU.scal.active || NEU.activeMinigame !== 'scal') return;
    var d = arrowName(e); if (d) keys[d] = false;
    if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); release(); }
  });

  /* ── the attack machine's hands (scal-attacks.js) ─────────────────
     Everything she does reaches the fight through this object. The getters
     are live, so the machine reads this frame's positions every frame. */
  var ADAPT = {
    get px() { return px; }, get py() { return py; },
    get bx() { return bx; }, get by() { return by; },
    get pvx() { return pvx; }, get pvy() { return pvy; },
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
      /* large carries a 90 ms hit-stop and one 50 ms flash: the big beats only */
      if (s === 'medium') NEU.juice.hit('medium');
      else if (s === 'large') NEU.juice.hit('large');
      else NEU.juice.hit('small');
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
      keysEl.innerHTML = 'arrows move &middot; z slash (tap) / fireball (hold) &middot; x dash &middot; c menu &middot; esc to leave';
    }
    layout();
    t = 0; hp = MAXHP; inv = 0; bullets = []; keys = {}; booms = []; flashAt = -9;
    rage = 0; tp = 0; shieldT = 0;
    rageMode = 0; rageModeT = 0;
    rageShown = 0; tpShown = 0;
    stripOpen = false; stripSel = 0; healCd = 0; healToast = 0;
    meleeCd = 0; grazeAt = -9;
    myShots = []; charging = false; chargeF = 0; shotCd = 0;
    willCharge = false;
    /* 540: the rework's 720 cut by a quarter. The fight runs 4-5 minutes
       before desperation, with the attack pool, the bags and the combos
       filling it. Every phase gate in damageTarget is a FRACTION of bossMax,
       so they rescale for free, and core/music.js takes hpMax from the first
       reading per fight. */
    bossMax = 540; bossHP = bossMax; phase = 1; held = false; shotsFired = 0;
    pvx = 0; pvy = 0;
    /* dev `skip` to a phase (dev.js): start the boss at a share of its HP,
       once, so the next fight starts full again */
    skipFrac = 0;
    if (NEU.cheat && NEU.cheat.startFrac) {
      skipFrac = NEU.cheat.startFrac;
      bossHP = bossMax * skipFrac; NEU.cheat.startFrac = 0;
    }
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
    F = dm.fight(px, py, { dashCd: 0.8 });
    bx = AX + AW / 2; by = AY - 24;
    say('* the small one was not small.');
    running = true; last = performance.now();
    requestAnimationFrame(stepFn);
  }
  function close() {
    active = false; running = false; dying = 0; stripOpen = false;
    F.pops = [];
    var kh = document.querySelector('#bh .bh__keys');
    if (kh) { kh.__v = false; kh.style.visibility = ''; }
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
               get broHp() { return bros.map(function (b) { return b.hp; }); },
                get bullets() { return bullets.map(function (b) { return { x: b.x, y: b.y, vx: b.vx, vy: b.vy }; }); },
                get myShots() { return myShots.map(function (s) { return { x: s.x, y: s.y, vx: s.vx, vy: s.vy, owner: s.owner, kind: s.kind, dmg: s.dmg, pierce: !!s.pierce }; }); },
               /* A2 hooks: the strip, heal, the blue soul and the
                  melee arcs, for the tests and the view. */
               get stripOpen() { return stripOpen; },
               get stripSel() { return stripSel; },
               get healCd() { return healCd; },
               get meleeCd() { return meleeCd; },
               get swings() { return F.swings.map(function (s) { return { x: s.x, y: s.y, ang: s.ang, t: s.t, dur: s.dur, hit: s.hit }; }); },
               get grazes() { return F.grazes.slice(); },
               get soulY() { return py; },
               get floorY() { return AY + AH - 7; },
               /* test-only: place the soul and her, and make the fight
                  strikeable (mode 'fight', not invulnerable) */
               arm: function (sx, sy, bx2, by2) {
                 mode = 'fight'; invuln = false; sep = null; hearts = []; bros = []; ringOn = false;
                 px = sx; py = sy; bx = bx2; by = by2; F.x = px; F.y = py;
               },
               bossMax: function () { return bossMax; },
               /* test-only: one hit on the soul (the caller owns god) and
                  one stationary bullet at (x, y) */
               hurtSoul: function () { return hitPlayer(); },
               shotAt: function (x, y, r) { bullets.push({ x: x, y: y, vx: 0, vy: 0, r: r, c: COL.brim, k: 0, age: 0 }); },
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
                hurtBoss: function (n) { damageTarget('her', null, n); },
                /* test-only: put the soul where a test needs it */
                placeSoul: function (x, y) { px = x; py = y; },
                /* dev console (dev.js): set the soul's HP, its TP, or top it up */
                setHp: function (n) { hp = Math.max(0, Math.min(MAXHP, n | 0)); },
                setTp: function (n) { tp = Math.max(0, Math.min(100, +n || 0)) / 100; },
                heal: function () { hp = MAXHP; },
                /* V: test-only, one frame drawn now; the view scale */
                drawFrame: function () { draw(performance.now()); },
                scaleFor: scaleFor,
                splitOffset: splitOffset,
                get view() { return { s: VS, w: VW, h: VH }; },
                broDrawH: BRO_H,
                get broLabels() { return bros.map(function (b) { return BRO_NAME[b.kind]; }); } };
})();