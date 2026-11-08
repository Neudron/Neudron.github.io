/* inventory.js — the C menu for Act IV items and equipment. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var SOUP_ICON = 'soup-icon';
  var box = null, list = null, detail = null, rows = [];
  var sel = 0, tab = 0, cat = 0, spell = 0, opened = false, before = null, drinking = false;
  /* EQUIP lists three categories. Each one holds only its own kind; the
     spells category has two slots, toggled with Left and Right. */
  var CATS = [
    { label: 'MELEE', kind: 'melee', slots: ['melee'], icon: 'sym-melee' },
    { label: 'RANGED', kind: 'ranged', slots: ['ranged'], icon: 'sym-ranged' },
    { label: 'SPELLS', kind: 'spell', slots: ['spell1', 'spell2'], icon: 'sym-spell' }
  ];
  var SPELL_NAMES = ['I: ', 'II: '];
  var SOUP_INFO = { soup: ['Mushroom Soup', SOUP_ICON, ['* mushroom soup. it smells like a forest that forgave you.']] };
  var soulImg = null;

  /* 16x16 item sprites: one string per row, one palette letter per pixel. */
  var PAL = { o: '#1A1024', R: '#E8DCB8', r: '#B8A87E', S: '#8BAA7F', G: '#6E8F66', g: '#B5D2A5', P: '#6A3FA0',
              B: '#7A7F9A', b: '#4A4E66', w: '#FFFFFF', k: '#A8743C', K: '#7A4E26', d: '#2A1B3D', l: '#6A4FA0',
              L: '#B892FF', h: '#F2E6FF', M: '#D8332B', m: '#8E1F2A', C: '#F4D9B0', c: '#C79A6B',
              W: '#DCE6F2', e: '#5A6478', Y: '#FFD866', O: '#FF9E30', F: '#E8501A', U: '#7FE6FF', u: '#3A8FD8', N: '#8FE39B' };
  var SPRITE = {
    soup: [
      '................', '......w..w......', '.......w..w.....', '................',
      '..oooooooooooo..', '.oRRRRRRRRRRRRo.', '.orSSSggGSSgSSo.', '.orSSSSSSSPPSSo.',
      '.oBBBBBBBBBBBBo.', '.oBbbbbbbbbbbBo.', '..oBbbbbbbbbBo..', '..oBBBBBBBBBBo..',
      '...ooBBBBBBoo...', '.....oooooo.....', '................', '................'],
    recall: [
      '.....oooooo.....', '.....okkkko.....', '.....oKKKKo.....', '......oddo......',
      '......ohdo......', '.....ohddLo.....', '....ohddllLo....', '...ohdllllLLo...',
      '..ohlllllLLLLo..', '..ohlllllLLLLo..', '..ohllllLLLLLo..', '..ollllllLLLLo..',
      '...ollllllLLo...', '....ollllllo....', '.....oooooo.....', '................'],
    mush: [
      '................', '......oooo......', '....ooMMMMoo....', '...oMMwwMMMMo...',
      '..oMMwwwMMwMMo..', '..oMMMwMMMMMMo..', '.oMMMMMMMwwMMMo.', '.oMmMMMMMwwMmMo.',
      '.oommmmmmmmmmoo.', '....oCCCCCCo....', '.....oCcCCco....', '.....oCcCCco....',
      '.....oCCCCco....', '......oooooo....', '................', '................']
  };
  function drawSprite(ctx, rows) {
    var x, y, ch;
    for (y = 0; y < rows.length; y++) for (x = 0; x < 16; x++) {
      ch = rows[y].charAt(x);
      if (ch !== '.' && PAL[ch]) { ctx.fillStyle = PAL[ch]; ctx.fillRect(x, y, 1, 1); }
    }
  }
  /* Equipment sprites are drawn, not stored: each shape is a point list that
     gets a 1px dark outline first, then its fill, so every icon reads the
     same on the black menu. 16x16, shown at 2x by the CSS. */
  function px(ctx, x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
  function shape(ctx, pts, fill, hi) {
    var i, p, d = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]], j;
    for (i = 0; i < pts.length; i++) for (j = 0; j < d.length; j++) px(ctx, pts[i][0] + d[j][0], pts[i][1] + d[j][1], PAL.o);
    for (i = 0; i < pts.length; i++) { p = pts[i]; px(ctx, p[0], p[1], hi && i % 2 ? hi : fill); }
  }
  function diag(x, y, dx, dy, n, w) {
    var out = [], i;
    for (i = 0; i < n; i++) { out.push([x + dx * i, y + dy * i]); if (w) out.push([x + dx * i + w, y + dy * i]); }
    return out;
  }
  /* A blob from a half-width table: outer, middle and core colours. */
  function blob(ctx, widths, y0, cx, c1, c2, c3) {
    var y, w, x;
    for (y = 0; y < widths.length; y++) {
      w = widths[y];
      for (x = -w - 1; x <= w; x++) px(ctx, cx + x, y0 + y, PAL.o);
    }
    for (y = 0; y < widths.length; y++) {
      w = widths[y];
      for (x = -w; x < w; x++) px(ctx, cx + x, y0 + y, w - Math.abs(x + 0.5) < 1.5 ? c1 : (w - Math.abs(x + 0.5) < 2.6 ? c2 : c3));
    }
  }
  var ICONS = {
    sword: function (c, t) {
      shape(c, diag(13, 1, -1, 1, 9, -1), t ? PAL[t] : PAL.W, PAL.w);
      shape(c, diag(1, 7, 1, 1, 6), PAL.Y);
      shape(c, diag(3, 11, -1, 1, 3), PAL.k);
    },
    scythe: function (c) {
      shape(c, diag(3, 14, 1, -1, 10), PAL.k, PAL.K);
      shape(c, [[12, 3], [11, 2], [10, 2], [9, 2], [8, 3], [7, 4], [7, 5], [8, 5], [9, 4], [10, 4], [11, 4]], PAL.U, PAL.w);
    },
    lance: function (c) {
      shape(c, diag(2, 14, 1, -1, 10), PAL.R, PAL.r);
      shape(c, [[12, 3], [13, 2], [14, 1], [13, 3], [12, 2], [14, 2], [13, 1]], PAL.W, PAL.w);
    },
    fist: function (c) {
      var x, y;
      for (y = 5; y < 14; y++) for (x = 2; x < 14; x++) px(c, x, y, PAL.o);
      for (y = 6; y < 13; y++) for (x = 3; x < 13; x++) px(c, x, y, y < 9 ? (y === 6 ? PAL.w : PAL.B) : PAL.C);
      for (x = 5; x < 13; x += 3) { px(c, x, 9, PAL.c); px(c, x, 10, PAL.c); }
      px(c, 3, 11, PAL.c); px(c, 3, 12, PAL.c);
    },
    needles: function (c) {
      /* three bare needles fanned from one grip: no outline, it would clot */
      var i;
      for (i = 0; i < 11; i++) { px(c, 2 + i, 13 - i, i > 8 ? PAL.h : PAL.L); px(c, 3 + i, 13 - i, PAL.P); }
      for (i = 0; i < 7; i++) { px(c, 2 + 2 * i, 13 - i, i > 4 ? PAL.h : PAL.L); px(c, 3 + 2 * i, 13 - i, PAL.L); }
      for (i = 0; i < 6; i++) { px(c, 2 + i, 13 - 2 * i, i > 3 ? PAL.h : PAL.L); px(c, 2 + i, 12 - 2 * i, PAL.L); }
      shape(c, [[1, 14], [2, 14], [1, 13], [2, 13]], PAL.k);
    },
    flame: function (c) { blob(c, [1, 1, 2, 2, 3, 4, 4, 5, 5, 5, 4, 3], 2, 8, PAL.Y, PAL.O, PAL.F); },
    orb: function (c) { blob(c, [2, 3, 4, 5, 5, 6, 6, 6, 6, 5, 5, 4, 3, 2], 1, 8, PAL.w, PAL.U, PAL.u); },
    bolt: function (c) {
      shape(c, [[10, 1], [9, 2], [8, 3], [7, 4], [6, 5], [5, 6], [6, 7], [7, 7], [8, 7], [7, 8], [6, 9], [5, 10], [4, 11], [3, 12], [3, 13], [11, 1], [10, 2], [9, 3], [8, 4], [7, 5], [6, 6], [7, 6]], PAL.Y, PAL.w);
    },
    cannon: function (c, t) {
      var x, y;
      for (y = 5; y < 11; y++) for (x = 7; x < 15; x++) px(c, x, y, PAL.o);
      for (y = 6; y < 10; y++) for (x = 8; x < 14; x++) px(c, x, y, y === 6 ? PAL.B : PAL.e);
      shape(c, diag(1, 7, 1, 0, 7).concat(diag(1, 8, 1, 0, 7)), PAL.B, PAL.W);
      shape(c, [[10, 11], [11, 11], [10, 12], [11, 12], [10, 13]], PAL.k);
      px(c, 0, 7, t ? PAL[t] : PAL.U); px(c, 0, 8, t ? PAL.Y : PAL.u);
    },
    beam: function (c) {
      var x, y;
      for (x = 0; x < 16; x++) for (y = 5; y < 11; y++) px(c, x, y, PAL.o);
      for (x = 0; x < 16; x++) { px(c, x, 6, PAL.F); px(c, x, 7, PAL.O); px(c, x, 8, PAL.Y); px(c, x, 9, PAL.F); }
      blob(c, [1, 2, 3, 3, 3, 3, 2, 1], 4, 3, PAL.w, PAL.Y, PAL.O);
    },
    shield: function (c) {
      blob(c, [6, 6, 6, 6, 6, 6, 5, 5, 4, 3, 2, 1], 2, 8, PAL.U, PAL.W, PAL.B);
    },
    nova: function (c) {
      var a, i;
      for (i = 0; i < 12; i++) { a = i * Math.PI / 6; px(c, Math.round(7.5 + Math.cos(a) * 6), Math.round(7.5 + Math.sin(a) * 6), PAL.o); px(c, Math.round(7.5 + Math.cos(a) * 5.4), Math.round(7.5 + Math.sin(a) * 5.4), PAL.L); }
      blob(c, [1, 2, 2, 1], 6, 8, PAL.w, PAL.h, PAL.L);
    },
    heal: function (c) {
      shape(c, diag(8, 2, 0, 1, 12).concat(diag(7, 2, 0, 1, 12)).concat(diag(2, 7, 1, 0, 12), diag(2, 8, 1, 0, 12)), PAL.N, PAL.g);
    }
  };
  var ICON_BY_ID = { blade: 'sword', exoblade: 'sword:U', phaseslayer: 'sword:L', scythe: 'scythe', knuckle: 'fist', lance: 'lance',
    soulfire: 'flame', needles: 'needles', wisp: 'orb', bolt: 'bolt', pulse_rifle: 'cannon', magnomaly: 'cannon:F',
    brimstone: 'beam', soulshield: 'shield', nova: 'nova', mend: 'heal' };
  function drawIcon(canvas, item) {
    var ctx;
    try { ctx = canvas.getContext('2d'); } catch (e) { return; }
    if (!ctx) return;
    if (NEU.questIcon && NEU.questIcon(canvas, item)) return;
    var colors = { melee: '#e9d9a6', ranged: '#8bd6ff', spell: '#d49aff', heal: '#8fe39b', key: '#ffce69', quest: '#ddd' };
    canvas.width = 16; ctx = canvas.getContext('2d');
    var key = item.id === 'soup' ? 'soup' : item.fx === 'recall' ? 'recall' : /^mush\d$/.test(item.id) ? 'mush' : '';
    if (key) { drawSprite(ctx, SPRITE[key]); return; }
    if (ICON_BY_ID[item.id]) { key = ICON_BY_ID[item.id].split(':'); ICONS[key[0]](ctx, key[1]); return; }
    ctx.fillStyle = colors[item.kind] || '#ddd';
    ctx.fillRect(7, 2, 2, 12); ctx.fillRect(3, 7, 10, 2);
    if (item.kind === 'melee') { ctx.fillRect(5, 3, 6, 2); ctx.fillRect(6, 12, 4, 2); }
    else if (item.kind === 'spell') { ctx.fillRect(4, 4, 2, 2); ctx.fillRect(10, 4, 2, 2); ctx.fillRect(4, 10, 2, 2); ctx.fillRect(10, 10, 2, 2); }
    else if (item.kind === 'heal') { ctx.fillRect(5, 5, 6, 6); }
  }
  NEU.itemIcon = drawIcon;

  function build() {
    box = document.createElement('div');
    box.id = 'inv'; box.className = 'inv'; box.hidden = true;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Items and equipment'); box.tabIndex = -1;
    box.innerHTML = '<div class="inv__top"><div class="inv__tabs" role="tablist"><button type="button" class="inv__tab" data-tab="0">ITEMS</button><button type="button" class="inv__tab" data-tab="1">EQUIP</button></div><span class="inv__coins"></span></div>'
      + '<div class="inv__body">'
      + '<section class="inv__equipped"><h2>CATEGORIES</h2><div class="inv__slots"></div></section>'
      + '<section class="inv__inventory"><h2 class="inv__heading">ITEMS</h2><ul class="inv__list" role="listbox" aria-label="Items"></ul><p class="inv__hint" hidden></p></section>'
      + '<section class="inv__stats"><h2>STATS</h2><div class="inv__statlines"></div></section></div>'
      + '<section class="inv__preview"><h2>IN COMBAT</h2><div class="inv__stage"><canvas class="inv__fight" width="160" height="40" aria-hidden="true"></canvas><div class="inv__fight-text"></div></div></section>'
      + '<div class="inv__desc" aria-live="polite"></div>';
    document.body.appendChild(box);
    list = box.querySelector('.inv__list'); detail = box.querySelector('.inv__desc');
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
  /* Only the open category's kind, owned or a default. Never a mix. */
  function equipmentItems() {
    var all = NEU.items && NEU.items.all ? NEU.items.all : [], out = [], i, item;
    for (i = 0; i < all.length; i++) {
      item = all[i];
      if (item.kind === CATS[cat].kind && NEU.save.has(item.id)) out.push(item);
    }
    return out;
  }
  function curSlot() { var c = CATS[cat]; return c.slots[c.slots.length > 1 ? spell : 0]; }
  function equippedItem(slot) { return NEU.items.get(NEU.save.equipped(slot)); }
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

  /* The fight preview paints what kit.js paints in combat: the same arc,
     shot, beam and ring colours, and the same stats kit.js reads. */
  function fightText(item) {
    if (!item) return '';
    var st = item.stats || {};
    if (item.kind === 'melee') return item.name + '\n' + 'DMG ' + st.dmg + '   RANGE ' + st.r + '   COOLDOWN ' + st.cd + 's';
    if (item.kind === 'ranged') return item.name + '\n' + 'DMG ' + st.dmg + (item.fx === 'shot' ? '   x' + st.n : '') + '   COOLDOWN ' + st.cd + 's';
    return item.name + '\n' + 'TP ' + st.tp + '%' + (st.n ? '   x' + st.n : '');
  }
  /* The soul is the real tvtime sprite; the canvas repaints once it loads. */
  function drawSoul(ctx, x, y) {
    if (!soulImg && typeof Image === 'function') {
      soulImg = new Image();
      soulImg.onload = function () { if (box && !box.hidden) render(); };
      soulImg.src = 'img/act4/deltarune/tvtime/soul.png';
    }
    if (soulImg && soulImg.complete && soulImg.naturalWidth) { ctx.drawImage(soulImg, 0, 0, 16, 16, x, y, 16, 16); return; }
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x + 2, y + 3, 5, 4); ctx.fillRect(x + 9, y + 3, 5, 4); ctx.fillRect(x + 2, y + 6, 12, 4);
    ctx.fillRect(x + 4, y + 10, 8, 2); ctx.fillRect(x + 6, y + 12, 4, 2);
  }
  /* One target dummy and one floor: the same read as a Calamity boss arena. */
  function drawArena(ctx) {
    var x;
    ctx.fillStyle = '#07050d'; ctx.fillRect(0, 0, 160, 40);
    ctx.fillStyle = '#120d1f'; ctx.fillRect(0, 30, 160, 10);
    for (x = 0; x < 160; x += 4) { ctx.fillStyle = '#241a3a'; ctx.fillRect(x, 30 + (x >> 2 & 1) * 2, 2, 1); }
    ctx.fillStyle = '#3a2a55'; ctx.fillRect(0, 29, 160, 1);
    /* the dummy: post, body, head, and its health bar */
    ctx.fillStyle = '#1A1024'; ctx.fillRect(124, 11, 16, 20);
    ctx.fillStyle = '#7A4E26'; ctx.fillRect(131, 26, 2, 4);
    ctx.fillStyle = '#FF9E30'; ctx.fillRect(126, 14, 12, 12);
    ctx.fillStyle = '#FFD866'; ctx.fillRect(126, 14, 12, 2); ctx.fillRect(126, 14, 2, 12);
    ctx.fillStyle = '#C0601A'; ctx.fillRect(126, 24, 12, 2); ctx.fillRect(136, 14, 2, 12);
    ctx.fillStyle = '#1A1024'; ctx.fillRect(129, 18, 2, 2); ctx.fillRect(133, 18, 2, 2); ctx.fillRect(130, 22, 4, 1);
    ctx.fillStyle = '#000'; ctx.fillRect(123, 6, 18, 4);
    ctx.fillStyle = '#5FD070'; ctx.fillRect(124, 7, 16, 2);
  }
  function drawFight(canvas, item) {
    var ctx, i, a, n, x, y, fx = item ? item.fx : '', st = item && item.stats ? item.stats : {};
    try { ctx = canvas.getContext('2d'); } catch (e) { return; }
    if (!ctx) return;
    drawArena(ctx);
    if (!item) { drawSoul(ctx, 12, 12); return; }
    if (item.kind === 'melee') {
      /* kit.js arc: eight dots swept in front of the soul; a dash strike
         adds the streak the soul leaves behind. */
      if (fx === 'dashstrike') {
        for (i = 0; i < 6; i++) { ctx.fillStyle = i < 3 ? '#30AFFF' : '#7FE6FF'; ctx.fillRect(34 + i * 14, 18 + (i & 1) * 4, 10, 2); }
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(108, 19, 6, 4);
      }
      for (i = 0; i < 8; i++) {
        a = -1.15 + i * 0.16 + 0.4;
        x = Math.round(24 + Math.cos(a) * (10 + (Number(st.r) || 56) * 0.2)); y = Math.round(20 + Math.sin(a) * (10 + (Number(st.r) || 56) * 0.2));
        ctx.fillStyle = i < 3 ? '#30AFFF' : '#7FE6FF'; ctx.fillRect(x - 2, y - 2, 4, 4);
        if (i > 4) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1, y - 1, 2, 2); }
      }
    } else if (item.kind === 'ranged') {
      n = fx === 'shot' ? Math.max(1, st.n || 1) : 1;
      for (i = 0; i < n; i++) {
        y = 20 + Math.round((i - (n - 1) / 2) * 6);
        ctx.fillStyle = 'rgba(160,240,255,0.6)'; ctx.fillRect(fx === 'pierce' ? 34 : 44, y - 1, fx === 'pierce' ? 44 : 22, 2);
        ctx.fillStyle = '#7FE6FF'; ctx.fillRect(66, y - 3, 6, 6);
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(68, y - 1, 2, 2);
      }
      if (fx === 'split') for (i = 0; i < 4; i++) {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(96 + (i & 1) * 6, 14 + i * 4, 2, 2);
      }
      if (fx === 'homing') for (i = 0; i < 5; i++) { ctx.fillStyle = '#7FE6FF'; ctx.fillRect(84 + i * 6, 22 - Math.round(Math.sin(i * 0.7) * 8), 3, 3); }
    } else if (fx === 'beam') {
      ctx.fillStyle = '#6F335A'; ctx.fillRect(30, 18, 90, 5);
      ctx.fillStyle = '#FF3A1A'; ctx.fillRect(30, 19, 90, 3);
      ctx.fillStyle = '#FFF4D0'; ctx.fillRect(30, 20, 90, 1); ctx.fillRect(28, 18, 4, 5);
    } else if (fx === 'nova' || fx === 'shield') {
      ctx.fillStyle = fx === 'nova' ? '#7FE6FF' : '#FFFFFF';
      n = fx === 'nova' ? 16 : 12;
      for (i = 0; i < n; i++) { a = i * Math.PI * 2 / n; ctx.fillRect(Math.round(20 + Math.cos(a) * 18) - 1, Math.round(20 + Math.sin(a) * 15) - 1, 3, 3); }
    } else if (fx === 'heal') {
      ctx.fillStyle = '#8FE39B'; ctx.fillRect(34, 8, 6, 2); ctx.fillRect(36, 6, 2, 6); ctx.fillRect(40, 16, 4, 2); ctx.fillRect(41, 15, 2, 4);
    }
    drawSoul(ctx, 12, 12);
  }

  function render() {
    if (!box) return;
    box.querySelector('.inv__coins').textContent = '◎ ' + (NEU.save && NEU.save.coins ? NEU.save.coins() : 0);
    var buttons = box.querySelectorAll('.inv__tab'), i, j, c, it, html, focus, current, chosen, shown, equipped;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].className = 'inv__tab' + (tab === i ? ' is-sel' : '');
      buttons[i].setAttribute('aria-selected', tab === i ? 'true' : 'false');
    }
    var equip = tab === 1, cats = box.querySelector('.inv__equipped'), stats = box.querySelector('.inv__stats'),
        prev = box.querySelector('.inv__preview'), hint = box.querySelector('.inv__hint');
    box.className = 'inv' + (equip ? ' is-equip' : '');
    cats.hidden = stats.hidden = prev.hidden = !equip;
    box.querySelector('.inv__heading').textContent = equip ? (opened ? CATS[cat].label : 'CATEGORY') : 'ITEMS';
    if (equip) {
      html = '';
      for (i = 0; i < CATS.length; i++) {
        c = CATS[i];
        html += '<div class="inv__slot' + (cat === i ? ' is-focus' : '') + '"><span class="inv__sym ' + c.icon + '"></span><b>' + c.label + '</b>';
        for (j = 0; j < c.slots.length; j++) {
          it = equippedItem(c.slots[j]);
          focus = cat === i && opened && spell === j;
          html += '<span class="inv__spell' + (focus ? ' is-focus' : '') + '">' + (c.slots.length > 1 ? SPELL_NAMES[j] : '') + (it ? it.name : '—') + '</span>';
        }
        html += '</div>';
      }
      cats.querySelector('.inv__slots').innerHTML = html;
    }
    rows = !equip ? ownedItems() : (opened ? equipmentItems() : []);
    if (sel < 0 || sel >= rows.length) {
      sel = 0;
      if (equip && opened) { it = equippedItem(curSlot()); for (i = 0; i < rows.length; i++) if (it && rows[i].id === it.id) { sel = i; break; } }
    }
    equipped = equip ? equippedItem(curSlot()) : null;
    list.innerHTML = '';
    for (i = 0; i < rows.length; i++) {
      var li = document.createElement('li'), icon = document.createElement('canvas'), span = document.createElement('span');
      icon.width = 16; icon.height = 16; icon.className = 'inv__icon'; icon.style.width = icon.style.height = '32px'; drawIcon(icon, rows[i]);
      li.appendChild(icon); li.appendChild(span); span.textContent = itemLabel(rows[i]);
      if (equipped && rows[i].id === equipped.id) li.className = 'is-equipped';
      li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === sel ? 'true' : 'false');
      if (i === sel) li.className += ' is-sel';
      list.appendChild(li);
      if (i === sel && li.scrollIntoView) { try { li.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
    }
    hint.hidden = !(equip && !opened);
    hint.textContent = equip && !opened ? 'Z opens ' + CATS[cat].label : '';
    if (!rows.length && !(equip && !opened)) list.innerHTML = '<li>(nothing)</li>';
    current = equip ? equipped : null; chosen = selectedItem();
    shown = equip ? (opened && chosen ? chosen : current) : chosen;
    box.querySelector('.inv__statlines').innerHTML = equip ? statText(shown, current) : '';
    if (equip) {
      drawFight(box.querySelector('.inv__fight'), shown);
      box.querySelector('.inv__fight-text').textContent = fightText(shown);
    }
    detail.textContent = (shown && shown.desc) || '';
    live(shown ? itemLabel(shown) : 'no items');
  }
  function pick(next) { if (!rows.length) return; sel = (next + rows.length) % rows.length; render(); }
  function switchTab(next) { tab = (next + 2) % 2; sel = 0; spell = 0; opened = false; render(); }
  function moveCat(d) { cat = (cat + d + CATS.length) % CATS.length; spell = 0; render(); }
  function reduced() { return document.documentElement.classList.contains('rm'); }

  /* The bowl tips toward the soul, steam puffs rise off the row, the row
     glows green; the soup is taken and the wake runs only when the drink
     lands. Reduced motion keeps the beat but drops the motion. */
  function drinkSoup(onTake) {
    if (drinking) return;
    drinking = true;
    var li = list.children[sel], anim = !reduced();
    if (li) {
      li.classList.add('inv__soup-drink');
      var icon = li.querySelector ? li.querySelector('canvas') : null;
      if (anim && icon && icon.animate) {
        icon.style.transformOrigin = 'bottom right';
        icon.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(32deg)' }, { transform: 'rotate(32deg)' }, { transform: 'rotate(0deg)' }],
                     { duration: 800, easing: 'steps(4)' });
      }
      if (anim && li.animate) {
        li.animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 8px #8fe39b)' }, { filter: 'drop-shadow(0 0 16px #8fe39b)' }],
                   { duration: 800, easing: 'steps(4)', fill: 'both' });
      }
    }
    setTimeout(function () {
      if (onTake) onTake();
      close(); drinking = false;
      if (NEU.act4 && NEU.act4.wake) NEU.act4.wake();
    }, anim ? 800 : 300);
  }
  /* The row tips, glows and the room flashes cyan while you drink. The item
     is taken and the teleport runs only when the drink lands (onTake), so a
     cancelled drink keeps the potion. Reduced motion skips the motion only. */
  function drinkPotion(item, onTake) {
    if (drinking) return;
    drinking = true;
    var li = list.children[sel], anim = !reduced(), flash = null;
    if (li) li.classList.add('inv__potion-drink');
    /* The row itself only glows: rotating the whole row swung its label
       out of the scrolling list and it read as blank. The potion icon is
       what tips back. */
    if (li && anim && li.animate) {
      li.animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 8px #8bd6ff)' }, { filter: 'drop-shadow(0 0 16px #8bd6ff)' }],
                 { duration: 800, easing: 'steps(4)', fill: 'both' });
    }
    var icon = li && li.querySelector ? li.querySelector('canvas') : null;
    if (icon && anim && icon.animate) {
      icon.style.transformOrigin = 'bottom right';
      icon.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-35deg)' }, { transform: 'rotate(-35deg)' }, { transform: 'rotate(0deg)' }],
                   { duration: 800, easing: 'steps(4)' });
    }
    if (anim && document.body.animate) {
      flash = document.createElement('div');
      /* z 75: over the room (70), under the menu (76). Over the menu the
         wash turned the yellow row label into a blue smear mid-drink. */
      flash.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;background:#8bd6ff;opacity:0;z-index:75;pointer-events:none';
      document.body.appendChild(flash);
      flash.animate([{ opacity: 0 }, { opacity: 0.6 }, { opacity: 0 }], { duration: 800, easing: 'steps(4)' });
    }
    setTimeout(function () {
      if (onTake) onTake();
      close(); drinking = false;
      if (flash && flash.parentNode) flash.parentNode.removeChild(flash);
      if (NEU.talk) NEU.talk(['* you drink the ' + item.name + '. a safe place, briefly.'], 'narr');
    }, anim ? 800 : 300);
  }
  function consumeHeal(item) {
    if (drinking) return;
    drinking = true;
    var li = list.children[sel]; if (li) li.classList.add('inv__heal-consume');
    setTimeout(function () {
      if (NEU.save) NEU.save.take(item.id);
      close(); drinking = false;
      if (NEU.talk) NEU.talk(['* ' + item.name + '. ' + (item.desc || '')], 'narr');
    }, 800);
  }
  function open() {
    if (!box) build();
    before = document.activeElement; box.hidden = false; tab = 0; sel = 0; cat = 0; spell = 0; opened = false;
    render(); try { box.focus(); } catch (e) {}
  }
  function close() {
    if (!box) return;
    box.hidden = true; live('');
    if (before && before.focus && document.contains(before)) { try { before.focus(); } catch (e) {} }
  }
  function activate() {
    /* EQUIP: Z opens the category (its items appear), then Z equips one. */
    if (tab === 1) {
      if (!opened) { opened = true; sel = -1; render(); return; }
      var pickedEquip = selectedItem();
      if (pickedEquip && pickedEquip.kind === CATS[cat].kind) NEU.save.equip(curSlot(), pickedEquip.id);
      render(); return;
    }
    var item = selectedItem();
    if (!item) return;
    if (item.id === 'soup') { drinkSoup(function () { NEU.save.take('soup'); }); return; }
    /* The recall potion teleports you to the act's start once it is drunk. */
    if (item.fx === 'recall') {
      drinkPotion(item, function () {
        NEU.save.take('recall');
        if (NEU.engine) NEU.engine.enter((NEU.act4 && NEU.act4.start) || 'a1_clearing', 'default', { iris: 0.6 });
      });
      return;
    }
    if (item.kind === 'heal') { consumeHeal(item); return; }
    /* Quest items are described, never consumed: the axe and the ashes
       gate progression, and Z on them used to delete them outright. */
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
      if (tab === 1 && opened) { if (CATS[cat].slots.length > 1) { spell = 1 - spell; render(); } }
      else switchTab(tab + (k === 'ArrowRight' ? 1 : -1));
    } else if (k === 'ArrowUp' || k === 'w' || k === 'W') { if (tab === 1 && !opened) moveCat(-1); else pick(sel - 1); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { if (tab === 1 && !opened) moveCat(1); else pick(sel + 1); }
    else if ((k === 'Enter' || k === 'z' || k === 'Z')) activate();
    /* X backs out of an open category first, then closes the menu. */
    else if (k === 'x' || k === 'X') { if (tab === 1 && opened) { opened = false; sel = -1; render(); } else close(); }
    else if (/^(Escape|c|C)$/.test(k)) close();
  }, true);
})();
