/* exo-twins.js — Artemis (red laser) and Apollo (green plasma).
   Infernum ApolloBehaviorOverride.cs:42-52 (TwinsAttackType).
   SelectNextAttack rolls a special after BasicShots (cs:1834-1846).
   Phases 1-5 here are that bag as a fixed order.
   Phase >= 6 replaces the special with ThermonuclearBlitz (cs:1855-1857).
   Life under 7.5% in the final phase forces it (cs:300-303).
   CheckDead allows the kill only during ThermonuclearBlitz (cs:2194-2198). */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var A = null, phase = 1, index = 0, current = null, open = false, tele = null, haz = null;
  var pendingFinal = false;
  var NORMAL = ['BasicShots', 'FireCharge', 'ApolloPlasmaCharges', 'ArtemisLaserRay', 'GatlingLaserAndPlasmaFlames', 'SlowLaserRayAndPlasmaBlasts'];
  var FINAL = ['BasicShots', 'ThermonuclearBlitz'];
  /* 27 frames is 0.45s at 60Hz. The shape drawn on warn is the shape that hits.
     Source BasicShots telegraphTime is 96 (cs:550); the wait here is the house rule. */
  var SPECS = {
    BasicShots: { duration: 80, warn: 27, hit: 54, shape: 'fan', n: 8, r: 36 },
    FireCharge: { duration: 80, warn: 27, hit: 54, shape: 'line', n: 9, r: 8 },
    ApolloPlasmaCharges: { duration: 80, warn: 27, hit: 54, shape: 'ring', n: 5, r: 40 },
    ArtemisLaserRay: { duration: 80, warn: 27, hit: 54, shape: 'ray', n: 1, r: 64 },
    GatlingLaserAndPlasmaFlames: { duration: 80, warn: 27, hit: 54, shape: 'gatling', n: 3, r: 24 },
    SlowLaserRayAndPlasmaBlasts: { duration: 80, warn: 27, hit: 54, shape: 'sweep', n: 5, r: 48 },
    ThermonuclearBlitz: { duration: 120, warn: 27, hit: 54, shape: 'blitz', n: 1, r: 64 }
  };
  var COL = { artemis: '#E23B3B', apollo: '#3BE26A', white: '#F4F4F4' };
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var live = false, won = false, sig = false, finalOn = false, twinsHp = 1000, lastFrame = -1, musicSent = false;

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
  /* Infernum ApolloBehaviorOverride.cs:546-557 (BasicShots, 8 lasers per burst). */
  function BasicShots(st) { return attack(st, 'BasicShots'); }
  /* Infernum ApolloBehaviorOverride.cs:765-770 (FireCharge, 9 laser bursts). */
  function FireCharge(st) { return attack(st, 'FireCharge'); }
  /* Infernum ApolloBehaviorOverride.cs:951-964 (ApolloPlasmaCharges, 5 charges). */
  function ApolloPlasmaCharges(st) { return attack(st, 'ApolloPlasmaCharges'); }
  /* Infernum ApolloBehaviorOverride.cs:1096-1110 (ArtemisLaserRay, spin radius 640). */
  function ArtemisLaserRay(st) { return attack(st, 'ArtemisLaserRay'); }
  /* Infernum ApolloBehaviorOverride.cs:1247-1329 (GatlingLaser, three beams). */
  function GatlingLaserAndPlasmaFlames(st) { return attack(st, 'GatlingLaserAndPlasmaFlames'); }
  /* Infernum ApolloBehaviorOverride.cs:1390-1398 (SlowLaserRay, sweep of 5 half-turns). */
  function SlowLaserRayAndPlasmaBlasts(st) { return attack(st, 'SlowLaserRayAndPlasmaBlasts'); }
  /* Infernum ApolloBehaviorOverride.cs:1565-1628 (ThermonuclearBlitz death orb). */
  function ThermonuclearBlitz(st) { return attack(st, 'ThermonuclearBlitz'); }
  var ATK = {
    BasicShots: BasicShots,
    FireCharge: FireCharge,
    ApolloPlasmaCharges: ApolloPlasmaCharges,
    ArtemisLaserRay: ArtemisLaserRay,
    GatlingLaserAndPlasmaFlames: GatlingLaserAndPlasmaFlames,
    SlowLaserRayAndPlasmaBlasts: SlowLaserRayAndPlasmaBlasts,
    ThermonuclearBlitz: ThermonuclearBlitz
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
        /* cs:1855-1857 — the final phase stays on ThermonuclearBlitz. */
        if (phase >= 6) index = index + 1 < list.length ? index + 1 : list.length - 1;
        else index = (index + 1) % list.length;
        begin(list[index]);
      }
    }
    return false;
  }

  NEU.twinsAtk = {
    attach: function (adapter) { A = adapter; },
    start: start,
    step: tickFrame,
    phase: function (n) { start(n >= 6 ? 6 : 1); },
    seal: function () { pendingFinal = true; },
    reset: function () { current = null; index = 0; phase = 1; open = false; tele = null; haz = null; pendingFinal = false; },
    cycles: function () { return { normal: NORMAL, final: FINAL }; },
    current: function () { return current ? current.name : null; },
    lens: function () { return open; },
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
  function pairAt(frame) {
    var ar = arena(), cx = ar.AX + ar.AW - 96, cy = ar.AY + 88;
    var bob = REDUCE ? 0 : ((frame % 8) * 2);
    return [
      { id: 'artemis', x: cx - 28, y: cy + bob },
      { id: 'apollo', x: cx + 16, y: cy }
    ];
  }
  function label(word) {
    var el = document.getElementById('exoVuln');
    var hud = document.getElementById('exoHud');
    var st = NEU.exo && NEU.exo.state;
    if (el) el.textContent = word;
    if (hud && st) hud.textContent = 'HP ' + twinsHp + '  P' + st.phase;
  }
  function draw(st) {
    var cv = document.getElementById('exoCanvas');
    var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    var list, i, body, col, ar, cx, cy;
    if (!ctx || !ctx.fillRect) return;
    ctx.imageSmoothingEnabled = false;
    ar = arena();
    cx = (ar.AX + ar.AW - 96) | 0;
    cy = (ar.AY + 88) | 0;
    list = st.pair || [];
    for (i = 0; i < list.length; i++) {
      body = list[i];
      col = COL[body.id] || '#FF00FF';
      ctx.fillStyle = col;
      ctx.fillRect(body.x | 0, body.y | 0, 12, 12);
      ctx.fillStyle = COL.white;
      ctx.fillRect((body.x + 4) | 0, (body.y + 4) | 0, 4, 4);
    }
    ctx.fillStyle = open ? '#FFC46A' : '#C5D0D8';
    ctx.fillRect(cx - 2, cy - 10, 8, 4);
  }
  function publish() {
    var st = NEU.exo.state, word;
    st.hp = twinsHp;
    st.max = 1000;
    st.ratio = twinsHp / 1000;
    st.attack = NEU.twinsAtk.current();
    st.telegraph = tele;
    st.hazard = haz;
    st.vents = open;
    st.vulnerable = !!open && st.mode === 'fight';
    st.overdrive = sig;
    st.pair = pairAt(st.frame || 0);
    if (finalOn) st.phase = 6;
    word = st.mode === 'fight' && open ? 'VULNERABLE' : (st.mode === 'fight' || st.mode === 'won' ? 'INVULNERABLE' : '');
    label(word);
    draw(st);
  }
  function lockWin() {
    var st = NEU.exo.state;
    won = true;
    twinsHp = 0;
    open = false;
    st.mode = 'won';
    st.hp = 0;
    st.ratio = 0;
    st.max = 1000;
    st.attack = 'ThermonuclearBlitz';
    st.vulnerable = false;
    st.vents = false;
    st.overdrive = true;
    if (NEU.save) NEU.save.flag('exo_won', 1);
    label('INVULNERABLE');
    /* Mechs are dead. Draedon stays. */
    if (NEU.draedon && NEU.draedon.open) NEU.draedon.open();
  }
  function resetLocal() {
    twinsHp = 1000;
    won = false;
    sig = false;
    finalOn = false;
    musicSent = false;
    pendingFinal = false;
    live = true;
    lastFrame = 0;
    NEU.twinsAtk.phase(1);
  }
  function noteFinal() {
    var wrap;
    if (NEU.twinsAtk.tier() < 6 || musicSent) return;
    finalOn = true;
    musicSent = true;
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('exo', 6);
    wrap = document.getElementById('exo');
    if (wrap) wrap.style.background = '#300818';
  }
  function onFightFrame() {
    var st = NEU.exo.state, ar;
    if (!st || st.primary !== 'twins') return;
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
    NEU.twinsAtk.step({
      x: ar.AX + ar.AW - 96, y: ar.AY + 88, tx: ar.AX + ar.AW / 2, ty: ar.AY + ar.AH / 2,
      ax: ar.AX, ay: ar.AY, aw: ar.AW, ah: ar.AH, phase: phase
    });
    if (NEU.twinsAtk.current() === 'ThermonuclearBlitz' && NEU.twinsAtk.lens()) sig = true;
    noteFinal();
    publish();
  }
  function ensure() {
    var st = NEU.exo && NEU.exo.state;
    if (!st || st.primary !== 'twins' || st.mode !== 'fight' || won) return;
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
      if (st.primary === 'twins' && st.frame === 0 && st.playerHp === 6) {
        resetLocal();
        publish();
      }
    };
    NEU.exo.damage = function (id, n) {
      var st = NEU.exo.state, room, ok;
      if (id === 'twins' && st.primary === 'twins') {
        if (won || st.mode !== 'fight') return false;
        if (!open) return false;
        if (!sig) {
          room = twinsHp - 1;
          if (room <= 0) return false;
          if (n > room) n = room;
        }
        ok = origDamage(id, n);
        if (ok) {
          twinsHp -= n;
          if (twinsHp <= 75 && st.phase >= 4) NEU.twinsAtk.seal();
          if (twinsHp <= 0) lockWin();
        }
        publish();
        return ok;
      }
      ok = origDamage(id, n);
      if (st.primary === 'twins' && st.mode === 'fight') publish();
      return ok;
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

  NEU.twinsAtk.attach({
    warn: function () {},
    hit: function () { if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small'); }
  });
})();
