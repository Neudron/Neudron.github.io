/* shopkit.js — the one shop component every merchant uses.
   ───────────────────────────────────────────────────────────────────
   The stall (shop.js) and the stone shop (mage.js) each used to build
   their own rows, buy their own items and sell their own gear. The
   rules were the same in both files and drifted. This is the shared
   layer: catalogue, buy/sell, the 16px item icon (reusing NEU.itemIcon
   from inventory.js), a one-line effect, a keyboard-reachable tooltip
   with numbers and an equipped comparison, and the free TEST action.

   No second store: every coin and item call goes through NEU.save.
   No new art: icons come from inventory.js's palette sprites or the
   sprite manifest; an unknown item draws a magenta 16px square.     */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  if (NEU.shopkit) return;

  var KINDS = { melee: 1, ranged: 1, spell: 1, heal: 1 };
  var WEAPONS = { melee: 1, ranged: 1, spell: 1 };
  var SLOT = { melee: 'melee', ranged: 'ranged', spell: 'spell1', spell2: 'spell1' };
  var KIND_LABEL = { melee: 'melee', ranged: 'ranged', spell: 'spell', heal: 'consumable', key: 'key item', quest: 'key item' };

  function def(id) { return NEU.items && NEU.items.get ? NEU.items.get(id) : null; }

  function catalog() {
    var all = (NEU.items && NEU.items.all) || [], out = [], i;
    for (i = 0; i < all.length; i++) if (KINDS[all[i].kind] && all[i].price > 0) out.push(all[i]);
    return out;
  }

  function sellable() {
    var ids = NEU.save && NEU.save.items ? NEU.save.items() : [], out = [], i, d;
    for (i = 0; i < ids.length; i++) {
      d = def(ids[i]);
      if (d && KINDS[d.kind]) out.push(d);
    }
    return out;
  }

  function isEquipped(id) {
    var eq = (NEU.save && NEU.save.data && NEU.save.data.equip) || {}, k;
    for (k in eq) if (Object.prototype.hasOwnProperty.call(eq, k) && eq[k] === id) return true;
    return false;
  }

  function buy(id) {
    if (!NEU.save) return false;
    if (id === 'recall') {
      if (NEU.save.has('recall')) return false;
      NEU.save.give('recall');
      if (NEU.quest && NEU.quest.mark) NEU.quest.mark('a4_recall');
      return true;
    }
    var d = def(id);
    if (!d || !KINDS[d.kind] || !(d.price > 0)) return false;
    if (d.kind !== 'heal' && NEU.save.count(id) > 0) return false;
    if (NEU.save.coins() < d.price || !NEU.save.spend(d.price)) return false;
    NEU.save.give(id);
    return true;
  }

  function sell(id) {
    var d = def(id), pay;
    if (!d || !KINDS[d.kind] || !NEU.save || NEU.save.count(id) < 1) return false;
    if (isEquipped(id)) return false;
    pay = d.sell || 0;
    NEU.save.take(id);
    NEU.save.addCoins(pay);
    return true;
  }

  /* ── icon ───────────────────────────────────────────────────────
     inventory.js already owns every 16x16 weapon and item sprite.
     Draw through it so a shop icon and an inventory icon can never
     disagree. An unknown item is loud magenta, not a silent blank. */
  function icon(d, cv) {
    if (!cv) return cv;
    cv.width = 16;
    cv.height = 16;
    /* A sprite is only trustworthy when items.js actually defines the
       object. An unknown id draws loud magenta, never a guessed emoji. */
    if (d && d.id && def(d.id) && NEU.itemIcon) {
      try { NEU.itemIcon(cv, d); cv.__icon = d.id; return cv; } catch (e) {}
    }
    cv.__magenta = true;
    try {
      var g = cv.getContext && cv.getContext('2d');
      if (g) { g.fillStyle = '#FF00FF'; g.fillRect(0, 0, 16, 16); }
    } catch (e2) {}
    return cv;
  }

  /* ── one line on the row ────────────────────────────────────── */
  function effect(d) {
    if (!d) return '';
    var st = d.stats || {}, n;
    if (d.kind === 'melee') return 'DMG ' + st.dmg + ' \u00b7 reach ' + st.r + ' \u00b7 ' + st.cd + 's swing';
    if (d.kind === 'ranged') {
      n = st.n ? ' \u00d7' + st.n : '';
      return 'DMG ' + st.dmg + n + ' \u00b7 ' + st.cd + 's \u00b7 ' + (d.fx === 'homing' ? 'homes' : 'straight');
    }
    if (d.kind === 'spell') {
      return st.tp ? 'TP ' + st.tp + '%' + (st.dmg ? ' \u00b7 DMG ' + st.dmg : '') : 'DMG ' + st.dmg + ' \u00b7 spell';
    }
    if (d.kind === 'heal') return 'heals ' + (st.heal === 'full' ? 'all HP' : (st.heal || 0) + ' HP');
    return d.desc || '';
  }

  /* ── longer tooltip ────────────────────────────────────────────
     Short subhead, then the numbers, then a side-by-side comparison
     with whatever fills the same slot now. A tooltip is a sibling of
     the row, positioned to the side by CSS so it never covers it, and
     opens on focus as well as hover so a keyboard player gets it. */
  function tooltip(d, mode) {
    var tip = document.createElement('div');
    tip.className = 'shopkit__tip shopkit__tip--side';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    if (!d) { tip.textContent = 'no details.'; return tip; }

    var st = d.stats || {}, k, line;
    var h = document.createElement('b');
    h.className = 'shopkit__tip-name';
    h.textContent = d.name;
    tip.appendChild(h);

    var kind = document.createElement('span');
    kind.className = 'shopkit__tip-kind';
    kind.textContent = KIND_LABEL[d.kind] || String(d.kind || '');
    tip.appendChild(kind);

    line = document.createElement('span');
    line.textContent = mode === 'sell'
      ? 'sells for ' + (d.sell || 0) + 'g'
      : 'buy ' + (d.price || 0) + 'g \u00b7 sells for ' + (d.sell || 0) + 'g';
    tip.appendChild(line);

    for (k in st) {
      if (!Object.prototype.hasOwnProperty.call(st, k)) continue;
      line = document.createElement('span');
      line.textContent = k + ': ' + st[k];
      tip.appendChild(line);
    }
    if (d.desc) {
      line = document.createElement('span');
      line.className = 'shopkit__tip-desc';
      line.textContent = d.desc;
      tip.appendChild(line);
    }

    /* comparison against the equipped item in the same slot */
    var slot = SLOT[d.kind], equippedId = null, other = null;
    if (slot && NEU.save && NEU.save.equipped) {
      equippedId = NEU.save.equipped(slot);
      if (equippedId && equippedId !== d.id) other = def(equippedId);
    }
    line = document.createElement('span');
    line.className = 'shopkit__tip-cmp';
    if (other) {
      var a = Number((st.dmg || 0)), b = Number((other.stats && other.stats.dmg) || 0);
      var diff = a - b;
      var sign = diff > 0 ? '+' : (diff < 0 ? '\u2212' : '');
      line.textContent = 'vs ' + other.name + ': ' + sign + Math.abs(diff) + ' DMG';
    } else if (equippedId === d.id) {
      line.textContent = 'currently equipped.';
    } else {
      line.textContent = 'nothing equipped in this slot.';
    }
    tip.appendChild(line);
    return tip;
  }

  function reduced() {
    try {
      return !!(NEU.settings && NEU.settings.reduced) ||
        !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  /* Enrich a merchant's own row button without changing what clicking
     it does. The TEST control stops the click so it can never buy. */
  function decorate(b, row, mode, opts) {
    opts = opts || {};
    var d = def(row.id), cv, fx, tip, test;

    cv = document.createElement('canvas');
    cv.className = 'shopkit__icon';
    cv.setAttribute('aria-hidden', 'true');
    icon(d, cv);
    b.insertBefore(cv, b.firstChild);

    fx = document.createElement('span');
    fx.className = 'shopkit__fx';
    fx.textContent = opts.prefix && d && d.kind !== 'heal' ? opts.prefix + effect(d) : effect(d);
    b.appendChild(fx);

    tip = tooltip(d, mode);
    tip.id = 'shopkit-tip-' + row.id + '-' + mode;
    b.setAttribute('aria-describedby', tip.id);
    b.appendChild(tip);
    /* Place beside the row in VIEWPORT coordinates: both stalls put the
       board inside a scroll container, which clips an absolutely
       positioned tooltip before it can be read. Flip to the left when
       there is no room on the right, so the parent is never covered. */
    function show() {
      tip.hidden = false;
      try {
        var r = b.getBoundingClientRect();
        var w = tip.offsetWidth || 280, h = tip.offsetHeight || 160;
        var x = r.right + 8;
        if (x + w > (window.innerWidth || 1280) - 8) x = r.left - w - 8;
        tip.style.left = Math.max(8, x) + 'px';
        tip.style.top = Math.max(8, Math.min(r.top, (window.innerHeight || 720) - h - 8)) + 'px';
      } catch (e) {}
      if (!reduced()) tip.classList.add('is-in');
    }
    function hide() { tip.hidden = true; tip.classList.remove('is-in'); }
    b.addEventListener('mouseenter', show);
    b.addEventListener('mouseleave', hide);
    b.addEventListener('focus', show);
    b.addEventListener('blur', hide);

    if (mode === 'buy' && d && WEAPONS[d.kind] && (d.stats && d.stats.dmg)) {
      test = document.createElement('button');
      test.type = 'button';
      test.className = 'shopkit__test';
      test.textContent = 'TEST';
      test.setAttribute('aria-label', 'Test ' + d.name + ' in the practice room, free');
      test.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (NEU.dummy && NEU.dummy.open) NEU.dummy.open(d.id);
      });
      b.appendChild(test);
    }
    return b;
  }

  /* A standalone row, used by the shared component itself and by tests. */
  function buildRow(row, mode, opts) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'shopkit__row';
    b.setAttribute('role', 'option');
    b.appendChild(document.createTextNode(row.name || (def(row.id) ? def(row.id).name : row.id)));
    var price = document.createElement('span');
    price.className = 'shop__p';
    price.textContent = row.price;
    b.appendChild(price);
    return decorate(b, row, mode, opts);
  }

  NEU.shopkit = {
    catalog: catalog, sellable: sellable, isEquipped: isEquipped,
    buy: buy, sell: sell, icon: icon, effect: effect,
    tooltip: tooltip, decorate: decorate, buildRow: buildRow,
    KINDS: KINDS
  };
})();
