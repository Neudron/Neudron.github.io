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
  var shatterBusy = 0, impactT = 0, shieldOn = false;
  var lastVuln = null, lastBang = null, lastPrompt = null, lastCount = null, lastHud = null;
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
    if (!shattered && NEU.juice && NEU.juice.shatter) {
      shattered = 1;
      /* the canvas still holds the lit arena: the shards carry its colours. */
      shatterBusy = 30;
      NEU.juice.shatter({
        onDone: function () { shatterBusy = 0; },
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
    impactT = 1;
    shieldOn = false;
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
    shatterBusy = 0;
    impactT = 0;
    shieldOn = false;
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
    var word = '', txt;
    if (mode === 'fight') word = vulnerableNow() ? 'VULNERABLE' : 'INVULNERABLE';
    /* DOM writes only on change: publish runs every frame. */
    if (vulnEl && word !== lastVuln) { vulnEl.textContent = word; lastVuln = word; }
    if (bangEl && (mode === 'nuke') !== lastBang) {
      lastBang = mode === 'nuke';
      bangEl.hidden = !lastBang;
      bangEl.style.color = '#ff0';
      bangEl.style.fontSize = '64px';
      bangEl.style.fontWeight = '700';
    }
    if (promptEl) {
      txt = 'press [' + keyName() + ']: SOUL SHIELD';
      if (lastPrompt !== (mode === 'nuke' ? txt : '')) {
        lastPrompt = mode === 'nuke' ? txt : '';
        promptEl.hidden = mode !== 'nuke';
        promptEl.style.color = '#ff0';
        promptEl.style.fontSize = '32px';
        promptEl.style.fontWeight = '700';
        promptEl.textContent = txt;
      }
    }
    if (countEl) {
      txt = mode === 'nuke' ? String(count) : '';
      if (txt !== lastCount) {
        lastCount = txt;
        countEl.hidden = mode !== 'nuke';
        countEl.textContent = txt;
      }
    }
    if (hudEl) {
      txt = 'HP ' + hp;
      if (txt !== lastHud) { hudEl.textContent = txt; lastHud = txt; }
    }
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
    state.bg = LOOK[phase];
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
  function art() { return NEU.exoArt; }
  function tsec() { return REDUCE ? 0 : frame / 60; }
  /* a lane of 3px squares along an angle, w wide */
  function lane(x, y, a, len, w, col, al) {
    var c = Math.cos(a), s = Math.sin(a), k, o, p = ctx.globalAlpha;
    ctx.globalAlpha = al;
    ctx.fillStyle = col;
    for (k = 0; k < len; k += 3) {
      for (o = -w / 2; o < w / 2; o += 3) ctx.fillRect((x + c * k - s * o) | 0, (y + s * k + c * o) | 0, 3, 3);
    }
    ctx.globalAlpha = p;
  }
  /* the 2px core, as 2x2 steps along the angle */
  function core(x, y, a, len, col) {
    var c = Math.cos(a), s = Math.sin(a), k;
    ctx.fillStyle = col;
    for (k = 0; k < len; k += 2) ctx.fillRect((x + c * k) | 0, (y + s * k) | 0, 2, 2);
  }
  function drawTele(sh) {
    var m, w;
    if (!sh || !cur) return;
    if (sh.kind === 'hover') {
      ctx.fillStyle = '#FFD2A0';
      ctx.fillRect(sh.x | 0, sh.y | 0, sh.len, 2);
      return;
    }
    m = Math.max(0, Math.min(1, (cur.f - 27) / 27));
    w = Math.round(10 - 8 * m);
    lane(sh.x, sh.y, sh.a, sh.len, w, '#FF5A3C', 0.2);
    core(sh.x, sh.y, sh.a, sh.len, '#FF5A3C');
  }
  function drawHaz(sh) {
    var white;
    if (!sh || !cur) return;
    if (sh.kind === 'hover') return;
    white = cur.f - 54 < 5;
    lane(sh.x, sh.y, sh.a, sh.len, 14, '#FF5A3C', 0.35);
    lane(sh.x, sh.y, sh.a, sh.len, 6, '#FF5A3C', 1);
    if (white) core(sh.x, sh.y, sh.a, sh.len, '#FFFFFF');
  }
  function drawDigit(n, x, y) {
    var rows = DIG[n], r, c, ch;
    if (!rows) return;
    for (r = 0; r < rows.length; r++) {
      for (c = 0; c < 3; c++) {
        ch = rows[r].charAt(c);
        if (ch !== '1') continue;
        ctx.fillStyle = '#FFE070';
        ctx.fillRect(x + c * 16, y + r * 16, 16, 16);
        ctx.fillStyle = '#A07A10';
        ctx.fillRect(x + c * 16, y + r * 16 + 12, 16, 4);
        ctx.fillStyle = '#FFF8C8';
        ctx.fillRect(x + c * 16, y + r * 16, 16, 2);
      }
    }
  }
  /* the soul's rings after the blast: three expanding 1px rings and dust */
  function drawImpact(x, y) {
    var k, a, r, cols = ['#FFFFFF', '#FFD34E', '#E04A3A'], j, d;
    if (impactT <= 0) return;
    if (NEU.fxBurst) NEU.fxBurst(ctx, 'fxGigBoomO', x, y, Math.min(1, impactT / 40), 1.8);
    for (j = 0; j < 3; j++) {
      r = impactT * 5 - j * 14;
      if (r < 4) continue;
      ctx.fillStyle = cols[j];
      for (k = 0; k < 48; k++) {
        a = k * Math.PI / 24;
        ctx.fillRect((x + Math.cos(a) * r) | 0, (y + Math.sin(a) * r) | 0, 1, 1);
      }
    }
    for (k = 0; k < 14; k++) {
      a = k * 0.9 + 0.3;
      d = impactT * (1.2 + (k % 4) * 0.5);
      ctx.fillStyle = k % 2 ? '#5A6878' : '#3A4450';
      ctx.fillRect((x + Math.cos(a) * d * 3) | 0, (y + Math.sin(a) * d * 2 - impactT * 0.6) | 0, 4, 4);
    }
  }
  /* red danger frame: three stepped bands, alpha rises with each count */
  function drawDanger(w, h) {
    var a = 0.25 + (3 - Math.max(0, Math.min(3, count))) * 0.05, k, ins, p = ctx.globalAlpha, ww = box.AW | 0, hh = box.AH | 0;
    ctx.fillStyle = '#A01818';
    for (k = 0; k < 3; k++) {
      ctx.globalAlpha = a * (1 - k * 0.3);
      ins = k * 8;
      ctx.fillRect((box.AX | 0) + ins, (box.AY | 0) + ins, ww - ins * 2, 8);
      ctx.fillRect((box.AX | 0) + ins, (box.AY | 0) + hh - ins - 8, ww - ins * 2, 8);
      ctx.fillRect((box.AX | 0) + ins, (box.AY | 0) + ins + 8, 8, hh - ins * 2 - 16);
      ctx.fillRect((box.AX | 0) + ww - ins - 8, (box.AY | 0) + ins + 8, 8, hh - ins * 2 - 16);
    }
    ctx.globalAlpha = p;
  }
  function draw() {
    var w, h, can, nuke, wy, fx, fy;
    if (!ctx) return;
    if (shatterBusy > 0) { shatterBusy--; }
    ctx.imageSmoothingEnabled = false;
    w = window.innerWidth || 800;
    h = window.innerHeight || 600;
    ctx.fillStyle = '#06080C';
    ctx.fillRect(0, 0, w, h);
    if (art()) art().arena(ctx, box, phase, frame, REDUCE);
    nuke = mode === 'nuke' || mode === 'fall' || mode === 'wake';
    can = ctx.save && ctx.beginPath && ctx.rect && ctx.clip && ctx.restore;
    if (can) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.AX | 0, box.AY | 0, box.AW | 0, box.AH | 0);
      ctx.clip();
    }
    drawTele(tele);
    drawHaz(haz);
    if (art()) art().draedon(ctx, boss.x | 0, (boss.y + 8) | 0, tsec());
    if (mode === 'nuke' && art()) {
      /* the warhead falls from the top centre across the countdown */
      wy = (box.AY - 90 + Math.min(1, countT / 180) * (box.AH * 0.62)) | 0;
      art().warhead(ctx, (box.AX + box.AW / 2) | 0, wy, tsec());
    }
    if (can) ctx.restore();
    if (nuke) drawDanger(w, h);
    if (mode === 'fall' || mode === 'wake' || mode === 'nuke') {
      band((box.AX + box.AW / 2 - 24) | 0, bodyY | 0, 48, 16, '#C4A574');
      band((box.AX + box.AW / 2 - 28) | 0, (bodyY + 12) | 0, 56, 8, '#3A2A22');
    }
    if (mode === 'nuke' && count > 0) {
      fx = (box.AX + 24) | 0;
      fy = (box.AY + 24) | 0;
      band(fx, fy, 72, 104, '#0A0C10');
      if (art()) art().hazardFrame(ctx, fx, fy, 72, 104);
      drawDigit(count, fx + 12, fy + 12);
    }
    if (mode === 'fall' || mode === 'wake') {
      if (NEU.danmaku && NEU.danmaku.soul) NEU.danmaku.soul.draw(ctx, F.x, soulY, false);
      else band(F.x - 8, soulY - 8, 16, 16, '#FF00FF');
      if (impactT > 0) drawImpact(F.x | 0, soulY | 0);
    } else if (NEU.danmaku && NEU.danmaku.soul) NEU.danmaku.soul.draw(ctx, F.x, F.y, false);
    else band(F.x - 8, F.y - 8, 16, 16, '#FF00FF');
    if (shieldOn && mode === 'nuke' && art()) art().shield(ctx, F.x, F.y, tsec());
    if (kit) kit.draw(ctx);
    if (flash && !REDUCE) band(0, 0, w, h, '#FFFFFF');
  }
  function frameOnce() {
    flash = 0;
    if (impactT > 0) impactT++;
    if (impactT > 40) impactT = 0;
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
    var k, dir, tp0;
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
    if (kit && (k === 'z' || k === 'c' || k === 'C')) {
      tp0 = kit.tp;
      kit.keydown(k);
      /* spending TP in the nuke is the soul shield going up */
      if (mode === 'nuke' && kit.tp < tp0) shieldOn = true;
      publish();
      return;
    }
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
