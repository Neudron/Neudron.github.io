/* scal-attacks.js — Supreme Calamitas' attack machine.
   Attack patterns ported from InfernumMode (InfernumTeam, @399342f, MIT).
   Source: InfernumMode-cs/Content/BehaviorOverrides/BossAIs/SupremeCalamitas/
   SupremeCalamitasBehaviorOverride.cs. Each attack names the lines it ports.

   Units: Terraria px and frames at 60 fps, converted here. K = arena width
   / 2000, so D(d) = d * K is a Terraria distance in arena px and
   V(v) = v * 60 * K is a Terraria px/frame speed in arena px/second.

   boss-scal.js owns the body, the player, the HP and the drawing. This file
   owns what she does: the cycles, the phase gates, the specials it starts
   and waits on, and the desperation substates. The machine ticks once per
   60 Hz frame, from boss-scal's update, and only while she is free to act.
   Every bullet goes through the adapter's shot(), so the shared cap holds.

   ceiling: enraged (soul outside the arena) cannot happen in this arena, so
   every enraged branch is absent. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var TAU = Math.PI * 2, TF = 1 / 60;

  var A = null;            /* the adapter boss-scal.js hands in with attach() */
  var G = null;            /* per-fight state, see fresh() */
  var cur = null;          /* the running attack: { name, fn, st } */
  var acc = 0, K = 0.35;   /* frame accumulator; arena px per Terraria px */
  var ATK = {};

  function D(d) { return d * K; }
  function V(v) { return v * 60 * K; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function aim() { return Math.atan2(A.py - A.by, A.px - A.bx); }
  function hx(x) { return clamp(x, A.AX + 12, A.AX + A.AW - 12); }
  function hy(y) { return clamp(y, A.AY + 24, A.AY + A.AH - 24); }
  /* ease her toward (x, y); k is the share of the gap closed this frame */
  function move(x, y, k) {
    A.setBoss(A.bx + (hx(x) - A.bx) * k, A.by + (hy(y) - A.by) * k);
  }
  function beamLen() { return Math.hypot(A.AW, A.AH) * 1.2; }
  /* run fn n frames from now, on the attack clock */
  function later(n, fn) { G.ev.push({ f: G.fr + n, fn: fn }); }
  /* n darts on a full ring from (x, y) at sp arena px/s, first one at a0 */
  function ring(x, y, n, sp, a0, tag) {
    for (var i = 0; i < n; i++) {
      var a = a0 + i * TAU / n;
      A.shot(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0, { tag: tag || 'burst' });
    }
  }
  /* A DemonicBomb: flies (vx, vy), drag 0.99 per frame (DemonicBomb.cs:57),
     fuses fuseF frames (DemonicBomb timeLeft), then bursts into n darts at
     sp (DemonicExplosion). */
  function bomb(x, y, vx, vy, fuseF, n, sp) {
    return A.shot(x, y, vx, vy, 2, { fuse: fuseF / 60, acc: Math.pow(0.99, 60), tag: 'bomb',
      onEnd: function (b) { ring(b.x, b.y, n, sp, 0, 'burst'); } });
  }

  /* ── the attacks ──────────────────────────────────────────────────
     Each takes its state `st` (st.f is the frame into this attack, st.n a
     counter, st.side a side, st.p scratch) and returns true when it ends. */

  /* SupremeCalamitas.cs:726-799. She hovers 820 px to one side of the soul.
     Two volleys, in f 60-240 and f 300-480. Fire rate 7 f (5 at phase 1+,
     4 berserk). Soul speed 8.5, fan lerp(-0.67, 0.67) by shot number mod 3,
     plus +-0.25 rad. */
  ATK.HorizontalDarkSoulRelease = function (st) {
    var f = st.f;
    if (f === 0) st.side = A.bx < A.px ? -1 : 1;
    move(A.px + st.side * D(820), A.AY + A.AH * 0.2, 0.08);
    var on = (f >= 60 && f < 240) ? 60 : (f >= 300 && f < 480) ? 300 : -1;
    var rate = G.berserk ? 4 : (G.lvl >= 1 ? 5 : 7);
    if (on >= 0 && (f - on) % rate === 0) {
      var a = (st.side < 0 ? 0 : Math.PI) + lerp(-0.67, 0.67, (st.n++ % 3) / 2) + rnd(-0.25, 0.25);
      A.shot(A.bx, A.by, Math.cos(a) * V(8.5), Math.sin(a) * V(8.5), 0,
             { tag: 'soul', fuse: 6 });
    }
    return f >= 480;
  };

  /* SupremeCalamitas.cs:803-935 (CondemnationFanBurst). Two fans. Each: a
     chargeup of 120 f (155 at phase 1+), then a 52 f fan window that fires an
     arrow every 2 f (26 per fan). Arrow speed 11.25 (14.75 phase 1+, 19.5
     phase 3+). Spread 2.94 rad (2.72 phase 1+, 3.03 berserk), aim locked at
     the fan start +-0.07 rad. Phase 1+ also drops six darts on a ring 650 px
     out at the chargeup, drifting in at 0.4 of their offset over the fan.
     Rest 48 f between fans.
     ceiling: arrows do not accelerate x1.025 per frame; they are capped at
     the phase speed, because the source reaches about 7x in its 80 f life. */
  ATK.CondemnationFanBurst = function (st) {
    var f = st.f, L = G.lvl;
    var chg = L >= 1 ? 155 : 120, fan = 52, rest = 48, len = chg + fan + rest;
    if (f >= 2 * len - rest - 1) return true;
    var i = Math.floor(f / len), lf = f - i * len;
    move(A.px, A.AY + A.AH * 0.2, 0.1);
    if (lf === 0) {
      st.aim = aim() + rnd(-0.07, 0.07);
      st.dir = Math.random() < 0.5 ? -1 : 1;
    }
    if (lf === chg && L >= 1) {
      for (var k = 0; k < 6; k++) {
        var q = k * TAU / 6, ox = Math.cos(q) * D(650), oy = Math.sin(q) * D(650);
        A.shot(A.px + ox, A.py + oy, -ox / fan * 0.4 * 60, -oy / fan * 0.4 * 60, 0,
               { tag: 'brim', fuse: fan / 60 + 2 });
      }
    }
    if (lf >= chg && lf < chg + fan && (lf - chg) % 2 === 0) {
      var t = (lf - chg) / fan;
      var spread = G.berserk ? 3.03 : (L >= 1 ? 2.72 : 2.94);
      var sp = V(L >= 3 ? 19.5 : L >= 1 ? 14.75 : 11.25);
      var cap = V(24);
      var ang = st.aim + st.dir * spread * (t - 0.5);
      A.shot(A.bx, A.by, Math.cos(ang) * Math.min(sp, cap), Math.sin(ang) * Math.min(sp, cap), 0,
             { tag: 'brim', fuse: 80 / 60 });
    }
    return false;
  };

  /* SupremeCalamitas.cs:973-1092 (ExplosiveCharges). She hovers 500 px to
     one side and 270 px above the soul while the shield laughs. Then six
     dashes (five in berserk) every 45 f (41 at phase 1+). Each dash drops a
     DemonicBomb that detonates 120 f later (102 at phase 3+, -45 berserk).
     Every third dash also fires a gigablast at half the bomb speed, with
     +-0.4 rad. Dash speed 43 (47.5 phase 1+, +3.5 phase 3+, +9.5 berserk).
     ceiling: the bomb drag is applied per second; the explosion is 14 darts,
     not the DemonicExplosion radius. */
  ATK.ExplosiveCharges = function (st) {
    var f = st.f, L = G.lvl, B = G.berserk;
    var delay = 132, chT = L >= 1 ? 41 : 45, n = B ? 5 : 6;
    var spd = V((L >= 1 ? 47.5 : 43) + (L >= 3 ? 3.5 : 0) + (B ? 9.5 : 0));
    var bombSp = V(L >= 1 ? 15 : 20);
    var fuse = (L >= 3 ? 102 : 120) - (B ? 45 : 0);
    if (f === 0) st.side = A.bx < A.px ? -1 : 1;
    if (f >= delay + chT * n) return true;
    if (f < delay) {
      A.anim('charge_telegraph'); A.willCharge(true);
      move(A.px + st.side * D(500), A.py - D(270), 0.06);
      return false;
    }
    var rel = f - delay, c = Math.floor(rel / chT), lf = rel - c * chT;
    if (lf === 0) {
      A.willCharge(false); A.anim('charging');
      var a = aim();
      st.dx = Math.cos(a); st.dy = Math.sin(a);
      bomb(A.bx, A.by, Math.cos(a) * bombSp, Math.sin(a) * bombSp, fuse, 14, V(6));
      if (c % 3 === 2) {
        var ga = a + rnd(-0.4, 0.4);
        A.shot(A.bx, A.by, Math.cos(ga) * bombSp * 0.5, Math.sin(ga) * bombSp * 0.5, 2,
               { tag: 'gig', fuse: 1.5 });
        A.sfx('giga');
      }
    }
    if (lf < chT) {
      A.setBoss(hx(A.bx + st.dx * spd * TF), hy(A.by + st.dy * spd * TF));
    }
    return false;
  };

  /* SupremeCalamitas.cs:1094-1205 (HellblastBarrage). She hovers 700 px beside
     the soul, with a vertical bob of 330 (+20 phase 1+, +50 phase 3+, +50
     berserk, period 56 f) once firing starts. Fires in f 105-465: a
     hellblast every 12 f (14 base, 11 berserk), flying horizontally at 15.
     Every fifth hellblast is swapped for seven darts at +-0.45 rad, speed
     8.4 (+1.36 phase 1+, +2.5 phase 3+).
     ceiling: the endOfAttackShootBlock (90 f) and its explosion are not drawn. */
  ATK.HellblastBarrage = function (st) {
    var f = st.f, L = G.lvl, B = G.berserk;
    if (f === 0) { st.side = A.px < A.AX + A.AW / 2 ? 1 : -1; A.sfx('hellblast'); }
    var amp = 330 + (L >= 1 ? 20 : 0) + (L >= 3 ? 50 : 0) + (B ? 50 : 0);
    var bob = f >= 105 ? Math.sin((f - 105) * TAU / 56) * D(amp) : 0;
    move(A.px + st.side * D(700), A.AY + A.AH / 2 + bob, 0.2);
    if (f < 105 || f >= 465) return f >= 555;
    var iv = (L >= 1 ? 12 : 14) - (B ? 3 : 0);
    if ((f - 105) % iv !== 0) return false;
    var dir = A.px < A.bx ? -1 : 1;
    A.shot(A.bx, A.by, dir * V(15), 0, 3, { tag: 'hell', fuse: 6 });
    if (++st.n % 5 === 0) {
      var base = aim(), dsp = V(8.4 + (L >= 3 ? 2.5 : L >= 1 ? 1.36 : 0));
      for (var j = 0; j < 7; j++) {
        var da = base + lerp(-0.45, 0.45, j / 6);
        A.shot(A.bx, A.by, Math.cos(da) * dsp, Math.sin(da) * dsp, 0, { tag: 'brim', fuse: 6 });
      }
    }
    return false;
  };

  /* SupremeCalamitas.cs:1212-1355 (DarkMagicBombWalls). The soul is the
     centre. Every 20 f from f 135 to 465 (16 at phase 3+), three dark flames
     (five at phase 3+) fly in from a ring 1000 px out, accelerating x1.019 a
     frame (AcceleratingDarkMagicFlame.cs:26-39). Bomb waves: 13 telegraph
     points, one every 7 f, within 900 px (1050 at phase 3+) of the soul, each
     dropping a bomb 45 f later that fuses 135-185 f (DemonicTelegraphLine
     OnKill). ceiling: telegraph lines are not drawn; the bomb is the telegraph,
     and the flame ring is clipped to the arena. */
  ATK.DarkMagicBombWalls = function (st) {
    var f = st.f, L = G.lvl;
    move(A.AX + A.AW / 2, A.AY + A.AH * 0.15, 0.05);
    var cad = L >= 3 ? 16 : 20;
    if (f >= 135 && f < 465 && (f - 135) % cad === 0) {
      var n = L >= 3 ? 5 : 3, a0 = rnd(0, TAU);
      for (var k = 0; k < n; k++) {
        var q = a0 + k * TAU / n;
        var x = clamp(A.px + Math.cos(q) * D(1000), A.AX, A.AX + A.AW);
        var y = clamp(A.py + Math.sin(q) * D(1000), A.AY, A.AY + A.AH);
        A.shot(x, y, -Math.cos(q) * V(2.7), -Math.sin(q) * V(2.7), 5,
               { tag: 'flame', acc: Math.pow(1.019, 60), vmax: V(12), fuse: 5 });
      }
    }
    var local = f - 135;
    if (local >= 0 && local < 3 * 167 && local % 167 < 91 && (local % 167) % 7 === 0) {
      var off = D(L >= 3 ? 1050 : 900);
      var tx = hx(A.px + rnd(-off, off)), ty = hy(A.py + rnd(-off, off));
      later(45, (function (bx, by) {
        return function () { bomb(bx, by, 0, 0, rnd(135, 185), 12, V(6)); };
      }(tx, ty)));
    }
    return f >= 555;
  };

  /* SupremeCalamitas.cs:1358-1450 (FireLaserSpin). She hovers, casts the orb
     at f 165 and rises at f 200. The orb's laser sweeps one full turn over
     f 245-565, aimed at the soul when it lights. Gigablasts every 75 f from
     f 235 (57 at phase 3+), speed 10.5 (11.75 phase 3+), aimed at the soul.
     ceiling: BrimstoneFlameOrb's laser internals are not in the notes, so the
     laser is a plain swept beam over one turn. The first gigablast is at 3.9 s
     in the source, so the attack's first bullet is outside a 3 s window. */
  ATK.FireLaserSpin = function (st) {
    var f = st.f, L = G.lvl;
    move(A.AX + A.AW / 2, A.AY + A.AH * (f < 200 ? 0.4 : 0.1), 0.04);
    if (f === 165) A.anim('casting');
    if (f === 245) st.a1 = aim();
    if (f >= 245 && f < 565) {
      G.beam = { x: A.bx, y: A.by, a: st.a1 + TAU * (f - 245) / 320, len: beamLen() };
    }
    var gc = L >= 3 ? 57 : 75;
    if (f >= 235 && (f - 235) % gc === 0) {
      var sp = V(L >= 3 ? 11.75 : 10.5), ga = aim();
      A.shot(A.bx, A.by, Math.cos(ga) * sp, Math.sin(ga) * sp, 2, { tag: 'gig', fuse: 1.5 });
      A.sfx('giga');
    }
    if (f >= 565) G.beam = null;
    return f >= 800;
  };

  /* SupremeCalamitas.cs:1607-1767 (BrimstoneJewelBeam). She teleports to 600
     px beside the soul and charges for 142 f. Then a beam for 360 f sweeps
     1.25 turns (x1.3 at phase 2+). Darts every 8 f (6 at phase 2+), speed 16,
     aimed at the soul. A bomb every 60 f (50 at phase 2+), fused 120 f.
     ceiling: the suicide-bomber rituals every 85 f are not spawned, and the
     source's 3330 px beam is clipped to the arena diagonal. */
  ATK.BrimstoneJewelBeam = function (st) {
    var f = st.f, P2 = G.lvl >= 2;
    if (f === 0) {
      st.side = Math.random() < 0.5 ? -1 : 1;
      A.setBoss(hx(A.px + st.side * D(600)), hy(A.py));
    }
    if (f < 142) { A.anim('charge_telegraph'); return false; }
    var lf = f - 142, spin = TAU * 1.25 * (P2 ? 1.3 : 1);
    if (lf === 0) { st.a0 = aim() - spin / 2; A.sfx('giga'); }
    A.anim('casting');
    G.beam = { x: A.bx, y: A.by, a: st.a0 + spin * lf / 360, len: beamLen() };
    var a = aim();
    if (lf % (P2 ? 6 : 8) === 0) {
      A.shot(A.bx, A.by, Math.cos(a) * V(16), Math.sin(a) * V(16), 0, { tag: 'brim', fuse: 6 });
    }
    if (lf % (P2 ? 50 : 60) === 0) {
      bomb(A.bx, A.by, Math.cos(a) * V(12), Math.sin(a) * V(12), 120, 12, V(6));
    }
    if (lf >= 360) { G.beam = null; return true; }
    return false;
  };

  /* SupremeCalamitas.cs:1488-1606 (SummonSuicideBomberDemons). She hovers 600
     px to one side and 300 px above the soul. Eight demons (six before phase
     1) are summoned every 6 f on a 225 px ring. Each waits 45 f, then homes
     at speed 7 and bursts into ten darts on the soul or when its fuse runs
     out. Darts every 32 f (27 at phase 1+) while the soul is 320 px away:
     five (seven at phase 1+) at speed 7.5, spread +-0.45 rad. The side flips
     every six volleys. ends at f 675 (687 at phase 1+).
     ceiling: the demon's chase speed is a guess (the notes do not read
     SuicideBomberDemonHostile.cs); the ritual circle is not drawn. */
  ATK.SummonSuicideBomberDemons = function (st) {
    var f = st.f, L = G.lvl, nd = L >= 1 ? 8 : 6, end = L >= 1 ? 687 : 675;
    if (f === 0) st.side = A.bx < A.px ? -1 : 1;
    move(A.px + st.side * D(600), A.py - D(300), 0.1);
    if (f % 6 === 0 && f < 6 * nd) {
      var q = (f / 6) * TAU / nd;
      var d = A.shot(A.bx + Math.cos(q) * D(225), A.by + Math.sin(q) * D(225), 0, 0, 3,
                     { tag: 'demon', fuse: 7, prox: 12, onEnd: function (b) { ring(b.x, b.y, 10, V(6), 0, 'burst'); } });
      if (d) st.p.demons = (st.p.demons || []).concat([{ b: d, t: f }]);
    }
    var list = st.p.demons || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i], b = m.b;
      if (b.fuse <= 0 || f - m.t < 45) continue;
      var ha = Math.atan2(A.py - b.y, A.px - b.x);
      b.vx = Math.cos(ha) * V(7); b.vy = Math.sin(ha) * V(7);
    }
    st.p.demons = list.filter(function (m) { return m.b.fuse > 0; });
    var far = Math.hypot(A.px - A.bx, A.py - A.by) > D(320);
    if (far && f >= 45 && f % (L >= 1 ? 27 : 32) === 0) {
      var n = L >= 1 ? 7 : 5, base = aim();
      for (var j = 0; j < n; j++) {
        var da = base + lerp(-0.45, 0.45, j / (n - 1));
        A.shot(A.bx, A.by, Math.cos(da) * V(7.5), Math.sin(da) * V(7.5), 0, { tag: 'brim', fuse: 6 });
      }
      if (++st.vol % 6 === 0) {
        st.side = -st.side;
        A.setBoss(hx(A.px + st.side * D(600)), hy(A.py - D(300)));
      }
    }
    return f >= end;
  };

  /* SupremeCalamitas.cs:1451-1487 (BecomeBerserk). She stands at the soul for
     95 f, then teleports 450 px above it and berserk turns on. The next attack
     is one of the three berserk picks (see cycleNext). A ring of twelve darts
     marks the teleport (DemonicExplosion, MaxRadius 500).
     ceiling: the source's slowdown (velocity x0.95) is not applied. */
  ATK.BecomeBerserk = function (st) {
    if (st.f === 95) {
      G.berserk = true;
      A.setBoss(hx(A.px), hy(A.py - D(450)));
      ring(A.bx, A.by, 12, V(10), 0, 'burst');
      A.shake('small');
    }
    return st.f >= 96;
  };

  /* SupremeCalamitas.cs:1774-1812 (SummonShadowDemon). The phase-one gate. The
     shadow demon arrives at f 170 (SupremeCalamitas.cs:1789-1800).
     ceiling: the ShadowDemon NPC and its black screen are not drawn; its two
     attacks run from the cycle instead, and its arrival is a dart ring here. */
  ATK.SummonShadowDemon = function (st) {
    if (st.f === 0) A.anim('idle');
    if (st.f === 170) {
      ring(A.bx, A.by, 8, V(8), 0, 'burst');
      A.sfx('fireblast');
      return true;
    }
    return false;
  };

  /* ShadowDemon.cs:152-155 (ReleaseExplodingShadowBlasts, PARTIAL in the
     notes). Eight shadow flames out from her, each fused 32 f (ShadowFlameBlast
     Lifetime, ShadowFlameBlast.cs:12) into a twelve-dart ring.
     ceiling: the cadence is the notes' best reading, not verified line by line. */
  ATK.ShadowDemon_ReleaseExplodingShadowBlasts = function (st) {
    if (st.f === 0) {
      for (var i = 0; i < 8; i++) {
        var a = i * TAU / 8;
        A.shot(A.bx, A.by, Math.cos(a) * V(10), Math.sin(a) * V(10), 5,
               { tag: 'shadow', fuse: 32 / 60, onEnd: function (b) { ring(b.x, b.y, 12, V(6), 0, 'burst'); } });
      }
    }
    return st.f >= 60;
  };

  /* ShadowDemon.cs:152-155 (ShadowGigablastsAndCharges, PARTIAL in the notes).
     Three gigablasts aimed at the soul, every 20 f, then a 30 f dash through
     her line of aim.
     ceiling: the demon's own timings are not verified against source. */
  ATK.ShadowDemon_ShadowGigablastsAndCharges = function (st) {
    var f = st.f;
    if (f < 60 && f % 20 === 0) {
      var a = aim();
      A.shot(A.bx, A.by, Math.cos(a) * V(9.4), Math.sin(a) * V(9.4), 2, { tag: 'gig', fuse: 1.5 });
      A.sfx('giga');
    }
    if (f === 60) { var b = aim(); st.dx = Math.cos(b); st.dy = Math.sin(b); }
    if (f >= 60 && f < 90) A.setBoss(hx(A.bx + st.dx * V(30) * TF), hy(A.by + st.dy * V(30) * TF));
    return f >= 120;
  };

  /* SupremeCalamitas.cs:2047-2129 (PhaseTransition). She clears the field,
     drops a ring of sixteen darts 600 px out, teleports 450 px above the soul,
     and waits 105 f. The next attack is G.forced, set by the gate that started
     this one: shadow demon, brothers, seekers or desperation. */
  ATK.PhaseTransition = function (st) {
    if (st.f === 0) {
      A.clearAll();
      A.setBoss(hx(A.px), hy(A.py - D(450)));
      ring(A.bx, A.by, 16, V(12), 0, 'burst');
      G.berserk = false;
      A.anim('idle');
      A.shake('medium');
      A.sfx('maelstrom');
    }
    return st.f >= 105;
  };

  /* SupremeCalamitas.cs:2130-2547 (DesperationPhase). Five substates, run in
     order: flame pillars (720 f), bomb bullet hell (636 f), dart walls and
     gigablasts (1050 f), rapid teleports (20 of them, countdown 38 f down by 2
     to 4), and the descent that ends the fight (780 f, then the win).
     The boss takes no damage here (invuln is set for the whole phase). */
  ATK.DesperationPhase = function (st) {
    if (st.f === 0) A.invuln(true);
    var s = st.sf;                       /* frame within the current substate */
    st.sf++;
    if (G.sub === 0) { pillars(st, s); if (s === 719) nextSub(st); }
    else if (G.sub === 1) { bombHell(st, s); if (s === 635) nextSub(st); }
    else if (G.sub === 2) { darkWalls(st, s); if (s === 1049) nextSub(st); }
    else if (G.sub === 3) { teleports(st, s); if (st.p.count >= 20) nextSub(st); }
    else if (G.sub === 4) {
      if (s === 0) { move(A.px, A.py - D(300), 1); A.sfx('maelstrom'); }
      if (s === 779) { A.win(); return true; }
    }
    return false;
  };
  function nextSub(st) {
    if (G.sub === 0) { G.strips = []; }
    if (G.sub === 1) A.clearTag('bomb');
    if (G.sub === 2) A.clearTag('brim');
    G.sub++; st.sf = 0; st.p = {};
  }
  /* 0: pillars. A strip telegraphs for 60 f, then is live for 105 f, and hurts
     the soul while she stands in it. Strips step 300 Terraria px across the
     arena every 16 f. Lost souls every 18 f from the boss, straight up, +-0.73
     rad, speed 8-17 (RedirectingLostSoulProj, timeLeft 230). */
  function pillars(st, s) {
    if (s % 16 === 0) {
      var k = st.p.k || 0;
      G.strips.push({ x: A.AX + 20 + ((k * D(300)) % (A.AW - 40)), half: 16,
                      at: G.fr + 60, end: G.fr + 165 });
      st.p.k = k + 1;
    }
    if (s % 18 === 0) {
      var sp = V(rnd(8, 17)), la = -Math.PI / 2 + rnd(-0.73, 0.73);
      A.shot(A.bx, A.by, Math.cos(la) * sp, Math.sin(la) * sp, 3, { tag: 'soul', fuse: 230 / 60 });
    }
  }
  /* 1: bomb bullet hell. She teleports to the arena centre. Bombs in bursts
     of four (plus shape, then X shape on odd bursts); the countdown is 120 f,
     then 120 - 6n, floor 56. Darts every 56 f from f 28: seven forward and
     seven reverse, spread +-0.79 rad at 8.4.
     ceiling: bombs fuse for 60 f; the source's fuse is ExtraAI[3] * 0.95 and
     its meaning is not in the notes. */
  function bombHell(st, s) {
    if (s === 0) { A.setBoss(A.AX + A.AW / 2, A.AY + A.AH / 2); st.p.cd = 120; st.p.bc = 0; }
    st.p.cd--;
    if (st.p.cd <= 0) {
      st.p.bc++;
      var off = st.p.bc % 2 ? Math.PI / 4 : 0;
      for (var i = 0; i < 4; i++) bomb(A.bx, A.by, Math.cos(i * Math.PI / 2 + off) * V(16),
                                       Math.sin(i * Math.PI / 2 + off) * V(16), 60, 16, V(6));
      st.p.cd = Math.max(56, 120 - 6 * st.p.bc);
    }
    if (s >= 28 && (s - 28) % 56 === 0) {
      var a = aim();
      for (var j = 0; j < 7; j++) {
        var d = lerp(-0.79, 0.79, j / 6);
        A.shot(A.bx, A.by, Math.cos(a + d) * V(8.4), Math.sin(a + d) * V(8.4), 0, { tag: 'brim', fuse: 14 });
        A.shot(A.bx, A.by, Math.cos(a + Math.PI + d) * V(8.4), Math.sin(a + Math.PI + d) * V(8.4), 0,
               { tag: 'brim', fuse: 14 });
      }
    }
  }
  /* 2: dart walls. Every 60 f a wall of darts falls from the top of the arena:
     420 Terraria px wide with a 42 px gap in the middle, walls 840 px apart and
     alternating offset (BrimstoneBarrageOld with velocity (0, 5)).
     Gigablasts aimed at the soul every 75 f, minus 4 per shot, floor 34 f.
     ceiling: darts are not fused by timeLeft; they leave the arena. */
  function darkWalls(st, s) {
    if (s === 0) { st.p.gcd = 75; st.p.gnext = 75; st.p.wn = 0; }
    if (s % 60 === 0) {
      var base = A.AX + ((st.p.wn++ % 2) ? D(420) : 0) - D(840);
      for (var x0 = base; x0 < A.AX + A.AW; x0 += D(840)) {
        for (var x = x0; x < x0 + D(420); x += 12) {
          if (x < A.AX || x > A.AX + A.AW || Math.abs(x - (x0 + D(210))) < D(21)) continue;
          A.shot(x, A.AY - 10, 0, V(5), 0, { tag: 'brim', fuse: 8 });
        }
      }
    }
    if (s >= st.p.gnext) {
      var a = aim();
      A.shot(A.bx, A.by, Math.cos(a) * V(9.4), Math.sin(a) * V(9.4), 2, { tag: 'gig', fuse: 1.5 });
      st.p.gcd = Math.max(34, st.p.gcd - 4);
      st.p.gnext = s + st.p.gcd;
    }
  }
  /* 3: rapid teleports. Each lands 180-455 Terraria px from the soul and drops
     a ten-dart ring. Countdown 38 f, down by 2 per teleport, floor 4, twenty
     teleports in all. */
  function teleports(st, s) {
    if (s === 0) { st.p.tc = 38; st.p.nt = 38; st.p.count = 0; }
    if (s >= st.p.nt && st.p.count < 20) {
      var a = rnd(0, TAU), d = D(rnd(180, 455));
      A.setBoss(hx(A.px + Math.cos(a) * d), hy(A.py + Math.sin(a) * d));
      ring(A.bx, A.by, 10, V(8), 0, 'burst');
      A.shake('small');
      st.p.tc = Math.max(4, st.p.tc - 2);
      st.p.nt = s + st.p.tc;
      st.p.count++;
    }
  }

  /* Specials: the Sepulcher, the brothers and the seekers are bodies that
     boss-scal.js runs. The attack starts one and waits until it is done. */
  ATK.SummonSepulcher = function (st) {
    /* the opening lead-in: she is quiet for 270 f (SupremeCalamitas.cs:341) */
    if (st.f === 270) A.special('worm');
    return st.f > 270 && A.specialDone('worm');
  };
  ATK.SummonBrothers = function (st) {
    if (st.f === 0) A.special('brothers');
    return st.f > 0 && A.specialDone('brothers');
  };
  ATK.SummonSeekers = function (st) {
    if (st.f === 0) A.special('seekers');
    return st.f > 0 && A.specialDone('seekers');
  };

  /* ── the cycles (SupremeCalamitas.cs:188-241, in source order) ──────── */
  var C1 = ['HorizontalDarkSoulRelease', 'CondemnationFanBurst', 'ExplosiveCharges', 'SummonSuicideBomberDemons',
            'HorizontalDarkSoulRelease', 'CondemnationFanBurst', 'ExplosiveCharges', 'SummonSuicideBomberDemons'];
  var C2 = ['CondemnationFanBurst', 'ShadowDemon_ReleaseExplodingShadowBlasts', 'HellblastBarrage', 'BrimstoneJewelBeam',
            'CondemnationFanBurst', 'ExplosiveCharges', 'ShadowDemon_ReleaseExplodingShadowBlasts', 'HorizontalDarkSoulRelease',
            'HellblastBarrage', 'SummonSuicideBomberDemons', 'ShadowDemon_ReleaseExplodingShadowBlasts', 'BrimstoneJewelBeam',
            'ExplosiveCharges', 'HellblastBarrage', 'CondemnationFanBurst', 'ShadowDemon_ReleaseExplodingShadowBlasts',
            'HorizontalDarkSoulRelease', 'HellblastBarrage', 'BrimstoneJewelBeam', 'SummonSuicideBomberDemons'];
  var C3 = ['ShadowDemon_ShadowGigablastsAndCharges', 'FireLaserSpin', 'DarkMagicBombWalls', 'CondemnationFanBurst',
            'BecomeBerserk', 'BrimstoneJewelBeam', 'ShadowDemon_ShadowGigablastsAndCharges', 'DarkMagicBombWalls',
            'ExplosiveCharges', 'BecomeBerserk', 'CondemnationFanBurst', 'ShadowDemon_ShadowGigablastsAndCharges',
            'BrimstoneJewelBeam', 'FireLaserSpin', 'ExplosiveCharges'];
  /* SelectNextAttack after BecomeBerserk: one of these three, uniformly */
  var BERSERK_PICK = ['CondemnationFanBurst', 'ExplosiveCharges', 'HellblastBarrage'];
  /* PhaseTransition's next attack, by the phase she has just entered */
  var AFTER_PT = { 1: 'SummonShadowDemon', 2: 'SummonBrothers', 3: 'SummonSeekers', 4: 'DesperationPhase' };
  /* the phase gates: the HP share at which each phase starts */
  var GATE = [0.75, 0.45, 0.25, 0];
  /* attacks that hold her invulnerable while they run */
  var INVULN = { PhaseTransition: 1, DesperationPhase: 1, SummonSepulcher: 1, SummonBrothers: 1, SummonSeekers: 1 };

  function cycleNext() {
    if (G.last === 'BecomeBerserk') return BERSERK_PICK[(Math.random() * BERSERK_PICK.length) | 0];
    var C = G.lvl === 0 ? C1 : G.lvl === 1 ? C2 : C3;
    return C[G.cyc++ % C.length];
  }

  function fresh() {
    return { fr: 0, ev: [], cyc: 0, last: '', forced: null, lvl: 0, berserk: false,
             beam: null, strips: [], sub: -1, desp: false };
  }

  function begin(name) {
    cur = { name: name, fn: ATK[name], st: { f: 0, n: 0, sf: 0, side: 1, vol: 0, p: {} } };
    A.invuln(!!INVULN[name]);
    if (name === 'DesperationPhase') G.sub = 0;
  }

  function finish() {
    G.last = cur.name;
    cur = null;
    G.beam = null;
    if (A.over()) return;
    var nx = G.forced || cycleNext();
    G.forced = null;
    begin(nx);
  }

  /* a beam or a live strip that holds the soul hurts her; the hit itself is
     boss-scal's (shield, i-frames, dash) */
  function hurtCheck() {
    var b = G.beam, i, s;
    if (b) {
      var dx = A.px - b.x, dy = A.py - b.y, c = Math.cos(b.a), sn = Math.sin(b.a);
      var along = dx * c + dy * sn, across = Math.abs(dx * sn - dy * c);
      if (along > 0 && along < b.len && across < 6) A.hit();
    }
    for (i = G.strips.length - 1; i >= 0; i--) {
      s = G.strips[i];
      if (G.fr >= s.end) { G.strips.splice(i, 1); continue; }
      if (G.fr >= s.at && Math.abs(A.px - s.x) < s.half) A.hit();
    }
  }

  function step() {
    G.fr++;
    var due = [], keep = [], i;
    for (i = 0; i < G.ev.length; i++) (G.ev[i].f <= G.fr ? due : keep).push(G.ev[i]);
    G.ev = keep;
    for (i = 0; i < due.length; i++) due[i].fn();
    hurtCheck();
    if (!cur) return;
    var fin = cur.fn(cur.st);
    cur.st.f++;
    if (fin) finish();
  }

  NEU.scalAtk = {
    /* boss-scal.js hands over its adapter once, at load */
    attach: function (adapter) { A = adapter; },
    /* the fight begins: the lead-in, which is the Sepulcher's 270 f delay */
    start: function () {
      G = fresh(); acc = 0; K = A.AW / 2000;
      begin('SummonSepulcher');
    },
    /* the fight is closed */
    reset: function () { G = null; cur = null; acc = 0; },
    /* per frame: whole 60 Hz frames of the attack clock (at most four) */
    tick: function (dt) {
      if (!G || !cur) return;
      K = A.AW / 2000;
      acc += dt;
      var n = 0;
      while (acc >= TF && n < 4 && cur) { acc -= TF; n++; step(); }
      if (n === 4) acc = 0;
    },
    /* the HP gates. Each one she passes starts the phase's transition; the
       transition's next attack comes from AFTER_PT. At 0 HP, after the
       seekers, the desperation phase starts instead of a win. */
    gate: function (pct) {
      if (!G || G.desp || pct > GATE[G.lvl]) return;
      G.lvl++;
      A.level(G.lvl);
      G.forced = AFTER_PT[G.lvl];
      if (G.lvl === 4) { G.desp = true; A.setHP(1); }
      begin('PhaseTransition');
    },
    /* the debug hook (NEU.scal.force) and the tests: run one attack now */
    force: function (name) {
      if (!G) G = fresh();
      K = A.AW / 2000; acc = 0;
      if (!ATK[name]) return false;
      G.forced = null;
      begin(name);
      return true;
    },
    level: function () { return G ? G.lvl : 0; },
    sub: function () { return G ? G.sub : -1; },
    attack: function () { return cur ? cur.name : ''; },
    last: function () { return G ? G.last : ''; },
    names: function () { return Object.keys(ATK); },
    /* the attack tables, for the tests and the notes */
    cycles: { C1: C1, C2: C2, C3: C3 },
    /* the beam and the live strips, for hurtCheck and draw */
    beam: function () { return G ? G.beam : null; },
    strips: function () { return G ? G.strips : []; },
    berserk: function () { return G ? G.berserk : false; },
    /* drawn over the field, under the bullets: the sweep and the strips */
    draw: function (ctx) {
      if (!G) return;
      var i, s;
      for (i = 0; i < G.strips.length; i++) {
        s = G.strips[i];
        ctx.fillStyle = G.fr < s.at ? 'rgba(255,74,42,0.16)' : 'rgba(255,74,42,0.5)';
        ctx.fillRect((s.x - s.half) | 0, A.AY, s.half * 2, A.AH);
      }
      var b = G.beam;
      if (b) {
        var ex = b.x + Math.cos(b.a) * b.len, ey = b.y + Math.sin(b.a) * b.len;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,196,106,0.45)'; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,74,42,0.95)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
  };
}());
