/* rooms-s.js — the sand path and the savanna village.
   The alley garage (rooms-d.js) opens onto s0_sand once the photo
   flag is set.    The path is 360 floor tiles: 60 s at the engine's
   96 px/s. Past it, fifteen rooms, three block puzzles and three
   short games. Puzzles are block, plate and brazier data. The games
   are kernel scenes and read keys through NEU.keys. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (!NEU.engine || !NEU.engine.register) return;
  var E = NEU.engine;

  E.tileset('savanna', {
    solid: '#',
    colours: { '#': '#8A5A28', '.': '#E2B84A', ',': '#C47A32', '=': '#A86828' }
  });
  E.tileset('station', {
    solid: '#',
    colours: { '#': '#2A2118', '.': '#3A2A1C', ',': '#5A4030', '=': '#1A1410' }
  });

  function say(c, lines) { c.say(lines, 'narr'); }
  function keyName(def) { return NEU.keys ? NEU.keys.label(def) : def; }

  function box(w, h) {
    var rows = [], y, x, s;
    for (y = 0; y < h; y++) {
      s = '';
      for (x = 0; x < w; x++) s += (y === 0 || x === 0 || y === h - 1 || x === w - 1) ? '#' : '.';
      rows.push(s);
    }
    return rows.join('\n');
  }
  function sandTiles() {
    var rows = [], y, x, s, ch;
    for (y = 0; y < 10; y++) {
      s = '';
      for (x = 0; x < 362; x++) {
        if (y === 0 || y === 9 || x === 0 || x === 361) ch = '#';
        else if (y >= 4 && y <= 6) ch = ',';
        else ch = '.';
        s += ch;
      }
      rows.push(s);
    }
    return rows.join('\n');
  }
  function spawn(dir) {
    if (dir === 'west') return { x: 1, y: 4, face: 'right' };
    if (dir === 'east') return { x: 9, y: 4, face: 'left' };
    if (dir === 'north') return { x: 5, y: 1, face: 'down' };
    return { x: 5, y: 7, face: 'up' };
  }
  function sp() {
    var o = {}, i;
    for (i = 0; i < arguments.length; i++) o[arguments[i]] = spawn(arguments[i]);
    return o;
  }
  function gate(dir, to, spawnName, extra) {
    var e = { t: 'exit', to: to, spawn: spawnName, style: 'arch' };
    if (dir === 'west') { e.x = 0; e.y = 4; }
    else if (dir === 'east') { e.x = 10; e.y = 4; }
    else if (dir === 'north') { e.x = 5; e.y = 0; }
    else { e.x = 5; e.y = 8; }
    var k;
    for (k in extra || {}) e[k] = extra[k];
    return e;
  }
  function prop(v, x, y) { return { t: 'savannaprop', v: v, x: x, y: y }; }
  function dress(ents) {
    return [{ t: 'savannafloor', x: 0, y: 0 }, { t: 'savannafx', x: 5, y: 8 }].concat(ents);
  }
  /* Lockdown is a flag, read when the room is entered. chase.js
     swaps the entity list. The exo rooms are not the village. */
  function room(id, def) {
    var r = E.register(id, def);
    if (NEU.chase && NEU.chase.bind) NEU.chase.bind(r);
    return r;
  }
  function addBox(id, spawns, ents, enter) {
    room(id, {
      tileset: 'savanna',
      tiles: box(11, 9),
      spawns: spawns,
      entities: dress(ents),
      onEnter: enter || null
    });
  }

  /* ── kernel minigames ──────────────────────────────────────────── */
  function routed(e) {
    var key = e.key || '';
    if (NEU.keys && NEU.keys.route) {
      var r = NEU.keys.route(key, null);
      if (r.swallow) return '';
      key = r.to || key;
    }
    if (key.length === 1) key = key.toLowerCase();
    return key;
  }
  function mount(id, hint, bg) {
    var boxEl = document.createElement('div');
    boxEl.id = id;
    boxEl.setAttribute('role', 'dialog');
    boxEl.style.position = 'fixed';
    boxEl.style.left = '0';
    boxEl.style.top = '0';
    boxEl.style.right = '0';
    boxEl.style.bottom = '0';
    boxEl.className = 'kernel-play';
    boxEl.style.zIndex = '76';
    boxEl.style.display = 'flex';
    boxEl.style.flexDirection = 'column';
    boxEl.style.alignItems = 'center';
    boxEl.style.justifyContent = 'center';
    boxEl.style.background = bg || '#12081E';
    var cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 192;
    var k = Math.max(1, Math.floor(Math.min((window.innerWidth || 1280) / 320, (window.innerHeight || 720) * 0.9 / 192)));
    cv.style.display = 'block';
    cv.style.width = (320 * k) + 'px';
    cv.style.aspectRatio = '5 / 3';
    cv.style.imageRendering = 'pixelated';
    var cap = document.createElement('p');
    cap.style.margin = '8px 0 0';
    cap.style.padding = '8px';
    cap.style.fontSize = '16px';
    cap.style.fontFamily = '"Determination Mono", monospace';
    cap.style.color = '#EDE7DE';
    cap.style.background = '#08080B';
    cap.textContent = hint;
    boxEl.appendChild(cv);
    boxEl.appendChild(cap);
    document.body.appendChild(boxEl);
    var g = cv.getContext('2d');
    if (g) g.imageSmoothingEnabled = false;
    return { box: boxEl, g: g };
  }
  function win(flag, close) {
    if (NEU.save) NEU.save.flag(flag, 1);
    if (NEU.juice) NEU.juice.hit('small');
    close();
  }


  /* ── minigame art: one woven-mat backdrop, baked once per game ───── */
  var INKC = '#12081E';
  var gR = null;
  function Rf(x, y, w, h, c) { gR.fillStyle = c; gR.fillRect(x, y, w, h); }
  function blobG(g, cx, cy, rx, ry, c) {
    gR = g;
    if (NEU.roomArt && NEU.roomArt.blob) NEU.roomArt.blob(Rf, cx, cy, rx, ry, c);
    else Rf(cx - rx, cy - ry, rx * 2 + 1, ry * 2 + 1, c);
  }
  function calm() {
    if (NEU.motion && NEU.motion.reduced) return !!NEU.motion.reduced();
    try { return !!matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0; }
  function mkCv(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  var mats = {};
  function mat(kind) {
    if (mats[kind]) return mats[kind];
    var cv = mkCv(320, 192), g = cv.getContext && cv.getContext('2d'), x, y, i, r, k, pal;
    mats[kind] = cv;
    if (!g) return cv;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#2A1A0C';
    g.fillRect(0, 0, 320, 192);
    g.fillStyle = INKC; g.fillRect(19, 20, 282, 152);
    /* weave: 3x3 threads on a 1px grid, two tones */
    g.fillStyle = '#5C3A18'; g.fillRect(26, 27, 268, 138);
    for (y = 0; y < 34; y++) for (x = 0; x < 67; x++) {
      g.fillStyle = ((x + y) & 1) ? '#A87038' : '#8A5A28';
      g.fillRect(26 + x * 4 + 1, 27 + y * 4 + 1, 3, 3);
      if (!((x + y) & 1)) { g.fillStyle = '#A87038'; g.fillRect(26 + x * 4 + 1, 27 + y * 4 + 1, 3, 1); }
    }
    /* geometric border, 6px, zigzag */
    pal = ['#C4323A', '#E8DCC0', '#2A1A0C', '#E8DCC0'];
    for (r = 0; r < 6; r++) {
      k = r < 3 ? r : 5 - r;
      for (x = 0; x < 280; x++) {
        g.fillStyle = pal[((x + k * 2) >> 2) & 3];
        g.fillRect(20 + x, 21 + r, 1, 1);
        g.fillRect(20 + x, 21 + 144 + r, 1, 1);
      }
      for (y = 6; y < 144; y++) {
        g.fillStyle = pal[((y + k * 2) >> 2) & 3];
        g.fillRect(20 + r, 21 + y, 1, 1);
        g.fillRect(20 + 274 + r, 21 + y, 1, 1);
      }
    }
    g.fillStyle = INKC;
    g.fillRect(20, 26, 280, 1); g.fillRect(20, 21 + 143, 280, 1);
    /* the room around it falls away in three steps */
    g.fillStyle = '#000000';
    for (i = 0; i < 3; i++) {
      g.globalAlpha = 0.3 - i * 0.1;
      g.fillRect(i * 8, i * 8, 320 - i * 16, 8);
      g.fillRect(i * 8, 184 - i * 8, 320 - i * 16, 8);
      g.fillRect(i * 8, i * 8 + 8, 8, 176 - i * 16);
      g.fillRect(312 - i * 8, i * 8 + 8, 8, 176 - i * 16);
    }
    g.globalAlpha = 1;
    if (kind === 'beads') {
      g.fillStyle = '#12081E';
      for (x = 46; x <= 274; x++) g.fillRect(x, cordY(x) + 1, 1, 1);
      g.fillStyle = '#3A2410';
      for (x = 46; x <= 274; x++) g.fillRect(x, cordY(x), 1, 1);
      g.fillStyle = '#A87038';
      for (x = 48; x <= 272; x += 3) g.fillRect(x, cordY(x) - 1, 1, 1);
      for (i = 0; i < 2; i++) {
        x = i ? 272 : 40;
        g.fillStyle = INKC; g.fillRect(x - 1, 65, 6, 8);
        g.fillStyle = '#5C3A18'; g.fillRect(x, 66, 4, 6);
        g.fillStyle = '#8A5A28'; g.fillRect(x, 66, 1, 6);
      }
    }
    if (kind === 'wind') {
      g.fillStyle = INKC; g.fillRect(38, 55, 7, 78);
      g.fillStyle = '#5C3A18'; g.fillRect(39, 56, 5, 76);
      g.fillStyle = '#8A5A28'; g.fillRect(39, 56, 2, 76);
      g.fillStyle = '#E8DCC0'; g.fillRect(38, 52, 7, 3);
      g.fillStyle = '#E8DCC0';
      for (y = 62; y < 126; y += 6) g.fillRect(270, y, 1, 3);
    }
    return cv;
  }
  function cordY(x) {
    var u = (x - 160) / 114;
    return 76 + Math.round(14 * (1 - u * u));
  }
  var RAMPS = [['#5A1018', '#B02838', '#E85A5A'], ['#14284A', '#2E5A8F', '#8AB0FF'], ['#6A4A08', '#C89A1A', '#FFE35A']];
  function bead(g, cx, cy, rx, ry, ramp) {
    blobG(g, cx, cy, rx + 1, ry + 1, INKC);
    blobG(g, cx, cy, rx, ry, ramp[0]);
    blobG(g, cx - 1, cy - 1, rx - 1, ry - 1, ramp[1]);
    blobG(g, cx - 2, cy - 2, Math.max(1, rx - 3), Math.max(1, ry - 3), ramp[2]);
    g.fillStyle = '#FFFFFF';
    g.fillRect(cx - rx + 3, cy - ry + 2, 2, 2);
  }
  /* a dashed pixel ring where a bead is still missing */
  function ring(g, cx, cy, r) {
    var a, x, y;
    g.fillStyle = '#5C3A18';
    for (a = 0; a < 32; a += 2) {
      x = cx + Math.round(Math.cos(a / 32 * 6.2832) * r);
      y = cy + Math.round(Math.sin(a / 32 * 6.2832) * r);
      g.fillRect(x, y, 1, 1);
    }
  }
  function cowrie(g, cx, cy, up) {
    var i;
    g.fillStyle = '#000000';
    g.globalAlpha = 0.3; g.fillRect(cx - 12, cy + 9, 24, 2);
    g.globalAlpha = 0.18; g.fillRect(cx - 9, cy + 11, 18, 1);
    g.globalAlpha = 1;
    cy -= up;
    blobG(g, cx, cy, 14, 9, INKC);
    blobG(g, cx, cy, 13, 8, '#A89878');
    blobG(g, cx - 1, cy - 1, 12, 7, '#C8B898');
    blobG(g, cx - 2, cy - 2, 9, 4, '#E8DCC0');
    g.fillStyle = '#3A2410'; g.fillRect(cx - 9, cy, 18, 2);
    g.fillStyle = '#E8DCC0';
    for (i = -8; i < 9; i += 2) { g.fillRect(cx + i, cy - 1, 1, 1); g.fillRect(cx + i, cy + 2, 1, 1); }
    g.fillStyle = '#FFFFFF'; g.fillRect(cx - 8, cy - 6, 4, 1);
  }
  function pea(g, cx, cy) {
    blobG(g, cx, cy, 4, 4, INKC);
    blobG(g, cx, cy, 3, 3, '#5A5A1E');
    blobG(g, cx - 1, cy - 1, 2, 2, '#A89A3A');
    g.fillStyle = '#E6D27A'; g.fillRect(cx - 2, cy - 2, 1, 1);
  }
  /* grass in three layers, four sway poses, baked */
  var grassV = null;
  function grass() {
    if (grassV) return grassV;
    var cols = ['#5A5A1E', '#7A7A2A', '#A89A3A'], step = [6, 5, 4], hh = [14, 18, 22];
    var sway = [-1, 0, 1, 0], out = [], l, v, cv, g, x, h, sh, base = 40;
    for (l = 0; l < 3; l++) {
      out.push([]);
      for (v = 0; v < 4; v++) {
        cv = mkCv(268, 40); out[l].push(cv);
        g = cv.getContext && cv.getContext('2d');
        if (!g) continue;
        for (x = 0; x < 268; x += step[l]) {
          h = hh[l] - 4 + ((((x * 7 + l * 13) % 9)) | 0);
          sh = sway[(v + (x >> 3)) & 3] * (l + 1 > 2 ? 2 : 1);
          g.fillStyle = cols[l];
          g.fillRect(x, base - (h >> 1), 2, h >> 1);
          g.fillRect(x + sh, base - h, 2, h - (h >> 1));
          if (l === 2) { g.fillStyle = '#E6D27A'; g.fillRect(x + sh, base - h, 1, 1); }
        }
      }
    }
    grassV = out;
    return out;
  }

  var beadsOn = false, beadN = 0, beadUi = null, beadOff = null;
  function beadClose() {
    beadsOn = false;
    if (NEU.activeMinigame === 's_beads') NEU.activeMinigame = null;
    if (beadOff) beadOff();
    beadOff = null;
    if (beadUi && beadUi.box.parentNode) beadUi.box.parentNode.removeChild(beadUi.box);
    beadUi = null;
    if (NEU.kernel && NEU.kernel.current() === 's_beads') NEU.kernel.pop();
  }
  var beadAnim = null;
  function beadPaint() {
    if (!beadUi || !beadUi.g) return;
    var g = beadUi.g, i, cx, cy, f, rx = 6, ry = 6, el;
    g.drawImage(mat('beads'), 0, 0);
    for (i = 0; i < 3; i++) {
      cx = 100 + i * 60; cy = cordY(cx) + 6;
      if (i >= beadN) { ring(g, cx, cy, 7); continue; }
      rx = 6; ry = 6;
      if (beadAnim && beadAnim.i === i && !calm()) {
        el = nowMs() - beadAnim.t;
        if (el < 70) { rx = 7; ry = 5; } else if (el < 140) { rx = 6; ry = 6; cy -= 1; } else beadAnim = null;
      }
      bead(g, cx, cy, rx, ry, RAMPS[i]);
    }
  }
  function beadKey(e) {
    if (!beadsOn || e.type !== 'keydown') return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    if (routed(e) !== 'z' || e.repeat) return;
    beadN += 1;
    beadAnim = { i: beadN - 1, t: nowMs() };
    if (NEU.juice && NEU.juice.burst && beadUi) {
      var rr = beadUi.box.querySelector('canvas').getBoundingClientRect();
      NEU.juice.burst(rr.left + (100 + (beadN - 1) * 60) / 320 * rr.width, rr.top + (cordY(100 + (beadN - 1) * 60) + 6) / 192 * rr.height, 6, RAMPS[beadN - 1][2], 110);
    }
    beadPaint();
    if (beadN >= 3) win('s_beads', beadClose);
  }
  if (NEU.kernel) NEU.kernel.register('s_beads', {
    open: function () {
      if (beadsOn) return;
      beadsOn = true;
      beadN = 0;
      NEU.activeMinigame = 's_beads';
      beadUi = mount('sBeads', keyName('z'));
      beadOff = function () {
        removeEventListener('keydown', beadKey);
      };
      addEventListener('keydown', beadKey);
      beadPaint();
      if (NEU.kernel.current() !== 's_beads') NEU.kernel.push('s_beads');
    },
    close: beadClose,
    running: function () { return beadsOn; },
    tick: function () { if (beadsOn) beadPaint(); }
  });

  var shellOn = false, shellSel = 0, shellUi = null, shellOff = null;
  function shellClose() {
    shellOn = false;
    if (NEU.activeMinigame === 's_shells') NEU.activeMinigame = null;
    if (shellOff) shellOff();
    shellOff = null;
    if (shellUi && shellUi.box.parentNode) shellUi.box.parentNode.removeChild(shellUi.box);
    shellUi = null;
    if (NEU.kernel && NEU.kernel.current() === 's_shells') NEU.kernel.pop();
  }
  function shellPaint() {
    if (!shellUi || !shellUi.g) return;
    var g = shellUi.g, i, cx, up, t;
    g.drawImage(mat('shells'), 0, 0);
    t = calm() ? 0 : ((nowMs() / 300) | 0) & 1;
    pea(g, 160, 118);
    for (i = 0; i < 3; i++) {
      cx = 80 + i * 80;
      up = i === shellSel ? 6 + t : 0;
      cowrie(g, cx, 96, up);
      if (i === shellSel) {
        g.fillStyle = INKC; g.fillRect(cx - 5, 62 - t, 11, 1); g.fillRect(cx - 4, 63 - t, 9, 1); g.fillRect(cx - 3, 64 - t, 7, 1); g.fillRect(cx - 1, 65 - t, 3, 1);
        g.fillStyle = '#FFE35A'; g.fillRect(cx - 4, 62 - t, 9, 1); g.fillRect(cx - 3, 63 - t, 7, 1); g.fillRect(cx - 2, 64 - t, 5, 1); g.fillRect(cx, 65 - t, 1, 1);
      }
    }
  }
  function shellKey(e) {
    if (!shellOn || e.type !== 'keydown') return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    var k = routed(e);
    if (k === 'a' && shellSel > 0) shellSel -= 1;
    if (k === 'd' && shellSel < 2) shellSel += 1;
    if (k === 'z' && !e.repeat) {
      if (shellSel === 1) win('s_shells', shellClose);
      else if (NEU.juice) NEU.juice.hit('small');
    }
    shellPaint();
  }
  if (NEU.kernel) NEU.kernel.register('s_shells', {
    open: function () {
      if (shellOn) return;
      shellOn = true;
      shellSel = 0;
      NEU.activeMinigame = 's_shells';
      shellUi = mount('sShells', keyName('a') + ' ' + keyName('d') + ' ' + keyName('z'));
      shellOff = function () { removeEventListener('keydown', shellKey); };
      addEventListener('keydown', shellKey);
      shellPaint();
      if (NEU.kernel.current() !== 's_shells') NEU.kernel.push('s_shells');
    },
    close: shellClose,
    running: function () { return shellOn; },
    tick: function () { if (shellOn) shellPaint(); }
  });

  var windOn = false, windHeld = false, windCharge = 0, windUi = null, windOff = null;
  function windClose() {
    windOn = false;
    windHeld = false;
    if (NEU.activeMinigame === 's_wind') NEU.activeMinigame = null;
    if (windOff) windOff();
    windOff = null;
    if (windUi && windUi.box.parentNode) windUi.box.parentNode.removeChild(windUi.box);
    windUi = null;
    if (NEU.kernel && NEU.kernel.current() === 's_wind') NEU.kernel.pop();
  }
  function windPaint() {
    if (!windUi || !windUi.g) return;
    var g = windUi.g, G = grass(), v, l, len, x, y, pose;
    len = Math.max(0, Math.min(220, (windCharge / 1.5) * 220)) | 0;
    pose = calm() ? 0 : ((nowMs() / 300) | 0);
    g.drawImage(mat('wind'), 0, 0);
    g.drawImage(G[0][pose & 3], 26, 121);
    for (x = 0; x < len; x += 4) {
      y = 66 + (calm() ? 0 : [0, 1, 2, 1][((x >> 2) + pose) & 3]) * (x > 8 ? 1 : 0);
      g.fillStyle = INKC; g.fillRect(45 + x, y - 1, 4, 6);
      g.fillStyle = '#E85A5A'; g.fillRect(45 + x, y, 4, 2);
      g.fillStyle = '#C4323A'; g.fillRect(45 + x, y + 2, 4, 2);
    }
    if (len > 6) { g.fillStyle = INKC; g.fillRect(45 + len, y + 1, 1, 2); }
    g.drawImage(G[1][(pose + 1) & 3], 26, 124);
    g.drawImage(G[2][(pose + 2) & 3], 26, 126);
  }
  function windKey(e) {
    if (!windOn) return;
    if (routed(e) !== 'd') return;
    windHeld = e.type === 'keydown';
  }
  if (NEU.kernel) NEU.kernel.register('s_wind', {
    open: function () {
      if (windOn) return;
      windOn = true;
      windHeld = false;
      windCharge = 0;
      NEU.activeMinigame = 's_wind';
      windUi = mount('sWind', keyName('d'));
      windOff = function () {
        removeEventListener('keydown', windKey);
        removeEventListener('keyup', windKey);
      };
      addEventListener('keydown', windKey);
      addEventListener('keyup', windKey);
      windPaint();
      if (NEU.kernel.current() !== 's_wind') NEU.kernel.push('s_wind');
    },
    close: windClose,
    running: function () { return windOn; },
    tick: function (dt) {
      if (!windOn) return;
      var sec = (dt || 0) / 1000;
      if (sec > 0.05) sec = 0.05;
      if (windHeld) windCharge += sec;
      windPaint();
      if (windCharge >= 1.5) win('s_wind', windClose);
    }
  });

  NEU.savanna = {
    open: function (name) {
      var id = name === 'beads' ? 's_beads' : name === 'shells' ? 's_shells' : name === 'wind' ? 's_wind' : name;
      var sc = NEU.kernel && NEU.kernel.scenes[id];
      if (sc && sc.open) sc.open();
    }
  };

  /* ── s0 the sand ───────────────────────────────────────────────── */
  var trees = [], ti;
  for (ti = 0; ti < 8; ti++) trees.push(prop('acacia', 24 + ti * 40, ti % 2 ? 2 : 7));
  room('s0_sand', {
    tileset: 'savanna',
    tiles: sandTiles(),
    spawns: { west: { x: 1, y: 5, face: 'right' }, east: { x: 360, y: 5, face: 'left' } },
    entities: [{ t: 'savannafloor', x: 0, y: 0 }, { t: 'savannafx', x: 1, y: 8 }]
      .concat(trees)
      .concat([
        { t: 'exit', x: 0, y: 5, to: 'd2_alley', spawn: 'garage', style: 'door' },
        { t: 'exit', x: 361, y: 5, to: 's1_gate', spawn: 'west', style: 'arch' }
      ]),
    onEnter: function (c) {
      if (c.flagged('s0_seen')) return;
      c.flag('s0_seen', 1);
      say(c, ['sand. a few trees. the wind does not hurry.',
              'the village is at the far end. it is not close.']);
    }
  });

  /* ── village ───────────────────────────────────────────────────── */
  addBox('s1_gate', sp('west', 'east', 'north', 'south'), [
    gate('west', 's0_sand', 'east'),
    gate('east', 's3_market', 'west'),
    gate('north', 's4_shade', 'south'),
    gate('south', 's2_well', 'south'),
    { t: 'save', x: 2, y: 2 },
    prop('acacia', 8, 2),
    { t: 'sign', x: 3, y: 2, lines: ['the sand is behind you. the village is ahead, and also beside.'] }
  ], function (c) {
    if (NEU.snail) NEU.snail.arrive('s1');
    if (c.flagged('s1_seen')) return;
    c.flag('s1_seen', 1);
    say(c, ['golden grass. the heat sits on it and does not blink.']);
  });

  room('s2_well', {
    tileset: 'savanna',
    tiles: ['######', '#....#', '#....#', '#....#', '######'].join('\n'),
    spawns: {
      west: { x: 1, y: 2, face: 'right' },
      east: { x: 4, y: 2, face: 'left' },
      south: { x: 3, y: 3, face: 'up' }
    },
    entities: dress([
      { t: 'block', x: 2, y: 2, push: true },
      { t: 'plate', x: 3, y: 2 },
      { t: 'exit', x: 3, y: 4, to: 's1_gate', spawn: 'south', style: 'arch' },
      { t: 'exit', x: 5, y: 2, to: 's5_baobab', spawn: 'west', locked: 'solved:s2_well', style: 'door',
        lines: ['a gate of sticks.', 'it opens when the stone sits on the plate.'] },
      { t: 'sign', x: 4, y: 1, lines: ['one stone. one plate. push it right.'] }
    ]),
    onEnter: function (c) {
      if (c.flagged('s2_seen')) return;
      c.flag('s2_seen', 1);
      say(c, ['one stone, one plate.',
              'press ' + keyName('z') + ' to push it.',
              'press ' + keyName('r') + ' if you hate the result.']);
    },
    onSolved: function (c) { c.markSolved('s2_well'); }
  });

  addBox('s3_market', sp('west', 'east', 'north'), [
    gate('west', 's1_gate', 'east'),
    gate('east', 's6_kraal', 'west'),
    gate('north', 's9_beads', 'south'),
    prop('hut', 3, 2),
    prop('stall', 8, 6),
    prop('stall', 2, 6),
    { t: 'sign', x: 7, y: 2, lines: ['mats, beads, and nothing with a price.'] }
  ], function () { if (NEU.snail) NEU.snail.arrive('s3'); });

  addBox('s4_shade', sp('south', 'east', 'north'), [
    gate('south', 's1_gate', 'north'),
    gate('east', 's7_pool', 'west'),
    gate('north', 's10_shells', 'south'),
    prop('acacia', 3, 6),
    { t: 'sign', x: 7, y: 6, lines: ['shade. the only architecture the trees agreed to.'] }
  ]);

  addBox('s5_baobab', sp('west', 'east'), [
    gate('west', 's2_well', 'east'),
    gate('east', 's8_hearth', 'west'),
    prop('baobab', 5, 2),
    { t: 'sign', x: 5, y: 6, lines: ['a tree older than the argument about who planted it.'] }
  ]);

  room('s6_kraal', {
    tileset: 'savanna',
    tiles: ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'].join('\n'),
    spawns: { west: { x: 1, y: 3, face: 'right' }, south: { x: 3, y: 5, face: 'up' } },
    entities: dress([
      { t: 'block', x: 2, y: 2, push: true },
      { t: 'plate', x: 3, y: 2 },
      { t: 'block', x: 2, y: 4, push: true },
      { t: 'plate', x: 3, y: 4 },
      { t: 'exit', x: 0, y: 3, to: 's3_market', spawn: 'east', style: 'arch' },
      { t: 'exit', x: 3, y: 6, to: 's11_elder', spawn: 'north', style: 'arch' },
      prop('kraal', 3, 1),
      { t: 'sign', x: 5, y: 3, lines: ['two stones. two plates. one push each, to the right.'] }
    ]),
    onEnter: function (c) {
      if (NEU.snail) NEU.snail.arrive('s6');
      if (c.flagged('s6_seen')) return;
      c.flag('s6_seen', 1);
      say(c, ['two lanes. the well was the lesson. this is the same lesson twice.',
              'press ' + keyName('r') + ' to put the stones back.']);
    },
    onSolved: function (c) { c.markSolved('s6_kraal'); }
  });

  addBox('s7_pool', sp('west', 'east', 'north'), [
    gate('west', 's4_shade', 'east'),
    gate('east', 's12_termite', 'west'),
    gate('north', 's13_wind', 'south'),
    prop('well', 4, 6),
    { t: 'sign', x: 7, y: 6, lines: ['a pool with no water and a great deal of mud.'] }
  ]);

  var hearth = [];
  function lightHearth(c, n) {
    var es = c.ents(), b = null, i;
    for (i = 0; i < es.length; i++) if (es[i].t === 'brazier' && es[i].n === n) b = es[i];
    if (!b || b.lit) return;
    if (hearth.length !== n) {
      for (i = 0; i < es.length; i++) if (es[i].t === 'brazier') es[i].lit = false;
      hearth = [];
      say(c, ['they go out.', 'left to right. the room is not subtle.']);
      return;
    }
    b.lit = true;
    hearth.push(n);
    if (hearth.length === 3) {
      c.flag('s8_lit', 1);
      c.check();
    }
  }
  room('s8_hearth', {
    tileset: 'savanna',
    tiles: ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'].join('\n'),
    spawns: { west: { x: 1, y: 3, face: 'right' } },
    entities: dress([
      { t: 'brazier', x: 1, y: 1, n: 0, run: function (c) { lightHearth(c, 0); } },
      { t: 'brazier', x: 3, y: 1, n: 1, run: function (c) { lightHearth(c, 1); } },
      { t: 'brazier', x: 5, y: 1, n: 2, run: function (c) { lightHearth(c, 2); } },
      { t: 'block', x: 2, y: 3, push: true },
      { t: 'plate', x: 3, y: 3 },
      { t: 'exit', x: 8, y: 3, to: 's5_baobab', spawn: 'east', style: 'arch' },
      { t: 'sign', x: 6, y: 2, lines: ['three fires, left to right, and the stone on its plate.'] }
    ]),
    solved: function (c) { return !!c.flagged('s8_lit') && !!c.entHere(3, 3, 'block'); },
    onReset: function () { hearth = []; if (NEU.save) NEU.save.flag('s8_lit', 0); },
    onSolved: function (c) { c.markSolved('s8_hearth'); },
    onEnter: function (c) {
      if (c.flagged('s8_seen')) return;
      c.flag('s8_seen', 1);
      say(c, ['light them from the left. then push the stone.',
              'press ' + keyName('r') + ' if the fires go out and you would like them to mean it.']);
    }
  });

  function gameNpc(x, y, game) {
    var flag = game === 'beads' ? 's_beads' : game === 'shells' ? 's_shells' : 's_wind';
    return { t: 'npc', x: x, y: y, colour: '#8A5A28',
      run: function (c) {
        if (c.flagged(flag)) { say(c, ['done. the village noticed, briefly.']); return; }
        if (NEU.savanna) NEU.savanna.open(game);
      } };
  }
  addBox('s9_beads', sp('south'), [
    gate('south', 's3_market', 'north'),
    gameNpc(3, 3, 'beads'),
    { t: 'sign', x: 7, y: 3, lines: ['three beads. the board names the key. press it once for each.'] }
  ]);
  addBox('s10_shells', sp('south'), [
    gate('south', 's4_shade', 'north'),
    gameNpc(3, 3, 'shells'),
    { t: 'sign', x: 7, y: 3, lines: ['three shells. the pea is under the middle one.'] }
  ]);
  addBox('s11_elder', sp('north', 'south'), [
    gate('north', 's6_kraal', 'south'),
    gate('south', 's14_station', 'north'),
    prop('hut', 5, 4),
    prop('stool', 6, 5),
    { t: 'npc', x: 4, y: 5, colour: '#5C3A18',
      lines: ['the elder is asleep in the shade.', 'the shade is doing all the work.'] }
  ], function () { if (NEU.snail) NEU.snail.arrive('s11'); });

  room('s14_station', {
    tileset: 'station',
    tiles: box(11, 9),
    spawns: sp('north'),
    entities: [
      { t: 'savannafloor', x: 0, y: 0 },
      { t: 'stationlamp', x: 4, y: 1 },
      { t: 'stationlamp', x: 6, y: 1 },
      { t: 'exit', x: 5, y: 0, to: 's11_elder', spawn: 'south', style: 'arch' },
      { t: 'npc', x: 5, y: 4, colour: '#C47A32',
        run: function () { if (NEU.snail) NEU.snail.open(); } },
      { t: 'sign', x: 3, y: 6, lines: ['the snails stop where you have already stood.'] }
    ],
    onEnter: function (c) {
      if (NEU.snail) NEU.snail.arrive('s14');
      if (c.flagged('s14_seen')) return;
      c.flag('s14_seen', 1);
      say(c, ['a stair, then dark, then a snail the size of a cart.',
              'it goes to the stops you have already seen.']);
    }
  });
  addBox('s12_termite', sp('west', 'east'), [
    gate('west', 's7_pool', 'east'),
    gate('east', 'x0_foyer', 'west'),
    prop('mound', 6, 4),
    { t: 'sign', x: 3, y: 3, lines: ['a mound. the termites are not taking visitors.'] }
  ]);
  addBox('s13_wind', sp('south'), [
    gate('south', 's7_pool', 'north'),
    gameNpc(3, 3, 'wind'),
    { t: 'sign', x: 5, y: 5, lines: ['hold the key the grass names until the line is full.'] },
    prop('acacia', 7, 3)
  ]);

  NEU.act4RoomsS = ['s0_sand', 's1_gate', 's2_well', 's3_market', 's4_shade', 's5_baobab',
    's6_kraal', 's7_pool', 's8_hearth', 's9_beads', 's10_shells', 's11_elder', 's12_termite', 's13_wind',
    's14_station'];

  /* ── mechanical house (Exo lab) ────────────────────────────────── */
  E.tileset('exo', {
    solid: '#',
    colours: { '#': '#1A1E24', '.': '#1A1E24', ',': '#12383C', '=': '#E2C04A' }
  });
  function exoHall() {
    return [
      '###########',
      '#.........#',
      '#.........#',
      '#.........#',
      '#=========#',
      '#.........#',
      '#.........#',
      '#.........#',
      '###########'
    ].join('\n');
  }
  function exoDress(ents) {
    return [{ t: 'exofloor', x: 0, y: 0 }, { t: 'exoprop', v: 'eye', x: 1, y: 2 },
      { t: 'exoprop', v: 'holo', x: 8, y: 3 }].concat(ents);
  }

  var spiralOn = false, spiralStep = 0, spiralT = 0, spiralUi = null, spiralOff = null;
  function spiralFace() {
    return NEU.exoLook ? NEU.exoLook.faceOf(spiralStep) : (spiralStep + 4) % 8;
  }
  function spiralReduced() {
    return !!(NEU.exoLook && NEU.exoLook.reduced && NEU.exoLook.reduced());
  }
  function spiralSync() {
    NEU.house.state.climb = spiralStep;
    NEU.house.state.face = spiralFace();
    NEU.house.state.t = spiralT;
    NEU.house.state.on = spiralOn;
  }
  function spiralPaint() {
    var st;
    spiralSync();
    if (!spiralUi || !spiralUi.g) return;
    st = { climb: spiralStep, face: spiralFace(), t: spiralT };
    if (NEU.exoLook && NEU.exoLook.paintSpiral) NEU.exoLook.paintSpiral(spiralUi.g, st);
    else {
      spiralUi.g.fillStyle = '#FF00FF';
      spiralUi.g.fillRect(0, 0, 160, 96);
    }
    if (st.parallax) NEU.house.state.parallax = st.parallax;
  }
  function spiralClose() {
    spiralOn = false;
    if (NEU.activeMinigame === 'x_spiral') NEU.activeMinigame = null;
    if (spiralOff) spiralOff();
    spiralOff = null;
    if (spiralUi && spiralUi.box.parentNode) spiralUi.box.parentNode.removeChild(spiralUi.box);
    spiralUi = null;
    if (NEU.house) spiralSync();
    if (NEU.kernel && NEU.kernel.current() === 'x_spiral') NEU.kernel.pop();
  }
  function spiralArrive() {
    if (NEU.save) NEU.save.flag('x_climbed', 1);
    spiralClose();
    if (NEU.engine && NEU.engine.enter) NEU.engine.enter('x2_arena', 'stair');
  }
  function spiralMove(dir) {
    if (dir < 0) {
      if (spiralStep > 0) spiralStep -= 1;
      spiralPaint();
      return;
    }
    spiralStep += 1;
    if (!spiralReduced() && NEU.juice) NEU.juice.hit('small');
    if (spiralStep >= 8) { spiralArrive(); return; }
    spiralPaint();
  }
  function spiralKey(e) {
    var k;
    if (!spiralOn || e.type !== 'keydown' || e.repeat) return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    k = routed(e);
    if (k === 'Escape') { spiralClose(); return; }
    if (k === 'w' || k === 'ArrowUp') spiralMove(1);
    else if (k === 's' || k === 'ArrowDown') spiralMove(-1);
  }
  function spiralOpen() {
    if (spiralOn) return;
    spiralOn = true;
    spiralStep = 0;
    spiralT = 0;
    NEU.activeMinigame = 'x_spiral';
    spiralUi = mount('xSpiral', keyName('w') + ' climbs, ' + keyName('s') + ' descends', '#1A1E24');
    spiralOff = function () { removeEventListener('keydown', spiralKey); };
    addEventListener('keydown', spiralKey);
    if (NEU.kernel && NEU.kernel.current() !== 'x_spiral') NEU.kernel.push('x_spiral');
    if (NEU.talk && NEU.save && !NEU.save.flagged('x_spiral_seen')) {
      NEU.save.flag('x_spiral_seen', 1);
      NEU.talk(['* the chair turns as you climb.'], 'draedon');
    }
    spiralPaint();
  }
  NEU.house = {
    open: spiralOpen,
    close: spiralClose,
    step: function (dt) {
      var sec;
      if (!spiralOn) return;
      sec = typeof dt === 'number' ? dt : 0;
      if (sec > 2) sec = sec / 1000;
      if (sec < 0) sec = 0;
      if (sec > 0.05) sec = 0.05;
      if (!spiralReduced()) spiralT += sec;
      spiralPaint();
    },
    state: { climb: 0, face: 4, t: 0, on: false, parallax: [0, 0, 0] }
  };
  if (NEU.kernel) NEU.kernel.register('x_spiral', {
    open: spiralOpen,
    close: spiralClose,
    running: function () { return spiralOn; },
    tick: function (dt) { NEU.house.step(dt); }
  });

  E.register('x0_foyer', {
    tileset: 'exo',
    tiles: exoHall(),
    spawns: sp('west', 'north'),
    entities: exoDress([
      gate('west', 's12_termite', 'east'),
      gate('north', 'x1_spiral', 'south'),
      { t: 'sign', x: 3, y: 6, lines: ['a stair. the chair at the top has already turned.'] }
    ]),
    onEnter: function (c) {
      if (c.flagged('x0_seen')) return;
      c.flag('x0_seen', 1);
      c.say(['steel, and a stair that does not trust you.',
        'something at the top is already looking down.']);
    }
  });
  E.register('x1_spiral', {
    tileset: 'exo',
    tiles: exoHall(),
    spawns: { south: { x: 5, y: 7, face: 'up' } },
    entities: exoDress([
      { t: 'exit', x: 5, y: 8, to: 'x0_foyer', spawn: 'north', style: 'stairs' }
    ]),
    onEnter: function () { if (NEU.house) NEU.house.open(); }
  });
  E.register('x2_arena', {
    tileset: 'exo',
    tiles: exoHall(),
    spawns: { stair: { x: 5, y: 7, face: 'up' }, south: { x: 5, y: 7, face: 'up' } },
    entities: exoDress([
      { t: 'npc', x: 5, y: 3, colour: '#20C8D0',
        run: function (c) {
          if (NEU.exo && NEU.exo.open) NEU.exo.open();
          else c.say(['the arena door is shut.']);
        } },
      { t: 'exit', x: 5, y: 8, to: 'x0_foyer', spawn: 'north', style: 'hatch' }
    ])
  });
  NEU.act4RoomsX = ['x0_foyer', 'x1_spiral', 'x2_arena'];
})();
