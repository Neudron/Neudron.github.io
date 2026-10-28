/* inventory.js — Deltarune's ITEM box for Act IV.
   I opens it while the engine is running and nothing else owns the
   page. Arrows move the soul, Enter/Z reads the item through NEU.talk
   (the one textbox), Esc/C/X close. It listens on window in the capture
   phase and stops every key it sees, so the engine (and its ESC) never
   hears a press meant for the box. Items are save.js's array; the
   mushrooms are five ids (mush1..mush5) folded into one counted row. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  /* id (or prefix for the counted ones) -> name, sheet, description */
  var INFO = {
    axe:    ['Axe', 'axe', ['* an axe. it remembers being a sword.']],
    mush:   ['Mushroom', 'mushroom', ['* a mushroom. it is still a little warm.', '* five make a soup.']],
    soup:   ['Mushroom Soup', null, ['* mushroom soup. it smells like a forest that forgave you.']],
    recall: ['Recall Potion', 'recall', ['* a recall potion. it pulls you back to the last place you were safe.']],
    ashes:  ['Ashes', null, ['* what is left. you keep it anyway.']]
  };

  var box = null, list = null, sel = 0, rows = [], before = null;

  function owned() {
    var items = (NEU.save && NEU.save.items) ? NEU.save.items() : [];
    var out = [], mush = 0;
    for (var i = 0; i < items.length; i++) {
      if (/^mush\d+$/.test(items[i])) { mush++; continue; }
      var f = INFO[items[i]] || [items[i], null, ['* ' + items[i] + '.']];
      out.push({ name: f[0], sheet: f[1], say: f[2], n: 1 });
    }
    if (mush) out.push({ name: INFO.mush[0], sheet: INFO.mush[1], say: INFO.mush[2], n: mush });
    return out;
  }

  function build() {
    box = document.createElement('div');
    box.id = 'inv'; box.className = 'inv'; box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Items');
    box.tabIndex = -1;
    box.innerHTML = '<p class="inv__h" aria-hidden="true">ITEM</p><ul class="inv__list" role="listbox" aria-label="Items"></ul>';
    list = box.querySelector('ul');
    document.body.appendChild(box);
  }

  function live(t) { var l = document.getElementById('bhLive'); if (l) l.textContent = t; }

  function label(r) { return r.name + (r.n > 1 ? ' x' + r.n : ''); }

  function pick(i) {
    if (!rows.length) return;
    sel = (i + rows.length) % rows.length;
    var lis = list.children;
    for (var k = 0; k < lis.length; k++) {
      lis[k].className = k === sel ? 'is-sel' : '';
      lis[k].setAttribute('aria-selected', k === sel ? 'true' : 'false');
    }
    live(label(rows[sel]));
  }

  function open() {
    if (!box) build();
    rows = owned();
    list.innerHTML = '';
    for (var i = 0; i < rows.length; i++) {
      var li = document.createElement('li'), sh = rows[i].sheet && NEU.sheets && NEU.sheets[rows[i].sheet];
      li.setAttribute('role', 'option');
      li.innerHTML = '<img alt=""><span></span>';
      if (sh) li.firstChild.src = sh.src; else li.firstChild.style.visibility = 'hidden';
      li.lastChild.textContent = label(rows[i]);
      list.appendChild(li);
    }
    if (!rows.length) { list.innerHTML = '<li>(nothing)</li>'; live('no items'); }
    before = document.activeElement;
    box.hidden = false;
    try { box.focus(); } catch (x) {}
    sel = 0; pick(0);
  }

  function close() {
    box.hidden = true;
    live('');
    if (before && before.focus && document.contains(before)) { try { before.focus(); } catch (x) {} }
  }

  addEventListener('keydown', function (e) {
    var k = e.key, isOpen = box && !box.hidden;
    if (!isOpen) {
      if ((k !== 'c' && k !== 'C') || !NEU.engine || !NEU.engine.running || NEU.activeMinigame ||
          (NEU.tboxOpen && NEU.tboxOpen()) || (NEU.settings && NEU.settings.open_) ||
          /^(INPUT|TEXTAREA)$/.test(e.target && e.target.tagName) || document.getElementById('confirmExit')) return;
      e.preventDefault(); e.stopImmediatePropagation(); open(); return;
    }
    e.stopImmediatePropagation();
    if (k !== 'Shift' && k !== 'Control' && k !== 'Alt' && k !== 'Meta') e.preventDefault();
    if (e.repeat && k === 'Escape') return;
    var talking = NEU.tboxOpen && NEU.tboxOpen();
    /* an item's text is up: any read/close key dismisses just the text */
    if (talking) {
      if (/^(Escape|Enter|z|Z|x|X)$/.test(k) && NEU.talk && NEU.talk.close) NEU.talk.close();
      return;
    }
    if (k === 'ArrowUp' || k === 'w' || k === 'W') pick(sel - 1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') pick(sel + 1);
    else if ((k === 'Enter' || k === 'z' || k === 'Z') && rows[sel] && NEU.talk) NEU.talk(rows[sel].say, 'narr');
    else if (/^(Escape|c|C|x|X)$/.test(k)) close();
    /* Tab: focus stays on the box, the trap is the box itself */
  }, true);
})();
