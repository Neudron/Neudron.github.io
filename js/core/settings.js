/* settings.js — the accessibility panel.
   ───────────────────────────────────────────────────────────────────
   The backend existed first: juice.js exposes setNoShake/setNoFlash,
   danmaku.js dims instead of blinking, and nothing let a player
   reach any of it. This is the panel.

   THE SWITCHES, PERSISTED IN THE SAVE FILE:

     motion             — device / full / calm   (motion.js, localStorage)
     flashing           — match motion / full / calm (motion.js)
     screen shake       — 0..100 %, scales the trauma juice.js adds
     larger text        — zooms the whole page 1.25x
     reduce hit-stop    — juice.js skips the frozen frame on impacts
     reduce particles   — juice.js stops spawning impact debris
     relaxed quiz timer — the show gives twenty-four seconds, not twelve. New: particle budget (500/160/100), photosensitivity (≤3 flashes/s, no shake, no afterimages), visual overlay (0..1, default 0.5).

   Larger text is a zoom, not a font-size, and that is deliberate:
   the Undertale faces are drawn on a 16px grid, so resampling a
   single font-size blurs the typeface. Zooming the page scales
   EVERYTHING together and keeps the grid intact.

   prefers-reduced-motion is the DEFAULT, never a lock. Many players
   have it on without knowing (Windows performance modes, battery
   savers), and locking it made Act I unfinishable: the cube would not
   turn. The device setting picks the starting point, a one-time note
   says so in plain words with the steps for that device, and every
   switch here stays usable (Xbox Accessibility Guidelines 117/118).

   Opens on Ctrl + Shift + , and from the gear button top-left.
   The dialogue box (z-index 96) stays the top layer; this panel
   sits below it at 94.                                              */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var K_SHAKE = 'opt_noShake';      /* legacy switch: on = shake 0 %   */
  var K_SHAKEPCT = 'opt_shakePct';  /* 0..100, default 100              */
  var K_FLASH = 'opt_noFlash';
  var K_TEXT  = 'opt_largeText';
  var K_TEXTSIZE = 'opt_textSize';   /* 100 | 125 | 150; old saves: opt_largeText = 125 */
  var K_HINTS = 'opt_hints';
  var K_STOP  = 'opt_hitstop';      /* on = juice skips the held frame   */
  var K_PART  = 'opt_particles';    /* on = juice spawns no debris       */
  var K_RELAX = 'opt_relaxedQuiz';  /* on = the quiz gives twice the time */
  var K_MUSIC = 'opt_music';        /* owned by music.js; read here    */
  var K_MUTE  = 'opt_mute';         /* on = silent; the level is kept  */
  var K_PHOTOSENS = 'opt_photosensitive'; /* opt-in: clamp flashes, no shake */
  var K_OVERLAY = 'opt_overlay';    /* 0..100 -> 0..1, default 50       */
  var K_PARTCAP = 'opt_particleCap';/* active-particle ceiling, default 500 */

  var M = NEU.motion || {
    reduced: function () { return false; }, calmFlash: function () { return false; },
    device: false, pref: 'auto', flashPref: 'auto', set: function () {}, on: function () {},
    steps: function () { return ''; }, once: function () { return false; }
  };
  function reducedNow() { return M.reduced(); }

  /* ── state ──────────────────────────────────────────────────────
     Stored as save flags, same as every other decision on the site —
     one file holds all of it, and the settings survive a reload the
     way the rest of the game does. */
  function state(k) {
    return !!(NEU.save && NEU.save.data && NEU.save.data.flags &&
              NEU.save.data.flags[k]);
  }

  /* Music is a level, not a switch, so it needs a numeric read. Kept
     separate from state() rather than making that one polymorphic —
     a helper that returns a boolean or a number depending on the key
     is a helper you have to look up every time you read it. */
  function num(k, dflt) {
    var v = NEU.save && NEU.save.data && NEU.save.data.flags ?
            NEU.save.data.flags[k] : undefined;
    if (v === undefined || v === null || isNaN(v)) return dflt;
    return +v;
  }

  function shakePct() {
    var v = num(K_SHAKEPCT, NaN);
    if (isNaN(v)) v = state(K_SHAKE) ? 0 : 100;   /* old saves: the switch */
    return Math.max(0, Math.min(100, v));
  }

  function textSize() {
    var n = num(K_TEXTSIZE, 0);
    return n === 125 || n === 150 ? n : (state(K_TEXT) ? 125 : 100);
  }

  function apply() {
    if (NEU.juice) {
      NEU.juice.setNoShake(shakePct() === 0);
      if (NEU.juice.setShakeScale) NEU.juice.setShakeScale(shakePct() / 100);
      /* Flashing now lives in motion.js; the old switch only migrates. */
      NEU.juice.setNoFlash(false);
      NEU.juice.setNoHitstop(state(K_STOP));
      NEU.juice.setNoParticles(state(K_PART));
      /* One budget, one flash rate, one intensity. The save file owns the
         values; juice holds only the live copies it reads each effect. */
      if (NEU.juice.setParticleCap) NEU.juice.setParticleCap(num(K_PARTCAP, 500));
      if (NEU.juice.setOverlayIntensity) NEU.juice.setOverlayIntensity(num(K_OVERLAY, 50) / 100);
      if (NEU.juice.setPhotosensitive) NEU.juice.setPhotosensitive(state(K_PHOTOSENS));
    }
    document.documentElement.classList.toggle('text-lg', textSize() === 125);
    document.documentElement.classList.toggle('text-xl', textSize() === 150);
    document.documentElement.classList.toggle('neu-hints-off', !state(K_HINTS));
    /* Music reads the flag itself. Sound effects (sans.js) read this
       attribute, so they need no import from this file. */
    document.documentElement.dataset.muted = state(K_MUTE) ? '1' : '';
    /* Pressed means sound is ON: the label is "Sound", and a lever
       that reads "pressed" while muted would say the opposite. */
    var mt = document.getElementById('muteToggle');
    if (mt) mt.setAttribute('aria-pressed', state(K_MUTE) ? 'false' : 'true');
  }

  function set(k, v) {
    if (NEU.save) NEU.save.flag(k, v ? 1 : 0);
    apply();
  }

  /* Mute is a flag, not a level. The slider keeps its number and the
     bus is silenced on top of it, so unmuting lands back where it was.
     Music is told directly so the bus moves now, not on its next poll. */
  function mute(on) {
    set(K_MUTE, on);
    if (NEU.music) NEU.music.refresh();
  }

  /* A letter typed into a field is not a mute. */
  function typing() {
    var a = document.activeElement || {};
    var ce = a.getAttribute ? a.getAttribute('contenteditable') : null;
    return /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || '') ||
           a.isContentEditable === true || (ce !== null && ce !== 'false');
  }

  /* ── the panel ──────────────────────────────────────────────────*/
  var panel = null, btn = null, open_ = false, wasPlaying = false;
  /* The element that had focus when the panel opened. close() hands focus
     back to it; the gear is the fallback if it has since left the page. */
  var returnTo = null;

  function row(id, label, hint, cb) {
    var r = document.createElement('div');
    r.className = 'sett__row';

    var l = document.createElement('label');
    l.className = 'sett__lbl';
    l.id = id + 'L';
    l.textContent = label;
    if (hint) {
      var s = document.createElement('small');
      s.textContent = hint;
      l.appendChild(s);
    }

    var dots = document.createElement('span');
    dots.className = 'sett__dots';

    var sw = document.createElement('button');
    sw.className = 'sett__sw';
    sw.id = id;
    sw.type = 'button';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-labelledby', l.id);
    sw.setAttribute('aria-checked', 'false');

    function syncText() {
      var on = sw.getAttribute('aria-checked') === 'true';
      sw.textContent = '◀ ' + (on ? 'ON' : 'OFF') + ' ▶';
    }
    sw._sync = syncText;

    sw.addEventListener('click', function () {
      var on = sw.getAttribute('aria-checked') === 'true';
      sw.setAttribute('aria-checked', String(!on));
      syncText();
      cb(!on);
    });
    syncText();

    r.appendChild(l);
    r.appendChild(dots);
    r.appendChild(sw);
    return r;
  }

  /* A range, not a mute switch plus a level. Zero IS the mute, and one
     control that goes to zero is one thing to find rather than two
     that can disagree with each other. */
  function slider(id, label, hint, get, set_, after, cfg) {
    cfg = cfg || {};
    var lo = cfg.min === undefined ? 0 : cfg.min;
    var hi = cfg.max === undefined ? 100 : cfg.max;
    var st = cfg.step === undefined ? 5 : cfg.step;
    var fmt = cfg.text || function (v) { return +v === 0 ? 'off' : v + '%'; };
    var r = document.createElement('div');
    r.className = 'sett__row';

    var l = document.createElement('label');
    l.className = 'sett__lbl';
    l.id = id + 'L';
    l.setAttribute('for', id);
    l.textContent = label;
    if (hint) {
      var s = document.createElement('small');
      s.textContent = hint;
      l.appendChild(s);
    }

    var dots = document.createElement('span');
    dots.className = 'sett__dots';

    var wrap = document.createElement('div');
    wrap.className = 'sett__val-wrap';
    var leftArr = document.createElement('span');
    leftArr.className = 'sett__arrow';
    leftArr.textContent = '◀';
    var rightArr = document.createElement('span');
    rightArr.className = 'sett__arrow';
    rightArr.textContent = '▶';

    var rg = document.createElement('input');
    rg.className = 'sett__rng';
    rg.id = id;
    rg.type = 'range';
    rg.min = String(lo); rg.max = String(hi); rg.step = String(st);
    rg.value = String(get());
    rg.setAttribute('aria-labelledby', l.id);
    /* not called label(): a function declaration would shadow the
       label PARAMETER above and print its own source as the row name */
    function vtext() { rg.setAttribute('aria-valuetext', fmt(+rg.value)); }
    function push() { set_(+rg.value); vtext(); }
    rg.addEventListener('input', push);
    rg.addEventListener('change', function () { push(); if (after) after(+rg.value); });
    /* Label only. Building the panel must not WRITE a value: that turned
       an old save's "no shake" into 100 % before anyone touched it. */
    vtext();

    wrap.appendChild(leftArr);
    wrap.appendChild(rg);
    wrap.appendChild(rightArr);

    r.appendChild(l);
    r.appendChild(dots);
    r.appendChild(wrap);
    return r;
  }

  /* The one-line tier description belongs to menu.js, which owns the
     tier picker. settings.js loads first, so read it only when the panel
     is drawn or the slider moves — by then the menu has been built. */
  function diffFx(v) {
    var id = NEU.diff && NEU.diff.list ? NEU.diff.list()[v] : null;
    if (id && NEU.menu && NEU.menu.effect) return NEU.menu.effect(id);
    return NEU.diff && NEU.diff.name ? NEU.diff.name(v) :
      'changes how hard the fights press you.';
  }

  function paintDiff(v) {
    var rg = document.getElementById('settDiff');
    var fx = document.getElementById('settDiffFx');
    if (rg && v !== undefined) {
      rg.value = String(v);
      rg.setAttribute('aria-valuetext', NEU.diff && NEU.diff.name ? NEU.diff.name(v) : String(v));
    }
    var tier = v === undefined ? (NEU.diff ? NEU.diff.index() : 2) : v;
    if (fx) {
      fx.textContent = diffFx(tier);
      if (NEU.glyph) {
        var copy = document.createElement('span');
        copy.className = 'glyph__copy';
        copy.textContent = fx.textContent;
        fx.textContent = '';
        fx.appendChild(NEU.glyph.meter(tier + 1));
        fx.appendChild(copy);
      }
    }
  }

  /* Three choices, one of them picked: a radiogroup of buttons, arrow
     keys move the pick (WAI-ARIA radio pattern). A switch cannot say
     "follow my device", and that is the default most people need. */
  function seg(id, label, hint, opts, get, set_) {
    var r = document.createElement('div');
    r.className = 'sett__row sett__row--seg';
    var l = document.createElement('span');
    l.className = 'sett__lbl';
    l.id = id + 'L';
    l.textContent = label;
    var s = document.createElement('small');
    s.textContent = hint;
    l.appendChild(s);

    var dots = document.createElement('span');
    dots.className = 'sett__dots';

    var g = document.createElement('div');
    g.className = 'sett__seg';
    g.id = id;
    g.setAttribute('role', 'radiogroup');
    g.setAttribute('aria-labelledby', l.id);
    var btns = [];
    function paint() {
      var v = get();
      for (var i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute('data-v') === v;
        btns[i].setAttribute('aria-checked', String(on));
        btns[i].tabIndex = on ? 0 : -1;
      }
    }
    opts.forEach(function (o, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sett__opt';
      b.setAttribute('role', 'radio');
      b.setAttribute('data-v', o[0]);
      b.textContent = o[1];
      b.addEventListener('click', function () { set_(o[0]); paint(); b.focus(); });
      b.addEventListener('keydown', function (e) {
        var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 :
                (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        btns[(i + d + btns.length) % btns.length].click();
      });
      btns.push(b);
      g.appendChild(b);
    });
    g._paint = paint;
    paint();
    r.appendChild(l);
    r.appendChild(dots);
    r.appendChild(g);
    return r;
  }

  function section(box, title) {
    var h = document.createElement('h3');
    h.className = 'sett__sec';
    h.textContent = title;
    box.appendChild(h);
  }

  function deviceLine() {
    return M.device ? 'your device asks for less motion, so calm is on. ' +
                      'pick "full" below to change it here, or on your device: ' + M.steps() :
                      'your device does not ask for less motion.';
  }

  /* One click for people who just want it calm. Presets are what
     God of War Ragnarök and The Last of Us Part II lead with. */
  function calmAll() {
    M.set('reduced', 'reduced');
    if (NEU.save) {
      NEU.save.flag(K_SHAKEPCT, 0); NEU.save.flag(K_STOP, 1); NEU.save.flag(K_PART, 1);
      NEU.save.flag(K_PHOTOSENS, 1); NEU.save.flag(K_PARTCAP, 160);
    }
    apply(); refresh();
  }
  function defaults() {
    M.set('auto', 'auto');
    if (NEU.save) {
      NEU.save.flag(K_SHAKEPCT, 100); NEU.save.flag(K_SHAKE, 0); NEU.save.flag(K_STOP, 0);
      NEU.save.flag(K_PART, 0); NEU.save.flag(K_TEXT, 0); NEU.save.flag(K_TEXTSIZE, 100); NEU.save.flag(K_RELAX, 0);
      NEU.save.flag(K_HINTS, 0);
      NEU.save.flag(K_PHOTOSENS, 0); NEU.save.flag(K_PARTCAP, 500); NEU.save.flag(K_OVERLAY, 50);
    }
    apply(); refresh();
  }

  var currentCat = 'config';
  var catBtns = [];
  var panes = {};

  function selectCategory(catName) {
    currentCat = catName;
    for (var i = 0; i < catBtns.length; i++) {
      var b = catBtns[i];
      var isSel = b.getAttribute('data-cat') === catName;
      b.setAttribute('aria-selected', String(isSel));
      if (isSel) b.classList.add('is-active');
      else b.classList.remove('is-active');
      b.tabIndex = isSel ? 0 : -1;
    }
    for (var name in panes) {
      if (panes.hasOwnProperty(name)) {
        panes[name].hidden = (name !== catName);
      }
    }
  }

  /* Keybinds page: one row per NEU.keys.rows() entry, so the labels, the
     ??? for verbs not met yet and the fixed keys come from keys.js alone.
     Enter or click starts capture; Esc cancels; conflicts swap. */
  var KEY_GLYPH = { w: 'arrow', a: 'arrow', s: 'arrow', d: 'arrow', z: 'sword', x: 'dash',
    Shift: 'target', c: 'fire', r: 'reset', i: 'bag', Tab: 'list', m: 'sound', e: 'open' };
  function drawKeys() {
    var host = document.getElementById('settKeys');
    if (!host || !NEU.keys) return;
    host.textContent = '';
    NEU.keys.rows().forEach(function (r) {
      var line = document.createElement('div');
      line.className = 'sett__row';
      var l = document.createElement('span');
      l.className = 'sett__lbl';
      if (NEU.glyph) NEU.glyph.put(l, r.def && r.label !== '???' ? KEY_GLYPH[r.def] : 'key', r.label);
      else l.textContent = r.label;
      line.appendChild(l);

      var dots = document.createElement('span');
      dots.className = 'sett__dots';
      line.appendChild(dots);

      if (r.fixed) {
        var kt = document.createElement('span');
        kt.className = 'sett__keytext';
        kt.textContent = r.key;
        line.appendChild(kt);
        host.appendChild(line);
        return;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = r.def === 'e' ? 'sett__key-ext' : 'sett__key';
      b.setAttribute('aria-label', r.label + ' — ' + r.key.toUpperCase());
      b.textContent = '◀ ' + (r.key ? r.key.toUpperCase() : r.def) + ' ▶';

      function startCapture() {
        var note = document.getElementById('settKeyNote');
        b.setAttribute('aria-label', 'press a key…');
        if (NEU.glyph) NEU.glyph.put(b, 'key', 'press a key…');
        else b.textContent = 'press a key…';
        NEU.keys.capture(function (k) {
          if (k !== null) {
            var res = NEU.keys.set(r.def, k);
            var other = res.swapped;
            if (note) {
              note.textContent = !res.ok ? res.why :
                other ? 'swapped with ' + other + '.' : '';
            }
          }
          drawKeys();
        });
      }

      b.addEventListener('click', startCapture);
      line.appendChild(b);
      host.appendChild(line);
    });
  }

  function build() {
    panel = document.createElement('div');
    panel.className = 'sett';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'settings');

    var box = document.createElement('div');
    box.className = 'sett__box';

    var h = document.createElement('h2');
    h.className = 'sett__h';
    h.textContent = 'settings';

    var x = document.createElement('button');
    x.className = 'sett__x';
    x.type = 'button';
    x.setAttribute('aria-label', 'close settings');
    x.textContent = '\u00d7';
    x.addEventListener('click', close);

    box.appendChild(h);
    box.appendChild(x);

    var twoPane = document.createElement('div');
    twoPane.className = 'sett__two-pane';

    var catsNav = document.createElement('nav');
    catsNav.className = 'sett__cats';
    catsNav.setAttribute('role', 'tablist');
    catsNav.setAttribute('aria-label', 'settings categories');

    var panesContainer = document.createElement('div');
    panesContainer.className = 'sett__panes';

    var CATEGORIES = [
      ['config', 'Config'],
      ['keybinds', 'Keybinds'],
      ['sound', 'Sound'],
      ['display', 'Display'],
      ['accessibility', 'Accessibility']
    ];

    catBtns = [];
    panes = {};

    CATEGORIES.forEach(function (cat) {
      var catId = cat[0];
      var catLabel = cat[1];

      var catBtn = document.createElement('button');
      catBtn.type = 'button';
      catBtn.className = 'sett__cat' + (catId === currentCat ? ' is-active' : '');
      catBtn.setAttribute('data-cat', catId);
      catBtn.setAttribute('role', 'tab');
      catBtn.setAttribute('aria-selected', catId === currentCat ? 'true' : 'false');
      catBtn.tabIndex = catId === currentCat ? 0 : -1;
      catBtn.textContent = catLabel;

      catBtn.addEventListener('click', function () {
        selectCategory(catId);
        catBtn.focus();
      });

      catsNav.appendChild(catBtn);
      catBtns.push(catBtn);

      var p = document.createElement('div');
      p.className = 'sett__pane';
      p.id = 'pane-' + catId;
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-label', catLabel);
      p.hidden = (catId !== currentCat);
      panes[catId] = p;
      panesContainer.appendChild(p);
    });

    /* 1. Config pane */
    var pConfig = panes.config;

    /* Seven tiers, the same list diff.js owns. NEU.diff.set writes the
       opt_diff flag immediately; fights sample it on entry and retry.
       First in the pane: at 720p the rest scrolls, this one does not. */
    var diffRow = slider('settDiff', 'difficulty',
        'how hard the fights press you. takes effect on the next fight.',
        function () { return NEU.diff ? NEU.diff.index() : 2; },
        function (v) {
          if (v >= 5 && NEU.diff && v !== NEU.diff.index()) { askTier(v); return; }
          hideAsk();
          if (NEU.diff && NEU.diff.list) NEU.diff.set(NEU.diff.list()[v]);
          paintDiff(v);
        }, null,
        { min: 0, max: 6, step: 1,
          text: function (v) { return NEU.diff && NEU.diff.name ? NEU.diff.name(v) : String(v); } });
    var fx = document.createElement('small');
    fx.className = 'sett__fx';
    fx.id = 'settDiffFx';
    fx.setAttribute('aria-live', 'polite');
    diffRow.querySelector('.sett__lbl').appendChild(fx);
    diffRow.id = 'settDiffRow';
    pConfig.appendChild(diffRow);

    /* The two top tiers cost something real, so the slider asks first and
       writes nothing until yes. */
    var ask = document.createElement('div');
    ask.id = 'settDiffConfirm';
    ask.setAttribute('role', 'group');
    ask.setAttribute('aria-live', 'polite');
    ask.hidden = true;
    var askMsg = document.createElement('span');
    var askYes = document.createElement('button');
    askYes.type = 'button'; askYes.id = 'settDiffYes'; askYes.className = 'sett__opt'; askYes.textContent = 'yes';
    var askNo = document.createElement('button');
    askNo.type = 'button'; askNo.id = 'settDiffNo'; askNo.className = 'sett__opt'; askNo.textContent = 'no';
    ask.appendChild(askMsg); ask.appendChild(askYes); ask.appendChild(askNo);
    var askTier_ = 0;
    function hideAsk() { ask.hidden = true; }
    function askTier(v) {
      askTier_ = v;
      askMsg.textContent = v === 5 ? 'ultrakill: half your HP, faster everything. sure?' :
                                     'final breath: 1 HP. no heals. sure?';
      ask.hidden = false;
    }
    askYes.addEventListener('click', function () {
      NEU.diff.set(NEU.diff.list()[askTier_]); hideAsk(); paintDiff(askTier_);
    });
    askNo.addEventListener('click', function () { hideAsk(); paintDiff(NEU.diff.index()); });
    pConfig.appendChild(ask);

    pConfig.appendChild(seg('settMotion', 'motion',
        'calm keeps things still unless you move them. the game works either way.',
        [['auto', 'device'], ['full', 'full'], ['reduced', 'calm']],
        function () { return M.pref; },
        function (v) { M.set(v, null); refresh(); }));
    pConfig.appendChild(seg('settFlashing', 'flashing',
        'calm dims impacts instead of flashing the screen white.',
        [['auto', 'match motion'], ['full', 'full'], ['reduced', 'calm']],
        function () { return M.flashPref; },
        function (v) { M.set(null, v); refresh(); }));
    pConfig.appendChild(slider('settShake', 'screen shake',
        'how hard hits rock the scene. zero is off. calm motion turns it off too.',
        shakePct,
        function (v) { if (NEU.save) NEU.save.flag(K_SHAKEPCT, v); apply(); },
        function (v) {
          if (v > 0 && !reducedNow() && NEU.juice && NEU.juice.shakeEl) NEU.juice.shakeEl(box, 'small');
        }));
    pConfig.appendChild(row('settHitstop', 'reduce hit-stop',
        'impacts land without the held frame', function (on) {
      set(K_STOP, on);
    }));
    pConfig.appendChild(row('settParticles', 'reduce particles',
        'hits leave no debris behind', function (on) {
      set(K_PART, on);
    }));
    pConfig.appendChild(seg('settPartBudget', 'particle budget',
        'full 500, low 160, minimal 100. decoration goes before hit and telegraph feedback.',
        [['500', 'full'], ['160', 'low'], ['100', 'minimal']],
        function () { return String(num(K_PARTCAP, 500)); },
        function (v) { if (NEU.save) NEU.save.flag(K_PARTCAP, +v); apply(); }));

    /* 2. Keybinds pane */
    var pKeys = panes.keybinds;
    var kh = document.createElement('div');
    kh.id = 'settKeys';
    pKeys.appendChild(kh);
    var kn = document.createElement('p');
    kn.className = 'sett__note';
    kn.id = 'settKeyNote';
    kn.setAttribute('aria-live', 'polite');
    pKeys.appendChild(kn);

    var resetRow = document.createElement('div');
    resetRow.className = 'sett__row';
    var resetLbl = document.createElement('span');
    resetLbl.className = 'sett__lbl';
    resetLbl.textContent = 'reset all keybinds';
    var resetDots = document.createElement('span');
    resetDots.className = 'sett__dots';
    var kr = document.createElement('button');
    kr.type = 'button'; kr.className = 'sett__act'; kr.id = 'settKeysReset';
    kr.textContent = 'reset all keybinds';
    kr.addEventListener('click', function () {
      if (NEU.keys) NEU.keys.reset();
      kn.textContent = 'controls back to default.';
      drawKeys();
    });
    resetRow.appendChild(resetLbl);
    resetRow.appendChild(resetDots);
    resetRow.appendChild(kr);
    pKeys.appendChild(resetRow);

    /* 3. Sound pane */
    var pSound = panes.sound;
    pSound.appendChild(row('settSound', 'sound',
        'all sound. m turns it on and off from anywhere.', function (on) {
      mute(!on);
    }));
    pSound.appendChild(slider('settMusic', 'music',
        'the soundtrack. drag to zero for silence.',
        function () { return num(K_MUSIC, 55); },
        function (v) {
          if (NEU.music) NEU.music.setVolume(v);
          else if (NEU.save) NEU.save.flag(K_MUSIC, v);
        }));

    /* 4. Display pane */
    var pDisplay = panes.display;
    pDisplay.appendChild(seg('settTextSize', 'text size', 'zooms the whole page',
        [['100', '100%'], ['125', '125%'], ['150', '150%']],
        function () { return String(textSize()); },
        function (v) {
          if (!NEU.save) return;
          NEU.save.flag(K_TEXTSIZE, +v); NEU.save.flag(K_TEXT, +v === 125 ? 1 : 0);
          apply();
        }));
    pDisplay.appendChild(slider('settOverlay', 'visual overlay',
        'full-screen flashes. drag to zero for none; middle is normal.',
        function () { return num(K_OVERLAY, 50); },
        function (v) { if (NEU.save) NEU.save.flag(K_OVERLAY, v); apply(); }));

    /* 5. Accessibility pane */
    var pA11y = panes.accessibility;
    var st = document.createElement('p');
    st.className = 'sett__note sett__note--top';
    st.id = 'settDevice';
    st.textContent = deviceLine();
    pA11y.appendChild(st);

    pA11y.appendChild(row('settHints', 'show hints', '', function (on) { set(K_HINTS, on); }));
    pA11y.appendChild(row('settPhotosens', 'photosensitivity',
        'flashes capped at three a second, no screen shake, no afterimages. warnings stay.',
        function (on) { set(K_PHOTOSENS, on); }));
    pA11y.appendChild(row('settRelaxed', 'relaxed quiz timer',
        'twenty-four seconds a question, not twelve', function (on) {
      set(K_RELAX, on);
    }));

    var foot = document.createElement('div');
    foot.className = 'sett__foot';
    var calm = document.createElement('button');
    calm.type = 'button'; calm.className = 'sett__act'; calm.id = 'settCalm';
    calm.textContent = 'make everything calm';
    calm.addEventListener('click', calmAll);
    var dflt = document.createElement('button');
    dflt.type = 'button'; dflt.className = 'sett__act'; dflt.id = 'settDefaults';
    dflt.textContent = 'reset to defaults';
    dflt.addEventListener('click', defaults);
    foot.appendChild(calm);
    foot.appendChild(dflt);
    pA11y.appendChild(foot);

    /* One reset per tab: only that tab's own switches go back to default. */
    function tabReset(pane, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'sett__act sett__tabreset'; b.textContent = 'reset this tab';
      b.addEventListener('click', function () { fn(); apply(); refresh(); });
      panes[pane].appendChild(b);
    }
    function flags(o) { if (NEU.save) for (var k in o) if (o.hasOwnProperty(k)) NEU.save.flag(k, o[k]); }
    tabReset('config', function () { if (NEU.diff) NEU.diff.set('medium'); });
    tabReset('sound', function () {
      mute(false);
      if (NEU.music) NEU.music.setVolume(55); else flags({ opt_music: 55 });
    });
    tabReset('display', function () {
      var o = {}; o[K_SHAKEPCT] = 100; o[K_SHAKE] = 0; o[K_STOP] = 0; o[K_PART] = 0;
      o[K_TEXTSIZE] = 100; o[K_TEXT] = 0; flags(o); M.set('auto', 'auto');
    });
    tabReset('accessibility', function () {
      var o = {}; o[K_RELAX] = 0; o[K_PHOTOSENS] = 0; o[K_PARTCAP] = 500; o[K_OVERLAY] = 50; o[K_HINTS] = 0; flags(o);
    });

    twoPane.appendChild(catsNav);
    twoPane.appendChild(panesContainer);
    box.appendChild(twoPane);

    var keysNote = document.createElement('p');
    keysNote.className = 'sett__note';
    keysNote.textContent = 'open this any time: the gear, or ctrl + shift + comma. ' +
                           'settings save on this device.';
    if (NEU.glyph) NEU.glyph.put(keysNote, 'gear', keysNote.textContent);
    box.appendChild(keysNote);

    panel.appendChild(box);

    /* The strip under the window says what the focused thing does: a
       row's own hint (still inside its label for screen readers), or for
       a category, the names of the rows it opens. Visual copy only. */
    var desc = document.createElement('p');
    desc.className = 'sett__desc';
    desc.setAttribute('aria-hidden', 'true');
    panel.appendChild(desc);
    var keyBar = document.createElement('p');
    keyBar.className = 'sett__keys';
    keyBar.innerHTML = '<kbd aria-hidden="true">\u2191\u2193</kbd><span class="glyph__copy">choose</span>' +
      '<kbd aria-hidden="true">\u2190\u2192</kbd><span class="glyph__copy">in and out</span>' +
      '<kbd aria-hidden="true">Esc</kbd><span class="glyph__copy">back</span>';
    panel.appendChild(keyBar);
    function lblText(l) {
      var t = l.firstChild && l.firstChild.nodeType === 3 ? l.firstChild.nodeValue : l.textContent;
      return (t || '').trim();
    }
    panel.addEventListener('focusin', function (e) {
      var t = e.target, text = '', i;
      var cat = t.getAttribute && t.getAttribute('data-cat');
      if (cat && panes[cat]) {
        var names = [], ls = panes[cat].querySelectorAll('.sett__lbl');
        for (i = 0; i < ls.length && names.length < 6; i++) if (lblText(ls[i])) names.push(lblText(ls[i]));
        text = names.join(' \u00b7 ') + (ls.length > 6 ? ' \u2026' : '');
      } else {
        var r = t.closest ? t.closest('.sett__row') : null, sm = r ? r.querySelectorAll('.sett__lbl small') : [];
        for (i = 0; i < sm.length; i++) text += (text ? ' ' : '') + sm[i].textContent;
      }
      if (NEU.glyph && NEU.glyph.type) NEU.glyph.type(desc, text); else desc.textContent = text;
    });

    document.body.appendChild(panel);

    /* The gear. Inline svg like the deck sigil — no request, scales
       with the button, and a real gear rather than a letter. */
    btn = document.createElement('button');
    btn.id = 'settBtn';
    btn.className = 'sett__btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'settings');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 ' +
      'M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M18.7 5.3l-2.1 2.1 M7.4 16.6l-2.1 2.1" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>';
    btn.addEventListener('click', function () { open_ ? close() : open(); });
    document.body.appendChild(btn);
  }

  /* Every switch is built showing "off" and only ever changed by a
     click, so after a reload the panel claimed shake was on when it
     was off. The stored state is the truth; read it back each time the
     panel opens rather than trusting the markup. */
  function refresh() {
    if (!panel) return;
    var rows = [
      ['settHints', state(K_HINTS)],
      ['settSound', !state(K_MUTE)],
      ['settHitstop',   state(K_STOP)],
      ['settParticles', state(K_PART)],
      ['settPhotosens', state(K_PHOTOSENS)],
      ['settRelaxed', state(K_RELAX)]
    ];
    for (var i = 0; i < rows.length; i++) {
      var el = document.getElementById(rows[i][0]);
      if (el) {
        el.setAttribute('aria-checked', String(!!rows[i][1]));
        if (el.id === 'settHints' && el._sync) el._sync();
      }
    }
    var m = document.getElementById('settMusic');
    if (m) m.value = String(num(K_MUSIC, 55));
    var sk = document.getElementById('settShake');
    if (sk) {
      sk.value = String(shakePct());
      sk.setAttribute('aria-valuetext', shakePct() === 0 ? 'off' : shakePct() + '%');
    }
    var ov = document.getElementById('settOverlay');
    if (ov) {
      ov.value = String(num(K_OVERLAY, 50));
      ov.setAttribute('aria-valuetext', +ov.value === 0 ? 'off' : ov.value + '%');
    }
    var dv = document.getElementById('settDevice');
    if (dv) dv.textContent = deviceLine();
    ['settMotion', 'settFlashing', 'settPartBudget', 'settTextSize'].forEach(function (id) {
      var g = document.getElementById(id);
      if (g && g._paint) g._paint();
    });
    paintDiff();
    var dr = document.getElementById('settDiffRow');
    if (dr) {
      var seen = !!(NEU.save && (NEU.save.flagged('opt_seenTitle') || NEU.save.flagged('a1_seen')));
      dr.hidden = !seen;
      dr.style.display = seen ? '' : 'none';   /* .sett__row sets display, which beats [hidden] */
      var cf = document.getElementById('settDiffConfirm');
      if (!seen && cf) cf.hidden = true;
    }
  }

  /* The panel's focusables. Disabled ones are skipped: a trap that wraps
     to one eats Tabs silently. A radiogroup is ONE tab stop (its picked
     option has tabIndex 0); arrows move inside it.

     ONLY VISIBLE CONTROLS. The five panes all live in the DOM at once;
     four are [hidden] (display:none). Focusing into a hidden pane is a
     no-op in every engine, so Tab from the last control of the visible
     pane — reduce particles, in Config — used to "land" on the hidden
     keybinds reset and sit there, eating every later Tab. Walk up from
     each candidate and drop anything under a hidden ancestor. */
  function focusables() {
    var all = panel.querySelectorAll('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)');
    var out = [], i, node, hidden;
    for (i = 0; i < all.length; i++) {
      hidden = false;
      node = all[i];
      while (node && node !== panel) {
        if (node.hidden === true) { hidden = true; break; }
        node = node.parentNode;
      }
      if (!hidden) out.push(all[i]);
    }
    /* jsdom returns selector-list matches grouped by selector rather
       than in document order, which would wrap the trap backwards.
       Sort explicitly so the order is the same in every engine. */
    out.sort(function (a, b) { return (a.compareDocumentPosition(b) & 4) ? -1 : 1; });
    return out;
  }

  function open() {
    if (open_) return;
    open_ = true;
    returnTo = document.activeElement;
    refresh();
    drawKeys();
    selectCategory('config');
    panel.hidden = false;
    /* Settings opens over live rooms too — remember whether the room
       owned is-playing so close() hands it back instead of stealing it. */
    wasPlaying = document.body.classList.contains('is-playing');
    document.body.classList.add('is-playing');
    /* A single selector on purpose: a selector LIST comes back grouped
       by selector in jsdom, and the first match must be the first
       switch in DOM order, not the first element of the last group. */
    var first = panel.querySelector('.sett__cat') || panel.querySelector('[role="radio"][tabindex="0"]');
    (first || panel.querySelector('.sett__x')).focus();
    requestAnimationFrame(function () { panel.classList.add('is-in'); });
  }

  function close() {
    if (!open_) return;
    open_ = false;
    panel.classList.remove('is-in');
    panel.hidden = true;
    if (!wasPlaying) document.body.classList.remove('is-playing');
    /* Back to whatever opened the panel, when it is still on the page. The
       gear is the fallback for a click on nothing in particular (the body
       has no focus to return to) and for an opener that has since gone. */
    var back = returnTo;
    returnTo = null;
    if (back && back !== document.body && document.contains(back) && back.focus) back.focus();
    else if (btn) btn.focus();
  }

  /* ── keyboard ───────────────────────────────────────────────────
     Ctrl + Shift + , — comma, not backquote: the dev console owns
     backquote, and comma needs both modifiers to be reachable by
     accident, exactly like the console. e.code because with the
     modifiers held the key value varies by layout. */
  addEventListener('keydown', function (e) {
    /* A Leave prompt owns the keyboard: it is a capture listener of its own
       (engine.js confirmExit), and nothing here may open over it. */
    if (document.getElementById('confirmExit')) return;
    if (e.ctrlKey && e.shiftKey &&
        (e.code === 'Comma' || e.key === ',' || e.key === '<')) {
      e.preventDefault();
      open_ ? close() : open();
      return;
    }
    /* M mutes from anywhere. A modifier is someone else's shortcut, and
       a held key auto-repeats, which must not flicker the mute. */
    if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey &&
        !e.altKey && !e.repeat && !typing()) mute(!state(K_MUTE));
    if (!open_ || !panel) return;

    var inPanes = false;
    var node = document.activeElement;
    while (node && node !== panel) {
      if (node.classList && (node.classList.contains('sett__panes') || node.classList.contains('sett__pane'))) {
        inPanes = true;
        break;
      }
      node = node.parentNode;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (inPanes) {
        var activeBtn = panel.querySelector('.sett__cat[aria-selected="true"]') || panel.querySelector('.sett__cat');
        if (activeBtn) activeBtn.focus();
      } else {
        close();
      }
      return;
    }

    var catButtons = panel.querySelectorAll('.sett__cat');
    var catIndex = -1;
    for (var ci = 0; ci < catButtons.length; ci++) {
      if (catButtons[ci] === document.activeElement) { catIndex = ci; break; }
    }

    if (catIndex >= 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var nextCi = e.key === 'ArrowDown' ? (catIndex + 1) % catButtons.length : (catIndex - 1 + catButtons.length) % catButtons.length;
        catButtons[nextCi].click();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        var curPane = panes[currentCat];
        if (curPane) {
          var firstInPane = curPane.querySelector('button:not(:disabled), input:not(:disabled)');
          if (firstInPane) firstInPane.focus();
        }
      }
      return;
    }

    if (inPanes) {
      if (e.key === 'ArrowLeft' && e.target && e.target.tagName !== 'INPUT') {
        var actCat = panel.querySelector('.sett__cat[aria-selected="true"]') || panel.querySelector('.sett__cat');
        if (actCat) {
          e.preventDefault();
          actCat.focus();
          return;
        }
      }
      if (e.target && e.target.type === 'range') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.target.value = String(Math.max(+e.target.min, +e.target.value - (+e.target.step || 5)));
          e.target.dispatchEvent(new Event('input', { bubbles: true }));
          e.target.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.target.value = String(Math.min(+e.target.max, +e.target.value + (+e.target.step || 5)));
          e.target.dispatchEvent(new Event('input', { bubbles: true }));
          e.target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
  }, true);
  /* Capture, not bubble: the minigames bind ESC on window too, and a bubble
     listener runs after them, so their ESC branch would already have fired. */

  /* Tab stays inside the panel. This is a CAPTURE listener that stops the
     press, the way engine.js confirmExit does. quest.js binds Tab on window
     and preventDefaults every press, and the panel does not lock it. The
     trap used to run on the bubble phase, after that had already happened,
     so a Tab in the middle of the panel opened the quest log behind it and
     focus never moved: only the two ends wrapped. Every Tab is handled here,
     by index, so the order is the same whatever the browser's own would be.

     Buttons AND inputs. The trap used to collect only buttons, so the moment
     a slider was added Tab walked straight out of a dialog marked aria-modal
     and left the player behind the scrim with no way back to the close
     button. Disabled switches are excluded the same way — a trap that wraps
     to one eats Tabs silently. */
  addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      if (!open_ || !panel) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      var els = focusables();
      if (!els.length) return;
      var i = Array.prototype.indexOf.call(els, document.activeElement);
      var nx = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : (i + 1) % els.length;
      els[nx].focus();
    }
  }, true);

  /* ── notes: tell people what is on, and how to change it ─────────
     Games put the warning up front (Xbox Accessibility Guidelines
     118, Playdate's reduce-flashing note), but a modal before the
     page is a wall. These are small, polite and non-blocking
     (role=status), shown once each, and every one has the fix as a
     button, not as instructions. */
  var note = null;
  function hideNote() {
    if (!note) return;
    var onHide = note.__onHide;
    if (note.__tuckObs) note.__tuckObs.disconnect();
    note.remove(); note = null;
    /* Dismissing a held warning releases the game. Runs after the note is
       gone, so a callback that reopens settings never re-tucks this node. */
    if (onHide) onHide();
  }
  function tuckNote() {
    if (!note) return;
    var tb = document.getElementById('tbox');
    if (!tb || tb.hidden) { note.style.bottom = '24px'; return; }
    note.style.bottom = Math.max(24, Math.round(innerHeight - tb.getBoundingClientRect().top + 12)) + 'px';
  }
  function showNote(text, actions, onHide) {
    hideNote();
    note = document.createElement('div');
    note.className = 'rmnote';
    note.setAttribute('role', 'status');
    note.__onHide = onHide || null;
    var p = document.createElement('p');
    p.className = 'rmnote__t';
    p.textContent = text;
    note.appendChild(p);
    var row = document.createElement('div');
    row.className = 'rmnote__row';
    actions.forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rmnote__b' + (a[2] ? ' is-primary' : '');
      b.textContent = a[0];
      b.addEventListener('click', function () { hideNote(); if (a[1]) a[1](); });
      row.appendChild(b);
    });
    note.appendChild(row);
    document.body.appendChild(note);
    /* The regular choice is lit and preselected, so a reflex Z or Enter keeps
       the game as made; the calm one is still one arrow away. Players were
       turning motion off by accident when no button had the cursor. */
    var first = row.querySelector('.is-primary');
    if (first) { try { first.focus({ preventScroll: true }); } catch (x) { first.focus(); } }
    row.addEventListener('keydown', function (e) {
      var bs = Array.prototype.slice.call(row.children), i = bs.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation();
        bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length].focus();
      } else if ((e.key === 'z' || e.key === 'Z') && !e.repeat) {
        e.preventDefault(); e.stopPropagation(); bs[i].click();
      }
    });
    var tboxEl = document.getElementById('tbox');
    if (tboxEl && typeof MutationObserver !== 'undefined') {
      /* re-tuck after the box's text settles: its top can shift after `hidden` clears */
      note.__tuckObs = new MutationObserver(function () {
        tuckNote();
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tuckNote);
      });
      note.__tuckObs.observe(tboxEl, { attributes: true, attributeFilter: ['hidden'],
        childList: true, subtree: true, characterData: true });
      addEventListener('resize', tuckNote);
    }
    tuckNote();
  }

  /* First visit with the device asking for less motion: say it, once. */
  function deviceNote() {
    if (!M.device || M.pref !== 'auto' || !M.once('device')) return;
    showNote('your device asks for less motion, so this site stays calm: ' +
             'no spinning, shaking or flashing on its own. everything still works.',
      [['turn motion on', function () { M.set('full', null); refresh(); }, true],
       ['keep it calm', null],
       ['settings', open]]);
  }

  /* Before the first game scene: the photosensitivity heads-up. Both
     callers (engine.enter, bullet.open) invoke this before their first
     frame, so holding here means the warning lands before any flash —
     not partway through a fight that is already lighting up. */
  var flashHeld = false;
  function releaseFlash() {
    if (flashHeld && NEU.juice) NEU.juice.pause(false);
    flashHeld = false;
  }
  function warnFlash() {
    if (!M.once('flash')) return;
    if (M.calmFlash() && shakePct() === 0) return;   /* already calm */
    /* The note is non-blocking by design, so the game must be held while
       it is up. The combat scenes check juice.frozen() at their step top;
       pausing there stops the sim before the first impact can flash. */
    if (NEU.juice && NEU.juice.pause) { NEU.juice.pause(true); flashHeld = true; }
    showNote('heads up: the game has flashing lights and screen shake. ' +
             'you can turn them down any time with the gear (top left).',
      [['ok', null, true],
       ['make it calm', calmAll],
       ['settings', open]], releaseFlash);
  }

  /* The old "reduce flashing" switch, carried over once into motion.js. */
  function migrate() {
    if (!state(K_FLASH)) return;
    if (M.flashPref === 'auto') M.set(null, 'reduced');
    if (NEU.save) NEU.save.flag(K_FLASH, 0);
  }

  /* ── boot ───────────────────────────────────────────────────────*/
  if (NEU.settings) return;                    // already built (re-run)
  migrate();
  build();
  apply();
  M.on(function () { apply(); refresh(); });
  setTimeout(deviceNote, 1800);
  /* The switch is in index.html's .ctl cluster, beside the light. */
  var mt = document.getElementById('muteToggle');
  if (mt) mt.addEventListener('click', function () { mute(!state(K_MUTE)); });

  NEU.settings = {
    open: open, close: close,
    apply: apply, set: set,
    get open_() { return open_; },
    get reduced() { return reducedNow(); },
    get shake() { return reducedNow() || shakePct() === 0; },
    get flash() { return M.calmFlash(); },
    get shakePct() { return shakePct(); },
    calmAll: calmAll, defaults: defaults,
    warnFlash: warnFlash, hideNote: hideNote,
    get text() { return state(K_TEXT); },
    get hints() { return state(K_HINTS); },
    get hitstop() { return state(K_STOP); },
    get particles() { return state(K_PART); },
    get photosensitive() { return state(K_PHOTOSENS); },
    get overlayIntensity() { return num(K_OVERLAY, 50) / 100; },
    get particleCap() { return num(K_PARTCAP, 500); },
    get relaxedQuiz() { return state(K_RELAX); },
    get muted() { return state(K_MUTE); },
    get music() { return num(K_MUSIC, 55); }
  };
})();
