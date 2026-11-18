/* The selected tier is saved immediately. Fights sample it on entry and retry. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var IDS = ['bot', 'easy', 'medium', 'hard', 'vhard', 'ultrakill', 'finalbreath'];
  var cur = null;   /* the tier latched by begin() */
  var NAMES = ['Bot', 'Easy', 'Medium', 'Hard', 'Very Hard', 'Ultrakill', "Neu's Final Breath"];
  var P = {
    bulletSpeed: [0.60, 0.80, 1, 1.12, 1.25, 1.40, 1.55],
    gap:         [1.50, 1.25, 1, 0.85, 0.72, 0.62, 0.50],
    tele:        [1.50, 1.25, 1, 1, 1, 1, 1],
    iframes:     [2, 1.4, 1, 1, 1, 0.9, 0.8],
    bossHp:      [1, 1, 1, 1, 1.25, 1.5, 1.5],
    dmg:         [2, 1.25, 1, 1, 1, 1, 1],
    healCd:      [0.5, 0.75, 1, 1.25, 1.5, 2, 2],
    heals:       [1, 1, 1, 1, 1, 1, 0]
  };
  function index() {
    var v = NEU.save && NEU.save.flag ? NEU.save.flag('opt_diff') : null;
    var i = IDS.indexOf(v);
    return i < 0 ? 2 : i;
  }
  NEU.diff = {
    list: function () { return IDS.slice(); },
    name: function (i) { return NAMES[i === undefined ? index() : i] || NAMES[2]; },
    id: function () { return IDS[index()]; },
    index: index,
    set: function (id) {
      if (IDS.indexOf(id) < 0 || !NEU.save) return false;
      NEU.save.flag('opt_diff', id);
      return true;
    },
    p: function (key) { return Object.prototype.hasOwnProperty.call(P, key) ? P[key][index()] : 1; },
    pick: function (arr) { return arr[index()]; },
    /* fight-side readers: the tier latched by begin() at the fight's open() */
    begin: function () { cur = index(); return cur; },
    fi: function () { return cur === null ? index() : cur; },
    f: function (key) { return Object.prototype.hasOwnProperty.call(P, key) ? P[key][NEU.diff.fi()] : 1; },
    fpick: function (arr) { return arr[NEU.diff.fi()]; },
    fid: function () { return IDS[NEU.diff.fi()]; },
    fname: function () { return NAMES[NEU.diff.fi()]; },
    table: function () { return P; }
  };
})();
