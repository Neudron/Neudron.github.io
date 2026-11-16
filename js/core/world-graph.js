/* world-graph.js — read-only, nonvisual world-graph advisory API.
   Feature-disabled by default: legacy NEU.engine.go() stays authoritative.
   This module never calls go(), never writes save state and never mutates
   the room/exit objects it is handed. Its index is a derived snapshot built
   by validate(rooms), not a second gameplay authority. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var index = {};
  var enabled = false;

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function isStr(s) { return typeof s === 'string' && s.length > 0; }

  function viaOf(style) {
    if (/^(door|gate|curtain|alley)$/.test(style || '')) return 'door';
    if (style === 'stairs') return 'stairs';
    if (style === 'hatch') return 'fall';
    if (/^(path|tunnel|arch)$/.test(style || '')) return 'slide';
    if (/^(portal|rift|frame)$/.test(style || '')) return 'portal';
    return null;
  }

  function locksOf(locked) {
    var out = [], i;
    if (isStr(locked)) return [locked];
    if (Array.isArray(locked)) for (i = 0; i < locked.length; i++) if (isStr(locked[i])) out.push(locked[i]);
    return out;
  }

  /* Build a detached snapshot. No reference to a room or entity is kept. */
  function build(rooms) {
    var out = {}, id, room, spawns, ents, node, s, i, e, ex;
    for (id in rooms) {
      if (!has(rooms, id) || !isObj(rooms[id])) continue;
      room = rooms[id];
      node = { id: id, spawns: [], exits: [], staticTargets: [] };
      spawns = room.spawns || {};
      for (s in spawns) if (has(spawns, s)) node.spawns.push(s);
      ents = room.entities || [];
      for (i = 0; i < ents.length; i++) {
        e = ents[i];
        if (!isObj(e) || e.t !== 'exit') continue;
        ex = { from: id, to: e.to, spawn: isStr(e.spawn) ? e.spawn : null,
          style: isStr(e.style) ? e.style : null, via: e.via || viaOf(e.style) || null,
          locked: e.locked || null, oneWay: !!(e.oneWay || e.cine), cine: !!e.cine,
          x: e.x, y: e.y };
        node.exits.push(ex);
        if (isStr(e.to) && node.staticTargets.indexOf(e.to) < 0) node.staticTargets.push(e.to);
      }
      out[id] = node;
    }
    return out;
  }

  function validate(rooms) {
    if (!isObj(rooms)) return ['invalid-rooms'];
    var built = build(rooms), problems = [], id, node, i, ex, key, target;
    for (id in built) {
      if (!has(built, id)) continue;
      node = built[id];
      for (i = 0; i < node.exits.length; i++) {
        ex = node.exits[i];
        key = id + '>' + ex.to;
        if (!isStr(ex.to) || !has(built, ex.to)) { problems.push('missing-target:' + key); continue; }
        target = built[ex.to];
        if (ex.spawn && target.spawns.indexOf(ex.spawn) < 0) problems.push('missing-spawn:' + key + ':' + ex.spawn);
        if (!ex.via && !ex.oneWay) problems.push('missing-via:' + key);
      }
    }
    index = built;
    return problems;
  }

  function get(id) {
    if (!isStr(id) || !has(index, id)) return null;
    var n = index[id], copy = { id: n.id, spawns: n.spawns.slice(), staticTargets: n.staticTargets.slice(), exits: [] },
      i, k, e, c;
    for (i = 0; i < n.exits.length; i++) {
      e = n.exits[i]; c = {};
      for (k in e) if (has(e, k)) c[k] = e[k];
      copy.exits.push(c);
    }
    return copy;
  }

  /* A seam is a two-way, non-cinematic edge with named spawns on both sides.
     gate, when given, must be the lock name on the forward edge. */
  function isSeamEligible(source, target, gate) {
    var a = get(source), b = get(target), fwd = null, back = null, i, e;
    if (!a || !b || a.id === b.id) return false;
    for (i = 0; i < a.exits.length; i++) if (a.exits[i].to === b.id) { fwd = a.exits[i]; break; }
    for (i = 0; i < b.exits.length; i++) if (b.exits[i].to === a.id) { back = b.exits[i]; break; }
    if (!fwd || !back) return false;
    if (fwd.oneWay || back.oneWay || fwd.cine || back.cine) return false;
    if (gate) {
      if (fwd.locked !== gate) return false;
      if (back.locked && back.locked !== gate) return false;
    } else if (fwd.locked || back.locked) return false;
    if (fwd.spawn && b.spawns.indexOf(fwd.spawn) < 0) return false;
    if (back.spawn && a.spawns.indexOf(back.spawn) < 0) return false;
    return true;
  }

  function decide(okFlag, reason, extra) {
    var r = { ok: !!okFlag, fallback: !okFlag, to: null, spawn: null, via: null,
      seam: false, locked: false, dynamic: false, indexed: false,
      enabled: enabled, reason: reason }, k;
    if (extra) for (k in extra) if (has(extra, k)) r[k] = extra[k];
    return r;
  }

  /* Resolve a LIVE exit object. Reading exit.to at call time is what keeps
     the e6_room story redirect dynamic: the baked a1_clearing is only ever
     an index entry, never the answer. Malformed input and any failed gate
     fall back to the legacy transition instead of granting passage. */
  function resolveExit(sourceId, exit, save) {
    if (!isStr(sourceId) || !isObj(exit) || !isStr(exit.to) || !isObj(save))
      return decide(false, 'malformed-input');
    var node = has(index, sourceId) ? index[sourceId] : null;
    var to = exit.to, spawn = isStr(exit.spawn) ? exit.spawn : null;
    var via = exit.via || viaOf(exit.style) || null;
    var dynamic = !!(node && node.staticTargets.indexOf(to) < 0);
    var target = has(index, to) ? index[to] : null;
    if (!target) return decide(false, 'missing-target',
      { to: to, spawn: spawn, via: via, dynamic: dynamic, indexed: !!node });
    if (spawn && target.spawns.indexOf(spawn) < 0) return decide(false, 'missing-spawn',
      { to: to, spawn: spawn, via: via, dynamic: dynamic, indexed: true });
    var locks = locksOf(exit.locked), i, open;
    for (i = 0; i < locks.length; i++) {
      open = false;
      try { if (typeof save.flagged === 'function') open = !!save.flagged(locks[i]); }
      catch (e) { open = false; }
      if (!open) return decide(false, 'locked-gate',
        { to: to, spawn: spawn, via: via, dynamic: dynamic, indexed: true, locked: true });
    }
    var gate = locks.length ? locks[0] : null;
    return decide(true, 'ok', { to: to, spawn: spawn, via: via, dynamic: dynamic,
      indexed: true, seam: isSeamEligible(sourceId, to, gate), locked: false });
  }

  NEU.worldGraph = {
    get: get,
    resolveExit: resolveExit,
    isSeamEligible: isSeamEligible,
    validate: validate,
    get enabled() { return enabled; },
    enable: function () { enabled = true; },
    disable: function () { enabled = false; }
  };
})();
