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

  /* W4: the savanna district's entry socket. Generated output is verbatim;
     this hook runs before gen-wex-savanna.js is loaded (see index.html). */
  var wexRegS = E.register;
  E.register = function (id, def) {
    if (id === 'wex_savanna_01') {
      def.spawns.from_sand_path = { x: 7, y: 1, face: 'down' };
      def.entities.push({ t: 'exit', x: 7, y: 0, to: 's0_sand', spawn: 'from_wex_savanna_01', style: 'arch' });
    }
    return wexRegS(id, def);
  };

  E.tileset('savanna', {
    solid: '#',
    colours: { '#': '#8A5A28', '.': '#E2B84A', ',': '#C47A32', '=': '#A86828',
      d: '#8A8A32', r: '#B05424', m: '#7A7454', s: '#7A7058' }
  });
  E.tileset('station', {
    solid: '#',
    colours: { '#': '#2A2118', '.': '#3A2A1C', ',': '#5A4030', '=': '#1A1410' }
  });

  function say(c, lines, cue) { c.say(lines, 'narr', cue); }
  function keyName(def) { return NEU.keys ? NEU.keys.label(def) : def; }

  /* A clearing, not a yard. Interior is one ground material; the rim is
     broken earth/rock/thorn with cut corners and a few open gaps, so no
     two areas read as the same fenced rectangle. Never spans a path. */
  function footprint(w, h, seed, mat) {
    var rows = [], y, x, s, edge, inside = mat || '.';
    for (y = 0; y < h; y++) {
      s = '';
      for (x = 0; x < w; x++) {
        edge = (x === 0 || y === 0 || x === w - 1 || y === h - 1);
        if (!edge || (x <= 1 && y <= 1) || (x >= w - 2 && y <= 1) ||
            (x <= 1 && y >= h - 2) || (x >= w - 2 && y >= h - 2) ||
            ((x * 5 + y * 3 + seed * 7) % 11) === 0) s += inside;
        else s += '#';
      }
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
    return [{ t: 'savannafloor', x: 0, y: 0 }, { t: 'savannafx', x: 5, y: 8, roomSpan: true }].concat(ents);
  }
  /* Lockdown is a flag, read when the room is entered. chase.js
     swaps the entity list. The exo rooms are not the village. */
  var villageBuild = false, VDEFS = {};
  function room(id, def) {
    if (villageBuild) { def.id = id; VDEFS[id] = def; return def; }
    var r = E.register(id, def);
    if (NEU.chase && NEU.chase.bind) NEU.chase.bind(r);
    return r;
  }
  function addBox(id, spawns, ents, enter, w, h, seed, mat) {
    room(id, {
      tileset: 'savanna',
      tiles: footprint(w || 11, h || 9, seed || 1, mat || '.'),
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
  /* The village is planted hours before you reach it: one landmark every
     60 columns, and the horizon grows a roof at each one. Data lives here
     so look-savanna only draws it; there is no second landmark list. */
  var LANDMARKS = [
    { x: 60, v: 'deadtree', y: 3 }, { x: 120, v: 'brokensign', y: 6 },
    { x: 180, v: 'rustcar', y: 3 }, { x: 240, v: 'dunecrest', y: 7 },
    { x: 300, v: 'roofs', y: 2 }
  ];
  room('s0_sand', {
    tileset: 'savanna',
    tiles: sandTiles(),
    landmarks: LANDMARKS,
    spawns: { west: { x: 1, y: 5, face: 'right' }, east: { x: 360, y: 5, face: 'left' },
      from_wex_savanna_01: { x: 150, y: 1, face: 'down' } },
    entities: [{ t: 'savannafloor', x: 0, y: 0 }, { t: 'savannafx', x: 1, y: 8, roomSpan: true }]
      .concat(trees)
      .concat(LANDMARKS.map(function (m) { return prop(m.v, m.x, m.y); }))
      .concat([
        { t: 'exit', x: 0, y: 5, to: 'd2_alley', spawn: 'garage', style: 'door' },
        { t: 'exit', x: 361, y: 5, to: 's1_gate', spawn: 'west', style: 'arch' },
        { t: 'exit', x: 150, y: 0, to: 'wex_savanna_01', spawn: 'from_sand_path', style: 'arch' }
      ]),
    onEnter: function (c) {
      if (c.flagged('s0_seen')) return;
      c.flag('s0_seen', 1);
      say(c, ['sand. a few trees. the wind does not hurry.',
              'the village is at the far end. it is not close.']);
    }
  });

  /* ── village ─────────────────────────────────────────────────────
     These fourteen definitions are DATA until mergeVillage() runs: the
     authored map in .opencode/plans/neu-v3/levels/village.md fixes their
     offsets and corridors. Old ids become areas and aliases. */
  villageBuild = true;
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
  }, 13, 9, 1, '.');

  room('s2_well', {
    tileset: 'savanna',
    tiles: footprint(9, 7, 11, 'm'),
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
      { t: 'sign', x: 4, y: 1, textlessCue: 'block', lines: ['one stone. one plate. push it right.'] }
    ]),
    onEnter: function (c) {
      if (c.flagged('s2_seen')) return;
      c.flag('s2_seen', 1);
      say(c, ['one stone, one plate.',
              'press ' + keyName('z') + ' to push it.',
              'press ' + keyName('r') + ' if you hate the result.'], ['block', 'key:z', 'key:r']);
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
  ], function () { if (NEU.snail) NEU.snail.arrive('s3'); }, 12, 10, 2, '.');

  addBox('s4_shade', sp('south', 'east', 'north'), [
    gate('south', 's1_gate', 'north'),
    gate('east', 's7_pool', 'west'),
    gate('north', 's10_shells', 'south'),
    prop('acacia', 3, 6),
    { t: 'sign', x: 7, y: 6, lines: ['shade. the only architecture the trees agreed to.'] }
  ], null, 14, 11, 3, 'd');

  addBox('s5_baobab', sp('west', 'east'), [
    gate('west', 's2_well', 'east'),
    gate('east', 's8_hearth', 'west'),
    prop('baobab', 5, 2),
    { t: 'sign', x: 5, y: 6, lines: ['a tree older than the argument about who planted it.'] }
  ], null, 11, 12, 4, 'r');

  room('s6_kraal', {
    tileset: 'savanna',
    tiles: footprint(10, 8, 12, 'd'),
    spawns: { west: { x: 1, y: 3, face: 'right' }, south: { x: 3, y: 5, face: 'up' } },
    entities: dress([
      { t: 'block', x: 2, y: 2, push: true },
      { t: 'plate', x: 3, y: 2 },
      { t: 'block', x: 2, y: 4, push: true },
      { t: 'plate', x: 3, y: 4 },
      { t: 'exit', x: 0, y: 3, to: 's3_market', spawn: 'east', style: 'arch' },
      { t: 'exit', x: 3, y: 6, to: 's11_elder', spawn: 'north', style: 'arch' },
      prop('kraal', 3, 1),
      { t: 'sign', x: 5, y: 3, textlessCue: 'plate', lines: ['two stones. two plates. one push each, to the right.'] }
    ]),
    onEnter: function (c) {
      if (NEU.snail) NEU.snail.arrive('s6');
      if (c.flagged('s6_seen')) return;
      c.flag('s6_seen', 1);
      say(c, ['two lanes. the well was the lesson. this is the same lesson twice.',
              'press ' + keyName('r') + ' to put the stones back.'], ['plate', 'key:r']);
    },
    onSolved: function (c) { c.markSolved('s6_kraal'); }
  });

  addBox('s7_pool', sp('west', 'east', 'north'), [
    gate('west', 's4_shade', 'east'),
    gate('east', 's12_termite', 'west'),
    gate('north', 's13_wind', 'south'),
    prop('well', 4, 6),
    { t: 'sign', x: 7, y: 6, lines: ['a pool with no water and a great deal of mud.'] }
  ], null, 12, 11, 5, 'm');

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
    tiles: footprint(9, 6, 13, '.'),
    spawns: { west: { x: 1, y: 3, face: 'right' } },
    entities: dress([
      { t: 'brazier', x: 1, y: 1, n: 0, run: function (c) { lightHearth(c, 0); } },
      { t: 'brazier', x: 3, y: 1, n: 1, run: function (c) { lightHearth(c, 1); } },
      { t: 'brazier', x: 5, y: 1, n: 2, run: function (c) { lightHearth(c, 2); } },
      { t: 'block', x: 2, y: 3, push: true },
      { t: 'plate', x: 3, y: 3 },
      { t: 'exit', x: 8, y: 3, to: 's5_baobab', spawn: 'east', style: 'arch' },
      { t: 'sign', x: 6, y: 2, textlessCue: 'fire', lines: ['three fires, left to right, and the stone on its plate.'] }
    ]),
    solved: function (c) { return !!c.flagged('s8_lit') && !!c.entHere(3, 3, 'block'); },
    onReset: function () { hearth = []; if (NEU.save) NEU.save.flag('s8_lit', 0); },
    onSolved: function (c) { c.markSolved('s8_hearth'); },
    onEnter: function (c) {
      if (c.flagged('s8_seen')) return;
      c.flag('s8_seen', 1);
      say(c, ['light them from the left. then push the stone.',
              'press ' + keyName('r') + ' if the fires go out and you would like them to mean it.'], ['fire', 'key:r']);
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
    { t: 'sign', x: 7, y: 3, textlessCue: 'key', lines: ['three beads. the board names the key. press it once for each.'] }
  ], null, 15, 9, 6, 'r');
  addBox('s10_shells', sp('south'), [
    gate('south', 's4_shade', 'north'),
    gameNpc(3, 3, 'shells'),
    { t: 'sign', x: 7, y: 3, lines: ['three shells. the pea is under the middle one.'] }
  ], null, 13, 10, 7, '.');
  addBox('s11_elder', sp('north', 'south'), [
    gate('north', 's6_kraal', 'south'),
    gate('south', 's14_station', 'north'),
    prop('hut', 5, 4),
    prop('stool', 6, 5),
    { t: 'npc', x: 4, y: 5, colour: '#5C3A18',
      lines: ['the elder is asleep in the shade.', 'the shade is doing all the work.'] }
  ], function () { if (NEU.snail) NEU.snail.arrive('s11'); }, 11, 10, 8, '.');

  room('s14_station', {
    tileset: 'station',
    tiles: footprint(11, 9, 14, 's'),
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
  ], null, 13, 8, 9, 'r');
  addBox('s13_wind', sp('south'), [
    gate('south', 's7_pool', 'north'),
    gameNpc(3, 3, 'wind'),
    { t: 'sign', x: 5, y: 5, lines: ['hold the key the grass names until the line is full.'] },
    prop('acacia', 7, 3)
  ], null, 14, 9, 10, 'd');

  /* One source of truth for how an area looks. rooms-s owns the choice;
     look-savanna only draws it. mat is the footprint's ground char. */
  var V_STYLE = {
    s1_gate: { mat: '.', edge: 'rock', mark: 'gateposts', mx: 6, my: 3, amb: 'birds' },
    s2_well: { mat: 'm', edge: 'bank', mark: 'well', mx: 4, my: 3, amb: '' },
    s3_market: { mat: '.', edge: 'thorn', mark: 'market', mx: 6, my: 4, amb: 'birds' },
    s4_shade: { mat: 'd', edge: 'grass', mark: 'acacia', mx: 7, my: 5, amb: 'birds' },
    s5_baobab: { mat: 'r', edge: 'rock', mark: '', mx: 5, my: 5, amb: '' },
    s6_kraal: { mat: 'd', edge: 'fence', mark: 'kraal', mx: 5, my: 3, amb: 'birds' },
    s7_pool: { mat: 'm', edge: 'bank', mark: 'waterhole', mx: 6, my: 5, amb: 'birds',
      light: [6, 5, 72, '#8FD0D8'] },
    s8_hearth: { mat: '.', edge: 'rock', mark: 'firering', mx: 4, my: 3, amb: 'smoke',
      light: [4, 3, 84, '#FFB050'] },
    s9_beads: { mat: 'r', edge: 'thorn', mark: 'loom', mx: 7, my: 4, amb: '' },
    s10_shells: { mat: '.', edge: 'bank', mark: 'midden', mx: 6, my: 5, amb: 'birds' },
    s11_elder: { mat: '.', edge: 'grass', mark: 'paintedwall', mx: 8, my: 4, amb: '' },
    s12_termite: { mat: 'r', edge: 'rock', mark: 'stair', mx: 9, my: 4, amb: '' },
    s13_wind: { mat: 'd', edge: 'grass', mark: 'windpoles', mx: 7, my: 4, amb: 'devil' },
    s14_station: { mat: 's', edge: 'rock', mark: '', mx: 5, my: 5, amb: '' }
  };

  /* Flavour only. No story beat, no spoiler: one line per object, and a
     few NPCs who say something new on a second talk (R1, R4). Placed on
     free interior tiles so reach.mjs can prove every one is touchable. */
  function fillFlavour(id, lines, talkers) {
    var def = VDEFS[id], rows = def.tiles.split('\n'), w = rows[0].length, h = rows.length;
    var used = {}, cands = [], i, key, x, y, c, n = 0, total = lines.length + (talkers || []).length;
    var protectedCells = [], j, dx, dy, near;
    function take(px, py) { used[px + ',' + py] = 1; }
    for (key in (def.spawns || {})) protectedCells.push([def.spawns[key].x, def.spawns[key].y]);
    for (i = 0; i < (def.entities || []).length; i++) {
      var e = def.entities[i];
      take(e.x, e.y);
      /* Keep flavour out of arm's reach of any puzzle piece or door: a
         sign next to a block steals the push key. */
      if (e.t === 'exit' || e.t === 'block' || e.t === 'plate' || e.t === 'brazier' || e.t === 'altar')
        protectedCells.push([e.x, e.y]);
    }
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      near = false;
      for (j = 0; j < protectedCells.length; j++) {
        dx = Math.abs(x - protectedCells[j][0]); dy = Math.abs(y - protectedCells[j][1]);
        if (dx <= 1 && dy <= 1) { near = true; break; }
      }
      if (!used[x + ',' + y] && !near) cands.push([x, y]);
    }
    function next() {
      if (!cands.length || n >= total) return null;
      /* even spread over the candidate list, not a row of identical signs */
      var at = Math.min(cands.length - 1, Math.floor((n + 0.5) * cands.length / total));
      n++;
      return cands.splice(at, 1)[0];
    }
    for (i = 0; i < lines.length; i++) {
      c = next();
      if (c) def.entities.push({ t: 'sign', x: c[0], y: c[1], lines: [lines[i]] });
    }
    for (i = 0; i < (talkers || []).length; i++) {
      c = next();
      if (!c) break;
      (function (flag, first, second) {
        def.entities.push({ t: 'npc', x: c[0], y: c[1], colour: '#C8904A',
          run: function (cx) {
            if (cx.flagged(flag)) say(cx, [second]);
            else { cx.flag(flag, 1); say(cx, [first]); }
          } });
      })('s_talk_' + id + '_' + i, talkers[i][0], talkers[i][1]);
    }
  }
  fillFlavour('s1_gate', [
    'two posts, carved by people who were in a hurry.',
    'beads click when the wind bothers them.',
    'the road in is the road out. the village just looks bigger.',
    'a gourd hangs from the left post. it is empty.',
    'someone tied a knot here and forgot why.',
    'the ground is packed hard where everyone stops to look.'
  ], [['the posts were painted before the path was paved.', 'now the paint is only on the shaded side.']]);
  fillFlavour('s2_well', [
    'the bucket is lighter than it looks.', 'a wet ring, darker by the minute.',
    'the rope has been spliced twice.', 'the stone on the plate is not the first one tried.',
    'a cup sits on the rim. nobody claims it.', 'the mud here remembers every foot.'
  ], [['the well is older than the plates.', 'the plates are younger, and louder.']]);
  fillFlavour('s3_market', [
    'three awnings, three colours, no prices.', 'the red one has the best shade.',
    'crates of nothing, stacked with care.', 'a basket upside down, waiting for rain that never comes.',
    'beads strung on a wire instead of string.', 'trade here is mostly news.'
  ], [['the blue awning was a bet.', 'it lost. the colour stayed.']]);
  fillFlavour('s4_shade', [
    'the acacia shades half the village and knows it.', 'three people asleep and one pretending.',
    'a lowered branch makes a bench for nobody in particular.', 'roots lift the ground like knuckles.',
    'birds argue in the canopy, then leave.', 'the shade moves all day and nobody follows it.'
  ], [
    ['the old baobab has a hollow at its foot. something in there catches the light.',
     'i looked once. i did not take it.'],
    ['this is the only shade that has ever agreed with me.', 'the shade has moved. i have not.']
  ]);
  /* R5: the baobab's hollow. The s4 NPC above hints at it. */
  VDEFS.s5_baobab.entities.push({ t: 'pickup', x: 3, y: 2, item: 's_hollow_charm',
    lines: ['a carved bean, warm from the hollow. it means nothing to anyone else.'] });
  fillFlavour('s5_baobab', [
    'a tree older than the argument about who planted it.',
    'the trunk could hold a house, if the house were small.', 'a hollow at the foot, dark and cool.',
    'the bark is smooth where hands have rubbed it.', 'branches like roots, pointing at nothing.',
    'the tree keeps the heat out and the stories in.'
  ]);
  fillFlavour('s6_kraal', [
    'thorns make a fence that needs no mending.', 'the cattle know which side of the gate is dinner.',
    'two stones, two plates. the lesson repeats.', 'a horn scraped on the post, lower each year.',
    'dust hangs where the herd has passed.', 'the fence is the only straight line in the village.'
  ], [['the cattle came first. the fence was an apology.', 'the fence is still apologising.']]);
  fillFlavour('s7_pool', [
    'water, finally, and every animal knows it.', 'reeds mark the edge that mud would hide.',
    'tracks cross and cross again.', 'a hoofprint filled with sky.',
    'the pool is shallower than it looks from here.', 'dragonflies hold still for exactly one second.'
  ], [['the waterhole moves the whole village closer.', 'it moves away again by evening.']]);
  fillFlavour('s8_hearth', [
    'three fires, left to right, and the stone on its plate.', 'the pot has been mended more than once.',
    'smoke goes west, then thinks better of it.', 'ash keeps the shape of last night\'s fire.',
    'a ring of stones, none of them matching.', 'someone left a spoon on the flat stone.'
  ], [['the fire is the reason everyone stops here.', 'the fire does not care. it burns anyway.']]);
  fillFlavour('s9_beads', [
    'a loom strung with thread and small glass.', 'three colours, one cord, no pattern written down.',
    'the bead board names the key.', 'a finished strand, slightly crooked.',
    'loose beads in a gourd, counted by eye.', 'the loom creaks when the wind finds it.'
  ]);
  fillFlavour('s10_shells', [
    'a midden of shells, stacked by someone patient.', 'wind chimes hang from a crooked pole.',
    'the chimes only agree once an hour.', 'cowries, bleached white on top and brown underneath.',
    'a shell with a hole worn smooth.', 'the pile is older than the huts.'
  ], [['the chimes were a gift. the wind is the gift that keeps giving.', 'the wind gave back a headache.']]);
  fillFlavour('s11_elder', [
    'a painted wall, refreshed every season.', 'the elder sleeps where the paint is brightest.',
    'a stool pulled close to the wall.', 'the figures on the wall walk left, always.',
    'red ochre, white chalk, no blue.', 'the hut is cool even at this hour.'
  ], [['i paint the wall so the stories stay facing the right way.', 'i may have mixed up left and right.']]);
  fillFlavour('s12_termite', [
    'a mound taller than the hut behind it.', 'stairs cut into the hard clay.',
    'the termites are not taking visitors.', 'the mound is cool on the shady side.',
    'a crack runs down like a dried river.', 'someone carved a mark at the top and stopped.'
  ], [['the mound is older than anyone who claims it.', 'the mark at the top is newer. i made it.']]);
  fillFlavour('s13_wind', [
    'poles with cloth strips, all pointing west.', 'the cloth says hold, then says nothing.',
    'a dust devil crosses when nobody watches.', 'the grass here leans even on still days.',
    'one strip is red and never stops.', 'the poles hum lower than the chimes.'
  ], [['the wind never repeats itself. that is the whole trick.', 'it just repeated itself. i am not counting that.']]);
  fillFlavour('s14_station', [
    'one rail line, straight through the platform.', 'the sign hangs from two chains.',
    'a bench worn smooth in the middle.', 'the snail goes where you have already stood.',
    'stone underfoot, cooler than the village dust.', 'nothing stops here on purpose.'
  ]);

  villageBuild = false;

  /* The authored map from .opencode/plans/neu-v3/levels/village.md. Room
     rectangles keep their old ids as areas; corridors are the only new
     floor, and the two outside doors are the only exits left in data. */
  var V_ORIGIN = {
    s10_shells: [4, 6], s13_wind: [20, 6], s4_shade: [4, 20], s7_pool: [20, 20],
    s9_beads: [36, 20], s12_termite: [52, 20], s1_gate: [4, 34], s3_market: [20, 34],
    s6_kraal: [36, 34], s2_well: [4, 48], s5_baobab: [20, 48], s11_elder: [36, 48],
    s8_hearth: [4, 62], s14_station: [36, 62]
  };
  var V_LAND = {
    s1_gate: 'west', s2_well: 'south', s3_market: 'west', s4_shade: 'south',
    s5_baobab: 'west', s6_kraal: 'west', s7_pool: 'west', s8_hearth: 'west',
    s9_beads: 'south', s10_shells: 'south', s11_elder: 'north', s12_termite: 'west',
    s13_wind: 'south', s14_station: 'north'
  };
  var V_PATHS = [
    [[9, 34], [9, 28]], [[9, 20], [9, 14]], [[14, 24], [20, 24]], [[25, 20], [25, 14]],
    [[30, 24], [31, 24], [31, 18], [51, 18], [51, 24], [52, 24]],
    [[14, 38], [20, 38]], [[25, 34], [25, 33], [41, 33], [41, 28]],
    [[30, 38], [36, 38], [36, 37]], [[39, 40], [39, 47], [41, 47], [41, 48]],
    [[41, 56], [41, 62]], [[9, 42], [9, 43], [11, 43], [11, 53], [7, 53], [7, 52]],
    [[9, 50], [12, 50], [12, 52], [20, 52]], [[30, 52], [32, 52], [32, 65], [13, 65], [12, 65]],
    [[3, 38], [1, 38]], [[63, 24], [66, 24]]
  ];
  /* W2-SAV: new ground east and south of the authored fourteen. The outer
     trail braids around the well, baobab and termite mound; ridges break
     sightlines; one lookout and two dead ends that point back to the spine. */
  var V_W = 84, V_H = 88;
  /* Thorn banks / laterite ridges, as inclusive [x0,y0,x1,y1] rectangles.
     Painted on open 'd' infill ONLY, before the guaranteed paths are carved,
     so no door, plate, spawn, altar or chase cell can be sealed. */
  var V_BANKS = [
    [13, 44, 15, 52], [4, 56, 12, 57],          /* well braid */
    [31, 44, 34, 52], [31, 56, 34, 61], [16, 60, 19, 61], /* baobab braid */
    [17, 32, 19, 38], [32, 32, 35, 38],         /* two crosslinks */
    [46, 28, 50, 31],                            /* termite laterite ridge */
    [52, 34, 58, 35], [60, 41, 66, 42], [52, 52, 57, 53], /* broken midground */
    [60, 76, 61, 84], [70, 76, 71, 84]           /* lookout frame */
  ];
  /* Braided outer trails, crosslinks and dead ends. Carved after V_PATHS and
     after the banks, so each one is a guaranteed open route. */
  var V_MAZE_PATHS = [
    [[9, 42], [2, 42], [2, 58], [14, 58], [18, 58], [18, 50]], /* outer west braid */
    [[32, 52], [32, 60], [48, 60], [48, 84], [56, 84], [56, 76]], /* east braid + lookout */
    [[39, 32], [48, 32], [48, 28], [51, 28]],   /* crosslink to the termite approach */
    [[2, 58], [2, 63]], [[56, 84], [64, 84]]     /* dead ends */
  ];
  /* Static, no quest state. A landmark at the lookout and a sign at each dead
     end, so the way back is legible from the place you were told you had
     reached. No origin: these belong to the field, not to an area's count. */
  var V_FIELD_ENTS = [
    prop('dunecrest', 55, 76),
    { t: 'sign', x: 2, y: 63, lines: ['a bank with no way through. the trail you came on is the way back.'] },
    { t: 'sign', x: 64, y: 84, lines: ['the lookout ends here. west, then north, gets you to the well.'] },
    { t: 'sign', x: 56, y: 76, lines: ['from up here the roofs line up. the mound is the far one.'] }
  ];
  var V_PUZZLES = [
    { id: 's2_well', plates: [[7, 50]] },
    { id: 's6_kraal', plates: [[39, 36], [39, 38]] },
    { id: 's8_hearth', plates: [[7, 65]], flag: 's8_lit' }
  ];
  function vGrid() {
    var rows = [], y;
    /* open dry grassland between clearings, not a wall of brown filler:
       the winding paths and the broken clearing rims are the only edges */
    for (y = 0; y < V_H; y++) rows.push(new Array(V_W + 1).join('d'));
    return rows;
  }
  function vCarve(rows, path) {
    var i, x, y, ax, ay, bx, by, dx, dy, sx, sy, n, k;
    for (i = 0; i + 1 < path.length || (i === 0 && path.length === 1); i++) {
      ax = path[i][0]; ay = path[i][1];
      bx = path[i + 1] ? path[i + 1][0] : ax; by = path[i + 1] ? path[i + 1][1] : ay;
      dx = bx > ax ? 1 : bx < ax ? -1 : 0;
      dy = by > ay ? 1 : by < ay ? -1 : 0;
      n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (k = 0; k <= n; k++) {
        x = ax + dx * k; y = ay + dy * k;
        if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) continue;
        rows[y] = rows[y].substring(0, x) + ',' + rows[y].substring(x + 1);
      }
      if (path.length === 1) break;
    }
  }
  /* Paint a ridge only where the ground is still open 'd'. Area floors,
     doors, plates, spawns and earlier carved paths are never overwritten. */
  function vBank(rows, r) {
    var x, y, row;
    for (y = r[1]; y <= r[3]; y++) {
      if (y < 0 || y >= rows.length) continue;
      row = rows[y];
      for (x = r[0]; x <= r[2]; x++) {
        if (x < 0 || x >= row.length || row.charAt(x) !== 'd') continue;
        rows[y] = row.substring(0, x) + '#' + row.substring(x + 1);
        row = rows[y];
      }
    }
  }
  function vStamp(rows, id) {
    var o = V_ORIGIN[id], src = VDEFS[id].tiles.split('\n'), r, x, row;
    for (r = 0; r < src.length; r++) {
      row = rows[o[1] + r];
      for (x = 0; x < src[r].length; x++)
        row = row.substring(0, o[0] + x) + src[r].charAt(x) + row.substring(o[0] + x + 1);
      rows[o[1] + r] = row;
    }
  }
  function villageSolved(c) {
    var i, j, p, done = 0, covered;
    for (i = 0; i < V_PUZZLES.length; i++) {
      p = V_PUZZLES[i];
      covered = true;
      for (j = 0; j < p.plates.length; j++)
        if (!c.entHere(p.plates[j][0], p.plates[j][1], 'block')) covered = false;
      if (p.flag && !c.flagged(p.flag)) covered = false;
      if (covered && !c.flagged('solved:' + p.id)) {
        c.markSolved(p.id);
        if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small');
      }
      /* Cover, not the flag, decides the room's own win: the flag is a
         sticky reward, and the push-proof harness reads the cover. */
      if (covered) done++;
    }
    return done === V_PUZZLES.length;
  }
  /* The elder area carries the chase figure because the merged room id is
     s_village, not s11_elder; chase.js keeps its own bind and step. */
  function elderEnter(c) {
    var prev = VDEFS.s11_elder.onEnter, list, i, x = 41, y = 54;
    if (prev) prev(c);
    if (!NEU.save || (NEU.chase && NEU.chase.over)) return;
    if (!NEU.save.flagged('s_lockdown') && !NEU.save.flagged('draedon_won')) return;
    list = c.ents();
    for (i = 0; i < list.length; i++) if (list[i].t === 'figure') return;
    list.push({ t: 'figure', x: x, y: y, figure: 1 });
    list.push({ t: 'trigger', x: x, y: y, once: 1,
      run: function () { if (NEU.chase && NEU.chase.arrive) NEU.chase.arrive(); } });
  }
  /* Hand-merged on purpose, not E.merge: fixed 84x88 'd' canvas, post-paint carves and banks, sites; E.merge fills '#' and sizes from bbox. Needs an engine API change. */
  function mergeVillage() {
    var rows = vGrid(), ids = Object.keys(V_ORIGIN), i, k, id, o, def, es, e, copy,
        key, s, map, st, spawns = {}, areas = [], ents = [], sites = [], rowsOf;
    for (i = 0; i < ids.length; i++) vStamp(rows, ids[i]);
    /* A door in a wall is solid; open the wall cell it used to occupy. */
    for (i = 0; i < ids.length; i++) {
      id = ids[i]; o = V_ORIGIN[id]; es = VDEFS[id].entities || [];
      for (k = 0; k < es.length; k++) {
        e = es[k];
        if (e.t !== 'exit' || !V_ORIGIN[e.to]) continue;
        vCarve(rows, [[o[0] + e.x, o[1] + e.y]]);
      }
    }
    /* Banks first, then every guaranteed route: the paths always win, so a
       ridge can never be the only thing standing between a spawn and a door. */
    for (i = 0; i < V_BANKS.length; i++) vBank(rows, V_BANKS[i]);
    for (i = 0; i < V_PATHS.length; i++) vCarve(rows, V_PATHS[i]);
    for (i = 0; i < V_MAZE_PATHS.length; i++) vCarve(rows, V_MAZE_PATHS[i]);
    for (i = 0; i < ids.length; i++) {
      id = ids[i]; o = V_ORIGIN[id]; def = VDEFS[id];
      for (key in (def.spawns || {})) {
        s = def.spawns[key];
        spawns[id + '_' + key] = { x: o[0] + s.x, y: o[1] + s.y, face: s.face };
      }
      rowsOf = def.tiles.split('\n').filter(function (r) { return r.length; });
      areas.push({ id: id, x0: o[0], y0: o[1], x1: o[0] + rowsOf[0].length - 1,
        y1: o[1] + rowsOf.length - 1, spawn: id + '_' + V_LAND[id],
        onEnter: id === 's11_elder' ? elderEnter : def.onEnter });
      st = V_STYLE[id];
      sites.push({ id: id, x0: o[0], y0: o[1], w: rowsOf[0].length, h: rowsOf.length,
        mat: st.mat, edge: st.edge, amb: st.amb,
        light: st.light ? { x: o[0] + st.light[0], y: o[1] + st.light[1],
          r: st.light[2], col: st.light[3] } : null });
      if (st.mark) ents.push({ t: 'savannaprop', v: st.mark,
        x: o[0] + st.mx, y: o[1] + st.my });
      map = {};
      for (key in (def.spawns || {})) map[key] = id + '_' + key;
      /* Small harnesses boot this file with a tileset/register-only engine
         stub; the real engine always has alias(). Keep the room data build
         usable in both instead of crashing before mount() can be tested. */
      if (typeof E.alias === 'function') E.alias(id, 's_village', map, id);
      es = def.entities || [];
      for (k = 0; k < es.length; k++) {
        e = es[k];
        if (e.t === 'savannafloor' || e.t === 'savannafx') continue;
        if (e.t === 'exit' && V_ORIGIN[e.to]) continue;
        copy = {};
        for (key in e) copy[key] = e[key];
        copy.origin = { room: id, x: e.x, y: e.y };
        copy.x += o[0]; copy.y += o[1];
        ents.push(copy);
      }
    }
    return {
      tileset: 'savanna', tiles: rows.join('\n'),
      stationZones: [{ x0: 36, y0: 62, x1: 46, y1: 70 }],
      sites: sites, spawns: spawns, areas: areas,
      entities: [{ t: 'savannafloor', x: 0, y: 0 },
                 { t: 'savannafx', x: 1, y: V_H - 1, roomSpan: true }]
                .concat(ents).concat(V_FIELD_ENTS),
      solved: villageSolved,
      onSolved: function (c) {
        c.markSolved('s_village');
        if (NEU.juice && NEU.juice.hit) NEU.juice.hit('large');
      },
      onReset: function () { hearth = []; if (NEU.save) NEU.save.flag('s8_lit', 0); }
    };
  }
  room('s_village', mergeVillage());
  NEU.act4RoomsS = ['s0_sand', 's_village', 's1_gate', 's2_well', 's3_market', 's4_shade', 's5_baobab',
    's6_kraal', 's7_pool', 's8_hearth', 's9_beads', 's10_shells', 's11_elder', 's12_termite', 's13_wind',
    's14_station'];

  /* ── mechanical house (Exo lab) ────────────────────────────────── */
  E.tileset('exo', {
    solid: '#',
    colours: { '#': '#1A1E24', '.': '#1A1E24', ',': '#12383C', '=': '#E2C04A' }
  });
  /* 30x17 cells = 480x272 world units. The view is 20x12 cells at the
     engine's floor scale, so both rooms fill the frame at 1280x720 and
     1920x1080 instead of sitting as a stub in the void. */
  var EXO_W = 30, EXO_H = 17;
  function exoFloor(rows) { return rows.join('\n'); }
  /* the hall: lit spine on row 8, stair approach up column 15, a hazard
     band before the arena door, and four pillars that break the void. */
  function exoHall() {
    var rows = [], y, x, s, wall;
    for (y = 0; y < EXO_H; y++) {
      s = '';
      for (x = 0; x < EXO_W; x++) {
        wall = (x === 0 || y === 0 || x === EXO_W - 1 || y === EXO_H - 1);
        if (wall) s += '#';
        else if (y === 8) s += ',';
        else if (x === 15 && y < 8) s += ',';
        else if (y === 9 && x > 9 && x < 20) s += '=';
        else if ((x === 5 || x === 6) && y >= 3 && y <= 5) s += '#';
        else if ((x === 23 || x === 24) && y >= 3 && y <= 5) s += '#';
        else if ((x === 5 || x === 6) && y >= 11 && y <= 13) s += '#';
        else if ((x === 23 || x === 24) && y >= 11 && y <= 13) s += '#';
        else s += '.';
      }
      rows.push(s);
    }
    return exoFloor(rows);
  }
  /* the shaft base: an open well walled in steel, hazard bands where the
     stair leaves the floor, one doorway south. */
  function exoShaft() {
    var rows = [], y, x, s, wall;
    for (y = 0; y < EXO_H; y++) {
      s = '';
      for (x = 0; x < EXO_W; x++) {
        wall = (x === 0 || y === 0 || x === EXO_W - 1 || y === EXO_H - 1);
        if (wall) s += '#';
        else if (x === 15 && y > 8) s += ',';
        else if (y === 13 && x > 7 && x < 23) s += '=';
        else if (y === 4 && x > 9 && x < 21) s += '=';
        else if ((x === 7 || x === 23) && y > 3 && y < 14) s += '#';
        else if ((y === 3 || y === 14) && x > 7 && x < 23) s += '#';
        else s += '.';
      }
      rows.push(s);
    }
    return exoFloor(rows);
  }
  function exoBase() { return [{ t: 'exofloor', x: 0, y: 0 }]; }
  function exoDress(ents) {
    return exoBase().concat([
      { t: 'exoprop', v: 'eye', x: 1, y: 2 },
      { t: 'exoprop', v: 'holo', x: 20, y: 2 }], ents);
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

  /* D8: the foyer and the arena are one hall. Both ids keep their name for
     saves, reach checks and older suites, but share one definition. */
  function hallSpawns() {
    return {
      west: { x: 1, y: 8, face: 'right' },
      east: { x: 28, y: 8, face: 'left' },
      north: { x: 15, y: 1, face: 'down' },
      south: { x: 15, y: 15, face: 'up' },
      stair: { x: 15, y: 2, face: 'down' }
    };
  }
  function term(x, y, lines, extra) {
    var e = { t: 'exoterm', x: x, y: y, lines: lines }, k;
    for (k in extra || {}) e[k] = extra[k];
    return e;
  }
  function hallEnts() {
    return exoDress([
      { t: 'exit', x: 0, y: 8, to: 's12_termite', spawn: 'east', style: 'arch' },
      { t: 'exit', x: 15, y: 0, to: 'x1_spiral', spawn: 'south', style: 'stairs' },
      { t: 'npc', x: 15, y: 6, colour: '#20C8D0',
        run: function (c) {
          if (NEU.exo && NEU.exo.open) {
            if (NEU.engineTrans && NEU.engineTrans.enterMode) NEU.engineTrans.enterMode('mode:boss', function () { NEU.exo.open(); }, { look: '#061418' });
            else NEU.exo.open();
          }
          else c.say(['the arena door is shut.']);
        } },
      { t: 'sign', x: 12, y: 12,
        lines: ['steel, a stair and a door. the chair at the top has already turned.'] },
      { t: 'save', x: 17, y: 12 },
      /* lab floor: terminals, cable runs, warning lamps. Logs only. */
      term(1, 5, ['* LOG 117: coolant loop three whistles in b flat.',
        '* filed under: not a fault.']),
      term(1, 11, ['* canteen rota. the coffee machine has seniority.',
        '* do not unplug it. do not ask why.']),
      term(1, 14, ['* HAZARD: plates past the yellow line are live.',
        '* the yellow does not mean walk slowly. it means walk.']),
      term(27, 14, ['* LOG 000: this terminal was never installed.',
        '* someone left it plugged in anyway.'], {
        run: function (c) {
          if (NEU.save && NEU.save.flagged('x_log_secret')) {
            c.say(['* the log is still here. it has not found a purpose either.']);
            return;
          }
          c.flag('x_log_secret', 1);
          c.say(['* LOG 000 opens: a maintenance note addressed to nobody.',
            '* "if you are reading this, the stair worked."']);
        } }),
      { t: 'exoprop', v: 'rack', x: 2, y: 3 },
      { t: 'exoprop', v: 'rack', x: 2, y: 13 },
      { t: 'exoprop', v: 'tank', x: 27, y: 3 },
      { t: 'exoprop', v: 'tank', x: 27, y: 13 },
      { t: 'exoprop', v: 'cable', x: 9, y: 15 },
      { t: 'exoprop', v: 'cable', x: 10, y: 15 },
      { t: 'exoprop', v: 'cable', x: 11, y: 15 },
      { t: 'exoprop', v: 'cable', x: 12, y: 15 },
      { t: 'exoprop', v: 'warn', x: 8, y: 3 },
      { t: 'exoprop', v: 'warn', x: 21, y: 3 },
      { t: 'exoprop', v: 'warn', x: 8, y: 13 },
      { t: 'exoprop', v: 'warn', x: 21, y: 13 }
    ]);
  }
  function hallEnter(c) {
    if (c.flagged('x0_seen')) return;
    c.flag('x0_seen', 1);
    c.say(['steel, and a stair that does not trust you.',
      'something at the top is already looking down.']);
  }
  E.register('x0_foyer', {
    tileset: 'exo', tiles: exoHall(), spawns: hallSpawns(),
    entities: hallEnts(), onEnter: hallEnter
  });
  E.register('x1_spiral', {
    tileset: 'exo',
    tiles: exoShaft(),
    spawns: { south: { x: 15, y: 15, face: 'up' } },
    entities: exoBase().concat([
      { t: 'exit', x: 15, y: 16, to: 'x0_foyer', spawn: 'north', style: 'stairs' },
      { t: 'save', x: 12, y: 9 },
      { t: 'sign', x: 18, y: 9,
        lines: ['the stair turns around a column. the floor is a long way down.'] },
      term(9, 6, ['* SHAFT LOG: twelve turns, one chair.',
        '* the rail is older than the shaft. nobody knows why.']),
      term(9, 10, ['* SAFETY: keep hands inside the rail.',
        '* the drop is longer than it looks from here.']),
      term(21, 6, ['* LIFT CONTROL: out of order since the last climb.',
        '* use the stair. the stair is not out of order.']),
      term(21, 10, ['* WARNING: climbing is monitored.',
        '* not that anyone is watching.'], {
        run: function (c) {
          if (NEU.save && NEU.save.flagged('x_shaft_secret')) {
            c.say(['* still under the console. still unlisted.']);
            return;
          }
          c.flag('x_shaft_secret', 1);
          c.say(['* under the console, a switch marked "do not press".',
            '* it has already been pressed. the label is newer than the switch.']);
        }
      }),
      { t: 'exoprop', v: 'rack', x: 9, y: 5 },
      { t: 'exoprop', v: 'tank', x: 21, y: 5 },
      { t: 'exoprop', v: 'warn', x: 8, y: 8 },
      { t: 'exoprop', v: 'warn', x: 22, y: 8 },
      { t: 'exoprop', v: 'cable', x: 12, y: 15 },
      { t: 'exoprop', v: 'cable', x: 13, y: 15 },
      { t: 'exoprop', v: 'cable', x: 14, y: 15 },
      { t: 'exoprop', v: 'cable', x: 16, y: 15 },
      { t: 'exoprop', v: 'cable', x: 17, y: 15 },
      { t: 'exoprop', v: 'cable', x: 18, y: 15 }
    ]),
    onEnter: function () { if (NEU.house) NEU.house.open(); }
  });
  E.register('x2_arena', {
    tileset: 'exo', tiles: exoHall(), spawns: hallSpawns(),
    entities: hallEnts(), onEnter: hallEnter
  });
  NEU.act4RoomsX = ['x0_foyer', 'x1_spiral', 'x2_arena'];
})();
