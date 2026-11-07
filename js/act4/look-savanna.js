/* look-savanna.js — golden grass, ochre earth, acacia silhouettes.
   Rooms stay data in rooms-s.js. This file only draws them.
   savannafloor bakes a room once. savannaprop stands in it.
   savannafx is the heat shimmer and the wind. Under reduced motion
   the shimmer holds still; it never flashes. An unknown prop is a
   magenta box. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var KK = NEU.engineKinds;
  if (!KK) return;

  var T = 16;
  var paints = {};

  function L() { return NEU.engineLook; }
  function still() { var l = L(); return !l || !!l.reduced; }
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
    g.imageSmoothingEnabled = false;
    var y, x, row, ch, run, col;
    for (y = 0; y < room.h; y++) {
      row = room.grid[y] || '';
      run = -1;
      col = '';
      for (x = 0; x <= row.length; x++) {
        ch = row[x];
        var next = ch === '#' ? '#8A5A28' : ch === ',' ? '#C47A32' : ch === '=' ? '#A86828' : '#E2B84A';
        if (x === row.length) next = '';
        if (run < 0) { run = x; col = next; continue; }
        if (next !== col) {
          g.fillStyle = col;
          g.fillRect(run * T, y * T, (x - run) * T, T);
          run = x;
          col = next;
        }
      }
      for (x = 0; x < row.length; x++) {
        if (row[x] === '#' || ((x * 13 + y * 7) % 11) !== 0) continue;
        g.fillStyle = '#C8A040';
        g.fillRect(x * T + 4, y * T + 6, 2, 4);
      }
    }
    return cv;
  }

  KK.kind('savannafloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) {
      var room = roomOf(d);
      if (!room || !room.grid) return;
      var cv = bake(room);
      var S = d.S || 1;
      var sm = g.imageSmoothingEnabled;
      g.imageSmoothingEnabled = false;
      g.drawImage(cv, d.sx - (e.x + 0.5) * T * S, d.sy - (e.y + 1) * T * S, cv.width * S, cv.height * S);
      g.imageSmoothingEnabled = sm;
    }
  });

  function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

  function acacia(g, x, y, S) {
    px(g, x - S, y - 14 * S, 2 * S, 14 * S, '#3A2410');
    px(g, x - 10 * S, y - 18 * S, 20 * S, 4 * S, '#3A2410');
    px(g, x - 8 * S, y - 20 * S, 6 * S, 3 * S, '#5C3A18');
    px(g, x + 2 * S, y - 20 * S, 7 * S, 3 * S, '#5C3A18');
    px(g, x - 6 * S, y - 22 * S, 4 * S, 2 * S, '#6A4420');
  }
  function hut(g, x, y, S) {
    px(g, x - 8 * S, y - 10 * S, 16 * S, 10 * S, '#A86828');
    px(g, x - 10 * S, y - 14 * S, 20 * S, 4 * S, '#6A4420');
    px(g, x - 2 * S, y - 6 * S, 4 * S, 6 * S, '#3A2410');
  }
  function well(g, x, y, S) {
    px(g, x - 6 * S, y - 6 * S, 12 * S, 6 * S, '#8A5A28');
    px(g, x - 4 * S, y - 5 * S, 8 * S, 3 * S, '#3A2410');
    px(g, x - S, y - 12 * S, 2 * S, 8 * S, '#5C3A18');
  }

  KK.kind('savannaprop', {
    interactive: function () { return false; },
    width: function () { return 16; },
    draw: function (g, e, d) {
      var S = d.S || 1, x = d.sx, y = d.sy;
      if (e.v === 'acacia') { acacia(g, x, y, S); return; }
      if (e.v === 'hut') { hut(g, x, y, S); return; }
      if (e.v === 'well') { well(g, x, y, S); return; }
      g.fillStyle = '#FF00FF';
      g.fillRect(x - 8 * S, y - 16 * S, 16 * S, 16 * S);
    }
  });

  /* Heat bands step every 400 ms (2.5 Hz). Reduced motion draws the
     same bands at offset 0. Wind specks freeze in that case too. */
  KK.kind('savannafx', {
    interactive: function () { return false; },
    draw: function (g, e, d) {
      var hold = still();
      var step = hold ? 0 : ((d.now / 400) | 0) % 3;
      var S = d.S || 1;
      var w = (g.canvas && g.canvas.width) || 320;
      var i, y, xoff, wx;
      for (i = 0; i < 6; i++) {
        y = 8 * S + i * 10 * S;
        xoff = hold ? 0 : (step === (i % 3) ? 2 * S : 0);
        g.fillStyle = i % 2 ? '#F0D48A' : '#E6C36A';
        g.fillRect(xoff, y, 8 * S, S);
      }
      for (i = 0; i < 5; i++) {
        wx = hold ? (i * 12 * S) : ((i * 12 + step * 4) * S) % (w || 40);
        g.fillStyle = '#F4E2A8';
        g.fillRect(wx, 4 * S + i * 6 * S, S, S);
      }
    }
  });
})();
