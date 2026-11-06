/* boss-exo.js — Exo Mech select, gates, shared fight.
   Gates: ExoMechManagement.cs:55-59. Phase: cs:123-144.
   Complement at life < 0.5: ThanatosHeadBehaviorOverride.cs:200-208.
   Final mech when the complement is under half: cs:210-215.
   Initial mech DR while that complement is above half: cs:225-229.
   Open vents take damage. Closed vents do not.
   ThanatosSegmentBehaviorOverride.cs:86-110. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var wrap = document.getElementById('exo');
  if (!wrap) { NEU.exo = { open: function () {}, state: {} }; return; }
  var cv = document.getElementById('exoCanvas');
  var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
  var pickEl = document.getElementById('exoPick');
  var vulnEl = document.getElementById('exoVuln');
  var hudEl = document.getElementById('exoHud');
  var ORDER = ['thanatos', 'ares', 'twins'];
  var LABEL = { thanatos: 'Thanatos', ares: 'Ares', twins: 'Artemis and Apollo' };
  /* ExoMechManagement.cs:55-57 */
  var P2 = 0.85, P3 = 0.625, P4 = 0.5;
  var MAX = 1000;
  var LOOK = [null, '#101820', '#1a1408', '#201018', '#0c1830', '#281008', '#300818'];
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var F = NEU.danmaku && NEU.danmaku.fight ? NEU.danmaku.fight(400, 300) : { x: 400, y: 300, fx: 0, fy: -1 };
  var box = { AX: 20, AY: 20, AW: 760, AH: 500 };
  var mechs = {};
  var bodies = {
    thanatos: { id: 'thanatos', x: 0, y: 0, r: 28 },
    ares: { id: 'ares', x: 0, y: 0, r: 40 },
    twins: { id: 'twins', x: 0, y: 0, r: 24 }
  };
  var i, mode = 'select', sel = 0, phase = 0, acc = 0, fightFrame = 0;
  var initialId = null, compId = null, finId = null;
  var compSummoned = false, finSummoned = false, overdriveOpen = false;
  var playerHp = 6, musicPhase = -1, kit = null, held = {}, god = false;
  var gates = [], gateSeen = { a: 0, b: 0, c: 0 };
  var state = {
    mode: 'select', primary: null, complement: null, final: null,
    phase: 1, hp: MAX, max: MAX, ratio: 1, attack: null, vents: false,
    vulnerable: false, telegraph: null, hazard: null, frame: 0, parallax: 0,
    compRatio: 1, playerHp: 6, overdrive: false, gates: gates,
    combo: null, comboTelegraph: null, comboHazard: null
  };

  for (i = 0; i < ORDER.length; i++) mechs[ORDER[i]] = { hp: MAX, max: MAX, alive: false };

  function layout() {
    var w = window.innerWidth || 800, h = window.innerHeight || 600;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var ar;
    if (cv && ctx) {
      cv.width = (w * dpr) | 0;
      cv.height = (h * dpr) | 0;
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    ar = NEU.danmaku && NEU.danmaku.arena ? NEU.danmaku.arena(w, h, 760, 500, 20) : null;
    if (ar) { box.AX = ar.AX; box.AY = ar.AY; box.AW = ar.AW; box.AH = ar.AH; }
    else { box.AX = 20; box.AY = 40; box.AW = 760; box.AH = 480; }
  }
  function centerPlayer() {
    F.x = box.AX + box.AW / 2;
    F.y = box.AY + box.AH / 2;
  }
  function ventsOpen() { return !!(NEU.thanatosAtk && NEU.thanatosAtk.vents()); }
  function shielded() {
    var c;
    if (!compSummoned || !compId) return false;
    c = mechs[compId];
    /* ThanatosHeadBehaviorOverride.cs:225-229 */
    return c.alive && c.hp > c.max * P4;
  }
  function anyAlive() {
    return mechs.thanatos.alive || mechs.ares.alive || mechs.twins.alive;
  }
  function compute() {
    var ini = initialId && mechs[initialId], ratio, comp, fin, compPresent, finAlive, total;
    if (!ini) return 1;
    ratio = ini.hp / ini.max;
    comp = compId && mechs[compId];
    fin = finId && mechs[finId];
    compPresent = !!(compSummoned && comp && comp.alive);
    finAlive = !!(finSummoned && fin && fin.alive);
    total = (ini.alive ? 1 : 0) + (compPresent ? 1 : 0) + (finAlive ? 1 : 0);
    /* ExoMechManagement.cs:123-144 */
    if (finSummoned && !finAlive) return total === 1 ? 6 : 3;
    if (finAlive && finId === initialId) return 5;
    if (compPresent) return 4;
    if (ratio <= P3) return 3;
    if (ratio <= P2) return 2;
    return 1;
  }
  function syncPhase() {
    var p = compute(), changed = p !== phase;
    phase = p;
    if (changed && NEU.thanatosAtk && mechs.thanatos.alive) NEU.thanatosAtk.phase(p >= 6 ? 6 : 1);
    if (NEU.music && NEU.music.bossPhase && musicPhase !== phase) {
      NEU.music.bossPhase('exo', phase);
      musicPhase = phase;
    }
    if (LOOK[phase]) wrap.style.background = LOOK[phase];
  }
  function noteGates() {
    var ini = initialId && mechs[initialId], r;
    if (!ini) return;
    r = ini.hp / ini.max;
    /* ExoMechManagement.cs:55-57. Recorded in threshold order. */
    if (!gateSeen.a && r <= P2) { gateSeen.a = 1; gates.push(P2); }
    if (!gateSeen.b && r <= P3) { gateSeen.b = 1; gates.push(P3); }
    if (!gateSeen.c && r < P4) { gateSeen.c = 1; gates.push(P4); }
  }
  function comboLive() {
    return !!(compSummoned && compId && initialId && mechs[initialId].alive && mechs[compId].alive);
  }
  function stepCombo() {
    if (!NEU.exoCombos) return;
    if (!comboLive()) { NEU.exoCombos.clear(); return; }
    NEU.exoCombos.pair(initialId, compId);
    NEU.exoCombos.step({
      x: bodies[initialId].x, y: bodies[initialId].y, tx: F.x, ty: F.y,
      ax: box.AX, ay: box.AY, aw: box.AW, ah: box.AH
    });
  }
  function syncSummon() {
    var ini = mechs[initialId], comp, named;
    if (!ini) return;
    /* ThanatosHeadBehaviorOverride.cs:200-208 */
    if (!compSummoned && ini.hp / ini.max < P4) {
      compSummoned = true;
      mechs[compId].alive = true;
      mechs[compId].hp = MAX;
      named = '* ' + LABEL[compId] + ' joins.';
      if (NEU.talk) NEU.talk([named], 'draedon');
    }
    comp = mechs[compId];
    /* ThanatosHeadBehaviorOverride.cs:210-215 */
    if (compSummoned && !finSummoned && comp.alive && comp.hp / comp.max < P4) {
      finSummoned = true;
      mechs[finId].alive = true;
      mechs[finId].hp = MAX;
    }
  }
  function publish() {
    var word = '', ini = initialId ? mechs[initialId] : null;
    var comp = compSummoned && compId && mechs[compId].alive ? compId : null;
    if (mode === 'fight' || mode === 'won') word = ventsOpen() ? 'VULNERABLE' : 'INVULNERABLE';
    if (vulnEl) vulnEl.textContent = word;
    state.combo = NEU.exoCombos ? NEU.exoCombos.current() : null;
    state.comboTelegraph = NEU.exoCombos ? NEU.exoCombos.telegraph() : null;
    state.comboHazard = NEU.exoCombos ? NEU.exoCombos.hazard() : null;
    if (hudEl && ini) hudEl.textContent = 'HP ' + ini.hp + '  P' + phase + (state.combo ? '  ' + state.combo : '');
    state.mode = mode;
    state.primary = initialId;
    state.complement = comp;
    state.final = finSummoned && finId && mechs[finId].alive ? finId : null;
    state.phase = phase || 1;
    state.hp = mechs.thanatos.hp;
    state.max = MAX;
    state.ratio = mechs.thanatos.max ? mechs.thanatos.hp / mechs.thanatos.max : 1;
    state.attack = NEU.thanatosAtk ? NEU.thanatosAtk.current() : null;
    state.vents = ventsOpen();
    state.vulnerable = word === 'VULNERABLE';
    state.telegraph = NEU.thanatosAtk ? NEU.thanatosAtk.telegraph() : null;
    state.hazard = NEU.thanatosAtk ? NEU.thanatosAtk.hazard() : null;
    state.frame = fightFrame;
    state.parallax = REDUCE ? 0 : (fightFrame % 32);
    state.compRatio = compSummoned && compId ? mechs[compId].hp / mechs[compId].max : 1;
    state.playerHp = playerHp;
    state.overdrive = overdriveOpen;
    state.gates = gates;
    if (pickEl) pickEl.hidden = mode !== 'select';
  }
  function win() {
    mode = 'won';
    if (NEU.save) NEU.save.flag('exo_won', 1);
    if (NEU.talk) NEU.talk(['* The last vent closes.'], 'narr');
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('exo', -1);
    musicPhase = -1;
    publish();
    /* Mechs are dead. Draedon stays. */
    if (NEU.draedon && NEU.draedon.open) NEU.draedon.open();
  }
  function resetFight() {
    var n, id;
    overdriveOpen = false;
    compSummoned = false;
    finSummoned = false;
    gates.length = 0;
    gateSeen.a = 0;
    gateSeen.b = 0;
    gateSeen.c = 0;
    if (NEU.exoCombos) NEU.exoCombos.clear();
    playerHp = 6;
    fightFrame = 0;
    acc = 0;
    for (n = 0; n < ORDER.length; n++) {
      id = ORDER[n];
      mechs[id].hp = MAX;
      mechs[id].max = MAX;
      mechs[id].alive = id === initialId;
    }
    mode = 'fight';
    phase = 0;
    musicPhase = -2;
    centerPlayer();
    if (NEU.thanatosAtk) NEU.thanatosAtk.phase(1);
    syncPhase();
    publish();
  }
  function damage(id, n) {
    var m = mechs[id];
    if (mode !== 'fight' || !m || !m.alive || !(n > 0)) return false;
    if (id === 'thanatos' && !ventsOpen()) return false;
    if (id === initialId && shielded()) return false;
    if (id === 'thanatos' && !overdriveOpen) m.hp = Math.max(1, m.hp - n);
    else {
      m.hp -= n;
      if (m.hp <= 0) { m.hp = 0; m.alive = false; }
    }
    if (NEU.juice) NEU.juice.hit('medium');
    noteGates();
    syncSummon();
    syncPhase();
    if (!anyAlive()) {
      if (overdriveOpen) win();
      else resetFight();
      return true;
    }
    if (!mechs.thanatos.alive && overdriveOpen) win();
    else publish();
    return true;
  }
  function hurtPlayer(n) {
    if (god || mode !== 'fight') return;
    playerHp -= n || 1;
    if (NEU.juice) NEU.juice.hit('medium');
    /* A loss restarts the fight. The hour in the save stays. */
    if (playerHp <= 0) resetFight();
    else publish();
  }
  function targets() {
    var out = [], n, id;
    for (n = 0; n < ORDER.length; n++) {
      id = ORDER[n];
      if (mechs[id].alive) out.push(bodies[id]);
    }
    return out;
  }
  function ensureKit() {
    if (kit || !NEU.kit) return;
    kit = NEU.kit.create({
      F: F, box: box,
      adapter: {
        targets: targets,
        damage: function (t, n) { if (t && t.id) damage(t.id, n); },
        hurtPlayer: hurtPlayer
      }
    });
  }
  function place() {
    var ang = fightFrame * 0.03;
    bodies.thanatos.x = box.AX + box.AW / 2 + Math.cos(ang) * 200;
    bodies.thanatos.y = box.AY + 72;
    bodies.ares.x = box.AX + 96;
    bodies.ares.y = box.AY + 88;
    bodies.twins.x = box.AX + box.AW - 96;
    bodies.twins.y = box.AY + 88;
  }
  function collide() {
    var h = NEU.thanatosAtk ? NEU.thanatosAtk.hazard() : null;
    if (!h || playerHp <= 0) return;
    if (Math.abs(F.y - h.y) < 14 && F.x >= h.x && F.x <= h.x + (h.len || 0)) hurtPlayer(1);
  }
  function frameOnce() {
    place();
    if (mechs.thanatos.alive && NEU.thanatosAtk) {
      if (!NEU.thanatosAtk.current()) NEU.thanatosAtk.phase(phase >= 6 ? 6 : 1);
      NEU.thanatosAtk.step({
        x: bodies.thanatos.x, y: bodies.thanatos.y, tx: F.x, ty: F.y,
        ax: box.AX, ay: box.AY, aw: box.AW, ah: box.AH, phase: phase
      });
    }
    if (NEU.thanatosAtk && NEU.thanatosAtk.current() === 'MaximumOverdrive' && NEU.thanatosAtk.vents())
      overdriveOpen = true;
    stepCombo();
    if (NEU.danmaku && NEU.danmaku.move) NEU.danmaku.move(F, held, 1 / 60, box);
    if (kit) kit.tick(1 / 60);
    fightFrame++;
    collide();
    if (mode !== 'fight') return;
    syncPhase();
    publish();
    draw();
  }
  function step(dt) {
    var n = 0;
    if (mode !== 'fight') return;
    if (!dt || dt < 0) return;
    if (dt > 2) dt = dt / 1000;
    acc += dt;
    while (acc >= 1 / 60 && n < 5) {
      acc -= 1 / 60;
      frameOnce();
      n++;
    }
  }
  function band(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }
  function drawShape(s, col) {
    var k, px, py;
    if (!s) return;
    ctx.fillStyle = col;
    if (s.kind === 'ring') {
      for (k = 0; k < 8; k++) {
        px = s.x + Math.cos(k * Math.PI / 4) * s.r;
        py = s.y + Math.sin(k * Math.PI / 4) * s.r;
        ctx.fillRect(px | 0, py | 0, 8, 8);
      }
    } else if (s.kind === 'fan') {
      for (k = 0; k < 5; k++) ctx.fillRect((s.x + k * 24) | 0, (s.y + k * 10) | 0, 16, 4);
    } else {
      ctx.fillRect(s.x | 0, s.y | 0, s.len || 8, 4);
    }
  }
  function draw() {
    var s, open, sx, sy, shift, col, k;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = LOOK[phase] || '#FF00FF';
    ctx.fillRect(0, 0, window.innerWidth || 800, window.innerHeight || 600);
    for (k = 0; k < 4; k++) {
      shift = REDUCE ? 0 : ((fightFrame * (k + 1)) % 32);
      band((box.AX - shift) | 0, (box.AY + 40 + k * 48) | 0, box.AW + 32, 8, k % 2 ? '#1C2830' : '#243240');
    }
    band(box.AX, box.AY, box.AW, box.AH, '#07080C');
    if (NEU.thanatosAtk) {
      drawShape(NEU.thanatosAtk.telegraph(), '#FFD2A0');
      drawShape(NEU.thanatosAtk.hazard(), '#FF5A3C');
    }
    if (NEU.exoCombos) NEU.exoCombos.draw(ctx);
    if (mechs.thanatos.alive) {
      open = ventsOpen();
      /* ThanatosHeadBehaviorOverride.cs:54 SegmentCount 100.
         ThanatosSegmentBehaviorOverride.cs:104 open every 12th while the head is open. */
      for (s = 0; s < 100; s++) {
        sx = bodies.thanatos.x - s * 6;
        sy = bodies.thanatos.y + (s % 2);
        ctx.fillStyle = (open && s % 12 === 11) ? '#FFC46A' : '#7A8794';
        ctx.fillRect(sx | 0, sy | 0, 5, 5);
      }
      ctx.fillStyle = open ? '#FFC46A' : '#C5D0D8';
      ctx.fillRect(bodies.thanatos.x | 0, (bodies.thanatos.y - 6) | 0, 14, 10);
    }
    if (mechs.ares.alive) {
      band(bodies.ares.x - 16, bodies.ares.y - 24, 32, 48, '#8A939C');
      band(bodies.ares.x - 8, bodies.ares.y - 8, 16, 8, '#E04A3A');
    }
    if (mechs.twins.alive) {
      band(bodies.twins.x - 20, bodies.twins.y, 12, 12, '#E23B3B');
      band(bodies.twins.x + 8, bodies.twins.y, 12, 12, '#3BE2C8');
    }
    if (NEU.danmaku && NEU.danmaku.soul) NEU.danmaku.soul.draw(ctx, F.x, F.y, false);
    if (kit) kit.draw(ctx);
    ctx.font = '32px "Determination Mono","Pixelify Sans",monospace';
    ctx.fillStyle = ventsOpen() ? '#FFC46A' : '#8A8598';
    ctx.fillText(ventsOpen() ? 'VULNERABLE' : 'INVULNERABLE', box.AX | 0, (box.AY - 8) | 0);
  }
  function paintSel() {
    var buttons, n;
    if (!pickEl) return;
    buttons = pickEl.getElementsByTagName('button');
    for (n = 0; n < buttons.length; n++) {
      if (n === sel) buttons[n].className = 'is-sel';
      else buttons[n].className = '';
    }
  }
  function pick(id) {
    var at;
    if (mode !== 'select') return;
    if (ORDER.indexOf(id) < 0) return;
    at = ORDER.indexOf(id);
    initialId = id;
    compId = ORDER[(at + 1) % 3];
    finId = ORDER[(at + 2) % 3];
    sel = at;
    paintSel();
    layout();
    ensureKit();
    resetFight();
    if (NEU.talk) NEU.talk(['* ' + LABEL[id] + '.'], 'draedon');
  }
  function routed(e) {
    var k = e.key, r;
    if (NEU.keys && NEU.keys.route) {
      r = NEU.keys.route(k, {});
      if (r.swallow) return '';
      k = r.to;
    }
    return k;
  }
  function onDown(e) {
    var k, dir;
    if (wrap.hidden) return;
    k = routed(e);
    if (!k) return;
    if (k === 'Escape') { close(); return; }
    if (mode === 'select') {
      if (k === '1' || k === '2' || k === '3') { pick(ORDER[Number(k) - 1]); return; }
      if (k === 'ArrowDown' || k === 's') { sel = (sel + 1) % 3; paintSel(); return; }
      if (k === 'ArrowUp' || k === 'w') { sel = (sel + 2) % 3; paintSel(); return; }
      if (k === 'Enter' || k === 'z') { pick(ORDER[sel]); return; }
      return;
    }
    if (mode !== 'fight') return;
    if (k === 'x' || k === 'X') {
      if (NEU.danmaku && NEU.danmaku.key) NEU.danmaku.key(F, { key: 'x' });
      return;
    }
    if (kit && (k === 'z' || k === 'c' || k === 'C')) { kit.keydown(k); return; }
    dir = k === 'ArrowLeft' || k === 'a' ? 'left' : k === 'ArrowRight' || k === 'd' ? 'right' :
      k === 'ArrowUp' || k === 'w' ? 'up' : k === 'ArrowDown' || k === 's' ? 'down' : k === 'Shift' ? 'focus' : '';
    if (dir) held[dir] = true;
  }
  function onUp(e) {
    var k = routed(e), dir;
    if (!k) return;
    dir = k === 'ArrowLeft' || k === 'a' ? 'left' : k === 'ArrowRight' || k === 'd' ? 'right' :
      k === 'ArrowUp' || k === 'w' ? 'up' : k === 'ArrowDown' || k === 's' ? 'down' : k === 'Shift' ? 'focus' : '';
    if (dir) held[dir] = false;
    if (kit && kit.keyup) kit.keyup(k);
  }
  function open() {
    wrap.hidden = false;
    mode = 'select';
    held = {};
    if (pickEl) pickEl.hidden = false;
    if (vulnEl) vulnEl.textContent = '';
    paintSel();
    layout();
    NEU.activeMinigame = 'exo';
    document.body.classList.add('is-playing');
    if (NEU.kernel) NEU.kernel.push('exo');
    publish();
  }
  function close() {
    mode = 'select';
    if (NEU.kernel && NEU.kernel.current() === 'exo') NEU.kernel.pop();
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('exo', -1);
    musicPhase = -1;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.activeMinigame === 'exo') NEU.activeMinigame = null;
  }

  if (pickEl) {
    var buttons = pickEl.getElementsByTagName('button');
    for (i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        pick(e.currentTarget.getAttribute('data-mech'));
      });
    }
  }
  var quit = document.getElementById('exoQuit');
  if (quit) quit.addEventListener('click', close);
  addEventListener('keydown', onDown);
  addEventListener('keyup', onUp);
  addEventListener('resize', function () { if (!wrap.hidden) layout(); });

  if (NEU.thanatosAtk) NEU.thanatosAtk.attach({
    warn: function () {},
    hit: function () { if (NEU.juice) NEU.juice.hit('small'); }
  });
  if (NEU.kernel) NEU.kernel.register('exo', {
    tick: function (dt) { step(dt); },
    open: open,
    close: close,
    running: function () { return !wrap.hidden && (mode === 'fight' || mode === 'won'); }
  });
  NEU.exo = {
    open: open,
    close: close,
    pick: pick,
    step: step,
    damage: damage,
    hurtPlayer: hurtPlayer,
    god: function (on) { god = !!on; },
    state: state
  };
})();
