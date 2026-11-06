/* boss-draedon.js — Draedon after the mechs, then the nuke.
   Hover: DraedonBehaviorOverride.cs:130-147 (325px offset, fly 32).
   Laser: DraedonBehaviorOverride.cs:111-123 (AresPrecisionBlast at the player).
   Telegraph length: AresPrecisionBlast.cs:57 (hidden while timeLeft >= 27).
   Vulnerable only after the defeat delay: DraedonBehaviorOverride.cs:550.
   Signature is the pissed laser before the kill (cs:111-123). */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var wrap = document.getElementById('draedon');
  if (!wrap) {
    NEU.draedon = { open: function () {}, state: {} };
    return;
  }
  var cv = document.getElementById('draedonCanvas');
  var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
  var vulnEl = document.getElementById('draedonVuln');
  var bangEl = document.getElementById('draedonBang');
  var promptEl = document.getElementById('draedonPrompt');
  var countEl = document.getElementById('draedonCount');
  var hudEl = document.getElementById('draedonHud');
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var LOOK = { 1: '#101820', 2: '#241808', 3: '#0c2814' };
  var P1 = ['Hover', 'PrecisionBlast'];
  var P2 = ['PrecisionBlast', 'Hover'];
  /* 27 frames is 0.45s. The warned shape is the shape that hits. */
  var SPECS = {
    Hover: { duration: 80, warn: 27, hit: 54, shape: 'hover' },
    PrecisionBlast: { duration: 90, warn: 27, hit: 54, shape: 'line' },
    PissedLaser: { duration: 90, warn: 27, hit: 54, shape: 'line' }
  };
  var DIG = {
    0: ['111', '101', '101', '101', '111'],
    1: ['010', '110', '010', '010', '111'],
    2: ['111', '001', '111', '100', '111'],
    3: ['111', '001', '111', '001', '111']
  };
  var MAX = 100, SHIELD = 0.32, DIGIT_H = 80;
  var F = NEU.danmaku && NEU.danmaku.fight ? NEU.danmaku.fight(400, 300) : { x: 400, y: 300, fx: 0, fy: -1 };
  var box = { AX: 20, AY: 20, AW: 760, AH: 500 };
  var boss = { id: 'draedon', x: 400, y: 80, r: 28 };
  var mode = 'fight', phase = 1, hp = MAX, playerHp = 6, iframe = 0;
  var index = 0, cur = null, tele = null, haz = null, sig = false;
  var acc = 0, frame = 0, musicPhase = -1, kit = null, held = {};
  var haze = 0, fog = 0, count = 0, countT = 0, flash = 0, flashes = 0;
  var shattered = 0, soulY = 0, bodyY = 0, didBoom = false;
  var state = {
    mode: 'fight', phase: 1, hp: MAX, max: MAX, attack: null,
    vulnerable: false, telegraph: null, hazard: null, frame: 0,
    parallax: 0, bg: LOOK[1], playerHp: 6, tp: 0, strip: false,
    haze: 0, fog: 0, count: 0, digitH: DIGIT_H, flash: 0, flashes: 0,
    shattered: 0, soulY: 0, bodyY: 0, room: null
  };

  function layout() {
    var w = window.innerWidth || 800, h = window.innerHeight || 600, dpr, ar;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    boss.x = box.AX + box.AW / 2;
    boss.y = box.AY + 72;
    bodyY = box.AY + box.AH - 32;
  }
  function centerPlayer() {
    F.x = box.AX + box.AW / 2;
    F.y = box.AY + box.AH / 2;
  }
  function cycle() { return phase >= 2 ? P2 : P1; }
  function paintPhase() {
    if (LOOK[phase]) wrap.style.background = LOOK[phase];
    if (NEU.music && NEU.music.bossPhase && musicPhase !== phase) {
      NEU.music.bossPhase('draedon', phase);
      musicPhase = phase;
    }
  }
  function begin(name) {
    cur = { name: name, f: 0 };
    tele = null;
    haz = null;
  }
  function startCycle() {
    index = 0;
    begin(cycle()[0]);
  }
  function makeShape(spec) {
    var aim = Math.atan2(F.y - boss.y, F.x - boss.x);
    /* DraedonBehaviorOverride.cs:131 — hover sits 325px off the player.
       The line drawn here is that offset, scaled into the box. */
    return {
      kind: spec.shape, x: boss.x | 0, y: boss.y | 0, a: aim,
      len: spec.shape === 'hover' ? 120 : (box.AW | 0)
    };
  }
  function stepAtk() {
    var spec, list;
    if (sig) {
      if (!cur || cur.name !== 'PissedLaser') begin('PissedLaser');
    } else if (!cur) startCycle();
    spec = SPECS[cur.name];
    if (cur.f === spec.warn) tele = makeShape(spec);
    if (cur.f === spec.hit) haz = tele;
    cur.f++;
    if (cur.f >= spec.duration) {
      if (sig) begin('PissedLaser');
      else {
        list = cycle();
        index = (index + 1) % list.length;
        begin(list[index]);
      }
    }
  }
  function vulnerableNow() {
    return !!(haz && cur && (cur.name === 'PrecisionBlast' || cur.name === 'PissedLaser'));
  }
  function beginSig() {
    sig = true;
    begin('PissedLaser');
  }
  function beginNuke() {
    hp = 0;
    phase = 3;
    mode = 'nuke';
    count = 3;
    countT = 0;
    haze = 0;
    fog = 0;
    didBoom = false;
    paintPhase();
    if (NEU.save) NEU.save.flag('draedon_won', 1);
    if (!shattered && NEU.juice && NEU.juice.shatter) {
      shattered = 1;
      NEU.juice.shatter({
        canvas: cv,
        x: ((box.AX + box.AW / 2) * (window.devicePixelRatio || 1)) | 0,
        y: ((box.AY + box.AH / 2) * (window.devicePixelRatio || 1)) | 0
      });
    }
    publish();
  }
  function explode() {
    var blocked;
    if (didBoom) return;
    didBoom = true;
    flashes = 1;
    flash = 1;
    blocked = kit && kit.hit(1);
    if (blocked) {
      mode = 'fall';
      soulY = F.y;
      return;
    }
    if (NEU.save) NEU.save.flag('draedon_won', 0);
    resetFight();
  }
  function wake() {
    var sleep = document.getElementById('sleep');
    mode = 'wake';
    soulY = bodyY;
    if (NEU.save) NEU.save.flag('draedon_won', 1);
    state.room = 'a1_clearing';
    if (sleep) sleep.hidden = false;
    if (NEU.engine && NEU.engine.enter) NEU.engine.enter('a1_clearing', 'default');
    close();
    if (NEU.exo && NEU.exo.close) NEU.exo.close();
  }
  function ensureKit() {
    if (!NEU.kit) return;
    kit = NEU.kit.create({
      F: F, box: box,
      adapter: {
        targets: function () { return [boss]; },
        damage: function (t, n) { damage(n); },
        hurtPlayer: hurtPlayer
      }
    });
  }
  function resetFight() {
    mode = 'fight';
    phase = 1;
    hp = MAX;
    playerHp = 6;
    iframe = 0;
    sig = false;
    haze = 0;
    fog = 0;
    count = 0;
    countT = 0;
    flash = 0;
    didBoom = false;
    shattered = 0;
    soulY = 0;
    held = {};
    centerPlayer();
    ensureKit();
    startCycle();
    musicPhase = -2;
    paintPhase();
    publish();
  }
  function damage(n) {
    if (mode !== 'fight' || !(n > 0) || !vulnerableNow()) return false;
    if (cur && cur.name === 'PissedLaser') {
      hp -= n;
      if (hp <= 0) beginNuke();
      else publish();
      return true;
    }
    if (hp - n <= 0) {
      hp = 1;
      beginSig();
      publish();
      return true;
    }
    hp -= n;
    if (hp / MAX <= 0.5 && phase < 2) {
      phase = 2;
      paintPhase();
      if (!sig) startCycle();
    }
    publish();
    return true;
  }
  function hurtPlayer(n) {
    if (mode !== 'fight' || iframe > 0) return;
    iframe = 60;
    playerHp -= n || 1;
    if (NEU.juice) NEU.juice.hit('medium');
    if (playerHp <= 0) resetFight();
  }
  function onLine(s) {
    var dx, dy, px, py, t, ox, oy;
    if (!s) return false;
    dx = Math.cos(s.a);
    dy = Math.sin(s.a);
    px = F.x - s.x;
    py = F.y - s.y;
    t = px * dx + py * dy;
    if (t < 0 || t > s.len) return false;
    ox = px - dx * t;
    oy = py - dy * t;
    return ox * ox + oy * oy < 144;
  }
  function fightStep() {
    stepAtk();
    if (NEU.danmaku && NEU.danmaku.move) NEU.danmaku.move(F, held, 1 / 60, box);
    if (kit) kit.tick(1 / 60);
    if (iframe > 0) iframe--;
    if (vulnerableNow() && onLine(haz)) hurtPlayer(1);
  }
  function nukeStep() {
    var need = kit ? kit.tp : 0;
    if (REDUCE) haze = 1;
    else haze = Math.min(1, haze + 1 / 45);
    fog = Math.max(1, Math.ceil(haze * 4));
    if (kit && need < SHIELD) kit.addTp(0.08);
    countT++;
    count = 3 - ((countT / 60) | 0);
    if (count < 0) count = 0;
    if (count === 0) explode();
  }
  function fallStep() {
    soulY += REDUCE ? 9999 : 8;
    if (soulY >= bodyY) wake();
  }
  function keyName() {
    return (NEU.keys && NEU.keys.label) ? NEU.keys.label('c') : 'c';
  }
  function publish() {
    var word = '';
    if (mode === 'fight') word = vulnerableNow() ? 'VULNERABLE' : 'INVULNERABLE';
    if (vulnEl) vulnEl.textContent = word;
    if (bangEl) {
      bangEl.hidden = mode !== 'nuke';
      bangEl.style.color = '#ff0';
      bangEl.style.fontSize = '64px';
      bangEl.style.fontWeight = '700';
    }
    if (promptEl) {
      promptEl.hidden = mode !== 'nuke';
      promptEl.style.color = '#ff0';
      promptEl.style.fontSize = '32px';
      promptEl.style.fontWeight = '700';
      promptEl.textContent = 'press [' + keyName() + ']: SOUL SHIELD';
    }
    if (countEl) {
      countEl.hidden = mode !== 'nuke';
      countEl.textContent = mode === 'nuke' ? String(count) : '';
    }
    if (hudEl) hudEl.textContent = 'HP ' + hp;
    state.mode = mode;
    state.phase = phase;
    state.hp = hp;
    state.max = MAX;
    state.attack = cur ? cur.name : null;
    state.attackFrame = cur ? cur.f : 0;
    state.vulnerable = word === 'VULNERABLE';
    state.telegraph = tele;
    state.hazard = haz;
    state.frame = frame;
    state.parallax = REDUCE ? 0 : (frame % 32);
    state.bg = wrap.style.background;
    state.playerHp = playerHp;
    state.tp = kit ? kit.tp : 0;
    state.strip = !!(kit && kit.stripOpen);
    state.haze = haze;
    state.fog = fog;
    state.count = count;
    state.digitH = DIGIT_H;
    state.flash = flash;
    state.flashes = flashes;
    state.shattered = shattered;
    state.soulY = soulY;
    state.bodyY = bodyY;
  }
  function band(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }
  function drawShape(s, col) {
    var k, px, py;
    if (!s || !ctx) return;
    ctx.fillStyle = col;
    if (s.kind === 'hover') band(s.x, s.y, s.len, 4, col);
    else {
      for (k = 0; k < 8; k++) {
        px = s.x + Math.cos(s.a) * (s.len * k / 8);
        py = s.y + Math.sin(s.a) * (s.len * k / 8);
        ctx.fillRect(px | 0, py | 0, 8, 8);
      }
    }
  }
  function drawDigit(n, x, y) {
    var rows = DIG[n], r, c, ch;
    if (!rows) return;
    for (r = 0; r < rows.length; r++) {
      for (c = 0; c < 3; c++) {
        ch = rows[r].charAt(c);
        if (ch !== '1') continue;
        ctx.fillStyle = '#E8FFE8';
        ctx.fillRect(x + c * 16, y + r * 16, 16, 16);
      }
    }
  }
  function draw() {
    var w, h, k, shift, i, y;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    w = window.innerWidth || 800;
    h = window.innerHeight || 600;
    ctx.fillStyle = LOOK[phase] || '#FF00FF';
    ctx.fillRect(0, 0, w, h);
    for (k = 0; k < 4; k++) {
      shift = REDUCE ? 0 : ((frame * (k + 1)) % 32);
      band((box.AX - shift) | 0, (box.AY + 48 + k * 48) | 0, box.AW + 32, 8, k % 2 ? '#1C2830' : '#243240');
    }
    band(box.AX, box.AY, box.AW, box.AH, '#07080C');
    drawShape(tele, '#FFD2A0');
    drawShape(haz, '#FF5A3C');
    if (mode === 'nuke' || mode === 'fall' || mode === 'wake') {
      for (i = 0; i < fog; i++) {
        y = (h - (i + 1) * 32) | 0;
        band(0, y, w, 32, i % 2 ? '#145C28' : '#39A84A');
      }
    }
    /* robes, visor, chair. Drawn, so a missing sheet is not a gap. */
    band(boss.x - 16, boss.y - 28, 32, 36, '#4A6670');
    band(boss.x - 10, boss.y - 36, 20, 10, '#1A1C20');
    band(boss.x - 6, boss.y - 32, 12, 2, '#E23B3B');
    band(boss.x - 18, boss.y + 8, 36, 8, '#2A3038');
    if (mode === 'fall' || mode === 'wake' || mode === 'nuke') {
      band((box.AX + box.AW / 2 - 24) | 0, bodyY | 0, 48, 16, '#C4A574');
      band((box.AX + box.AW / 2 - 28) | 0, (bodyY + 12) | 0, 56, 8, '#3A2A22');
    }
    if (mode === 'nuke' && count > 0) drawDigit(count, ((w - 48) / 2) | 0, 160);
    if (mode === 'fall' || mode === 'wake') {
      if (NEU.danmaku && NEU.danmaku.soul) NEU.danmaku.soul.draw(ctx, F.x, soulY, false);
      else band(F.x - 8, soulY - 8, 16, 16, '#FF00FF');
    } else if (NEU.danmaku && NEU.danmaku.soul) NEU.danmaku.soul.draw(ctx, F.x, F.y, false);
    else band(F.x - 8, F.y - 8, 16, 16, '#FF00FF');
    if (kit) kit.draw(ctx);
    if (flash) band(0, 0, w, h, '#FFFFFF');
    ctx.font = '32px monospace';
    ctx.fillStyle = vulnerableNow() ? '#FFC46A' : '#8A8598';
    ctx.fillText(vulnerableNow() ? 'VULNERABLE' : 'INVULNERABLE', box.AX | 0, (box.AY - 8) | 0);
  }
  function frameOnce() {
    flash = 0;
    if (mode === 'fight') fightStep();
    else if (mode === 'nuke') nukeStep();
    else if (mode === 'fall') fallStep();
    frame++;
    publish();
    draw();
  }
  function step(dt) {
    var n = 0;
    if (mode !== 'fight' && mode !== 'nuke' && mode !== 'fall') return;
    if (!dt || dt < 0) return;
    if (dt > 2) dt = dt / 1000;
    acc += dt;
    while (acc >= 1 / 60 && n < 5) {
      acc -= 1 / 60;
      frameOnce();
      n++;
    }
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
    if (mode !== 'fight' && mode !== 'nuke') return;
    if (kit && kit.stripOpen) { kit.keydown(k); publish(); return; }
    if (k === 'x' || k === 'X') {
      if (NEU.danmaku && NEU.danmaku.key) NEU.danmaku.key(F, { key: 'x' });
      return;
    }
    if (kit && (k === 'z' || k === 'c' || k === 'C')) { kit.keydown(k); publish(); return; }
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
    layout();
    resetFight();
    document.body.classList.add('is-playing');
    NEU.activeMinigame = 'draedon';
    if (NEU.kernel) NEU.kernel.push('draedon');
    publish();
  }
  function close() {
    if (NEU.kernel && NEU.kernel.current() === 'draedon') NEU.kernel.pop();
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('draedon', -1);
    musicPhase = -1;
    wrap.hidden = true;
    if (NEU.activeMinigame === 'draedon') NEU.activeMinigame = null;
    if (document.getElementById('exo') && document.getElementById('exo').hidden)
      document.body.classList.remove('is-playing');
  }
  var quit = document.getElementById('draedonQuit');
  if (quit) quit.addEventListener('click', close);
  addEventListener('keydown', onDown);
  addEventListener('keyup', onUp);
  addEventListener('resize', function () { if (!wrap.hidden) layout(); });
  if (NEU.kernel) NEU.kernel.register('draedon', {
    tick: function (dt) { step(dt); },
    open: open,
    close: close,
    running: function () { return !wrap.hidden && (mode === 'fight' || mode === 'nuke' || mode === 'fall'); }
  });
  NEU.draedon = {
    open: open, close: close, step: step, damage: damage, hurt: hurtPlayer, state: state
  };
})();
