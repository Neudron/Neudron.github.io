/* tphud.js — the TP bar and ability chips shown during kit fights.
   ───────────────────────────────────────────────────────────────────
   Every NEU.kit.create registers itself as NEU.kitLive with the minigame
   it was born in. Each frame this picks the kit that is actually live —
   a boss minigame's own kit, or the dungeon's foe kit while the dgn
   level is open — tweens the displayed TP toward the real value, flashes
   green on gains and red on spends, and drains a cooldown sweep on the
   melee / ranged / heal chips. Spells show their TP cost instead.
   z 90: over every fight canvas (76-78), under .tbox (96). Reduced motion
   snaps the tween instead of animating it.
   In the dungeon it docks to the bottom edge (.is-dock): hearts, TP, the
   equipped slots with their key labels and the heal items you carry. Boss
   fights keep the floating strip untouched. Only the dock takes a click
   (a chip opens the TP strip, the same as pressing its key). */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  var el = null, fill = null, num = null, deltaEl = null, tierEl = null, chips = {}, hpEl = null, useEl = null, dock = false, hpShown = -1, hpMax = 0, useSig = '', hurtT = 0;
  var shown = 0, kit = null;
  var flashT = 0, last = 0, raf = 0;

  /* hold: the dock shows 'hold Z' for the soul shot; def is the key binding the label reads */
  var SLOTS = [
    { key: 'melee', slot: 'melee', cd: 'melee', label: 'MELEE', def: 'z', name: 'AXE' },
    { key: 'ranged', slot: 'ranged', cd: 'ranged', label: 'RANGED', def: 'z', hold: 1 },
    { key: 'spell1', slot: 'spell1', cd: '', label: 'SPELL I', def: 'c' },
    { key: 'spell2', slot: 'spell2', cd: '', label: 'SPELL II', def: 'c' },
    { key: 'heal', slot: '', cd: 'heal', label: 'HEAL', def: 'c' }
  ];

  function build() {
    el = document.createElement('div');
    el.id = 'tphud'; el.className = 'tphud'; el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    var html = '<div class="tphud__hp"></div><span class="tphud__tier"></span><div class="tphud__tp"><span class="tphud__label">TP</span>'
      + '<div class="tphud__bar"><div class="tphud__fill"></div></div>'
      + '<span class="tphud__num">0%</span><span class="tphud__delta"></span></div><div class="tphud__acts">';
    for (var i = 0; i < SLOTS.length; i++) {
      html += '<div class="tphud__chip" data-slot="' + SLOTS[i].key + '">'
        + '<canvas class="tphud__icon" width="16" height="16"></canvas>'
        + '<i class="tphud__cd"></i><b class="tphud__cost"></b><u class="tphud__key"></u></div>';
    }
    el.innerHTML = html + '</div><div class="tphud__use"></div>';
    document.body.appendChild(el);
    fill = el.querySelector('.tphud__fill');
    num = el.querySelector('.tphud__num');
    deltaEl = el.querySelector('.tphud__delta'); tierEl = el.querySelector('.tphud__tier');
    var nodes = el.querySelectorAll('.tphud__chip');
    for (i = 0; i < nodes.length; i++) chips[SLOTS[i].key] = nodes[i];
    hpEl = el.querySelector('.tphud__hp'); useEl = el.querySelector('.tphud__use');
    el.addEventListener('click', onDockClick);
  }

  /* a dock chip does what its key does: C opens (or closes) the TP strip */
  function onDockClick(e) {
    var L = NEU.plat && NEU.plat.level0 ? NEU.plat.level0() : null;
    if (!dock || !L || !L.key || !e.target.closest || !e.target.closest('.tphud__chip, .tphud__use')) return;
    if (e.target.closest('[data-slot="melee"], [data-slot="ranged"]')) return;
    L.key('c', true);
  }

  function keyText(def) { return NEU.keys && NEU.keys.label ? String(NEU.keys.label(def)).toUpperCase() : def.toUpperCase(); }
  function paintKeys() {
    var i, s, n, t;
    for (i = 0; i < SLOTS.length; i++) {
      s = SLOTS[i]; n = chips[s.key].querySelector('.tphud__key');
      t = (s.hold ? 'HOLD ' : '') + keyText(s.def);
      if (n.textContent !== t) n.textContent = t;
    }
  }

  /* hearts: one 7x7 pixel heart per max HP, full or empty; the row shakes once when HP drops */
  var HEART = ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
  function heartPaint(cv, on) {
    var g = cv.getContext && cv.getContext('2d'), pal = on ? { k: '#12081E', r: '#E8304A', w: '#FFC8D0' } : { k: '#12081E', r: '#3A2030', w: '#4A2A3A' }, y, x, c;
    if (!g) return;
    for (y = 0; y < 7; y++) for (x = 0; x < 7; x++) { c = HEART[y].charAt(x); if (c !== '.') { g.fillStyle = pal[c]; g.fillRect(x, y, 1, 1); } }
  }
  function paintHearts(L) {
    var st = NEU.plat && NEU.plat.state, hp = st ? st.hp : 0, max = (L && L.hp) || 0, i, cv, nodes;
    if (max !== hpMax) {
      hpMax = max; hpShown = -1; hpEl.innerHTML = '';
      for (i = 0; i < max; i++) { cv = document.createElement('canvas'); cv.width = 7; cv.height = 7; cv.className = 'tphud__heart'; hpEl.appendChild(cv); }
    }
    if (hp === hpShown) return;
    if (hpShown > hp && !reduced() && !(NEU.motion && NEU.motion.calmFlash && NEU.motion.calmFlash())) { hurtT = 0.35; hpEl.classList.add('is-hurt'); }
    nodes = hpEl.children;
    for (i = 0; i < nodes.length; i++) { nodes[i].width = 7; heartPaint(nodes[i], i < hp); }
    hpShown = hp; hpEl.setAttribute('data-hp', hp);
  }

  /* the heal items you carry (the strip's consumables), as icon + count */
  function paintUse() {
    var heals = NEU.items && NEU.items.list ? NEU.items.list('heal') : [], out = [], i, n, sig = '', node, cv;
    for (i = 0; i < heals.length && out.length < 4; i++) {
      n = NEU.save && NEU.save.count ? NEU.save.count(heals[i].id) : 0;
      if (n > 0) { out.push({ d: heals[i], n: n }); sig += heals[i].id + ':' + n + ','; }
    }
    if (sig === useSig) return;
    useSig = sig; useEl.innerHTML = '';
    for (i = 0; i < out.length; i++) {
      node = document.createElement('div'); node.className = 'tphud__chip tphud__item'; node.title = out[i].d.name;
      cv = document.createElement('canvas'); cv.className = 'tphud__icon'; cv.width = 16; cv.height = 16;
      if (NEU.itemIcon) NEU.itemIcon(cv, out[i].d);
      node.appendChild(cv);
      node.insertAdjacentHTML('beforeend', '<b class="tphud__cost">x' + out[i].n + '</b>');
      useEl.appendChild(node);
    }
  }

  function reduced() {
    return document.documentElement.classList.contains('rm') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function itemDef(slot) {
    if (slot === 'heal') return { id: 'mend', name: 'HEAL', kind: 'spell', fx: 'heal', stats: {} };
    return NEU.items && NEU.items.get ? NEU.items.get(NEU.save && NEU.save.equipped ? NEU.save.equipped(slot) : '') : null;
  }

  function paintChips(k) {
    var i, s, def, cost, cv;
    for (i = 0; i < SLOTS.length; i++) {
      s = SLOTS[i];
      def = itemDef(s.key);
      var node = chips[s.key];
      /* the dungeon swings the axe on Z; the equipped blade is only for the boss rooms */
      if (dock && s.key === 'melee' && NEU.items && NEU.items.get && NEU.items.get('axe')) def = NEU.items.get('axe');
      if (!def) { node.hidden = true; continue; }
      node.hidden = false;
      if (s.key === 'melee' && k.noMelee && !dock) node.classList.add('is-off'); else node.classList.remove('is-off');
      if (!node.__icon) {
        cv = node.querySelector('canvas');
        if (NEU.itemIcon && cv) { NEU.itemIcon(cv, def); node.__icon = def.id; }
      } else if (node.__icon !== def.id && NEU.itemIcon) {
        cv = node.querySelector('canvas'); NEU.itemIcon(cv, def); node.__icon = def.id;
      }
      cost = node.querySelector('.tphud__cost');
      if (s.cd) cost.textContent = '';
      else {
        var tp = def.stats && def.stats.tp;
        cost.textContent = tp ? Math.round(tp) + '%' : '';
      }
      node.title = def.name + (def.desc ? ' — ' + def.desc : '');
    }
  }

  /* The dungeon's kit while a dungeon level is the live plat level. The kit is born in onOpen, before plat
     sets activeMinigame to 'plat', so it never carries that tag; a closed nested mode may also have nulled
     the flag. Level and liveness decide, not the tag, and a stale kit never matches a closed plat. */
  function dungeonKit() {
    var L = NEU.plat && NEU.plat.level0 ? NEU.plat.level0() : null;
    if (!L || L.tileset !== 'dungeon' || !NEU.plat.running()) return null;
    return L.kit || (NEU.dgnFoes && NEU.dgnFoes.kit ? NEU.dgnFoes.kit() : null);
  }

  /* The kit that is actually live: a minigame kit while its minigame runs,
     or the dungeon's kit while a dungeon level is the open plat level. */
  function pick() {
    var m = NEU.activeMinigame, cands = [], i;
    var draedon = document.getElementById('draedon');
    if (m === 'draedon' && draedon && !draedon.hidden && NEU.kitLive) return NEU.kitLive;
    if (m === 'plat' || !m) return dungeonKit();
    if (NEU.kitLive) cands.push(NEU.kitLive);
    for (i = 0; i < cands.length; i++) if (cands[i]._mini && cands[i]._mini === m) return cands[i];
    return null;
  }

  /* one signed percent for the gain/spend flash; text, so calm motion keeps it */
  function deltaT(evs) {
    var sum = 0, i;
    for (i = 0; i < evs.length; i++) sum += evs[i];
    deltaEl.textContent = (sum > 0 ? '+' : '-') + Math.abs(Math.round(sum * 100)) + '%';
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!el) return;
    var now = ts || 0, dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    var k = pick(), isDock = !!k && k === dungeonKit();
    if (isDock !== dock) { dock = isDock; el.classList.toggle('is-dock', dock); hpShown = -1; if (k && !el.hidden) paintChips(k); }
    /* the tier tag is a dock-only reading of the one difficulty authority */
    if (dock && NEU.diff && NEU.diff.glyph) tierEl.textContent = NEU.diff.glyph() + ' ' + NEU.diff.name().toUpperCase();
    else if (tierEl.textContent) tierEl.textContent = '';
    if (k !== kit) {
      kit = k; shown = kit ? kit.tp : 0;
      if (kit && !el.hidden) paintChips(kit);
    }
    if (!kit) { if (!el.hidden) el.hidden = true; return; }
    if (el.hidden) { el.hidden = false; shown = kit.tp; paintChips(kit); }
    if (dock) {
      paintHearts(NEU.plat.level0()); paintUse(); paintKeys();
      if (hurtT > 0 && (hurtT -= dt) <= 0) hpEl.classList.remove('is-hurt');
    }
    var target = kit.tp, evs = kit.drainTp ? kit.drainTp() : [], i, hasGain = false, hasSpend = false;
    for (i = 0; i < evs.length; i++) {
      if (evs[i] > 0.0001) hasGain = true;
      else if (evs[i] < -0.0001) hasSpend = true;
    }
    /* A gain and a spend inside one frame still reads as a spend: the
       player just paid TP, whatever grazed in the same beat. Gain -> spend
       upgrades at once; spend -> gain waits out the flash, so colour flips
       at most every 0.4 s (<= 3 Hz). */
    if (hasSpend) {
      if (flashT <= 0 || el.classList.contains('is-gain')) {
        flashT = 0.4; el.classList.add('is-spend'); el.classList.remove('is-gain'); deltaT(evs);
      }
    } else if (hasGain && flashT <= 0) {
      flashT = 0.4; el.classList.add('is-gain'); el.classList.remove('is-spend'); deltaT(evs);
    }
    if (flashT > 0) {
      flashT -= dt;
      if (flashT <= 0) { el.classList.remove('is-gain'); el.classList.remove('is-spend'); deltaEl.textContent = ''; }
    }
    if (reduced()) shown = target;
    else shown += (target - shown) * Math.min(1, dt * 10);
    if (Math.abs(target - shown) < 0.0005) shown = target;
    num.textContent = Math.round(shown * 100) + '%';
    fill.style.width = (shown * 100).toFixed(1) + '%';
    var cds = kit.cooldowns ? kit.cooldowns() : null, j;
    for (j = 0; j < SLOTS.length; j++) {
      var s = SLOTS[j], node = chips[s.key];
      if (!node || node.hidden) continue;
      var ov = node.querySelector('.tphud__cd');
      if (cds && s.cd) ov.style.height = (Math.round((cds[s.cd] || 0) * 100)) + '%';
      else ov.style.height = '0%';
    }
  }

  function start() {
    if (!el) build();
    if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  NEU.tphud = { pick: pick, frame: frame };
})();
