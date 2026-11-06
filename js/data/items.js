/* items.js — the things the soul can carry. */
(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  var all = [
    { id: 'blade', name: 'Old Blade', kind: 'melee', price: 0, sell: 0, fx: 'arc', stats: { dmg: 6, cd: 0.3, r: 56 }, desc: 'it has seen worse.' },
    { id: 'scythe', name: 'Ghost Scythe', kind: 'melee', price: 60, sell: 30, fx: 'arc', stats: { dmg: 5, cd: 0.4, r: 72 }, desc: 'it cuts through the quiet.' },
    { id: 'knuckle', name: 'Iron Knuckle', kind: 'melee', price: 45, sell: 22, fx: 'arc', stats: { dmg: 3, cd: 0.15, r: 40 }, desc: 'a fist with paperwork.' },
    { id: 'lance', name: 'Bone Lance', kind: 'melee', price: 90, sell: 45, fx: 'dashstrike', stats: { dmg: 8, cd: 0.6, r: 90 }, desc: 'point first, questions later.' },
    { id: 'soulfire', name: 'Soul Fire', kind: 'ranged', price: 0, sell: 0, fx: 'split', stats: { dmg: 4, cd: 1.2, hold: 0.45, mini: 4 }, desc: 'a small, committed fire.' },
    { id: 'needles', name: 'Hex Needles', kind: 'ranged', price: 50, sell: 25, fx: 'shot', stats: { n: 3, spread: 0.25, dmg: 2, cd: 0.6 }, desc: 'three problems at once.' },
    { id: 'wisp', name: 'Wisp Orb', kind: 'ranged', price: 70, sell: 35, fx: 'homing', stats: { dmg: 3, cd: 0.9 }, desc: 'it knows where to go.' },
    { id: 'bolt', name: 'Storm Bolt', kind: 'ranged', price: 85, sell: 42, fx: 'pierce', stats: { dmg: 5, cd: 1.4 }, desc: 'the weather has opinions.' },
    { id: 'brimstone', name: 'Brimstone', kind: 'spell', price: 0, sell: 0, fx: 'beam', stats: { tp: 50 }, desc: 'a very direct conversation.' },
    { id: 'soulshield', name: 'Soul Shield', kind: 'spell', price: 0, sell: 0, fx: 'shield', stats: { tp: 32 }, desc: 'for when talking fails.' },
    { id: 'nova', name: 'Grave Nova', kind: 'spell', price: 80, sell: 40, fx: 'nova', stats: { dmg: 4, n: 16, tp: 40 }, desc: 'the room gets the message.' },
    { id: 'mend', name: 'Witch Mend', kind: 'spell', price: 65, sell: 32, fx: 'heal', stats: { heal: 3, tp: 30 }, desc: 'borrowed health, probably.' },
    { id: 'bread', name: 'Stale Bread', kind: 'heal', price: 5, sell: 2, fx: 'heal', stats: { heal: 2 }, desc: 'it was stale yesterday.' },
    { id: 'tea', name: 'Ghost Tea', kind: 'heal', price: 12, sell: 6, fx: 'heal', stats: { heal: 4 }, desc: 'a little pale, like you.' },
    { id: 'elixir', name: 'Night Elixir', kind: 'heal', price: 40, sell: 20, fx: 'heal', stats: { heal: 'full' }, desc: 'all of it, apparently.' },
    { id: 'soup', name: 'Mushroom Soup', kind: 'heal', price: 0, sell: 0, fx: 'heal', stats: { heal: 0 }, desc: 'it smells like forgiveness.' },
    { id: 'recall', name: 'Recall Potion', kind: 'key', price: 30, sell: 0, fx: 'recall', stats: {}, desc: 'a safe place, briefly.' },
    { id: 'boss_key', name: 'Bone Key', kind: 'key', price: 0, sell: 0, fx: 'key', stats: {}, desc: 'it opens something unpleasant.' },
    { id: 'dad_card', name: "Dad's Card", kind: 'quest', price: 0, sell: 0, fx: 'quest', stats: {}, desc: 'he kept the receipt.' },
    { id: 'pkg_misleading', name: 'Misleading-looking Package', kind: 'quest', price: 0, sell: 0, fx: 'quest', stats: {}, desc: 'it looks exactly as advertised.' },
    { id: 'photo', name: 'Old Photograph', kind: 'quest', price: 0, sell: 0, fx: 'quest', stats: {}, desc: 'everyone was younger then.' },
    { id: 'axe', name: 'Axe', kind: 'quest', price: 0, sell: 0, fx: 'quest', stats: {}, desc: 'it remembers being a sword.' },
    { id: 'ashes', name: 'Ashes', kind: 'quest', price: 0, sell: 0, fx: 'quest', stats: {}, desc: 'what is left. you keep it anyway.' },
    { id: 'phaseslayer', name: 'Phaseslayer', kind: 'melee', price: 0, sell: 0, fx: 'dashstrike', stats: { dmg: 14, cd: 0.45, r: 96 }, desc: 'Draedon kept the receipt.' },
    { id: 'pulse_rifle', name: 'Pulse Rifle', kind: 'ranged', price: 0, sell: 0, fx: 'shot', stats: { dmg: 7, cd: 0.35 }, desc: 'it counts in pulses.' },
    { id: 'exoblade', name: 'Exoblade', kind: 'melee', price: 0, sell: 0, fx: 'arc', stats: { dmg: 16, cd: 0.5, r: 100 }, desc: 'the mechs, folded once.' },
    { id: 'magnomaly', name: 'Magnomaly Cannon', kind: 'ranged', price: 0, sell: 0, fx: 'beam', stats: { dmg: 9, cd: 0.8 }, desc: 'a polite singularity.' },
    { id: 'flying_chair', name: 'Flying Chair', kind: 'quest', price: 0, sell: 0, fx: 'quest', stats: {}, desc: 'the snails are retired.' }
  ];

  function get(id) {
    var i;
    for (i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function list(kind) {
    var out = [], i;
    for (i = 0; i < all.length; i++) if (all[i].kind === kind) out.push(all[i]);
    return out;
  }

  NEU.items = { get: get, list: list, all: all };
})();
