/* exo-ares.js — Ares body cycle and the four cannons.
   Infernum AresBodyBehaviorOverride.cs:46-58 (attack names).
   SelectNextAttack is a no-repeat bag (cs:1263-1299). Phases 1-4 here
   are that bag as a fixed order. Phase >= 6 is PrecisionBlasts (cs:1298-1299).
   Life under 7.5% after the complement is out forces it (cs:412-415).
   CheckDead allows the kill only during PrecisionBlasts (cs:1811-1816).
   Cannons: laser, tesla, plasma, gauss. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var A = null, phase = 1, index = 0, current = null, open = false, tele = null, haz = null;
  var pendingFinal = false;
  var NORMAL = ['LaserSpinBursts', 'EnergyBladeSlices', 'DirectionChangingSpinBursts', 'DownwardCrossSlices'];
  var FINAL = ['LaserSpinBursts', 'ThreeDimensionalSuperslashes', 'PrecisionBlasts'];
  /* 27 frames is 0.45s at 60Hz. The shape drawn on warn is the shape that hits.
     Source spin telegraphTime is 60 (cs:641); the wait here is the house rule. */
  var SPECS = {
    LaserSpinBursts: { duration: 80, warn: 27, hit: 54, shape: 'spin', n: 11, r: 48 },
    DirectionChangingSpinBursts: { duration: 80, warn: 27, hit: 54, shape: 'turn', n: 11, r: 48 },
    EnergyBladeSlices: { duration: 80, warn: 27, hit: 54, shape: 'slash', n: 1, r: 8 },
    DownwardCrossSlices: { duration: 80, warn: 27, hit: 54, shape: 'cross', n: 2, r: 28 },
    ThreeDimensionalSuperslashes: { duration: 80, warn: 27, hit: 54, shape: 'super', n: 3, r: 36 },
    PrecisionBlasts: { duration: 120, warn: 27, hit: 54, shape: 'blast', n: 6, r: 64 }
  };
  var CANNON = ['laser', 'tesla', 'plasma', 'gauss'];
  var COL = { laser: '#E04A3A', tesla: '#3BE2C8', plasma: '#7C5CFF', gauss: '#E6C15A' };
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var live = false, won = false, sig = false, finalOn = false, aresHp = 1000, lastFrame = -1, musicSent = false;

  function cycle() { return phase >= 6 ? FINAL : NORMAL; }
  function shapeFor(st, spec) {
    return { kind: spec.shape, x: (st.ax + 8) | 0, y: (st.ay + 8) | 0, a: 0,
      len: (st.aw - 16) | 0, r: spec.r, n: spec.n };
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
  /* Infernum AresBodyBehaviorOverride.cs:638-801 (LaserSpinBursts, 11 rays). */
  function LaserSpinBursts(st) { return attack(st, 'LaserSpinBursts'); }
  /* Infernum AresBodyBehaviorOverride.cs:742-752 (DirectionChangingSpinBursts). */
  function DirectionChangingSpinBursts(st) { return attack(st, 'DirectionChangingSpinBursts'); }
  /* Infernum AresBodyBehaviorOverride.cs:804-833 (EnergyBladeSlices). */
  function EnergyBladeSlices(st) { return attack(st, 'EnergyBladeSlices'); }
  /* Infernum AresBodyBehaviorOverride.cs:836-880 (DownwardCrossSlices). */
  function DownwardCrossSlices(st) { return attack(st, 'DownwardCrossSlices'); }
  /* Infernum AresBodyBehaviorOverride.cs:883-962 (ThreeDimensionalSuperslashes). */
  function ThreeDimensionalSuperslashes(st) { return attack(st, 'ThreeDimensionalSuperslashes'); }
  /* Infernum AresBodyBehaviorOverride.cs:965-1148 (PrecisionBlasts). */
  function PrecisionBlasts(st) { return attack(st, 'PrecisionBlasts'); }
  var ATK = {
    LaserSpinBursts: LaserSpinBursts,
    DirectionChangingSpinBursts: DirectionChangingSpinBursts,
    EnergyBladeSlices: EnergyBladeSlices,
    DownwardCrossSlices: DownwardCrossSlices,
    ThreeDimensionalSuperslashes: ThreeDimensionalSuperslashes,
    PrecisionBlasts: PrecisionBlasts
  };

  function start(which) {
    phase = which >= 6 ? 6 : 1;
    index = 0;
    pendingFinal = false;
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
      if (pendingFinal) {
        phase = 6;
        pendingFinal = false;
        index = 0;
        begin(cycle()[0]);
      } else {
        list = cycle();
        /* cs:1298-1299 — the final phase stays on PrecisionBlasts. */
        if (phase >= 6) index = index + 1 < list.length ? index + 1 : list.length - 1;
        else index = (index + 1) % list.length;
        begin(list[index]);
      }
    }
    return false;
  }

  NEU.aresAtk = {
    attach: function (adapter) { A = adapter; },
    start: start,
    step: tickFrame,
    phase: function (n) { start(n >= 6 ? 6 : 1); },
    seal: function () { pendingFinal = true; },
    reset: function () { current = null; index = 0; phase = 1; open = false; tele = null; haz = null; pendingFinal = false; },
    cycles: function () { return { normal: NORMAL, final: FINAL }; },
    current: function () { return current ? current.name : null; },
    core: function () { return open; },
    tier: function () { return phase; },
    telegraph: function () { return tele; },
    hazard: function () { return haz; },
    frame: function () { return current ? current.f : 0; }
  };

  function arena() {
    var w = window.innerWidth || 800, h = window.innerHeight || 600, ar;
    if (NEU.danmaku && NEU.danmaku.arena) ar = NEU.danmaku.arena(w, h, 760, 500, 20);
    if (!ar) ar = { AX: 20, AY: 40, AW: 760, AH: 480 };
    return ar;
  }
  function armsAt(frame) {
    var ar = arena(), cx = ar.AX + 96, cy = ar.AY + 88;
    var bob = REDUCE ? 0 : ((frame % 8) * 2);
    return [
      { id: CANNON[0], x: cx - 28, y: cy - 20 + bob },
      { id: CANNON[1], x: cx + 20, y: cy - 20 + bob },
      { id: CANNON[2], x: cx - 28, y: cy + 16 },
      { id: CANNON[3], x: cx + 20, y: cy + 16 }
    ];
  }
  function label(word) {
    var el = document.getElementById('exoVuln');
    var hud = document.getElementById('exoHud');
    var st = NEU.exo && NEU.exo.state;
    if (el) el.textContent = word;
    if (hud && st) hud.textContent = 'HP ' + aresHp + '  P' + st.phase;
  }
  function draw(st) {
    var cv = document.getElementById('exoCanvas');
    var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    var list, i, arm, col, ar, cx, cy;
    if (!ctx || !ctx.fillRect) return;
    ctx.imageSmoothingEnabled = false;
    ar = arena();
    cx = (ar.AX + 96) | 0;
    cy = (ar.AY + 88) | 0;
    ctx.fillStyle = '#5C656E';
    ctx.fillRect(cx - 10, cy - 16, 20, 32);
    ctx.fillStyle = '#8A939C';
    ctx.fillRect(cx - 6, cy - 10, 12, 20);
    ctx.fillStyle = open ? '#FFC46A' : '#C5D0D8';
    ctx.fillRect(cx - 4, cy - 2, 8, 4);
    list = st.arms || [];
    for (i = 0; i < list.length; i++) {
      arm = list[i];
      col = COL[arm.id] || '#FF00FF';
      ctx.fillStyle = col;
      ctx.fillRect(arm.x | 0, arm.y | 0, 8, 12);
      ctx.fillRect((arm.x + 2) | 0, (arm.y + 12) | 0, 4, 8);
    }
  }
  function publish() {
    var st = NEU.exo.state, word;
    st.hp = aresHp;
    st.max = 1000;
    st.ratio = aresHp / 1000;
    st.attack = NEU.aresAtk.current();
    st.telegraph = tele;
    st.hazard = haz;
    st.vents = open;
    st.vulnerable = !!open && st.mode === 'fight';
    st.overdrive = sig;
    st.arms = armsAt(st.frame || 0);
    if (finalOn) st.phase = 6;
    word = st.mode === 'fight' && open ? 'VULNERABLE' : (st.mode === 'fight' || st.mode === 'won' ? 'INVULNERABLE' : '');
    label(word);
    draw(st);
  }
  function lockWin() {
    var st = NEU.exo.state;
    won = true;
    aresHp = 0;
    open = false;
    st.mode = 'won';
    st.hp = 0;
    st.ratio = 0;
    st.max = 1000;
    st.attack = 'PrecisionBlasts';
    st.vulnerable = false;
    st.vents = false;
    st.overdrive = true;
    if (NEU.save) NEU.save.flag('exo_won', 1);
    label('INVULNERABLE');
    /* Mechs are dead. Draedon stays. */
    if (NEU.draedon && NEU.draedon.open) NEU.draedon.open();
  }
  function resetLocal() {
    aresHp = 1000;
    won = false;
    sig = false;
    finalOn = false;
    musicSent = false;
    pendingFinal = false;
    live = true;
    lastFrame = 0;
    NEU.aresAtk.phase(1);
  }
  function noteFinal() {
    var wrap;
    if (NEU.aresAtk.tier() < 6 || musicSent) return;
    finalOn = true;
    musicSent = true;
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('exo', 6);
    wrap = document.getElementById('exo');
    if (wrap) wrap.style.background = '#300818';
  }
  function onFightFrame() {
    var st = NEU.exo.state, ar;
    if (!st || st.primary !== 'ares') return;
    if (won) { lockWin(); return; }
    if (st.mode !== 'fight') return;
    if (!live) resetLocal();
    if (st.frame === 0) {
      if (lastFrame !== 0) resetLocal();
      lastFrame = 0;
      publish();
      return;
    }
    if (st.frame === lastFrame) return;
    lastFrame = st.frame;
    ar = arena();
    NEU.aresAtk.step({
      x: ar.AX + 96, y: ar.AY + 88, tx: ar.AX + ar.AW / 2, ty: ar.AY + ar.AH / 2,
      ax: ar.AX, ay: ar.AY, aw: ar.AW, ah: ar.AH, phase: phase
    });
    if (NEU.aresAtk.current() === 'PrecisionBlasts' && NEU.aresAtk.core()) sig = true;
    noteFinal();
    publish();
  }
  function ensure() {
    var st = NEU.exo && NEU.exo.state;
    if (!st || st.primary !== 'ares' || st.mode !== 'fight' || won) return;
    if (!live) resetLocal();
    publish();
  }

  if (NEU.exo && NEU.exo.step) {
    var origStep = NEU.exo.step;
    var origDamage = NEU.exo.damage;
    var origPick = NEU.exo.pick;
    var origHurt = NEU.exo.hurtPlayer;
    NEU.exo.step = function (dt) { origStep(dt); onFightFrame(); };
    NEU.exo.pick = function (id) { origPick(id); ensure(); };
    NEU.exo.hurtPlayer = function (n) {
      origHurt(n);
      var st = NEU.exo.state;
      if (st.primary === 'ares' && st.frame === 0 && st.playerHp === 6) {
        resetLocal();
        publish();
      }
    };
    NEU.exo.damage = function (id, n) {
      var st = NEU.exo.state, room, ok;
      if (id === 'ares' && st.primary === 'ares') {
        if (won || st.mode !== 'fight') return false;
        if (!open) return false;
        if (!sig) {
          room = aresHp - 1;
          if (room <= 0) return false;
          if (n > room) n = room;
        }
        ok = origDamage(id, n);
        if (ok) {
          aresHp -= n;
          if (aresHp <= 75 && st.phase >= 4) NEU.aresAtk.seal();
          if (aresHp <= 0) lockWin();
        }
        publish();
        return ok;
      }
      return origDamage(id, n);
    };
    if (NEU.kernel && NEU.kernel.scenes && NEU.kernel.scenes.exo) {
      var prev = NEU.kernel.scenes.exo;
      NEU.kernel.register('exo', {
        tick: function (dt) { prev.tick(dt); onFightFrame(); },
        open: prev.open,
        close: prev.close,
        running: prev.running
      });
    }
    addEventListener('keydown', function () { ensure(); });
  }

  NEU.aresAtk.attach({
    warn: function () {},
    hit: function () { if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small'); }
  });
})();
