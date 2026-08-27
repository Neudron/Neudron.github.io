/* save.js — the file.
   ───────────────────────────────────────────────────────────────────
   Act IV is several hours long. Without this it is unfinishable by
   anyone who closes a tab, which is everyone.

   Four decisions worth writing down:

   1. VERSIONED FROM v1, WITH A MIGRATION HOOK THAT DOES NOTHING YET.
      Adding versioning after the first schema change is too late by
      definition — the change is the thing that needed it. `migrate()`
      is a no-op today and costs eight lines; the alternative is
      wiping every save the first time a field moves.

   2. A CORRUPT SAVE IS NEVER SILENTLY DISCARDED. It gets quarantined
      to a `.bad` key and the player is told. Losing three hours to a
      JSON parse error with no explanation is the worst thing this
      file could do.

   3. WRITES ARE COALESCED. Autosave fires on every room transition
      and every objective tick, which during a cutscene can be four
      times a second. localStorage writes are synchronous and block
      the main thread, so they are debounced to one per 400ms with a
      guaranteed flush on page hide.

   4. NO EXCEPTIONS ESCAPE. Private browsing, a full quota and
      disabled site data all throw from localStorage. Every entry
      point is wrapped: the game keeps running from the in-memory
      copy and says so once, rather than dying at a save point.     */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var KEY = 'neu.save.v1';
  var BAD = 'neu.save.bad';
  var VERSION = 2;

  /* The in-memory copy is the truth while playing. localStorage is a
     mirror of it, not the other way round — so a storage failure
     degrades to "this session works, it just won't persist". */
  var mem = blank();
  var ok = true;            // is storage usable at all
  var warned = false;
  var dirty = false, timer = null;

  function blank() {
    return { v: VERSION, act: 3, room: null, spawn: null,
             flags: {}, items: [], quest: { done: {}, counts: {} },
             quiz: null, best: {}, stamp: 0 };
  }

  function store() {
    /* Touching localStorage at all throws in some privacy modes, so
       even the existence check is guarded. */
    try { return window.localStorage; } catch (e) { return null; }
  }

  function warn(msg) {
    if (warned) return;
    warned = true;
    if (NEU.talk) NEU.talk([msg], 'narr');
    else if (window.console) console.warn('[save] ' + msg);
  }

  /* ── migration ──────────────────────────────────────────────────
     Runs oldest-first so a v1 file can climb to v4 through every step
     rather than needing an N×N table of direct conversions. */
  var STEPS = {
    /* 1: remap old rank names (S+..D-) to Deltarune ranks (T..Z). */
    1: function (s) {
      var MAP = {
        'S+': 'T', 'S': 'S', 'A+': 'A', 'A': 'A\u2013',
        'B+': 'B', 'B': 'B\u2013', 'C': 'C', 'D': 'C\u2013', 'D-': 'Z'
      };
      if (s.flags) {
        var old = {};
        for (var k in s.flags) {
          if (k.slice(0, 5) === 'rank:') {
            var name = k.slice(5);
            old[k] = MAP[name] ? 'rank:' + MAP[name] : k;
          }
        }
        for (var ok in old) {
          s.flags[old[ok]] = s.flags[ok];
          if (old[ok] !== ok) delete s.flags[ok];
        }
      }
      if (s.quiz && s.quiz.rank && MAP[s.quiz.rank]) s.quiz.rank = MAP[s.quiz.rank];
      if (s.flags && s.flags.quiz_rank && MAP[s.flags.quiz_rank])
        s.flags.quiz_rank = MAP[s.flags.quiz_rank];
      s.v = 2;
      return s;
    }
  };

  function migrate(s) {
    var guard = 0;
    while (s.v < VERSION && guard++ < 50) {
      var step = STEPS[s.v];
      if (!step) { s.v = VERSION; break; }   // no path: accept as-is
      s = step(s);
    }
    return s;
  }

  /* ── read ───────────────────────────────────────────────────────*/
  function read() {
    var st = store();
    if (!st) { ok = false; return null; }
    var raw;
    try { raw = st.getItem(KEY); } catch (e) { ok = false; return null; }
    if (!raw) return null;

    var s;
    try { s = JSON.parse(raw); } catch (e) { s = null; }
    if (!s || typeof s !== 'object' || typeof s.v !== 'number') {
      /* Quarantine rather than delete. If someone ever asks "where did
         my file go", the answer is a key away. */
      try { st.setItem(BAD, raw); st.removeItem(KEY); } catch (e2) {}
      warn("your save file was unreadable. starting fresh.");
      return null;
    }
    return migrate(s);
  }

  /* ── write ──────────────────────────────────────────────────────*/
  function flush() {
    clearTimeout(timer); timer = null;
    if (!dirty) return;
    dirty = false;
    var st = store();
    if (!st) { ok = false; return; }
    mem.stamp = Date.now();
    try {
      st.setItem(KEY, JSON.stringify(mem));
      ok = true;
    } catch (e) {
      ok = false;
      warn("couldn't save — storage is full or blocked. this session still works.");
    }
  }

  function write(now) {
    dirty = true;
    if (now) { flush(); return; }
    if (timer) return;                       // already scheduled
    timer = setTimeout(flush, 400);
  }

  /* A tab being hidden is the last reliable moment to persist —
     'beforeunload' does not fire on mobile. Both are registered
     because neither alone covers every browser. */
  addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  addEventListener('pagehide', flush);

  /* ── the public surface ─────────────────────────────────────────*/
  NEU.save = {
    get data() { return mem; },
    get usable() { return ok; },

    /* Pulls the live state out of quest.js rather than keeping a
       second copy — one source of truth is the rule that keeps this
       codebase debuggable at four times the size. */
    capture: function () {
      if (NEU.quest && NEU.quest.snapshot) mem.quest = NEU.quest.snapshot();
      if (NEU.engine && NEU.engine.where) {
        var w = NEU.engine.where();
        if (w) { mem.room = w.room; mem.spawn = w.spawn; }
      }
      write();
      return mem;
    },

    flag: function (k, v) {
      if (arguments.length === 1) return mem.flags[k];
      mem.flags[k] = v; write(); return v;
    },
    flagged: function (k) { return !!mem.flags[k]; },

    give: function (item) {
      if (mem.items.indexOf(item) < 0) { mem.items.push(item); write(); }
    },
    take: function (item) {
      var i = mem.items.indexOf(item);
      if (i >= 0) { mem.items.splice(i, 1); write(); }
    },
    has: function (item) { return mem.items.indexOf(item) >= 0; },

    /* Endless-mode personal bests. Only ever moves up. */
    best: function (game, score) {
      if (arguments.length === 1) return mem.best[game] || 0;
      if (score > (mem.best[game] || 0)) { mem.best[game] = score; write(); }
      return mem.best[game];
    },

    /* Called once at boot. Returns the loaded file, or null if there
       was nothing to load. Does NOT apply it — the caller decides,
       because "continue or start over" is the player's choice. */
    load: function () {
      var s = read();
      if (!s) return null;
      return s;
    },

    /* Apply a loaded file to the live game. */
    apply: function (s) {
      mem = s;
      if (NEU.quest && NEU.quest.restore) NEU.quest.restore(s.quest);
      write(true);
      return mem;
    },

    wipe: function () {
      mem = blank();
      var st = store();
      try { if (st) st.removeItem(KEY); } catch (e) {}
      if (NEU.quest && NEU.quest.reset) NEU.quest.reset();
      return mem;
    },

    /* Used by the tests: serialise, forget, restore, compare. */
    serialise: function () { return JSON.stringify(mem); },
    deserialise: function (json) {
      var s;
      try { s = JSON.parse(json); } catch (e) { return null; }
      return NEU.save.apply(migrate(s));
    },

    flush: flush,
    VERSION: VERSION
  };

  /* ── boot: bring the file back ───────────────────────────────────
     The file is only useful if something reads it, and nothing did —
     the resume logic in act4.js reads mem.room, but mem started blank
     on every load, so closing the tab quietly ended the game. Run at
     load time, before anything asks. `read` returns a migrated copy
     and `write(true)` flushes the migration back, so this is also
     where an old-version file climbs to the current schema. */
  (function () {
    var s = read();
    if (!s) return;
    mem = s;
    if (NEU.quest && NEU.quest.restore) NEU.quest.restore(s.quest);
    write(true);
  })();
})();
