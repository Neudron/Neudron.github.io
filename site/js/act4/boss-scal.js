/* boss-scal.js — Supreme Witch, Calamitas V4 Implementation
   Based on CalamityTeam/CalamityModPublic@fecf24ed source code
   AUTHENTIC BEHAVIOR FROM THE OFFICIAL MOD */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('bh');
  var cv   = document.getElementById('bhCanvas');
  if (!wrap || !cv) { NEU.scal = { open: function () {} }; return; }
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.scal = { open: function () {} }; return; }
  var msg = document.getElementById('bhMsg');

  var dm = NEU.danmaku || {};
  var COL = { bone: '#EDE7DE', soul: '#E23B55', dim: '#8A8598', void_: '#08080B',
              brim: '#FF4A2A', brimHi: '#FFC46A', dark: '#8C2F4A' };

  var PLAYER_R = (dm.soul && dm.soul.R) || 6, SPEED = dm.SPEED || 250,
      FOCUS = dm.FOCUS || 108, IFRAMES = dm.IFRAMES || 1.1;
  var MAXHP = 5;

  /* Her cycle. c = charge, m = melee dive, d = dart bursts,
     h = hellblast barrage, g2/g4 = two or four gigablasts. The
     charges keep their places (3, 7, 15, 17, 19 — indexed below)
     and two of the old charges became dives. */
  var CYCLE = ['d','h','g2','c','m','g2','h','d','c','d','h','g4','m','d','g4','c','d','c','d','c'];

  var running = false, last = 0, t = 0;
  var px = 0, py = 0, keys = {}, hp = MAXHP, inv = 0;
  /* U1/U2: your two resources. Rage builds while you are missing
     hearts and is SPENT by z — a full bar buys eight seconds of
     doubled strikes. TP builds by grazing bullets and spends itself
     as a barrier that takes one hit (x). Both are the fight rewarding
     you for doing what the fight already asked you to do. */
  var rage = 0, tp = 0, shieldT = 0;
  var rageMode = 0, rageModeT = 0;
  var diveT = 0, diveDir = 1, diveY = 0;
  var AX = 0, AY = 0, AW = 0, AH = 0;
  var bullets = [], step_ = 0, stepT = 0, phase = 1;
  var bossHP = 1, bossMax = 1, invuln = false;
  var mode = 'intro';        // intro | fight | wall | brothers | dead | won
  var wallT = 0, wallN = 0, walls = [];
  var hearts = [], sep = null, bros = [];
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
    var a = pool[sfxI++ % pool.length];
    try {
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function say(s) { line = s; lineT = performance.now(); }

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
  }
  addEventListener('resize', function () { if (running) layout(); });

  /* ── Spawn Sepulcher (worm) and 10 Brimstone Hearts ───────────────────────────────*/
  function spawnSepulcher() {
    mode = 'fight'; invuln = true;
    /* SepulcherHead: 51 segments total, head at index 0 */
    sep = {
      x: AX + AW / 2, y: AY + AH - 40, vx: 0, vy: 0, t: 0, attackCd: 0,
      trail: [], segs: [], chargeT: 0, telegraph: 0, cd: 0.6, chaseT: 0,
      /* worm body segments (51 total) */
      segments: [], arms: [],
      /* reference to SupremeCalamitas NPC for targeting */
      targetSCal: CalamityGlobalNPC.SCal,
      /* authentic worm constants from source */
      sepMaxSpeed: 150, sepAcceleration: 1.3, chargeCooldown: 150
    };

    /* Create 51 segments as per CalamityMod source */
    var head = { type: 'head', index: 0, x: sep.x, y: sep.y };
    var segments = [head];
    /* Body segments (indices 1-50): alternate between body and energy ball */
    for (var i = 1; i < 51; i++) {
      if (i % 2 === 1) {
        /* Body segment */
        segments.push({
          type: 'body',
          index: i,
          x: 0, y: 0,
          altTexture: Math.floor(i / 2) % 2 === 0  /* alternate every 2 segments */
        });
      } else {
        /* Energy Ball segment */
        segments.push({
          type: 'energy',
          index: i,
          x: 0, y: 0,
          animFrame: 0
        });
      }
    }

    /* Tail segment */
    segments.push({ type: 'tail', index: 51, x: 0, y: 0 });
    sep.segments = segments;

    /* Set up worm segment connections (head -> body -> energy -> body...) */
    for (var i = 0; i < segments.length - 1; i++) {
      segments[i].next = segments[i + 1];
      segments[i + 1].prev = segments[i];
    }

    /* Spawn 10 Brimstone Hearts in arena corners */
    hearts = [];
    var heartX = [AX + 60, AX + AW - 60];
    var heartY = [AY + 60, AY + 140];
    var heartIndex = 0;
    for (var row = 0; row < 2; row++) {
      for (var col = 0; col < 5; col++) {
        hearts.push({
          index: heartIndex++,
          x: heartX[col],
          y: heartY[row],
          hp: 15000,
          maxHp: 15000,
          alpha: 255,
          invulnTimer: 10,  /* 10 seconds invulnerable */
          chainEndpoints: [],  /* tendril connections to worm segments */
          damageReduction: 0.7  /* starts at 70% damage, drops with hits */
        });
        heartIndex++;  /* each heart gets unique ChainHeartIndex */
      }
    }

    say("* she is behind it. kill the hearts.");
  }

  /* ── Worm Movement and Behavior (authentic from SepulcherHead.cs) ───────────────────────*/
  function wormTick(dt) {
    if (!sep) return;

    /* Get SupremeCalamitas target */
    var target = Main.npc[sep.targetSCal];
    if (!target || !target.active) return;

    /* Worm head movement logic from source */
    var targetX = target.x + target.width / 2;
    var targetY = target.y + target.height / 2;
    var distX = targetX - sep.x;
    var distY = targetY - sep.y;
    var dist = Math.hypot(distX, distY) || 1;

    /* Calculate velocity with acceleration */
    var speed = Math.min(sep.sepMaxSpeed, Math.hypot(sep.vx || 0, sep.vy || 0));
    var acceleration = sep.sepAcceleration;

    if (dist < sep.sepMaxSpeed * 1.3) {
      /* Slow down when close */
      var slowdown = (sep.sepMaxSpeed * 1.3 - dist) / (sep.sepMaxSpeed * 1.3);
      acceleration *= slowdown;
    }

    /* Update velocity */
    if (sep.vx === undefined) sep.vx = 0;
    if (sep.vy === undefined) sep.vy = 0;

    var targetVelX = (distX / dist) * sep.sepMaxSpeed;
    var targetVelY = (distY / dist) * sep.sepMaxSpeed;

    sep.vx += (targetVelX - sep.vx) * acceleration * dt;
    sep.vy += (targetVelY - sep.vy) * acceleration * dt;

    /* Clamp velocity */
    var currentVel = Math.hypot(sep.vx, sep.vy);
    if (currentVel > sep.sepMaxSpeed * 1.3) {
      sep.vx = (sep.vx / currentVel) * (sep.sepMaxSpeed * 1.3);
      sep.vy = (sep.vy / currentVel) * (sep.sepMaxSpeed * 1.3);
    }

    /* Update head position */
    sep.x += sep.vx * dt;
    sep.y += sep.vy * dt;

    /* Keep within arena bounds */
    sep.x = Math.min(Math.max(sep.x, AX + 40), AX + AW - 40);
    sep.y = Math.min(Math.max(sep.y, AY + 40), AY + AH - 40);

    /* Charge behavior */
    if (sep.chargeT > 0) {
      sep.chargeT -= dt;
      if (sep.chargeT <= 0) {
        /* Charge ended, start cooldown */
        sep.cd = 2.5;  /* 2.5s cooldown */
        sep.vx = 0;
        sep.vy = 0;
      }
    } else if (sep.cd > 0) {
      sep.cd -= dt;
    } else {
      /* Between charges: chase SC constantly */
      if (sep.chaseT <= 0) {
        sep.chaseT = 1.3;
        sep.telegraph = 0.35;
      } else {
        sep.chaseT -= dt;
      }

      var angle = Math.atan2(targetY - sep.y, targetX - sep.x);
      sep.x += Math.cos(angle) * 150 * dt;
      sep.y += Math.sin(angle) * 150 * dt;
      sep.x = Math.min(Math.max(sep.x, AX + 40), AX + AW - 40);
      sep.y = Math.min(Math.max(sep.y, AY + 40), AY + AH - 40);
    }

    /* Update segment positions */
    updateSegmentPositions();

    /* Handle charge attack when in proximity */
    var playerDist = Math.hypot(px - sep.x, py - sep.y) || 1;
    if (sep.attackCd <= 0 && playerDist < 150) {
      sep.attackCd = 2.5;
      sfxPlay('giga-hit');
      fireBarrageRing(sep.x, sep.y);
    }
  }

  function updateSegmentPositions() {
    if (!sep || !sep.segments) return;

    /* Position each segment based on its type */
    for (var i = 0; i < sep.segments.length; i++) {
      var seg = sep.segments[i];

      if (seg.type === 'head') {
        seg.x = sep.x;
        seg.y = sep.y;
        seg.rotation = Math.atan2(sep.vy, sep.vx) + Math.PI / 2;
      } else if (seg.type === 'body') {
        var prev = seg.prev;
        if (prev) {
          var dx = prev.x - sep.x;
          var dy = prev.y - sep.y;
          var dist = Math.hypot(dx, dy);
          seg.x = sep.x + (dx / dist) * 52;  /* 52px spacing */
          seg.y = sep.y + (dy / dist) * 52;
          seg.rotation = Math.atan2(dy, dx) + Math.PI / 2;
        }
      } else if (seg.type === 'energy') {
        var prev = seg.prev;
        if (prev) {
          var dx = prev.x - sep.x;
          var dy = prev.y - sep.y;
          var dist = Math.hypot(dx, dy);
          seg.x = sep.x + (dx / dist) * 34;  /* 34px spacing */
          seg.y = sep.y + (dy / dist) * 34;
          seg.rotation = Math.atan2(dy, dx) + Math.PI / 2;
          /* Animate energy ball */
          seg.animFrame = Math.floor(Date.now() / 100) % 5;
        }
      } else if (seg.type === 'tail') {
        var prev = seg.prev;
        if (prev) {
          var dx = prev.x - sep.x;
          var dy = prev.y - sep.y;
          var dist = Math.hypot(dx, dy);
          seg.x = sep.x + (dx / dist) * 34;
          seg.y = sep.y + (dy / dist) * 34;
          seg.rotation = Math.atan2(dy, dx) + Math.PI / 2;
        }
      }
    }
  }

  /* ── Fire Barrage Ring (30 darts) ───────────────────────────────*/
  function fireBarrageRing(x, y) {
    for (var i = 0; i < 30; i++) {
      var angle = i * Math.PI * 2 / 30;
      shot(x, y, Math.cos(angle) * 150, Math.sin(angle) * 150, 3, COL.brim, 4);
    }
    if (NEU.juice) NEU.juice.burst(x, y, 12, COL.brimHi, 1.2);
  }

  /* ── Supreme Calamitas Attack Cycle (Fixed) ───────────────────────────────*/
  function fightTick(dt) {
    /* Contact damage handling */
    if (inv <= 0) {
      var touching = false;

      if ((chargeTelegraph > 0 || chargeT > 0) &&
          Math.hypot(px - bx, py - by) < 34) touching = true;
      if (diveT > 0 && diveT < 0.85 && Math.hypot(px - bx, py - by) < 32) touching = true;
      if (sep && sep.chargeT > 0 &&
          Math.hypot(px - sep.x, py - sep.y) < 30) touching = true;

      if (touching && hitPlayer()) return;
    }

    /* SC movement */
    if (chargeTelegraph > 0) {
      chargeTelegraph -= dt;
      scalAnimState = 'charge_telegraph';
      if (NEU.juice && chargeTelegraph < 0.1) NEU.juice.hit('small');
    } else if (chargeT > 0) {
      chargeT -= dt; bx += bxv * dt; by += byv * dt;
      bx = Math.min(Math.max(bx, AX), AX + AW);
      by = Math.min(Math.max(by, AY - 30), AY + AH);
      scalAnimState = 'charging';

      /* Multi-charge burst */
      if (chargeT <= 0 && chargeBurst < chargeBurstMax - 1) {
        chargeBurst++;
        chargeGap = 0.45;
        var a = Math.atan2(py - by, px - bx);
        bxv = Math.cos(a) * 420; byv = Math.sin(a) * 420;
        chargeT = 0.55;
        chargeTelegraph = 0.3;
      }
    } else if (chargeGap > 0) {
      chargeGap -= dt;
      scalAnimState = 'charge_recovery';
    } else if (diveT > 0) {
      diveT -= dt;
      if (diveT <= 0) {
        var wa = Math.atan2(py - by, px - bx);
        for (var wk = -1; wk <= 1; wk++)
          shot(bx, by, Math.cos(wa + wk * 0.22) * 300,
                         Math.sin(wa + wk * 0.22) * 300, 5, COL.brim, 3);
        scalAnimState = 'idle';
      } else if (diveT < 0.85) {
        by += (diveY - by) * Math.min(1, dt * 6);
        bx += diveDir * 500 * dt;
        scalAnimState = 'charging';
      } else {
        scalAnimState = 'casting';
      }
      bx = Math.min(Math.max(bx, AX + 30), AX + AW - 30);
      by = Math.min(Math.max(by, AY + 10), AY + AH - 10);
    } else {
      bx += ((px) - bx) * Math.min(1, dt * 1.8);
      by += ((AY - 24) - by) * Math.min(1, dt * 2.2);

      if (stepT < 0.3) {
        scalAnimState = 'casting';
      } else {
        scalAnimState = phase === 2 ? 'idle_fast' : 'idle';
      }
    }

    /* Worms tick */
    if (sep) wormTick(dt);

    /* Charge burst handling */
    if (chargeBurstMax > 0) {
      if (chargeBurst >= chargeBurstMax - 1 && chargeT <= 0 && chargeGap <= 0) {
        chargeBurstMax = 0;
      } else {
        return;
      }
    }

    stepT -= dt;
    if (stepT > 0) return;

    var k = CYCLE[step_ % CYCLE.length];
    step_++;
    var fast = phase === 2 ? 0.62 : 1;

    if (k === 'd') {
      var r = Math.random();
      if (r < 0.18) fireblast();
      else if (r < 0.28) gigablast(1);
      else dartBurst();
      stepT = 0.72 * fast;
    } else if (k === 'h') { hellbarrage(); stepT = 1.5 * fast; }
    else if (k === 'g2')  { gigablast(2); stepT = 1.5 * fast; }
    else if (k === 'g4')  { gigablast(phase === 2 ? 3 : 4); stepT = 2.2 * fast; }
    else if (k === 'c') {
      var chargeIdx = 0;
      if (step_ - 1 === 3) chargeIdx = 0;
      else if (step_ - 1 === 7) chargeIdx = 1;
      else if (step_ - 1 === 15) chargeIdx = 2;
      else if (step_ - 1 === 17) chargeIdx = 3;
      else if (step_ - 1 === 19) chargeIdx = 4;

      var p1Bursts = [4,2,2,4,2];
      var p2Bursts = [2,1,1,2,1];
      chargeBurstMax = phase === 2 ? p2Bursts[chargeIdx] : p1Bursts[chargeIdx];
      chargeBurst = 0;
      chargeGap = 0;
      charge();
      stepT = 0.55 + 0.5;
    } else if (k === 'm') { dive(); stepT = 1.15 + 0.5; }
  }

  /* ── Drawing Functions ───────────────────────────────*/
  function drawWorm() {
    if (!sep || !sep.segments) return;

    /* Draw body segments */
    for (var i = 0; i < sep.segments.length; i++) {
      var seg = sep.segments[i];
      var x = seg.x, y = seg.y;

      if (seg.type === 'head') {
        if (!sprite('sepulcher', x, y, 1.1, seg.rotation)) {
          ctx.fillStyle = '#3A2140';
          ctx.fillRect((x - 18) | 0, (y - 18) | 0, 36, 36);
        }
      } else if (seg.type === 'body') {
        var key = seg.altTexture ? 'sepulBodyAlt' : 'sepulBody';
        if (!sprite(key, x, y, 0.8, seg.rotation)) {
          ctx.fillStyle = '#3A2140';
          ctx.fillRect((x - 12) | 0, (y - 12) | 0, 24, 24);
        }
      } else if (seg.type === 'energy') {
        /* Energy ball animation */
        if (!sprite('sepulEnergyBall', x, y, 0.45, seg.rotation, false, 0, seg.animFrame)) {
          ctx.fillStyle = '#00FFFF';
          ctx.fillRect((x - 10) | 0, (y - 10) | 0, 20, 20);
        }
      } else if (seg.type === 'tail') {
        if (!sprite('sepulTail', x, y, 0.9, seg.rotation)) {
          ctx.fillStyle = '#2A1830';
          ctx.fillRect((x - 8) | 0, (y - 8) | 0, 16, 16);
        }
      }
    }
  }

  function drawHearts() {
    for (var i = 0; i < hearts.length; i++) {
      var h = hearts[i];
      var alpha = h.alpha / 255;

      /* Draw tendrils */
      if (h.chainEndpoints.length > 0) {
        ctx.strokeStyle = 'rgba(255, 74, 42, ' + (0.5 * alpha) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        for (var j = 0; j < h.chainEndpoints.length; j++) {
          var ep = h.chainEndpoints[j];
          ctx.lineTo(ep.x, ep.y);
        }
        ctx.stroke();
      }

      /* Draw heart */
      var hpRatio = h.hp / h.maxHp;
      ctx.fillStyle = '#C2405F';
      ctx.fillRect((h.x - 12) | 0, (h.y - 12) | 0, 24, 24);

      /* HP bar */
      ctx.fillStyle = '#FF0000';
      ctx.fillRect((h.x - 12) | 0, (h.y - 12) | 0, 24 * hpRatio, 4);

      /* Index indicator */
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.fillText(h.index + 1, h.x - 8, h.y + 20);
    }
  }

  function draw() {
    ctx.fillStyle = '#12080C'; ctx.fillRect(AX, AY, AW, AH);

    /* Draw arena borders */
    ctx.fillStyle = COL.bone;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3);
    ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH);
    ctx.fillRect(AX + AW, AY, 3, AH);

    /* Draw SC */
    if (mode !== 'won') {
      var bodyKey = mode === 'intro' ? 'scalHood' : 'scal';
      var anim = (mode === 'intro') ? { frame: 0, col: 0 } : getScalAnim();
      if (!sprite(bodyKey, bx, by, 2, 0, phase === 2, anim.col, anim.frame)) {
        ctx.fillStyle = '#FF00A0';
        ctx.fillRect((bx - 20) | 0, (by - 26) | 0, 40, 52);
      }
    }

    /* Draw projectiles */
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      var key = b.k === 1 ? 'fireblast' : b.k === 2 ? 'gigablast' : b.k === 3 ? 'hellblast' : 'dart';
      var sc = b.k === 1 ? 0.65 : b.k === 2 ? 0.75 : b.k === 3 ? 0.5 : 0.55;
      var brot = (b.k === 1 || b.k === 2 || b.k === 4)
        ? Math.atan2(b.vy, b.vx) + Math.PI / 2
        : Math.atan2(b.vy, b.vx);
      if (!sprite(key, b.x, b.y, sc, brot)) {
        ctx.fillStyle = b.c;
        ctx.fillRect((b.x - b.r) | 0, (b.y - b.r) | 0, b.r * 2, b.r * 2);
        if (b.k === 2) { ctx.fillStyle = COL.brimHi; ctx.fillRect((b.x - 3) | 0, (b.y - 3) | 0, 6, 6); }
      }
    }

    /* Draw worm and hearts */
    drawWorm();
    drawHearts();

    /* Draw UI elements */
    var bw = 260, bx2 = ((innerWidth - bw) / 2) | 0, by2 = Math.max(40, AY - 128);
    ctx.fillStyle = '#22222E'; ctx.fillRect(bx2, by2, bw, 8);
    ctx.fillStyle = invuln ? '#4A4560' : COL.dark;
    ctx.fillRect(bx2, by2, (bw * Math.max(0, bossHP / bossMax)) | 0, 8);

    ctx.fillStyle = COL.bone;
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    ctx.fillText(invuln ? 'calamitas — shielded' : 'calamitas', innerWidth / 2, by2 - 20);
    ctx.textAlign = 'left';

    ctx.fillStyle = COL.bone;
    ctx.fillText('HP ' + Math.max(0, hp) + '/' + MAXHP, AX, AY + AH + 12);

    /* Rage and TP bars (outside arena) */
    drawMeter('rage', rage, AX + 8, AY + 10, 80, 36);
    drawMeter('tp', tp, AX + 8, AY + 10 + 46, 80, 36);

    if (line && Date.now() - lineT < 5200) {
      ctx.fillStyle = COL.bone;
      ctx.font = '16px "Undertale Sans","Comic Sans MS",cursive';
      ctx.fillText(line, AX, AY + AH + 40);
    }

    if (NEU.juice) NEU.juice.drawParts(ctx, 1 / 60);
    if (NEU.juice) NEU.juice.end(ctx, false);
    if (NEU.juice) NEU.juice.overlay(ctx, innerWidth, innerHeight);

    if (showHitboxes) {
      ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2); ctx.stroke();
      if (mode === 'fight' && !invuln) {
        ctx.beginPath(); ctx.arc(bx, by, 40, 0, Math.PI * 2); ctx.stroke();
      }
      for (var i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      }
      for (var q = 0; q < hearts.length; q++) {
        var h = hearts[q];
        ctx.beginPath(); ctx.arc(h.x, h.y, 18, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function frame() {
    ctx.fillStyle = '#12080C'; ctx.fillRect(AX, AY, AW, AH);
    ctx.fillStyle = COL.bone;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3);
    ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH);
    ctx.fillRect(AX + AW, AY, 3, AH);
  }

  function getScalAnim() {
    if (scalAnimState !== scalAnimPrevState) {
      scalAnimTimer = 0;
      scalAnimPrevState = scalAnimState;
    }
    scalAnimTimer += 1/60;
    var st = scalAnimState;
    if (st === 'gigablast' && phase === 2) st = 'gigablast_p2';
    if (st === 'hellblast' && phase === 2) st = 'hellblast_p2';
    var b = BANDS[st] || BANDS.idle;
    var c = b.rev
      ? 5 - Math.floor(scalAnimTimer * b.fps) % 6
      : Math.floor(scalAnimTimer * b.fps) % 6;
    var fy = b.t * 6 + c;
    return { frame: fy % 21, col: Math.floor(fy / 21) };
  }

  var BANDS = {
    idle:            { t: 0, fps: 4 },
    idle_fast:       { t: 1, fps: 6 },
    charge_telegraph:{ t: 0, fps: 6 },
    charging:        { t: 1, fps: 16 },
    charge_recovery: { t: 1, fps: 8, rev: true },
    casting:         { t: 2, fps: 10 },
    gigablast:       { t: 3, fps: 10 },
    gigablast_p2:    { t: 4, fps: 10 },
    hellblast:       { t: 5, fps: 10 },
    hellblast_p2:    { t: 6, fps: 10 }
  };

  /* ── Input Handling ───────────────────────────────*/
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
    if (wrap.hidden || !NEU.scal.active || NEU.activeMinigame !== 'scal') return;
    if (e.key === 'F3') { showHitboxes = !showHitboxes; return; }
    if (e.key === 'Escape') {
      if (mode === 'won' || dying) { close(); return; }
      if (NEU.engine && NEU.engine.confirmExit) {
        NEU.engine.confirmExit('Supreme Calamitas', close);
      } else { close(); }
      return;
    }

    var kn = keyName(e);
    if (kn) keys[kn] = true;
    if (kn === 'focus') keys.focus = true;

    /* Z = rage, X = TP barrier */
    if (e.key === 'z' || e.key === 'Z') {
      if (rage >= 1) {
        rageMode = 1; rageModeT = 8;
        rage = 0;
      }
    }
    if (e.key === 'x' || e.key === 'X') {
      if (tp >= 1) {
        shieldT = 3;
        tp = 0;
      }
    }
  });

  addEventListener('keyup', function (e) {
    var kn = keyName(e);
    if (kn) keys[kn] = false;
    if (kn === 'focus') keys.focus = false;
  });

  /* ── Phase Management ───────────────────────────────*/
  function startWall(n) {
    mode = 'wall'; wallT = 0; wallN = n; walls = []; bullets = [];
    clearSched();
    invuln = true;
    sfxPlay('maelstrom');
    say(n === 0 ? "* the room fills up."
      : n === 1 ? "* it fills up faster."
                : "* and again, with something heavier.");
  }

  function wallTick(dt) {
    wallT += dt;
    var beat = Math.floor(wallT / 1.35);
    if (beat > walls.length - 1 && beat < 3) {
      walls.push(beat);
      var dirs = [['d','r','l'], ['u','r'], ['d','l','r']][beat] || ['d'];
      var holeY = (beat === 0 || beat === 2) ? (AY + 70 + Math.random() * (AH - 140)) : null;
      dirs.forEach(function (d, i) { later(function () { wallLine(d, holeY); }, i * 240); });
    }
    if (wallT > 4.6) {
      bullets = []; invuln = false;
      if (wallN === 0) spawnSepulcher(); else { mode = 'fight'; say(''); }
    }
  }

  function wallLine(d, holeY) {
    if (!running) return;
    var gap = 60 + Math.random() * (AW - 160);
    for (var i = 0; i < 22; i++) {
      var p = i / 21;
      if (d === 'd' || d === 'u') {
        var x = AX + p * AW;
        if (Math.abs(x - (AX + gap)) < 54) continue;
        shot(x, d === 'd' ? AY - 20 : AY + AH + 20, 0, (d === 'd' ? 1 : -1) * 210, 6, COL.brim);
      } else {
        var y = AY + p * AH;
        var gy = (holeY !== null && holeY !== undefined) ? holeY : (AY + gap * AH / AW);
        if (Math.abs(y - gy) < 48) continue;
        shot(d === 'r' ? AX - 20 : AX + AW + 20, y, (d === 'r' ? 1 : -1) * 210, 0, 6, COL.brim);
      }
    }
  }

  /* ── Brothers Phase (Phase 4) ───────────────────────────────*/
  function startBrothers() {
    mode = 'brothers'; invuln = true; bullets = [];
    clearSched();
    bros = [
      { side: -1, x: AX + 60, y: AY + AH / 2, hp: 8, t: 0, kind: 'slash', attackCount: 0, enraged: false, volley: 0, barrageCd: 0 },
      { side:  1, x: AX + AW - 60, y: AY + AH / 2, hp: 8, t: 0, kind: 'fist', attackCount: 0, enraged: false, volley: 0, barrageCd: 0 }
    ];
    say("* she calls her brothers. she does not fight while they do.");
  }

  function brothersTick(dt) {
    for (var i = 0; i < bros.length; i++) {
      var b = bros[i];
      if (b.hp <= 0) continue;

      var interval = b.enraged ? 0.7 : 0.83;
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
          if (b.kind === 'fist') {
            for (var s = -1; s <= 1; s += 2) {
              var aa = a + s * 0.25;
              shot(b.x, b.y, Math.cos(aa) * 280, Math.sin(aa) * 280, 7, COL.brimHi);
            }
          } else {
            var pvx = 0, pvy = 0;
            var predX = px + pvx * 0.5, predY = py + pvy * 0.5;
            var aa = Math.atan2(predY - b.y, predX - b.x);
            for (var j = -1; j <= 1; j++)
              shot(b.x, b.y, Math.cos(aa + j * 0.12) * 340, Math.sin(aa + j * 0.12) * 340, 5, COL.brim);
          }
        } else {
          if (b.kind === 'fist') {
            shot(b.x, b.y, Math.cos(a) * 240, Math.sin(a) * 240, 7, COL.brimHi);
          } else {
            var spread = b.enraged ? 0.1 : 0.16;
            var count = b.enraged ? 1 : 3;
            var start = -(count - 1) / 2;
            for (var j = 0; j < count; j++)
              shot(b.x, b.y, Math.cos(a + (start + j) * spread) * 300, Math.sin(a + (start + j) * spread) * 300, 5, COL.brim);
          }
        }
      }
    }

    for (var i = bros.length - 1; i >= 0; i--) {
      if (bros[i].hp <= 0) {
        var dead = bros.splice(i, 1)[0];
        if (NEU.juice) NEU.juice.burst(dead.x, dead.y, 15, dead.kind === 'fist' ? COL.brimHi : COL.brim, 1.5);
        if (bros.length === 1) {
          bros[0].enraged = true;
          say(dead.kind === 'fist' ? "* the swordsman falls. the mage rages." : "* the mage falls. the swordsman rages.");
        }
      }
    }

    if (!bros.length) {
      invuln = false; phase = 2; mode = 'fight';
      stepT = 1.0;
      say("* she laughs. that is the first noise she has made.");
      later(function () { if (running) say("* now she is trying."); }, 2200);
    }
  }

  /* ── Hit Detection and Damage Processing ───────────────────────────────*/
  function hitPlayer() {
    if (shieldT > 0) {
      shieldT = 0;
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(px, py, 12, '#B8E6FF'); }
      return false;
    }
    hp--; inv = IFRAMES;
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    if (NEU.juice) { NEU.juice.hit('medium'); NEU.juice.burst(px, py, 10, COL.soul); }
    if (hp <= 0) { startDeath(); return true; }
    return false;
  }

  function tryHit() {
    var mult = rageMode ? 2 : 1;

    if (sep) {
      for (var i = 0; i < hearts.length; i++) {
        if (Math.hypot(px - hearts[i].x, py - hearts[i].y) < 18) {
          for (var hh = 0; hh < mult && hearts.length; hh++) {
            var hx = hearts[i].x, hy = hearts[i].y;
            hearts.splice(i, 1);
            if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
            if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(hx, hy, 8, COL.brimHi); }
          }
          return;
        }
      }
      return;
    }

    if (mode === 'brothers') {
      for (var j = 0; j < bros.length; j++) {
        if (Math.hypot(px - bros[j].x, py - bros[j].y) < 28) {
          var b = bros[j];
          var dmg = (bros.length === 2 ? 0.75 : 1) * mult;
          b.dmgAccum = (b.dmgAccum || 0) + dmg;
          if (b.dmgAccum >= 1) {
            var hits = Math.floor(b.dmgAccum);
            b.hp -= hits;
            b.dmgAccum -= hits;
          }
          if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
          if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(b.x, b.y, 8, COL.brimHi); }
          return;
        }
      }
      return;
    }

    if (invuln || mode !== 'fight') return;
    if (Math.hypot(px - bx, py - by) > 40) return;
    bossHP -= mult;
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(bx, by, 7, COL.brimHi); }

    var pct = bossHP / bossMax;
    if (pct <= 0)              { win(); }
    else if (pct <= 0.25 && !flagged(3)) { mark(3); startBrothers(); }
    else if (pct <= 0.50 && !flagged(2)) { mark(2); startWall(2); }
    else if (pct <= 0.75 && !flagged(1)) { mark(1); startWall(1); }
  }

  function win() {
    mode = 'won'; running = false; bullets = [];
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

  /* ── Initializer ───────────────────────────────*/
  preloadSfx();

  // Phase progression: wall → worm → normal attacks → brothers → final
  function startIntro() {
    mode = 'intro';
    running = true;
    t = 0;
    requestAnimationFrame(stepFn);
  }

  startIntro();
})();