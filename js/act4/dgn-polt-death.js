/* dgn-polt-death.js — the Polterghast fight for the Bot and Easy tiers: the Calamity Mod "Death difficulty" version.
   Reimplemented from reading CalamityTeam/CalamityModPublic NPCs/Polterghast/Polterghast.cs (+ PolterghastHook.cs) at
   514460f4f48c4976d81c5f67cb915a9ef30af6f8 as a reference. No code is copied; the numbers and the shape of the behaviour are.
   Credit: Azafure, LLC — https://github.com/CalamityTeam/CalamityModPublic (Calamity Mod, all rights reserved; the source may be
   used as a reference, lifted code must carry this credit). Plant-style fight: four hooks tether him, a charge every 480
   frames, fans of shots, a clone in the third phase, ghost spirits in the fourth. Phases at 90 / 60 / 45 / 20 percent life
   (the Death-mode gates). Terraria units in C, scaled by K at runtime, as in dgn-polt.js.
   Deviations: every charge is shown for 24 frames first; he hovers 200 above the hero between charges (the original sits on the player, who flies); hooks are tether points that cannot be hit; the clone cannot be hit and never gets "angry"; line-of-sight
   checks are skipped (the arena has no cover). */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {}, D = NEU.dgnPolt;
  if (!D || !D.register) return;
  var C = { gates: [0.9, 0.6, 0.45, 0.2], chargeGate: 480, baseV: 15, baseA: 0.075, shotV: 7.5, maxHook: 650, chargeDist: 480 };
  var PI = Math.PI;

  function init(E) {
    var b = E.b(), i, hooks = [];
    for (i = 0; i < 4; i++) hooks.push({ x: b.x, y: b.y, a: i * PI / 2 });
    return { n0: 0, a2: 0, sh: 0, sp: 0, ch: 0, cs: 0, cc: 0, tx: 0, ty: 0, reached: 0, hooks: hooks, pivot: null };
  }
  function fan(E, n, spreadDeg, speed, red, life) {
    var b = E.b(), u = E.unit(E.hx() - b.x, E.hy() - b.y), i, a, r;
    for (i = 0; i < n; i++) {
      a = (-spreadDeg / 2 + spreadDeg * i / (n - 1)) * PI / 180; r = E.rotv(u.x, u.y, a);
      E.add({ k: 'soul', x: b.x + u.x * E.k(speed) * 3, y: b.y + u.y * E.k(speed) * 3, vx: r.x * E.k(speed), vy: r.y * E.k(speed), r: E.k(16), life: life || 300, cyan: red ? 0 : 1, plain: 1 });
    }
  }
  function step(E) {
    var b = E.b(), d = b.d || (b.d = init(E)), lr = b.hp / b.hpMax, K = E.K, G = C.gates, i, h, u, a, dd;
    var p2 = lr < G[0], p3 = lr < G[1], p4 = lr < G[2], p5 = lr < G[3], ph = p3 ? 2 : p2 ? 1 : 0;
    var chargePhase = d.n0 >= C.chargeGate, amt = p3 ? 3 : p2 ? 2 : 1, cv = (p3 ? 24 : p2 ? 22 : 20) + 4, ca = p3 ? 0.6 : p2 ? 0.55 : 0.5;
    var charging = d.a2 >= C.chargeGate - 180, vel = C.baseV, acc = C.baseA, inCharge, mx, my, tv, dist2, maxHook, cx, cy;
    if (b.phase !== ph) { b.phase = ph; E.card(ph); if (ph === 2) b.clones.push({ x: b.x, y: b.y, vx: 0, vy: 0, rot: 0, hot: 0 }); }
    b.contact = true; b.hide = false; b.inv = false; b.dr = 0.1; b.tel = 0; b.veryFirst = 1; b.op = Math.min(1, b.op + 0.05); b.scale = 1.225;
    b.w = E.k(90) * b.scale; b.h = E.k(120) * b.scale;
    d.n0++;
    if (p2) { vel += 2.5; acc += 0.02; }
    if (!p3) { if (charging) { vel += p2 ? 4.5 : 3.5; acc += p2 ? 0.03 : 0.025; } }
    else if (charging) { vel += p5 ? 8.5 : 4.5; acc += p5 ? 0.06 : 0.03; }
    else { vel += p5 ? 1.5 : p4 ? 1 : 0.5; acc += p5 ? 0.015 : p4 ? 0.01 : 0.005; }
    vel += 5; acc += 0.035; cv += 4;                       /* revenge: faster everything */
    vel += vel * 0.15 * (1 - lr); acc += acc * 0.15 * (1 - lr);   /* Death: it speeds up as it is hurt */
    /* the hooks drift toward the hero from four sides; the boss may not stray far from their middle */
    cx = 0; cy = 0;
    for (i = 0; i < 4; i++) {
      h = d.hooks[i]; h.a += 0.012;
      u = E.unit(E.hx() + Math.cos(h.a) * E.k(380) - h.x, E.hy() + Math.sin(h.a) * E.k(380) - h.y);
      h.x += u.x * E.k(7); h.y += u.y * E.k(7); cx += h.x / 4; cy += h.y / 4;
    }
    d.cx = cx; d.cy = cy;
    inCharge = false;
    if (!chargePhase) {
      d.a2++; if (d.a2 >= C.chargeGate + 120) d.a2 = 0;
      E.look();
      maxHook = E.k(C.maxHook) * (1 + 0.1 * (1 - lr));
      mx = E.hx() - cx; my = E.hy() - E.k(200) - cy; dd = Math.sqrt(mx * mx + my * my);   /* hovers above the hero: a ground-bound hero cannot flee a flier that sits on him */
      if (dd >= maxHook) { mx *= maxHook / dd; my *= maxHook / dd; }
      mx = cx + mx - b.x; my = cy + my - b.y; dist2 = Math.sqrt(mx * mx + my * my);
      if (dist2 < E.k(vel)) { mx = b.vx; my = b.vy; } else { mx *= E.k(vel) / dist2; my *= E.k(vel) / dist2; }
      E.fly(mx, my, E.k(acc));
    } else {
      /* the charge: line up on a diagonal 480 away from the hero, then run through them */
      if (d.ch === 1) {
        d.reached = 0;
        if (d.cs === 0) {
          /* a 24 frame wind-up the original does not have: the line he is about to run, drawn first */
          d.wu = (d.wu || 0) + 1; b.vx = b.vy = 0; b.teld = E.ang(b.x, b.y, E.hx(), E.hy()); b.tel = Math.min(1, d.wu / 12) * 0.67; E.look();
          if (d.wu >= 24) { d.wu = 0; u = E.unit(E.hx() - b.x, E.hy() - b.y); b.vx = u.x * E.k(cv); b.vy = u.y * E.k(cv); d.cs = 1; E.roar(); d.pivot = { x: E.hx(), y: E.hy() }; }
        }
        else {
          d.cs++; dd = C.chargeDist * 4 / cv;
          if (d.cs >= dd - cv) { b.vx *= 0.9; b.vy *= 0.9; }
          if (d.cs >= dd) {
            d.cs = 0; d.ch = 0; d.cc++;
            if (d.cc >= amt) { d.n0 = 0; d.cc = 0; } 
          }
        }
        if (d.cs > 0) b.rot = Math.atan2(b.vy, b.vx) + PI / 2;
        inCharge = true;
      } else {
        d.tx = b.x >= E.hx() ? E.hx() + E.k(C.chargeDist) : E.hx() - E.k(C.chargeDist);
        d.ty = b.y >= E.hy() ? E.hy() + E.k(C.chargeDist) : E.hy() - E.k(C.chargeDist);
        u = E.unit(d.tx - b.x, d.ty - b.y);
        if (E.dist(b.x, b.y, d.tx, d.ty) <= E.k(40) || d.reached) { d.reached = 1; b.vx = b.vy = 0; b.x = d.tx; b.y = d.ty; d.ch = 1; d.cs = 0; }
        else E.fly(u.x * E.k(cv), u.y * E.k(cv), E.k(ca));
        E.look(); inCharge = d.a2 >= C.chargeGate - 180;
      }
    }
    /* shots, only while not mid-charge */
    if (!(charging && chargePhase)) {
      if (!p2) {
        d.sh += 1.5;
        if (d.sh >= 120) { d.sh = 0; if (E.rnd() < 1 / 3) { d.sh = -30; fan(E, 6, 65, C.shotV, 0, 300); } else fan(E, 6, 65, C.shotV, 0, 300); }
      } else if (!p3) {
        d.sh += 1.5;
        if (d.sh >= 200) { d.sh = 0; if (E.rnd() < 1 / 3) d.sh = -30; fan(E, 7, 80, C.shotV + 1, 1, 300); }
      } else {
        d.sh += 1;
        if (d.sh >= 280) { d.sh = 0; fan(E, 8, 110, C.shotV, E.rnd() < 0.5 ? 1 : 0, 300); }
        if (p4) {
          d.sp++;
          if (d.sp >= 420) {
            d.sp = 0;
            if (E.count('spirit') < 2) { u = E.unit(E.hx() - b.x, E.hy() - b.y); E.add({ k: 'soul', x: b.x, y: b.y, vx: u.x * E.k(6), vy: u.y * E.k(6), r: E.k(16), life: 300, home: 1, cyan: 1, plain: 1, spirit: 1 }); }
          }
        }
      }
    }
    /* the clone (third phase): the same charge from the far side of the hero */
    for (i = 0; i < b.clones.length; i++) {
      h = b.clones[i];
      if (d.ch === 1 && d.pivot) { h.hot = 1; h.x = 2 * d.pivot.x - b.x; h.y = 2 * d.pivot.y - b.y; h.vx = -b.vx; h.vy = -b.vy; }
      else { h.hot = 0; h.x += (2 * E.hx() - b.x - h.x) * 0.05; h.y += (2 * E.hy() - b.y - h.y) * 0.05; }
      h.rot = E.ang(h.x, h.y, E.hx(), E.hy()) + PI / 2;
      if (h.hot && E.heroHit(h.x, h.y, E.k(40))) E.hurtHero(1, h.x < E.hx() ? 1 : -1);
    }
    b.t++;
    b.x += b.vx; b.y += b.vy;
    if (b.contact && b.op > 0.2 && Math.abs(E.hx() - b.x) < E.hw() + b.w / 2 && Math.abs(E.hy() - b.y) < E.hh() / 2 + b.h / 2) E.hurtHero(1, E.hx() < b.x ? -1 : 1);
  }
  D.register('death', { gates: C.gates, step: step });
})();
