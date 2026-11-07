/* look-exo.js — Exo lab: dark steel, hazard stripes, cyan holograms,
   red sensor eyes. exofloor bakes a room once. exoprop stands in it.
   The spiral scene paints through paintSpiral. An unknown prop is a
   magenta box. Sensor eyes blink at 2 Hz. prefers-reduced-motion
   holds them on. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var T = 16;
  var paints = {};

  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  function px(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(x | 0, y | 0, w | 0, h | 0);
  }
  function faceOf(step) { return ((step | 0) + 4) % 8; }
  function eyeOn(t) {
    if (reduced()) return true;
    var p = (typeof t === 'number' ? t : 0) % 0.5;
    if (p < 0) p += 0.5;
    return p < 0.25;
  }
  function steel(g, x, y, w, h) {
    var row, band, hh;
    for (row = 0; row < h; row += 4) {
      band = ((row / 4) % 2) === 0 ? '#1A1E24' : '#2A3038';
      hh = h - row;
      if (hh > 4) hh = 4;
      px(g, x, y + row, w, hh, band);
    }
  }
  function stripes(g, x, y, w, h) {
    var i, ww, c;
    for (i = 0; i < w; i += 4) {
      c = ((i / 4) % 2) === 0 ? '#E2C04A' : '#1A1E24';
      ww = w - i;
      if (ww > 4) ww = 4;
      px(g, x + i, y, ww, h, c);
    }
  }
  function holo(g, x, y) {
    px(g, x, y, 10, 14, '#103038');
    px(g, x + 1, y + 2, 8, 2, '#20C8D0');
    px(g, x + 1, y + 6, 6, 2, '#20C8D0');
    px(g, x + 1, y + 10, 8, 2, '#48E0E8');
  }
  function eye(g, x, y, on) {
    px(g, x, y, 6, 4, '#1A1E24');
    px(g, x + 1, y + 1, 4, 2, on ? '#E02020' : '#3A1010');
  }
  function draedon(g, x, y, face) {
    var turn = (face % 8) - 4;
    var arm = turn * 2;
    px(g, x - 8, y - 20, 16, 14, '#5A6A78');
    px(g, x - 6, y - 22, 12, 6, '#3A4A58');
    px(g, x - 5, y - 20, 10, 2, '#101418');
    px(g, x - 4 + (turn < 0 ? -1 : 0), y - 20, 6, 1, '#E02020');
    px(g, x + 6 + arm, y - 16, 8, 3, '#8A9098');
    px(g, x + 12 + arm, y - 18, 3, 6, '#6A7078');
  }
  function chair(g, x, y, face) {
    var lean = (face % 8) - 4;
    px(g, x - 12 + lean, y - 6, 24, 6, '#2A3038');
    px(g, x - 10 + lean, y - 8, 20, 3, '#3A4450');
    px(g, x - 8, y, 16, 3, '#20C8D0');
    px(g, x - 14, y + 2, 4, 3, '#20C8D0');
    px(g, x + 10, y + 2, 4, 3, '#20C8D0');
  }
  function paintSpiral(g, st) {
    var climb = st.climb || 0;
    var face = st.face | 0;
    var o0 = (climb * 8) | 0;
    var o1 = (climb * 20) | 0;
    var o2 = (climb * 36) | 0;
    var i, sx;
    try { g.imageSmoothingEnabled = false; } catch (e0) {}
    steel(g, 0, 0, 160, 96);
    for (i = 0; i < 6; i++) {
      sx = 8 + i * 24 - (o0 % 24);
      px(g, sx, 70 - i * 8, 20, 4, '#3A4450');
    }
    stripes(g, 0, 88, 160, 8);
    px(g, 20 - (o1 % 16), 16, 28, 18, '#12161C');
    holo(g, 100 - (o2 % 12), 12);
    eye(g, 4, 4, eyeOn(st.t || 0));
    eye(g, 150, 4, eyeOn(st.t || 0));
    chair(g, 80, 28, face);
    draedon(g, 80, 26, face);
    st.parallax = [o0, o1, o2];
  }

  NEU.exoLook = {
    reduced: reduced,
    faceOf: faceOf,
    eyeOn: eyeOn,
    paintSpiral: paintSpiral
  };

  var KK = NEU.engineKinds;
  if (!KK) return;

  function roomOf(d) {
    if (d && d.room && d.room.grid) return d.room;
    return (d && d.api && d.api.room) || null;
  }
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    return c;
  }
  function bake(room) {
    var hit = paints[room.id];
    if (hit) return hit;
    var cv = mk(room.w * T, room.h * T);
    var g = cv.getContext && cv.getContext('2d');
    paints[room.id] = cv;
    if (!g) return cv;
    try { g.imageSmoothingEnabled = false; } catch (e1) {}
    var y, x, row, ch;
    for (y = 0; y < room.h; y++) {
      row = room.grid[y] || '';
      for (x = 0; x < row.length; x++) {
        ch = row.charAt(x);
        if (ch === '#') steel(g, x * T, y * T, T, T);
        else if (ch === '=') stripes(g, x * T, y * T, T, T);
        else if (ch === ',') px(g, x * T, y * T, T, T, '#12383C');
        else if (ch === '.') px(g, x * T, y * T, T, T, '#1A1E24');
        else px(g, x * T, y * T, T, T, '#FF00FF');
      }
    }
    return cv;
  }

  KK.kind('exofloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) {
      var room = roomOf(d);
      if (!room || !room.grid) return;
      var cv = bake(room);
      var S = d.S || 1;
      var sm = g.imageSmoothingEnabled;
      try { g.imageSmoothingEnabled = false; } catch (e2) {}
      g.drawImage(cv, d.sx - (e.x + 0.5) * T * S, d.sy - (e.y + 1) * T * S, cv.width * S, cv.height * S);
      g.imageSmoothingEnabled = sm;
    }
  });

  KK.kind('exoprop', {
    interactive: function () { return false; },
    width: function () { return 16; },
    draw: function (g, e, d) {
      var x = d.sx, y = d.sy, face = e.face || 4;
      try { g.imageSmoothingEnabled = false; } catch (e3) {}
      if (e.v === 'holo') holo(g, x - 5, y - 14);
      else if (e.v === 'eye') eye(g, x - 3, y - 8, eyeOn(e.t || 0));
      else if (e.v === 'chair') chair(g, x, y, face);
      else if (e.v === 'draedon') { chair(g, x, y, face); draedon(g, x, y - 2, face); }
      else px(g, x - 8, y - 16, 16, 16, '#FF00FF');
    }
  });
})();
