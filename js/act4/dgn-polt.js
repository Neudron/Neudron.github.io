/* dgn-polt.js — the Polterghast fight, run inside the dungeon (Terraria camera, Celeste hero, axe, NEU.kit).
   A port of Infernum Mode's Polterghast AI: Content/BehaviorOverrides/BossAIs/Polterghast/PolterghastBehaviorOverride.cs
   at InfernumTeam/InfernumMode d8a013a8065e6bf4b65a7fc0ac3dbb688b60f937.
   Infernum Mode is MIT licensed, Copyright (c) 2025 Javyz. Permission notice:
   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
   documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
   rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
   persons to whom the Software is furnished to do so, subject to the following conditions: the above copyright notice and
   this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED
   "AS IS", WITHOUT WARRANTY OF ANY KIND.
   Numbers live in DATA in Terraria units (px, frames at 60 Hz); the code multiplies lengths and speeds by K. Frames are
   unchanged: the plat sim is fixed 60 Hz as Terraria is. Every ported block names its source line.
   Deviations (on purpose): hit = 1 heart (no Terraria damage ladder); the hero flies only in AsgoreRingSoulAttack and
   DesperationAttack, as Infernum grants infinite flight there; clones hurt on contact and cannot be hit; the clone scale
   lerp is clamped (the source goes negative at 5 clones); legs hit on their tip only. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat, CH = NEU.dungeon && NEU.dungeon.chamber;
  if (!P || !P.level || !CH) return;
  var D_ = { autoplay: false };
  var T = 16, K = 0.5, PI = Math.PI, TAU = Math.PI * 2, ARENA_W = CH.w, ARENA_H = CH.h, BASE_HP = 500, POOL = 900;
  /* THE BOUNDARY. The fight lives in a chamber-local frame (px, origin = the chamber's top left, the old arena's own frame) so every attack keeps the numbers it was
     tuned with. The chamber sits at (OXP, OYP) world px inside the dungeon map. Local to world happens only at the named edges: the hero (hx, hy, hurt, axe, assist),
     the kit's targets and grazes, the lights and the draw. The soul box is viewport space and never crosses. */
  var OXP = CH.x * T, OYP = CH.y * T;
  var DATA = {
 cycles: {
  phase1: [
   'EctoplasmUppercutCharges',
   'LegSwipes',
   'WispCircleCharges',
   'EctoplasmUppercutCharges',
   'SpiritPetal'
  ],
  phase2: [
   'AsgoreRingSoulAttack',
   'ArcingSouls',
   'EctoplasmUppercutCharges',
   'VortexCharge',
   'SpiritPetal',
   'LegSwipes',
   'WispCircleCharges',
   'ArcingSouls',
   'EctoplasmUppercutCharges',
   'VortexCharge',
   'LegSwipes',
   'SpiritPetal'
  ],
  phase3: [
   'CloneSplit',
   'AsgoreRingSoulAttack',
   'VortexCharge',
   'ArcingSouls',
   'SpiritPetal',
   'EctoplasmUppercutCharges',
   'LegSwipes',
   'CloneSplit',
   'VortexCharge',
   'WispCircleCharges',
   'ArcingSouls',
   'EctoplasmUppercutCharges',
   'LegSwipes',
   'SpiritPetal'
  ]
 },
 phase2LifeRatio: 0.65,
 phase3LifeRatio: 0.35,
 minGhostCircleRadius: 600,
 damage: {
  soul: 230,
  phantoplasmShot: 230,
  ghostlyVortex: 235,
  circlingPhantoplasmShot: 250
 },
 attacks: {
  DeathAnimation: {
   _line: 326,
   slowdownTime: 210,
   screenFocusDelay: 60,
   screenFocusTime: 90,
   explodeDelay: 370
  },
  LegSwipes: {
   _line: 523,
   attackTransitionDelay: 75,
   swingDelay: 96,
   swipeTime: 85,
   swipeCount: 7,
   vortexReleaseRate: 3,
   hoverSpeed: 26,
   swipeArc: 1.03,
   horizontalOffset: 840
  },
  WispCircleCharges: {
   _line: 612,
   hoverTime: 150,
   chargeCount: 6,
   slowdownTime: 12,
   chargeTime: 45,
   ectoplasmPerRing: 8,
   offsetPerRing: 296,
   maxRingOffset: 4000,
   chargeSpeed: 36
  },
  AsgoreRingSoulAttack: {
   _line: 703,
   ringCount: 7,
   soulsPerRing: 24,
   ringReleaseRate: 67,
   ringCreationDelay: 90,
   attackTransitionDelay: 120
  },
  EctoplasmUppercutCharges: {
   _line: 815,
   descendTime: 75,
   telegraphTime: 27,
   chargeTime: 67,
   chargeCount: 3,
   ectoplasmReleaseRate: 6,
   verticalOffset: 1325,
   chargeSpeed: 36.5
  },
  ArcingSouls: {
   _line: 938,
   shootDelay: 35,
   shootRate: 56,
   shootTime: 300,
   attackTransitionDelay: 90
  },
  SpiritPetal: {
   _line: 994,
   slowdownTime: 60,
   shootTime: 240
  },
  VortexCharge: {
   _line: 1069,
   chargeCount: 1,
   aimTime: 20,
   slowdownTime: 12,
   chargeTime: 40
  },
  CloneSplit: {
   _line: 1163,
   totalCharges: 4,
   cloneCount: 5,
   splitDelay: 15,
   hoverTime: 25,
   chargeTime: 34,
   postChargeDelay: 20
  },
  DesperationAttack: {
   _line: 1285,
   vignetteFadeinTime: 60,
   attackDelay: 102,
   vortexSpiralCount: 4,
   vortexSpiralSpawnRate: 24,
   vortexSpiralTime: 540,
   spiritFlameTime: 540,
   soulsPerRing: 24,
   ringReleaseRate: 60,
   overallRingSpeedFactor: 1.5,
   soulBurstCount: 30
  }
 }
};
  var ATK = ['EctoplasmUppercutCharges', 'LegSwipes', 'WispCircleCharges', 'AsgoreRingSoulAttack', 'ArcingSouls', 'VortexCharge', 'SpiritPetal', 'CloneSplit', 'DesperationAttack'];
  var NAMES = ['POLTERGHAST', 'NECROGHAST', 'NECROPLASM'];
  var COL = { ecto: '#7FE3C4', cyan: '#BFFFFF', pink: '#FF8FCB', red: '#FF4A5A', ink: '#0B0A12' };

  var bb = { clock: 0, hudAt: 0, chip: 1, hitAt: -9 };   /* the boss bar's chip trail (danmaku.js bossBar) */
  var b = null, shots = [], fxs = [], tels = [], kit = null, frame = 0, exitIn = 0, lastDir = 1, seeded = 1;
  var F = NEU.dgnFoes ? NEU.dgnFoes.F : { x: 0, y: 0 };   /* the kit's focus point, shared with the foes: the hero, or the soul while the box is up */
  var state = 'idle', rem = false, cap0 = 6, spawn0 = null, exitTimer = 0, GZ = { x: 0, y: 0, r: 0, grazed: false };   /* idle | active; rem: a rematch pays nothing twice */

  /* deterministic when a test seeds it; Math.random otherwise */
  function rnd() { if (seeded === 1) return Math.random(); seeded = (seeded * 16807) % 2147483647; return (seeded - 1) / 2147483646; }
  function seed(n) { seeded = n > 1 ? n : 1; if (n === 1) seeded = 1; }
  function rndRange(a, c) { return a + (c - a) * rnd(); }
  function k(v) { return v * K; }
  function clamp(v, a, c) { return v < a ? a : v > c ? c : v; }
  function lerp(a, c, t) { return a + (c - a) * t; }
  function lv(a, c, x) { return clamp((x - a) / (c - a), 0, 1); }     /* Utils.GetLerpValue */
  function tri(t) { return t < 0.5 ? t * 2 : 2 - t * 2; }             /* Convert01To010 */
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function spd(v) { return NEU.boss && NEU.boss.speed ? NEU.boss.speed(v) : v; }   /* Medium = 1, Hard and up faster */
  function hero() { return P.hero(); }
  function hx() { return hero().x - OXP; }
  function hy() { return hero().y - P.hh / 2 - OYP; }
  function ang(ax, ay, bx2, by2) { return Math.atan2(by2 - ay, bx2 - ax); }
  function rotv(x, y, a) { var c = Math.cos(a), s = Math.sin(a); return { x: x * c - y * s, y: x * s + y * c }; }
  function unit(x, y) { var d = Math.sqrt(x * x + y * y); return d > 1e-6 ? { x: x / d, y: y / d } : { x: 0, y: 1 }; }
  function dist(ax, ay, bx2, by2) { var dx = bx2 - ax, dy = by2 - ay; return Math.sqrt(dx * dx + dy * dy); }
  function side() { return hx() < b.x ? 1 : -1; }                    /* (target.X < npc.X).ToDirectionInt() */

  /* ── the boss ─────────────────────────────────────────────────────── */
  var AIS = {};   /* other fights for other tiers register here (dgn-polt-death.js) */
  function useDeath() { return !!(AIS.death && NEU.boss && (NEU.boss.tier === 'bot' || NEU.boss.tier === 'easy')); }
  function newBoss() {
    var hp = NEU.boss && NEU.boss.hp ? NEU.boss.hp(BASE_HP) : BASE_HP, i, legs = [];
    for (i = 0; i < 4; i++) legs.push({ i: i, dir: i >= 2 ? 1 : -1, x: 0, y: 0, vx: 0, vy: 0, ix: 0, iy: 0, tm: 0, red: 0.3 });
    return { x: ARENA_W * T / 2, y: 5 * T, vx: 0, vy: 0, rot: 0, op: 0, hide: false, inv: false, contact: true, dr: 0.1, scale: 1.225,
      hp: hp, hpMax: hp, atk: 'EctoplasmUppercutCharges', t: 0, ex: [0, 0, 0, 0, 0], cycle: 0, phase: 0, souls: 0, veryFirst: 0, legCtl: -1,
      mode: useDeath() ? 'death' : 'infernum', dying: 0, dx: 0, dy: 0, despair: 0, tel: 0, teld: 0, vig: 0, vigDec: 0, enraged: false, clones: [], legs: legs, done: false, burst: 0,
      w: k(90), h: k(120), flash: 0 };
  }
  function lifeRatio() { return b.hp / b.hpMax; }
  function phaseOf() { var lr = lifeRatio(); return lr < DATA.phase3LifeRatio ? 2 : lr < DATA.phase2LifeRatio ? 1 : 0; }
  function selectNext() {   /* SelectNextAttack :1429 */
    var arr = DATA.cycles['phase' + (phaseOf() + 1)], i;
    b.cycle++;
    b.atk = arr[b.cycle % arr.length];
    if (b.despair) b.atk = 'DesperationAttack';
    b.t = 0;
    for (i = 0; i < 5; i++) b.ex[i] = 0;
    for (i = 0; i < shots.length; i++) if (shots[i].k === 'orbit' && shots[i].life - shots[i].age > 40) shots[i].life = shots[i].age + 40;   /* CirclingEctoplasm fades once Wisp is over */
    syncBox();
  }
  /* Terraria SimpleFlyMovement: ease each axis toward the wanted speed, twice as fast when reversing */
  function fly(tvx, tvy, acc) {
    if (b.vx < tvx) { b.vx += acc; if (b.vx < 0 && tvx > 0) b.vx += acc; } else if (b.vx > tvx) { b.vx -= acc; if (b.vx > 0 && tvx < 0) b.vx -= acc; }
    if (b.vy < tvy) { b.vy += acc; if (b.vy < 0 && tvy > 0) b.vy += acc; } else if (b.vy > tvy) { b.vy -= acc; if (b.vy > 0 && tvy < 0) b.vy -= acc; }
  }
  function look() { b.rot = ang(b.x, b.y, hx(), hy()) + PI / 2; }
  function teleport(x, y, withTelegraph) {   /* TeleportToPosition :452 */
    var i, l;
    if (withTelegraph) for (i = 0; i < 6; i++) { fxs.push({ k: 'ring', x: b.x, y: b.y, r: 30, t: 0, d: 24 + i * 2 }); fxs.push({ k: 'ring', x: x, y: y, r: 30, t: 0, d: 24 + i * 2 }); }
    b.x = x; b.y = y;
    for (i = 0; i < b.legs.length; i++) { l = b.legs[i]; l.x = b.x + rndRange(-10, 10); l.y = b.y + rndRange(-10, 10); }
  }

  /* ── projectiles (all tile-blind, as in Infernum) ─────────────────── */
  function add(o) {
    var i, sp = spd(1);   /* the tier's bullet-speed knob: 1 on Medium, slower for Bot and Easy, faster from Hard */
    if (sp !== 1) { o.vx = (o.vx || 0) * sp; o.vy = (o.vy || 0) * sp; if (o.f) o.f *= sp; if (o.av) o.av *= sp; }
    o.age = 0; o.op = o.op == null ? 1 : o.op; o.life = o.life || 300; o.dmg = o.dmg == null ? 1 : o.dmg;
    if (shots.length >= POOL) { for (i = 0; i < shots.length; i++) if (!shots[i].dmg) { shots.splice(i, 1); break; } if (shots.length >= POOL) return null; }
    shots.push(o); return o;
  }
  function vis(x, y, vx, vy, life, kind, cyan) { return add({ k: 'nrs', x: x, y: y, vx: vx, vy: vy, r: k(16), life: life, dmg: 0, cyan: cyan, cf: 1, ex: 0 }); }
  function vortex(x, y, vx, vy, max) { return add({ k: 'vortex', x: x, y: y, vx: vx, vy: vy, r: k(14), life: 300, max: max || 27 * K, rot: 0 }); }
  function ecto(x, y, vx, vy, fall, life) { return add({ k: 'ecto', x: x, y: y, vx: vx, vy: vy, r: Math.max(3, k(9)), life: life, fall: fall, hue: rnd(), trail: [] }); }
  function ring(cx, cy, factor, gapRad, ccw) {   /* the Asgore ring: SpinningSoul x (24 - gap) */
    var n = DATA.attacks.AsgoreRingSoulAttack.soulsPerRing, off = rnd() * TAU, i, a, rad = k(1520);
    if (dist(cx, cy, hx(), hy()) > rad) rad = dist(cx, cy, hx(), hy()) + k(100);
    for (i = 0; i < n; i++) {
      a = TAU * i / n;
      if (a < gapRad) continue;
      add({ k: 'spin', x: cx, y: cy, vx: 0, vy: 0, r: k(16), life: 270, rad: rad, a: a + off, f: factor, ccw: ccw, cyan: (rnd() * 2) | 0 });
    }
  }
  function stepShot(s) {
    var d, u, a, lr;
    s.age++;
    s.op = s.op;
    if (s.k === 'ecto') {
      if (s.age > s.life - 15) s.dmg = 0;
      if (s.fall) { if (s.age < 120) { u = unit(hx() - s.x, hy() - s.y); s.vx = lerp(s.vx, u.x * k(18), 0.032); s.vy = lerp(s.vy, u.y * k(18), 0.032); } }
      else { s.vx *= 0.985; s.vy *= 0.985; }
      s.op = lv(0, 20, s.age) * lv(s.life, s.life - 20, s.age);
      s.trail.unshift(s.x, s.y); if (s.trail.length > 12) s.trail.length = 12;
      s.x += s.vx; s.y += s.vy;
    } else if (s.k === 'orbit') {
      s.a += s.av; s.x = s.cx + Math.cos(s.a) * s.rad; s.y = s.cy + Math.sin(s.a) * s.rad;
      s.op = lv(0, 45, s.age) * lv(0, 40, s.life - s.age);
      if (s.life - s.age < 40) s.dmg = 0;
    } else if (s.k === 'spin') {
      s.rad -= s.f * 6 * K; s.a -= lerp(s.f, 1, 0.3) * 1.5 * PI / 180 * (s.ccw ? 1 : -1);
      s.x = b.x + Math.cos(s.a) * s.rad; s.y = b.y + Math.sin(s.a) * s.rad;
      s.op = lv(0, 10, s.age) * lv(0, 25, s.life - s.age);
      if (s.rad <= k(20)) s.age = s.life;
    } else if (s.k === 'arc') {
      if (s.life - s.age < 9) {
        s.dmg = 0; u = unit(b.x - s.x, b.y - s.y);
        s.vx = (s.vx * 11 + u.x * k(39)) / 12; s.vy = (s.vy * 11 + u.y * k(39)) / 12;
        if (Math.abs(b.x - s.x) < b.w / 2 && Math.abs(b.y - s.y) < b.h / 2) { b.souls--; s.age = s.life; }
        s.age = Math.min(s.age, s.life - 8);
      } else { a = rotv(s.vx, s.vy, s.av); s.vx = a.x; s.vy = a.y; }
      s.op = lv(0, 8, s.age) * lv(0, 35, s.life - s.age);
      s.x += s.vx; s.y += s.vy;
    } else if (s.k === 'soul') {   /* NotSpecialSoul */
      s.op = lv(0, 5, s.age) * lv(0, 25, s.life - s.age);
      if (!s.plain && s.life - s.age < 3) {
        s.x = lerp(s.x, b.x, 0.06); s.y = lerp(s.y, b.y, 0.06); u = unit(b.x - s.x, b.y - s.y);
        s.vx = (s.vx * 11 + u.x * k(36)) / 12; s.vy = (s.vy * 11 + u.y * k(36)) / 12; s.dmg = 0;
        if (Math.abs(b.x - s.x) < b.w / 2 && Math.abs(b.y - s.y) < b.h / 2) { b.souls--; s.age = s.life; }
        s.age = Math.min(s.age, s.life - 2);
      } else if (s.life - s.age < 135 && s.home) {
        d = Math.sqrt(s.vx * s.vx + s.vy * s.vy) + 0.01 * K; u = unit(hx() - s.x, hy() - s.y);
        s.vx = (s.vx * 169 + u.x * d) / 170; s.vy = (s.vy * 169 + u.y * d) / 170; u = unit(s.vx, s.vy); s.vx = u.x * d; s.vy = u.y * d;
      }
      s.x += s.vx; s.y += s.vy;
    } else if (s.k === 'vortex') {
      lr = s.max + (s.life - s.age < 90 ? 12 * K : 0);
      if (Math.sqrt(s.vx * s.vx + s.vy * s.vy) < lr) { s.vx *= 1.045; s.vy *= 1.045; }
      s.rot -= PI / 12; s.op = lv(0, 5, s.age) * lv(0, 25, s.life - s.age);
      s.dmg = s.op >= 1 ? 1 : 0;
      s.x += s.vx; s.y += s.vy;
    } else if (s.k === 'nrs') {   /* NonReturningSoul: harmless until it has faded in past 0.3 */
      s.op = lv(0, 25, s.age) * lv(0, 25, s.life - s.age) * (s.cf ? 0.875 : 0.35);
      if (s.cf && Math.sqrt(s.vx * s.vx + s.vy * s.vy) < k(27)) { s.vx *= 1.015; s.vy *= 1.015; }
      if (s.ex) s.dmg = s.op >= 0.3 ? 1 : 0;
      s.x += s.vx; s.y += s.vy;
    } else if (s.k === 'tele') {   /* SoulTelegraphLine: 24 frames, then ten souls down the line */
      s.op = tri(s.age / s.life);
      if (s.age >= s.life) for (d = 0; d < 10; d++) add({ k: 'nrs', x: s.x + rndRange(-k(100), k(100)), y: s.y + rndRange(-k(100), k(100)), vx: s.dx * k(24.5), vy: s.dy * k(24.5), r: k(16), life: 220, cf: 0, ex: 1, cyan: (rnd() * 2) | 0 });
    }
  }
  /* the encounter is bound to the chamber air: the boss and the clones are held inside it (the AI tracks a hero standing at the mouth, which would send them into the masonry),
     and a shot outside the air is hidden by hudWorld's clip, so it neither grazes nor hurts. */
  function pen(o) {   /* the centre stays in the air; the clip hides what overlaps the wall */
    var x1 = (ARENA_W - 2) * T, y1 = (ARENA_H - 2) * T;
    if (o.x < 2 * T) { o.x = 2 * T; if (o.vx < 0) o.vx = 0; } else if (o.x > x1) { o.x = x1; if (o.vx > 0) o.vx = 0; }
    if (o.y < 2 * T) { o.y = 2 * T; if (o.vy < 0) o.vy = 0; } else if (o.y > y1) { o.y = y1; if (o.vy > 0) o.vy = 0; }
  }
  function seen(s) { return s.x > 2 * T - s.r && s.x < (ARENA_W - 2) * T + s.r && s.y > 2 * T - s.r && s.y < (ARENA_H - 2) * T + s.r; }
  function updateShots() {
    var i, s;
    for (i = shots.length - 1; i >= 0; i--) {
      s = shots[i]; stepShot(s);
      if (s.age >= s.life) { shots.splice(i, 1); continue; }
      if (!seen(s)) continue;   /* hidden by the clip, so it neither grazes nor hurts */
      if (kit && s.dmg > 0 && s.k !== 'tele') graze(s);
      if (!fb.on && s.dmg > 0 && s.op > 0.05 && heroHit(s.x, s.y, s.r)) { hurtHero(s.dmg, sgn(s.vx)); if (s.k === 'ecto' || s.k === 'spin' || s.k === 'orbit') { /* keeps going: a Terraria projectile does not die on the player */ } }
    }
  }
  function graze(s) { GZ.x = s.x + OXP; GZ.y = s.y + OYP; GZ.r = s.r; GZ.grazed = !!s.grazed; kit.graze(GZ); s.grazed = GZ.grazed; }   /* the kit reads world px */
  function heroHit(x, y, r) { return Math.abs(hx() - x) < P.hw + r && Math.abs(hy() - y) < P.hh / 2 + r; }
  function hurtHero(n, dir, fromBox) {
    var h = hero();
    if (h.dead > 0 || h.inv > 0 || P.replaying() || b.done || (fb.on && !fromBox)) return;
    lastDir = dir || sgn(hx() - b.x) || 1;
    if (kit) kit.hit(n); else P.hurt(n, lastDir);
  }


  /* ── the soul box: the Asgore rings and the desperation attack are fought as Deltarune soul sections ──
     The hero is held where he stands (P.setHold), a box opens over the screen with the shared soul (danmaku.js: red soul, 8-way,
     X dashes with i-frames, Shift focuses) and the patterns play out inside it. Close the box and the hero walks on. */
  var dm = NEU.danmaku;
  var fb = { on: false, AX: 0, AY: 0, AW: 0, AH: 0, F: null, shots: [], keys: {}, t: 0, sc: 1, pulse: 0, prevDash: false };
  function wantBox() { return !!(b && !b.done && (b.atk === 'AsgoreRingSoulAttack' || b.atk === 'DesperationAttack')); }
  function syncBox() { if (wantBox() && !fb.on) boxOpen(); else if (!wantBox() && fb.on) boxClose(); }
  /* the pop: the soul leaves the hero and the box opens round it (POP_N frames, ease-out-back), then BREATH frames of quiet with the attack held at its first
     frame and the soul free to move: a Deltarune battle box gives the player the box before it gives the bullets. The hero is untouchable throughout. */
  var POP_N = 24, BREATH = 36, OUT_N = 14;
  function easeBack(u) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }
  function boxOpen() {
    var v = P.view(), h0;
    if (!dm || fb.on) return;
    fb.AW = Math.min(v.w - 160, 440) | 0; fb.AH = Math.min(v.h - 220, 250) | 0; fb.AX = ((v.w - fb.AW) / 2) | 0; fb.AY = (((v.h - fb.AH) / 2) + 14) | 0;
    fb.F = dm.fight(fb.AX + fb.AW / 2, fb.AY + fb.AH / 2); fb.shots.length = 0; fb.on = true; fb.t = 0; fb.sc = P.reduced() ? 1 : 0; fb.prevDash = false; fb.pop = POP_N + BREATH; fb.outT = 0;
    if (P.setHold) P.setHold(true);
    h0 = hero(); if (h0) h0.inv = Math.max(h0.inv || 0, (POP_N + BREATH + 6) / 60);
  }
  function boxClose(silent) {
    var h;
    if (!fb.on) return;
    if (!silent && !P.replaying() && !P.reduced()) { fb.outT = OUT_N; fb.outR = fbRect(); }   /* the box folds back into the hero (drawn only) */
    fb.on = false; fb.shots.length = 0; fb.pop = 0;
    if (P.setHold) P.setHold(false);
    h = hero(); if (h && !silent) h.inv = Math.max(h.inv || 0, 1.2);
  }
  function fbRect() { var c = fb.sc, w = fb.AW * c, hh = fb.AH * c; return { AX: fb.AX + (fb.AW - w) / 2, AY: fb.AY + (fb.AH - hh) / 2, AW: w, AH: hh }; }
  function boxShot(kind, x, y, ux, uy, r, col, o) {
    var s = { kind: kind, x: x, y: y, ux: ux, uy: uy, vx: ux * 60, vy: uy * 60, r: r, c: col, age: 0, life: (o && o.life) || 600, max: (o && o.max) || 0 };
    if (fb.shots.length < 400) fb.shots.push(s);
    return s;
  }
  /* an Asgore ring: souls on a circle round the box centre that close in, with one gap. The speed factor is Infernum's. */
  function boxRing(factor, gapRad, ccw) {
    var n = DATA.attacks.AsgoreRingSoulAttack.soulsPerRing, off = rnd() * TAU, i, a, R0 = Math.sqrt(fb.AW * fb.AW + fb.AH * fb.AH) / 2 + 14, cx0 = fb.AX + fb.AW / 2, cy0 = fb.AY + fb.AH / 2, s;
    var sp = spd(1), rg = { ga: off + gapRad / 2, lead: null };   /* ga: where the gap points now; it turns with the ring */
    for (i = 0; i < n; i++) {
      a = TAU * i / n;
      if (a < gapRad) continue;
      s = boxShot('spin', cx0, cy0, 0, 0, 4, (rnd() < 0.5) ? COL.cyan : COL.pink, { life: 270 });
      s.cx = cx0; s.cy = cy0; s.rad = R0; s.a = a + off; s.dr = (R0 - 6) / (150 / factor) * sp; s.da = lerp(factor, 1, 0.3) * 1.5 * PI / 180 * (ccw ? -1 : 1);
      s.rg = rg; if (!rg.lead) rg.lead = s;
    }
  }
  function boxStep(s) {
    var ox = s.x, oy = s.y, u;
    s.age++;
    if (s.kind === 'spin') { if (s.rg.lead === s) s.rg.ga -= s.da; s.rad -= s.dr; s.a -= s.da; s.x = s.cx + Math.cos(s.a) * s.rad; s.y = s.cy + Math.sin(s.a) * s.rad; if (s.rad <= 6) s.age = s.life; }
    else if (s.kind === 'vort') { if (Math.sqrt(s.ux * s.ux + s.uy * s.uy) < s.max) { s.ux *= 1.045; s.uy *= 1.045; } s.x += s.ux * spd(1); s.y += s.uy * spd(1); }
    else if (s.kind === 'lin') { s.x += s.ux * spd(1); s.y += s.uy * spd(1); }
    else if (s.kind === 'tele') {
      if (s.age >= s.life) { var i, a0 = Math.atan2(s.uy, s.ux); for (i = 0; i < 10; i++) boxShot('lin', s.x + rndRange(-30, 30), s.y + rndRange(-30, 30), Math.cos(a0) * 4.6, Math.sin(a0) * 4.6, 4, i % 2 ? COL.pink : COL.cyan, { life: 200 }); }
    }
    s.vx = (s.x - ox) * 60; s.vy = (s.y - oy) * 60;
  }
/* the Bot's way through an Asgore ring: park near the centre, inside the gap, and turn with it (the gap is a quarter of the way round, so a soul that hugs
     the centre has only a few pixels to follow). Anything else the shared planner (danmaku.js assist) steers. */
  function botBox(Fs) {
    var i, s, best = null, cx0 = fb.AX + fb.AW / 2, cy0 = fb.AY + fb.AH / 2, rho = Math.sqrt((Fs.x - cx0) * (Fs.x - cx0) + (Fs.y - cy0) * (Fs.y - cy0)), tx, ty, dx, dy;
    for (i = 0; i < fb.shots.length; i++) { s = fb.shots[i]; if (s.kind === 'spin' && s.rad > rho - 10 && (!best || s.rad < best.rad)) best = s; }
    for (i = 0; best && i < fb.shots.length; i++) if (fb.shots[i].kind !== 'spin' && fb.shots[i].kind !== 'tele') best = null;   /* mixed patterns: let the planner see everything */
    if (!best) return null;
    tx = cx0 + Math.cos(best.rg.ga) * 22; ty = cy0 + Math.sin(best.rg.ga) * 22; dx = tx - Fs.x; dy = ty - Fs.y;
    return { left: dx < -1.2, right: dx > 1.2, up: dy < -1.2, down: dy > 1.2 };
  }
  function botOn() { return !!(NEU.boss && NEU.boss.tier === 'bot') || !!D_.autoplay; }
  function boxTick() {
    var Fs = fb.F, R, keys, a, i, s, hit, h = hero();
    fb.t++; if (fb.pulse > 0) fb.pulse--;
    if (!P.reduced() && fb.t <= POP_N) fb.sc = easeBack(fb.t / POP_N); else if (fb.sc !== 1 && !(b.mode === 'infernum' && b.atk === 'DesperationAttack')) fb.sc = 1;
    if (b.mode === 'infernum' && b.atk === 'DesperationAttack') fb.sc = Math.min(fb.sc, 1 - b.vigDec * 0.62 > 0.34 ? 1 - b.vigDec * 0.62 : 0.34);
    R = fbRect();
    if (botOn() && !P.replaying()) {
      a = botBox(Fs);
      if (a) keys = a; else { a = dm.assist(Fs, fb.shots, R); keys = { left: a.left, right: a.right, up: a.up, down: a.down }; if (a.dash) dm.dash(Fs); }
    } else {
      keys = fb.keys;
      if (keys.dash && !fb.prevDash && fb.t > POP_N) dm.dash(Fs, (keys.right ? 1 : 0) - (keys.left ? 1 : 0) || undefined, (keys.down ? 1 : 0) - (keys.up ? 1 : 0) || undefined);
      fb.prevDash = !!keys.dash;
    }
    if (fb.t > POP_N) dm.move(Fs, { left: keys.left, right: keys.right, up: keys.up, down: keys.down, focus: !!fb.keys.grab && !botOn() }, 1 / 60, R, null);
    F.x = Fs.x; F.y = Fs.y;
    for (i = fb.shots.length - 1; i >= 0; i--) {
      s = fb.shots[i]; boxStep(s);
      if (s.age >= s.life || s.x < -80 || s.x > P.view().w + 80 || s.y < -80 || s.y > P.view().h + 80) { fb.shots.splice(i, 1); continue; }
      if (kit && s.kind !== 'tele') kit.graze(s);
    }
    if (Fs.dashI <= 0 && h.inv <= 0 && h.dead <= 0) { hit = dm.hits(fb.shots.filter(function (q) { return q.kind !== 'tele'; }), Fs.x, Fs.y, dm.soul.R); if (hit) hurtHero(1, 0, true); }
  }

  /* ── attacks ───────────────────────────────────────────────────────── */
  var LEG_SWIPE = [[0.18, 0.2, 'out3'], [0.5, 1, 'in2'], [1, 0, 'in100']];   /* PolterghastBehaviorOverride.LegSwipeAnimation :55 */
  function legAnim(x) {
    var u;
    if (x < 0.18) { u = x / 0.18; return 0.2 * (1 - Math.pow(1 - u, 3)); }
    if (x < 0.5) { u = (x - 0.18) / 0.32; return 0.2 + 0.8 * u * u; }
    u = (x - 0.5) / 0.5; return 1 - Math.pow(u, 100);
  }
  function legsLogic() {
    var i, l, d, idle, m, a, r, rate, u;
    for (i = 0; i < 4; i++) {
      l = b.legs[i]; idle = b.legCtl !== i;
      if (!l.tm && !l.ix) { a = TAU * i / 4 + rndRange(-0.69, 0.69); r = k(rndRange(120, 400)); l.ix = b.x + Math.cos(a) * r; l.iy = b.y + Math.sin(a) * r; }
      if (idle) {
        m = k(28) + Math.sqrt(b.vx * b.vx + b.vy * b.vy) * 1.2;
        d = dist(l.x, l.y, l.ix, l.iy);
        if (d > m + k(4)) { u = unit(l.ix - l.x, l.iy - l.y); l.vx = u.x * m; l.vy = u.y * m; } else { l.x = l.ix; l.y = l.iy; l.vx = l.vy = 0; }
        if (dist(l.x, l.y, b.x, b.y) > k(650)) l.tm++;
        l.tm++;
        rate = clamp(30 - Math.sqrt(b.vx * b.vx + b.vy * b.vy) / K, 5, 35);
        if (l.tm >= rate) { a = TAU * i / 4 + rndRange(-0.69, 0.69); r = k(rndRange(400, 640)); l.ix = b.x + Math.cos(a) * r; l.iy = b.y + Math.sin(a) * r; l.tm = 0; }
      }
      l.red = clamp(l.red + (idle ? -1 : 1) * 0.02, 0.3, 1);
      l.x += l.vx; l.y += l.vy;
    }
  }

  function uppercut() {   /* DoBehavior_EctoplasmUppercutCharges :815 */
    var d = DATA.attacks.EctoplasmUppercutCharges, descend = d.descendTime, tele = d.telegraphTime, charge = d.chargeTime, count = d.chargeCount, rel = d.ectoplasmReleaseRate;
    var vOff = d.verticalOffset, speed = d.chargeSpeed, lr = lifeRatio(), hOff, u, i, perp, p;
    if (lr < DATA.phase2LifeRatio) { charge -= 5; speed += 4; }
    if (lr < DATA.phase3LifeRatio) { tele -= 2; charge -= 5; speed += 5; }
    if (b.ex[2] % 2 === 1) vOff *= -1;
    if (b.veryFirst === 0) { b.t = descend; b.veryFirst = 1; }
    if (b.t <= descend) {   /* descend, fading out */
      b.contact = false;
      b.rot = Math.atan2(b.vy, b.vx) + PI / 2;
      b.vx = lerp(b.vx, 0, 0.08) * 0.967; b.vy = lerp(b.vy, sgn(vOff) * k(39), 0.08);
      if (b.vy < k(24)) b.vy += sgn(vOff) * k(2.5);
      b.op = lv(descend, descend - 16, b.t);
      b.hide = b.inv = b.op < 0.2;
      return;
    }
    if (b.t <= descend + tele) {   /* aim a telegraph line from below the target */
      if (b.t === descend + 1) {
        b.ex[0] = rnd() < 0.5 ? 0 : (rnd() < 0.5 ? -1 : 1) * rnd() * 150;
        teleport(hx() + k(b.ex[0]), hy() + k(vOff));
        b.vx = b.vy = 0; b.teld = ang(b.x, b.y, hx(), hy());
      }
      b.op = 0; b.contact = false; b.inv = true;
      b.tel = tri(lv(descend, descend + tele, b.t)) * 0.67;
      return;
    }
    if (b.t <= descend + tele + charge) {   /* charge, shedding ectoplasm sideways */
      if (b.t === descend + tele + 1) { b.vx = Math.cos(b.teld) * k(speed); b.vy = Math.sin(b.teld) * k(speed); roar(); }
      if (!b.ex[1] && dist(b.x, b.y, hx(), hy()) < k(1200) && sgn(vOff) === 1) { b.ex[1] = 1; fxs.push({ k: 'light', x: b.x, t: 0, d: 40 }); }
      if (b.t % rel === 0) {
        perp = unit(-b.vy, b.vx);
        for (i = -1; i <= 1; i += 2) {
          ecto(b.x, b.y, perp.x * i * k(rndRange(7.5, 23)) + rndRange(-0.9, 0.9), perp.y * i * k(rndRange(7.5, 23)) + rndRange(-0.9, 0.9), 0, 540);
          ecto(b.x, b.y, perp.x * i * k(13), perp.y * i * k(13), 1, 250);
        }
      }
      b.op = 1; b.rot = Math.atan2(b.vy, b.vx) + PI / 2;
      return;
    }
    b.t = 0; b.ex[1] = 0; b.ex[2]++;
    if (b.ex[2] >= count) selectNext();
  }

  function legSwipes() {   /* DoBehavior_LegSwipes :523 */
    var d = DATA.attacks.LegSwipes, trans = d.attackTransitionDelay, swingDelay = d.swingDelay, swipeTime = d.swipeTime, count = d.swipeCount, vrate = d.vortexReleaseRate;
    var hover = d.hoverSpeed, arc = d.swipeArc, lr = lifeRatio(), hOff = d.horizontalOffset, acc, ideal, u, order, l, sc, anim, offA, dir, dest, v, mv, dd;
    if (lr < DATA.phase2LifeRatio) { hOff += 50; vrate--; swipeTime += 4; }
    if (lr < DATA.phase3LifeRatio) swipeTime -= 10;
    acc = b.t < swingDelay ? 0.8 : 0.225;
    ideal = unit(hx() + side() * k(hOff) - b.x, hy() - k(225) - b.y);
    fly(ideal.x * k(hover), ideal.y * k(hover), k(acc));
    b.vy = lerp(b.vy, ideal.y * k(hover), 0.03);
    look();
    if (b.ex[1] === 1) { if (b.t >= trans) selectNext(); return; }
    if (b.t === swingDelay) {   /* pick one of the two legs in front */
      u = unit(hx() - b.x, hy() - b.y);
      order = b.legs.slice().sort(function (p, q) {
        var pa = Math.acos(clamp(u.x * unit(b.x - p.x, b.y - p.y).x + u.y * unit(b.x - p.x, b.y - p.y).y, -1, 1));
        var qa = Math.acos(clamp(u.x * unit(b.x - q.x, b.y - q.y).x + u.y * unit(b.x - q.x, b.y - q.y).y, -1, 1));
        return qa - pa;
      });
      b.legCtl = order[(rnd() * 2) | 0].i;
      return;
    }
    if (b.legCtl >= 0 && b.t > swingDelay) {
      l = b.legs[b.legCtl]; sc = ((b.t - swingDelay) % swipeTime) / swipeTime;
      anim = legAnim(sc); offA = (lerp(-arc, arc, anim) - 0.24) * l.dir;
      dir = rotv(unit(hx() - b.x, hy() - b.y).x, unit(hx() - b.x, hy() - b.y).y, offA);
      dest = { x: b.x + dir.x * k(tri(sc) * 100 + 350), y: b.y + dir.y * k(tri(sc) * 100 + 350) };
      dd = dist(l.x, l.y, dest.x, dest.y); mv = Math.min(dd, k(34)); u = unit(dest.x - l.x, dest.y - l.y);
      l.vx = u.x * mv; l.vy = u.y * mv;
      if (b.t % vrate === 0 && sc > 0.2 && sc < 0.6) {
        v = unit(l.x - b.x, l.y - b.y);
        vortex(l.x + v.x * k(3.2) * 4, l.y + v.y * k(3.2) * 4, v.x * k(3.2), v.y * k(3.2));
      }
      if ((b.t - swingDelay) % swipeTime === swipeTime - 1) {
        b.ex[0]++;
        if (b.ex[0] >= count) { b.t = 0; b.ex[1] = 1; b.legCtl = -1; }
      }
    }
  }

  function wisps() {   /* DoBehavior_WispCircleCharges :612 */
    var d = DATA.attacks.WispCircleCharges, hoverTime = d.hoverTime, count = d.chargeCount, slow = d.slowdownTime, chargeTime = d.chargeTime, per = d.ectoplasmPerRing;
    var step = d.offsetPerRing, maxR = d.maxRingOffset, speed = d.chargeSpeed, av = 0.75 * PI / 180, lr = lifeRatio(), ringN = 0, cw = 1, radius, i, hs, w, u, ox, oy;
    if (lr < DATA.phase2LifeRatio) { maxR += 300; speed += 2.7; av *= 1.2; }
    if (lr < DATA.phase3LifeRatio) { per += 2; speed += 3.5; }
    if (b.t === 1) {
      ox = hx(); oy = hy() - k(200);
      for (radius = 120; radius < maxR; radius += step) {
        ringN++;
        if (ringN >= 5) per = clamp(per + 6, 5, 36);
        for (i = 0; i < per; i++) add({ k: 'orbit', x: ox, y: oy, vx: 0, vy: 0, r: Math.max(3, k(6)), life: 1600, cx: ox, cy: oy, rad: k(radius), a: TAU * i / per, av: av * cw, hue: rnd() });
        cw = -cw;
      }
    }
    if (b.t < hoverTime) {
      hs = k(speed) * lv(0, hoverTime * 0.55, b.t) * 1.5;
      u = unit(hx() + side() * k(475) - b.x, hy() - k(175) - b.y);
      fly(u.x * hs, u.y * hs, k(0.55)); look();
      return;
    }
    w = (b.t - hoverTime) % (slow + chargeTime);
    if (w <= slow) {
      b.vx *= 0.925; b.vy *= 0.925; look();
      if (w === slow) { u = unit(hx() - b.x, hy() - b.y); b.vx = u.x * k(speed); b.vy = u.y * k(speed); roar(); }
    } else b.rot = Math.atan2(b.vy, b.vx) + PI / 2;
    if (w === slow + chargeTime - 1) { b.ex[0]++; if (b.ex[0] >= count) selectNext(); }
  }

  function asgore() {   /* DoBehavior_AsgoreRingSoulAttack :703, fought in the soul box (Infernum grants flight here; we hand the hero a Deltarune box) */
    var d = DATA.attacks.AsgoreRingSoulAttack, rings = d.ringCount, spr = d.soulsPerRing, rate = d.ringReleaseRate, create = d.ringCreationDelay, trans = d.attackTransitionDelay;
    var lr = lifeRatio(), factor = lerp(1, 1.84, 1 - lr), gap = 56 * PI / 180, i;
    b.contact = false; syncBox();
    if (b.ex[0] >= rings) {
      b.vx *= 0.9; b.vy *= 0.9;
      if (b.t >= trans) { fb.shots.length = 0; selectNext(); }
      return;
    }
    if (b.t === 1) { b.vx = b.vy = 0; fb.pulse = 12; }
    if (b.t === create) { roar(); fb.pulse = 20; }
    if (b.t >= create + 54 && b.t % rate === rate - 1 && b.ex[0] < rings) {
      b.ex[0]++;
      if (b.ex[0] >= rings) { b.souls = 0; b.t = 0; return; }
      boxRing(factor, gap, rnd() < 0.5);
    }
    look(); b.dr = 0.67;
  }

  function arcing() {   /* DoBehavior_ArcingSouls :938 */
    var d = DATA.attacks.ArcingSouls, delay = d.shootDelay, rate = d.shootRate, time = d.shootTime, trans = d.attackTransitionDelay, lr = lifeRatio(), cnt, speed, dir, i, off, u, dest, sh;
    cnt = Math.floor(lerp(5, 9, 1 - lr)); if (cnt % 2 !== 0) cnt++;
    speed = lerp(13, 16, 1 - lr);
    if (lr < DATA.phase2LifeRatio) rate -= 5;
    if (lr < DATA.phase3LifeRatio) rate -= 8;
    if (b.t < delay) { b.vx *= 0.95; b.vy *= 0.95; }
    else {
      dest = { x: hx() + side() * k(450), y: hy() - k(175) }; u = unit(dest.x - b.x, dest.y - b.y);
      b.vx = (b.vx * 19 + u.x * k(20)) / 20; b.vy = (b.vy * 19 + u.y * k(20)) / 20;
      if (b.t % rate === rate - 1 && b.t < time) {
        roar();
        for (dir = -1; dir <= 1; dir += 2) for (i = 0; i < cnt / 2; i++) {
          off = lerp(0.01, 1.47, i / (cnt / 2 - 1)) * dir;
          sh = rotv(unit(hx() - b.x, hy() - b.y).x, unit(hx() - b.x, hy() - b.y).y, off);
          add({ k: 'arc', x: b.x, y: b.y, vx: sh.x * k(speed), vy: sh.y * k(speed), r: k(16), life: 240, av: -off * 0.00825, cyan: (rnd() * 2) | 0 });
        }
      }
    }
    look();
    if (b.t >= delay + time + trans) selectNext();
  }

  function petal() {   /* DoBehavior_SpiritPetal :994 */
    var d = DATA.attacks.SpiritPetal, slow = d.slowdownTime, shootTime = d.shootTime, speed, dur = slow + shootTime, rate = b.enraged ? 4 : 6, att, offA, base, i, u, l, r;
    speed = k(lerp(7.11, 18.5, lv(slow, slow + 120, b.t)));
    b.vx *= 0.97; b.vy *= 0.97; look();
    if (b.t < slow - 10) { u = unit(hx() + side() * k(170) - b.x, hy() - k(250) - b.y); b.vx = (b.vx * 10 + u.x * k(21.5)) / 11; b.vy = (b.vy * 10 + u.y * k(21.5)) / 11; }
    if (b.t === 45) fxs.push({ k: 'light', x: hx(), t: 0, d: 40 });
    att = b.t >= slow && b.t < dur;
    if (att && b.t % rate === rate - 1) {
      offA = Math.sin(TAU * (b.t - 60) / 128) * PI / 3 + (rnd() * 2 - 1) * 0.16;
      u = unit(hx() - b.x, hy() - b.y); base = { x: b.x + u.x * k(44), y: b.y + u.y * k(44) };
      for (i = 0; i < 3; i++) {
        l = { x: Math.cos(TAU * i / 3 - offA) * speed, y: Math.sin(TAU * i / 3 - offA) * speed };
        r = { x: Math.cos(TAU * i / 3 + offA) * speed, y: Math.sin(TAU * i / 3 + offA) * speed };
        add({ k: 'soul', x: base.x + l.x * 2, y: base.y + l.y * 2, vx: l.x, vy: l.y, r: k(16), life: 300, home: 1, cyan: 1 });
        add({ k: 'soul', x: base.x + r.x * 2, y: base.y + r.y * 2, vx: r.x, vy: r.y, r: k(16), life: 300, home: 1, cyan: 1 });
        b.souls += 2;
      }
    }
    if (b.souls > 90) b.souls = 90;
    b.op = b.t < dur + 60 ? lv(slow + 45, slow, b.t) : lv(dur + 60, dur + 100, b.t);
    b.hide = b.op < 0.25; b.inv = b.hide;
    if (b.t >= dur + 135 && b.souls <= 15) selectNext();
  }

  function vortexCharge() {   /* DoBehavior_DoVortexCharge :1069 */
    var d = DATA.attacks.VortexCharge, count = d.chargeCount, aim = d.aimTime, slow = d.slowdownTime, chargeTime = d.chargeTime, lr = lifeRatio(), speed = k(lerp(35, 43, 1 - lr)), dest, u, i, v, rate;
    if (lr < DATA.phase2LifeRatio) count = 3;
    if (lr < DATA.phase3LifeRatio) count = 5;
    if (b.ex[0] === 0) aim += 60;
    if (b.t < aim) {
      look(); dest = { x: hx() + side() * k(240), y: hy() - k(300) };
      if (dist(b.x, b.y, hx(), hy()) < k(240)) { b.x = lerp(b.x, dest.x, 0.09); b.y = lerp(b.y, dest.y, 0.09); }
      u = unit(dest.x - b.x, dest.y - b.y); b.vx = (b.vx * 10 + u.x * speed) / 11; b.vy = (b.vy * 10 + u.y * speed) / 11;
    }
    if (b.t > aim && b.t < aim + slow) { b.vx *= 0.94; b.vy *= 0.94; look(); }
    if (b.t === aim + slow) {
      look(); roar(); u = unit(hx() - b.x, hy() - b.y); b.vx = u.x * speed; b.vy = u.y * speed;
      for (i = 0; i < 3; i++) { v = rotv(b.vx, b.vy, lerp(-0.21, 0.21, i / 2)); v = unit(v.x, v.y); vortex(b.x + v.x * k(11) * 4, b.y + v.y * k(11) * 4, v.x * k(11), v.y * k(11)); }
    }
    if (b.t >= aim + slow && b.t < aim + slow + chargeTime) {
      b.vx *= 1.005; b.vy *= 1.005;
      rate = b.enraged ? 2 : 4; if (lr < DATA.phase3LifeRatio) rate--;
      if (b.t % rate === rate - 1) {
        v = unit(-b.vy, b.vx);
        vortex(b.x + v.x * k(2.3) * 20, b.y + v.y * k(2.3) * 20, v.x * k(2.3), v.y * k(2.3));
        vortex(b.x - v.x * k(2.3) * 20, b.y - v.y * k(2.3) * 20, -v.x * k(2.3), -v.y * k(2.3));
      }
    }
    if (b.t >= aim + slow + chargeTime) { look(); b.vx = lerp(b.vx, 0, 0.1) * 0.9; b.vy = lerp(b.vy, 0, 0.1) * 0.9; }
    if (b.t >= aim + slow + chargeTime + slow * 2) { b.ex[0]++; b.t = 0; if (b.ex[0] >= count) selectNext(); }
  }

  function cloneSplit() {   /* DoBehavior_CloneSplit :1163 */
    var d = DATA.attacks.CloneSplit, totalCharges = d.totalCharges, cloneCount = d.cloneCount, splitDelay = d.splitDelay, hover = d.hoverTime, chargeTime = d.chargeTime, post = d.postChargeDelay;
    var cycle, adj, speed, u, dest, i, c, n, a, pos, charging, list;
    if (b.t < 90 + hover + chargeTime + post) splitDelay = 90;
    cycle = splitDelay + hover + chargeTime + post; speed = k(b.enraged ? 38 : 32);
    adj = b.t % cycle; b.ex[2] = adj; b.ex[3] = adj >= splitDelay + hover ? 1 : 0;
    if (adj < splitDelay + hover && dist(b.x, b.y, hx(), hy()) > k(300)) {
      dest = { x: hx() + side() * k(240), y: hy() - k(300) }; u = unit(dest.x - b.x, dest.y - b.y);
      b.vx = (b.vx * 15 + u.x * k(18)) / 16; b.vy = (b.vy * 15 + u.y * k(18)) / 16;
    }
    if (b.t === splitDelay) {
      for (i = 0; i < cloneCount; i++) b.clones.push({ x: b.x, y: b.y, vx: 0, vy: 0, rot: 0, op: 1 });
      for (i = 0; i < b.clones.length; i++) {
        a = TAU * i / b.clones.length; pos = { x: b.x + Math.sin(a) * k(540), y: b.y - Math.cos(a) * k(540) };
        while (dist(hx(), hy(), pos.x, pos.y) < k(380)) pos.y += k(10);
        b.clones[i].x = pos.x; b.clones[i].y = pos.y;
      }
    }
    if (adj > splitDelay + hover && adj < splitDelay + hover + chargeTime) { b.rot = Math.atan2(b.vy, b.vx) + PI / 2; b.vx *= 1.0145; b.vy *= 1.0145; }
    else { look(); if (adj > splitDelay + hover) { b.vx *= 0.97; b.vy *= 0.97; } }
    if (adj === splitDelay + hover) {
      for (i = 0; i < 19; i++) { a = TAU * i / 19; add({ k: 'nrs', x: b.x + Math.cos(a) * k(12.5) * 2, y: b.y + Math.sin(a) * k(12.5) * 2, vx: Math.cos(a) * k(12.5), vy: Math.sin(a) * k(12.5), r: k(16), life: 300, cf: 0, ex: 1, cyan: (rnd() * 2) | 0 }); }
      list = b.clones.concat([b]);
      for (i = 0; i < list.length; i++) { u = unit(hx() - list[i].x, hy() - list[i].y); list[i].vx = u.x * speed; list[i].vy = u.y * speed; }
    }
    if (b.t >= totalCharges * cycle) {
      for (i = 0; i < b.clones.length; i++) { c = b.clones[i]; for (n = 0; n < 18; n++) { a = Math.atan2(b.y - c.y, b.x - c.x) + rndRange(-0.4, 0.4); vis(c.x, c.y, Math.cos(a) * k(rndRange(15, 20)), Math.sin(a) * k(rndRange(15, 20)), 20, 0, (rnd() * 2) | 0); } }
      b.clones.length = 0; selectNext();
    }
  }
  function clonesLogic() {
    var i, c, u, spd2, dest;
    for (i = 0; i < b.clones.length; i++) {
      c = b.clones[i];
      if (b.ex[3] === 1) { u = unit(c.vx, c.vy); spd2 = Math.sqrt(b.vx * b.vx + b.vy * b.vy); c.vx = u.x * spd2; c.vy = u.y * spd2; c.rot = Math.atan2(c.vy, c.vx) + PI / 2; c.hot = 1; }
      else {
        c.hot = 0; c.rot = ang(c.x, c.y, hx(), hy()) + PI / 2;
        if (b.ex[2] < 40 && dist(c.x, c.y, hx(), hy()) > k(300)) {
          dest = { x: hx() + (hx() < c.x ? 1 : -1) * k(240), y: hy() - k(300) }; u = unit(dest.x - c.x, dest.y - c.y);
          c.vx = (c.vx * 15 + u.x * k(18)) / 16; c.vy = (c.vy * 15 + u.y * k(18)) / 16;
        } else { c.vx *= 0.97; c.vy *= 0.97; }
      }
      c.x += c.vx; c.y += c.vy; pen(c);
      if (!fb.on && c.hot && heroHit(c.x, c.y, k(40))) hurtHero(1, sgn(hx() - c.x));
    }
    if (b.clones.length && b.atk !== 'CloneSplit') b.clones.length = 0;
  }
  function roar() { if (NEU.juice && NEU.juice.hit && !P.replaying()) NEU.juice.hit('small', { colour: COL.ecto }); }

  /* ── death animation and the desperation attack ───────────────────── */
  function death() {   /* DoBehavior_DeathAnimation :326 */
    var d = DATA.attacks.DeathAnimation, slowT = d.slowdownTime, focusDelay = d.screenFocusDelay, explode = d.explodeDelay, a, v, i;
    b.contact = false; b.inv = true; b.clones.length = 0;
    b.vx *= 0.955; b.vy *= 0.955; b.dying++;
    if (slowT + 30 - b.dying > 0 && b.dying > 45) b.rot = b.rot + (ang(b.x, b.y, hx(), hy()) + PI / 2 - b.rot) * lv(slowT + 30, 45, b.dying);
    if (b.dying > slowT && b.dying % 2 === 0 && b.souls < 60) {
      a = rnd() * TAU; v = k(rndRange(7, 13));
      vis(b.x + Math.cos(a) * v * 5, b.y + Math.sin(a) * v * 5, Math.cos(a) * v, Math.sin(a) * v, 200, 0, (rnd() * 2) | 0); b.souls++;
    }
    if (b.souls >= 60) {
      a = rnd() * TAU; v = 2.25 * K;
      if (b.dx && b.dy) { b.x = b.dx + Math.cos(a) * v; b.y = b.dy + Math.sin(a) * v; }
      if (b.dying !== explode - 2) { b.dx = b.x; b.dy = b.y; }
      if (b.dying > explode - 10) { a = rnd() * TAU; v = k(rndRange(5, 9)); vis(b.x + Math.cos(a) * v * 5, b.y + Math.sin(a) * v * 5, Math.cos(a) * v, Math.sin(a) * v, 200, 0, (rnd() * 2) | 0); }
      if (b.dying === explode) {
        for (i = 0; i < 125; i++) { a = rnd() * TAU; v = k(rndRange(9, 23)); vis(b.x + Math.cos(a) * v * 5, b.y + Math.sin(a) * v * 5, Math.cos(a) * v, Math.sin(a) * v, 200, 0, (rnd() * 2) | 0); }
        if (NEU.juice && NEU.juice.hit) NEU.juice.hit('large', { colour: COL.ecto });
        selectNext();
      }
      if (b.dying >= explode) { b.x = hx(); b.y = hy(); b.dying = 0; }
    } else if (b.dying > slowT + focusDelay) {
      if (!b.dx || !b.dy) { b.dx = b.x; b.dy = b.y; b.vx = b.vy = 0; }
      b.dying = slowT + focusDelay - 10;
    }
  }
  function desperation() {   /* DoBehavior_DesperationAttack :1285, fought in the soul box */
    var d = DATA.attacks.DesperationAttack, fade = d.vignetteFadeinTime, delay = d.attackDelay, spiralN = d.vortexSpiralCount, spiralRate = d.vortexSpiralSpawnRate, spiralT = d.vortexSpiralTime, flameT = d.spiritFlameTime;
    var rate = d.ringReleaseRate, gap = 55 * PI / 180, fin = delay + spiralT + flameT, i, a, sp, u, ccx, ccy, R0;
    if (!b.ex[0]) b.ex[0] = 27;
    b.inv = true; b.op = 0; b.contact = false; syncBox();
    b.vx = b.vy = 0;
    b.vig = lv(0, fade, b.t);
    ccx = fb.AX + fb.AW / 2; ccy = fb.AY + fb.AH / 2; R0 = Math.sqrt(fb.AW * fb.AW + fb.AH * fb.AH) / 2 + 14;
    if (b.t < delay) return;
    if (b.t < delay + spiralT) {   /* spirals of vortices from the edge inward */
      if (b.t % spiralRate === 0 && b.t < delay + spiralT - 70) {
        sp = (b.t - delay) / spiralT * PI * 4;
        for (i = 0; i < spiralN; i++) { a = TAU * i / spiralN + sp; boxShot('vort', ccx + Math.cos(a) * R0, ccy + Math.sin(a) * R0, -Math.cos(a) * 1.4, -Math.sin(a) * 1.4, 5, COL.cyan, { max: 6 }); }
      }
      return;
    }
    if (b.t < fin) {   /* the fast Asgore rings */
      if (b.t === delay + spiralT + 1) for (i = fb.shots.length - 1; i >= 0; i--) if (fb.shots[i].kind === 'vort') fb.shots.splice(i, 1);
      if (b.t % rate === rate - 1 && b.t < fin - 120) boxRing(d.overallRingSpeedFactor, gap, rnd() < 0.5);
      return;
    }
    for (i = fb.shots.length - 1; i >= 0; i--) if (fb.shots[i].kind === 'spin') fb.shots.splice(i, 1);
    if (b.t >= fin + b.ex[0] && b.ex[1] < d.soulBurstCount) {   /* telegraphed barrages, faster each time */
      b.ex[0] = clamp(b.ex[0] - 1, 15, 36); b.t = fin; b.ex[1]++;
      a = PI / 2 + rndRange(-0.98, 0.98); u = unit(-Math.cos(a) * R0 + rndRange(-fb.AW * 0.4, fb.AW * 0.4), -Math.sin(a) * R0 + rndRange(-fb.AH * 0.4, fb.AH * 0.4));
      boxShot('tele', ccx + Math.cos(a) * R0, ccy + Math.sin(a) * R0, u.x, u.y, 0, COL.cyan, { life: 24 });
    }
    if (b.t >= fin + b.ex[0] + 120) {
      b.vigDec = lerp(b.vigDec, 0, 0.12);
      b.vig = lv(fin + b.ex[0] + 240, fin + b.ex[0] + 120, b.t);
      if (b.t === fin + b.ex[0] + 120 && !b.looted) { b.looted = 1; endFight(); }
      if (b.t >= fin + b.ex[0] + 175) { b.done = true; boxClose(); }
    } else {
      b.vigDec = lerp(b.vigDec, clamp((b.t - (fin + b.ex[0])) / 72, 0, 1) * 0.995, 0.15);   /* the box closes in on the soul */
    }
  }
  function endFight() {   /* the loot beat: the one finish authority records the kill */
    if (P.replaying()) return;
    if (!rem && NEU.polt && NEU.polt.finish) NEU.polt.finish();   /* a rematch on a cleared save pays nothing twice */
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', -1);
    exitIn = 210;
  }

  /* ── the brain: PreAI :169 ─────────────────────────────────────────── */
  function brain() {
    var ph, i, l, still;
    if (b.mode === 'death') { if (b.flash > 0) b.flash--; if (!b.done) AIS.death.step(env); return; }
    ph = phaseOf();
    b.enraged = hy() < 2 * T;   /* Infernum: boss above the world surface. Here: the hero out through the roof */
    if (b.phase !== ph) {
      b.phase = ph; b.cycle = 0;
      if (NEU.poltFx && NEU.poltFx.card) NEU.poltFx.card(NAMES[ph]);
      if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', ph + 1);
      if (NEU.juice && NEU.juice.hit) NEU.juice.hit('large', { colour: COL.ecto });
    }
    if (b.souls < 0) b.souls = 0;
    if (b.flash > 0) b.flash--;
    if (b.dying > 0) { death(); b.x += b.vx; b.y += b.vy; return; }
    b.contact = true; b.hide = false; b.inv = false; b.dr = 0.1; b.tel = 0;
    if (!b.veryFirst) b.op = 0;
    b.scale = lerp(1.225, 0.68, clamp(b.souls / 60, 0, 1));
    if (b.clones.length) b.scale = lerp(0.7, 1.225, clamp(1 - b.clones.length / 2, 0, 1));
    still = fb.on && fb.pop > 0;   /* the pop and the breath: the attack waits at its first frame */
    if (still) { fb.pop--; if (b.atk === 'AsgoreRingSoulAttack') b.dr = 0.67; }   /* his guard is up from the first frame */
    else switch (b.atk) {
      case 'LegSwipes': legSwipes(); break;
      case 'WispCircleCharges': wisps(); break;
      case 'AsgoreRingSoulAttack': asgore(); break;
      case 'EctoplasmUppercutCharges': uppercut(); break;
      case 'ArcingSouls': arcing(); break;
      case 'SpiritPetal': petal(); break;
      case 'VortexCharge': vortexCharge(); break;
      case 'CloneSplit': cloneSplit(); break;
      case 'DesperationAttack': desperation(); break;
    }
    if (b.hide) b.contact = false;
    legsLogic(); clonesLogic();
    if (!still) b.t++;
    b.x += b.vx; b.y += b.vy;
    pen(b);
    b.w = k(90) * b.scale; b.h = k(120) * b.scale;
    if (!fb.on && b.contact && b.op > 0.2 && !b.hide && Math.abs(hx() - b.x) < P.hw + b.w / 2 && Math.abs(hy() - b.y) < P.hh / 2 + b.h / 2) hurtHero(1, sgn(hx() - b.x));
    if (!fb.on && b.legCtl >= 0) { l = b.legs[b.legCtl]; if (heroHit(l.x, l.y, k(30))) hurtHero(1, sgn(hx() - l.x)); }
  }
  function hitBoss(n) {
    if (!b || b.done || b.inv || b.hide || b.dying > 0 || b.op < 0.2) return false;
    n = NEU.boss && NEU.boss.hit ? NEU.boss.hit(n) : n;
    b.hp -= n * (1 - b.dr); b.flash = 6; bb.hitAt = bb.clock;
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small');
    if (b.hp <= 0 && b.mode === 'death') {   /* the Death-mode fight just ends: a burst of souls and the loot beat */
      b.hp = 0; b.done = true; b.inv = true; b.clones.length = 0; boxClose();
      var q, ra, rv;
      for (q = 0; q < 60; q++) { ra = rnd() * TAU; rv = k(rndRange(7, 20)); vis(b.x, b.y, Math.cos(ra) * rv, Math.sin(ra) * rv, 120, 0, (rnd() * 2) | 0); }
      if (NEU.juice && NEU.juice.hit) NEU.juice.hit('large', { colour: COL.ecto });
      endFight();
    } else if (b.hp <= 0) {   /* CheckDead :1576: he does not die, he starts to; every hostile shot goes first, or the returning souls would keep eating the release count */
      b.hp = 1; b.dying = 1; b.despair = 1; b.inv = true; b.souls = 0; shots.length = 0;
    }
    return true;
  }
  function axe(h, down, charged) {   /* the swing arrives in world px; the boss is chamber-local */
    var hx0 = h.x - OXP, hy0 = h.y - OYP;
    var x0 = down ? hx0 - (charged ? 26 : 14) : h.face > 0 ? hx0 - (charged ? 2 : 0) : hx0 - (charged ? 48 : 30);
    var x1 = down ? hx0 + (charged ? 26 : 14) : h.face > 0 ? hx0 + (charged ? 48 : 30) : hx0 + (charged ? 2 : 0);
    var y0 = down ? hy0 - (charged ? 8 : 4) : hy0 - (charged ? 44 : 30), y1 = down ? hy0 + (charged ? 26 : 18) : hy0 + (charged ? 8 : 2);
    if (b && b.x + b.w / 2 > x0 && b.x - b.w / 2 < x1 && b.y + b.h / 2 > y0 && b.y - b.h / 2 < y1 && hitBoss(charged ? 2 : 1)) return 1;
    return 0;
  }
  /* the one fixed-step entry, called by dgn-foes' tick after the shared kit step. true = the fight owns this tick (foes sleep). Idle, it only watches the threshold. */
  function step(dt) {
    var i, f;
    if (P.replaying()) return false;
    if (state === 'idle') { watch(); if (state !== 'active') return false; }
    bb.clock += dt;
    if (!b) return true;
    frame++;
    if (NEU.poltFx && NEU.poltFx.step) NEU.poltFx.step(1 / 60);
    if (!b.done) brain();
    updateShots();
    if (fb.on && b && fb.F) boxTick();
    if (fb.outT > 0) fb.outT--;
    for (i = fxs.length - 1; i >= 0; i--) { f = fxs[i]; f.t++; if (f.t >= f.d) fxs.splice(i, 1); }
    if (exitIn > 0 && --exitIn === 0 && !exitTimer) exitTimer = setTimeout(function () { exitTimer = 0; if (NEU.dungeon && NEU.dungeon.toSurface) NEU.dungeon.toSurface({ won: true }); }, 0);
    return true;
  }

  /* ── drawing: one layer above the light map ───────────────────────── */
  function glow(c, x, y, r, col, a) { if (P.glow) P.glow(c, x, y, r, col, a); else { c.globalAlpha = a; c.fillStyle = col; c.fillRect((x - r / 2) | 0, (y - r / 2) | 0, r, r); c.globalAlpha = 1; } }
  function drawLeg(c, l) {
    var tt = 0, pts = [], i, u, bend = k(40) * l.dir, p, q, red = l.red;
    u = unit(l.x - b.x, l.y - b.y);
    for (i = 0; i <= 3; i++) { p = i / 3; pts.push({ x: lerp(b.x, l.x, p) - u.y * bend * Math.sin(p * PI), y: lerp(b.y, l.y, p) + u.x * bend * Math.sin(p * PI) }); }
    c.lineWidth = 4; c.strokeStyle = COL.ink; c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (i = 1; i < 4; i++) c.lineTo(pts[i].x, pts[i].y); c.stroke();
    c.lineWidth = 2; c.strokeStyle = red > 0.6 ? COL.red : COL.ecto; c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (i = 1; i < 4; i++) c.lineTo(pts[i].x, pts[i].y); c.stroke();
    glow(c, l.x, l.y, 16, red > 0.6 ? COL.red : COL.ecto, 0.5);
  }
  function drawBody(c, x, y, sc, rot, op, frameN) {
    var ok;
    c.globalAlpha = clamp(op, 0, 1);
    ok = NEU.sheetDraw && NEU.sheetDraw(c, 'polter', x, y, { scale: sc, glowKeys: ['polterG1', 'polterG2'], rot: rot, frame: frameN, now: P.reduced() ? 0 : frame * 16.7 });
    if (!ok) { glow(c, x, y, 60 * sc, COL.ecto, 0.6); c.fillStyle = COL.cyan; c.fillRect((x - 6) | 0, (y - 8) | 0, 12, 16); }
    c.globalAlpha = 1;
  }
  /* Infernum's own projectile sheets (32x32 frames in a strip, GhostlyVortex one 60x60), read from local-assets/infernum/ when the folder is there.
     The folder is local-only (rights review: AGENTS.md); without it every shot keeps its drawn stand-in. */
  var INF = { spin: 'SpinningSoul', arc: 'ArcingSoul', soul: 'NotSpecialSoul', nrs: 'NonReturningSoul', nrsC: 'SoulLargeCyan', vortex: 'GhostlyVortex', vort: 'GhostlyVortex' }, infImg = {};
  function infSpr(c, kind, x, y, size, age, rot, alpha) {
    var nm = INF[kind], im, fw, n, fi;
    if (!nm || typeof Image === 'undefined') return false;
    im = infImg[nm];
    if (im === undefined) { im = infImg[nm] = new Image(); im.onerror = function () { infImg[nm] = null; }; im.src = 'local-assets/infernum/' + nm + '.png'; }
    if (!im || !im.complete || !im.naturalWidth) return false;
    fw = im.naturalHeight > im.naturalWidth * 1.5 ? im.naturalWidth : im.naturalWidth; n = Math.max(1, Math.round(im.naturalHeight / fw)); fi = P.reduced() ? 0 : ((age / 5) | 0) % n;
    c.save(); c.globalAlpha = clamp(alpha, 0, 1); c.translate(x, y); if (rot) c.rotate(rot); c.imageSmoothingEnabled = false;
    c.drawImage(im, 0, fi * fw, fw, fw, -size / 2, -size / 2, size, size); c.restore();
    return true;
  }
  function drawShot(c, s) {
    var col = s.cyan ? COL.cyan : COL.pink, a = clamp(s.op, 0, 1), rr = Math.max(s.r * 2.2, 8), i;
    if (s.k === 'tele') {
      c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.dy, s.dx)); c.globalAlpha = a * 0.4; c.fillStyle = COL.cyan; c.fillRect(0, -k(35), k(5000), k(70)); c.restore(); c.globalAlpha = 1; return;
    }
    if (s.k === 'ecto') { for (i = 0; i + 1 < s.trail.length; i += 4) glow(c, s.trail[i], s.trail[i + 1], rr * (1 - i / 14), s.hue < 0.5 ? COL.pink : COL.cyan, a * 0.25); col = s.hue < 0.5 ? COL.pink : COL.cyan; }
    if (s.k === 'orbit') col = s.hue < 0.5 ? COL.pink : COL.cyan;
    glow(c, s.x, s.y, rr * 1.6, col, a * 0.35);
    if (infSpr(c, s.k === 'nrs' && s.cyan ? 'nrsC' : s.k, s.x, s.y, Math.max(s.r * 2.6, 14), s.age || 0, s.k === 'vortex' ? s.rot : (s.vx || s.vy) ? Math.atan2(s.vy, s.vx) + PI / 2 : 0, a)) return;
    c.globalAlpha = a; c.fillStyle = col; c.fillRect((s.x - s.r / 2) | 0, (s.y - s.r / 2) | 0, Math.max(2, s.r), Math.max(2, s.r));
    if (s.k === 'vortex') { c.strokeStyle = COL.cyan; c.beginPath(); c.moveTo(s.x + Math.cos(s.rot) * s.r, s.y + Math.sin(s.rot) * s.r); c.lineTo(s.x - Math.cos(s.rot) * s.r, s.y - Math.sin(s.rot) * s.r); c.stroke(); }
    c.globalAlpha = 1;
  }
  function hudWorld(c, cx, cy) {   /* inside dgn-foes' translate(-cx, -cy): the chamber-local layer first, then the soul box in world space */
    var i, s, f, R, v = P.view(), fr = ((frame / 7) | 0) % 4, ph;
    if (!b) return;
    c.save(); c.translate(OXP, OYP);
    /* the fight is held inside the chamber: its air (two tiles of wall all round) and the mouth corridor. Anything else is masonry and never shows a boss, a tentacle or a shot. */
    c.beginPath(); c.rect(2 * T, 2 * T, (ARENA_W - 4) * T, (ARENA_H - 4) * T); c.rect(0, 137 * T - OYP, 2 * T, 4 * T); c.clip();
    if (b.tel > 0) { c.save(); c.translate(b.x, b.y); c.rotate(b.teld); c.globalAlpha = b.tel * 0.6; c.fillStyle = COL.cyan; c.fillRect(0, -k(40), k(5000), k(80)); c.restore(); c.globalAlpha = 1; }
    for (i = 0; i < fxs.length; i++) {
      f = fxs[i];
      if (f.k === 'ring') { c.strokeStyle = COL.cyan; c.globalAlpha = 1 - f.t / f.d; c.beginPath(); c.arc(f.x, f.y, f.r + f.t * 2, 0, TAU); c.stroke(); c.globalAlpha = 1; }
      else if (f.k === 'light') { c.globalAlpha = tri(f.t / f.d) * 0.4; c.fillStyle = COL.pink; c.fillRect((f.x - 20) | 0, (cy - OYP) | 0, 40, v.h); c.globalAlpha = 1; }
    }
    if (b.mode === 'death' && b.d) { for (i = 0; i < b.d.hooks.length && !b.done; i++) { c.lineWidth = 2; c.strokeStyle = COL.ecto; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.d.hooks[i].x, b.d.hooks[i].y); c.stroke(); glow(c, b.d.hooks[i].x, b.d.hooks[i].y, 24, COL.cyan, 0.6); } }
    else for (i = 0; i < b.legs.length; i++) if (!b.done && b.op > 0) drawLeg(c, b.legs[i]);
    for (i = 0; i < shots.length; i++) drawShot(c, shots[i]);
    if (!b.done) {
      for (i = 0; i < b.clones.length; i++) drawBody(c, b.clones[i].x, b.clones[i].y, K * 0.7, b.clones[i].rot, 1, b.phase * 4 + fr);
      ph = b.phase;
      if (b.enraged || ph === 2) glow(c, b.x, b.y, 90 * K * b.scale * 2, b.enraged ? COL.red : COL.cyan, 0.18 * b.op);
      drawBody(c, b.x, b.y, K * b.scale, b.rot, b.op, ph * 4 + fr);
      if (b.flash > 0) glow(c, b.x, b.y, 80 * K * b.scale, '#FFFFFF', 0.4);
    }
    c.restore();
    if (fb.on) {   /* the soul box: the world dims, a black box with a white rim opens, the soul fights inside it */
      var R2 = fbRect(), bxx = cx + R2.AX, byy = cy + R2.AY, h2 = hero(), j, q, pu = P.reduced() ? 1 : clamp(fb.t / POP_N, 0, 1), po = 1 - (1 - Math.pow(1 - pu, 3));
      c.fillStyle = 'rgba(4,3,10,' + (0.62 * pu).toFixed(3) + ')'; c.fillRect(cx - 8, cy - 8, v.w + 16, v.h + 16);
      c.save(); c.translate(po * (h2.x - (cx + fb.AX + fb.AW / 2)), po * (h2.y - P.hh / 2 - (cy + fb.AY + fb.AH / 2)));   /* the box opens out of the hero */
      if (!b.done && b.atk === 'AsgoreRingSoulAttack') drawBody(c, cx + fb.AX + fb.AW / 2, byy - 44, K * 1.7, 0, 1, b.phase * 4 + fr);
      glow(c, bxx + R2.AW / 2, byy + R2.AH / 2, R2.AW * 0.75, COL.ecto, 0.1 + (fb.pulse > 0 ? 0.12 : 0));
      c.fillStyle = '#FFFFFF'; c.fillRect(bxx - 3, byy - 3, R2.AW + 6, R2.AH + 6);
      c.fillStyle = '#000000'; c.fillRect(bxx, byy, R2.AW, R2.AH);
      for (j = 0; j < fb.shots.length; j++) {
        q = fb.shots[j];
        if (q.kind === 'tele') { c.save(); c.translate(cx + q.x, cy + q.y); c.rotate(Math.atan2(q.uy, q.ux)); c.globalAlpha = tri(q.age / q.life) * 0.55; c.fillStyle = COL.cyan; c.fillRect(0, -7, 700, 14); c.restore(); c.globalAlpha = 1; continue; }
        if (!infSpr(c, q.kind, cx + q.x, cy + q.y, Math.max(q.r * 3.4, 14), q.age, q.kind === 'vort' ? q.age * 0.2 : (q.vx || q.vy) ? Math.atan2(q.vy, q.vx) + PI / 2 : 0, 1)) dm.drawBullet(c, { x: cx + q.x, y: cy + q.y, r: q.r, c: q.c });
      }
      c.save(); c.translate(cx, cy); dm.drawFX(c, fb.F, h2.inv); c.restore();
      dm.soul.draw(c, (cx + fb.F.x) | 0, (cy + fb.F.y) | 0, h2.inv > 0 ? h2.inv : (fb.F.dashI > 0 ? 0.1 : 0), null);
      c.restore();
    } else if (fb.outT > 0 && fb.outR) {   /* the fold-back: the box shrinks into the hero while the world brightens */
      var u2 = fb.outT / OUT_N, h3 = hero(), s2 = u2 * u2, o = fb.outR, ccx = lerp(h3.x, cx + o.AX + o.AW / 2, s2), ccy = lerp(h3.y - P.hh / 2, cy + o.AY + o.AH / 2, s2);
      c.fillStyle = 'rgba(4,3,10,' + (0.62 * u2).toFixed(3) + ')'; c.fillRect(cx - 8, cy - 8, v.w + 16, v.h + 16);
      c.fillStyle = '#FFFFFF'; c.fillRect(ccx - o.AW * s2 / 2 - 3, ccy - o.AH * s2 / 2 - 3, o.AW * s2 + 6, o.AH * s2 + 6);
      c.fillStyle = '#000000'; c.fillRect(ccx - o.AW * s2 / 2, ccy - o.AH * s2 / 2, o.AW * s2, o.AH * s2);
    }
  }
  function hudScreen(c) {   /* on screen pixels: the name card and the boss bar */
    var v = P.view(), hs, gates;
    if (!b) return;
    if (NEU.poltFx && NEU.poltFx.drawCard) NEU.poltFx.drawCard(c, (v.w / 2) | 0, 70, { reduced: P.reduced() });
    if (!b.done) {   /* the boss bar is the Scal / Console one (danmaku.js bossBar), in CSS px, ticks at the 65 % and 35 % gates */
      gates = b.mode === 'death' && AIS.death ? AIS.death.gates : [DATA.phase2LifeRatio, DATA.phase3LifeRatio];
      hs = NEU.tphud && NEU.tphud.scale ? NEU.tphud.scale() : 1;   /* the Scal fight's HUD scale: same bar size at every window */
      c.save(); c.scale(hs / v.scale, hs / v.scale);
      dm.bossBar(c, bb, { w: Math.round(v.w * v.scale / hs), name: NAMES[b.phase], hp: b.hp, max: b.hpMax, ticks: gates, invuln: !!b.inv });
      c.restore();
    }
  }
  /* the Bot tier: dodges for the hero when no real key is held, and swings when the boss is close. A real key ends the assist at once.
     It plays out 18 frames of each choice against the shots' straight-line paths and takes the least dangerous. */
  var botAct = 'none', botT = 0;
  function danger(x, y, t) {
    var s, i, px, py, d, r, sum = 0, bx, by;
    for (i = 0; i < shots.length; i++) {
      s = shots[i]; if (!(s.dmg > 0) || s.op < 0.3) continue;
      px = s.x + (s.vx || 0) * t; py = s.y + (s.vy || 0) * t; d = Math.sqrt((px - x) * (px - x) + (py - y) * (py - y)); r = s.r + 16;
      if (d < r) sum += 100; else if (d < r + 22) sum += (r + 22 - d);
    }
    if (b.contact && b.op > 0.2) { bx = b.x + b.vx * t; by = b.y + b.vy * t; d = Math.sqrt((bx - x) * (bx - x) + (by - y) * (by - y)); if (d < b.w / 2 + 60) sum += 100; else if (d < b.w / 2 + 130) sum += (b.w / 2 + 130 - d) * 0.6; }
    if (b.tel > 0) { /* the charge lane: stay off the line */
      d = Math.abs(-Math.sin(b.teld) * (x - b.x) + Math.cos(b.teld) * (y - b.y)); if (d < k(90)) sum += 60; }
    if (x < 40 || x > ARENA_W * T - 40) sum += 30;
    return sum;
  }
  var ACTS = { dashL: [-1, 0, 0, 1], dashR: [1, 0, 0, 1], none: [0, 0, 0], left: [-1, 0, 0], right: [1, 0, 0], jump: [0, -1, 1], jl: [-1, -1, 1], jr: [1, -1, 1], up: [0, -1, 0], down: [0, 1, 0], ul: [-1, -1, 0], ur: [1, -1, 0], dl: [-1, 1, 0], dr: [1, 1, 0] };
  function assist(keys) {
    var h = hero(), fl = P.flying && P.flying(), names, i, a, c, t, x, y, vy, best = 'none', bestV = 1e9, v, out, k2, d0, hxl = h.x - OXP, hyl = h.y - OYP;   /* the dodge planner thinks in chamber px */
    if (fb.on) { fb.keys = keys; return null; }   /* the soul reads the real keys itself; the held hero ignores them */
    if (!b || b.mode === undefined || !botOn() || P.replaying() || h.dead > 0 || b.done) return null;
    for (k2 in keys) if (keys[k2] && k2 !== 'melee') return null;   /* a real key: the player drives */
    botT++;
    names = fl ? ['none', 'left', 'right', 'up', 'down', 'ul', 'ur', 'dl', 'dr'] : ['none', 'left', 'right', 'jump', 'jl', 'jr'];
    if (h.dashes > 0 && h.dashCd <= 0) names = names.concat(['dashL', 'dashR']);
    for (i = 0; i < names.length; i++) {
      a = ACTS[names[i]]; v = 0; vy = fl ? 0 : (a[2] ? -3.5 : (h.onGround ? 0 : h.vy / 60));
      for (t = 3; t <= 18; t += 3) {
        x = hxl + a[0] * (a[3] ? 8 * Math.min(t, 9) : (fl ? 5 : 3) * t); y = hyl - P.hh / 2 + (fl ? a[1] * 5 * t : vy * t + (h.onGround && !a[2] ? 0 : 0.25 * t * t));
        v += danger(x, y, t);
      }
      if (names[i] === botAct) v -= 4;   /* hysteresis */
      if (v < bestV) { bestV = v; best = names[i]; }
    }
    botAct = best; a = ACTS[best];
    out = { left: a[0] < 0, right: a[0] > 0, up: a[1] < 0 && fl, down: a[1] > 0, jump: !fl && !!a[2], dash: !!a[3] };
    d0 = Math.abs(b.x - hxl) + Math.abs(b.y - (hyl - P.hh / 2));
    if (D_.autoplay && d0 < 70 && botT % 14 === 0) out.melee = true;   /* the Bot tier only dodges; swinging and shooting for you is the unattended autoplay harness's job */
    if (D_.autoplay && botT % 18 === 0) hitBoss(1);   /* the Bot tier attacks for you at the soul fight's pace (boss-polt.js autoN % 18); hitBoss refuses while he is hidden */   /* the soul shot, as often as the strip allows */
    return out;
  }
  /* ── the chamber: the geometry belongs to dungeon.js (CH); this is the fight's own state, idle | active ── */
  function flagged(k) { return !!(NEU.save && NEU.save.flagged && NEU.save.flagged(k)); }
  function tierHp() { return NEU.boss && NEU.boss.playerHp ? NEU.boss.playerHp(6) : 6; }
  function reset() {
    var h = hero();
    b = newBoss(); shots.length = 0; fxs.length = 0; frame = 0; exitIn = 0; bb.chip = 1; bb.hitAt = -9; bb.hudAt = bb.clock;
    if (exitTimer) { clearTimeout(exitTimer); exitTimer = 0; }
    boxClose(true);
    if (NEU.poltFx && NEU.poltFx.clear) NEU.poltFx.clear();
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', 1);
    if (kit && h) kit.hp = h.hp;
  }
  /* the hero is past the inner threshold with the gate open: seal it, raise the tier's hearts, wake the boss. Once. */
  function engage(rematchRun) {
    var L = P.level0(), h = hero();
    if (state !== 'idle' || !L || L.id !== 'dgn' || P.replaying()) return false;
    if (NEU.boss && NEU.boss.open) NEU.boss.open('plat');   /* the fight is a fresh open: the tier is read once, here */
    state = 'active'; rem = !!rematchRun || flagged('polt_dead'); cap0 = L.hp; spawn0 = L.spawn;
    if (NEU.dungeon) { NEU.dungeon.mapOpen = false; if (NEU.dungeon.gate) NEU.dungeon.gate.seal(); }
    L.hp = tierHp(); h.hp = L.hp;
    L.spawn = { x: CH.x + CH.spawn.x, y: CH.y + CH.spawn.y };   /* the retry anchor, only until the encounter lets go */
    kit = NEU.dgnFoes && NEU.dgnFoes.kit ? NEU.dgnFoes.kit() : null;
    if (kit) kit.maxHp = L.hp;
    L.kit = kit;   /* tphud docks its hearts and TP bar on the live level's kit */
    reset();
    if (NEU.poltFx && NEU.poltFx.card) NEU.poltFx.card(NAMES[0]);   /* the name card, not a text box: the fight must not wait on a dismiss */
    return true;
  }
  function watch() {
    var h = hero(), G = NEU.dungeon && NEU.dungeon.gate, L = P.level0();
    if (!G || !L || L.id !== 'dgn' || G.state() !== 'open' || h.dead > 0 || flagged('polt_dead')) return;
    if (h.x >= CH.inner * T && h.y >= CH.y * T) engage(false);
  }
  /* a fight death: plat has put the hero back at the anchor with the tier's full hearts; the boss starts over */
  function retry() {
    var L = P.level0(), h = hero();
    if (state !== 'active' || !b || b.done) return;
    reset();
    if (kit) { kit.maxHp = L.hp; kit.hp = h.hp; }
  }
  /* leave the encounter (a close, a win's walk home, a test): holds, shots, music, the delayed exit and the borrowed spawn and cap all go back */
  function abort() {
    var L = P.level0(), h = hero();
    if (exitTimer) { clearTimeout(exitTimer); exitTimer = 0; }
    boxClose(true); shots.length = 0; fxs.length = 0; exitIn = 0;
    if (NEU.poltFx && NEU.poltFx.clear) NEU.poltFx.clear();
    if (state === 'active') {
      if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', -1);
      if (L && L.id === 'dgn') { L.hp = cap0; L.spawn = spawn0 || L.spawn; delete L.kit; if (h && h.hp > L.hp) h.hp = L.hp; }
    }
    b = null; kit = null; state = 'idle';
  }
  function rematch() { return state === 'idle' && flagged('polt_dead') ? engage(true) : false; }
  /* test and capture hook: plays the real keyed entry (stand at the bone door, strike it, walk in) through the plat step. The player's way is the same door and threshold; no separate level, no teleport into the chamber. */
  function begin() {
    var h, G = NEU.dungeon && NEU.dungeon.gate, L, d = null, i, n = 0;
    if (state === 'active') abort();
    if (!P.running() || P.levelId() !== 'dgn') P.open('d10');
    L = P.level0();
    for (i = 0; L && L.entities && i < L.entities.length; i++) if (L.entities[i].t === 'bossdoor') d = L.entities[i];
    if (!d || !G) return false;
    h = hero(); h.x = (d.x - 0.4) * T; h.y = (d.y + 1) * T; h.vx = h.vy = 0; P.snap();
    if (G.state() === 'closed') P.step(1 / 60, { melee: true });
    while (state !== 'active' && n++ < 600) P.step(1 / 60, G.state() === 'open' ? { right: true } : {});
    return state === 'active';
  }
  function targets() { return b && !b.inv && !b.hide && !b.done && b.dying === 0 && b.op >= 0.2 ? [{ x: b.x + OXP, y: b.y + OYP, w: b.w, h: b.h, r: Math.min(b.w, b.h) / 2, hp: b.hp, d: { hp: 1 }, boss: 1 }] : []; }
  function damage(t, n, kind) { if (kind !== 'melee') hitBoss(1); }
  /* a dim cavern, readable end to end, once the gate is no longer shut (or while the fight runs behind it) */
  function lights(list) {
    var ax, ay, G = NEU.dungeon && NEU.dungeon.gate;
    if (state !== 'active' && (!G || G.state() === 'closed')) return;
    for (ay = 6; ay < ARENA_H; ay += 12) for (ax = 6; ax < ARENA_W; ax += 12) list.push(CH.x + ax, CH.y + ay, 1.2);
    if (b && !b.done) list.push(b.x / T + CH.x, b.y / T + CH.y, 1.6 * b.op);
  }

  var env = {
    K: K, b: function () { return b; }, hx: hx, hy: hy, k: k, rnd: rnd, unit: unit, rotv: rotv, dist: dist, ang: ang, fly: fly, look: look, add: add, roar: roar,
    heroHit: heroHit, hurtHero: hurtHero, hw: function () { return P.hw; }, hh: function () { return P.hh; },
    card: function (ph) {
      if (NEU.poltFx && NEU.poltFx.card) NEU.poltFx.card(NAMES[ph]);
      if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', ph + 1);
      if (NEU.juice && NEU.juice.hit) NEU.juice.hit('large', { colour: COL.ecto });
    },
    count: function (flagName) { var n = 0, i; for (i = 0; i < shots.length; i++) if (shots[i][flagName]) n++; return n; }
  };
  NEU.dgnPolt = {
    register: function (name, ai) { AIS[name] = ai; }, get mode() { return b ? b.mode : ''; },
    get fb() { return fb; }, get autoplay() { return D_.autoplay; }, set autoplay(v) { D_.autoplay = !!v; },
    data: DATA, K: K, begin: begin, reset: reset, seed: seed, chamber: CH,
    hit: hitBoss, select: selectNext,
    /* the hooks dgn-foes and dungeon.js call: one owner for the fixed step, the kit's targets and damage, the swing, the Bot's dodge, the lights and the draw */
    on: function () { return state === 'active'; }, step: step, engage: engage, retry: retry, abort: abort, rematch: rematch, targets: targets, damage: damage,
    lastDir: function () { return lastDir; }, axe: axe, assist: assist, lights: lights, hudWorld: hudWorld, hudScreen: hudScreen,
    /* test surface: jump straight to one attack with a fresh timer */
    set: function (name) { var i; b.atk = name; b.t = 0; for (i = 0; i < 5; i++) b.ex[i] = 0; syncBox(); },
    get boss() { return b; }, get shots() { return shots; }, get attacks() { return ATK.slice(); }, get frame() { return frame; }, get exitIn() { return exitIn; },
    get phase() { return b ? b.phase : -1; }, get names() { return NAMES.slice(); }
  };
})();
