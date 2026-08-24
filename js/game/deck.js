/* deck.js — what's actually on the television.
   ───────────────────────────────────────────────────────────────────
   Dock the console and you get a handheld's home screen on the big
   screen, because that is what docking a handheld does. It replaced a
   boss fight, and the swap is the right one: the fight was a joke with
   a single punchline that you could only hear once. A library is a
   joke you can browse.

   Decisions worth writing down:

   1. DOM, NOT CANVAS. Everything else full-screen on this site is a
      canvas because everything else is a game — bullets, a torch, a
      walk cycle. This is an interface. Canvas text is unselectable,
      unreadable to a screen reader, and has to be re-laid-out by hand
      on every resize. A menu should be made of elements.

   2. THE SHELF IS ONE ROW THAT SCROLLS, not a grid. Console home
      screens are horizontal because a thumbstick is horizontal, and
      the horizontal-ness is most of what makes something read as a
      console rather than as a web page with cards on it.

   3. HALF THE LIBRARY DOESN'T RUN, and each broken one fails
      DIFFERENTLY. A row of tiles that all say "coming soon" is one
      joke told four times. A missing executable, a stalled update, an
      architecture mismatch and a thing that is already running are
      four jokes, and they are all real errors that real libraries
      produce.

   4. NAVIGABLE BY KEYBOARD FIRST. Arrows and enter, because that is
      what a d-pad maps to and because the rest of the page is already
      driven that way. Mouse works too; it just isn't the point.     */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var wrap  = document.getElementById('deck');
  if (!wrap) { NEU.deck = { open: function () {}, close: function () {} }; return; }

  var shelf = document.getElementById('deckShelf');
  var elTitle = document.getElementById('deckTitle');
  var elMeta  = document.getElementById('deckMeta');
  var elErr   = document.getElementById('deckErr');
  var elPlay  = document.getElementById('deckPlay');
  var elClock = document.getElementById('deckClock');
  var elBatt  = document.getElementById('deckBattTxt');
  var elFill  = document.getElementById('deckBattFill');

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── cover art ──────────────────────────────────────────────────
     Six of the seven tiles used to be two letters on a gradient. That
     reads as a placeholder because it IS one, and on a shelf whose
     whole job is "which of these is the real game" it made six jokes
     look identical to each other.

     RULES THESE ALL FOLLOW, so the shelf reads as one shelf:
       48x48 viewBox, stroke-width 2, no gradients, no curves that a
       pixel grid could not hold. Two colours per cover — `ink` for the
       line, `hi` for the one accent — both pulled from the tile's own
       two-colour gradient so the drawing belongs to its box.

     AND EACH ONE POINTS AT SOMETHING REAL, rather than being generic
     box art. The dark's cover is three nested squares because the
     torch in that game is stepped and not smooth, which was a
     deliberate decision (see decisions.md) and is the one thing you
     would recognise. neu.ac gets the glass cube off the front page.

     KEPT: the initials fallback below. Same reasoning as the tileset
     `colours` — a cover that silently fails to draw should degrade to
     something, not to an empty box. */
  var SIGILS = {
    /* the brimstone star. the only one of these that already existed */
    woods: function (ink, hi) {
      return '<path d="M24 3 L30 17 L44 20 L34 30 L37 45 L24 38 L11 45 L14 30 L4 20 L18 17 Z" ' +
             'fill="none" stroke="' + ink + '" stroke-width="2"/>' +
             '<circle cx="24" cy="26" r="6" fill="' + ink + '"/>' +
             '<path d="M24 12 L24 20 M16 26 L10 26 M38 26 L32 26" stroke="' + hi + '" stroke-width="2"/>';
    },
    /* twenty seconds: the soul, and the clock running out around it */
    twenty: function (ink, hi) {
      return '<path d="M24 40 L10 26 A8 8 0 0 1 24 16 A8 8 0 0 1 38 26 Z" ' +
             'fill="none" stroke="' + ink + '" stroke-width="2"/>' +
             '<path d="M24 6 A18 18 0 1 1 6 24" fill="none" stroke="' + hi + '" ' +
             'stroke-width="2" stroke-linecap="square"/>' +
             '<path d="M24 6 L24 12" stroke="' + hi + '" stroke-width="2"/>';
    },
    /* the dark: the torch, stepped and not smooth, which is the whole
       point of that scene */
    dark: function (ink, hi) {
      return '<rect x="4"  y="4"  width="40" height="40" fill="none" stroke="' + ink + '" stroke-width="2"/>' +
             '<rect x="11" y="11" width="26" height="26" fill="none" stroke="' + ink + '" stroke-width="2"/>' +
             '<rect x="18" y="18" width="12" height="12" fill="none" stroke="' + hi + '" stroke-width="2"/>' +
             '<rect x="22" y="22" width="4"  height="4"  fill="' + hi + '"/>';
    },
    /* skeleton simulator */
    skele: function (ink, hi) {
      return '<path d="M12 10 H36 V30 H30 V38 H18 V30 H12 Z" fill="none" stroke="' + ink + '" stroke-width="2"/>' +
             '<rect x="17" y="17" width="5" height="6" fill="' + ink + '"/>' +
             '<rect x="26" y="17" width="5" height="6" fill="' + ink + '"/>' +
             '<path d="M22 28 H26" stroke="' + hi + '" stroke-width="2"/>';
    },
    /* wax tycoon: a candle, burning down, which is the joke */
    wax: function (ink, hi) {
      return '<rect x="17" y="20" width="14" height="22" fill="none" stroke="' + ink + '" stroke-width="2"/>' +
             '<path d="M24 6 L29 14 A5 5 0 1 1 19 14 Z" fill="none" stroke="' + hi + '" stroke-width="2"/>' +
             '<path d="M24 16 L24 20" stroke="' + ink + '" stroke-width="2"/>' +
             '<path d="M17 34 H31" stroke="' + ink + '" stroke-width="2"/>';
    },
    /* dog 2. it is a dog */
    dog2: function (ink, hi) {
      return '<path d="M12 14 L12 6 L20 12 M36 14 L36 6 L28 12" fill="none" stroke="' + ink + '" stroke-width="2"/>' +
             '<path d="M12 14 H36 V30 A10 10 0 0 1 12 30 Z" fill="none" stroke="' + ink + '" stroke-width="2"/>' +
             '<rect x="17" y="20" width="4" height="4" fill="' + ink + '"/>' +
             '<rect x="27" y="20" width="4" height="4" fill="' + ink + '"/>' +
             '<rect x="21" y="28" width="6" height="4" fill="' + hi + '"/>';
    },
    /* neu.ac: the glass cube off the front of the site */
    neu: function (ink, hi) {
      return '<path d="M24 5 L41 14 L41 34 L24 43 L7 34 L7 14 Z" fill="none" stroke="' + ink + '" stroke-width="2"/>' +
             '<path d="M7 14 L24 23 L41 14 M24 23 L24 43" fill="none" stroke="' + ink + '" stroke-width="2"/>' +
             '<path d="M24 5 L24 23" stroke="' + hi + '" stroke-width="2"/>' +
             '<circle cx="24" cy="23" r="2.5" fill="' + hi + '"/>';
    }
  };

  /* ── the library ────────────────────────────────────────────────
     `run` present means it launches. `err` present means it doesn't,
     and says why. `ink`/`hi` are the cover's two line colours. */
  var GAMES = [
    /* Launched from here they run ENDLESS. The story versions still
       run bounded when reached through the chain — same modules, a
       flag. A console library whose games stop after twenty seconds
       is not a library, and there would be no reason to come back. */
    { id: 'twenty', title: 'twenty seconds',
      meta: 'survival · endless',
      a: '#B892FF', b: '#2A1E44', ink: '#F0E6FF', hi: '#FF6B8A',
      run: function () { return NEU.bullet && NEU.bullet.open({ endless: true }); } },

    { id: 'dark', title: 'the dark',
      meta: 'walking sim · endless',
      a: '#4A4560', b: '#0B0B10', ink: '#8F88A8', hi: '#FFD08A',
      run: function () { return NEU.dark && NEU.dark.open({ endless: true }); } },

    /* The big one. Every tile is drawn now, so the shelf no longer
       marks the real game by being the only one with a picture on it.
       It is marked by being the only WARM one — the crimson gradient
       and the brimstone star against six cooler boxes. Same job, done
       with colour instead of with everything else being unfinished. */
    { id: 'woods', title: 'the woods',
      meta: 'adventure · unfinished business',
      a: '#C2405F', b: '#1A0A12', ink: '#FF6B4A', hi: '#FFD08A',
      run: function () { return NEU.act4 && NEU.act4.open(); } },

    { id: 'skele', title: 'skeleton simulator',
      meta: '0.2 hrs on record · 340 GB',
      a: '#EDE7DE', b: '#3A3A46', ink: '#2A2A33', hi: '#7A6ACF',
      err: 'update required. the update server is asleep.' },

    { id: 'wax', title: 'wax tycoon',
      meta: 'never played · 12 MB',
      a: '#E4C46A', b: '#4A3A14', ink: '#3A2C0C', hi: '#FFF3C4',
      err: 'missing executable: wax.exe' },

    { id: 'dog2', title: 'dog 2',
      meta: 'never played · 1.1 GB',
      a: '#7BE38A', b: '#153A1E', ink: '#0E2A15', hi: '#FFF0F4',
      err: 'not compatible with this device.' },

    { id: 'neu', title: 'neu.ac',
      meta: '1 hr on record · running',
      a: '#C2405F', b: '#3A121E', ink: '#FFE3EA', hi: '#4FC3F7',
      err: 'already running.' }
  ];

  var sel = 0, open_ = false, tiles = [];

  /* Seconds for the survival game, metres for the walk. Formatting the
     unit here rather than storing it means the save file holds one
     plain number per game. */
  function fmtBest(id, v) {
    return id === 'twenty' ? v.toFixed(1) + 's' : Math.round(v) + 'm';
  }

  /* ── build ──────────────────────────────────────────────────────*/
  function build() {
    if (!shelf) return;
    shelf.innerHTML = '';
    tiles = [];
    GAMES.forEach(function (g, i) {
      var li = document.createElement('li');
      li.className = 'deck__tile' + (g.err ? ' is-dead' : '');
      li.setAttribute('role', 'option');
      li.tabIndex = -1;

      var art = document.createElement('span');
      art.className = 'deck__art';
      art.style.background =
        'linear-gradient(150deg,' + g.a + ' 0%,' + g.b + ' 78%)';

      /* Presence in SIGILS is the switch — there is no separate flag to
         forget to set. Inline svg, so it inherits the tile's scaling
         and costs no request. */
      if (SIGILS[g.id]) {
        art.classList.add('is-sigil');
        art.innerHTML =
          '<svg viewBox="0 0 48 48" aria-hidden="true" shape-rendering="crispEdges">' +
          SIGILS[g.id](g.ink || '#FF6B4A', g.hi || '#FFD08A') +
          '</svg>';
      } else {
        /* THE FALLBACK, kept deliberately. Every game currently in the
           list has a sigil, so this branch never runs today — which is
           exactly when a fallback gets deleted as dead code, and
           exactly when deleting it is a mistake. A game added later
           without a cover gets two letters instead of an empty box.
           Same reasoning as the tileset `colours`. */
        var mark = document.createElement('b');
        mark.textContent = g.title.replace(/[^a-z0-9 ]/g, '')
                                  .split(' ').map(function (s) { return s[0] || ''; })
                                  .join('').slice(0, 2).toUpperCase();
        art.appendChild(mark);
      }

      var cap = document.createElement('span');
      cap.className = 'deck__cap';
      cap.textContent = g.title;

      li.appendChild(art); li.appendChild(cap);
      li.addEventListener('click', function () {
        if (sel === i) { launch(); } else { pick(i); }
      });
      shelf.appendChild(li);
      tiles.push(li);
    });
  }

  function pick(i) {
    sel = (i + GAMES.length) % GAMES.length;
    var g = GAMES[sel];
    tiles.forEach(function (t, n) { t.classList.toggle('is-on', n === sel); });
    if (elTitle) elTitle.textContent = g.title;
    /* A personal best is the only reason to reopen an endless game, so
       it goes on the meta line the moment one exists. */
    var best = (g.run && NEU.save) ? NEU.save.best(g.id) : 0;
    if (elMeta) elMeta.textContent = g.meta + (best ? '  ·  best ' + fmtBest(g.id, best) : '');
    if (elErr)   elErr.hidden = true;
    if (elPlay)  elPlay.textContent = g.run ? '▸ play' : '▸ play';
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();

    /* Keep the selection on screen without yanking the whole page —
       scrollIntoView with block:'nearest' would still scroll the
       document behind the overlay in some browsers. */
    var t = tiles[sel];
    if (t && shelf) {
      var l = t.offsetLeft, r = l + t.offsetWidth;
      if (l < shelf.scrollLeft) shelf.scrollLeft = l - 24;
      else if (r > shelf.scrollLeft + shelf.clientWidth)
        shelf.scrollLeft = r - shelf.clientWidth + 24;
    }
  }

  function launch() {
    var g = GAMES[sel];
    if (g.run) {
      close();
      setTimeout(function () { g.run(); }, 260);
      return;
    }
    /* It fails. Loudly, in the way that particular thing would fail. */
    if (elErr) {
      elErr.textContent = 'error: ' + g.err;
      elErr.hidden = false;
      elErr.classList.remove('is-shake');
      void elErr.offsetWidth;
      if (!reduced) elErr.classList.add('is-shake');
    }
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
  }

  /* ── the status bar ─────────────────────────────────────────────
     Real clock, and the battery is the console's ACTUAL charge — the
     number you filled up in the room. A fake 100% here would quietly
     throw away the only stat the player earned. */
  var tick = null;
  function status() {
    if (elClock) {
      var d = new Date();
      elClock.textContent = String(d.getHours()).padStart(2, '0') + ':' +
                            String(d.getMinutes()).padStart(2, '0');
    }
    var pct = NEU.charge ? NEU.charge() : 100;
    if (elBatt) elBatt.textContent = pct + '%';
    if (elFill) elFill.style.width = Math.max(4, pct) + '%';
  }

  /* ── open / close ───────────────────────────────────────────────*/
  function open() {
    if (open_) return;
    open_ = true;
    wrap.hidden = false;
    NEU.activeMinigame = 'deck';        /* the room underneath must not move or take Escape */
    document.body.classList.add('is-playing');
    if (NEU.quest) { NEU.quest.lock(true); NEU.quest.mark('deck'); }
    build();
    pick(0);
    status();
    clearInterval(tick);
    tick = setInterval(status, 10000);
    requestAnimationFrame(function () { wrap.classList.add('is-in'); });
  }

  function close() {
    if (!open_) return;
    open_ = false;
    clearInterval(tick);
    wrap.classList.remove('is-in');
    wrap.hidden = true;
    if (NEU.activeMinigame === 'deck') NEU.activeMinigame = null;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
  }

  addEventListener('keydown', function (e) {
    if (!open_) return;
    if (e.key === 'Escape')     { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); pick(sel - 1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); pick(sel + 1); return; }
    if (e.key === 'Tab') {
      var focusables = [elPlay, q].filter(function (el) { return el && !el.hidden; });
      if (focusables.length) {
        var idx = focusables.indexOf(document.activeElement);
        if (e.shiftKey) {
          if (idx <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus(); }
        } else {
          if (idx === -1 || idx >= focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
        }
      } else {
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      /* Enter on the quit button means "close", and the native click
         already handles that. Stealing it to launch would start a
         game the player just tried to leave. */
      if (document.activeElement === q) return;
      e.preventDefault(); launch();
    }
  });

  if (elPlay) elPlay.addEventListener('click', launch);
  var q = document.getElementById('deckQuit');
  if (q) q.addEventListener('click', close);

  NEU.deck = { open: open, close: close,
               get running() { return open_; },
               get sel() { return sel; },
               get title() { return GAMES[sel] && GAMES[sel].title; },
               get games() { return GAMES.length; } };
})();
