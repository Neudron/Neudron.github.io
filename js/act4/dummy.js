/* dummy.js — the free weapon test room.
   ───────────────────────────────────────────────────────────────────
   Every weapon in a shop can be tried on a non-hostile practice dummy.
   One canvas, one arc and one damage number, reusing the same stats
   and the same difficulty multiplier the real fight samples. It is a
   sandbox: it reads state but writes NOTHING — no coins, no items, no
   flags, no quest marks, no save. Opening it snapshots the player's
   gold, inventory, room and quest, and closing it proves they are
   unchanged. Esc and the exit button both go back to the exact state
   and the element that opened it.                                    */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  if (NEU.dummy) return;

  var box = null, cv = null, g = null, readEl = null, resultEl = null;
  var active = false, returnTo = null, weapon = null;
  var hits = 0, last = 0, before = null, openedBy = null;
  var img = null, wantImg = true;
  var timer = null;

  function reduced() {
    try {
      return !!(NEU.settings && NEU.settings.reduced) ||
        (NEU.motion && NEU.motion.reduced ? !!NEU.motion.reduced() : false) ||
        !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function snapshot() {
    return JSON.stringify({
      coins: NEU.save ? NEU.save.coins() : 0,
      items: NEU.save && NEU.save.items ? NEU.save.items() : [],
      room: (NEU.save && NEU.save.data && NEU.save.data.room) || null,
      quest: NEU.quest && NEU.quest.snapshot ? NEU.quest.snapshot() : null
    });
  }

  function build() {
    box = document.createElement('div');
    box.className = 'dummy';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'weapon practice room');
    box.tabIndex = -1;

    var win = document.createElement('div');
    win.className = 'dummy__win';
    var h = document.createElement('h2');
    h.className = 'dummy__h';
    h.textContent = 'practice room';
    win.appendChild(h);

    cv = document.createElement('canvas');
    cv.className = 'dummy__scene';
    cv.width = 320; cv.height = 180;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'a practice dummy on a small stage');
    win.appendChild(cv);

    var n = document.createElement('p');
    n.className = 'dummy__name';
    win.appendChild(n);

    readEl = document.createElement('p');
    readEl.className = 'dummy__read';
    readEl.setAttribute('aria-live', 'polite');
    win.appendChild(readEl);

    resultEl = document.createElement('p');
    resultEl.className = 'dummy__result';
    resultEl.setAttribute('role', 'status');
    win.appendChild(resultEl);

    var keys = document.createElement('p');
    keys.className = 'dummy__keys';
    keys.textContent = 'Z or click = strike \u00b7 Esc = leave \u00b7 nothing here is kept';
    win.appendChild(keys);

    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'dummy__exit';
    x.textContent = 'leave';
    x.addEventListener('click', close);
    win.appendChild(x);

    var stage = document.createElement('button');
    stage.type = 'button';
    stage.className = 'dummy__hit';
    stage.textContent = 'strike the dummy';
    stage.addEventListener('click', function () { strike(); });
    win.appendChild(stage);

    box.appendChild(win);
    document.body.appendChild(box);
    box._name = n;
  }

  function ctx() {
    if (g) return g;
    if (cv && cv.getContext) g = cv.getContext('2d');
    if (g) g.imageSmoothingEnabled = false;
    return g;
  }

  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); }

  function draw() {
    var c = ctx(), x, y, a, i, dm;
    if (!c) return;
    rect(c, 0, 0, 320, 180, '#0A0810');
    for (x = 0; x < 320; x += 16) rect(c, x, 140, 16, 40, (x / 16) % 2 ? '#1E161A' : '#241C20');
    rect(c, 0, 139, 320, 1, '#3A2A55');
    /* a training post, not a creature: wooden bar, straw head, no face */
    rect(c, 228, 128, 4, 12, '#7A4E26');
    rect(c, 224, 66, 12, 64, '#8A5A32');
    rect(c, 224, 66, 12, 4, '#B07A4A');
    rect(c, 216, 36, 28, 32, '#C79A6B');
    rect(c, 216, 36, 28, 4, '#F4D9B0');
    rect(c, 219, 48, 22, 2, '#8A5A32');
    rect(c, 219, 56, 22, 2, '#8A5A32');
    rect(c, 214, 34, 32, 2, '#2A1E14');
    rect(c, 214, 68, 32, 2, '#2A1E14');
    /* the soul on the left */
    if (wantImg && !img && typeof Image === 'function') {
      img = new Image();
      img.onload = function () { if (active) draw(); };
      img.src = 'img/act4/deltarune/tvtime/soul.png';
    }
    if (img && img.complete && img.naturalWidth) c.drawImage(img, 0, 0, 16, 16, 30, 96, 20, 20);
    else {
      rect(c, 32, 98, 16, 5, '#FF0000'); rect(c, 32, 103, 16, 7, '#FF0000'); rect(c, 35, 110, 10, 3, '#FF0000');
    }
    /* the weapon's own fx, the way inventory.js previews it */
    if (weapon && weapon.fx === 'arc') {
      for (i = 0; i < 8; i++) {
        a = -1.1 + i * 0.16;
        x = 54 + Math.cos(a) * 30; y = 104 + Math.sin(a) * 30;
        rect(c, x, y, 4, 4, i % 2 ? '#FFFFFF' : '#8BD6FF');
      }
    } else if (weapon && weapon.fx === 'dashstrike') {
      for (i = 0; i < 6; i++) rect(c, 60 + i * 22, 98 + (i & 1) * 6, 12, 3, '#30AFFF');
    } else if (weapon) {
      for (i = 0; i < 6; i++) rect(c, 66 + i * 22, 102, 8, 4, weapon.kind === 'spell' ? '#D49AFF' : '#8BD6FF');
    }
    /* last damage number, in the same gold as the stall */
    if (last) {
      c.font = "32px 'Pixelify Sans', monospace";
      c.fillStyle = '#FFD866';
      c.textAlign = 'center';
      c.fillText(String(last), 230, 28);
      c.textAlign = 'left';
    }
    dm = 'practice dummy';
    c.font = "16px 'Pixelify Sans', monospace";
    c.fillStyle = '#B9B4C4';
    c.fillText(dm, 8, 20);
  }

  function strike() {
    if (!active || !weapon) return 0;
    var st = (weapon.stats && weapon.stats.dmg) || 0, mul = 1;
    if (NEU.diff && NEU.diff.f) mul = NEU.diff.f('dmg') || 1;
    last = Math.max(1, Math.round(st * mul));
    hits++;
    if (readEl) readEl.textContent = weapon.name + ': ' + last + ' damage' + (hits > 1 ? ' (hit ' + hits + ')' : '');
    if (resultEl) resultEl.textContent = 'dummy still standing. this is practice \u2014 nothing is earned.';
    draw();
    return last;
  }

  function open(id) {
    if (!box) build();
    if (active) return true;
    weapon = (NEU.items && NEU.items.get ? NEU.items.get(id) : null) ||
      { id: id, name: id, kind: 'melee', stats: { dmg: 1 } };
    before = snapshot();
    openedBy = document.activeElement;
    active = true;
    hits = 0; last = 0; wantImg = true;
    box.hidden = false;
    NEU.activeMinigame = 'dummy';
    if (box._name) box._name.textContent = weapon.name + ' \u00b7 ' + (weapon.kind || 'weapon') + ' \u00b7 free practice';
    if (readEl) readEl.textContent = 'strike the dummy to see its damage.';
    if (resultEl) resultEl.textContent = '';
    draw();
    var first = box.querySelector('.dummy__hit') || box;
    if (first) first.focus();
    return true;
  }

  function close() {
    if (!active) return;
    active = false;
    box.hidden = true;
    if (NEU.activeMinigame === 'dummy') NEU.activeMinigame = null;
    if (timer) { clearTimeout(timer); timer = null; }
    var after = snapshot();
    /* A sandbox must never leave a trace. Nothing in this module writes
       to NEU.save, so this is a guard, not a rollback: if it ever fires,
       the caller learns about it instead of silently losing progress. */
    if (before !== null && after !== before && window.console) {
      console.warn('[dummy] practice changed game state; check NEU.dummy writers');
    }
    before = null;
    var back = openedBy;
    openedBy = null;
    if (back && back !== document.body && document.contains(back) && back.focus) back.focus();
  }

  addEventListener('keydown', function (e) {
    if (!active || !box) return;
    if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') {
      e.preventDefault(); e.stopImmediatePropagation(); close(); return;
    }
    if (e.key === 'Tab') {
      e.preventDefault(); e.stopImmediatePropagation();
      var els = Array.prototype.slice.call(box.querySelectorAll('button:not(:disabled)'));
      if (!els.length) return;
      var i = Array.prototype.indexOf.call(els, document.activeElement);
      els[(i + (e.shiftKey ? -1 : 1) + els.length) % els.length].focus();
      return;
    }
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); e.stopImmediatePropagation(); strike();
    }
  }, true);

  NEU.dummy = {
    open: open, close: close, strike: strike, draw: draw,
    get active() { return active; },
    get hits() { return hits; },
    get last() { return last; },
    get weapon() { return weapon; },
    get before() { return before; },
    get running() { return active; }
  };
})();
