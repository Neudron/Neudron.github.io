/* polt-attacks.js — Infernum Polterghast cycle records.
   Attack timings and shapes are scaled from the MIT behavior override. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var ATK = {};
  var A = null, phase = 1, index = 0, current = null, signature = false;
  var TAU = Math.PI * 2;
  function D(d, st) { return d * st.aw / 2000; }
  function V(v, st) { return v * 60 * st.aw / 2000; }
  function bump(t, a, b, peak, c) {
    if (t < a || t > c) return 0;
    if (t < b) return (t - a) / (b - a);
    if (t < peak) return 1;
    return (c - t) / (c - peak);
  }
  var CYCLES = [null,
    ['EctoplasmUppercutCharges', 'LegSwipes', 'WispCircleCharges', 'EctoplasmUppercutCharges', 'SpiritPetal'],
    ['AsgoreRingSoulAttack', 'ArcingSouls', 'EctoplasmUppercutCharges', 'VortexCharge', 'SpiritPetal', 'LegSwipes', 'WispCircleCharges', 'ArcingSouls', 'EctoplasmUppercutCharges', 'VortexCharge', 'LegSwipes', 'SpiritPetal'],
    ['CloneSplit', 'AsgoreRingSoulAttack', 'VortexCharge', 'ArcingSouls', 'SpiritPetal', 'EctoplasmUppercutCharges', 'LegSwipes', 'CloneSplit', 'VortexCharge', 'WispCircleCharges', 'ArcingSouls', 'EctoplasmUppercutCharges', 'LegSwipes', 'SpiritPetal']];
  var TELEF = 24; /* SoulTelegraphLine.cs:27 — 24 frames, 0.4 s */
  var SPECS = {
    EctoplasmUppercutCharges: { duration: 204, events: [54, 102, 150], shape: 'line', count: 6, speed: 23 },
    LegSwipes: { duration: 224, events: [54, 112, 170], shape: 'fan', count: 5, speed: 18 },
    WispCircleCharges: { duration: 252, events: [54, 108, 162, 216], shape: 'ring', count: 8, speed: 15 },
    AsgoreRingSoulAttack: { duration: 276, events: [54, 90, 126, 162, 198, 234], shape: 'ring', count: 24, gap: 4, speed: 14 },
    ArcingSouls: { duration: 252, events: [54, 102, 150, 198], shape: 'fan', count: 6, speed: 19 },
    VortexCharge: { duration: 240, events: [54, 108, 162], shape: 'line', count: 7, speed: 27 },
    SpiritPetal: { duration: 300, events: [54, 84, 114, 144, 174, 204, 234, 264], shape: 'fan', count: 6, speed: 17 },
    CloneSplit: { duration: 264, events: [90, 150, 210], shape: 'ring', count: 12, speed: 20 },
    DesperationAttack: { duration: 300, events: [54, 84, 114, 144, 174, 204, 234, 264], shape: 'ring', count: 16, gap: 3, speed: 18 }
  };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  /* SoulTelegraphLine.cs:52-53 — the line is the shot's own direction. */
  function soulLines(shape, st) {
    var out = [], i, n = shape.count, a, x, y, gapAt = (n / 2) | 0, len = D(2000, st);
    for (i = 0; i < n; i++) {
      if (shape.gap && ((i - gapAt + n) % n) < shape.gap) continue;
      if (shape.kind === 'ring') a = shape.a + i * TAU / n;
      else a = shape.a + (shape.kind === 'fan' && n > 1 ? (i / (n - 1) - 0.5) * shape.spread : 0);
      x = shape.kind === 'ring' ? shape.x + Math.cos(a) * shape.r : shape.x;
      y = shape.kind === 'ring' ? shape.y + Math.sin(a) * shape.r : shape.y;
      out.push({ x: x, y: y, a: a, len: len });
    }
    return out;
  }
  function point(st) {
    return { x: st.x, y: st.y, tx: st.tx, ty: st.ty, ax: st.ax, ay: st.ay, aw: st.aw, ah: st.ah };
  }
  function attack(st, name) {
    var spec = SPECS[name], p = st.p || (st.p = {}), i, f = st.f | 0, shape, origin, aim, n, phaseBoost;
    if (!spec) return true;
    if (!p.started) { p.started = 1; p.events = {}; p.shapes = {}; }
    origin = point(st);
    aim = Math.atan2(origin.ty - origin.y, origin.tx - origin.x);
    phaseBoost = st.phase === 3 ? 1.18 : st.phase === 2 ? 1.08 : 1;
    for (i = 0; i < spec.events.length; i++) {
      if (f !== spec.events[i] - TELEF && f !== spec.events[i]) continue;
      shape = p.shapes[i] || { kind: spec.shape, x: origin.x, y: origin.y, a: aim,
        r: spec.shape === 'ring' ? D(200 + i * 35, st) : 0,
        spread: spec.shape === 'fan' ? 0.8 : 0, len: spec.shape === 'line' ? D(2000, st) : 0,
        count: spec.count + (name === 'WispCircleCharges' && st.phase === 3 ? 2 : 0),
        gap: spec.gap || 0, phase: st.phase, telegraphFrames: TELEF };
      shape.lines = soulLines(shape, st);
      if (f === spec.events[i] - TELEF && !p.events[i]) {
        p.events[i] = 1;
        p.shapes[i] = shape;
        if (A && A.warn) A.warn(shape);
      } else if (f === spec.events[i] && p.events[i] === 1) {
        p.events[i] = 2;
        n = shape.count;
        if (A && A.hit) A.hit(shape, name, V(spec.speed * phaseBoost, st));
      }
    }
    return f >= spec.duration;
  }

  /* Infernum PolterghastBehaviorOverride.cs:815-936 (EctoplasmUppercutCharges). */
  ATK.EctoplasmUppercutCharges = function (st) { return attack(st, 'EctoplasmUppercutCharges'); };
  /* Infernum PolterghastBehaviorOverride.cs:523-610 (LegSwipes). */
  ATK.LegSwipes = function (st) { return attack(st, 'LegSwipes'); };
  /* Infernum PolterghastBehaviorOverride.cs:612-701 (WispCircleCharges). */
  ATK.WispCircleCharges = function (st) { return attack(st, 'WispCircleCharges'); };
  /* Infernum PolterghastBehaviorOverride.cs:703-813 (AsgoreRingSoulAttack). */
  ATK.AsgoreRingSoulAttack = function (st) { return attack(st, 'AsgoreRingSoulAttack'); };
  /* Infernum PolterghastBehaviorOverride.cs:938-992 (ArcingSouls). */
  ATK.ArcingSouls = function (st) { return attack(st, 'ArcingSouls'); };
  /* Infernum PolterghastBehaviorOverride.cs:1069-1161 (VortexCharge). */
  ATK.VortexCharge = function (st) { return attack(st, 'VortexCharge'); };
  /* Infernum PolterghastBehaviorOverride.cs:994-1067 (SpiritPetal). */
  ATK.SpiritPetal = function (st) { return attack(st, 'SpiritPetal'); };
  /* Infernum PolterghastBehaviorOverride.cs:1163-1283 (CloneSplit). */
  ATK.CloneSplit = function (st) { return attack(st, 'CloneSplit'); };
  /* Infernum PolterghastBehaviorOverride.cs:1285-1427 (DesperationAttack). */
  ATK.DesperationAttack = function (st) { return attack(st, 'DesperationAttack'); };

  function start(which, sig) {
    phase = clamp(which | 0, 1, 3); index = 0; signature = !!sig;
    current = { name: signature ? 'DesperationAttack' : CYCLES[phase][index], f: 0, p: {} };
  }
  function tickFrame(st) {
    var fin;
    if (!current && signature) return true;
    if (!current) start(phase, false);
    current.x = st.x; current.y = st.y; current.tx = st.tx; current.ty = st.ty;
    current.ax = st.ax; current.ay = st.ay; current.aw = st.aw; current.ah = st.ah; current.phase = phase;
    fin = ATK[current.name](current);
    current.f++;
    if (fin) {
      if (signature) { current = null; return true; }
      index = (index + 1) % CYCLES[phase].length;
      current = { name: CYCLES[phase][index], f: 0, p: {} };
    }
    return false;
  }
  NEU.poltAtk = {
    attach: function (adapter) { A = adapter; },
    start: start,
    step: tickFrame,
    phase: function (n) { phase = clamp(n | 0, 1, 3); index = 0; signature = false; current = { name: CYCLES[phase][0], f: 0, p: {} }; },
    signature: function () { start(phase, true); },
    reset: function () { current = null; index = 0; signature = false; },
    cycles: function () { return CYCLES; },
    records: ATK,
    D: D,
    V: V,
    bump: bump,
    current: function () { return current ? current.name : null; }
  };
})();
