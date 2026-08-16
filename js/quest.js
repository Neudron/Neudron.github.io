/* quest.js — the objectives tab.
   ───────────────────────────────────────────────────────────────────
   Loads FIRST, because everything else reports into it. Owning the
   progress state in one place rather than scattering booleans across
   sans.js, bullet.js and dark.js means the panel can never disagree
   with the game — there is only one copy of the truth.

   Steps are listed in the order they can actually be done, and later
   ones are shown blurred until reachable. Spoiling the whole chain up
   front turns a sequence of discoveries into a checklist; hiding it
   entirely means nobody knows there IS a chain. Blurred-but-counted
   is the middle: you can see something is there.                    */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var STEPS = [
    { id: 'sans',    text: 'find someone at the end of the page' },
    { id: 'break',   text: 'break the sword' },
    { id: 'door',    text: 'open the door in the cube' },
    { id: 'survive', text: 'last twenty seconds' },
    { id: 'dog',     text: 'feed the dog' },
    { id: 'hammer',  text: 'get whatever the dog is chewing' },
    { id: 'smash',   text: 'break the cosmolight' },
    { id: 'greydoor',text: 'find the door in the dark' },
    { id: 'answers', text: 'hear all four answers', count: 4 },
    { id: 'clicker', text: 'recover the clicker' },
    { id: 'fixed',   text: 'put the light back' }
  ];

  var done = {}, counts = {};
  var panel = document.getElementById('quest');
  var list  = document.getElementById('questList');
  var tally = document.getElementById('questTally');
  var toggle= document.getElementById('questToggle');

  function total() { return STEPS.length; }
  function completed() {
    var n = 0;
    for (var i = 0; i < STEPS.length; i++) if (done[STEPS[i].id]) n++;
    return n;
  }

  /* A step is visible in full once it is done, or once the step before
     it is done — one step of look-ahead, so there is always exactly
     one legible "next thing". */
  function reachable(i) {
    if (i === 0) return true;
    return !!done[STEPS[i - 1].id] || !!done[STEPS[i].id];
  }

  function render() {
    if (!list) return;
    list.innerHTML = '';
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i], li = document.createElement('li');
      var on = !!done[s.id], vis = reachable(i);
      li.className = 'quest__i' + (on ? ' is-done' : '') + (vis ? '' : ' is-veiled');
      var mark = document.createElement('span');
      mark.className = 'quest__mark';
      mark.textContent = on ? '×' : '·';   // × / ·
      var label = document.createElement('span');
      var txt = vis ? s.text : '???';
      if (vis && s.count) txt += '  (' + (counts[s.id] || 0) + '/' + s.count + ')';
      label.textContent = txt;
      li.appendChild(mark); li.appendChild(label);
      list.appendChild(li);
    }
    if (tally) tally.textContent = completed() + '/' + total();
  }

  function flash() {
    if (!panel) return;
    panel.classList.remove('is-hit');
    void panel.offsetWidth;
    panel.classList.add('is-hit');
    setTimeout(function () { panel.classList.remove('is-hit'); }, 700);
  }

  NEU.quest = {
    /* Idempotent on purpose: callers fire these from event handlers
       that can run more than once, and a step should never un-complete
       or double-count. */
    mark: function (id) {
      if (done[id]) return;
      done[id] = true;
      render(); flash();
    },
    bump: function (id, to) {
      var s = null;
      for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) s = STEPS[i];
      if (!s || done[id]) return;
      counts[id] = Math.max(counts[id] || 0, to);
      if (counts[id] >= (s.count || 1)) { done[id] = true; flash(); }
      render();
    },
    has: function (id) { return !!done[id]; },
    open: function () { if (panel) { panel.classList.add('is-open');
                                     if (toggle) toggle.setAttribute('aria-expanded', 'true'); } },
    hide: function () { if (panel) { panel.classList.remove('is-open');
                                     if (toggle) toggle.setAttribute('aria-expanded', 'false'); } },
    reset: function () { done = {}; counts = {}; render(); }
  };

  if (toggle) {
    toggle.addEventListener('click', function () {
      panel.classList.contains('is-open') ? NEU.quest.hide() : NEU.quest.open();
    });
  }
  /* `o` toggles it, but never while something else owns the keyboard —
     the bullet hell reads letters for movement and the dev console
     reads them as text. */
  addEventListener('keydown', function (e) {
    if (e.key !== 'o' && e.key !== 'O') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (NEU.bullet && NEU.bullet.running) return;
    if (NEU.dark && NEU.dark.running) return;
    panel.classList.contains('is-open') ? NEU.quest.hide() : NEU.quest.open();
  });

  render();
})();
