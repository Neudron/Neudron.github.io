/* menu.js — the in-game main menu (Play / Config / Save).
   ───────────────────────────────────────────────────────────────────
   A real menu for the hidden game, not for the public landing page:
   nothing here exists until a game script opens it. One authority for
   every value it shows — NEU.save owns the file, NEU.diff owns the
   tiers, NEU.settings owns the options, NEU.act4 owns launching.
   This module only lays out buttons and hands focus between them.

   z 93: under settings (94) and the dialogue box (96), over every
   scene. Arrow keys wrap, Escape goes back one screen, Tab is trapped
   inside the overlay, and every action works with a mouse as well.  */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  if (NEU.menu) return;                       /* built already */

  /* One short line per tier. These describe the maths in diff.js and
     nothing else — no story, no names of rooms, fights or items. */
  var FX = {
    bot: 'bullets barely move. a very gentle introduction.',
    easy: 'slower bullets and wider gaps.',
    medium: 'the intended balance of speed and room.',
    hard: 'faster bullets, tighter gaps to slip through.',
    vhard: 'tougher fights and longer waits between heals.',
    ultrakill: 'very fast patterns; healing costs more time.',
    finalbreath: 'the fastest patterns, and no healing at all.'
  };
  var FALLBACK_FX = 'changes how hard the fights press you.';

  /* The difficulty detail panel reads these straight off NEU.diff's table,
     so the numbers shown can never drift from the numbers fights use.
     [param, label, word when above 1, word when below 1] */
  var STATS = [
    ['bulletSpeed', 'pattern speed', 'faster', 'slower'],
    ['gap', 'room between shots', 'wider', 'tighter'],
    ['tele', 'warning before attacks', 'longer', 'shorter'],
    ['iframes', 'mercy after a hit', 'longer', 'shorter'],
    ['bossHp', 'enemy toughness', 'tougher', 'softer'],
    ['dmg', 'your damage', 'stronger', 'weaker'],
    ['healCd', 'wait between heals', 'longer', 'shorter']
  ];
  /* Each tier's personality in the detail panel: a banner word, a line of
     attitude, and a mood the CSS animates (sleepy, breathing, stamp,
     speed, thud, glitch, last breath). No numbers here: those come from
     the table, so the copy can never disagree with the fights. */
  var MOOD = {
    bot: ['slow motion', 'sit back. nothing in here is in a hurry.'],
    easy: ['breathing room', 'wider gaps, longer warnings, a softer landing.'],
    medium: ['as intended', 'every dial sits at one. this is the fight as built.'],
    hard: ['faster', 'the patterns stop waiting for you.'],
    vhard: ['tougher foes', 'they take longer to go down. so do your heals.'],
    ultrakill: ['ultrakill', 'less mercy. less room. no time to think.'],
    finalbreath: ['no healing', 'one breath. make it count.']
  };
  /* Final Breath first tells a lie: Easy's numbers, read as good news,
     until her cuts tear each one open. Tags per stat. */
  var LIE_TAG = { bulletSpeed: 'slow!', gap: 'roomy!', tele: 'plenty!', iframes: 'safe!',
                  bossHp: 'soft!', dmg: 'strong!', healCd: 'quick!' };
  var LIE_LINE = 'take your time. nothing in here can hurt you.';
  /* One line under the window for whatever the cursor is on. */
  var HINT = {
    Resume: 'back to where you were.',
    Play: 'carry on, or start from the beginning.',
    Config: 'sound, keys, motion and difficulty.',
    Save: 'three slots, plus export and import.',
    Exit: 'leave the game. your save is kept.',
    Back: 'go back one screen.',
    Keep: 'leave it as it is.',
    'breathe in': 'start on the last tier. no heals, at all.'
  };
  /* the tier's sound when the cursor lands on it, from the sounds the
     fights already use; the three calm tiers stay quiet */
  var MOOD_SFX = { hard: 'whoosh', vhard: 'hit', ultrakill: 'snap', finalbreath: 'heart' };
  var TAG = { root: 'menu', difficulty: 'difficulty', progress: 'progress', save: 'save',
              confirm: 'confirm', export: 'export', import: 'import' };

  var box = null, screen = 'root', active = false, returnTo = null;
  var list = [], index = 0, announce = null;
  var pending = null, importText = '';
  var paused = false;

  function reduced() {
    try {
      if (NEU.settings && NEU.settings.reduced) return !!NEU.settings.reduced;
      if (NEU.motion && NEU.motion.reduced) return !!NEU.motion.reduced();
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function button(label, cls, fn) {
    var b = el('button', 'menu__act' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  function build() {
    box = el('div', 'menu');
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'main menu');
    box.tabIndex = -1;
    /* Title plate above the window, window, description strip, key bar:
       the same four layers as the deck and settings. */
    var head = el('div', 'menu__head');
    var title = el('h2', 'menu__title');
    title.appendChild(el('span', 'menu__title-t', 'neu'));   /* read aloud; the eye gets the drawn logo */
    title.insertAdjacentHTML('beforeend', logoSvg());
    head.appendChild(title);
    var drop = el('span', 'menu__drop');
    drop.setAttribute('aria-hidden', 'true');
    head.appendChild(drop);
    var ver = NEU.save && NEU.save.VERSION ? NEU.save.VERSION : 3;
    head.appendChild(el('span', 'menu__ver', 'v' + ver));
    box.appendChild(head);
    var win = el('div', 'menu__win');
    var cols = el('div', 'menu__cols');
    var body = el('div', 'menu__screen');
    cols.appendChild(body);
    /* A visual copy of what the focused button already says or does;
       screen readers get it from the button itself. */
    var side = el('div', 'menu__side');
    side.setAttribute('aria-hidden', 'true');
    cols.appendChild(side);
    win.appendChild(cols);
    announce = el('p', 'menu__note');
    announce.setAttribute('aria-live', 'polite');
    win.appendChild(announce);
    box.appendChild(win);
    var desc = el('p', 'menu__desc');
    desc.setAttribute('aria-hidden', 'true');
    box.appendChild(desc);
    var legend = el('p', 'menu__keys');
    /* data-k: keys.js relabels these when the player rebinds z or x */
    var kz = NEU.keys ? NEU.keys.label('z') : 'z', kx = NEU.keys ? NEU.keys.label('x') : 'x';
    legend.innerHTML = '<kbd aria-hidden="true">\u2191\u2193</kbd><span class="glyph__copy">choose</span>' +
      '<kbd aria-hidden="true" data-k="z">' + kz + '</kbd><span class="glyph__copy">confirm</span>' +
      '<kbd aria-hidden="true" data-k="x">' + kx + '</kbd><span class="glyph__copy">back</span>';
    box.appendChild(legend);
    document.body.appendChild(box);
    box._body = body;
    box._win = win;
    box._side = side;
    box._desc = desc;
    box.addEventListener('focusin', function (e) { describe(e.target); });
    /* the pointer moves the same cursor the arrows do */
    body.addEventListener('mouseover', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.menu__act, .menu__tier') : null;
      var i = list.indexOf(b);
      if (i >= 0 && b !== document.activeElement) focusAt(i);
    });
  }

  /* ── the logo ───────────────────────────────────────────────────
     NEU drawn on a pixel grid, not typed: white body, two stepped shade
     rows at the foot, a purple shadow one cell down-right. */
  var LOGO = [
    'XX.....XX..XXXXXXXX..XX.....XX',
    'XXX....XX..XXXXXXXX..XX.....XX',
    'XXXX...XX..XX........XX.....XX',
    'XX.XX..XX..XX........XX.....XX',
    'XX..XX.XX..XXXXXXX...XX.....XX',
    'XX...XXXX..XX........XX.....XX',
    'XX....XXX..XX........XX.....XX',
    'XX.....XX..XXXXXXXX..XXXXXXXXX',
    'XX.....XX..XXXXXXXX...XXXXXXX.'
  ];
  function logoSvg() {
    var w = LOGO[0].length, h = LOGO.length, out = '', pass, x, y, c;
    for (pass = 0; pass < 2; pass++)
      for (y = 0; y < h; y++)
        for (x = 0; x < w; x++) {
          if (LOGO[y].charAt(x) !== 'X') continue;
          c = pass === 0 ? '#4A3A5E' : y < h - 2 ? '#FFFFFF' : y < h - 1 ? '#C8C8E8' : '#9DA2C4';
          out += '<rect x="' + (x + 1 - pass) + '" y="' + (y + 1 - pass) + '" width="1" height="1" fill="' + c + '"/>';
        }
    return '<svg class="menu__logo" viewBox="0 0 ' + (w + 1) + ' ' + (h + 1) + '" aria-hidden="true" focusable="false" shape-rendering="crispEdges">' + out + '</svg>';
  }

  /* ── live preview ───────────────────────────────────────────────
     A small bullet box in the difficulty panel: walls of shots scroll in
     with a hole in each, spaced, sized and timed by this tier's real
     numbers (pattern speed, room between shots, warning time, mercy
     after a hit). The soul steers for the hole by itself; the harder
     tiers clip it, and it goes dark for its mercy time. Seeded, so a tier
     replays the same loop. Calm motion draws one still frame. */
  var PW = 200, PH = 28, SX = 40, pv = null;
  var HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
  function previewStop() { if (pv && pv.raf) cancelAnimationFrame(pv.raf); pv = null; }
  function previewStart(cv, n) {
    previewStop();
    var cx = null;
    try { cx = cv.getContext ? cv.getContext('2d') : null; } catch (e) { cx = null; }
    var T = NEU.diff && NEU.diff.table ? NEU.diff.table() : null;
    if (!cx || !T) return;
    pv = { cx: cx, spd: 40 * T.bulletSpeed[n], gap: 11 * T.gap[n], tele: 0.6 * T.tele[n],
           mercy: 0.7 * T.iframes[n], walls: [], next: 0, y: PH / 2, inv: 0, seed: 11 + n * 7, last: 0, raf: 0 };
    if (reduced()) { for (var s = 0; s < 150; s++) pvStep(1 / 60); pvDraw(); return; }
    pv.raf = requestAnimationFrame(pvTick);
  }
  function pvRand() { pv.seed = (pv.seed * 16807) % 2147483647; return pv.seed / 2147483647; }
  function pvTick(now) {
    if (!pv) return;
    var dt = pv.last ? Math.min(0.05, (now - pv.last) / 1000) : 0;
    pv.last = now;
    pvStep(dt); pvDraw();
    pv.raf = requestAnimationFrame(pvTick);
  }
  function pvStep(h) {
    var i, w, tgt = null;
    pv.next -= h;
    /* walls sit 64px apart, so a faster tier sends them more often */
    if (pv.next <= 0) { pv.walls.push({ x: PW, hole: 2 + pvRand() * (PH - 4 - pv.gap), warn: pv.tele }); pv.next = 64 / pv.spd; }
    if (pv.inv > 0) pv.inv -= h;
    for (i = pv.walls.length - 1; i >= 0; i--) {
      w = pv.walls[i];
      if (w.warn > 0) { w.warn -= h; continue; }
      w.x -= pv.spd * h;
      if (w.x < -4) { pv.walls.splice(i, 1); continue; }
      if (Math.abs(w.x - SX) < 3 && pv.inv <= 0 && (pv.y - 2 < w.hole || pv.y + 2 > w.hole + pv.gap)) pv.inv = pv.mercy;
    }
    for (i = 0; i < pv.walls.length; i++) if (pv.walls[i].x + 2 >= SX - 3) { tgt = pv.walls[i]; break; }
    if (tgt) {
      var aim = tgt.hole + pv.gap / 2, d = aim - pv.y, cap = 20 * h;
      pv.y += d > cap ? cap : d < -cap ? -cap : d;
    }
  }
  function pvDraw() {
    var c = pv.cx, i, y, w, r, x;
    c.fillStyle = '#000'; c.fillRect(0, 0, PW, PH);
    for (i = 0; i < pv.walls.length; i++) {
      w = pv.walls[i];
      if (w.warn > 0) {
        /* the warning: yellow brackets at the box's edge marking the hole */
        c.fillStyle = '#FFFF00';
        c.fillRect(PW - 3, Math.round(w.hole) - 1, 3, 1);
        c.fillRect(PW - 3, Math.round(w.hole + pv.gap), 3, 1);
        continue;
      }
      c.fillStyle = '#FFFFFF';
      for (y = 0; y < PH; y += 4) if (y + 2 <= w.hole || y >= w.hole + pv.gap) c.fillRect(Math.round(w.x), y, 2, 2);
    }
    c.fillStyle = pv.inv > 0 ? '#7A0000' : '#FF0000';
    for (r = 0; r < HEART.length; r++)
      for (x = 0; x < 5; x++) if (HEART[r].charAt(x) === 'X') c.fillRect(SX - 2 + x, Math.round(pv.y) - 2 + r, 1, 1);
  }

  /* ── detail panel + description strip ───────────────────────── */
  function fmtMul(v, up, down) {
    if (v === 1) return 'standard';
    if (v >= 2) return v + '\u00d7 ' + up;
    return Math.round(Math.abs(v - 1) * 100) + '% ' + (v > 1 ? up : down);
  }

  /* Rows type out one after another (a stepped clip per row, --n letters
     from --d), so each line can be read before the next arrives. A row may
     carry a lie (rows[i][3]): it shows instead of the value until cut. */
  var CH_MS = 14, ROW_GAP = 90;
  function statList(rows) {
    var ul = el('ul', 'menu__stats'), d = 0;
    for (var i = 0; i < rows.length; i++) {
      var li = el('li', (rows[i][2] ? 'is-new' : '') + (rows[i][3] ? ' is-faking' : ''));
      var shown = rows[i][3] || rows[i][1], n = rows[i][0].length + shown.length + 3, dur = n * CH_MS;
      li.style.setProperty('--n', n);
      li.style.setProperty('--d', d + 'ms');
      li.appendChild(el('b', '', rows[i][0]));
      li.appendChild(el('span', '', rows[i][1]));
      if (rows[i][3]) li.appendChild(el('em', 'menu__fake', rows[i][3]));
      /* what this tier changes is shouted, once its row has arrived */
      if (rows[i][2]) { var tag = el('i', 'menu__new', 'new!'); tag.style.animationDelay = (d + dur) + 'ms'; li.appendChild(tag); }
      ul.appendChild(li);
      d += dur + ROW_GAP;
    }
    ul._end = d;
    return ul;
  }

  /* ── her cuts ───────────────────────────────────────────────────
     Supreme Calamitas' Calamitous Rend, in the menu: a hairline warning
     growing from its middle, then the white-hot rift with its brimstone
     bloom and embers, then a dark scar. Drawn on a half-resolution canvas
     over the window and scaled up pixelated. Sound and shake are hers:
     NEU.scal.sfx('giga-hit') and NEU.juice. Timers and the canvas die
     with the panel (seqStop). */
  var seq = [], sl = null;
  function seqLater(ms, fn) { seq.push(setTimeout(fn, ms)); }
  function seqStop() {
    for (var i = 0; i < seq.length; i++) clearTimeout(seq[i]);
    seq = [];
    if (sl) { if (sl.raf) cancelAnimationFrame(sl.raf); if (sl.cv.parentNode) sl.cv.parentNode.removeChild(sl.cv); }
    sl = null;
  }
  var canCut = null;
  function cutsOk() {
    if (canCut === null) {
      try { var t = document.createElement('canvas'); canCut = !!(t.getContext && t.getContext('2d')); } catch (e) { canCut = false; }
    }
    return canCut && !reduced();
  }
  function slashLayer() {
    if (sl) return sl;
    var w = box._win, cv = el('canvas', 'menu__slash'), cx = null;
    cv.width = Math.ceil(w.clientWidth / 2); cv.height = Math.ceil(w.clientHeight / 2);
    cv.setAttribute('aria-hidden', 'true');
    try { cx = cv.getContext('2d'); } catch (e) { cx = null; }
    if (!cx) return null;
    w.appendChild(cv);
    sl = { cv: cv, cx: cx, cuts: [], raf: 0 };
    sl.raf = requestAnimationFrame(slashDraw);
    return sl;
  }
  function rendLine(c, a, w, col) {
    c.strokeStyle = col; c.lineWidth = w;
    c.beginPath(); c.moveTo(a.x1, a.y1); c.lineTo(a.x2, a.y2); c.stroke();
  }
  function slashDraw(now) {
    if (!sl) return;
    var c = sl.cx, i, a, age, k, half, mx, my, dx, dy, j, s, d, nx, ny, L;
    c.clearRect(0, 0, sl.cv.width, sl.cv.height);
    c.lineCap = 'round';
    for (i = sl.cuts.length - 1; i >= 0; i--) {
      a = sl.cuts[i]; age = now - a.t0;
      mx = (a.x1 + a.x2) / 2; my = (a.y1 + a.y2) / 2; dx = a.x2 - a.x1; dy = a.y2 - a.y1;
      L = Math.sqrt(dx * dx + dy * dy) || 1; nx = -dy / L; ny = dx / L;
      if (age < a.tele) {
        /* the warning: a red hairline growing out from the middle */
        half = Math.min(1, age / a.tele) * 0.5;
        rendLine(c, { x1: mx - dx * half, y1: my - dy * half, x2: mx + dx * half, y2: my + dy * half },
          a.big ? 10 : 6, 'rgba(255,48,64,0.18)');
        rendLine(c, { x1: mx - dx * half, y1: my - dy * half, x2: mx + dx * half, y2: my + dy * half },
          a.big ? 2 : 1, 'rgba(255,90,100,0.9)');
        continue;
      }
      age -= a.tele;
      if (age < 320) {
        k = 1 - age / 320;
        c.globalCompositeOperation = 'lighter';
        rendLine(c, a, a.big ? 22 : 12, 'rgba(160,16,24,' + (0.5 * k).toFixed(2) + ')');
        rendLine(c, a, a.big ? 12 : 7, 'rgba(255,70,30,' + (0.65 * k).toFixed(2) + ')');
        rendLine(c, a, a.big ? 7 : 4, 'rgba(255,200,150,' + (0.9 * k).toFixed(2) + ')');
        rendLine(c, a, a.big ? 3 : 2, '#FFFFFF');
        /* embers, fixed seeds along the cut, thrown out both ways and up */
        c.fillStyle = 'rgba(255,170,80,' + k.toFixed(2) + ')';
        for (j = 0; j < (a.big ? 28 : 12); j++) {
          s = ((j * 0.618) % 1 - 0.5);
          d = (2 + age * (0.02 + (j % 5) * 0.01)) * (j % 2 ? 1 : -1);
          c.fillRect((mx + dx * s + nx * d) | 0, (my + dy * s + ny * d - age * 0.01) | 0, 1 + (j % 2), 1 + (j % 2));
        }
        c.globalCompositeOperation = 'source-over';
        continue;
      }
      age -= 320;
      if (age < 1400) { rendLine(c, a, 2, 'rgba(120,10,20,' + (0.6 * (1 - age / 1400)).toFixed(2) + ')'); continue; }
      sl.cuts.splice(i, 1);
    }
    sl.raf = requestAnimationFrame(slashDraw);
  }
  /* one cut across a row (or, big, across the whole panel through it);
     hit() runs when the rift opens */
  function cutAt(row, big, hit) {
    var L = slashLayer();
    if (!L) { hit(); return; }
    /* canvas space: the window's padding box (inside its 24px rim), at half scale */
    var wb = box._win.getBoundingClientRect(), r = row.getBoundingClientRect(), p = box._side.getBoundingClientRect();
    var ox = wb.left + box._win.clientLeft, oy = wb.top + box._win.clientTop;
    var y = (r.top + r.height / 2 - oy) / 2, a;
    if (big) a = { x1: (p.left - ox - 120) / 2, y1: (p.bottom - oy + 16) / 2, x2: (p.right - ox + 40) / 2, y2: (p.top - oy - 24) / 2 };
    else a = { x1: (r.left - ox - 16) / 2, y1: y + 5, x2: (r.left - ox + p.width - 8) / 2, y2: y - 5 };
    a.t0 = performance.now(); a.big = big; a.tele = big ? 420 : 140;
    L.cuts.push(a);
    /* her approaching chime before the big one: ticks closing in */
    if (big && NEU.sfx && NEU.sfx.tick) { NEU.sfx.tick(); seqLater(220, function () { NEU.sfx.tick(); }); }
    seqLater(a.tele, hit);
  }
  function scalSfx(n) { if (NEU.scal && NEU.scal.sfx) NEU.scal.sfx(n); }
  /* the lie is told (rows typed), then torn row by row, faster each time,
     and the healing row last: the big cut, the banner, the real line */
  function tearLies(s, ul, n, cv) {
    var lis = ul.querySelectorAll('li.is-faking'), t = ul._end + 500, step = 340, i;
    for (i = 0; i < lis.length; i++) {
      (function (li, last) {
        seqLater(t, function () {
          cutAt(li, last, function () {
            li.classList.remove('is-faking');
            li.classList.add('is-cut');
            var lie = li.querySelector('.menu__fake');
            if (lie) setTimeout(function () { lie.hidden = true; }, 480);
            scalSfx('giga-hit');
            if (NEU.juice && NEU.juice.shakeEl) NEU.juice.shakeEl(box, last ? 'large' : 'medium');
            if (!last) return;
            if (NEU.sfx && NEU.sfx.heart) NEU.sfx.heart();
            s.classList.remove('is-lying');
            s.classList.add('is-broken');
            var bb = s.querySelector('.menu__banner b');
            if (bb) bb.textContent = MOOD.finalbreath[0];
            box._desc.setAttribute('data-mood', 'finalbreath');
            var m = s.querySelector('.glyph__meter');
            if (m && NEU.glyph) m.parentNode.replaceChild(NEU.glyph.meter(n + 1), m);
            if (cv) previewStart(cv, n);
            if (NEU.glyph && NEU.glyph.type) NEU.glyph.type(box._desc, FX[NEU.diff.list()[n]] || FALLBACK_FX);
          });
        });
        t += last ? 0 : step;
        step = Math.max(170, step - 30);
      })(lis[i], i === lis.length - 1);
      if (i === lis.length - 2) t += 650;   /* a breath before the last one */
    }
  }

  function tierPanel(n) {
    var s = box._side, T = NEU.diff && NEU.diff.table ? NEU.diff.table() : null;
    seqStop();
    s.textContent = '';
    s.classList.remove('is-lying', 'is-broken');
    if (!T) return;
    var id = NEU.diff.list()[n], mood = MOOD[id];
    var lie = id === 'finalbreath' && cutsOk() ? 1 : -1;   /* Easy's numbers, told as good news */
    if (lie >= 0) s.classList.add('is-lying');
    s.setAttribute('data-mood', id);
    box._desc.setAttribute('data-mood', lie >= 0 ? 'easy' : id);
    var top = el('div', 'menu__side-top');
    top.appendChild(el('h4', 'menu__side-h', NEU.diff.name(n)));
    if (NEU.glyph) top.appendChild(NEU.glyph.meter(lie >= 0 ? lie + 1 : n + 1));
    s.appendChild(top);
    if (mood) {
      var ban = el('div', 'menu__banner');
      ban.appendChild(el('b', '', lie >= 0 ? 'all good!' : mood[0]));
      ban.appendChild(el('small', '', mood[1]));
      s.appendChild(ban);
    }
    var cv = el('canvas', 'menu__preview');
    cv.width = PW; cv.height = PH;
    s.appendChild(cv);
    previewStart(cv, lie >= 0 ? lie : n);
    /* "new" = what changes against the next tier toward Medium, so each
       step up (or down) shows exactly what it adds */
    var ref = n < 2 ? n + 1 : n > 2 ? n - 1 : n, rows = [], key;
    for (var i = 0; i < STATS.length; i++) {
      key = STATS[i][0];
      rows.push([STATS[i][1], fmtMul(T[key][n], STATS[i][2], STATS[i][3]), T[key][n] !== T[key][ref],
        lie >= 0 && T[key][lie] !== T[key][n] ? fmtMul(T[key][lie], STATS[i][2], STATS[i][3]) + ' (' + LIE_TAG[key] + ')' : '']);
    }
    rows.push(['healing', T.heals[n] ? 'on' : 'off', T.heals[n] !== T.heals[ref], lie >= 0 ? 'on (always!)' : '']);
    var ul = statList(rows);
    s.appendChild(ul);
    if (lie >= 0) tearLies(s, ul, n, cv);
  }

  function filePanel() {
    var s = box._side, save = NEU.save && NEU.save.load ? NEU.save.load() : null;
    s.textContent = '';
    s.appendChild(el('h4', 'menu__side-h', 'file'));
    var rows = [['tier', NEU.diff && NEU.diff.name ? NEU.diff.name() : 'Medium']];
    if (save) rows.push(['time', NEU.save.playtime ? fmtTime(NEU.save.playtime()) : '0:00']);
    else rows.push(['progress', 'nothing yet']);
    s.appendChild(statList(rows));
  }

  function describe(n) {
    if (!box || !n || !box._desc) return;
    var text = '';
    if (n.classList && n.classList.contains('menu__tier')) {
      var i = +n.getAttribute('data-i'), snd = MOOD_SFX[NEU.diff.list()[i]];
      tierPanel(i);
      if (snd && NEU.sfx && NEU.sfx[snd]) NEU.sfx[snd](snd === 'hit' ? 0.7 : undefined);
      text = n.querySelector('.menu__tier-fx') ? n.querySelector('.menu__tier-fx').textContent : '';
      if (box._side.classList.contains('is-lying')) text = LIE_LINE;
    } else if (n.classList && n.classList.contains('menu__act')) {
      text = HINT[n.textContent] || '';
      if (screen === 'difficulty' && NEU.diff && NEU.diff.index) tierPanel(NEU.diff.index());
      else box._desc.removeAttribute('data-mood');
    }
    if (NEU.glyph && NEU.glyph.type) NEU.glyph.type(box._desc, text);
    else box._desc.textContent = text;
  }

  function layout() {
    previewStop();
    seqStop();
    box._win.removeAttribute('data-mood');
    box._side.textContent = '';
    box._side.removeAttribute('data-mood');
    box._desc.textContent = '';
    box._desc.removeAttribute('data-mood');
    box._win.setAttribute('data-tag', screen === 'root' ? (paused ? 'paused' : 'start') : (TAG[screen] || 'menu'));
    box._win.classList.toggle('is-wide', screen === 'root' || screen === 'difficulty');
  }

  /* The buttons currently on screen, in visual order. */
  function focusables() {
    var nodes = box._body.querySelectorAll(
      '.menu__act:not(:disabled), .menu__tier:not(:disabled), textarea:not(:disabled), input:not(:disabled)');
    return Array.prototype.slice.call(nodes);
  }

  function focusAt(i) {
    list = focusables();
    if (!list.length) return;
    index = (i + list.length) % list.length;
    list[index].focus();
  }

  function note(msg) { if (announce) announce.textContent = msg || ''; }

  function clear() { box._body.textContent = ''; list = []; index = 0; }

  function heading(text) {
    var h = el('h3', 'menu__h', text);
    box._body.appendChild(h);
    return h;
  }

  /* The act boundary is already owned by save.js's slot meta: a1_seen
     is where "acts I-III" ends and Act IV begins. No new flag, no
     second copy of where the story is. */
  function actLabel(data) {
    return data.flags && data.flags.a1_seen ? 'IV' : 'I\u2013III';
  }

  function countOn(o) {
    var n = 0, k;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k]) n++;
    return n;
  }

  /* A question with two ways out. Every destructive action in here
     goes through ask(): overwriting a slot, importing a file, starting
     over. One shape, so none of them can be missed. */
  function ask(title, msg, yesLabel, onYes, onNo, mood) {
    pending = { title: title, msg: msg, yesLabel: yesLabel, onYes: onYes, onNo: onNo, mood: mood };
    setScreen('confirm');
  }

  function ioArea(value, ro, label) {
    var ta = el('textarea', 'menu__io');
    ta.value = value || '';
    ta.readOnly = !!ro;
    ta.rows = 8;
    ta.spellcheck = false;
    ta.setAttribute('aria-label', label);
    return ta;
  }

  function download(name, text) {
    try {
      if (!window.Blob || !window.URL || !window.URL.createObjectURL) return false;
      var url = window.URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      var a = el('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (e) { return false; }
  }

  /* ── screens ──────────────────────────────────────────────────── */
  function root() {
    clear();
    var save = NEU.save && NEU.save.load ? NEU.save.load() : null;
    heading(paused ? 'MENU' : (save ? 'the woods are still there.' : 'something is hidden down here.'));
    if (paused) box._body.appendChild(button('Resume', 'menu__primary', close));
    box._body.appendChild(button('Play', 'menu__primary', function () {
      setScreen('difficulty');
    }));
    box._body.appendChild(button('Config', '', function () {
      if (NEU.settings && NEU.settings.open) NEU.settings.open();
    }));
    box._body.appendChild(button('Save', '', function () { setScreen('save'); }));
    if (paused) box._body.appendChild(button('Exit', 'menu__danger', function () {
      NEU.engine.confirmExit('the game', function () { close(); NEU.engine.leave(); },
        'leave the game? your save is kept.');
    }));
    filePanel();
    note('');
  }

  function hasSave() { return !!(NEU.save && NEU.save.load && NEU.save.load()); }

  function continueGame() {
    close();
    if (NEU.act4 && NEU.act4.open) NEU.act4.open();
  }

  /* Read-only window onto the two owners: quest.view() already hides the
     unreachable steps, and save.js owns every number shown here. No
     room ids or flag counts — those only ever spoiled the chain. */
  function progress() {
    clear();
    heading('where you are.');
    var data = (NEU.save && NEU.save.data) || {};
    var view = NEU.quest && NEU.quest.view ? NEU.quest.view() : [];
    for (var g = 0; g < view.length; g++) {
      var grp = view[g];
      var group = el('div', 'menu__prog');
      group.appendChild(el('h4', '', grp.group + ' ' + grp.n + '/' + grp.total));
      var ul = el('ul', '');
      for (var r = 0; r < grp.rows.length; r++) {
        var row = grp.rows[r];
        var line = (row.done ? '\u00d7 ' : '\u00b7 ') + row.text +
          (row.of ? ' (' + row.count + '/' + row.of + ')' : '');
        ul.appendChild(el('li', '', line));
      }
      group.appendChild(ul);
      box._body.appendChild(group);
    }
    var info = el('div', 'menu__file');
    info.appendChild(el('span', '', 'coins: ' +
      (NEU.save && NEU.save.coins ? NEU.save.coins() : (data.coins || 0))));
    info.appendChild(el('span', '', 'time: ' +
      (NEU.save && NEU.save.playtime ? fmtTime(NEU.save.playtime()) : '0:00')));
    var items = data.items || [];
    for (var i = 0; i < items.length; i++) {
      var def = NEU.items && NEU.items.get ? NEU.items.get(items[i]) : null;
      if (def && def.name) info.appendChild(el('span', '', 'item: ' + def.name));
    }
    var best = data.best || {};
    for (var b in best)
      if (Object.prototype.hasOwnProperty.call(best, b) && best[b] > 0)
        info.appendChild(el('span', '', b + ': ' + best[b]));
    box._body.appendChild(info);
    box._body.appendChild(button('Back', 'menu__back', function () { setScreen('root'); }));
    note('');
  }

  function difficulty() {
    clear();
    heading('pick how hard it pushes back.');
    var ids = NEU.diff && NEU.diff.list ? NEU.diff.list() : [];
    for (var i = 0; i < ids.length; i++) {
      (function (id, n) {
        var b = el('button', 'menu__tier');
        b.type = 'button';
        b.setAttribute('role', 'option');
        b.setAttribute('data-i', n);
        b.appendChild(el('b', 'menu__tier-name', NEU.diff.name ? NEU.diff.name(n) : id));
        var desc = el('span', 'menu__tier-fx', FX[id] || FALLBACK_FX);
        if (NEU.glyph) {
          desc.classList.add('glyph__copy');
          b.appendChild(NEU.glyph.meter(n + 1));
        }
        b.appendChild(desc);
        b.addEventListener('click', function () { chooseTier(id); });
        box._body.appendChild(b);
      })(ids[i], i);
    }
    var back = button('Back', 'menu__back', function () { setScreen('root'); });
    box._body.appendChild(back);
    note(hasSave() ? 'your progress is kept.' : 'pick again any time you press play.');
  }

  function chooseTier(id, sure) {
    /* the one tier with no way back from a mistake asks first; Keep is
       focused, so a stray Z backs out instead of starting */
    if (id === 'finalbreath' && !sure) {
      if (NEU.sfx && NEU.sfx.heart) NEU.sfx.heart();
      ask('no healing.', 'nothing heals you on this tier. every hit stays with you.', 'breathe in',
        function () { chooseTier(id, true); },
        function () { setScreen('difficulty'); focusAt(NEU.diff.list().indexOf(id)); }, id);
      return;
    }
    if (NEU.diff && NEU.diff.set) NEU.diff.set(id);
    /* Play always lands here: a tier picked over an existing save keeps the save */
    if (!hasSave() && NEU.save && NEU.save.newGame) NEU.save.newGame();
    close();
    if (NEU.act4 && NEU.act4.open) NEU.act4.open();
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function fmtDate(ms) {
    var d = new Date(Number(ms) || 0);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) +
      '-' + ('0' + d.getDate()).slice(-2);
  }

  function slotRow(n) {
    var cards = NEU.save && NEU.save.slots ? NEU.save.slots() : [];
    var card = cards[n - 1] || { empty: true, ok: true };
    var row = el('div', 'menu__slot');
    var label;
    if (card.empty) label = 'slot ' + n + ' \u00b7 empty';
    else if (!card.ok) label = 'slot ' + n + ' \u00b7 cannot load';
    else {
      var m = card.meta || {};
      label = 'slot ' + n + ' \u00b7 ' + (m.group || '?') + ' \u00b7 ' + (m.done || 0) +
        ' steps \u00b7 ' + (m.diff || '') + ' \u00b7 ' + fmtTime(m.t_play) +
        ' \u00b7 ' + fmtDate(m.saved);
    }
    row.appendChild(el('span', 'menu__slot-h', label));
    var acts = el('div', 'menu__slot-b');
    acts.appendChild(button('Save', 'menu__mini', function () {
      function write() {
        var saved = NEU.save && NEU.save.saveSlot ? NEU.save.saveSlot(n) : false;
        setScreen('save');
        note(saved ? 'saved to slot ' + n + '.' : 'could not save.');
      }
      if (card.empty) write();
      else ask('overwrite slot ' + n + '?', 'the file in this slot will be replaced.',
        'overwrite', write, function () { setScreen('save'); });
    }));
    if (card.ok || card.empty) acts.appendChild(button('Load', 'menu__mini', function () {
      var loaded = NEU.save && NEU.save.loadSlot ? NEU.save.loadSlot(n) : false;
      if (loaded) setScreen('save');
      note(loaded ? 'loaded slot ' + n + '.' : 'nothing saved in this slot yet.');
    }));
    row.appendChild(acts);
    return row;
  }

  function saveScreen() {
    clear();
    var d = (NEU.save && NEU.save.data) || {};
    var tier = NEU.diff && NEU.diff.name ? NEU.diff.name() : 'Medium';
    var room = d.room || 'not in a room';
    var time = NEU.save && NEU.save.playtime ? fmtTime(NEU.save.playtime()) : '0:00';
    heading('this browser remembers you.');
    var info = el('p', 'menu__file');
    info.appendChild(el('span', '', 'tier: ' + tier));
    info.appendChild(el('span', '', 'last room: ' + room));
    info.appendChild(el('span', '', 'time: ' + time));
    box._body.appendChild(info);
    box._body.appendChild(slotRow(1));
    box._body.appendChild(slotRow(2));
    box._body.appendChild(slotRow(3));
    box._body.appendChild(button('Progress', '', function () { setScreen('progress'); }));
    box._body.appendChild(button('Export JSON', '', function () { setScreen('export'); }));
    box._body.appendChild(button('Import JSON', '', function () { importText = ''; setScreen('import'); }));
    box._body.appendChild(button('New Game', 'menu__danger', function () {
      ask('erase this progress and start over?',
        'your save in this browser will be replaced.', 'start over',
        function () {
          if (NEU.save && NEU.save.newGame) NEU.save.newGame();
          setScreen('difficulty');
        }, function () { setScreen('save'); });
    }));
    box._body.appendChild(button('Back', 'menu__back', function () { setScreen('root'); }));
    note('');
  }

  function confirmScreen() {
    clear();
    var p = pending || { title: 'are you sure?', msg: '', yesLabel: 'yes', onNo: null, onYes: null };
    if (p.mood) box._win.setAttribute('data-mood', p.mood);
    heading(p.title);
    if (p.msg) box._body.appendChild(el('p', 'menu__file', p.msg));
    box._body.appendChild(button('Keep', 'menu__primary', function () {
      var back = p.onNo; pending = null;
      if (back) back(); else setScreen('save');
    }));
    box._body.appendChild(button(p.yesLabel || 'yes', 'menu__danger', function () {
      var yes = p.onYes; pending = null;
      if (yes) yes();
    }));
    note('this cannot be undone.');
  }

  function exportScreen() {
    clear();
    heading('your save, as text.');
    var json = NEU.save && NEU.save.exportJSON ? NEU.save.exportJSON() : '{}';
    box._body.appendChild(ioArea(json, true, 'save JSON to copy'));
    box._body.appendChild(button('Download .json', '', function () {
      note(download('neu-save.json', json) ? 'downloaded.' : 'select the text and copy it.');
    }));
    box._body.appendChild(button('Back', 'menu__back', function () { setScreen('save'); }));
    note('copy the text, or download the file.');
  }

  function importScreen() {
    clear();
    heading('paste a save to load it.');
    var ta = ioArea(importText, false, 'save JSON to import');
    ta.addEventListener('input', function () { importText = ta.value; });
    box._body.appendChild(ta);
    box._body.appendChild(button('Load this save', 'menu__primary', function () {
      importText = ta.value;
      if (!importText.trim()) { note('paste a save first.'); return; }
      ask('replace this save with the pasted one?',
        'progress in this browser will be overwritten.', 'replace',
        function () {
          var res = NEU.save && NEU.save.importJSON ?
            NEU.save.importJSON(importText) : { ok: false, why: 'no save module' };
          if (res.ok) setScreen('save');
          note(res.ok ? 'loaded.' : 'could not load: ' + res.why);
        }, function () { setScreen('import'); });
    }));
    box._body.appendChild(button('Back', 'menu__back', function () { setScreen('save'); }));
    note('');
  }

  var SCREENS = {
    root: root, difficulty: difficulty, progress: progress, save: saveScreen,
    confirm: confirmScreen, export: exportScreen, import: importScreen
  };

  function setScreen(name) {
    screen = SCREENS[name] ? name : 'root';
    layout();
    if (SCREENS[screen]) SCREENS[screen]();
    box.setAttribute('aria-label', 'main menu \u2014 ' + screen);
    /* The tier picker opens on the saved tier, or Medium for a fresh file.
       Focus is the selection here: a stray Enter must not start on Bot. */
    focusAt(screen === 'difficulty' && NEU.diff && NEU.diff.index ? NEU.diff.index() : 0);
  }

  function open(name) {
    if (!box) build();
    if (NEU.engine && NEU.engine.clearKeys) NEU.engine.clearKeys();
    if (!active) { returnTo = document.activeElement; active = true; }
    box.hidden = false;
    box.classList.toggle('is-calm', reduced());
    setScreen(name || 'root');
  }

  function close() {
    if (!active) return;
    active = false;
    paused = false;
    previewStop();
    seqStop();
    box.classList.remove('is-intro');
    box.hidden = true;
    var back = returnTo;
    returnTo = null;
    if (back && back !== document.body && document.contains(back) && back.focus) back.focus();
  }

  function toggle() { active ? close() : open('root'); }

  /* ── keyboard ───────────────────────────────────────────────────
     Capture, so a scene underneath never sees the key. Tab is stepped
     by index so jsdom and every browser agree on the order. */
  addEventListener('keydown', function (e) {
    if (!active || !box) return;
    /* Settings opened from Config sits above this overlay, and so does
       Exit's "leave the game?" (z 95): both own the keys while up. */
    if (NEU.settings && NEU.settings.open_) return;
    if (document.getElementById('confirmExit')) return;
    /* A pasted save is text: arrows move the caret, Enter is a newline
       and Space is a space. Tab and Escape still belong to the dialog. */
    var t = e.target;
    var typing = !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopImmediatePropagation();
      focusAt(index + (e.shiftKey ? -1 : 1));
      return;
    }
    if (e.key === 'Escape' || (!typing && (e.key === 'x' || e.key === 'X'))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (screen === 'root') close();
      else if (screen === 'confirm') {
        var back = pending && pending.onNo; pending = null;
        if (back) back(); else setScreen('save');
      } else if (screen === 'export' || screen === 'import') setScreen('save');
      else setScreen('root');
      return;
    }
    if (typing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault(); e.stopImmediatePropagation(); focusAt(index + 1); return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault(); e.stopImmediatePropagation(); focusAt(index - 1); return;
    }
    /* no auto-repeat: a held Z from the deck must not also press Play */
    if ((e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') && !e.repeat) {
      if (document.activeElement && list.indexOf(document.activeElement) >= 0) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (NEU.sfx && NEU.sfx.ui) NEU.sfx.ui('press');
        document.activeElement.click();
      }
    }
  }, true);

  /* Escape in a room opens the menu (pause), but only when no other
     modal owns the key. The menu's own Escape handler above closes it. */
  addEventListener('keydown', function (e) {
    if (active || e.key !== 'Escape' || e.repeat) return;
    if (NEU.activeMinigame || NEU.tboxOpen && NEU.tboxOpen()) return;
    if (NEU.settings && NEU.settings.open_) return;
    if (document.getElementById('confirmExit')) return;
    var inRoom = !!(NEU.engine && NEU.engine.running) ||
      !!(NEU.save && NEU.save.data && NEU.save.data.room);
    if (!inRoom) return;
    e.preventDefault();
    NEU.menu.pause();
  });

  /* Built on first open (open() guards it), so the portfolio carries no menu node. */

  NEU.menu = {
    open: open, close: close, toggle: toggle,
    /* A fresh page opens the title menu; Escape in a room pauses into the
       same root screen with Resume/Exit and the MENU heading. Neither path
       claims the keyboard or sets activeMinigame (R26). */
    title: function () {
      if (NEU.save) NEU.save.flag('opt_seenTitle', 1);
      paused = false; open('root');
      /* the soul drops onto the logo each time the title opens */
      box.classList.remove('is-intro'); void box.offsetWidth; box.classList.add('is-intro');
    },
    pause: function () { paused = true; open('root'); },
    /* The settings slider shows the same one-line description as the
       tier picker: one copy of the copy, read lazily after both load. */
    effect: function (id) { return FX[id] || FALLBACK_FX; },
    get active() { return active; },
    get screen() { return screen; }
  };
})();
