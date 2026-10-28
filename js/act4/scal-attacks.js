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
  /* the pattern stream: Math.random until start() gives each fight its own seeded one */
  var RNG = Math.random;
  function seeded(s) {
    var x = (s >>> 0) || 1;
    return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
  }
  function rnd(a, b) { return a + RNG() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = (RNG() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function aim() { return Math.atan2(A.py - A.by, A.px - A.bx); }
  /* the playable box: the arena, or the shrunken one in the final all-out */
  function bounds() {
    var b = G && G.box;
    return b ? { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h }
             : { x0: A.AX, y0: A.AY, x1: A.AX + A.AW, y1: A.AY + A.AH };
  }
  function hx(x) { var b = bounds(); return clamp(x, b.x0 + 12, b.x1 - 12); }
  function hy(y) { var b = bounds(); return clamp(y, b.y0 + 24, b.y1 - 24); }
  function segDist(px, py, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    var u = L2 ? clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1) : 0;
    return Math.hypot(px - (x0 + dx * u), py - (y0 + dy * u));
  }
  /* where the soul is when a body at (x, y) flying sp px/s gets there, from its velocity */
  function predict(x, y, sp) {
    var T = 0, qx = A.px, qy = A.py;
    for (var k = 0; k < 2; k++) {
      T = Math.hypot(qx - x, qy - y) / sp;
      qx = A.px + A.pvx * T; qy = A.py + A.pvy * T;
    }
    return { x: qx, y: qy };
  }
  /* n darts in a fan from her toward the soul, spread +-spread rad */
  function fan(n, spread, sp) {
    var base = aim();
    for (var j = 0; j < n; j++) {
      var da = base + lerp(-spread, spread, n > 1 ? j / (n - 1) : 0.5);
      A.shot(A.bx, A.by, Math.cos(da) * sp, Math.sin(da) * sp, 0, { tag: 'brim', fuse: 6 });
    }
  }
  /* the laser's segment this frame (a sweeping one moves from sw[0] to sw[1]) */
  function laserSeg(l) {
    var x = l.x, u;
    if (l.sw) { u = clamp((G.fr - l.at) / (l.end - l.at), 0, 1); x = lerp(l.sw[0], l.sw[1], u); }
    return { x0: x, y0: l.y, x1: x + Math.cos(l.a) * l.len, y1: l.y + Math.sin(l.a) * l.len };
  }
  /* the soul state the Gravity section asks for; the soul module owns the physics */
  function soulMode(m) { if (NEU.scalSoul && NEU.scalSoul.setMode) NEU.scalSoul.setMode(m); }
  /* ease her toward (x, y); k is the share of the gap closed this frame */
  function move(x, y, k) {
    A.setBoss(A.bx + (hx(x) - A.bx) * k, A.by + (hy(y) - A.by) * k);
  }
  function beamLen() { return Math.hypot(A.AW, A.AH) * 1.2; }
  /* run fn n frames from now, on the attack clock */
  function later(n, fn) { G.ev.push({ f: G.fr + n, fn: fn }); }
  /* n darts on a full ring from (x, y) at sp arena px/s, first one at a0 */
  function ring(x, y, n, sp, a0, tag) {
    A.boom(x, y);                 /* every ring is a DemonicExplosion */
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
      st.dir = RNG() < 0.5 ? -1 : 1;
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
             { tag: 'brim', look: 'arrow', fuse: 80 / 60 });
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
    /* in a combo the partner places her; this one only fires */
    if (!G.thin) move(A.px + st.side * D(700), A.AY + A.AH / 2 + bob, 0.2);
    if (f < 105 || f >= 465) return f >= 555;
    var iv = ((L >= 1 ? 12 : 14) - (B ? 3 : 0)) * (G.thin ? 2 : 1);
    if ((f - 105) % iv !== 0) return false;
    var dir = A.px < A.bx ? -1 : 1;
    A.shot(A.bx, A.by, dir * V(15), 0, 3, { tag: 'hell', fuse: 6 });
    if (++st.n % 5 === 0 && !G.thin) {
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
     OnKill). Each telegraph is a red line through the drop point, along
     the line from her (DemonicTelegraphLine.PreDraw). ceiling: the flame
     ring is clipped to the arena. */
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
      G.tele.push({ x: tx, y: ty, a: Math.atan2(ty - A.by, tx - A.bx), at: G.fr, life: 45 });
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
    var gc = (L >= 3 ? 57 : 75) * (G.thin ? 2 : 1);
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
      st.side = RNG() < 0.5 ? -1 : 1;
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
    /* aimed at the soul at any range. The old gate (darts only past 320 px) meant
       that standing close drew no darts at all. */
    if (f >= 45 && f % (L >= 1 ? 27 : 32) === 0) {
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
      /* the bare ring was all she did on arrival: a fan aimed at the soul follows half a second on */
      later(30, function () { fan(5, 0.45, 150); });
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
     and waits 105 f. The next attack is the head of G.queue, set by the gate:
     a pending lightning first, then shadow demon, brothers, seekers or desperation. */
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

  /* Arena Shrink (the final all-out). Over 1500 f the playable box closes 20% on
     each side (G.box, which the walls and her position follow; the soul is
     not clamped to it). Every edge throws a row of flames inward, every 36 f
     falling to every 12 f by the end, with a two-flame gap that walks along
     each wall. Dodge: stay off the edge the walls are coming from. */
  ATK.ArenaShrinkFlameWalls = function (st) {
    var f = st.f, D_ = 1500, s = Math.min(1, f / D_) * 0.2, i, e, t, gp, cad, x, y, vx, vy, b, n = 8;
    var wx = A.AW * s, wy = A.AH * s;
    G.box = { x: A.AX + wx, y: A.AY + wy, w: A.AW - 2 * wx, h: A.AH - 2 * wy };
    b = G.box;
    move(A.AX + A.AW / 2, A.AY + A.AH / 2, 0.04);
    cad = Math.round(36 - 24 * Math.min(1, f / D_));
    if (f % cad === 0) {
      gp = (f / cad) | 0;
      for (e = 0; e < 4; e++) for (i = 0; i < n; i++) {
        if ((((i - gp) % n) + n) % n < 2) continue;
        t = (i + 0.5) / n;
        if (e === 0) { x = b.x + t * b.w; y = b.y; vx = 0; vy = 60; }
        else if (e === 1) { x = b.x + t * b.w; y = b.y + b.h; vx = 0; vy = -60; }
        else if (e === 2) { x = b.x; y = b.y + t * b.h; vx = 60; vy = 0; }
        else { x = b.x + b.w; y = b.y + t * b.h; vx = -60; vy = 0; }
        A.shot(x, y, vx, vy, 0, { tag: 'brim', fuse: 9 });
      }
    }
    return f >= D_;
  };

  /* Desperation, the chain. Brimstone Lightning (sub 0, so it is the forced
     first attack), Calamitous Rend with five cuts, Gravity of Ruin in the blue
     soul, then the final all-out that shrinks the arena and thickens the walls.
     Each step runs its own attack on its own state; G.desp.stage names the step
     for the music and the visuals. She is invulnerable through the chain and
     wins when the final all-out ends. */
  var DESP = ['BrimstoneLightning', 'CalamitousRend', 'GravityOfRuin', 'ArenaShrinkFlameWalls'];
  var DESP_STAGE = ['lightning', 'rend', 'gravity', 'final'];
  ATK.DesperationPhase = function (st) {
    if (st.f === 0) {
      A.invuln(true); G.sub = 0; G.desp = G.desp || { stage: '' }; G.desp.stage = DESP_STAGE[0];
      st.p.s = newSt();
      G.hist.push({ name: DESP[0], lvl: G.lvl, f: G.fr });
    }
    if (ATK[DESP[G.sub]](st.p.s)) {
      if (G.sub === 2) soulMode('red');
      if (G.sub === 3) { A.win(); return true; }
      G.sub++; st.p.s = newSt();
      G.desp.stage = DESP_STAGE[G.sub];
      G.hist.push({ name: DESP[G.sub], lvl: G.lvl, f: G.fr });
    } else st.p.s.f++;
    return false;
  };
  /* Specials: the Sepulcher, the brothers and the seekers are bodies that
     boss-scal.js runs. The attack starts one and waits until it is done. */
  /* While the worm is up she is not parked. She orbits the soul at 140-260 px:
     the angular speed is 0.6-1.5 rad/s and reverses every 1.2-3 s; the radius
     drifts toward a new target in the band every 1.5-3 s; every 5-7 s she
     telegraphs a reposition (a 0.6 s flicker) and jumps to a new bearing. The
     worm chases her, so its body sweeps round the soul. Every 2.5 s she throws a
     five-dart fan at the soul, telegraphed by a red line for 0.6 s. */
  function wormOrbit(st) {
    var o = st.p.orb, f = st.f - 271;
    if (!o) o = st.p.orb = { ang: aim() + Math.PI, w: 0.9, rev: 2, r: 200, rr: 200, rt: 2, jump: 6, tele: 0, next: 0, sg: 1 };
    o.rev -= TF;
    if (o.rev <= 0) { o.w = o.sg * rnd(0.6, 1.5); o.sg = -o.sg; o.rev = rnd(1.2, 3); }
    o.rt -= TF;
    if (o.rt <= 0) { o.rr = rnd(140, 260); o.rt = rnd(1.5, 3); }
    o.r += (o.rr - o.r) * Math.min(1, TF * 1.2);
    o.jump -= TF;
    if (o.jump <= 0 && !o.tele) {
      o.next = o.ang + o.sg * rnd(1.2, 2.4);
      o.tele = 36; o.jump = rnd(5, 7);
      A.anim('charge_telegraph');
      G.tele.push({ x: A.px, y: A.py, a: o.next, at: G.fr, life: 36 });
    }
    if (o.tele && --o.tele === 0) { o.ang = o.next; A.anim('idle'); }
    o.ang += o.w * TF;
    A.setBoss(hx(A.px + Math.cos(o.ang) * o.r), hy(A.py + Math.sin(o.ang) * o.r));
    if (f % 150 === 60) {
      var a = aim();
      G.tele.push({ x: A.bx, y: A.by, a: a, at: G.fr, life: 36 });
      later(36, function () { fan(5, 0.3, 150); });
    }
  }
  ATK.SummonSepulcher = function (st) {
    /* the opening lead-in: she is quiet for 270 f (SupremeCalamitas.cs:341) */
    if (st.f === 270) A.special('worm');
    if (st.f > 270) wormOrbit(st);
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

  /* ── the new attacks ─────────────────────────────────────────────────
     Infernum (SupremeCalamitas/) and WotG (Avatar/, NamelessDeity/) ports,
     adapted to bullets and to the sheets that already exist: darts,
     gigablasts, hellblasts and demon skulls. Each one names its telegraph
     and the dodge it asks for. Lines and bolts they draw are in G.tele, G.bolts,
     G.lasers, G.hexes, G.rend and G.lanes, which draw() reads. */

  /* Brimstone Lightning: a radial bolt storm. Three waves, one every 90 f. Wave
     w throws 12 + 6w bolts from her, two of them left out as a gap; the gap
     walks on a third of the bolt count each wave. Each bolt telegraphs for 36 f
     as a thin fork, then strikes for 15 f. Dodge: stand in a gap, or move
     while the forks show. */
  function boltSegs(x, y, a, L) {
    var segs = [], px = x, py = y, n = 8, step = L / n, i, pa, nx, ny, fa;
    for (i = 0; i < n; i++) {
      pa = a + (RNG() - 0.5) * 0.25;
      nx = px + Math.cos(pa) * step; ny = py + Math.sin(pa) * step;
      segs.push({ x0: px, y0: py, x1: nx, y1: ny });
      if (i === 2 || i === 5) {
        fa = pa + (RNG() < 0.5 ? -1 : 1) * (0.5 + RNG() * 0.3);
        segs.push({ x0: px, y0: py, x1: px + Math.cos(fa) * step * 1.4, y1: py + Math.sin(fa) * step * 1.4 });
      }
      px = nx; py = ny;
    }
    return segs;
  }
  ATK.BrimstoneLightning = function (st) {
    var f = st.f, w, n, g, i, a;
    move(A.AX + A.AW / 2, A.AY + A.AH / 2, 0.05);
    if (f === 0) st.p.a0 = RNG() * TAU;
    if (f < 270 && f % 90 === 0) {
      w = f / 90; n = 12 + 6 * w; g = Math.floor(w * n / 3) % n;
      A.anim('casting'); A.sfx('hellblast');
      for (i = 0; i < n; i++) {
        if ((i - g + n) % n < 2) continue;
        a = st.p.a0 + i * TAU / n;
        G.bolts.push({ x: A.bx, y: A.by, a: a, end: G.fr + 51, at: G.fr + 36,
                       segs: boltSegs(A.bx, A.by, a, Math.hypot(A.AW, A.AH) * 0.8) });
      }
    }
    if (f % 90 === 36 && f < 270) { G.lightPh++; A.shake('medium'); }
    return f >= 240;
  };

  /* Hex Collapse: six brimstone circles open round the arena, three at f 0 and
     three at f 75. Each shrinks over 2.5 s, then bursts into a ring of twelve
     darts from its centre. Dodge: be outside a circle before it closes. */
  ATK.HexCollapse = function (st) {
    var f = st.f, k, h;
    if (f === 0 || f === 75) {
      for (k = 0; k < 3; k++) {
        if (G.thin && k === 1) continue;   /* in a combo: two hexes, not three */
        h = { x: hx(A.AX + A.AW * (0.15 + 0.7 * RNG())), y: hy(A.AY + A.AH * (0.15 + 0.7 * RNG())),
              at: G.fr, life: 150 };
        G.hexes.push(h);
        later(150, (function (c) { return function () { ring(c.x, c.y, G.thin ? 6 : 12, V(7), 0, 'burst'); }; }(h)));
      }
    }
    return f >= 230;
  };

  /* Predictive Charge: the telegraph aims where the soul will be when she gets
     there, from the soul's real velocity (predict()). The line holds 40 f with
     the aim fixed at the last frame. Then she charges at 900 px/s, leaving an
     afterimage every 4 f and two wake darts every 6 f, and stops with a ring. */
  ATK.PredictiveCharge = function (st) {
    var f = st.f, k, dx, dy, L, s, pa, p;
    if (f === 0) { st.p.tl = { x: A.bx, y: A.by, a: 0, at: G.fr, life: 40 }; G.tele.push(st.p.tl); }
    if (f < 40) {
      A.anim('charge_telegraph'); A.willCharge(true);
      p = predict(A.bx, A.by, 900);
      st.p.tl.x = A.bx; st.p.tl.y = A.by; st.p.tl.a = Math.atan2(p.y - A.by, p.x - A.bx);
      st.p.tx = p.x; st.p.ty = p.y;
      return false;
    }
    if (f === 40) { A.willCharge(false); A.anim('charging'); }
    k = f - 40;
    dx = st.p.tx - A.bx; dy = st.p.ty - A.by; L = Math.hypot(dx, dy); pa = Math.atan2(dy, dx);
    if (L <= 15 || k >= 60) { ring(A.bx, A.by, 8, V(8), 0, 'burst'); A.anim('idle'); return true; }
    s = 15 / L;
    if (k % 4 === 0) G.after.push({ x: A.bx, y: A.by, at: G.fr });
    if (k % 6 === 0) {
      A.shot(A.bx, A.by, Math.cos(pa + Math.PI / 2) * 120, Math.sin(pa + Math.PI / 2) * 120, 0, { tag: 'brim', fuse: 5 });
      A.shot(A.bx, A.by, Math.cos(pa - Math.PI / 2) * 120, Math.sin(pa - Math.PI / 2) * 120, 0, { tag: 'brim', fuse: 5 });
    }
    A.setBoss(hx(A.bx + dx * s), hy(A.by + dy * s));
    return false;
  };

  /* Converging Skulls (Infernum's spiral). She hovers at the arena centre. From
     f 30 to 210 two skulls leave every 6 f (12 f thinned) on an arm that unwinds
     inward: the arm's radius falls 330 -> 40 px and its angle turns 0.22 rad a
     step, and each skull drifts at 80 px/s toward the centre. Dodge: the
     spiral has gaps that open as it closes; move with the arm. */
  ATK.ConvergingSkulls = function (st) {
    var f = st.f, cx = A.AX + A.AW / 2, cy = A.AY + A.AH / 2, cad = G.thin ? 12 : 6, k, r, q, x, y, ia;
    move(cx, cy, 0.06);
    if (f >= 30 && f < 210 && (f - 30) % cad === 0) {
      r = Math.max(40, 330 - (f - 30) * 1.6);
      for (k = 0; k < 2; k++) {
        q = (f - 30) * 0.22 + k * Math.PI;
        x = cx + Math.cos(q) * r; y = cy + Math.sin(q) * r;
        ia = Math.atan2(cy - y, cx - x);
        A.shot(x, y, Math.cos(ia) * 80, Math.sin(ia) * 80, 0, { tag: 'demon', fuse: 8 });
      }
    }
    return f >= 240;
  };

  /* Brimstone Rain (a falling screen with safe lanes). Ten lanes across the
     top. Every 100 f two adjacent lanes are picked safe and shown for 40 f
     (G.lanes). Then brimstone falls down the other lanes every 9 f (18 f
     thinned) until the cycle ends. Dodge: be in the safe pair. Three cycles. */
  ATK.BrimstoneRain = function (st) {
    var f = st.f, L = 10, lw = A.AW / L, c = f % 100, i, x, cad = G.thin ? 18 : 9;
    if (c === 0) { st.p.safe = (RNG() * (L - 1)) | 0; G.lanes = { s: st.p.safe, at: G.fr, life: 100 }; }
    if (c >= 40 && (c - 40) % cad === 0) {
      for (i = 0; i < L; i++) {
        if (i === st.p.safe || i === st.p.safe + 1) continue;
        x = A.AX + (i + 0.5) * lw;
        A.shot(x, A.AY - 10, 0, 170, 0, { tag: 'brim', fuse: 3.5 });
      }
    }
    return f >= 300;
  };

  /* Gigablast Cross (WotG's rotating arms, as Infernum's gigablasts). From her,
     four gigablasts go out every 24 f (40 f thinned), the cross turning 0.012 rad
     a frame, so it sweeps the 420 f attack. Dodge: between the arms as they turn. */
  ATK.GigablastCross = function (st) {
    var f = st.f, cad = G.thin ? 40 : 24, k, a;
    move(A.AX + A.AW / 2, A.AY + A.AH / 2, 0.05);
    if (f % cad === 0 && f < 420) {
      for (k = 0; k < 4; k++) {
        a = f * 0.012 + k * Math.PI / 2;
        A.shot(A.bx, A.by, Math.cos(a) * 150, Math.sin(a) * 150, 2, { tag: 'gig', fuse: 2.5 });
      }
      if (f % 48 === 0) A.sfx('giga');
    }
    return f >= 420;
  };

  /* Eye Lock (Calamitas' eyes, WotG's lock-on). Three eyes open along the top of
     the arena and lock in turn at f 20, 90 and 160. Each tracks the soul for 60 f
     with a thin lock line, then fires a 40 f beam along the angle it held at the
     lock. Dodge: the lock line shows where the beam will go. */
  ATK.EyeLockBeams = function (st) {
    var f = st.f, k, e;
    if (f === 0) {
      st.p.eyes = [];
      for (k = 0; k < 3; k++) st.p.eyes.push({ x: A.AX + A.AW * (0.2 + 0.3 * k), y: A.AY + 14, lock: 20 + k * 70, l: null });
    }
    for (k = 0; k < 3; k++) {
      if (G.thin && k === 1) continue;     /* in a combo: the middle eye stays shut */
      e = st.p.eyes[k];
      if (f === e.lock) {
        e.l = { x: e.x, y: e.y, a: 0, len: beamLen(), at: G.fr + 60, end: G.fr + 100, tele: true };
        G.lasers.push(e.l);
      }
      if (f >= e.lock && f < e.lock + 60) e.l.a = Math.atan2(A.py - e.y, A.px - e.x);
    }
    return f >= 270;
  };

  /* Gravity of Ruin (the blue section). The soul turns blue (NEU.scalSoul.setMode
     'blue': the gravity mode, which the soul module owns). Six bands at jump
     height sweep the arena, each a 40 f telegraph and then a 90 f sweep of 130 px
     across, alternating direction. Dodge: stand on the floor between the bands,
     or jump the band as it comes. The soul goes back to red at the end. 720 f. */
  ATK.GravityOfRuin = function (st) {
    var f = st.f, j, y;
    if (f === 0) {
      soulMode('blue'); move(A.AX + A.AW / 2, A.AY + A.AH * 0.2, 0.1);
      /* two ledges between the band heights: a third way past a band */
      if (NEU.scalSoul) NEU.scalSoul.platforms = [
        { x: A.AX + A.AW * 0.18, y: A.AY + A.AH - 95, w: A.AW * 0.22 },
        { x: A.AX + A.AW * 0.60, y: A.AY + A.AH - 165, w: A.AW * 0.22 }];
    }
    for (j = 0; j < 6; j++) {
      if (f !== 40 + j * 110) continue;
      y = A.AY + A.AH - 60 - (j % 3) * 70;
      G.lasers.push({ x: 0, y: y, a: 0, len: 130, at: G.fr + 40, end: G.fr + 130, tele: true,
                      sw: j % 2 ? [A.AX + A.AW - 120, A.AX - 10] : [A.AX - 10, A.AX + A.AW - 120] });
    }
    if (f === 719) { soulMode('red'); if (NEU.scalSoul) NEU.scalSoul.platforms = null; }
    return f >= 720;
  };

  /* Calamitous Rend (the screen cut, a WotG reality tear). She tears the arena
     with n slashes (4 in phase 3, 5 in the desperation), one every 90 f. Each
     telegraphs for 54 f, a line growing out from the middle (G.rend, phase
     'tele'). Then the rift opens for 30 f: a 12 px band that hurts, throwing
     darts out perpendicular to the cut, both ways. The slashes alternate between
     two diagonals, so they lattice the arena. The last one passes through where
     the soul stands when it is drawn. Dodge: sit in a cell the rift misses. */
  ATK.CalamitousRend = function (st) {
    var f = st.f, n = G.lvl >= 4 ? 5 : 4, k, ang, cx, cy, L;
    if (f % 90 === 0 && f / 90 < n) {
      k = f / 90;
      ang = (k % 2 ? -0.5 : 0.5) + (RNG() - 0.5) * 0.12;
      cx = k === n - 1 ? A.px : A.AX + A.AW * (0.2 + 0.6 * ((k * 0.37) % 1));
      cy = k === n - 1 ? A.py : A.AY + A.AH * (0.25 + 0.5 * RNG());
      L = Math.hypot(A.AW, A.AH);
      G.rend.push({ x1: cx - Math.cos(ang) * L, y1: cy - Math.sin(ang) * L,
                    x2: cx + Math.cos(ang) * L, y2: cy + Math.sin(ang) * L,
                    cx: cx, cy: cy, ang: ang, t: 0, phase: 'tele' });
    }
    return f >= (n - 1) * 90 + 84;
  };
  /* the cuts' clock, once per step: telegraph, then rift, then gone */
  function rendTick() {
    var i, r, u, p, sa, ca;
    for (i = G.rend.length - 1; i >= 0; i--) {
      r = G.rend[i];
      r.t++;
      if (r.phase === 'tele') {
        /* the approaching chime: ticks closing in, 24 -> 8 f apart */
        if ((r.t === 16 || r.t === 40 || r.t === 48) && NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
        if (r.t >= 54) {
          r.phase = 'rift'; r.t = 0;
          A.sfx('giga-hit'); A.shake('medium');
        }
        continue;
      }
      if (r.t % 5 === 0) {
        u = (RNG() - 0.5) * Math.hypot(A.AW, A.AH) * 0.8;
        p = { x: r.cx + Math.cos(r.ang) * u, y: r.cy + Math.sin(r.ang) * u };
        sa = Math.sin(r.ang); ca = Math.cos(r.ang);
        if (p.x >= A.AX && p.x <= A.AX + A.AW && p.y >= A.AY && p.y <= A.AY + A.AH) {
          A.shot(p.x, p.y, -sa * 150, ca * 150, 0, { tag: 'brim', fuse: 4 });
          A.shot(p.x, p.y, sa * 150, -ca * 150, 0, { tag: 'brim', fuse: 4 });
        }
      }
      if (r.t >= 30) G.rend.splice(i, 1);
    }
  }

  /* A scripted combo: two attacks run together, each on its own state, with
     G.thin set so the bodies that thin their cadence do. Each one moves her
     only if the other does not, so the pair never fights over her. */
  function combo(a, b) {
    return function (st) {
      if (st.f === 0) { st.p.a = newSt(); st.p.b = newSt(); st.p.da = false; st.p.db = false; G.thin = true; }
      if (!st.p.da) { st.p.da = ATK[a](st.p.a); st.p.a.f++; }
      if (!st.p.db) { st.p.db = ATK[b](st.p.b); st.p.b.f++; }
      if (st.p.da && st.p.db) { G.thin = false; return true; }
      return false;
    };
  }
  function newSt() { return { f: 0, n: 0, sf: 0, side: 1, vol: 0, p: {} }; }
  ATK.ComboSkullRain = combo('ConvergingSkulls', 'BrimstoneRain');
  ATK.ComboEyeHex = combo('EyeLockBeams', 'HexCollapse');
  /* the spin's beam sweeps while hellblasts cross it; both at half cadence */
  ATK.ComboLaserHell = combo('FireLaserSpin', 'HellblastBarrage');

  /* ── the cycles (SupremeCalamitas.cs:188-241, in source order) ──────── */
  /* The pools, one per phase (phase 3 and 4 share the third). Each attack is
     one entry, and each pool holds BrimstoneLightning, so every phase has it
     in its bag. A bag is the whole pool shuffled, drawn to the end, then
     refilled: no attack comes round twice in one bag. */
  var POOL = [
    ['HorizontalDarkSoulRelease', 'CondemnationFanBurst', 'ExplosiveCharges', 'SummonSuicideBomberDemons',
     'BrimstoneLightning', 'HexCollapse', 'PredictiveCharge', 'ComboSkullRain'],
    ['CondemnationFanBurst', 'ShadowDemon_ReleaseExplodingShadowBlasts', 'HellblastBarrage', 'BrimstoneJewelBeam',
     'ExplosiveCharges', 'HorizontalDarkSoulRelease', 'SummonSuicideBomberDemons', 'BrimstoneLightning',
     'ConvergingSkulls', 'EyeLockBeams', 'ComboEyeHex', 'BrimstoneRain', 'PredictiveCharge', 'GravityOfRuin'],
    ['ShadowDemon_ShadowGigablastsAndCharges', 'FireLaserSpin', 'DarkMagicBombWalls', 'CondemnationFanBurst',
     'BrimstoneJewelBeam', 'ExplosiveCharges', 'BecomeBerserk', 'BrimstoneLightning', 'GigablastCross',
     'PredictiveCharge', 'CalamitousRend', 'ComboSkullRain', 'ComboEyeHex', 'ComboLaserHell']
  ];
  /* SelectNextAttack after BecomeBerserk: one of these three, uniformly */
  var BERSERK_PICK = ['CondemnationFanBurst', 'ExplosiveCharges', 'HellblastBarrage'];
  /* PhaseTransition's next attack, by the phase she has just entered */
  var AFTER_PT = { 1: 'SummonShadowDemon', 2: 'SummonBrothers', 3: 'SummonSeekers', 4: 'DesperationPhase' };
  /* the phase gates: the HP share at which each phase starts */
  var GATE = [0.75, 0.45, 0.25, 0];
  /* attacks that hold her invulnerable while they run */
  var INVULN = { PhaseTransition: 1, DesperationPhase: 1, SummonSepulcher: 1, SummonBrothers: 1, SummonSeekers: 1 };

  function cycleNext() {
    if (G.last === 'BecomeBerserk') return BERSERK_PICK[(RNG() * BERSERK_PICK.length) | 0];
    if (!G.bag || !G.bag.length) {
      G.bag = shuffle(POOL[Math.min(G.lvl, 2)].slice());
      /* the bag is drawn from the end: if that would open on the attack just
         finished, swap the first pick with another one */
      var n = G.bag.length - 1;
      if (G.bag[n] === G.last) {
        var j = (RNG() * n) | 0, t = G.bag[j];
        G.bag[j] = G.bag[n]; G.bag[n] = t;
      }
    }
    return G.bag.pop();
  }

  function fresh() {
    return { fr: 0, ev: [], last: '', queue: [], bag: null, lvl: 0, lightPh: 0, berserk: false,
             beam: null, sub: -1, desp: null, tele: [], rend: [], bolts: [], lasers: [],
             hexes: [], after: [], lanes: null, box: null, thin: false, hist: [] };
  }

  function begin(name) {
    if (name === 'PhaseTransition') {
      /* a transition clears what the last phase left running: the beam, the
         hazards and every timer still queued (bomb fuses, rings, lunges) */
      G.beam = null; G.ev = []; G.tele = []; G.rend = []; G.bolts = []; G.lasers = [];
      G.hexes = []; G.after = []; G.lanes = null; G.box = null; G.thin = false;
    }
    /* a blue section cut short (a gate, a force) does not leak into the next */
    if (NEU.scalSoul && NEU.scalSoul.platforms) { NEU.scalSoul.platforms = null; soulMode('red'); }
    /* a combo that was cut short (a gate, a force) must not leave its thinning on */
    G.thin = false;
    cur = { name: name, fn: ATK[name], st: newSt() };
    A.invuln(!!INVULN[name]);
    if (name === 'DesperationPhase') G.sub = 0;
    G.hist.push({ name: name, lvl: G.lvl, f: G.fr });
  }

  function finish() {
    G.last = cur.name;
    cur = null;
    G.beam = null;
    if (A.over()) return;
    begin(G.queue.length ? G.queue.shift() : cycleNext());
  }

  /* a hazard that holds the soul hurts her: the beam, the lasers, the bolts in
     their strike, the rend rifts. The hit itself is boss-scal's (shield,
     i-frames, dash). */
  function hurtCheck() {
    var b = G.beam, i, k, s, bo, r;
    if (b) {
      var dx = A.px - b.x, dy = A.py - b.y, c = Math.cos(b.a), sn = Math.sin(b.a);
      var along = dx * c + dy * sn, across = Math.abs(dx * sn - dy * c);
      if (along > 0 && along < b.len && across < 6) A.hit();
    }
    for (i = 0; i < G.bolts.length; i++) {
      bo = G.bolts[i];
      if (G.fr < bo.at) continue;
      for (k = 0; k < bo.segs.length; k++) {
        s = bo.segs[k];
        if (segDist(A.px, A.py, s.x0, s.y0, s.x1, s.y1) < 7) { A.hit(); break; }
      }
    }
    for (i = 0; i < G.lasers.length; i++) {
      if (G.fr < G.lasers[i].at) continue;
      s = laserSeg(G.lasers[i]);
      if (segDist(A.px, A.py, s.x0, s.y0, s.x1, s.y1) < 7) A.hit();
    }
    for (i = 0; i < G.rend.length; i++) {
      r = G.rend[i];
      if (r.phase === 'rift' &&
          Math.abs((A.px - r.cx) * Math.sin(r.ang) - (A.py - r.cy) * Math.cos(r.ang)) < 12) A.hit();
    }
  }

  function step() {
    G.fr++;
    var due = [], keep = [], i, fr = G.fr;
    for (i = 0; i < G.ev.length; i++) (G.ev[i].f <= fr ? due : keep).push(G.ev[i]);
    G.ev = keep;
    G.tele = G.tele.filter(function (t) { return fr - t.at < t.life; });
    G.hexes = G.hexes.filter(function (h) { return fr - h.at < h.life; });
    G.after = G.after.filter(function (a) { return fr - a.at < 24; });
    G.bolts = G.bolts.filter(function (b) { return fr < b.end; });
    G.lasers = G.lasers.filter(function (l) { return fr < l.end; });
    if (G.lanes && fr - G.lanes.at >= G.lanes.life) G.lanes = null;
    for (i = 0; i < due.length; i++) due[i].fn();
    rendTick();
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
      RNG = seeded((Math.random() * 4294967296) >>> 0);
      begin('SummonSepulcher');
    },
    /* the fight is closed */
    reset: function () {
      G = null; cur = null; acc = 0; RNG = Math.random;
      if (NEU.scalSoul) NEU.scalSoul.platforms = null;
    },
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
      /* a gate that lands before this phase's lightning has struck queues it
         first in the next phase, ahead of the transition's own attack */
      var pend = G.lightPh === 0;
      G.lvl++;
      G.lightPh = 0;
      A.level(G.lvl);
      G.bag = null;
      if (G.lvl === 4) { G.desp = { stage: '' }; A.setHP(1); G.queue = [AFTER_PT[4]]; }
      else G.queue = (pend ? ['BrimstoneLightning'] : []).concat([AFTER_PT[G.lvl]]);
      begin('PhaseTransition');
    },
    /* dev `skip`: the phase a starting HP share belongs to. Every gate at or
       above it is passed; a share of 2 % or less is the desperation (the
       real one runs at 1 HP, which no other phase reaches). */
    levelFor: function (frac) {
      var n = 0;
      while (n < 3 && frac <= GATE[n]) n++;
      return frac > 0 && frac <= 0.02 ? 4 : n;
    },
    /* dev `skip`: jump straight to phase n, with no transition and none of
       the summons in between (no worm, shadow demon, brothers or seekers
       replay). The lead-in is dropped too: phase n's first attack starts now. */
    setLevel: function (n) {
      if (!G) return;
      G.lvl = n; G.lightPh = 0; G.bag = null; G.queue = [];
      A.level(n);
      if (n === 4) { G.desp = { stage: '' }; A.setHP(1); G.queue = ['DesperationPhase']; }
      begin(G.queue.length ? G.queue.shift() : cycleNext());
    },
    /* the debug hook (NEU.scal.force) and the tests: run one attack now */
    force: function (name) {
      if (!G) G = fresh();
      K = A.AW / 2000; acc = 0;
      if (!ATK[name]) return false;
      /* the desperation writes G.desp.stage: give it the phase it runs in */
      if (name === 'DesperationPhase' && !G.desp) { G.lvl = 4; G.desp = { stage: '' }; }
      begin(name);
      return true;
    },
    level: function () { return G ? G.lvl : 0; },
    sub: function () { return G ? G.sub : -1; },
    attack: function () { return cur ? cur.name : ''; },
    last: function () { return G ? G.last : ''; },
    names: function () { return Object.keys(ATK); },
    /* the attack pools, for the tests and the notes */
    pools: POOL,
    /* the test hooks: every attack the machine started, with its phase and
       frame (debug.history), and the lightning strikes in this phase */
    debug: {
      get history() { return G ? G.hist : []; },
      get lightning() { return G ? G.lightPh : 0; }
    },
    /* the new bodies, for draw and the tests */
    beam: function () { return G ? G.beam : null; },
    teles: function () { return G ? G.tele : []; },
    rend: function () { return G ? G.rend : []; },
    bolts: function () { return G ? G.bolts : []; },
    lasers: function () { return G ? G.lasers : []; },
    hexes: function () { return G ? G.hexes : []; },
    lanes: function () { return G ? G.lanes : null; },
    box: function () { return G ? G.box : null; },
    afterimages: function () { return G ? G.after : []; },
    pending: function () { return G ? G.ev.length : 0; },
    stage: function () { return G && G.desp ? G.desp.stage : ''; },
    /* V: the newest open rift (for the view split), or null */
    rift: function () { return liveRift(); },
    frame: function () { return G ? G.fr : 0; },
    berserk: function () { return G ? G.berserk : false; },
    /* drawn over the field, under the bullets: the telegraphs, the
       beams, the new hazards */
    draw: function (ctx) {
      if (!G) return;
      var i, t, L = beamLen();
      /* lines and the beam stop at the forcefield */
      ctx.save();
      ctx.beginPath(); ctx.rect(A.AX, A.AY, A.AW, A.AH); ctx.clip();
      /* DemonicTelegraphLine.PreDraw: Color.Red, width lerp(0.3, 3) over
         a 0-1-0 bump, opacity three times the bump, capped at 1 */
      for (i = 0; i < G.tele.length; i++) {
        t = G.tele[i];
        var k = Math.sin(Math.PI * (G.fr - t.at) / t.life), c = Math.cos(t.a), sn = Math.sin(t.a);
        line(ctx, t.x - c * L, t.y - sn * L, t.x + c * L, t.y + sn * L,
             'rgba(255,0,0,' + Math.min(1, k * 3).toFixed(2) + ')', Math.max(1, Math.round(lerp(0.3, 3, k))));
      }
      if (G.beam) beam(ctx, G.beam);
      drawNew(ctx);
      ctx.restore();
    }
  };

  /* The look of the new bodies (track V). Everything hot is stacked
     additively ('lighter'): a wide dim brimstone stroke, a narrower hot
     one, a white core, the Calamity way of faking bloom. Telegraphs stay
     plain red hairlines on purpose, so the dodge reads before the glow. */
  var SCARS = [];
  function glowLine(ctx, x0, y0, x1, y1, k, core) {
    line(ctx, x0, y0, x1, y1, 'rgba(150,16,24,' + (0.35 * k).toFixed(2) + ')', core * 5);
    line(ctx, x0, y0, x1, y1, 'rgba(255,70,36,' + (0.5 * k).toFixed(2) + ')', core * 2.6);
    line(ctx, x0, y0, x1, y1, 'rgba(255,190,140,' + (0.85 * k).toFixed(2) + ')', core * 1.2);
    line(ctx, x0, y0, x1, y1, 'rgba(255,255,255,' + (0.9 * k).toFixed(2) + ')', Math.max(1, core * 0.45));
  }
  function glowAt(ctx, x, y, r, col, a) {
    if (NEU.danmaku && NEU.danmaku.glow) NEU.danmaku.glow(ctx, x, y, r, col, a);
  }
  function drawNew(ctx) {
    var i, j, h, bo, l, r, u, sg, k, half, ca, sa, op = ctx.globalCompositeOperation;
    var desp = !!G.desp;
    ctx.lineCap = 'round';
    /* the shrinking box: dead ground outside it, a flame wall on its edge */
    if (G.box) {
      var bb = G.box, wa;
      ctx.fillStyle = 'rgba(40,0,6,0.72)';
      ctx.fillRect(A.AX, A.AY, A.AW, bb.y - A.AY);
      ctx.fillRect(A.AX, bb.y + bb.h, A.AW, A.AY + A.AH - bb.y - bb.h);
      ctx.fillRect(A.AX, bb.y, bb.x - A.AX, bb.h);
      ctx.fillRect(bb.x + bb.w, bb.y, A.AX + A.AW - bb.x - bb.w, bb.h);
      ctx.globalCompositeOperation = 'lighter';
      wa = 'rgba(255,60,30,' + (0.3 + 0.1 * Math.sin(G.fr * 0.21)).toFixed(2) + ')';
      line(ctx, bb.x, bb.y, bb.x + bb.w, bb.y, wa, 12);
      line(ctx, bb.x, bb.y + bb.h, bb.x + bb.w, bb.y + bb.h, wa, 12);
      line(ctx, bb.x, bb.y, bb.x, bb.y + bb.h, wa, 12);
      line(ctx, bb.x + bb.w, bb.y, bb.x + bb.w, bb.y + bb.h, wa, 12);
      ctx.globalCompositeOperation = op;
      ctx.strokeStyle = '#FFB070'; ctx.lineWidth = 2;
      ctx.strokeRect(bb.x | 0, bb.y | 0, bb.w | 0, bb.h | 0);
    }
    /* hex collapse: a filled warning disc that brightens as it closes */
    for (i = 0; i < G.hexes.length; i++) {
      h = G.hexes[i];
      u = Math.min(1, (G.fr - h.at) / h.life);
      var hr = Math.max(2, 80 * (1 - u));
      ctx.fillStyle = 'rgba(255,40,30,' + (0.06 + 0.18 * u).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,90,40,0.5)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = op;
      ctx.strokeStyle = '#FFD0A0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, TAU); ctx.stroke();
      if (u > 0.8) glowAt(ctx, h.x, h.y, 28, '#FF6A3A', (u - 0.8) * 4);
    }
    if (G.lanes) {
      var lw = A.AW / 10, ln = G.lanes;
      ctx.fillStyle = 'rgba(120,255,160,' + (G.fr - ln.at < 40 ? 0.22 : 0.08).toFixed(2) + ')';
      ctx.fillRect(A.AX + ln.s * lw, A.AY, lw * 2, A.AH);
      ctx.fillStyle = 'rgba(160,255,190,0.7)';
      ctx.fillRect((A.AX + ln.s * lw) | 0, A.AY, 2, A.AH);
      ctx.fillRect((A.AX + (ln.s + 2) * lw - 2) | 0, A.AY, 2, A.AH);
    }
    /* Brimstone Lightning. Telegraph: the fork's path as a dim red
       hairline that firms up over its 36 f. Strike: the forks in four
       additive layers, an impact bloom where each one ends, a bloom at
       her hands. */
    for (i = 0; i < G.bolts.length; i++) {
      bo = G.bolts[i];
      if (G.fr < bo.at) {
        k = 1 - (bo.at - G.fr) / 36;
        for (j = 0; j < bo.segs.length; j++) {
          sg = bo.segs[j];
          line(ctx, sg.x0, sg.y0, sg.x1, sg.y1, 'rgba(255,40,40,' + (0.25 + 0.5 * k).toFixed(2) + ')', 1);
        }
        continue;
      }
      k = Math.max(0, 1 - (G.fr - bo.at) / 15);
      ctx.globalCompositeOperation = 'lighter';
      for (j = 0; j < bo.segs.length; j++) {
        sg = bo.segs[j];
        glowLine(ctx, sg.x0, sg.y0, sg.x1, sg.y1, 0.4 + 0.6 * k, 3);
      }
      ctx.globalCompositeOperation = op;
      sg = bo.segs[bo.segs.length - 1];
      if (k > 0.5) glowAt(ctx, sg.x1, sg.y1, 26, '#FFD0A0', k);
      if (i === 0) glowAt(ctx, bo.x, bo.y, 64, desp ? '#FFFFFF' : '#FF6A3A', 0.6 * k);
    }
    for (i = 0; i < G.lasers.length; i++) {
      l = G.lasers[i];
      sg = laserSeg(l);
      if (G.fr < l.at) {
        line(ctx, sg.x0, sg.y0, sg.x1, sg.y1, 'rgba(255,0,0,' + (0.35 + 0.35 * Math.sin(G.fr * 0.3)).toFixed(2) + ')', 1);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        glowLine(ctx, sg.x0, sg.y0, sg.x1, sg.y1, 1, 4);
        ctx.globalCompositeOperation = op;
      }
    }
    /* Calamitous Rend. Telegraph: a hairline that flickers slowly (2 Hz)
       and thickens 1 -> 3 px while it grows; the chime is in rendTick.
       Cut: the white-hot rift (its 12 px core is the hurt band), a
       brimstone bloom either side, embers thrown off it. Afterwards a
       dark scar lingers 2 s, harmless and dim so it never reads as a
       live line. The view split is boss-scal's (NEU.scal splitOffset). */
    for (i = SCARS.length - 1; i >= 0; i--) {
      r = SCARS[i];
      u = (G.fr - r.at) / 120;
      if (u >= 1 || G.fr < r.at - 40) { SCARS.splice(i, 1); continue; }
      if (u < 0) continue;
      line(ctx, r.x1, r.y1, r.x2, r.y2, 'rgba(90,10,16,' + (0.55 * (1 - u)).toFixed(2) + ')', 3);
      line(ctx, r.x1, r.y1, r.x2, r.y2, 'rgba(255,120,60,' + (0.25 * (1 - u)).toFixed(2) + ')', 1);
    }
    for (i = 0; i < G.rend.length; i++) {
      r = G.rend[i];
      ca = Math.cos(r.ang); sa = Math.sin(r.ang);
      if (r.phase === 'tele') {
        var g = Math.min(1, r.t / 54);
        half = Math.hypot(A.AW, A.AH) * g;
        k = 0.55 + 0.35 * Math.sin(r.t * 0.21);
        line(ctx, r.cx - ca * half, r.cy - sa * half, r.cx + ca * half, r.cy + sa * half,
             'rgba(255,48,64,' + k.toFixed(2) + ')', 1 + Math.round(2 * g));
        line(ctx, r.cx - ca * half, r.cy - sa * half, r.cx + ca * half, r.cy + sa * half,
             'rgba(255,230,230,' + (0.5 * g).toFixed(2) + ')', 1);
        continue;
      }
      if (!r.scar) {
        r.scar = true;
        SCARS.push({ x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, at: G.fr + 30 });
      }
      k = Math.max(0.35, 1 - r.t / 30);
      ctx.globalCompositeOperation = 'lighter';
      line(ctx, r.x1, r.y1, r.x2, r.y2, 'rgba(160,16,24,' + (0.45 * k).toFixed(2) + ')', 40);
      line(ctx, r.x1, r.y1, r.x2, r.y2, 'rgba(255,70,30,' + (0.6 * k).toFixed(2) + ')', 22);
      line(ctx, r.x1, r.y1, r.x2, r.y2, 'rgba(255,200,150,' + (0.9 * k).toFixed(2) + ')', 12);
      line(ctx, r.x1, r.y1, r.x2, r.y2, '#FFFFFF', 5);
      /* embers: fixed seeds along the cut, thrown out and up with t */
      ctx.fillStyle = 'rgba(255,170,80,' + k.toFixed(2) + ')';
      for (j = 0; j < 28; j++) {
        var s = ((j * 0.618) % 1 - 0.5) * Math.hypot(A.AW, A.AH);
        var d = (4 + r.t * (1.2 + (j % 5) * 0.5)) * (j % 2 ? 1 : -1);
        ctx.fillRect((r.cx + ca * s - sa * d) | 0, (r.cy + sa * s + ca * d - r.t * 0.4) | 0, 2 + (j % 2), 2 + (j % 2));
      }
      ctx.globalCompositeOperation = op;
    }
    /* afterimages: her silhouette in brimstone, smeared behind a charge */
    for (i = 0; i < G.after.length; i++) {
      var af = G.after[i];
      k = 1 - (G.fr - af.at) / 24;
      if (k > 0) glowAt(ctx, af.x, af.y, 30, '#FF3A2A', 0.45 * k);
    }
    ctx.lineCap = 'butt';
  }
  function liveRift() {
    for (var i = G ? G.rend.length - 1 : -1; i >= 0; i--)
      if (G.rend[i].phase === 'rift') return G.rend[i];
    return null;
  }

  function line(ctx, x0, y0, x1, y1, col, w) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  /* The BrimstoneLaserbeam: three additive glow steps (the source's
     red-to-white primitive, stepped), then BrimstoneRayMid tiled down the
     beam at half size with BrimstoneRayEnd at the tip. The 13 px core
     matches the 12 px hit band in hurtCheck. */
  function beam(ctx, b) {
    var ex = b.x + Math.cos(b.a) * b.len, ey = b.y + Math.sin(b.a) * b.len;
    var op = ctx.globalCompositeOperation;
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'lighter';
    line(ctx, b.x, b.y, ex, ey, 'rgba(160,20,30,0.35)', 34);
    line(ctx, b.x, b.y, ex, ey, 'rgba(255,60,40,0.45)', 20);
    line(ctx, b.x, b.y, ex, ey, 'rgba(255,170,110,0.6)', 8);
    if (NEU.danmaku && NEU.danmaku.glow) NEU.danmaku.glow(ctx, b.x, b.y, 40, '#FF4A2A', 0.9);
    ctx.globalCompositeOperation = op;
    var mid = NEU.sheetReady && NEU.sheetReady(NEU.sheets.scalRay);
    var end = NEU.sheetReady && NEU.sheetReady(NEU.sheets.scalRayEnd);
    if (mid) {
      ctx.save();
      ctx.translate(b.x | 0, b.y | 0); ctx.rotate(b.a - Math.PI / 2);
      for (var y = 0; y < b.len; y += 15) ctx.drawImage(mid, 0, 0, 26, 30, -6, y, 13, 15);
      if (end) ctx.drawImage(end, 0, 0, 26, 22, -6, b.len | 0, 13, 11);
      ctx.restore();
    } else line(ctx, b.x, b.y, ex, ey, 'rgba(255,74,42,0.95)', 4);
    ctx.lineWidth = 1;
  }
}());
