/* keys.js — the controls, in one place.
   ───────────────────────────────────────────────────────────────────
   Every game reads literal key names (e.key === 'z'). Rebinding is
   therefore a rename at the door: this file loads before any other
   key listener, sees each key first, and turns a moved key back into
   the name the game expects. No game changes when a player moves a key.

   The bindings live in the save file (flag opt_keys), and only changed
   entries are stored. A key the player moved away from is swallowed,
   so the old key does nothing. Quiz letters are answers, so they are
   never swallowed. Trust is checked after the capture and the reveals,
   so touch input counts the same as the keyboard. */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var DEFS = ['w', 'a', 's', 'd', 'z', 'x', 'Shift', 'c', 'r', 'i', 'Tab', 'm', 'e'];
  var RESERVED = ['Escape', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                  'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'Dead',
                  'Unidentified', 'Process', 'ContextMenu'];
  /* Moved, but still does its own job: the page and the browser need these. */
  var NEVER = ['Tab', 'Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  var NAMES = { ' ': 'space', ArrowUp: '↑', ArrowDown: '↓',
                ArrowLeft: '←', ArrowRight: '→' };

  function norm(k) { return k.length === 1 ? k.toLowerCase() : k; }
  function isReserved(k) { return RESERVED.indexOf(k) >= 0 || /^F([1-9]|1[0-2])$/.test(k); }
  function bindings() { return (NEU.save && NEU.save.flag('opt_keys')) || {}; }
  function flagged(k) { return !!(NEU.save && NEU.save.flagged(k)); }
  function mark(k) { if (NEU.save && !NEU.save.flagged(k)) NEU.save.flag(k, 1); }

  function get(def) { return bindings()[def] || def; }
  function label(def) { var k = get(def); return NAMES[k] || k.toLowerCase(); }

  function route(key, ctx) {
    var k = norm(key), b = bindings(), rev = {}, d;
    for (d in b) rev[norm(b[d])] = d;
    if (rev[k] !== undefined) return { to: rev[k], swallow: false };
    if (DEFS.indexOf(k) >= 0 && b[k] !== undefined &&
        NEVER.indexOf(k) < 0 && !(ctx && ctx.quiz && k.length === 1))
      return { to: key, swallow: true };
    return { to: key, swallow: false };
  }

  function set(def, key) {
    if (isReserved(key)) return { ok: false, why: 'that key is reserved' };
    var k = norm(key), b = bindings(), prev = get(def), other = null, nb = {}, out = {}, d;
    for (d in b) nb[d] = b[d];
    for (var i = 0; i < DEFS.length; i++)
      if (DEFS[i] !== def && norm(get(DEFS[i])) === k) other = DEFS[i];
    nb[def] = k;
    if (other) nb[other] = norm(prev);
    for (d in nb) if (nb[d] !== d) out[d] = nb[d];
    if (NEU.save) NEU.save.flag('opt_keys', out);
    refresh();
    return { ok: true, swapped: other, why: '' };
  }

  function reset() {
    if (NEU.save) NEU.save.flag('opt_keys', null);
    refresh();
  }

  /* Every [data-k] element shows the keys named in it, so the help text
     follows the bindings: data-k="w,a,s,d" reads "wasd" by default. */
  function refresh() {
    var els = document.querySelectorAll('[data-k]');
    for (var i = 0; i < els.length; i++)
      els[i].textContent = els[i].getAttribute('data-k').split(',').map(function (d) {
        return label(d);
      }).join('');
  }

  /* The verbs the player has not met read ??? here. The row count never
     changes, so the panel does not jump as the game reveals things. */
  function rows() {
    var fight = flagged('keys_fight'), scal = flagged('keys_scal'),
        act4 = flagged('a1_seen'), quiz = flagged('keys_quiz');
    function bound(def, text) { return { def: def, label: text, key: label(def), fixed: false }; }
    function fixed(text, key) { return { def: null, label: text, key: key, fixed: true }; }
    return [
      bound('w', 'move up'), bound('a', 'move left'), bound('s', 'move down'), bound('d', 'move right'),
      bound('z', 'confirm' + (fight ? ' · strike' : '')),
      bound('x', 'cancel · skip text' + (fight ? ' · dash' : '')),
      bound('Shift', fight ? 'focus' : '???'),
      bound('c', scal ? 'fight menu' : '???'),
      bound('r', act4 ? 'reset room' : '???'),
      bound('i', act4 ? 'items' : '???'),
      bound('Tab', 'quest log'),
      bound('m', 'mute'),
      fixed('move', 'arrows'),
      fixed('confirm', 'enter / space'),
      fixed('back · close', 'esc'),
      fixed('settings', 'ctrl + shift + ,'),
      fixed(quiz ? 'answer' : '???', 'a b c d · 1–4')
    ];
  }

  /* Next keydown of any trust goes to the callback, Escape gives null.
     Routing is off until it lands. */
  var capturing = null;
  function capture(cb) { capturing = cb; }

  function onKey(e) {
    if (e.type === 'keydown') {
      var m = NEU.activeMinigame;
      if (m === 'bullet' || m === 'polt' || m === 'scal') mark('keys_fight');
      if (m === 'scal') mark('keys_scal');
      if (m === 'quiz') mark('keys_quiz');
      if (capturing) {
        var cb = capturing;
        capturing = null;
        e.stopImmediatePropagation();
        e.preventDefault();
        cb(e.key === 'Escape' ? null : e.key);
        return;
      }
    }
    if (!e.isTrusted || e.ctrlKey || e.altKey || e.metaKey) return;
    var t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable)) return;
    var r = route(e.key, { quiz: NEU.activeMinigame === 'quiz' });
    if (r.swallow) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (norm(r.to) === norm(e.key)) return;
    e.stopImmediatePropagation();
    var ev = new KeyboardEvent(e.type, { key: r.to, bubbles: true, cancelable: true,
      repeat: e.repeat, shiftKey: e.shiftKey || r.to === 'Shift', location: e.location });
    if (!t.dispatchEvent(ev)) e.preventDefault();
  }

  addEventListener('keydown', onKey, true);
  addEventListener('keyup', onKey, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
  else refresh();

  NEU.keys = {
    route: route, set: set, reset: reset, get: get, label: label,
    rows: rows, refresh: refresh, capture: capture
  };
})();
