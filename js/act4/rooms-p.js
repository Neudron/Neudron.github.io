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

  var INK = '#12081E';
  function RA() { return NEU.roomArt || null; }
  function sh(R, cx, cy, rx, ry) {
    R.g.globalAlpha = 0.35;
    RA().blob(R, cx, cy, rx, ry, '#000000');
    R.g.globalAlpha = 1;
  }
  function paintPainter(R) {
    sh(R, 0, 0, 8, 2);
    R(-4, -6, 3, 5, '#3A2A20'); R(1, -6, 3, 5, '#3A2A20');
    R(-5, -2, 4, 2, INK); R(1, -2, 4, 2, INK);
    R(-7, -19, 14, 13, INK);
    R(-6, -18, 12, 11, '#C8C0B0');
    R(-6, -18, 2, 11, '#A8A090');
    R(0, -18, 4, 11, '#E8E0D0');
    R(4, -18, 2, 11, '#FFFFFF');
    R(-7, -8, 14, 2, '#A8A090');
    R(-3, -12, 2, 1, '#E2B84A'); R(2, -10, 2, 1, '#4A7AC8'); R(-1, -8, 2, 1, '#C4323A'); R(3, -15, 1, 1, '#E2B84A');
    R(-10, -17, 4, 8, INK); R(-9, -16, 3, 6, '#C8C0B0'); R(-9, -10, 3, 2, '#C49A78');
    R(-17, -15, 11, 7, INK); R(-16, -14, 9, 5, '#8A5A32');
    R(-15, -14, 2, 1, '#E2B84A'); R(-12, -13, 2, 1, '#C4323A'); R(-9, -14, 2, 1, '#4A7AC8'); R(-14, -11, 2, 1, '#4A8A4A');
    R(6, -18, 4, 8, INK); R(7, -17, 3, 6, '#C8C0B0'); R(7, -11, 3, 2, '#C49A78');
    R(-5, -27, 10, 9, INK);
    R(-4, -26, 8, 7, '#C49A78');
    R(1, -26, 3, 7, '#E6C2A0');
    R(-2, -23, 1, 1, '#1A120C'); R(1, -23, 1, 1, '#1A120C');
    R(-2, -21, 5, 1, '#2A1A10');
    R(-5, -25, 1, 4, '#2A1A10'); R(4, -25, 1, 4, '#2A1A10');
    R(-7, -31, 13, 6, INK);
    R(-6, -30, 11, 4, '#8A2E2E');
    R(0, -30, 5, 4, '#C8403A');
    R(-6, -27, 12, 1, '#5A1A1A');
    R(2, -33, 3, 3, INK); R(3, -32, 1, 1, '#8A2E2E');
  }
  function paintHearth(R) {
    var r, c, k;
    sh(R, 0, 0, 18, 2);
    R(-17, -29, 34, 29, INK);
    R(-16, -25, 32, 24, '#5A524A');
    for (r = 0; r < 6; r++) for (c = -16; c < 16; c += 8) {
      k = Math.floor(RA().hash(c + r * 5, r, 3) * 3);
      R(c + (r & 1 ? 4 : 0), -25 + r * 4, 7, 3, ['#3A3430', '#5A524A', '#7A7268'][k]);
      R(c + (r & 1 ? 4 : 0), -25 + r * 4, 7, 1, '#8A8278');
    }
    R(-17, -29, 34, 4, '#5A3418'); R(-17, -29, 34, 1, '#8A5A32'); R(-17, -26, 34, 1, '#3A2418');
    R(-10, -22, 20, 20, INK);
    R(-9, -21, 18, 19, '#1A0E08');
    R(-9, -8, 18, 6, '#3A1408');
    R(-7, -5, 14, 3, '#3A2418'); R(-7, -5, 14, 1, '#6A4020');
    R(-5, -7, 10, 2, '#4A2E18'); R(-5, -7, 10, 1, '#6A4020');
    R(-4, -3, 8, 1, '#8A2A10');
    R(-16, -3, 32, 3, '#3A3430'); R(-16, -3, 32, 1, '#7A7268');
  }
  function paintEasel(R) {
    var i, x, my;
    sh(R, 0, 0, 9, 2);
    for (i = 0; i < 18; i++) {
      x = Math.floor(i * 6 / 17);
      R(-3 - x, -19 + i, 4, 1, INK); R(-2 - x, -19 + i, 2, 1, '#6B3E22');
      R(x, -19 + i, 4, 1, INK); R(1 + x, -19 + i, 2, 1, '#8A5A32');
    }
    R(0, -16, 2, 15, INK); R(0, -16, 2, 14, '#6B3E22');
    R(-8, -26, 16, 15, INK);
    R(-7, -25, 14, 13, '#F3E6C8');
    R(-7, -25, 14, 6, '#BFD8F0');
    for (i = 0; i < 7; i++) R(-1 - i, -23 + i, 2 * i + 1, 1, '#6A7A9A');
    R(-7, -16, 14, 2, '#6A7A9A');
    for (i = 0; i < 4; i++) R(3 - i, -22 + i, 2 * i + 1, 1, '#8A9AB8');
    R(-1, -23, 2, 1, '#F0F4FF'); R(-2, -22, 4, 1, '#F0F4FF');
    R(-7, -14, 14, 2, '#4A6A4A');
    R(-7, -25, 14, 1, '#FFFFFF');
    R(-9, -11, 18, 2, '#8A5A32'); R(-9, -11, 18, 1, '#C49060'); R(-9, -9, 18, 1, INK);
  }
  function paintPot(R) {
    sh(R, 0, 0, 6, 1);
    R(-5, -10, 10, 2, INK);
    R(-6, -11, 12, 3, INK); R(-5, -10, 10, 2, '#B85A40'); R(-5, -10, 10, 1, '#D88A6A');
    R(-5, -8, 10, 8, INK);
    R(-4, -8, 8, 6, '#8C3A28'); R(-4, -8, 3, 6, '#5A2418'); R(2, -8, 2, 6, '#B85A40');
    R(-3, -2, 6, 2, '#5A2418');
    R(-2, -10, 3, 1, '#3A6EA5');
    R(2, -14, 1, 5, INK); R(3, -14, 1, 4, '#6B3E22'); R(2, -15, 2, 1, '#C4323A');
  }
  function paintWork(evil) {
    return function (R) {
      var i;
      sh(R, 0, 0, 10, 2);
      R(-9, -12, 18, 2, INK); R(-8, -11, 16, 1, '#6B3E22');
      R(-9, -10, 3, 10, INK); R(-8, -10, 1, 9, '#8A5A32'); R(-7, -10, 1, 9, '#6B3E22');
      R(6, -10, 3, 10, INK); R(7, -10, 1, 9, '#6B3E22'); R(8, -10, 1, 9, '#4A2A14');
      R(-10, -33, 20, 22, INK);
      R(-9, -32, 18, 20, '#C89A1A');
      R(-9, -32, 18, 1, '#FFE35A'); R(-9, -32, 1, 20, '#FFE35A');
      R(-9, -13, 18, 1, '#6A4A10'); R(8, -32, 1, 20, '#6A4A10');
      R(-7, -30, 14, 16, INK);
      if (!evil) {
        R(-6, -29, 12, 5, '#7FB8E8'); R(-6, -24, 12, 5, '#A8D4F4'); R(-6, -19, 12, 1, '#D8ECFA');
        RA().blob(R, 2, -26, 3, 3, '#FFE35A'); RA().blob(R, 2, -26, 1, 1, '#FFF6B0');
        R(-5, -25, 5, 2, '#FFFFFF'); R(-6, -24, 7, 1, '#FFFFFF'); R(-5, -23, 5, 1, '#C8DCF0');
        R(1, -21, 4, 1, '#FFFFFF'); R(2, -20, 3, 1, '#C8DCF0');
        R(-6, -18, 12, 4, '#E8C85A'); R(-6, -18, 12, 1, '#FFF2A0'); R(-6, -15, 12, 1, '#B8941A');
        R(-2, -17, 2, 1, '#FFF2A0');
      } else {
        R(-6, -29, 12, 5, '#5A0A14'); R(-6, -24, 12, 5, '#8A1424'); R(-6, -19, 12, 3, '#B02838');
        for (i = 0; i < 12; i++) R(-1 - (i >> 2), -29 + i, 2 + 2 * (i >> 2), 1, '#0A0608');
        R(-1, -29, 1, 8, '#3A1018');
        R(-6, -17, 12, 3, '#1A0A0C'); R(-6, -17, 12, 1, '#3A1018');
        R(3, -22, 2, 2, '#FF8A30'); R(3, -22, 1, 1, '#FFD060');
        R(-5, -26, 1, 1, '#FF8A30');
      }
    };
  }
  function pic(key, w, h, ax, ay, fn, g, d) {
    var ra = RA(), s;
    if (!ra) return null;
    s = ra.sprite(key, w, h, ax, ay, fn);
    ra.blit(g, s, d, 0, 0);
    return s;
  }
  function drawPainter(g, e, d) {
    var S = d.S || 1, x = d.sx | 0, y = d.sy | 0, up, ra, s;
    pix(g);
    ra = RA();
    if (!ra) return;
    s = ra.sprite('vzi:painter', 36, 36, 18, 34, paintPainter);
    ra.blit(g, s, d, 0, 0);
    if (!s) return;
    up = reducedNow() ? 0 : ((d.now / 500) | 0) & 1;
    box(g, '#6B3E22', x + 10 * S, y - (19 + up) * S, S, 6 * S);
    box(g, '#C4323A', x + 10 * S, y - (21 + up) * S, S, 2 * S);
  }
  function drawWork(g, e, d) {
    var evil = e.path === 'evil';
    pix(g);
    pic(evil ? 'vzi:work:evil' : 'vzi:work:heaven', 24, 36, 12, 35, paintWork(evil), g, d);
  }
  function drawHearth(g, e, d) {
    var S = d.S || 1;
    pix(g);
    if (!pic('vzi:hearth', 40, 32, 20, 30, paintHearth, g, d)) return;
    if (RA().flame) RA().flame(g, d.sx | 0, (d.sy | 0) - 4 * S, S, 2, d.now / 4, 3);
  }
  function drawEasel(g, e, d) {
    pix(g);
    pic('vzi:easel', 24, 30, 12, 28, paintEasel, g, d);
  }
  function drawPot(g, e, d) {
    pix(g);
    pic('vzi:pot', 16, 18, 8, 16, paintPot, g, d);
  }

  /* the tavern: one baked room paint under everything */
  function paintTavern(R, g) {
    var x, y, k, i, hs = RA().hash, tone, ln, off;
    var BOARD = ['#6B4228', '#5E3A22', '#744A2C'];
    function glowAt(cx, cy, col, rad, al) {
      for (i = 0; i < rad.length; i++) { g.globalAlpha = al[i]; RA().blob(R, cx, cy, rad[i], Math.round(rad[i] * 0.8), col); }
      g.globalAlpha = 1;
    }
    R(0, 0, 352, 160, '#120A06');
    /* back wall */
    R(0, 0, 352, 18, '#3A2A20');
    for (i = 0; i < 70; i++) R((hs(i, 1, 1) * 350) | 0, (hs(i, 2, 1) * 16) | 0, 2, 1, '#4A3426');
    R(0, 0, 352, 4, '#2A1810'); R(0, 4, 352, 1, '#4A2E1C');
    for (x = 0; x < 352; x += 88) { R(x, 0, 6, 18, '#2A1810'); R(x + 1, 4, 1, 14, '#4A2E1C'); R(x + 5, 4, 1, 14, '#1A0E08'); }
    R(0, 17, 352, 2, '#8A5A32'); R(0, 19, 352, 1, '#3A2418');
    for (x = 0; x < 352; x += 8) {
      k = (x >> 3) % 3;
      R(x, 20, 8, 10, ['#5A3418', '#4A2A14', '#6B4226'][k]);
      R(x, 20, 1, 10, '#2A1810');
      R(x + 1, 20, 1, 10, k === 2 ? '#8A5A32' : '#6B4226');
    }
    R(0, 30, 352, 2, '#2A1810');
    /* side walls and the front wall */
    for (x = 0; x < 2; x++) {
      for (y = 32; y < 128; y += 8) {
        R(x ? 320 : 0, y, 32, 8, hs(x, y, 4) < 0.5 ? '#4A2A14' : '#5A3418');
        R(x ? 320 : 0, y + 7, 32, 1, '#2A1810');
      }
    }
    R(30, 32, 2, 96, '#8A5A32'); R(28, 32, 2, 96, '#3A2418');
    R(320, 32, 2, 96, '#2A1810'); R(322, 32, 2, 96, '#3A2418');
    R(0, 128, 352, 32, '#2A1810');
    for (x = 0; x < 352; x += 16) R(x, 130 + (x & 16 ? 0 : 6), 15, 8, '#32200F');
    R(0, 128, 352, 2, '#8A5A32'); R(0, 130, 352, 1, '#3A2418');
    /* floor boards */
    for (y = 32, ln = 0; y < 128; y += 8, ln++) {
      off = (ln * 17) % 48;
      for (x = 32 - off; x < 320; x += 48) {
        k = Math.floor(hs(x, y, 5) * 3);
        tone = BOARD[k];
        R(Math.max(32, x), y, Math.min(320, x + 48) - Math.max(32, x), 7, tone);
        R(Math.max(32, x), y, Math.min(320, x + 48) - Math.max(32, x), 1, k === 2 ? '#8A5A32' : '#7A4E2C');
        if (x >= 32) { R(x, y, 1, 8, '#2A1810'); R(x + 3, y + 3, 1, 1, '#2A1810'); }
        if (hs(x, y, 9) < 0.18) R(x + 14 + ((hs(x, y, 2) * 20) | 0), y + 3, 3, 2, '#4A2A14');
      }
      R(32, y + 7, 288, 1, '#2A1810');
    }
    /* contact shadows under the walls */
    g.globalAlpha = 0.4;
    R(32, 32, 288, 4, '#000000');
    R(32, 124, 288, 4, '#000000');
    g.globalAlpha = 0.25;
    R(32, 36, 288, 3, '#000000');
    R(32, 32, 4, 96, '#000000'); R(316, 32, 4, 96, '#000000');
    g.globalAlpha = 1;
    /* the rug */
    R(120, 54, 112, 54, '#2A0A0E');
    R(121, 55, 110, 52, '#C8A040');
    R(123, 57, 106, 48, '#2A0A0E');
    R(124, 58, 104, 46, '#6A1C20');
    for (y = 0; y < 46; y += 6) for (x = 0; x < 104; x += 8) {
      if (((x >> 3) + (y / 6)) & 1) R(124 + x + 2, 58 + y + 1, 4, 4, '#8A2A2E');
    }
    for (i = 0; i < 8; i++) { R(176 - i, 74 + i, 2 * i + 1, 1, '#C8A040'); R(176 - i, 90 - i, 2 * i + 1, 1, '#C8A040'); }
    for (i = 0; i < 5; i++) { R(176 - i, 76 + i, 2 * i + 1, 1, '#2A0A0E'); R(176 - i, 88 - i, 2 * i + 1, 1, '#2A0A0E'); }
    for (y = 54; y < 108; y += 3) { R(118, y, 2, 1, '#C8B898'); R(232, y, 2, 1, '#C8B898'); }
    /* barrel on the 'o' tile */
    R(31, 63, 18, 18, '#12081E');
    R(32, 64, 16, 16, '#6B4226');
    R(32, 64, 4, 16, '#4A2A14'); R(44, 64, 4, 16, '#8A5A32');
    R(32, 66, 16, 2, '#3A3A44'); R(32, 76, 16, 2, '#3A3A44');
    R(34, 64, 12, 3, '#8A5A32'); R(34, 64, 12, 1, '#C49060');
    /* sconces and the hearth's glow */
    for (i = 0; i < 2; i++) {
      x = i ? 256 : 96;
      glowAt(x, 24, '#FFB347', [26, 16, 8], [0.07, 0.09, 0.12]);
      R(x - 3, 16, 6, 10, '#12081E'); R(x - 2, 17, 4, 8, '#3A3A44');
      R(x - 1, 12, 2, 6, '#E8D8B0'); R(x - 1, 9, 2, 3, '#FFB347'); R(x, 8, 1, 3, '#FFF2C4');
    }
    glowAt(72, 90, '#E25822', [44, 30, 18], [0.07, 0.09, 0.1]);
  }
  K.kind('tavernfloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) {
      var ra = RA(), room, c;
      if (!ra || !ra.roomPaint) return;
      room = ra.roomOf(d);
      if (!room || !room.grid) return;
      c = ra.roomPaint(room, paintTavern);
      ra.drawPaint(g, e, d, c);
    }
  });

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
      { t: 'tavernfloor', x: 0, y: 0 },
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
  var bart = null;
  function bbake(w, h, fn) {
    var cv, g;
    try {
      cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      g = cv.getContext('2d');
      if (!g) return null;
      g.imageSmoothingEnabled = false;
      fn(g);
      return cv;
    } catch (e) { return null; }
  }
  function rr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function bblob(g, cx, cy, rx, ry, c) {
    var y, k, hw;
    for (y = -ry; y <= ry; y++) {
      k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      if (k <= 0) continue;
      hw = Math.round(rx * Math.sqrt(k));
      rr(g, cx - hw, cy + y, hw * 2 + 1, 1, c);
    }
  }
  function line(g, x0, y0, x1, y1, wd, col) {
    var dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy)) | 0, i, x, y, half = wd >> 1;
    if (n < 1) n = 1;
    g.fillStyle = col;
    for (i = 0; i <= n; i++) {
      x = Math.round(x0 + dx * (i / n)); y = Math.round(y0 + dy * (i / n));
      g.fillRect(x - half, y - half, wd, wd);
    }
  }
  function strike(g, pts, wGlow, wCore, hot) {
    var i;
    g.globalAlpha = 1;
    for (i = 2; i < pts.length; i += 2) line(g, pts[i - 2], pts[i - 1], pts[i], pts[i + 1], wGlow, '#4FC3F7');
    for (i = 2; i < pts.length; i += 2) line(g, pts[i - 2], pts[i - 1], pts[i], pts[i + 1], wCore, '#D8ECFF');
    if (hot) for (i = 2; i < pts.length; i += 2) line(g, pts[i - 2], pts[i - 1], pts[i], pts[i + 1], 1, '#FFFFFF');
  }
  function forks(pts) {
    var out = [], joints = [3, 7, 11], j, s = 77, f, x, y, n, dir, k;
    for (j = 0; j < joints.length; j++) {
      f = [pts[joints[j] * 2], pts[joints[j] * 2 + 1]];
      x = f[0]; y = f[1];
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      dir = (s & 1) ? 1 : -1;
      n = 3 + (s % 2);
      for (k = 0; k < n; k++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        x += dir * (8 + (s % 10));
        y += 10 + (s % 10);
        f.push(x, y);
      }
      out.push(f);
    }
    return out;
  }
  function cloudLayer(g, lit) {
    var i, cx, cy, rx, ry;
    for (i = 0; i < 12; i++) {
      cx = i * 58 + 8 + ((i * 37) % 23); cy = 6 + ((i * 53) % 22); rx = 44 + ((i * 29) % 20); ry = 14 + ((i * 17) % 10);
      bblob(g, cx, cy, rx, ry, '#14141C');
      bblob(g, cx - 4, cy - 4, rx - 12, ry - 5, '#22222E');
      bblob(g, cx - 8, cy - 8, rx - 28, ry - 9, '#3A3A4A');
      if (lit) { rr(g, cx - rx + 8, cy + ry - 1, (rx - 8) * 2, 2, '#6A7A9A'); rr(g, cx - rx + 20, cy + ry - 3, (rx - 20) * 2, 2, '#4A5470'); }
    }
  }
  function boltArt() {
    var pts;
    if (bart) return bart;
    pts = boltPts();
    bart = {
      bg: bbake(640, 360, function (g) {
        var x, i, hgt;
        rr(g, 0, 0, 640, 360, '#0A0A12');
        rr(g, 0, 90, 640, 90, '#0E0E18'); rr(g, 0, 180, 640, 90, '#12121C'); rr(g, 0, 270, 640, 90, '#181824');
        for (x = 0; x < 640; x += 16) { hgt = 40 + ((x * 7) % 31) + (x > 200 && x < 420 ? 20 : 0); rr(g, x, 330 - hgt, 16, hgt + 30, '#0A0A10'); }
        for (x = 0; x < 640; x += 16) { hgt = 14 + ((x * 11) % 17); rr(g, x, 350 - hgt, 16, hgt + 10, '#050508'); }
      }),
      clouds: bbake(640, 64, function (g) { cloudLayer(g, false); }),
      lit: bbake(640, 64, function (g) { cloudLayer(g, true); }),
      bolt: bbake(640, 360, function (g) {
        var fk = forks(pts), i;
        strike(g, pts, 6, 2, true);
        for (i = 0; i < fk.length; i++) strike(g, fk[i], 4, 1, false);
      })
    };
    return bart;
  }
  function drawBolt() {
    var cv = document.getElementById('boltCanvas');
    var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    var w = 640, h = 360, i, reduce = reducedNow(), a, flashNow, lit, y, s;
    if (!ctx) return;
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    pix(ctx);
    ctx.globalAlpha = 1;
    a = boltArt();
    ctx.fillStyle = '#0A0A0C';
    ctx.fillRect(0, 0, w, h);
    if (ctx.drawImage) {
      if (a.bg) ctx.drawImage(a.bg, 0, 0);
      lit = !reduce && t >= 0.36 && t < 0.48;
      if (lit ? a.lit : a.clouds) ctx.drawImage(lit ? a.lit : a.clouds, 0, 0);
      if (a.bolt) ctx.drawImage(a.bolt, 0, 0);
    } else {
      /* no offscreen blits: the bolt still has to read */
      strike(ctx, boltPts(), 6, 2, true);
    }
    ctx.fillStyle = '#3A4A6A';
    s = 12345;
    for (i = 0; i < 40; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      y = ((s % 360) + (reduce ? 0 : t * 300)) % 360;
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      ctx.fillRect(s % 640, y | 0, 1, 6);
    }
    if (reduce) {
      ctx.globalAlpha = t >= 0.4 ? 1 : t / 0.4;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      return;
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
