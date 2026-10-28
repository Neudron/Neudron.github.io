/* dev.js — the skip button.
   ───────────────────────────────────────────────────────────────────
   Ctrl + Shift + `  (backquote)

   Everything past the contact section is gated behind a nine-swing
   errand, and re-walking it to test the room behind the door is a
   minute of scrolling per attempt. This exists so it doesn't have to
   be.

   The combination is deliberately awkward: backquote is not on any
   browser or OS shortcut worth colliding with, and requiring both
   modifiers means it cannot be hit by accident while reading. It is
   not hidden — it is just not discoverable, which is the right level
   of secret for a tool rather than an easter egg.

   Commands are matched loosely (trimmed, lowercased) because the
   point is speed, not ceremony.                                     */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  var panel = document.getElementById('dev');
  var input = document.getElementById('devIn');
  var out   = document.getElementById('devOut');
  if (!panel || !input || !out) return;

  function log(s) {
    var p = document.createElement('div');
    p.textContent = s;
    out.appendChild(p);
    out.scrollTop = out.scrollHeight;
  }

  /* ── admin: cheats and the skip chain ────────────────────────────
     Only ever run when someone types them here. The cheats are read by
     the fight (boss-scal.js) and by nothing else; NEU.cheat starts neutral
     and is never set on its own. */
  NEU.cheat = { god: false, dmgMul: 1, startFrac: 0 };

  /* One ordered table, in the order the objectives tab reads it. Each
     stage lists what is true AFTER it: quest marks, counts, save flags,
     items. `skip <stage>` clears everything the table owns, then applies
     every stage up to and including the target, so nothing a later stage
     depends on can be missing. `scene` is where the target drops you;
     `frac` is the SCal HP share the fight starts at (phases). Keep this
     in step with quest.js and act4.js when a step is added. */
  var SOLVED = ['b2_blocks', 'b3_braziers', 'b4_ice', 'b5_two', 'b6_dark'];
  var CHAIN = [
    { id: 'act1 start', marks: [] },
    { id: 'sword', marks: ['sans'] },
    { id: 'key', marks: ['break'] },
    { id: 'act2 bullet', marks: ['door', 'survive', 'dog'] },
    { id: 'act2 dark', marks: ['hammer', 'smash', 'greydoor', 'clicker', 'fixed'],
      counts: { answers: 4 } },
    { id: 'act3 sleep', marks: ['sleep', 'console'] },
    { id: 'tv', marks: ['docked'], counts: { charge: 2 }, flags: { console_charge: 100 } },
    { id: 'deck', marks: ['deck'] },
    { id: 'act4 start', marks: ['a4_in', 'a4_witch'], flags: { witch_met: 1 },
      scene: { room: 'a1_clearing', spawn: 'default' } },
    { id: 'scal room', counts: { a4_rooms: 5 },
      flags: { 'solved:b2_blocks': 1, 'solved:b3_braziers': 1, 'solved:b4_ice': 1,
               'solved:b5_two': 1, 'solved:b6_dark': 1 },
      scene: { room: 'b6_dark', spawn: 'default' } },
    { id: 'scal fight', scene: { room: 'b8_arena', spawn: 'west' } },
    { id: 'scal p1', scene: { room: 'b8_arena', spawn: 'west' }, frac: 0.6 },
    { id: 'scal p2', scene: { room: 'b8_arena', spawn: 'west' }, frac: 0.3 },
    { id: 'scal p3', scene: { room: 'b8_arena', spawn: 'west' }, frac: 0.1 },
    { id: 'scal desp', scene: { room: 'b8_arena', spawn: 'west' }, frac: 0.01 },
    { id: 'quiz', marks: ['a4_scal', 'a4_ashes', 'a4_recall', 'a4_home', 'a4_told',
                         'a4_smash', 'a4_tenna', 'a4_rank'],
      flags: { scal_dead: 1, home_seen: 1, tv_breakable: 1, tv_broken: 1, quiz_rank: 'A',
               'rank:A': 1, 'rank:A–': 1, 'rank:B': 1, 'rank:B–': 1,
               'rank:C': 1, 'rank:C–': 1, 'rank:Z': 1 },
      items: ['ashes'], scene: { room: 'a1_clearing', spawn: 'default' } },
    { id: 'axe', marks: ['a4_nutz', 'a4_trip', 'a4_axe'], counts: { a4_prizes: 9 },
      items: ['axe'], scene: { room: 'a1_clearing', spawn: 'default' } },
    { id: 'mushrooms', marks: ['a4_pot', 'a4_soup'], counts: { a4_mush: 5 },
      flags: { soup_made: 1 }, items: ['soup'], scene: { room: 'a1_clearing', spawn: 'default' } },
    { id: 'polterghast', marks: ['a4_wake', 'a4_chair', 'a4_crack'],
      flags: { dog_gone: 1, sans_sits: 1, crack_armed: 1 } },
    { id: 'end', marks: ['a4_polt', 'a4_end'], flags: { polt_dead: 1, act4_done: 1 },
      scene: { room: 'a1_clearing', spawn: 'default' } }
  ];
  var SKIP_KEY = 'neu.skip';

  function stageOf(name) {
    for (var i = 0; i < CHAIN.length; i++) if (CHAIN[i].id === name) return i;
    return -1;
  }

  function skipTo(name) {
    var idx = stageOf(name);
    if (idx < 0) return false;
    /* Counted Act IV steps only exist in the quest list once installed, and
       quest.bump ignores a step it cannot find. */
    if (NEU.act4 && NEU.act4.install) NEU.act4.install();
    /* Clear everything the table owns, so the target is exact rather than
       "whatever was already done plus this". */
    var ids = [], flags = [], items = [], i, j, st;
    for (i = 0; i < CHAIN.length; i++) {
      st = CHAIN[i];
      (st.marks || []).forEach(function (m) { ids.push(m); });
      Object.keys(st.counts || {}).forEach(function (c) { ids.push(c); });
      Object.keys(st.flags || {}).forEach(function (f) { if (flags.indexOf(f) < 0) flags.push(f); });
      (st.items || []).forEach(function (it) { if (items.indexOf(it) < 0) items.push(it); });
    }
    NEU.quest.replay(ids);
    flags.forEach(function (f) { NEU.save.flag(f, 0); });
    items.forEach(function (it) { NEU.save.take(it); });
    for (i = 0; i <= idx; i++) {
      st = CHAIN[i];
      (st.marks || []).forEach(function (m) { NEU.quest.mark(m); });
      Object.keys(st.counts || {}).forEach(function (c) { NEU.quest.bump(c, st.counts[c]); });
      Object.keys(st.flags || {}).forEach(function (f) { NEU.save.flag(f, st.flags[f]); });
      (st.items || []).forEach(function (it) { NEU.save.give(it); });
    }
    /* Where the target drops you. The save file holds the room, so the
       reload below and act4.open() both read the same answer. */
    NEU.save.capture();
    var sc = CHAIN[idx].scene;
    NEU.save.data.room = sc ? sc.room : null;
    NEU.save.data.spawn = sc ? sc.spawn : null;
    NEU.save.flush();
    try {
      sessionStorage.setItem(SKIP_KEY, JSON.stringify({ id: name, frac: CHAIN[idx].frac || 0 }));
    } catch (e) {}
    return true;
  }

  function reloadPage() { try { location.reload(); } catch (e) {} }

  function sectionNames() { return CHAIN.map(function (s) { return s.id; }); }

  var CMDS = {
    help: function () {
      log('sans   skip the whole sword errand, hand over the key');
      log('key    same thing, shorter');
      log('door   open the room');
      log('game   start the bullet hell');
      log('food   grant "dog food?"');
      log('dog    summon him directly');
      log('dark   open the blackout');
      log('warp   stand at the grey door');
      log('sw     stand on the switch (the way out)');
      log('sleep  skip to the sleeping scene');
      log('con    make the console appear');
      log('take   pocket the console, fully charged');
      log('chg    fill the charge to 100%');
      log('deck   open the console menu');
      log('set    open the settings panel');
      log('sheet  list sprite sheets · "sheet scal" overlays its grid');
      log('fps    frame-time meter · "fps off" to stop · "fps ?" to read it');
      log('save   write the save file and show it');
      log('wipe   delete the save file');
      log('reset  back to the start');
      log('state  dump quest steps, flags, items, room');
      log('skip   skip <section> applies every earlier step, then goes there');
      log('god    toggle infinite soul hp (the fight)');
      log('dmg    dmg <mult|inf|off> multiplies the fight\'s damage');
      log('hp     hp <n> sets the soul\'s hp (in the fight)');
      log('heal   soul back to full (in the fight)');
      log('tp     tp <0-100> sets the soul\'s tp (in the fight)');
      log('close  esc also works');
    },
    sans: function () {
      if (NEU.devSkip) { NEU.devSkip(); log('skipped. key is yours, door is live.'); }
      else log('sans.js not loaded');
    },
    door: function () {
      if (NEU.devOpenRoom) { NEU.devOpenRoom(); log('room open.'); }
      else log('no door');
    },
    game: function () {
      if (NEU.bullet) { hide(); NEU.bullet.open(); log('good luck.'); }
      else log('bullet.js not loaded');
    },
    food: function () {
      if (NEU.grantDogFood) { NEU.grantDogFood(); log('"dog food?" granted.'); }
      else log('nope');
    },
    dog: function () {
      if (NEU.devDog) { NEU.devDog(); log('who let him in'); }
      else log('nope');
    },
    dark: function () {
      if (NEU.dark) { hide(); NEU.dark.open(); log('lights out.'); }
      else log('dark.js not loaded');
    },
    warp: function () {
      if (NEU.dark) { NEU.dark.warp(); log('at the door.'); }
      else log('nope');
    },
    sw: function () {
      if (NEU.dark && NEU.dark.warpSw) { NEU.dark.warpSw(); log('standing on the switch.'); }
      else log('nope');
    },
    sleep: function () { if (NEU.devSleep) { NEU.devSleep(); log('lights out for them.'); } },
    con:   function () { if (NEU.devSwitch) { NEU.devSwitch(); log('console is there.'); } },
    take:  function () {
      if (NEU.devTake) { NEU.devTake(); log('pocketed and charged. go dock it.'); }
      else log('nope');
    },
    chg:   function () {
      if (NEU.devCharge) log('charge: ' + NEU.devCharge(100) + '%');
      else log('bullet.js not loaded');
    },
    deck:  function () { if (NEU.deck) { hide(); NEU.deck.open(); log('booting.'); }
                         else log('deck.js not loaded'); },
    set:   function () {
      if (NEU.settings) { hide(); NEU.settings.open(); log('settings.'); }
      else log('settings.js not loaded');
    },
    reset: function () {
      if (NEU.devReset) { NEU.devReset(); log('reset.'); }
      else log('nope');
    },
    close: function () { hide(); },

    /* ── cheats: read by the fight (boss-scal.js), nothing else ───── */
    god: function () {
      NEU.cheat.god = !NEU.cheat.god;
      log('god ' + (NEU.cheat.god ? 'on. the soul cannot be hurt.' : 'off.'));
    },
    dmg: function (arg) {
      var a = String(arg || '').toLowerCase();
      if (!a) { log('damage x' + NEU.cheat.dmgMul + '. usage: dmg <mult|inf|off>'); return; }
      var m = (a === 'inf' || a === 'infinite') ? 1e9 : (a === 'off' ? 1 : parseFloat(a));
      if (!(m > 0)) { log('usage: dmg <mult|inf|off>'); return; }
      NEU.cheat.dmgMul = m;
      log(m >= 1e9 ? 'damage infinite.' : 'damage x' + m + '.');
    },
    hp: function (arg) {
      if (!NEU.scal || !NEU.scal.active) { log('the soul is not on screen. go into the fight first.'); return; }
      var n = parseInt(arg, 10);
      if (isNaN(n)) { log('usage: hp <n>'); return; }
      NEU.scal.setHp(n);
      log('soul hp ' + NEU.scal.soulHP + '.');
    },
    heal: function () {
      if (!NEU.scal || !NEU.scal.active) { log('the soul is not on screen. go into the fight first.'); return; }
      NEU.scal.heal();
      log('soul healed to full.');
    },
    tp: function (arg) {
      if (!NEU.scal || !NEU.scal.active) { log('the soul is not on screen. go into the fight first.'); return; }
      var n = parseInt(arg, 10);
      if (isNaN(n)) { log('usage: tp <0-100>'); return; }
      NEU.scal.setTp(n);
      log('tp ' + Math.round(NEU.scal.tp * 100) + '%.');
    },

    /* ── skip: apply every earlier stage, then drop into the target ── */
    skip: function (arg) {
      /* "scal-room" and "scal room" both name the stage */
      var name = String(arg || '').trim().toLowerCase().replace(/-/g, ' ');
      if (!name) {
        log('skip <section>. in order:');
        log('  ' + sectionNames().join(' · '));
        return;
      }
      if (!NEU.save || !NEU.quest) { log('save.js or quest.js not loaded'); return; }
      if (!skipTo(name)) { log('no section "' + name + '". try: skip'); return; }
      log('skipped to ' + name + '. reloading.');
      reloadPage();
    },
    /* Dumps what the game remembers, for reading back a skip or a bug. */
    state: function () {
      if (!NEU.save || !NEU.quest) { log('save.js or quest.js not loaded'); return; }
      var d = NEU.save.data, done = NEU.quest.snapshot().done;
      var qs = Object.keys(done).filter(function (k) { return done[k]; });
      log('quest: ' + (qs.join(' ') || '(none)'));
      var fl = d.flags, ks = Object.keys(fl).filter(function (k) { return fl[k]; }).sort();
      log('flags: ' + (ks.map(function (k) { return k + '=' + fl[k]; }).join(' ') || '(none)'));
      log('items: ' + (d.items.join(' ') || '(none)') + '   room: ' + (d.room || '(page)'));
    },

    /* ── the sprite inspector ───────────────────────────────────────
       Terraria keeps frame counts in the mod's C#, not in the PNG, so
       five entries in sheets.js are best-fit rather than proven. This
       draws the sheet with the cell grid on top of it: if the count is
       right, every cell holds exactly one sprite and nothing is cut.
       Wrong counts are obvious in one look, and the fix is one line in
       sheets.js — no other file knows these numbers. */
    sheet: function (name) {
      if (!NEU.sheets) { log('sheets.js not loaded'); return; }
      if (!name) {
        var names = Object.keys(NEU.sheets);
        log(names.length + ' sheets. provisional ones first:');
        names.filter(function (n) { return NEU.sheets[n].provisional; })
             .forEach(function (n) { log('  ? ' + n); });
        log('  ' + names.filter(function (n) { return !NEU.sheets[n].provisional; }).join(' '));
        log('usage: sheet <name>');
        return;
      }
      var s = NEU.sheets[name];
      if (!s) { log('no sheet "' + name + '"'); return; }
      showSheet(name, s);
      log(name + ': ' + s.w + 'x' + s.h + ', ' + s.frames + ' x ' +
          s.fw + 'x' + s.fh + (s.provisional ? '  (PROVISIONAL)' : ''));
      if (s.verify) log('also verify: ' + s.verify);
    },

    save: function () {
      if (!NEU.save) { log('save.js not loaded'); return; }
      NEU.save.capture(); NEU.save.flush();
      log(NEU.save.usable ? 'written.' : 'storage unavailable — memory only.');
      log(NEU.save.serialise().slice(0, 220));
    },
    wipe: function () {
      if (NEU.save) { NEU.save.wipe(); log('save wiped.'); }
    },
    goto: function (room) {
      if (!room) {
        log('usage: goto <room>. rooms: ' +
          (NEU.engine && NEU.engine.rooms ? NEU.engine.rooms.join(' ') : '(engine not loaded)'));
        return;
      }
      if (!NEU.engine || !NEU.engine.enter) { log('engine.js not loaded'); return; }
      hide();
      if (NEU.engine.enter(room)) log('now in ' + room + '.');
      else log('no room "' + room + '". try the list.');
    }
  };

  /* The overlay. Its own element rather than a canvas inside the dev
     panel: the sheets are up to 1800px tall and need to be scrolled. */
  var box = null;
  function showSheet(name, s) {
    if (!box) {
      box = document.createElement('div');
      box.className = 'sheetbox';
      box.addEventListener('click', function () { box.hidden = true; });
      document.body.appendChild(box);
    }
    box.hidden = false;
    box.innerHTML = '';

    var wrapEl = document.createElement('div');
    wrapEl.className = 'sheetbox__in';
    var im = document.createElement('img');
    im.src = s.src;
    im.className = 'sheetbox__img';
    wrapEl.appendChild(im);

    /* One absolutely-positioned rule per cell boundary. Cheap, exact,
       and it scales with the image because the wrapper is the image's
       own size. */
    im.addEventListener('load', function () {
      for (var i = 1; i < s.frames; i++) {
        var ln = document.createElement('i');
        ln.className = 'sheetbox__ln';
        ln.style.top = (i * s.fh) + 'px';
        wrapEl.appendChild(ln);
      }
      var cap = document.createElement('b');
      cap.className = 'sheetbox__cap';
      cap.textContent = name + '  ' + s.frames + ' x ' + s.fw + 'x' + s.fh +
                        (s.provisional ? '  PROVISIONAL' : '  confirmed');
      wrapEl.appendChild(cap);
    });
    im.addEventListener('error', function () {
      var e = document.createElement('b');
      e.className = 'sheetbox__cap';
      e.textContent = 'could not load ' + s.src;
      wrapEl.appendChild(e);
    });
    box.appendChild(wrapEl);
  }
  /* The frame-time meter. The sampling lives in core/perf.js so that
     nothing measures anything until this is typed — an fps counter
     that runs all the time is part of the problem it is reporting. */
  CMDS.fps = function (arg) {
    if (!NEU.perf) { log('perf.js not loaded'); return; }
    var a = String(arg || '').toLowerCase();
    if (a === 'off' || a === 'stop') {
      log(NEU.perf.stop() ? 'meter off. last window: ' + NEU.perf.line() : 'not running');
      return;
    }
    if (a === '?' || a === 'read' || a === 'stats') { log(NEU.perf.line()); return; }
    NEU.perf.start();
    log('meter on. budget ' + NEU.perf.TARGET.toFixed(1) + 'ms target / ' +
        NEU.perf.WARN.toFixed(1) + 'ms warn / ' + NEU.perf.FAIL.toFixed(1) + 'ms fail.');
    log('reading is  fps   p50 / p95 / worst ms   scene. judged on p95.');
  };

  CMDS.k = CMDS.key = CMDS.sans;     // aliases, because typing is the cost

  /* Arguments, because `sheet` and `goto` need one. The command word is
     lowercased; the rest is passed through verbatim, since sheet names
     and room ids are case-sensitive identifiers. */
  function run(raw) {
    var line = String(raw || '').trim();
    if (!line) return;
    log('> ' + line);
    var sp = line.indexOf(' ');
    var c = (sp < 0 ? line : line.slice(0, sp)).toLowerCase();
    var arg = sp < 0 ? '' : line.slice(sp + 1).trim();
    if (CMDS[c]) CMDS[c](arg);
    else log('? try: sans, door, game, food, dog, dark, warp, sheet, save, help');
  }

  function show() {
    panel.hidden = false;
    input.value = '';
    input.focus();
  }
  function hide() { panel.hidden = true; input.blur(); }

  /* Capture, so the console's ESC lands before the minigames' ESC on window. */
  addEventListener('keydown', function (e) {
    if (document.getElementById('confirmExit')) return;   /* a Leave prompt owns the keyboard */
    /* `e.code` rather than `e.key`: with Ctrl+Shift held, `key` for
       this physical key varies by layout and by browser, but the code
       is always Backquote. */
    if (e.ctrlKey && e.shiftKey && (e.code === 'Backquote' || e.key === '~' || e.key === '`')) {
      e.preventDefault();
      panel.hidden ? show() : hide();
      return;
    }
    if (!panel.hidden && e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();          /* the console ate this key — the room must not also read it as leave */
      hide();
    }
  }, true);

  input.addEventListener('keydown', function (e) {
    e.stopPropagation();                       // don't drive the game from in here
    if (e.key === 'Enter') { run(input.value); input.value = ''; }
    else if (e.key === 'Escape') hide();
  });

  var go = document.getElementById('devGo');
  if (go) go.addEventListener('click', function () { run(input.value); input.value = ''; });

  log('dev console. type help.');
  /* A skip that asked for a reload lands here. Only the console writes the
     key, so a plain visit never runs this. The reload is what makes the
     restore path (sans, console, key) do the work it would do for a real
     return visit. */
  (function pendingSkip() {
    var raw = null;
    try { raw = sessionStorage.getItem(SKIP_KEY); sessionStorage.removeItem(SKIP_KEY); } catch (e) {}
    if (!raw) return;
    var p;
    try { p = JSON.parse(raw); } catch (e) { return; }
    var idx = stageOf(p.id);
    if (idx < 0) return;
    NEU.cheat.startFrac = p.frac || 0;
    /* a scene is an act-four room, which act4.open resumes from the save */
    if (CHAIN[idx].scene) setTimeout(function () {
      if (NEU.act4) NEU.act4.open();
      log('skipped to ' + p.id + '.');
    }, 400);
    else log('skipped to ' + p.id + '.');
  })();

  NEU.dev = { show: show, hide: hide, run: run };
})();
