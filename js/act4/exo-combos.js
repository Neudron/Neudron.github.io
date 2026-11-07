/* exo-combos.js — the six Exo Mech combo attacks.
   Infernum ExoMechComboAttackContent.cs:16-25 (the enum).
   ShouldSelectComboAttack alternates one pair (cs:83-122).
   27 frames is 0.45s at 60Hz. The shape drawn on warn is the shape that hits.
   Source telegraphs are longer; the wait here is the house rule. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var A = null, pair = '', index = 0, current = null, tele = null, haz = null;
  var WARN = 27, HIT = 54, DUR = 80;
  /* ExoMechComboAttackContent.cs:83-122 — each pair flips between two attacks. */
  var CYCLES = {
    'thanatos+ares': ['ThanatosAres_LaserCircle', 'ThanatosAres_EnergySlashesAndCharges'],
    'ares+twins': ['AresTwins_DualLaserCharges', 'AresTwins_CircleAttack'],
    'thanatos+twins': ['TwinsThanatos_ThermoplasmaDashes', 'TwinsThanatos_AlternatingTwinsBursts']
  };
  var SPECS = {
    /* ThanatosAndAresComboAttacks.cs:89-97 — 8 lasers, telegraphTime 50. */
    ThanatosAres_LaserCircle: { shape: 'ring', n: 8, r: 48 },
    /* ThanatosAndAresComboAttacks.cs:228-231 — slashCount 4, anticipation 80. */
    ThanatosAres_EnergySlashesAndCharges: { shape: 'slash', n: 4, r: 8 },
    /* TwinsAndAresComboAttacks.cs:75-79 — two deathrays. AresBeamTelegraph.cs:24 Lifetime 40. */
    AresTwins_DualLaserCharges: { shape: 'beam', n: 2, r: 8 },
    /* TwinsAndAresComboAttacks.cs:509-512 — 11 shots after attackDelay 120. */
    AresTwins_CircleAttack: { shape: 'circle', n: 11, r: 56 },
    /* TwinsAndThanatosComboAttacks.cs:47-49 — fastFlyDelay 135, then the charge. */
    TwinsThanatos_ThermoplasmaDashes: { shape: 'dash', n: 1, r: 8 },
    /* TwinsAndThanatosComboAttacks.cs:140-149 — Artemis and Apollo take turns. */
    TwinsThanatos_AlternatingTwinsBursts: { shape: 'burst', n: 2, r: 36 }
  };

  function keyOf(a, b) {
    if ((a === 'thanatos' && b === 'ares') || (a === 'ares' && b === 'thanatos')) return 'thanatos+ares';
    if ((a === 'ares' && b === 'twins') || (a === 'twins' && b === 'ares')) return 'ares+twins';
    if ((a === 'thanatos' && b === 'twins') || (a === 'twins' && b === 'thanatos')) return 'thanatos+twins';
    return '';
  }
  function shapeFor(st, spec) {
    return { kind: spec.shape, x: (st.ax + 8) | 0, y: (st.ay + 8) | 0, a: 0,
      len: (st.aw - 16) | 0, r: spec.r, n: spec.n };
  }
  function begin(name) {
    current = { name: name, f: 0, p: {} };
    tele = null;
    haz = null;
  }
  function attack(st, name) {
    var spec = SPECS[name], p, f, shape;
    if (!spec) return true;
    p = st.p || (st.p = {});
    f = st.f | 0;
    shape = shapeFor(st, spec);
    if (f === WARN && !p.warned) {
      p.warned = 1;
      tele = shape;
      haz = null;
      if (A && A.warn) A.warn(shape);
    }
    if (f === HIT && p.warned === 1) {
      p.warned = 2;
      tele = null;
      haz = shape;
      if (A && A.hit) A.hit(shape, name);
    }
    return f >= DUR;
  }
  function ThanatosAres_LaserCircle(st) { return attack(st, 'ThanatosAres_LaserCircle'); }
  function ThanatosAres_EnergySlashesAndCharges(st) { return attack(st, 'ThanatosAres_EnergySlashesAndCharges'); }
  function AresTwins_DualLaserCharges(st) { return attack(st, 'AresTwins_DualLaserCharges'); }
  function AresTwins_CircleAttack(st) { return attack(st, 'AresTwins_CircleAttack'); }
  function TwinsThanatos_ThermoplasmaDashes(st) { return attack(st, 'TwinsThanatos_ThermoplasmaDashes'); }
  function TwinsThanatos_AlternatingTwinsBursts(st) { return attack(st, 'TwinsThanatos_AlternatingTwinsBursts'); }
  var ATK = {
    ThanatosAres_LaserCircle: ThanatosAres_LaserCircle,
    ThanatosAres_EnergySlashesAndCharges: ThanatosAres_EnergySlashesAndCharges,
    AresTwins_DualLaserCharges: AresTwins_DualLaserCharges,
    AresTwins_CircleAttack: AresTwins_CircleAttack,
    TwinsThanatos_ThermoplasmaDashes: TwinsThanatos_ThermoplasmaDashes,
    TwinsThanatos_AlternatingTwinsBursts: TwinsThanatos_AlternatingTwinsBursts
  };

  function setPair(a, b) {
    var key = keyOf(a, b), list;
    if (!key) return;
    if (key === pair && current) return;
    pair = key;
    index = 0;
    list = CYCLES[key];
    begin(list[0]);
    if (NEU.talk) NEU.talk(['* They move together.'], 'narr');
  }
  function tickFrame(st) {
    var list, fin;
    if (!pair) return false;
    if (!current) begin(CYCLES[pair][0]);
    current.ax = st.ax; current.ay = st.ay; current.aw = st.aw; current.ah = st.ah;
    current.x = st.x; current.y = st.y; current.tx = st.tx; current.ty = st.ty;
    fin = ATK[current.name](current);
    current.f++;
    if (fin) {
      list = CYCLES[pair];
      index = (index + 1) % list.length;
      begin(list[index]);
    }
    return false;
  }
  function paint(ctx, s, col) {
    var k, n, px, py;
    if (!s) return;
    n = s.n || 1;
    ctx.fillStyle = col;
    if (s.kind === 'ring' || s.kind === 'circle') {
      for (k = 0; k < n; k++) {
        px = s.x + Math.cos(k * Math.PI * 2 / n) * s.r;
        py = s.y + Math.sin(k * Math.PI * 2 / n) * s.r;
        ctx.fillRect(px | 0, py | 0, 8, 8);
      }
    } else if (s.kind === 'burst') {
      for (k = 0; k < n; k++) ctx.fillRect((s.x + k * 16) | 0, (s.y + k * 8) | 0, 12, 4);
    } else if (s.kind === 'slash') {
      ctx.fillRect(s.x | 0, s.y | 0, 8, 48);
    } else if (s.kind === 'beam' || s.kind === 'dash') {
      ctx.fillRect(s.x | 0, s.y | 0, s.len || 64, 4);
    } else {
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect((s.x | 0), (s.y | 0), 16, 16);
    }
  }

  NEU.exoCombos = {
    attach: function (adapter) { A = adapter; },
    pair: setPair,
    pairOf: function () { return pair; },
    clear: function () { pair = ''; index = 0; current = null; tele = null; haz = null; },
    step: tickFrame,
    current: function () { return current ? current.name : null; },
    telegraph: function () { return tele; },
    hazard: function () { return haz; },
    draw: function (ctx) {
      if (!ctx || !ctx.fillRect) return;
      paint(ctx, tele, '#FFD2A0');
      paint(ctx, haz, '#C83CFF');
    }
  };
})();
