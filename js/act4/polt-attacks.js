/* polt-attacks.js — Polterghast named-attack authority (VISUAL_IMPROVEMENT_RESEARCH
   VIP-05). One attack record per verb, fixed per-phase cycles, one telegraph
   lead, and boss movement driven through the adapter. ES5, no per-frame
   allocation. This file is the only cadence: boss-polt.js has no bullet
   source of its own, and every shot still goes through its shot() cap. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  function dp(k) { return NEU.boss && NEU.boss.mul ? NEU.boss.mul(k) : 1; }
  var ATK = {};
  var A = null, phase = 1, index = 0, current = null, signature = false, pending = 0;
  var TAU = Math.PI * 2;
  /* VIP-05 budget. All one source of truth; boss-polt.js owns the bullet
     array and enforces maxBullets/maxAge on every shot(). */
  var TIMING = { tele: [24, 30], gap: 72, gapBig: 210 }, GAP = TIMING.gap, GAP_BIG = TIMING.gapBig;
  var CAP = { maxBullets: 220, looks: 6, gapPx: 56, contrast: 3, maxAge: 6,
              tele: TIMING.tele, gap: GAP, gapBig: GAP_BIG };
  var TELE_MIN = CAP.tele[0], TELE_MAX = CAP.tele[1];

  function D(d, st) { return d * st.aw / 2000; }
  function V(v, st) { return v * 60 * st.aw / 2000; }
  function bump(t, a, b, peak, c) {
    if (t < a || t > c) return 0;
    if (t < b) return (t - a) / (b - a);
    if (t < peak) return 1;
    return (c - t) / (c - peak);
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function tele(n) { return clamp(n | 0, TELE_MIN, TELE_MAX); }
  /* A ring's safe lane is an angular gap of `gap` darts at `gapR` px; the
     arc width must clear the 56px dodge floor. */
  function gapWidth(s) {
    return s.gap ? TAU * (s.gapR || 200) * s.gap / s.count : 0;
  }

  /* Fixed cycles: every verb appears; no verb is adjacent to itself even at
     the wrap. DesperationAttack is the signature, never a cycle lead. */
  var CYCLES = [null,
    ['EctoplasmUppercutCharges', 'LegSwipes', 'WispCircleCharges', 'SpiritPetal', 'ArcingSouls'],
    ['AsgoreRingSoulAttack', 'HookCrossfire', 'ArcingSouls', 'VortexCharge',
     'SpiritPetal', 'LegSwipes', 'WispCircleCharges', 'EctoplasmUppercutCharges'],
    ['CloneSplit', 'PhantomOrbit', 'AsgoreRingSoulAttack', 'VortexCharge',
     'HookCrossfire', 'ArcingSouls', 'SpiritPetal', 'EctoplasmUppercutCharges',
     'LegSwipes', 'WispCircleCharges']];

  /* duration: frames to the next lead. events: volley frames (hit frame).
     tele: 24-30f lead issued at events[i]-tele. speed may be an array for a
     per-volley ramp. look: 0-5 visual variant, bounded by CAP.looks. */
  var SPECS = {
    EctoplasmUppercutCharges: { kick: 'small', origin: 'body', counter: 'dash through the line, then slip behind', duration: 204, events: [54, 102, 150], shape: 'line', count: 6, speed: [23, 27, 31], tele: 24, look: 0 },
    LegSwipes: { kick: 'small', origin: 'player', counter: 'fan aims at you, step out of the middle', duration: 224, events: [54, 112, 170], shape: 'fan', count: 5, spread: 1.22, speed: 18, tele: 24, look: 1 },
    WispCircleCharges: { kick: 'small', origin: 'body', counter: 'ring spreads from the centre, stay between darts', duration: 252, events: [54, 108, 162, 216], shape: 'ring', count: 8, speed: 15, tele: 24, look: 2 },
    SpiritPetal: { kick: 'small', origin: 'body', counter: 'each petal speeds up, move before the next', duration: 240, events: [54, 84, 114, 144, 174, 204], shape: 'fan', count: 6, spread: 0.9, speed: [7, 9, 11, 13, 15, 18], tele: 26, look: 3 },
    AsgoreRingSoulAttack: { kick: 'medium', origin: 'body', counter: 'step into the gap, the lane tracks you', duration: 480, events: [54, 121, 188, 255, 322, 389, 456], shape: 'ring', count: 24, gap: 4, gapR: 200, speed: [14, 16, 18, 20, 22, 24, 26], tele: 28, look: 4 },
    ArcingSouls: { kick: 'small', origin: 'body', counter: 'fans sweep wide, drift to the edge of the fan', duration: 252, events: [54, 110, 166, 222], shape: 'fan', count: 5, spread: 1.1, speed: 19, tele: 24, look: 0 },
    VortexCharge: { kick: 'medium', origin: 'body', counter: 'two dashes, leave the lane after the first', duration: 240, events: [54, 108, 162], shape: 'line', count: 7, speed: 27, tele: 24, look: 5 },
    HookCrossfire: { kick: 'small', origin: 'body', counter: 'hook shots cross the arena, hold the centre', duration: 260, events: [54, 84, 114, 144], shape: 'line', count: 4, speed: 20, tele: 24, look: 1 },
    CloneSplit: { kick: 'medium', origin: 'clone', counter: 'a clone fires too, keep both rings in view', duration: 264, events: [54, 114, 174, 234], shape: 'ring', count: 12, speed: 20, tele: 26, look: 4 },
    PhantomOrbit: { kick: 'small', origin: 'orbit', counter: 'he hides, three darts orbit, wait it out', duration: 260, events: [54, 110, 166, 222], shape: 'ring', count: 3, gapR: 120, speed: 12, tele: 30, look: 2 },
    DesperationAttack: { kick: 'medium', origin: 'body', counter: 'gap faces you every ring, keep slipping through', duration: 360, events: [42, 84, 126, 168, 210, 252, 294, 336], shape: 'ring', count: 16, gap: 3, gapR: 200, speed: 18, tele: 28, look: 5 }
  };

  /* Boss movement per verb: each op fires once at its frame via the adapter.
     `player` targets resolve against the live player position at that frame. */
  var MOVES = {
    EctoplasmUppercutCharges: [{ f: 54, op: 'charge' }, { f: 102, op: 'charge' }, { f: 150, op: 'charge' }],
    LegSwipes: [{ f: 54, op: 'moveTo', x: 'player', y: 'player' }],
    WispCircleCharges: [{ f: 54, op: 'moveTo', x: 'center', y: 'center' }],
    SpiritPetal: [{ f: 54, op: 'moveTo', x: 'player', y: 'top' }],
    AsgoreRingSoulAttack: [{ f: 54, op: 'moveTo', x: 'center', y: 'center' }],
    ArcingSouls: [{ f: 54, op: 'moveTo', x: 'center', y: 'top' }],
    HookCrossfire: [{ f: 54, op: 'moveTo', x: 'center', y: 'top' }],
    DesperationAttack: [{ f: 0, op: 'moveTo', x: 'center', y: 'center' }],
    VortexCharge: [{ f: 54, op: 'charge' }, { f: 162, op: 'charge' }],
    CloneSplit: [{ f: 54, op: 'splitClones' }],
    PhantomOrbit: [{ f: 54, op: 'hide' }, { f: 222, op: 'show' }]
  };

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
  /* movement target: 'player' | 'center' | 'top' resolve live; else hold. */
  function pos(v, st, axis) {
    if (v === 'player') return axis ? st.ty : st.tx;
    if (v === 'center') return axis ? st.ay + st.ah / 2 : st.ax + st.aw / 2;
    if (v === 'top') return st.ay + 60;
    return axis ? st.y : st.x;
  }
  function drive(name, f, p, st) {
    var mv = MOVES[name], k, m;
    if (!mv || !A) return;
    for (k = 0; k < mv.length; k++) {
      m = mv[k];
      if (f !== m.f || p.moved[k]) continue;
      p.moved[k] = 1;
      if (m.op === 'moveTo' && A.moveTo) A.moveTo(pos(m.x, st, 0), pos(m.y, st, 1));
      else if (m.op === 'charge' && A.charge) A.charge();
      else if (m.op === 'hide' && A.hide) A.hide();
      else if (m.op === 'show' && A.show) A.show();
      else if (m.op === 'splitClones' && A.splitClones) A.splitClones();
    }
  }
  function attack(st, name) {
    var spec = SPECS[name], p = st.p || (st.p = {}), i, f = st.f | 0, shape, origin, aim,
        n, phaseBoost, sp, lead;
    if (!spec) return true;
    lead = tele(spec.tele);
    if (!p.started) { p.started = 1; p.events = {}; p.shapes = {}; p.moved = {}; }
    origin = point(st);
    aim = Math.atan2(origin.ty - origin.y, origin.tx - origin.x);
    phaseBoost = st.phase === 3 ? 1.18 : st.phase === 2 ? 1.08 : 1;
    drive(name, f, p, st);
    for (i = 0; i < spec.events.length; i++) {
      if (f !== spec.events[i] - lead && f !== spec.events[i]) continue;
      n = spec.count;
      if (name === 'LegSwipes' && st.phase > 1) n = 7;
      else if (name === 'WispCircleCharges' && st.phase === 3) n = 10;
      else if (name === 'ArcingSouls' && st.phase === 3) n = 9;
      /* a safe lane faces the bearing the warn was issued at */
      shape = p.shapes[i] || { kind: spec.shape, x: origin.x, y: origin.y,
        a: spec.gap ? aim - (((n / 2) | 0) + (spec.gap - 1) / 2) * TAU / n : aim,
        r: spec.shape === 'ring' ? D(spec.gapR || 200 + i * 35, st) : 0,
        spread: spec.shape === 'fan' ? spec.spread || 0.8 : 0,
        len: spec.shape === 'line' ? D(2000, st) : 0,
        count: n, gap: spec.gap || 0, phase: st.phase, telegraphFrames: lead };
      shape.count = n;
      shape.lines = soulLines(shape, st);
      if (f === spec.events[i] - lead && !p.events[i]) {
        p.events[i] = 1;
        p.shapes[i] = shape;
        if (A && A.warn) A.warn(shape);
      } else if (f === spec.events[i] && p.events[i] === 1) {
        p.events[i] = 2;
        sp = spec.speed;
        if (sp && typeof sp === 'object' && sp.length) sp = sp[Math.min(i, sp.length - 1)];
        if (A && A.hit) A.hit(shape, name, V(sp * phaseBoost * dp('bulletSpeed'), st));
      }
    }
    return f >= spec.duration;
  }

  /* Infernum PolterghastBehaviorOverride.cs anchors, one named record each. */
  ATK.EctoplasmUppercutCharges = function (st) { return attack(st, 'EctoplasmUppercutCharges'); };
  ATK.LegSwipes = function (st) { return attack(st, 'LegSwipes'); };
  ATK.WispCircleCharges = function (st) { return attack(st, 'WispCircleCharges'); };
  ATK.SpiritPetal = function (st) { return attack(st, 'SpiritPetal'); };
  ATK.AsgoreRingSoulAttack = function (st) { return attack(st, 'AsgoreRingSoulAttack'); };
  ATK.ArcingSouls = function (st) { return attack(st, 'ArcingSouls'); };
  ATK.VortexCharge = function (st) { return attack(st, 'VortexCharge'); };
  ATK.HookCrossfire = function (st) { return attack(st, 'HookCrossfire'); };
  ATK.CloneSplit = function (st) { return attack(st, 'CloneSplit'); };
  ATK.PhantomOrbit = function (st) { return attack(st, 'PhantomOrbit'); };
  ATK.DesperationAttack = function (st) { return attack(st, 'DesperationAttack'); };

  /* ── VIP-04 PhaseTransition ──────────────────────────────────────
     The two dart rings that play under the blackout. One authority, driven
     by the boss's transition frame so the visuals and the hitboxes share a
     clock. Both rings keep a 24f telegraph even under reduced motion. */
  var TR = { close: 36, kick: 90, dimDone: 90, sigFrames: 360,
             ring1: { count: 16, gap: 3 }, ring2: { count: 20, gap: 0 } };
  var trans = null;
  function transStart(to) { trans = { to: clamp(to | 0, 1, 3), f: 0, sent: 0 }; }
  function transRing(st, cfg, a, name, speed, doHit) {
    var shape = { kind: 'ring', x: st.x, y: st.y, a: a,
      r: D(160, st), spread: 0, len: 0, count: cfg.count, gap: cfg.gap,
      phase: trans.to, telegraphFrames: TELE_MIN };
    if (!doHit && A && A.warn) A.warn(shape);
    else if (A && A.hit) A.hit(shape, name, speed);
  }
  function transStep(f, st) {
    if (!trans) return;
    var aim = Math.atan2(st.ty - st.y, st.tx - st.x), sp = V(14 * dp('bulletSpeed'), st);
    /* ring 1: 16 darts, a 3-dart gap centred on the player's bearing */
    if (f === 0) transRing(st, TR.ring1, aim - 9.5 * TAU / 16, 'PhaseTransition', sp, false);
    if (f === 24) transRing(st, TR.ring1, aim - 9.5 * TAU / 16, 'PhaseTransition', sp, true);
    /* ring 2: 20 darts, half a step rotated off ring 1 */
    if (f === 24) transRing(st, TR.ring2, aim + TAU / 40, 'PhaseTransition', sp, false);
    if (f === 48) transRing(st, TR.ring2, aim + TAU / 40, 'PhaseTransition', sp, true);
    trans.f = f; trans.sent = f >= 48 ? 2 : f >= 24 ? 1 : 0;
    if (f >= TR.kick) trans = null;
  }
  function transStats() {
    return { close: TR.close, kick: TR.kick, dimDone: TR.dimDone,
             sigFrames: TR.sigFrames,
             ring1: { count: TR.ring1.count, gap: TR.ring1.gap },
             ring2: { count: TR.ring2.count, gap: TR.ring2.gap },
             active: trans ? trans.f : -1 };
  }

  function start(which, sig) {
    phase = clamp(which | 0, 1, 3); index = 0; signature = !!sig; pending = 0;
    current = { name: signature ? 'DesperationAttack' : CYCLES[phase][index], f: 0, p: {} };
  }
  function setPhase(n) {
    phase = clamp(n | 0, 1, 3); index = 0; signature = false;
    current = { name: CYCLES[phase][0], f: 0, p: {} };
  }
  /* One record per verb: the data a reader (or a test) needs without
     running it. states are frame boundaries into the attack. */
  function defs() {
    var out = [], k, s, lead, e0, last;
    for (k in SPECS) if (SPECS.hasOwnProperty(k)) {
      s = SPECS[k]; lead = tele(s.tele); e0 = s.events[0]; last = s.events[s.events.length - 1];
      out.push({ name: k, owner: 'polt', origin: s.origin, hitbox: 4, duration: s.duration,
        events: s.events.slice(), lead: lead, kick: s.kick, counter: s.counter,
        shape: s.shape, count: s.count, gap: s.gap || 0, speed: s.speed,
        moves: (MOVES[k] || []).slice(),
        states: { idle: 0, notice: e0 - lead - 12, anticipation: e0 - lead, active: e0,
                  recovery: last + 12, end: s.duration },
        reduced: 'static warn, no afterimage', test: 'fixes9931' });
    }
    return out;
  }
  function stateAt(name, f) {
    var s = SPECS[name], lead, e0, last;
    if (!s || f < 0 || f >= s.duration) return 'idle';
    lead = tele(s.tele); e0 = s.events[0]; last = s.events[s.events.length - 1];
    if (f >= last + 12) return 'recovery';
    if (f >= e0) return 'active';
    if (f >= e0 - lead) return 'anticipation';
    return f >= e0 - lead - 12 ? 'notice' : 'idle';
  }
  function tickFrame(st) {
    var fin, cyc;
    if (!current && signature) return true;
    if (!current) start(phase, false);
    current.x = st.x; current.y = st.y; current.tx = st.tx; current.ty = st.ty;
    current.ax = st.ax; current.ay = st.ay; current.aw = st.aw; current.ah = st.ah; current.phase = phase;
    fin = ATK[current.name](current);
    current.f++;
    if (fin) {
      if (signature) { current = null; return true; }
      if (pending) { setPhase(pending); pending = 0; return false; }
      cyc = CYCLES[phase]; index = (index + 1) % cyc.length;
      current = { name: cyc[index], f: 0, p: {} };
    }
    return false;
  }
  NEU.poltAtk = {
    attach: function (adapter) { A = adapter; },
    start: start,
    step: tickFrame,
    /* deferred: the running volley finishes, then the new cycle leads.
       `now` cuts immediately. */
    phase: function (n, now) {
      if (now || !current) setPhase(n); else pending = clamp(n | 0, 1, 3);
    },
    timing: function () { return TIMING; },
    defs: defs,
    stateAt: stateAt,
    signature: function () { start(phase, true); },
    reset: function () { current = null; index = 0; signature = false; trans = null; pending = 0; },
    cycles: function () { return CYCLES; },
    /* Lead of every attack, in 60 Hz frames. The warn issues at
       events[i]-lead and the hit at events[i]. */
    leads: function () {
      var out = [], k, s;
      for (k in SPECS) if (SPECS.hasOwnProperty(k)) {
        s = SPECS[k];
        out.push({ name: k, frames: tele(s.tele), events: s.events.slice(),
                   look: s.look, gapPx: Math.round(gapWidth(s)) });
      }
      return out;
    },
    caps: function () { return CAP; },
    /* VIP-04: the transition ring authority, stepped by boss-polt's clock. */
    transition: { start: transStart, step: transStep, stats: transStats },
    records: ATK,
    D: D,
    V: V,
    bump: bump,
    current: function () { return current ? current.name : null; }
  };
})();
