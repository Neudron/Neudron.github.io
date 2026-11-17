/* tphud.js — the TP bar and ability chips shown during kit fights.
   ───────────────────────────────────────────────────────────────────
   Every NEU.kit.create registers itself as NEU.kitLive with the minigame
   it was born in. Each frame this picks the kit that is actually live —
   a boss minigame's own kit, or the dungeon's foe kit while the dgn
   level is open — tweens the displayed TP toward the real value, flashes
   green on gains and red on spends, and drains a cooldown sweep on the
   melee / ranged / heal chips. Spells show their TP cost instead.
   z 90: over every fight canvas (76-78), under .tbox (96). Never takes a
   click. Reduced motion snaps the tween instead of animating it. */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  var el = null, fill = null, num = null, chips = {};
  var shown = 0, kit = null;
  var flashT = 0, last = 0, raf = 0;

  var SLOTS = [
    { key: 'melee', slot: 'melee', cd: 'melee', label: 'MELEE' },
    { key: 'ranged', slot: 'ranged', cd: 'ranged', label: 'RANGED' },
    { key: 'spell1', slot: 'spell1', cd: '', label: 'SPELL I' },
    { key: 'spell2', slot: 'spell2', cd: '', label: 'SPELL II' },
    { key: 'heal', slot: '', cd: 'heal', label: 'HEAL' }
  ];

  function build() {
    el = document.createElement('div');
    el.id = 'tphud'; el.className = 'tphud'; el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    var html = '<div class="tphud__tp"><span class="tphud__label">TP</span>'
      + '<div class="tphud__bar"><div class="tphud__fill"></div></div>'
      + '<span class="tphud__num">0%</span></div><div class="tphud__acts">';
    for (var i = 0; i < SLOTS.length; i++) {
      html += '<div class="tphud__chip" data-slot="' + SLOTS[i].key + '">'
        + '<canvas class="tphud__icon" width="16" height="16"></canvas>'
        + '<i class="tphud__cd"></i><b class="tphud__cost"></b></div>';
    }
    el.innerHTML = html + '</div>';
    document.body.appendChild(el);
    fill = el.querySelector('.tphud__fill');
    num = el.querySelector('.tphud__num');
    var nodes = el.querySelectorAll('.tphud__chip');
    for (i = 0; i < nodes.length; i++) chips[SLOTS[i].key] = nodes[i];
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
      if (!def) { node.hidden = true; continue; }
      node.hidden = false;
      if (s.key === 'melee' && k.noMelee) node.classList.add('is-off'); else node.classList.remove('is-off');
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

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!el) return;
    var now = ts || 0, dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    var k = pick();
    if (k !== kit) {
      kit = k; shown = kit ? kit.tp : 0;
      if (kit && !el.hidden) paintChips(kit);
    }
    if (!kit) { if (!el.hidden) el.hidden = true; return; }
    if (el.hidden) { el.hidden = false; shown = kit.tp; paintChips(kit); }
    var target = kit.tp, evs = kit.drainTp ? kit.drainTp() : [], i, hasGain = false, hasSpend = false;
    for (i = 0; i < evs.length; i++) {
      if (evs[i] > 0.0001) hasGain = true;
      else if (evs[i] < -0.0001) hasSpend = true;
    }
    /* A gain and a spend inside one frame still reads as a spend: the
       player just paid TP, whatever grazed in the same beat. */
    if (hasSpend) { flashT = 0.4; el.classList.add('is-spend'); el.classList.remove('is-gain'); }
    else if (hasGain) { flashT = 0.4; el.classList.add('is-gain'); el.classList.remove('is-spend'); }
    if (flashT > 0) { flashT -= dt; if (flashT <= 0) { el.classList.remove('is-gain'); el.classList.remove('is-spend'); } }
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
