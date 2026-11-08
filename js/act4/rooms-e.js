/* rooms-e.js — the room behind the door in e3_hall.
   Dim, lived-in, and quiet. The hall's music does not follow you in:
   the tileset is not one music.js knows, so the only sound is the clock. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (!NEU.engine || !NEU.engine.register) return;
  var E = NEU.engine;
  var ticking = false, armed = false, actx = null;

  E.tileset('dad', {
    solid: '#|+o',
    colours: {
      '#': '#121214', '|': '#1A1A1E', '.': '#221F1C', ',': '#2A261F',
      '_': '#3A2E26', '+': '#2A2A30', 'o': '#1A1816'
    }
  });

  function reduced() {
    return !!(NEU.engineLook && NEU.engineLook.reduced);
  }

  function tock() {
    if (NEU.settings && NEU.settings.muted) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = actx || new AC();
      if (actx.state === 'suspended' && actx.resume) actx.resume();
      var t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(90, t);
      g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + 0.04);
    } catch (err) {}
  }

  function arm() {
    if (armed || !NEU.kernel || !NEU.kernel.after) return;
    armed = true;
    NEU.kernel.after(1000, function () {
      armed = false;
      if (!ticking || !NEU.engine || NEU.engine.room !== 'e5_dad') { ticking = false; return; }
      tock();
      arm();
    });
  }

  function paintRoom(P) {
    var x, y, ln, off;
    function hs(a, b, s) {
      var n = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
      n = (n ^ (n >>> 13)) * 1274126177 | 0;
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    }
    P(0, 0, 256, 128, '#121214');
    /* wallpaper: 8px stripes, a rail, a panelled wainscot, a skirting */
    for (x = 0; x < 256; x += 8) {
      P(x, 0, 8, 22, (x >> 3) & 1 ? '#222228' : '#1C1C20');
      P(x, 0, 1, 22, (x >> 3) & 1 ? '#2A2A32' : '#24242A');
    }
    for (y = 0; y < 22; y += 8) P(0, y + 7, 256, 1, '#18181C');
    P(0, 0, 256, 2, '#121216');
    P(0, 22, 256, 2, '#32323A'); P(0, 22, 256, 1, '#44444E');
    P(0, 24, 256, 6, '#18181C');
    for (x = 0; x < 256; x += 16) { P(x + 1, 25, 14, 4, '#1E1E24'); P(x + 1, 25, 14, 1, '#2A2A32'); P(x + 1, 28, 14, 1, '#101014'); }
    P(0, 30, 256, 2, '#32323A'); P(0, 30, 256, 1, '#3E3E48');
    /* two picture frames */
    P(83, 5, 14, 12, '#0E0C0A'); P(84, 6, 12, 10, '#3A2C22'); P(84, 6, 12, 1, '#4A382C');
    P(86, 8, 8, 6, '#5A5A60'); P(86, 11, 8, 3, '#8A8A90'); P(88, 9, 2, 2, '#8A8A90'); P(86, 8, 8, 1, '#6A6A70');
    P(177, 6, 14, 12, '#0E0C0A'); P(178, 7, 12, 10, '#3A2C22'); P(178, 7, 12, 1, '#4A382C');
    P(180, 9, 8, 6, '#5A5A60'); P(180, 12, 8, 3, '#8A8A90'); P(184, 10, 3, 2, '#8A8A90');
    /* the window: blinds and a moon sliver */
    P(115, 3, 26, 18, '#0E0C0A'); P(116, 4, 24, 16, '#2A2A34');
    P(117, 5, 22, 14, '#10162A');
    P(129, 7, 2, 6, '#C8C8D0'); P(130, 8, 1, 4, '#A0A0AC');
    for (y = 5; y < 19; y += 2) P(117, y, 22, 1, '#2A2A34');
    P(114, 21, 28, 2, '#3E3E48');
    /* floorboards: end seams offset per row, nail dots */
    for (y = 32, ln = 0; y < 128; y += 4, ln++) {
      P(0, y, 256, 3, ln & 1 ? '#2A2824' : '#221F1C');
      P(0, y + 3, 256, 1, '#141210');
      off = (ln * 13) % 32;
      for (x = off; x < 256; x += 32) {
        P(x, y, 1, 3, '#141210');
        P(x + 3, y + 1, 1, 1, '#141210');
        if (hs(x, y, 7) < 0.2) P(x + 8, y, 6, 1, '#34302A');
      }
    }
    /* moonlight on the boards */
    for (y = 0; y < 20; y++) P(112 + y, 40 + y * 2, 28, 1, '#C8C8D012');
    /* a rug under the bed and desk reads as home */
    P(64, 72, 80, 28, '#241C16');
    P(66, 74, 76, 24, '#3A2C22');
    P(66, 74, 76, 1, '#4A382C'); P(66, 97, 76, 1, '#1E1812');
    for (x = 70; x < 138; x += 8) P(x, 78, 4, 16, '#32261C');
    P(92, 40, 1, 1, '#6A6258');
    P(140, 88, 1, 1, '#5A534C');
    P(48, 100, 1, 1, '#6A6258');
    /* front wall */
    P(0, 96, 256, 32, '#18181C');
    P(0, 96, 256, 2, '#32323A');
    for (x = 0; x < 256; x += 16) P(x, 100, 15, 24, (x >> 4) & 1 ? '#1E1E24' : '#1A1A20');
    P(112, 96, 16, 16, '#221F1C'); P(112, 96, 1, 16, '#32323A'); P(127, 96, 1, 16, '#32323A');
  }

  if (NEU.lookCity && NEU.lookCity.rooms) {
    NEU.lookCity.rooms.e5_dad = { w: 16, h: 8, paint: paintRoom };
  }
  if (NEU.lookCity && NEU.lookCity.props) {
    var props = NEU.lookCity.props;
    props.dadrobe = { w: 20, h: 36, ax: 10, ay: 32, paint: function (P) {
      P(-9, -31, 18, 32, '#0E0A08');
      P(-8, -30, 16, 30, '#3A2A22');
      P(-8, -30, 16, 3, '#4A382C'); P(-8, -30, 16, 1, '#5A4636');
      P(-7, -26, 7, 23, '#32241C'); P(0, -26, 7, 23, '#32241C');
      P(-7, -26, 7, 1, '#4A382C'); P(-7, -26, 1, 23, '#4A382C');
      P(0, -26, 7, 1, '#4A382C'); P(0, -26, 1, 23, '#4A382C');
      P(-1, -4, 6, 1, '#1A120E'); P(-7, -4, 7, 1, '#1A120E');
      P(6, -26, 1, 23, '#1A120E'); P(-1, -26, 1, 23, '#1A120E');
      P(2, -23, 3, 14, '#3A4A5A'); P(2, -23, 1, 14, '#5A6A7A'); P(3, -21, 1, 3, '#7A8A9A');
      P(-3, -16, 1, 3, '#8A7048'); P(1, -16, 1, 3, '#8A7048');
      P(-8, 0, 3, 2, '#0E0A08'); P(5, 0, 3, 2, '#0E0A08');
    } };
    props.dadbed = { w: 34, h: 18, ax: 17, ay: 14, paint: function (P) {
      P(-16, -15, 32, 17, '#0E0A08');
      P(-15, -14, 30, 5, '#2A2018'); P(-15, -14, 30, 1, '#3A2C20');
      P(-15, -9, 30, 10, '#1A120E');
      P(-14, -8, 28, 8, '#4A3428');
      P(-14, -8, 28, 2, '#5A4030');
      P(-14, -3, 28, 1, '#3A261C'); P(-14, 0, 28, 1, '#2A1A12');
      P(-4, -7, 1, 6, '#3A261C'); P(4, -7, 1, 5, '#3A261C');
      P(-13, -11, 11, 5, '#9A9488'); P(-13, -11, 11, 1, '#C8C0B0');
      P(-12, -10, 9, 3, '#C8C0B0'); P(-11, -10, 7, 1, '#E4DCC8');
      P(-15, 0, 3, 2, '#0E0A08'); P(12, 0, 3, 2, '#0E0A08');
    } };
    props.daddesk = { w: 28, h: 20, ax: 14, ay: 16, paint: function (P) {
      P(-13, -15, 26, 5, '#0E0A08');
      P(-12, -14, 24, 3, '#5A4634'); P(-12, -14, 24, 1, '#6A5640');
      P(-11, -11, 22, 1, '#3A2C20');
      P(-11, -10, 3, 10, '#2A2018'); P(8, -10, 3, 10, '#2A2018');
      P(-8, -10, 16, 8, '#0E0A08');
      P(-7, -9, 14, 6, '#3A2C20');
      P(-6, -8, 12, 4, '#2E241C'); P(-6, -8, 12, 1, '#4A382C');
      P(-1, -6, 2, 1, '#8A7048');
      P(-6, -3, 12, 1, '#120E0C');
      P(-10, -17, 6, 2, '#C8C0B0'); P(-9, -19, 6, 2, '#E4DCC8'); P(-9, -19, 6, 1, '#F4ECD8');
    } };
    props.dadlamp = { w: 10, h: 16, ax: 5, ay: 14, paint: function (P) {
      P(-3, -4, 6, 4, '#1A120E');
      P(-1, -10, 2, 6, '#3A342C');
      P(-4, -14, 8, 4, '#C8A868');
      P(-3, -13, 6, 2, '#F2E2B0');
    }, light: function (e, d) {
      var r = 64;
      if (!reduced() && d && d.now) r = (Math.floor(d.now / 900) % 2) ? 58 : 64;
      return { r: r, col: '#E8C890', glow: 0.16 };
    } };
    props.dadbounce = { w: 2, h: 2, ax: 1, ay: 1, paint: function () {}, light: function () {
      return { r: 150, a: 0.3 };
    } };
    props.dadclock = { w: 10, h: 12, ax: 5, ay: 10, paint: function (P) {
      P(-4, -10, 8, 10, '#1A120E');
      P(-3, -9, 6, 8, '#3A342C');
      P(-2, -8, 4, 4, '#E4DCC8');
      P(-1, -7, 1, 2, '#1A120E');
      P(-1, -6, 2, 1, '#1A120E');
    } };
    props.dadnote = { w: 12, h: 8, ax: 6, ay: 6, paint: function (P) {
      P(-5, -6, 10, 6, '#E4D8C0');
      P(-4, -5, 6, 1, '#8A8070');
      P(-4, -3, 7, 1, '#8A8070');
      P(-4, -1, 4, 1, '#8A8070');
    } };
    props.dadframe = { w: 20, h: 8, ax: 10, ay: 4, paint: function (P) {
      P(-9, -3, 18, 6, '#1A120E');
      P(-8, -2, 16, 4, '#5A4634');
      P(-7, -1, 14, 2, '#2A241C');
      P(-6, -1, 1, 1, '#6A6258');
      P(2, 0, 1, 1, '#6A6258');
      P(-2, -1, 1, 1, '#8A8478');
    } };
    props.dadseam = { w: 14, h: 12, ax: 7, ay: 8, paint: function (P) {
      var open = NEU.save && NEU.save.flagged('dad_compartment');
      P(-1, -1, 2, 2, '#120E0C');
      if (!open) return;
      P(-5, 0, 10, 3, '#0A0806');
      P(-4, -4, 8, 4, '#E4D8C0');
      P(-3, -3, 6, 1, '#C41018');
    } };
  }

  E.register('e5_dad', {
    tileset: 'dad',
    dark: 64,
    tiles: [
      '################',
      '#o.o.......o...#',
      '#..............#',
      '#..............#',
      '#..o...........#',
      '#..............#',
      '#######.########',
      '################'
    ].join('\n'),
    spawns: { door: { x: 7, y: 5, face: 'up' }, default: { x: 7, y: 5, face: 'up' } },
    entities: [
      { t: 'cityfloor', v: 'e5_dad', x: 0, y: 0 },
      { t: 'cityprop', v: 'dadbounce', x: 7, y: 3 },
      { t: 'cityprop', v: 'dadrobe', x: 1, y: 1 },
      { t: 'cityprop', v: 'daddesk', x: 3, y: 1 },
      { t: 'cityprop', v: 'dadlamp', x: 3, y: 1, dx: 6 },
      { t: 'cityprop', v: 'dadclock', x: 3, y: 1, dx: -6 },
      { t: 'cityprop', v: 'dadseam', x: 2, y: 2, run: function () {
        if (NEU.photo && NEU.photo.take) NEU.photo.take();
      } },
      { t: 'cityprop', v: 'dadbed', x: 11, y: 1 },
      { t: 'cityprop', v: 'dadframe', x: 3, y: 4, lines: [
        'a picture frame, face down.',
        'dust holds it to the wood.'
      ] },
      { t: 'cityprop', v: 'dadnote', x: 4, y: 2, lines: [
        'a note lies on the desk.',
        'the letters are not letters you know.'
      ], run: function (api) {
        if (api && api.say) api.say([
          'a note lies on the desk.',
          'the letters are not letters you know.'
        ], 'narr');
        if (NEU.note && NEU.note.open) NEU.note.open();
      } },
      { t: 'exit', x: 7, y: 6, to: 'e3_hall', spawn: 'dad', style: 'door' }
    ],
    onEnter: function () {
      ticking = true;
      arm();
      if (NEU.juice && NEU.juice.burst) NEU.juice.burst(80, 64, 8, '#C8BBA8');
    },
    onExit: function () { ticking = false; }
  });

  if (NEU.act4RoomsD && NEU.act4RoomsD.indexOf('e5_dad') < 0) NEU.act4RoomsD.push('e5_dad');
})();
