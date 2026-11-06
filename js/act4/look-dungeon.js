/* look-dungeon.js — dungeon tileset bake and decor kinds (W3.2). */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat;
  if (!P || !P._kinds) return;
  var kinds = P._kinds;
  var HZ = 2;
  var BANDS = {
    blue:  { brick: '#2B3A67', hi: '#3E5490', mort: '#1A2340', wall: '#24325C' },
    green: { brick: '#158039', hi: '#3CAA68', mort: '#0A4020', wall: '#0C3024' },
    pink:  { brick: '#D040A0', hi: '#F070C0', mort: '#602050', wall: '#4A1848' }
  };
  var last = null, cur = BANDS.blue, candles = [], flickT = 0, bake = null;

  function reducedNow() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  function candleOn(t) {
    if (reducedNow()) return 1;
    return (Math.floor(t * HZ) % 2) === 0 ? 1 : 0;
  }
  function bandOf(id) {
    var m = /^d(\d+)$/.exec(id || ''), n = m ? +m[1] : 0;
    if (n >= 8) return 'pink';
    if (n >= 4) return 'green';
    return 'blue';
  }
  function box(c, style, x, y, w, h) {
    x = x | 0; y = y | 0; w = w | 0; h = h | 0;
    if (w <= 0 || h <= 0) return;
    c.fillStyle = style;
    if (last) last.colors[style] = (last.colors[style] || 0) + 1;
    c.fillRect(x, y, w, h);
  }
  function drawBack(c, px, py, x, y) {
    box(c, cur.wall, px, py, 16, 16);
    box(c, cur.mort, px, py + 15, 16, 1);
    if (((x + y) & 1) === 0) box(c, cur.mort, px + 3, py + 4, 2, 2);
    if (((x * 3 + y) & 3) === 0) box(c, cur.mort, px + 10, py + 8, 2, 2);
    if (last) last.back++;
  }
  function drawBrick(c, px, py, lip) {
    box(c, cur.mort, px, py, 16, 16);
    box(c, cur.brick, px + 1, py + 1, 6, 6);
    box(c, cur.brick, px + 9, py + 1, 6, 6);
    box(c, cur.brick, px + 1, py + 9, 6, 6);
    box(c, cur.brick, px + 9, py + 9, 6, 6);
    box(c, cur.hi, px + 1, py + 1, 6, 2);
    box(c, cur.hi, px + 9, py + 1, 6, 2);
    box(c, cur.hi, px + 1, py + 9, 6, 2);
    box(c, cur.hi, px + 9, py + 9, 6, 2);
    if (lip) box(c, cur.hi, px, py, 16, 3);
  }
  function drawChain(c, px, py) {
    box(c, '#8A8A6A', px + 7, py, 2, 16);
    box(c, '#C8C8A0', px + 5, py + 2, 6, 2);
    box(c, '#6A6A4A', px + 5, py + 6, 6, 2);
    box(c, '#C8C8A0', px + 5, py + 10, 6, 2);
  }
  function drawBanner(c, px, py) {
    box(c, cur.mort, px + 2, py, 12, 2);
    box(c, cur.hi, px + 3, py + 2, 10, 9);
    box(c, cur.brick, px + 3, py + 11, 4, 4);
    box(c, cur.brick, px + 9, py + 11, 4, 4);
  }
  function drawShelf(c, px, py) {
    box(c, '#504030', px + 1, py + 1, 14, 14);
    box(c, '#C8B070', px + 2, py + 3, 2, 9);
    box(c, '#E8D8C8', px + 5, py + 3, 2, 9);
    box(c, '#A05048', px + 8, py + 3, 2, 9);
    box(c, '#4060A0', px + 11, py + 3, 2, 9);
    box(c, '#3A2A20', px + 1, py + 13, 14, 2);
  }
  function drawCandle(c, px, py, t) {
    box(c, cur.wall, px + 5, py + 1, 6, 6);
    box(c, '#8A8A6A', px + 3, py + 12, 10, 3);
    box(c, '#E8D8A0', px + 6, py + 6, 4, 6);
    if (candleOn(t)) {
      box(c, '#A02B08', px + 7, py + 4, 2, 2);
      box(c, '#F8A030', px + 7, py + 2, 2, 2);
    }
  }
  function drawSpike(c, px, py, ch) {
    var col = '#E4E4EC', edge = '#9AA0A8';
    if (ch === '^') {
      box(c, col, px + 7, py + 1, 2, 6);
      box(c, col, px + 5, py + 6, 6, 4);
      box(c, edge, px + 3, py + 10, 10, 6);
    } else if (ch === 'v') {
      box(c, edge, px + 3, py, 10, 6);
      box(c, col, px + 5, py + 6, 6, 4);
      box(c, col, px + 7, py + 9, 2, 6);
    } else if (ch === '<') {
      box(c, col, px + 1, py + 7, 6, 2);
      box(c, col, px + 6, py + 5, 4, 6);
      box(c, edge, px + 10, py + 3, 6, 10);
    } else {
      box(c, edge, px, py + 3, 6, 10);
      box(c, col, px + 6, py + 5, 4, 6);
      box(c, col, px + 9, py + 7, 6, 2);
    }
  }
  function drawBone(c, px, py) {
    box(c, '#2A241C', px + 3, py + 1, 10, 14);
    box(c, '#E8D2B0', px + 4, py + 2, 8, 6);
    box(c, '#1A120C', px + 5, py + 4, 2, 2);
    box(c, '#1A120C', px + 9, py + 4, 2, 2);
    box(c, '#C4A882', px + 5, py + 8, 2, 6);
    box(c, '#C4A882', px + 9, py + 8, 2, 6);
    if (last) last.bone = true;
  }
  function drawSign(c, px, py) {
    box(c, '#6A4030', px + 7, py + 8, 2, 8);
    box(c, '#C4A060', px + 2, py + 2, 12, 8);
    box(c, '#8A6840', px + 4, py + 5, 8, 1);
  }

  kinds.chain = { draw: function (c, px, py) { drawChain(c, px, py); } };
  kinds.banner = { draw: function (c, px, py) { drawBanner(c, px, py); } };
  kinds.shelf = { draw: function (c, px, py) { drawShelf(c, px, py); } };
  kinds.candle = { draw: function (c, px, py, t) { drawCandle(c, px, py, t); } };

  function paint(level) {
    if (!level || !level.grid) return;
    cur = BANDS[bandOf(level.id)] || BANDS.blue;
    candles = [];
    flickT = 0;
    last = { band: bandOf(level.id), back: 0, chains: 0, banners: 0, shelves: 0, candles: 0, spikes: 0, arch: 0, bone: false, colors: {} };
    NEU.dungeonLook.last = last;
    var cv = bake, c = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!c) return;
    try { c.imageSmoothingEnabled = false; } catch (e0) {}
    var y, x, row, ch, px, py, i, e;
    for (y = 0; y < level.h; y++) {
      row = level.grid[y] || '';
      for (x = 0; x < level.w; x++) {
        ch = x < row.length ? row.charAt(x) : '.';
        px = x * 16; py = y * 16;
        if (ch === '#' || ch === 'x' || ch === '=') {
          drawBrick(c, px, py, ch === '=');
          if (level.id === 'd0' && y <= 8 && ch === '#') {
            last.arch++;
            if (((x + y) % 3) === 0) box(c, cur.mort, px + 8, py + 6, 5, 5);
          }
        } else {
          drawBack(c, px, py, x, y);
          if (ch === 'c') { kinds.chain.draw(c, px, py); last.chains++; }
          else if (ch === 'b') { kinds.banner.draw(c, px, py); last.banners++; }
          else if (ch === 'k') { kinds.shelf.draw(c, px, py); last.shelves++; }
          else if (ch === 'w') { kinds.candle.draw(c, px, py, 0); candles.push(px, py); last.candles++; }
          else if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') { drawSpike(c, px, py, ch); last.spikes++; }
          else if (ch === 'n') drawSign(c, px, py);
        }
      }
    }
    if (level.entities) for (i = 0; i < level.entities.length; i++) {
      e = level.entities[i];
      if (e.t === 'bossdoor') drawBone(c, e.x * 16, e.y * 16);
    }
  }
  function flick(dt) {
    if (!candles.length || !bake || !bake.getContext) return;
    var sec = typeof dt === 'number' ? dt : 0;
    if (sec > 2) sec = sec / 1000;
    if (sec > 0.25) sec = 0.25;
    if (!reducedNow()) flickT += sec;
    var c = bake.getContext('2d'), i;
    if (!c) return;
    for (i = 0; i < candles.length; i += 2) kinds.candle.draw(c, candles[i], candles[i + 1], flickT);
  }

  NEU.dungeonLook = { tileset: 'dungeon', hz: HZ, candleOn: candleOn, paint: paint, flick: flick, last: null, canvas: null };
  if (document && document.createElement) {
    var origCreate = document.createElement;
    document.createElement = function (tag) {
      var el = origCreate.call(document, tag);
      if (el && String(tag).toLowerCase() === 'canvas') {
        bake = el;
        NEU.dungeonLook.canvas = el;
      }
      return el;
    };
  }
})();
