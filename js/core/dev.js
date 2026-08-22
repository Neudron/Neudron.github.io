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

  addEventListener('keydown', function (e) {
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
  });

  input.addEventListener('keydown', function (e) {
    e.stopPropagation();                       // don't drive the game from in here
    if (e.key === 'Enter') { run(input.value); input.value = ''; }
    else if (e.key === 'Escape') hide();
  });

  var go = document.getElementById('devGo');
  if (go) go.addEventListener('click', function () { run(input.value); input.value = ''; });

  log('dev console. type help.');
  NEU.dev = { show: show, hide: hide, run: run };
})();
