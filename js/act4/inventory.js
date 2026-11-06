/* inventory.js — the C menu for Act IV items and equipment. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var SOUP_ICON = 'soup-icon';
  var box = null, list = null, tabs = null, detail = null, rows = [];
  var sel = 0, tab = 0, slotIndex = 0, before = null, drinking = false;
  var SLOTS = [
    { id: 'melee', label: 'MELEE', kind: 'melee' },
    { id: 'ranged', label: 'RANGED (HOLD Z)', kind: 'ranged' },
    { id: 'spell1', label: 'SPELL I', kind: 'spell' },
    { id: 'spell2', label: 'SPELL II', kind: 'spell' }
  ];
  var SLOT_ICONS = ['⚔', '➤', '✦', '◇'];
  var SOUP_INFO = { soup: ['Mushroom Soup', SOUP_ICON, ['* mushroom soup. it smells like a forest that forgave you.']] };

  function drawIcon(canvas, item) {
    var ctx;
    try { ctx = canvas.getContext('2d'); } catch (e) { return; }
    if (!ctx) return;
    var colors = { melee: '#e9d9a6', ranged: '#8bd6ff', spell: '#d49aff', heal: '#8fe39b', key: '#ffce69', quest: '#ddd' };
    ctx.fillStyle = '#191923'; ctx.fillRect(0, 0, 16, 16);
    if (item.id === 'soup') {
      ctx.fillStyle = '#22222E'; ctx.fillRect(2, 6, 12, 8); ctx.fillRect(3, 14, 10, 1); ctx.fillRect(4, 15, 8, 1);
      ctx.fillStyle = '#D4C9A8'; ctx.fillRect(1, 5, 14, 2);
      ctx.fillStyle = '#8BAA7F'; ctx.fillRect(3, 7, 10, 4);
      ctx.fillStyle = '#6A3FA0'; ctx.fillRect(5, 8, 2, 2); ctx.fillRect(9, 9, 2, 2);
      return;
    }
    ctx.fillStyle = colors[item.kind] || '#ddd';
    ctx.fillRect(7, 2, 2, 12); ctx.fillRect(3, 7, 10, 2);
    if (item.kind === 'melee') { ctx.fillRect(5, 3, 6, 2); ctx.fillRect(6, 12, 4, 2); }
    else if (item.kind === 'spell') { ctx.fillRect(4, 4, 2, 2); ctx.fillRect(10, 4, 2, 2); ctx.fillRect(4, 10, 2, 2); ctx.fillRect(10, 10, 2, 2); }
    else if (item.kind === 'heal') { ctx.fillRect(5, 5, 6, 6); }
  }

  function build() {
    box = document.createElement('div');
    box.id = 'inv'; box.className = 'inv'; box.hidden = true;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Items and equipment'); box.tabIndex = -1;
    box.innerHTML = '<div class="inv__top"><div class="inv__tabs" role="tablist"><button type="button" class="inv__tab" data-tab="0"><canvas width="16" height="16" aria-hidden="true"></canvas> ITEMS</button><button type="button" class="inv__tab" data-tab="1"><canvas width="16" height="16" aria-hidden="true"></canvas> EQUIP</button></div><span class="inv__coins"></span></div><div class="inv__body"><section class="inv__char"><h2>CHAR</h2><canvas class="inv__portrait" width="40" height="60" aria-label="you"></canvas><div>you</div></section><section class="inv__equipped"><h2>EQUIPPED</h2><div class="inv__slots"></div></section><section class="inv__stats"><h2>STATS</h2><div class="inv__statlines"></div></section><section class="inv__inventory"><h2 class="inv__heading">ITEMS</h2><ul class="inv__list" role="listbox" aria-label="Items"></ul></section></div><div class="inv__desc" aria-live="polite"></div>';
    document.body.appendChild(box);
    tabs = box.querySelector('.inv__tabs'); list = box.querySelector('.inv__list'); detail = box.querySelector('.inv__desc');
    var tabButtons = box.querySelectorAll('.inv__tab');
    tabButtons[0].querySelector('canvas').getContext('2d').fillRect(3, 3, 10, 10);
    tabButtons[1].querySelector('canvas').getContext('2d').fillRect(3, 3, 10, 10);
    var portrait = box.querySelector('.inv__portrait'), pctx = portrait.getContext('2d');
    if (NEU.sheetDraw) {
      try { NEU.sheetDraw(pctx, 'youWalk', 20, 30, { frame: 0, col: 0, scale: 2 }); } catch (e) {}
    }
  }

  function live(text) { var node = document.getElementById('bhLive'); if (node) node.textContent = text; }
  function ownedItems() {
    var out = [], ids = NEU.save && NEU.save.items ? NEU.save.items() : [], i, id, def, count;
    for (i = 0; i < ids.length; i++) {
      id = ids[i]; def = NEU.items && NEU.items.get ? NEU.items.get(id) : null;
      if (!def) {
        if (SOUP_INFO[id]) out.push({ id: id, name: SOUP_INFO[id][0], kind: 'heal', desc: SOUP_INFO[id][2][0].slice(2), stats: {}, fx: 'heal' });
        else out.push({ id: id, name: id, kind: 'key', desc: '', stats: {}, fx: '' });
        continue;
      }
      count = def.kind === 'heal' && NEU.save.count ? NEU.save.count(id) : 1;
      if (count > 0) { def._count = count; out.push(def); }
    }
    return out;
  }
  function equipmentItems() {
    var all = NEU.items && NEU.items.all ? NEU.items.all : [], found = {}, out = [], i, item, id;
    for (i = 0; i < SLOTS.length; i++) { id = NEU.save.equipped(SLOTS[i].id); found[id] = true; }
    var owns = ownedItems();
    for (i = 0; i < owns.length; i++) found[owns[i].id] = true;
    for (i = 0; i < all.length; i++) {
      item = all[i];
      if ((item.kind === 'melee' || item.kind === 'ranged' || item.kind === 'spell') && found[item.id]) out.push(item);
    }
    return out;
  }
  function currentSlot() { return SLOTS[slotIndex]; }
  function selectedItem() { return rows[sel] || null; }
  function statText(candidate, current) {
    var names = [['dmg', 'DMG'], ['cd', 'COOLDOWN'], ['tp', 'TP COST'], ['r', 'RANGE']], parts = [], i, key, name, a, b, marker;
    var cs = candidate && candidate.stats ? candidate.stats : {}, os = current && current.stats ? current.stats : {};
    for (i = 0; i < names.length; i++) {
      key = names[i][0]; name = names[i][1];
      if (cs[key] === undefined && os[key] === undefined) continue;
      a = Number(cs[key]) || 0; b = Number(os[key]) || 0; marker = '';
      if (candidate && current && candidate.id !== current.id && a !== b) marker = a > b ? ' <b class="is-up">▲</b>' : ' <b class="is-down">▼</b>';
      parts.push('<div>' + name + ': ' + (cs[key] === undefined ? '—' : cs[key]) + marker + '</div>');
    }
    if (candidate && current && candidate.id !== current.id && candidate.fx !== current.fx) parts.push('<div class="is-fx">◆ changes how it works</div>');
    return parts.join('') || '<div>—</div>';
  }
  function itemLabel(item) { return item.name + (item._count > 1 ? ' ×' + item._count : ''); }

  function render() {
    if (!box) return;
    box.querySelector('.inv__coins').textContent = '◎ ' + (NEU.save && NEU.save.coins ? NEU.save.coins() : 0);
    var buttons = box.querySelectorAll('.inv__tab'), i;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].className = 'inv__tab' + (tab === i ? ' is-sel' : '');
      buttons[i].setAttribute('aria-selected', tab === i ? 'true' : 'false');
    }
    var equip = tab === 1, section = box.querySelector('.inv__equipped'), stats = box.querySelector('.inv__stats'), char = box.querySelector('.inv__char');
    section.hidden = stats.hidden = char.hidden = !equip;
    box.querySelector('.inv__heading').textContent = equip ? 'WEAPONS' : 'ITEMS';
    box.querySelector('.inv__inventory').className = 'inv__inventory' + (equip ? ' is-equip' : '');
    var slots = box.querySelector('.inv__slots'), slotHtml = '';
    if (equip) for (i = 0; i < SLOTS.length; i++) {
      var s = SLOTS[i], item = NEU.items.get(NEU.save.equipped(s.id));
      slotHtml += '<div class="inv__slot' + (slotIndex === i ? ' is-focus' : '') + '"><span>' + SLOT_ICONS[i] + '</span><b>' + s.label + '</b><span>' + (item ? item.name : '—') + '</span></div>';
    }
    slots.innerHTML = slotHtml;
    rows = equip ? equipmentItems() : ownedItems();
    if (sel < 0 && equip) {
      sel = 0;
      for (i = 0; i < rows.length; i++) if (rows[i].id === NEU.save.equipped(currentSlot().id)) { sel = i; break; }
    } else if (sel < 0 || sel >= rows.length) sel = 0;
    list.innerHTML = '';
    for (i = 0; i < rows.length; i++) {
      var li = document.createElement('li'), icon = document.createElement('canvas'), span = document.createElement('span');
      icon.width = 16; icon.height = 16; icon.className = 'inv__icon'; drawIcon(icon, rows[i]);
      li.appendChild(icon); li.appendChild(span); span.textContent = itemLabel(rows[i]);
      if (equip && rows[i].kind !== currentSlot().kind) li.className = 'is-unusable';
      if (equip && rows[i].id === NEU.save.equipped(currentSlot().id)) li.className += ' is-equipped';
      li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === sel ? 'true' : 'false');
      if (i === sel) li.className += ' is-sel';
      list.appendChild(li);
    }
    if (!rows.length) list.innerHTML = '<li>(nothing)</li>';
    var current = equip ? NEU.items.get(NEU.save.equipped(currentSlot().id)) : null, chosen = selectedItem();
    box.querySelector('.inv__statlines').innerHTML = equip ? statText(chosen && chosen.kind === currentSlot().kind ? chosen : current, current) : '';
    detail.textContent = chosen ? (chosen.desc || '') : '';
    if (equip && current) detail.textContent = (chosen && chosen.desc ? chosen.desc : current.desc || '') + '  ' + currentSlot().label;
    live(chosen ? itemLabel(chosen) : 'no items');
  }
  function pick(next) { if (!rows.length) return; sel = (next + rows.length) % rows.length; render(); }
  function switchTab(next) { tab = (next + 2) % 2; sel = tab === 1 ? -1 : 0; slotIndex = 0; render(); }

  function drinkSoup() {
    if (drinking) return;
    drinking = true;
    var li = list.children[sel]; if (li) li.classList.add('inv__soup-drink');
    setTimeout(function () {
      if (NEU.save) NEU.save.take('soup');
      close(); drinking = false;
      if (NEU.act4 && NEU.act4.wake) NEU.act4.wake();
    }, 800);
  }
  function open() {
    if (!box) build();
    before = document.activeElement; box.hidden = false; tab = 0; sel = 0; slotIndex = 0;
    render(); try { box.focus(); } catch (e) {}
  }
  function close() {
    if (!box) return;
    box.hidden = true; live('');
    if (before && before.focus && document.contains(before)) { try { before.focus(); } catch (e) {} }
  }
  function activate() {
    var item = selectedItem();
    if (!item) return;
    if (tab === 0 && item.id === 'soup') { drinkSoup(); return; }
    if (tab === 1) {
      if (item.kind === currentSlot().kind) NEU.save.equip(currentSlot().id, item.id);
      render(); return;
    }
    if (NEU.talk) NEU.talk(SOUP_INFO[item.id] ? SOUP_INFO[item.id][2] : ['* ' + item.name + '. ' + (item.desc || '')], 'narr');
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
    if (NEU.tboxOpen && NEU.tboxOpen()) {
      if (/^(Escape|Enter|z|Z|x|X)$/.test(k) && NEU.talk && NEU.talk.close) NEU.talk.close();
      return;
    }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      if (tab === 0) switchTab(tab + (k === 'ArrowRight' ? 1 : -1));
      else { slotIndex = (slotIndex + (k === 'ArrowRight' ? 1 : -1) + SLOTS.length) % SLOTS.length; sel = -1; render(); }
    } else if (k === 'ArrowUp' || k === 'w' || k === 'W') pick(sel - 1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') pick(sel + 1);
    else if ((k === 'Enter' || k === 'z' || k === 'Z')) activate();
    else if (/^(Escape|c|C|x|X)$/.test(k)) close();
  }, true);
})();
