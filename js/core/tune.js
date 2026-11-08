/* tune.js — live tuning surface for the dev console.
   NEU.tune.table(path, obj) registers a live object; `tune <path> <value>`
   (dev console) sets a numeric leaf by dotted path; `tune dump` prints
   every table as JSON for paste-back. Sliders are a future slice. */
(function () {
  var tables = {};
  function resolve(path) {
    var parts = String(path || '').split('.');
    var cur = tables;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function setLeaf(path, value) {
    var parts = String(path || '').split('.');
    if (parts.length < 2) return false;
    var cur = tables;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur == null || typeof cur !== 'object') return false;
      cur = cur[parts[i]];
    }
    if (cur == null || typeof cur !== 'object') return false;
    var n = Number(value);
    cur[parts[parts.length - 1]] = isNaN(n) ? value : n;
    return true;
  }
  NEU.tune = {
    tables: tables,
    table: function (path, obj) { tables[path] = obj; return obj; },
    get: resolve,
    set: setLeaf,
    dump: function () {
      var out = {};
      for (var k in tables) out[k] = tables[k];
      return JSON.stringify(out);
    },
    paths: function () { return Object.keys(tables); }
  };
})();
