/* settings.js — the accessibility panel.
   ───────────────────────────────────────────────────────────────────
   The backend existed first: juice.js exposes setNoShake/setNoFlash,
   danmaku.js dims instead of blinking, and nothing let a player
   reach any of it. This is the panel.

   THREE SWITCHES, PERSISTED IN THE SAVE FILE:

     reduce screen shake — juice.js stops adding trauma
     reduce flashing    — juice.js stops the white overlay
     larger text        — zooms the whole page 1.25x

   Larger text is a zoom, not a font-size, and that is deliberate:
   the Undertale faces are drawn on a 16px grid, so resampling a
   single font-size blurs the typeface. Zooming the page scales
   EVERYTHING together and keeps the grid intact.

   prefers-reduced-motion forces the first two ON and disables their
   switches — the OS preference is the player's own statement, and
   the panel is for people who cannot say it there.

   Opens on Ctrl + Shift + , and from the gear button top-right.
   The dialogue box (z-index 96) stays the top layer; this panel
   sits below it at 94.                                              */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var K_SHAKE = 'opt_noShake';
  var K_FLASH = 'opt_noFlash';
  var K_TEXT  = 'opt_largeText';
  var K_MUSIC = 'opt_music';        /* owned by music.js; read here    */

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  function apply() {
    var shake = reduced || state(K_SHAKE);
    var flash = reduced || state(K_FLASH);
    if (NEU.juice) { NEU.juice.setNoShake(shake); NEU.juice.setNoFlash(flash); }
    document.documentElement.classList.toggle('text-lg', !!state(K_TEXT));
  }

  function set(k, v) {
    if (NEU.save) NEU.save.flag(k, v ? 1 : 0);
    apply();
  }

  /* ── the panel ──────────────────────────────────────────────────*/
  var panel = null, btn = null, open_ = false;

  function row(id, label, hint, lockReduced, cb) {
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

    var sw = document.createElement('button');
    sw.className = 'sett__sw';
    sw.id = id;
    sw.type = 'button';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-labelledby', l.id);
    sw.setAttribute('aria-checked', 'false');
    if (reduced && lockReduced) {
      sw.disabled = true;
      sw.setAttribute('aria-checked', 'true');
    }
    sw.addEventListener('click', function () {
      var on = sw.getAttribute('aria-checked') === 'true';
      sw.setAttribute('aria-checked', String(!on));
      cb(!on);
    });

    r.appendChild(l);
    r.appendChild(sw);
    return r;
  }

  /* A range, not a mute switch plus a level. Zero IS the mute, and one
     control that goes to zero is one thing to find rather than two
     that can disagree with each other. */
  function slider(id, label, hint, get, set_) {
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

    var rg = document.createElement('input');
    rg.className = 'sett__rng';
    rg.id = id;
    rg.type = 'range';
    rg.min = '0'; rg.max = '100'; rg.step = '5';
    rg.value = String(get());
    rg.setAttribute('aria-labelledby', l.id);
    function push() {
      set_(+rg.value);
      rg.setAttribute('aria-valuetext', +rg.value === 0 ? 'off' : rg.value + '%');
    }
    rg.addEventListener('input', push);
    rg.addEventListener('change', push);
    push();

    r.appendChild(l);
    r.appendChild(rg);
    return r;
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
    box.appendChild(row('settShake', 'reduce screen shake',
        'hits will not rock the page or the scenes', true, function (on) {
      set(K_SHAKE, on);
    }));
    box.appendChild(row('settFlash', 'reduce flashing',
        'impacts will dim instead of flashing white', true, function (on) {
      set(K_FLASH, on);
    }));
    box.appendChild(row('settText', 'larger text',
        'zooms the whole page 1.25x', false, function (on) {
      set(K_TEXT, on);
    }));
    /* Thumb controls appear on their own on a touch screen. This is
       the override for the two cases auto-detection gets wrong: a
       laptop with a touchscreen that does not want them, and a tablet
       with a keyboard attached that does. */
    box.appendChild(row('settTouch', 'thumb controls',
        'on-screen stick and buttons for the game scenes', false, function (on) {
      if (NEU.touch) NEU.touch.set(on ? 'on' : 'off');
    }));
    /* The soundtrack is synthesised, so this is a real level and not a
       "load the files or not" decision — dragging it to zero costs
       nothing and can be undone mid-room. */
    box.appendChild(slider('settMusic', 'music',
        'the act IV soundtrack. drag to zero for silence.',
        function () { return NEU.music ? NEU.music.volume : num(K_MUSIC, 55); },
        function (v) {
          if (NEU.music) NEU.music.setVolume(v);
          else if (NEU.save) NEU.save.flag(K_MUSIC, v);
        }));

    if (reduced) {
      var n = document.createElement('p');
      n.className = 'sett__note';
      n.textContent = 'your system already asks for reduced motion, ' +
                      'so shake and flash are off for you.';
      box.appendChild(n);
    }

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
      ['settShake', reduced || state(K_SHAKE)],
      ['settFlash', reduced || state(K_FLASH)],
      ['settText',  state(K_TEXT)],
      ['settTouch', NEU.touch ? NEU.touch.visible || NEU.touch.mode === 'on' : false]
    ];
    for (var i = 0; i < rows.length; i++) {
      var el = document.getElementById(rows[i][0]);
      if (el) el.setAttribute('aria-checked', String(!!rows[i][1]));
    }
    var m = document.getElementById('settMusic');
    if (m) m.value = String(NEU.music ? NEU.music.volume : num(K_MUSIC, 55));
  }

  function open() {
    if (open_) return;
    open_ = true;
    refresh();
    panel.hidden = false;
    document.body.classList.add('is-playing');
    var first = panel.querySelector('[role="switch"]');
    (first || panel.querySelector('.sett__x')).focus();
    requestAnimationFrame(function () { panel.classList.add('is-in'); });
  }

  function close() {
    if (!open_) return;
    open_ = false;
    panel.classList.remove('is-in');
    panel.hidden = true;
    document.body.classList.remove('is-playing');
    if (btn) btn.focus();
  }

  /* ── keyboard ───────────────────────────────────────────────────
     Ctrl + Shift + , — comma, not backquote: the dev console owns
     backquote, and comma needs both modifiers to be reachable by
     accident, exactly like the console. e.code because with the
     modifiers held the key value varies by layout. */
  addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey &&
        (e.code === 'Comma' || e.key === ',' || e.key === '<')) {
      e.preventDefault();
      open_ ? close() : open();
      return;
    }
    if (!open_ || !panel) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      /* Buttons AND inputs. The trap used to collect only buttons, so
         the moment a slider was added Tab walked straight out of a
         dialog marked aria-modal and left the player behind the scrim
         with no way back to the close button. */
      var els = panel.querySelectorAll('button, input');
      if (!els.length) return;
      var i = Array.prototype.indexOf.call(els, document.activeElement);
      if (e.shiftKey) {
        if (i <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
      } else {
        if (i === -1 || i >= els.length - 1) { e.preventDefault(); els[0].focus(); }
      }
      return;
    }
  });

  /* ── boot ───────────────────────────────────────────────────────*/
  if (NEU.settings) return;                    // already built (re-run)
  build();
  apply();

  NEU.settings = {
    open: open, close: close,
    apply: apply, set: set,
    get open_() { return open_; },
    get reduced() { return reduced; },
    get shake() { return reduced || state(K_SHAKE); },
    get flash() { return reduced || state(K_FLASH); },
    get text() { return state(K_TEXT); },
    get music() { return NEU.music ? NEU.music.volume : num(K_MUSIC, 55); }
  };
})();