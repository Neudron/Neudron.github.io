/* rooms-p.js — the painter's tavern, then the lightning that leaves it (W5.5). */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (!NEU.engine || !NEU.engine.register || !NEU.engineKinds) return;
  var E = NEU.engine, K = NEU.engineKinds;
  var live = false, t = 0, flashes = 0, didFlash = false, audio = false, pending = false, nag = false, shook = false;

  function reducedNow() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  function box(g, col, x, y, w, h) {
    x = x | 0; y = y | 0; w = w | 0; h = h | 0;
    if (w <= 0 || h <= 0) return;
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  }
  function pix(g) { try { g.imageSmoothingEnabled = false; } catch (e) {} }

  function drawPainter(g, e, d) {
    var S = d.S || 1, x = d.sx | 0, y = (d.sy | 0) - 20 * S;
    pix(g);
    box(g, '#6B3A24', x - 5 * S, y + 8 * S, 10 * S, 12 * S);
    box(g, '#E6C2A0', x - 4 * S, y + 4 * S, 8 * S, 6 * S);
    box(g, '#241810', x - 5 * S, y, 10 * S, 4 * S);
    box(g, '#1A120C', x - 1 * S, y + 6 * S, 2 * S, 2 * S);
    box(g, '#C4A060', x + 6 * S, y + 10 * S, 8 * S, 6 * S);
    box(g, '#E2B84A', x + 7 * S, y + 11 * S, 2 * S, 2 * S);
    box(g, '#C4323A', x + 10 * S, y + 11 * S, 2 * S, 2 * S);
    box(g, '#F4F0E8', x + 8 * S, y + 13 * S, 2 * S, 2 * S);
  }
  function drawWork(g, e, d) {
    var S = d.S || 1, x = (d.sx | 0) - 8 * S, y = (d.sy | 0) - 16 * S;
    var evil = e.path === 'evil';
    pix(g);
    box(g, evil ? '#2A1214' : '#E8C85A', x, y, 16 * S, 18 * S);
    box(g, evil ? '#1A0A0C' : '#F7FBFF', x + 2 * S, y + 2 * S, 12 * S, 12 * S);
    box(g, evil ? '#7A1020' : '#F8E7A8', x + 4 * S, y + 8 * S, 8 * S, 6 * S);
    box(g, evil ? '#3A3A3A' : '#FFFFFF', x + 6 * S, y + 4 * S, 4 * S, 2 * S);
  }
  function drawHearth(g, e, d) {
    var S = d.S || 1, x = (d.sx | 0) - 8 * S, y = (d.sy | 0) - 12 * S;
    var step = reducedNow() ? 0 : ((d.now / 180) | 0) % 2;
    pix(g);
    box(g, '#3A2418', x, y + 8 * S, 16 * S, 8 * S);
    box(g, '#6A2A12', x + 4 * S, y + 6 * S, 8 * S, 4 * S);
    box(g, step ? '#F0A020' : '#E25822', x + 6 * S, y + (2 + step) * S, 4 * S, 4 * S);
  }
  function drawEasel(g, e, d) {
    var S = d.S || 1, x = (d.sx | 0) - 6 * S, y = (d.sy | 0) - 16 * S;
    pix(g);
    box(g, '#6B3E22', x + 4 * S, y, 2 * S, 16 * S);
    box(g, '#F3E6C8', x, y + 2 * S, 12 * S, 8 * S);
    box(g, '#6B3E22', x, y + 2 * S, 12 * S, 2 * S);
  }
  function drawPot(g, e, d) {
    var S = d.S || 1, x = (d.sx | 0) - 4 * S, y = (d.sy | 0) - 8 * S;
    pix(g);
    box(g, '#8C3A28', x, y + 2 * S, 8 * S, 6 * S);
    box(g, '#3A6EA5', x + 2 * S, y, 4 * S, 2 * S);
  }

  K.kind('painter', {
    interactive: function () { return true; },
    fire: function (e, sys) {
      var key = (NEU.keys && NEU.keys.label) ? NEU.keys.label('z') : 'z';
      var held = NEU.save && (NEU.save.has('pkg_misleading') || NEU.save.has('dad_card'));
      var lines = [
        'an old painter. the beret is older than the palette.',
        'two mountains. pick one, then take the door.',
        'press ' + key + ' on the canvas you want.'
      ];
      if (!held && NEU.save) {
        NEU.save.give('pkg_misleading');
        if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small');
        lines.push('he hands you a misleading-looking package.');
      }
      sys.say(lines, 'narr');
    },
    draw: drawPainter
  });
  K.kind('work', {
    interactive: function () { return true; },
    fire: function (e, sys) {
      if (NEU.save) NEU.save.flag('mtn_path', e.path);
      sys.say([e.path === 'evil'
        ? 'Evil Mountain. crimson, black, and ash.'
        : 'Heavenly Mountain. gold, white, and cloud.'], 'narr');
    },
    draw: drawWork
  });
  K.kind('hearth', { interactive: function () { return false; }, draw: drawHearth,
    light: function () { return { r: 28, col: '#E25822', glow: 0.2, flicker: !reducedNow() }; } });
  K.kind('easel', { interactive: function () { return false; }, draw: drawEasel });
  K.kind('paintpot', { interactive: function () { return false; }, draw: drawPot });

  function tryLeave(api) {
    var path;
    if (NEU.save && (NEU.save.flagged('mtn_heaven') || NEU.save.flagged('mtn_evil'))) {
      if (api && api.go) api.go('a1_clearing');
      return;
    }
    if (pending || live) return;
    path = NEU.save && NEU.save.flag('mtn_path');
    if (path !== 'heaven' && path !== 'evil') {
      if (!nag) {
        nag = true;
        api.say(['pick one of the two paintings first.'], 'narr');
      }
      return;
    }
    pending = true;
    if (NEU.kernel && NEU.kernel.after) NEU.kernel.after(0, openBolt);
    else openBolt();
  }

  E.tileset('tavern', {
    solid: '#o',
    colours: { '#': '#4A2E1C', '.': '#6B4228', ',': '#8A5A32', 'o': '#3A2416' }
  });
  E.register('p1_tavern', {
    tileset: 'tavern',
    tiles: [
      '######################',
      '######################',
      '##..................##',
      '##..................##',
      '##o.................##',
      '##..................##',
      '##..................##',
      '##..................##',
      '######################',
      '######################'
    ].join('\n'),
    spawns: {
      default: { x: 11, y: 6, face: 'up' },
      door: { x: 11, y: 5, face: 'down' }
    },
    entities: [
      { t: 'hearth', x: 4, y: 5 },
      { t: 'easel', x: 7, y: 5 },
      { t: 'paintpot', x: 9, y: 5 },
      { t: 'painter', x: 5, y: 6 },
      { t: 'work', x: 14, y: 3, path: 'heaven' },
      { t: 'work', x: 18, y: 3, path: 'evil' },
      { t: 'exit', x: 11, y: 1, to: 'a1_clearing', spawn: 'default', style: 'door' },
      { t: 'trigger', x: 11, y: 7, run: tryLeave }
    ],
    onEnter: function () { nag = false; pending = false; }
  });

  function boltPts() {
    var pts = [], x = 320, y = 0, i, s = 9;
    for (i = 0; i < 16; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      x += (s % 72) - 36;
      if (x < 48) x = 48;
      if (x > 592) x = 592;
      y += 22;
      pts.push(x, y);
    }
    return pts;
  }
  function seg(c, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0, steps = Math.max(Math.abs(dx), Math.abs(dy)) | 0, i, x, y;
    if (steps < 1) steps = 1;
    c.fillStyle = '#D8ECFF';
    for (i = 0; i <= steps; i += 2) {
      x = (x0 + dx * (i / steps)) | 0;
      y = (y0 + dy * (i / steps)) | 0;
      c.fillRect(x, y, 2, 4);
    }
  }
  function rumble() {
    var AC, ac, o, g;
    if (reducedNow()) return;
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('medium');
    AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ac = new AC();
      o = ac.createOscillator();
      g = ac.createGain();
      o.type = 'sawtooth';
      if (o.frequency && o.frequency.setValueAtTime) o.frequency.setValueAtTime(46, ac.currentTime || 0);
      if (g.gain && g.gain.setValueAtTime) g.gain.setValueAtTime(0.18, ac.currentTime || 0);
      if (g.gain && g.gain.exponentialRampToValueAtTime) g.gain.exponentialRampToValueAtTime(0.001, (ac.currentTime || 0) + 0.8);
      o.connect(g); g.connect(ac.destination);
      o.start();
      if (o.stop) o.stop((ac.currentTime || 0) + 0.8);
      audio = true;
    } catch (e2) {}
  }
  function drawBolt() {
    var cv = document.getElementById('boltCanvas');
    var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    var w = 640, h = 360, pts, i, reduce = reducedNow();
    if (!ctx) return;
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    pix(ctx);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0A0A0C';
    ctx.fillRect(0, 0, w, h);
    if (reduce) {
      ctx.globalAlpha = t >= 0.4 ? 1 : t / 0.4;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      return;
    }
    pts = boltPts();
    for (i = 2; i < pts.length; i += 2) seg(ctx, pts[i - 2], pts[i - 1], pts[i], pts[i + 1]);
    for (i = 0; i < 8; i++) {
      ctx.fillStyle = '#5C5854';
      ctx.fillRect(48 + i * 72, (300 - t * (24 + i * 8)) | 0, 16, 8);
    }
    if (!didFlash && t >= 0.36) {
      didFlash = true;
      flashes += 1;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }
    if (!shook && t >= 0.5 && NEU.juice && NEU.juice.hit) { shook = true; NEU.juice.hit('medium'); }
  }
  function hideBolt() {
    var el = document.getElementById('bolt');
    if (el) el.hidden = true;
  }
  function finish() {
    var path, id;
    if (!live) return;
    live = false;
    hideBolt();
    if (NEU.kernel && NEU.kernel.current() === 'bolt') NEU.kernel.pop();
    path = NEU.save && NEU.save.flag('mtn_path');
    id = path === 'evil' ? 'v0' : 'h0';
    if (NEU.plat && NEU.plat.open) NEU.plat.open(id);
  }
  function openBolt() {
    var el;
    if (live) return;
    pending = false;
    live = true;
    t = 0;
    didFlash = false;
    flashes = 0;
    audio = false;
    shook = false;
    if (NEU.engine && NEU.engine.running && NEU.engine.leave) NEU.engine.leave();
    el = document.getElementById('bolt');
    if (el) el.hidden = false;
    if (NEU.kernel) NEU.kernel.push('bolt');
    rumble();
    drawBolt();
  }
  function tick(dt) {
    var sec = dt, reduce, limit;
    if (!live) return;
    if (sec > 2) sec = sec / 1000;
    if (sec > 0.05) sec = 0.05;
    if (sec < 0) sec = 0;
    t += sec;
    drawBolt();
    reduce = reducedNow();
    limit = reduce ? 0.48 : 1.15;
    if (t >= limit) finish();
  }
  if (NEU.kernel) NEU.kernel.register('bolt', {
    tick: tick,
    open: openBolt,
    close: function () { live = false; hideBolt(); if (NEU.kernel.current() === 'bolt') NEU.kernel.pop(); },
    running: function () { return live; }
  });
  NEU.painter = {
    open: openBolt,
    live: function () { return live; },
    flashes: function () { return flashes; },
    heard: function () { return audio; }
  };
})();
