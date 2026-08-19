/* craft.js — a 3x3 grid, and what comes out of it.
   ───────────────────────────────────────────────────────────────────
   Five mushrooms, an axe, and a pot. The recipe is SHAPED, not a
   checklist: where you put them matters, which is the only reason to
   draw a grid rather than a list.

   THE RECIPE IS A BOWL:
       . . .
       M . M
       . M .
   Three mushrooms in a V. It is discoverable because the pot in the
   room is drawn as that shape, and nobody says so.

   Two rules that keep it from being annoying:

   1. WRONG ARRANGEMENTS ARE FREE. Nothing is consumed until you take
      the result, and you can pick items back out with a click.
   2. THE OUTPUT SLOT PREVIEWS. The instant the shape is right the
      result appears, greyed, before you commit. Discovery should be
      confirmed on the spot, not two clicks later.                   */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('craft');
  if (!wrap) { NEU.craft = { open: function () {} }; return; }
  var gridEl = document.getElementById('craftGrid');
  var trayEl = document.getElementById('craftTray');
  var outEl  = document.getElementById('craftOut');
  var sayEl  = document.getElementById('craftSay');

  /* 3x3, row-major. null = empty, 'M' = mushroom. */
  var grid = [null,null,null, null,null,null, null,null,null];
  var held = 0;              // mushrooms still in the tray

  var RECIPE = [null,null,null, 'M',null,'M', null,'M',null];

  function matches() {
    for (var i = 0; i < 9; i++) if ((grid[i] || null) !== RECIPE[i]) return false;
    return true;
  }

  function render() {
    if (gridEl) {
      gridEl.innerHTML = '';
      for (var i = 0; i < 9; i++) {
        (function (n) {
          var b = document.createElement('button');
          b.className = 'craft__cell' + (grid[n] ? ' is-full' : '');
          b.setAttribute('aria-label', 'slot ' + (n + 1));
          if (grid[n]) {
            var im = document.createElement('img');
            im.src = 'img/act4/terraria/mushroom.png'; im.alt = 'mushroom';
            b.appendChild(im);
          }
          b.addEventListener('click', function () { click(n); });
          gridEl.appendChild(b);
        })(i);
      }
    }
    if (trayEl) {
      trayEl.innerHTML = '';
      for (var k = 0; k < held; k++) {
        var im2 = document.createElement('img');
        im2.src = 'img/act4/terraria/mushroom.png'; im2.alt = '';
        im2.className = 'craft__item';
        trayEl.appendChild(im2);
      }
      var lbl = document.createElement('span');
      lbl.className = 'craft__n';
      lbl.textContent = held + ' left';
      trayEl.appendChild(lbl);
    }
    if (outEl) {
      var good = matches();
      outEl.className = 'craft__out' + (good ? ' is-ready' : '');
      outEl.innerHTML = good
        ? '<b>mushroom soup</b><span>click to take it</span>'
        : '<span>nothing yet</span>';
    }
  }

  function click(n) {
    if (grid[n]) { grid[n] = null; held++; }
    else if (held > 0) { grid[n] = 'M'; held--; }
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
    render();
    if (matches() && sayEl) sayEl.textContent = 'that is the shape the pot is.';
  }

  function take() {
    if (!matches()) return;
    if (NEU.save) {
      for (var i = 1; i <= 5; i++) NEU.save.take('mush' + i);
      NEU.save.give('soup');
      NEU.save.flag('soup_made', 1);
    }
    if (NEU.quest) NEU.quest.mark('a4_soup');
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    if (sayEl) sayEl.textContent = 'you drink it standing up. it tastes like a decision.';
    setTimeout(function () {
      close();
      if (NEU.act4 && NEU.act4.wake) NEU.act4.wake();
    }, 3200);
  }

  var focusIdx = 0;
  function focusCell() {
    if (!gridEl) return;
    var btns = gridEl.querySelectorAll('.craft__cell');
    if (btns[focusIdx]) btns[focusIdx].focus();
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

  function open() {
    /* Where to put the player back when they leave. Same courtesy the
       quiz and the settings panel give. Only captured once. */
    if (!lastFocus) lastFocus = document.activeElement;
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    grid = [null,null,null, null,null,null, null,null,null];
    held = NEU.mushrooms ? NEU.mushrooms() : 5;
    focusIdx = 0;
    if (sayEl) sayEl.textContent = 'the pot is a shape. put them in that shape.';
    render();
    setTimeout(focusCell, 50);
  }
  function close() {
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  if (outEl) outEl.addEventListener('click', take);
  var q = document.getElementById('craftQuit');
  if (q) q.addEventListener('click', function () {
    close();
    if (NEU.engine) NEU.engine.enter('h3_trip', 'in');
  });

  addEventListener('keydown', function (e) {
    if (wrap.hidden) return;
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
    if (e.key === ' ' || (e.key === 'Enter' && !matches())) {
      e.preventDefault();
      click(focusIdx);
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); take(); }
  });

  NEU.craft = { open: open, close: close,
                /* Every other scene exposes this; core/touch.js asks all
                   nine which one is live. Without it the crafting grid
                   was the one screen with no thumb controls. */
                get running() { return !wrap.hidden; },
                get grid() { return grid.slice(); },
                get held() { return held; },
                recipe: RECIPE,
                matches: matches,
                put: function (n) { click(n); },
                take: take };
})();
