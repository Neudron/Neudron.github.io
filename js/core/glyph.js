/* Shared original pixel glyphs for DOM and canvas. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var SVG = 'http://www.w3.org/2000/svg';
  var grids = {
    sword: [1,3,6,44,24,20,34,64], dog: [0,65,99,127,126,62,28,0],
    hammer: [120,120,120,16,16,16,16,16], door: [62,34,34,42,34,34,34,127],
    heart: [0,54,127,127,62,28,8,0], graze: [8,8,42,28,127,28,42,8],
    gear: [20,62,119,65,65,119,62,20], map: [0,109,91,91,109,109,107,0],
    note: [6,5,4,4,4,60,60,24], save: [127,93,93,65,127,99,99,127],
    dash: [8,4,2,127,2,4,8,0], fire: [8,12,44,62,126,127,62,28],
    timer: [127,34,20,8,8,20,34,127], eyes: [0,28,34,93,93,34,28,0],
    player: [28,28,28,8,62,8,20,34], sound: [4,12,28,61,61,28,12,4],
    deck: [0,127,65,93,85,65,127,0], lamp: [8,28,62,62,8,8,62,0],
    battery: [28,127,65,93,93,93,65,127], dock: [65,65,93,93,93,65,127,0],
    glass: [65,2,36,24,44,3,65,0], rest: [0,12,24,24,25,30,12,0],
    card: [62,34,42,62,42,34,62,0], list: [0,75,0,75,0,75,0,0],
    shield: [127,65,65,65,34,34,20,8], open: [8,28,42,8,8,20,34,0],
    target: [28,34,73,85,73,34,28,0], bag: [28,20,62,99,65,73,65,127],
    check: [0,1,2,4,72,48,32,0], cross: [0,65,34,20,8,20,34,65],
    coin: [28,34,73,93,73,34,28,0], camera: [0,12,127,65,93,93,65,127],
    grid: [119,85,119,0,119,85,119,0], key: [0,56,40,56,16,30,20,0],
    reset: [28,34,65,1,113,65,34,28], arrow: [8,28,42,73,8,8,8,0],
    block: [126,66,90,90,90,66,126,0], plate: [0,0,0,0,62,65,127,0],
    talk: [0,126,65,85,65,126,16,32], potion: [28,8,8,28,34,62,62,28],
    ground: [0,8,20,34,8,0,127,127], mountain: [0,8,20,34,34,69,127,0],
    warning: [8,20,20,42,42,65,73,127], lock: [28,34,34,127,65,73,65,127]
  };
  var questGlyphs = { sans: 'player', break: 'sword', door: 'door', survive: 'timer',
    dog: 'dog', hammer: 'hammer', smash: 'glass', greydoor: 'door', answers: 'sound',
    clicker: 'key', fixed: 'lamp', sleep: 'rest', console: 'deck', charge: 'battery',
    docked: 'dock', deck: 'card', a4_garage: 'map' };
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function quest(id) { return own(questGlyphs, id) ? questGlyphs[id] : 'list'; }
  function compact() {
    return document.documentElement.classList.contains('neu-hints-off') &&
      !(NEU.motion && NEU.motion.reduced());
  }
  function cells(name, cb) {
    var rows = own(grids, name) ? grids[name] : grids.list;
    for (var y = 0; y < rows.length; y++)
      for (var x = 0; x < 7; x++)
        if (rows[y] & (64 >> x)) cb(x, y);
  }
  function icon(name) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 8 8');
    svg.setAttribute('class', 'glyph__shape');
    svg.setAttribute('data-glyph', name);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    cells(name, function (x, y) {
      var p = document.createElementNS(SVG, 'rect');
      p.setAttribute('x', x); p.setAttribute('y', y);
      p.setAttribute('width', 1); p.setAttribute('height', 1);
      svg.appendChild(p);
    });
    return svg;
  }
  function put(el, name, text) {
    el.textContent = '';
    var copy = document.createElement('span');
    copy.className = 'glyph__copy'; copy.textContent = text;
    el.appendChild(icon(name)); el.appendChild(copy);
  }
  function draw(ctx, name, x, y) {
    x = Math.round(x); y = Math.round(y);
    var rows = own(grids, name) ? grids[name] : grids.list;
    for (var j = 0; j < rows.length; j++)
      for (var i = 0; i < 7; i++)
        if (rows[j] & (64 >> i)) ctx.fillRect(x + i * 2, y + j * 2, 2, 2);
  }
  function key(def) {
    return (NEU.keys ? NEU.keys.label(def) : def).toUpperCase();
  }
  function meter(n) {
    var span = document.createElement('span');
    span.className = 'glyph__shape glyph__meter';
    span.setAttribute('data-tier', n);
    span.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 7; i++) {
      var pip = document.createElement('i');
      if (i < n) pip.className = 'is-filled';
      span.appendChild(pip);
    }
    return span;
  }
  function markup(name) { return icon(name).outerHTML; }
  NEU.glyph = { compact: compact, icon: icon, put: put, draw: draw,
                key: key, meter: meter, markup: markup, quest: quest };
  function hydrate() {
    var slots = document.querySelectorAll('[data-glyph-slot]');
    for (var i = 0; i < slots.length; i++)
      slots[i].appendChild(icon(slots[i].getAttribute('data-glyph-slot')));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate);
  else hydrate();
})();
