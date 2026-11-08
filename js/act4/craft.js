/* craft.js — a 3x3 grid, and what comes out of it.
   ───────────────────────────────────────────────────────────────────
   Five mushrooms, an axe, and a pot. The recipe is SHAPED, not a
   checklist: where you put them matters, which is the only reason to
   draw a grid rather than a list.

   THE RECIPE IS A BOWL:
       M . M
       . . .
       M M M
   Five mushrooms: the two sides and the bottom. It is discoverable because the pot in the
   room is drawn as that shape, and nobody says so.

   Two rules that keep it from being annoying:

   1. WRONG ARRANGEMENTS ARE FREE. Nothing is consumed until you press
      CRAFT, and you can pick items back out with a click.
   2. NOTHING CRAFTS ITSELF. Enter and Z only place or pick up a
      mushroom. The CRAFT button validates the grid, shows the result
      and consumes the ingredients. A right shape yields the soup; a
      wrong one gives a line from the pot and every mushroom comes back
      to the tray. Trial and error is the discovery, so the grid itself
      never says which shape is right.

   THE ROOM UNDERNEATH: the pot is reached by room.leave(), which stops
   the engine and hides it. Taking the soup resumes that room through
   NEU.engine.resume() — without it the C menu, which needs a running
   engine, stays shut and the player is left on a hidden room. Not
   re-entering: enter() re-runs the room's onEnter, which wakes you.    */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('craft');
  if (!wrap) { NEU.craft = { open: function () {} }; return; }
  var gridEl = document.getElementById('craftGrid');
  var trayEl = document.getElementById('craftTray');
  var outEl  = document.getElementById('craftOut');
  var sayEl  = document.getElementById('craftSay');
  var MUSH = 'img/act4/terraria/mushroom.png';
  var SOUL = 'img/act4/undertale/soul.png';

  /* 3x3, row-major. null = empty, 'M' = mushroom. */
  var grid = [null,null,null, null,null,null, null,null,null];
  var held = 0;              // mushrooms still in the tray

  var RECIPE = ['M',null,'M', null,null,null, 'M','M','M'];

  function matches() {
    for (var i = 0; i < 9; i++) if ((grid[i] || null) !== RECIPE[i]) return false;
    return true;
  }
  function placed() {
    for (var i = 0; i < 9; i++) if (grid[i]) return true;
    return false;
  }
  function reduced() {
    try {
      return document.documentElement.classList.contains('rm') ||
        !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  /* The soul is the cursor in this form: one heart that sits on the
     focused slot. Re-placed after every render, which rebuilds the cells. */
  var soul = null;
  function placeSoul() {
    if (!gridEl) return;
    if (!soul) {
      soul = document.createElement('img');
      soul.src = SOUL; soul.alt = ''; soul.className = 'craft__soul';
      soul.setAttribute('aria-hidden', 'true');
      soul.style.cssText = 'position:absolute;left:-12px;top:-12px;width:32px;height:32px;image-rendering:pixelated;pointer-events:none;z-index:2';
    }
    var btns = gridEl.querySelectorAll('.craft__cell');
    if (btns[focusIdx]) btns[focusIdx].appendChild(soul);
  }

  /* The slot art: slot.png is a flat blue square, so each cell is painted
     here once as a 52x52 pixel slot (bevelled frame, violet stone with
     grain) and scaled up pixelated, the same 2x as the sheet would be. */
  var slotUrl = null;
  function paintSlot() {
    if (slotUrl !== null) return slotUrl;
    slotUrl = '';
    try {
      var c = document.createElement('canvas');
      c.width = 52; c.height = 52;
      var g = c.getContext ? c.getContext('2d') : null;
      if (!g || typeof g.fillRect !== 'function') return slotUrl;
      var x, y, t;
      for (y = 0; y < 52; y++) {
        for (x = 0; x < 52; x++) {
          if (x < 2 || y < 2 || x > 49 || y > 49) g.fillStyle = '#120D1C';
          else if (x === 2 || y === 2) g.fillStyle = '#6A5F93';
          else if (x === 49 || y === 49) g.fillStyle = '#241D3A';
          else {
            t = (x * 31 + y * 17 + x * y) % 13;
            g.fillStyle = t === 0 ? '#4A4070' : (t === 5 ? '#2F2848' : '#3A3158');
          }
          g.fillRect(x, y, 1, 1);
        }
      }
      slotUrl = c.toDataURL('image/png');
    } catch (e) { slotUrl = ''; }
    return slotUrl;
  }

  function render() {
    if (gridEl) {
      gridEl.innerHTML = '';
      for (var i = 0; i < 9; i++) {
        (function (n) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'craft__cell' + (grid[n] ? ' is-full' : '');
          b.style.position = 'relative';
          var slot = paintSlot();
          if (slot) b.style.backgroundImage = 'url("' + slot + '")';
          b.setAttribute('aria-label', 'slot ' + (n + 1));
          if (grid[n]) {
            var im = document.createElement('img');
            im.src = MUSH; im.alt = 'mushroom';
            b.appendChild(im);
          }
          b.addEventListener('click', function () { click(n); });
          gridEl.appendChild(b);
        })(i);
      }
      placeSoul();
    }
    if (trayEl) {
      trayEl.innerHTML = '';
      for (var k = 0; k < held; k++) {
        var im2 = document.createElement('img');
        im2.src = MUSH; im2.alt = '';
        im2.className = 'craft__item';
        trayEl.appendChild(im2);
      }
      var lbl = document.createElement('span');
      lbl.className = 'craft__n';
      lbl.textContent = held + ' left';
      trayEl.appendChild(lbl);
    }
    if (outEl) {
      outEl.className = 'craft__out' + (revealed ? ' is-ready' : '');
      outEl.innerHTML = revealed ? '<canvas width="16" height="16" class="craft__res" aria-hidden="true"></canvas><b>mushroom soup</b>' : '<span>?</span>';
      var rc = outEl.querySelector('canvas');
      if (rc) {
        rc.style.cssText = 'width:64px;height:64px;image-rendering:pixelated';
        if (NEU.itemIcon) NEU.itemIcon(rc, { id: 'soup', kind: 'heal' });
      }
    }
    renderRecipe();
  }

  /* The torn card's mini 3x3, drawn straight from RECIPE: faded ink
     glyphs where the mushrooms go, blank cells elsewhere, one smudge.
     This card is the instruction paper; the grid itself shows nothing
     the player has not put there. */
  function renderRecipe() {
    var el = document.getElementById('craftRecipe');
    if (!el) return;
    el.innerHTML = '';
    for (var i = 0; i < 9; i++) {
      (function (n) {
        var c = document.createElement('div');
        c.className = 'craft__rc-cell';
        if (RECIPE[n]) {
          c.className += ' craft__rc-m';
          var im = document.createElement('img');
          im.src = MUSH; im.alt = 'mushroom';
          c.appendChild(im);
        }
        if (n === 4) c.className += ' craft__rc-smudge';
        el.appendChild(c);
      })(i);
    }
  }

  function click(n) {
    if (grid[n]) { grid[n] = null; held++; }
    else if (held > 0) { grid[n] = 'M'; held--; }
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
    render();
  }

  var revealed = false;                  /* the result shows only after a commit */
  var taken = false;                     /* one shot only: a second CRAFT press must not re-stack wake timers */

  /* A wrong commit: the pot refuses, the mushrooms come back. Nothing lost. */
  function reject() {
    var n = 0;
    for (var i = 0; i < 9; i++) if (grid[i]) { grid[i] = null; held++; n++; }
    if (!n) return;
    if (sayEl) sayEl.textContent = 'the pot refuses it. your mushrooms come back to you.';
    render();
  }

  /* The CRAFT button is the only way to commit. */
  function commit() {
    if (taken) return;
    if (matches()) { take(); return; }
    if (!placed()) { if (sayEl) sayEl.textContent = 'the pot is empty. put the mushrooms in first.'; return; }
    reject();
  }

  function take() {
    if (taken || !matches()) return;
    taken = true;
    revealed = true;
    if (NEU.save) {
      for (var i = 1; i <= 5; i++) NEU.save.take('mush' + i);
      NEU.save.give('soup');
      NEU.save.flag('soulmade', 1);
    }
    if (NEU.quest) NEU.quest.mark('a4_soup');
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    /* the five mushrooms are consumed: the grid empties and the result
       slot shows the soup for a beat before the room comes back */
    for (var g = 0; g < 9; g++) grid[g] = null;
    held = 0;
    if (goEl) goEl.disabled = true;
    if (sayEl) sayEl.textContent = 'the pot bubbles. mushroom soup.';
    render();
    if (outEl && outEl.animate && !reduced()) {
      outEl.animate([{ transform: 'scale(0.6)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 480, easing: 'steps(4)' });
    }
    /* a beat on the result, then the room comes back (resume, not enter:
       enter() would re-run onEnter and wake you) */
    setTimeout(function () {
      if (wrap.hidden) return;
      var label = NEU.keys && NEU.keys.label ? NEU.keys.label('c') : 'C';
      close();
      if (NEU.engine) NEU.engine.resume();
      if (NEU.talk) NEU.talk(['* you ladle the soup into a bowl.', '* press [' + label + '] to open your things.'], 'narr');
    }, reduced() ? 500 : 1300);
  }

  var focusIdx = 0;
  function focusCell() {
    if (!gridEl) return;
    var btns = gridEl.querySelectorAll('.craft__cell');
    if (btns[focusIdx]) { btns[focusIdx].focus(); placeSoul(); }
  }

  /* The panel's focusables, live — the grid is rebuilt on every click,
     so the list must be queried at keydown time, not cached. */
  function focusables() {
    var out = [], all = wrap.querySelectorAll('button'), k;
    for (k = 0; k < all.length; k++) {
      if (!all[k].hidden && !all[k].disabled) out.push(all[k]);
    }
    return out;
  }

  var lastFocus = null;

  /* open() is two halves so the pot can fade the overlay in OVER the
     running room and only then stop that room (fromRoom, below). */
  function present() {
    taken = false;
    revealed = false;
    if (goEl) goEl.disabled = false;
    /* Where to put the player back when they leave. Same courtesy the
       quiz and the settings panel give. Only captured once. */
    if (!lastFocus) lastFocus = document.activeElement;
    wrap.hidden = false;
    if (wrap.animate && !reduced()) wrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'steps(6)' });
    NEU.activeMinigame = 'craft';       /* the room underneath must not move or take Escape */
    grid = [null,null,null, null,null,null, null,null,null];
    held = NEU.mushrooms ? NEU.mushrooms() : 5;
    focusIdx = 0;
    if (sayEl) sayEl.textContent = 'the pot is a shape. put them in that shape.';
    render();
  }
  function claim() {
    if (NEU.kernel) NEU.kernel.push('craft');
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (soul && soul.animate && !reduced()) {
      soul.animate([{ transform: 'translateY(72px)', opacity: 0 }, { transform: 'translateY(-8px)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 520, easing: 'steps(6)' });
    }
    setTimeout(focusCell, 50);
  }
  function open() { present(); claim(); }

  /* The pot -> crafting transition. leave() hides the room and drops
     is-playing, so calling it ahead of a delayed open() showed the
     landing page for the gap between. Here the opaque overlay fades in
     over the room that is still drawing, and the room is stopped only
     once it is fully covered: no frame ever shows the page. */
  var entering = false;
  function fromRoom(c) {
    if (entering) return;
    if (!c || typeof c.leave !== 'function' || !wrap.hidden) { open(); return; }
    entering = true;
    present();
    setTimeout(function () {
      entering = false;
      if (wrap.hidden) return;              /* closed during the fade */
      c.leave();                            /* pops the engine, drops is-playing and the quest lock */
      claim();
    }, reduced() ? 0 : 380);
  }
  function close() {
    if (NEU.kernel && NEU.kernel.current() === 'craft') NEU.kernel.pop();
    if (NEU.activeMinigame === 'craft') NEU.activeMinigame = null;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  /* The backdrop: a pixel workshop floor, planks with grain and a dim
     vignette, painted once at 320x180 and scaled up pixelated. It sits
     at z-index -1 inside the overlay, so every control paints over it. */
  function paintBackground() {
    var c = document.createElement('canvas');
    c.className = 'craft__bg';
    c.width = 320; c.height = 180;
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:-1;image-rendering:pixelated;pointer-events:none';
    var g = null;
    try { g = c.getContext ? c.getContext('2d') : null; } catch (e) { g = null; }
    if (!g || typeof g.fillRect !== 'function') return;
    var x, y, r, shade;
    for (y = 0; y < 180; y += 12) {
      for (x = 0; x < 320; x += 40) {
        r = ((x * 7 + y * 13) % 5);
        g.fillStyle = (((x / 40) + (y / 12)) % 2) ? '#3A2619' : '#33211A';
        g.fillRect(x, y, 40, 11);
        g.fillStyle = '#1C110C';
        g.fillRect(x, y + 11, 40, 1);
        g.fillStyle = '#44301F';
        g.fillRect(x + 4 + r * 6, y + 3, 14, 1);
        g.fillRect(x + 10 + r * 3, y + 7, 9, 1);
      }
    }
    for (y = 0; y < 180; y++) {
      for (x = 0; x < 320; x++) {
        var dx = (x - 160) / 160, dy = (y - 90) / 90, d = dx * dx + dy * dy;
        if (d > 0.55) {
          shade = Math.min(0.75, (d - 0.55) * 1.6);
          g.fillStyle = 'rgba(8,4,6,' + shade.toFixed(2) + ')';
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    wrap.insertBefore(c, wrap.firstChild);
  }

  /* The pot's own decoration sits over the grid and the title: the bowl
     hides the bottom row, the rim crosses the middle, the steam runs into
     the heading. Nothing here is interactive, so it goes. */
  function clearDecor() {
    var sels = ['.craft__steam', '.craft__bowl', '.craft__rim', '.craft__brew'], i, els;
    for (i = 0; i < sels.length; i++) {
      els = wrap.querySelectorAll(sels[i]);
      for (var k = 0; k < els.length; k++) els[k].style.display = 'none';
    }
  }

  /* The CRAFT button, placed beside the blind output slot. */
  var goEl = null;
  function buildGo() {
    if (!outEl || !outEl.parentNode) return;
    goEl = document.createElement('button');
    goEl.type = 'button';
    goEl.className = 'craft__go';
    goEl.textContent = 'CRAFT';
    goEl.style.cssText = 'font:400 16px/1 var(--font-display, monospace);min-width:144px;padding:16px 24px;color:#170D1F;background:#7BE38A;border:3px solid #E9FFE9;cursor:pointer;box-shadow:inset -4px -4px 0 #2F7A3C,inset 4px 4px 0 #C9FFD2';
    goEl.addEventListener('click', commit);
    /* result slot and button travel as one block, so the row stays three
       things wide (recipe, grid, result) and stacks cleanly on a phone */
    var act = document.createElement('div');
    act.className = 'craft__act';
    outEl.parentNode.insertBefore(act, outEl);
    act.appendChild(outEl);
    act.appendChild(goEl);
  }

  /* Layout the shipped sheets get wrong: the cauldron box keeps its old
     400x520 size with its art hidden, which pushed the grid off a phone
     and left a dead gap under it. Injected here so the lane that owns the
     craft screen owns its geometry. */
  function layout() {
    if (document.getElementById('craftLayout') || !document.head) return;
    var st = document.createElement('style');
    st.id = 'craftLayout';
    st.textContent =
      '.craft__cauldron{width:auto;height:auto}' +
      '.craft__row{justify-content:center;gap:40px}' +
      '.craft__recipe{margin-right:0}' +
      '.craft__rc-cell img{opacity:.8}' +
      '.craft__act{display:flex;align-items:center;gap:16px}' +
      '.craft__go:disabled{filter:grayscale(1) brightness(.55);cursor:default}' +
      '.craft__act .craft__out{min-width:112px;padding:16px;gap:8px}' +
      '@media (max-width:760px){' +
        '.craft{padding:16px;gap:12px;overflow-y:auto;align-content:start}' +
        '.craft__row{flex-direction:column;gap:16px}' +
        '.craft__recipe{width:176px;order:-1}' +
        '.craft__act{gap:12px}' +
        '.craft__act .craft__out{min-width:96px;padding:8px}' +
        '.craft__go{min-width:112px!important;padding:16px!important}' +
      '}';
    document.head.appendChild(st);
  }

  layout();
  paintBackground();
  clearDecor();
  buildGo();
  /* Clicking the blind slot is a deliberate commit too, never an automatic one. */
  if (outEl) outEl.addEventListener('click', commit);

  var q = document.getElementById('craftQuit');
  if (q) q.addEventListener('click', function () {
    if (taken) return;
    close();
    if (NEU.engine) NEU.engine.enter('h3_trip', 'in');
  });

  addEventListener('keydown', function (e) {
    if (wrap.hidden) return;
    if (entering) { e.preventDefault(); return; }  /* the room is still fading out underneath */
    if (taken) { e.preventDefault(); return; }   /* the soup is made: nothing to cancel, the pot is handing the room back */
    if (e.key === 'Escape') { e.preventDefault(); close(); if (NEU.engine) NEU.engine.enter('h3_trip', 'in'); return; }
    if (e.key === 'Tab') {
      /* Without the trap a Tab from the last cell walked straight out
         of the overlay and left the player behind it, arrow-keying a
         grid that was no longer on screen. */
      var els = focusables();
      if (!els.length) return;
      var i = Array.prototype.indexOf.call(els, document.activeElement);
      if (e.shiftKey) {
        if (i <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
      } else {
        if (i === -1 || i >= els.length - 1) { e.preventDefault(); els[0].focus(); }
      }
      return;
    }
    /* On the CRAFT button Enter and Space are its own click, not a placement. */
    if (goEl && document.activeElement === goEl) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusIdx = (focusIdx % 3 === 0) ? focusIdx + 2 : focusIdx - 1;
      focusCell();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusIdx = (focusIdx % 3 === 2) ? focusIdx - 2 : focusIdx + 1;
      focusCell();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIdx = (focusIdx < 3) ? focusIdx + 6 : focusIdx - 3;
      focusCell();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIdx = (focusIdx >= 6) ? focusIdx - 6 : focusIdx + 3;
      focusCell();
      return;
    }
    /* Enter and Z place or pick up. Only the CRAFT button crafts. */
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      click(focusIdx);
    }
  });

  if (NEU.kernel) NEU.kernel.register('craft', {
    tick: function (dt) {},
    open: open, close: close,
    running: function () { return !wrap.hidden; }
  });

  NEU.craft = { open: open, close: close, fromRoom: fromRoom,
                /* Every other scene exposes this; core/touch.js asks all
                   nine which one is live. Without it the crafting grid
                   was the one screen with no thumb controls. */
                get running() { return !wrap.hidden; },
                get grid() { return grid.slice(); },
                get held() { return held; },
                recipe: RECIPE,
                matches: matches,
                put: function (n) { click(n); },
                take: take,
                commit: commit };
})();
