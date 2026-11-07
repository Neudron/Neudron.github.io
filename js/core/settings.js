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
     relaxed quiz timer — the show gives twenty-four seconds, not twelve

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

   Opens on Ctrl + Shift + , and from the gear button top-right.
   The dialogue box (z-index 96) stays the top layer; this panel
   sits below it at 94.                                              */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var K_SHAKE = 'opt_noShake';      /* legacy switch: on = shake 0 %   */
  var K_SHAKEPCT = 'opt_shakePct';  /* 0..100, default 100              */
  var K_FLASH = 'opt_noFlash';
  var K_TEXT  = 'opt_largeText';
  var K_STOP  = 'opt_hitstop';      /* on = juice skips the held frame   */
  var K_PART  = 'opt_particles';    /* on = juice spawns no debris       */
  var K_RELAX = 'opt_relaxedQuiz';  /* on = the quiz gives twice the time */
  var K_MUSIC = 'opt_music';        /* owned by music.js; read here    */
  var K_MUTE  = 'opt_mute';         /* on = silent; the level is kept  */

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

  function apply() {
    if (NEU.juice) {
      NEU.juice.setNoShake(shakePct() === 0);
      if (NEU.juice.setShakeScale) NEU.juice.setShakeScale(shakePct() / 100);
      /* Flashing now lives in motion.js; the old switch only migrates. */
      NEU.juice.setNoFlash(false);
      NEU.juice.setNoHitstop(state(K_STOP));
      NEU.juice.setNoParticles(state(K_PART));
    }
    document.documentElement.classList.toggle('text-lg', !!state(K_TEXT));
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
  function slider(id, label, hint, get, set_, after) {
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
    rg.min = '0'; rg.max = '100'; rg.step = '5';
    rg.value = String(get());
    rg.setAttribute('aria-labelledby', l.id);
    /* not called label(): a function declaration would shadow the
       label PARAMETER above and print its own source as the row name */
    function vtext() { rg.setAttribute('aria-valuetext', +rg.value === 0 ? 'off' : rg.value + '%'); }
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
    if (NEU.save) { NEU.save.flag(K_SHAKEPCT, 0); NEU.save.flag(K_STOP, 1); NEU.save.flag(K_PART, 1); }
    apply(); refresh();
  }
  function defaults() {
    M.set('auto', 'auto');
    if (NEU.save) {
      NEU.save.flag(K_SHAKEPCT, 100); NEU.save.flag(K_SHAKE, 0); NEU.save.flag(K_STOP, 0);
      NEU.save.flag(K_PART, 0); NEU.save.flag(K_TEXT, 0); NEU.save.flag(K_RELAX, 0);
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

  var DEFS_INFO = [
    { def: 'w', title: 'W — move up — rooms, fights, dark walk' },
    { def: 'a', title: 'A — move left — rooms, fights, dark walk' },
    { def: 's', title: 'S — move down — rooms, fights, dark walk' },
    { def: 'd', title: 'D — move right — rooms, fights, dark walk' },
    { def: 'z', title: 'Z — confirm / melee / hold: ranged — rooms, fights, pot, shop' },
    { def: 'x', title: 'X — cancel / skip text / dash — rooms, fights' },
    { def: 'Shift', title: 'Shift — focus / slow move — fights' },
    { def: 'c', title: 'C — fight menu / equip — fights, inventory' },
    { def: 'r', title: 'R — reset room — puzzle rooms' },
    { def: 'i', title: 'I — items / inventory — Act IV' },
    { def: 'Tab', title: 'Tab — quest log — overworld' },
    { def: 'm', title: 'M — mute / unmute — global' },
    { def: 'e', title: 'E — interact — dark walk' }
  ];

  /* Keybinds page: lists every DEFS action with human label and minigames.
     Enter or click starts capture; Esc cancels; conflicts swap. */
  function drawKeys() {
    var host = document.getElementById('settKeys');
    if (!host || !NEU.keys) return;
    host.textContent = '';
    DEFS_INFO.forEach(function (info) {
      var line = document.createElement('div');
      line.className = 'sett__row';
      var l = document.createElement('span');
      l.className = 'sett__lbl';
      l.textContent = info.title;
      line.appendChild(l);

      var dots = document.createElement('span');
      dots.className = 'sett__dots';
      line.appendChild(dots);

      var b = document.createElement('button');
      b.type = 'button';
      b.className = info.def === 'e' ? 'sett__key-ext' : 'sett__key';
      var curKey = NEU.keys.label(info.def);
      b.textContent = '◀ ' + (curKey ? curKey.toUpperCase() : info.def) + ' ▶';

      function startCapture() {
        var note = document.getElementById('settKeyNote');
        b.textContent = 'press a key…';
        NEU.keys.capture(function (k) {
          if (k !== null) {
            var res = NEU.keys.set(info.def, k);
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
    pDisplay.appendChild(row('settText', 'larger text',
        'zooms the whole page 1.25x', function (on) {
      set(K_TEXT, on);
    }));

    /* 5. Accessibility pane */
    var pA11y = panes.accessibility;
    var st = document.createElement('p');
    st.className = 'sett__note sett__note--top';
    st.id = 'settDevice';
    st.textContent = deviceLine();
    pA11y.appendChild(st);

    pA11y.appendChild(row('settRelaxed', 'relaxed quiz timer',
        'twenty-four seconds a question, not twelve', function (on) {
      set(K_RELAX, on);
    }));
    pA11y.appendChild(row('settTouch', 'thumb controls',
        'on-screen stick and buttons for the game scenes', function (on) {
      if (NEU.touch) NEU.touch.set(on ? 'on' : 'off');
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

    twoPane.appendChild(catsNav);
    twoPane.appendChild(panesContainer);
    box.appendChild(twoPane);

    var keysNote = document.createElement('p');
    keysNote.className = 'sett__note';
    keysNote.textContent = 'open this any time: the gear, or ctrl + shift + comma. ' +
                           'settings save on this device.';
    box.appendChild(keysNote);

    panel.appendChild(box);
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
      ['settText',  state(K_TEXT)],
      ['settSound', !state(K_MUTE)],
      ['settHitstop',   state(K_STOP)],
      ['settParticles', state(K_PART)],
      ['settRelaxed', state(K_RELAX)],
      ['settTouch', NEU.touch ? NEU.touch.visible || NEU.touch.mode === 'on' : false]
    ];
    for (var i = 0; i < rows.length; i++) {
      var el = document.getElementById(rows[i][0]);
      if (el) el.setAttribute('aria-checked', String(!!rows[i][1]));
    }
    var m = document.getElementById('settMusic');
    if (m) m.value = String(num(K_MUSIC, 55));
    var sk = document.getElementById('settShake');
    if (sk) {
      sk.value = String(shakePct());
      sk.setAttribute('aria-valuetext', shakePct() === 0 ? 'off' : shakePct() + '%');
    }
    var dv = document.getElementById('settDevice');
    if (dv) dv.textContent = deviceLine();
    ['settMotion', 'settFlashing'].forEach(function (id) {
      var g = document.getElementById(id);
      if (g && g._paint) g._paint();
    });
  }

  /* The panel's focusables. Disabled ones are skipped: a trap that wraps
     to one eats Tabs silently. A radiogroup is ONE tab stop (its picked
     option has tabIndex 0); arrows move inside it. */
  function focusables() {
    var all = panel.querySelectorAll('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)');
    var out = [], i;
    for (i = 0; i < all.length; i++) out.push(all[i]);
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
  function hideNote() { if (note) { note.remove(); note = null; } }
  function showNote(text, actions) {
    hideNote();
    note = document.createElement('div');
    note.className = 'rmnote';
    note.setAttribute('role', 'status');
    var p = document.createElement('p');
    p.className = 'rmnote__t';
    p.textContent = text;
    note.appendChild(p);
    var row = document.createElement('div');
    row.className = 'rmnote__row';
    actions.forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rmnote__b';
      b.textContent = a[0];
      b.addEventListener('click', function () { hideNote(); if (a[1]) a[1](); });
      row.appendChild(b);
    });
    note.appendChild(row);
    document.body.appendChild(note);
  }

  /* First visit with the device asking for less motion: say it, once. */
  function deviceNote() {
    if (!M.device || M.pref !== 'auto' || !M.once('device')) return;
    showNote('your device asks for less motion, so this site stays calm: ' +
             'no spinning, shaking or flashing on its own. everything still works.',
      [['keep it calm', null],
       ['turn motion on', function () { M.set('full', null); refresh(); }],
       ['settings', open]]);
  }

  /* Before the first game scene: the photosensitivity heads-up. */
  function warnFlash() {
    if (!M.once('flash')) return;
    if (M.calmFlash() && shakePct() === 0) return;   /* already calm */
    showNote('heads up: the game has flashing lights and screen shake. ' +
             'you can turn them down any time with the gear (top left).',
      [['ok', null],
       ['make it calm', calmAll],
       ['settings', open]]);
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
    get hitstop() { return state(K_STOP); },
    get particles() { return state(K_PART); },
    get relaxedQuiz() { return state(K_RELAX); },
    get muted() { return state(K_MUTE); },
    get music() { return num(K_MUSIC, 55); }
  };
})();
