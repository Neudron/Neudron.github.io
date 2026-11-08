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
  var src = { x: 0, y: 0 }, mate = { x: 0, y: 0 }, aim = 0, tf = 0, live = false;
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
    if (NEU.exoCaption) NEU.exoCaption('* They move together.');
  }
  function tickFrame(st) {
    var list, fin;
    if (!pair) return false;
    src.x = st.x; src.y = st.y;
    mate.x = st.px === undefined ? st.x : st.px; mate.y = st.py === undefined ? st.y : st.py;
    aim = Math.atan2(st.ty - st.y, st.tx - st.x);
    live = true;
    tf++;
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
  /* art: the shared telegraph and hazard painters in look-exo.js. */
  function artKind(s) {
    var k = s.kind === 'circle' ? 'ring' : s.kind === 'burst' ? 'fan' : s.kind;
    return { kind: k, x: s.x, y: s.y, len: s.len, r: s.r, n: s.n };
  }
  /* a dashed teal tether between the two partners: 6 on, 4 off, 30 px/s */
  function tether(ctx) {
    var dx = mate.x - src.x, dy = mate.y - src.y, L = Math.sqrt(dx * dx + dy * dy), k, off, d;
    if (L < 8) return;
    off = REDUCE ? 0 : (tf * 0.5) % 10;
    ctx.fillStyle = '#3BE2C8';
    for (k = 0; k < L; k += 2) {
      d = (k + off) % 10;
      if (d < 6) ctx.fillRect((src.x + dx * k / L) | 0, (src.y + dy * k / L) | 0, 2, 2);
    }
  }
  function paintShape(ctx, s, f, haz) {
    var A = NEU.exoArt, k;
    if (!A || !s) return;
    k = artKind(s);
    if (haz) A.hazard(ctx, k, f - HIT, null, src, aim);
    else A.tele(ctx, k, f - WARN, { warn: WARN }, null, src, aim);
  }

  NEU.exoCombos = {
    attach: function (adapter) { A = adapter; },
    pair: setPair,
    pairOf: function () { return pair; },
    clear: function () { pair = ''; index = 0; current = null; tele = null; haz = null; live = false; },
    step: tickFrame,
    current: function () { return current ? current.name : null; },
    telegraph: function () { return tele; },
    hazard: function () { return haz; },
    draw: function (ctx) {
      if (!ctx || !ctx.fillRect) return;
      if (pair && live) tether(ctx);
      paintShape(ctx, tele, current ? current.f : 0, false);
      paintShape(ctx, haz, current ? current.f : 0, true);
    }
  };
})();
