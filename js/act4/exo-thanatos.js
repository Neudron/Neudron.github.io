/* exo-thanatos.js — Thanatos head cycle.
   Infernum ThanatosHeadBehaviorOverride.cs:41-49 (attack names).
   SelectNextAttack rolls a bag (cs:1074-1099). Phases 1-5 here are that
   bag as a fixed order. Phase >= 6 is the switch at cs:1108-1112. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var A = null, phase = 1, index = 0, current = null, open = false, tele = null, haz = null;
  var NORMAL = ['AggressiveCharge', 'ExoBomb', 'ExoLightBarrage', 'RefractionRotorRays'];
  var FINAL = ['AggressiveCharge', 'ExoLightBarrage', 'MaximumOverdrive'];
  /* 27 frames is 0.45s at 60Hz. The shape drawn on warn is the shape that hits. */
  var SPECS = {
    AggressiveCharge: { duration: 80, warn: 27, hit: 54, shape: 'line' },
    ExoBomb: { duration: 80, warn: 27, hit: 54, shape: 'ring' },
    ExoLightBarrage: { duration: 80, warn: 27, hit: 54, shape: 'fan' },
    RefractionRotorRays: { duration: 80, warn: 27, hit: 54, shape: 'line' },
    MaximumOverdrive: { duration: 120, warn: 27, hit: 54, shape: 'line' }
  };

  function cycle() { return phase >= 6 ? FINAL : NORMAL; }
  function shapeFor(st, spec) {
    return { kind: spec.shape, x: (st.ax + 8) | 0, y: (st.ay + 8) | 0, a: 0,
      len: (st.aw - 16) | 0, r: 36 };
  }
  function begin(name) {
    current = { name: name, f: 0, p: {} };
    open = false;
    tele = null;
    haz = null;
  }
  function attack(st, name) {
    var spec = SPECS[name], p, f, shape;
    if (!spec) return true;
    p = st.p || (st.p = {});
    f = st.f | 0;
    shape = shapeFor(st, spec);
    if (f === spec.warn && !p.warned) {
      p.warned = 1;
      tele = shape;
      haz = null;
      if (A && A.warn) A.warn(shape);
    }
    if (f === spec.hit && p.warned === 1) {
      p.warned = 2;
      tele = null;
      haz = shape;
      open = true;
      if (A && A.hit) A.hit(shape, name);
    }
    return f >= spec.duration;
  }
  /* Infernum ThanatosHeadBehaviorOverride.cs:465-478 (AggressiveCharge). */
  function AggressiveCharge(st) { return attack(st, 'AggressiveCharge'); }
  /* Infernum ThanatosHeadBehaviorOverride.cs:481-600 (ExoBomb). */
  function ExoBomb(st) { return attack(st, 'ExoBomb'); }
  /* Infernum ThanatosHeadBehaviorOverride.cs:742-868 (ExoLightBarrage). */
  function ExoLightBarrage(st) { return attack(st, 'ExoLightBarrage'); }
  /* Infernum ThanatosHeadBehaviorOverride.cs:604-740 (RefractionRotorRays). */
  function RefractionRotorRays(st) { return attack(st, 'RefractionRotorRays'); }
  /* Infernum ThanatosHeadBehaviorOverride.cs:871-937 (MaximumOverdrive). */
  function MaximumOverdrive(st) { return attack(st, 'MaximumOverdrive'); }
  var ATK = {
    AggressiveCharge: AggressiveCharge,
    ExoBomb: ExoBomb,
    ExoLightBarrage: ExoLightBarrage,
    RefractionRotorRays: RefractionRotorRays,
    MaximumOverdrive: MaximumOverdrive
  };

  function start(which) {
    phase = which >= 6 ? 6 : 1;
    index = 0;
    begin(cycle()[0]);
  }
  function tickFrame(st) {
    var fin, list;
    if (!current) start(phase);
    current.ax = st.ax; current.ay = st.ay; current.aw = st.aw; current.ah = st.ah;
    current.x = st.x; current.y = st.y; current.tx = st.tx; current.ty = st.ty;
    fin = ATK[current.name](current);
    current.f++;
    if (fin) {
      list = cycle();
      /* cs:1108-1112 — counter 0 charge, 1 barrage, everything after is the signature. */
      if (phase >= 6) index = index + 1 < list.length ? index + 1 : list.length - 1;
      else index = (index + 1) % list.length;
      begin(list[index]);
    }
    return false;
  }

  NEU.thanatosAtk = {
    attach: function (adapter) { A = adapter; },
    start: start,
    step: tickFrame,
    phase: function (n) { start(n >= 6 ? 6 : 1); },
    reset: function () { current = null; index = 0; phase = 1; open = false; tele = null; haz = null; },
    cycles: function () { return { normal: NORMAL, final: FINAL }; },
    current: function () { return current ? current.name : null; },
    vents: function () { return open; },
    telegraph: function () { return tele; },
    hazard: function () { return haz; },
    frame: function () { return current ? current.f : 0; }
  };
})();
