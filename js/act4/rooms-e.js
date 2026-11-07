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
    var y;
    P(0, 0, 256, 128, '#121214');
    P(0, 0, 256, 26, '#1C1C20');
    P(0, 24, 256, 2, '#32323A');
    P(0, 26, 256, 4, '#18181C');
    for (y = 32; y < 120; y += 4) {
      P(0, y, 256, 3, ((y / 4) & 1) ? '#2A2824' : '#221F1C');
      P(0, y + 3, 256, 1, '#141210');
    }
    P(64, 72, 80, 28, '#241C16');
    P(66, 74, 76, 24, '#3A2C22');
    P(92, 40, 1, 1, '#6A6258');
    P(140, 88, 1, 1, '#5A534C');
    P(48, 100, 1, 1, '#6A6258');
  }

  if (NEU.lookCity && NEU.lookCity.rooms) {
    NEU.lookCity.rooms.e5_dad = { w: 16, h: 8, paint: paintRoom };
  }
  if (NEU.lookCity && NEU.lookCity.props) {
    var props = NEU.lookCity.props;
    props.dadrobe = { w: 20, h: 36, ax: 10, ay: 32, paint: function (P) {
      P(-8, -30, 16, 30, '#1A120E');
      P(-7, -29, 14, 28, '#3A2A22');
      P(-7, -29, 14, 2, '#4A382C');
      P(-1, -27, 1, 24, '#1A120E');
      P(2, -16, 2, 2, '#8A7048');
    } };
    props.dadbed = { w: 34, h: 18, ax: 17, ay: 14, paint: function (P) {
      P(-15, -12, 30, 12, '#1A120E');
      P(-14, -11, 28, 8, '#4A3428');
      P(-14, -11, 28, 2, '#5A4030');
      P(-12, -14, 10, 4, '#C8C0B0');
      P(-11, -13, 8, 2, '#E4DCC8');
      P(-4, -6, 16, 3, '#6A5040');
    } };
    props.daddesk = { w: 28, h: 20, ax: 14, ay: 16, paint: function (P) {
      P(-12, -14, 24, 4, '#1A120E');
      P(-11, -14, 22, 2, '#5A4634');
      P(-11, -12, 22, 1, '#3A2C20');
      P(-10, -10, 2, 10, '#2A2018');
      P(8, -10, 2, 10, '#2A2018');
      P(-8, -8, 16, 6, '#3A2C20');
      /* the drawer front sits flush. the seam is the compartment. */
      P(-6, -6, 12, 3, '#2E241C');
      P(-6, -4, 1, 4, '#120E0C');
    } };
    props.dadlamp = { w: 10, h: 16, ax: 5, ay: 14, paint: function (P) {
      P(-3, -4, 6, 4, '#1A120E');
      P(-1, -10, 2, 6, '#3A342C');
      P(-4, -14, 8, 4, '#C8A868');
      P(-3, -13, 6, 2, '#F2E2B0');
    }, light: function (e, d) {
      var r = 46;
      if (!reduced() && d && d.now) r = (Math.floor(d.now / 900) % 2) ? 40 : 46;
      return { r: r, col: '#E8C890', glow: 0.16 };
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
