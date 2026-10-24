/* engine-kinds.js — what each kind of entity does, looks like and emits.
   ───────────────────────────────────────────────────────────────────
   v1 decided this in two long `if (e.t === …)` chains, one in fire()
   and one in drawEnt(), and they had already drifted apart once: a
   "nearest" that returned blocks and plates silently ate every e press
   meant for a push, and every block puzzle in the game was unsolvable
   until someone noticed (see interactive() below). One record per kind
   means a new kind is one entry, not two edits that have to agree.

   A kind is:
     interactive(e)    can e be PRESSED (fire() does something)
     promptable(e)     does it get the "press e" cap above it
     fire(e, sys)      what pressing e does       (sim; verbatim from v1)
     draw(g, e, d)     what it looks like         (look; d = draw context)
     light(e, d)       what it emits, or null     (look)
     floor             drawn under everything, unsorted (plates)

   `sys` is the engine handing over exactly what a kind may touch: the
   hook API rooms get, say/go/flag, and burst at an entity. `d` carries
   the scale, the screen position, the time and the look kit.

   Unknown `t` falls back to `default`: its run hook if it has one, and a
   tinted figure — the same promise v1 made to room authors.          */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var K = {};

  function kind(t, def) { K[t] = def; return def; }
  function get(e) { return (e && K[e.t]) || K['default']; }
  function hasRun(e) { return typeof e.run === 'function'; }
  function tboxOpen() { return !!(NEU.tboxOpen && NEU.tboxOpen()); }
  function sfx(name) { if (NEU.sfx && NEU.sfx[name]) NEU.sfx[name](); }
  function L() { return NEU.engineLook; }

  /* integer sprite scale for sheet art, so pixels stay square: item-
     sized art is drawn at half the world scale, larger art at a third —
     the proportions v1 tuned at its fixed scale of 3. */
  function sheetScale(sheet, S, e) {
    var small = sheet.fw <= 24 && sheet.fh <= 24;
    return Math.max(1, Math.round(S * (small ? 0.5 : 1 / 3))) * (e.scale || 1);
  }
  function drawSheet(g, e, d) {
    var sh = e.sheet && NEU.sheets && NEU.sheets[e.sheet];
    if (!sh) return false;
    if (NEU.sheetDraw && NEU.sheetDraw(g, e.sheet, d.sx, d.sy, {
          frame: sh.fps ? null : (e.frame || 0), col: e.col || 0,
          scale: sheetScale(sh, d.S, e), anchor: 'feet', now: d.now })) return true;
    /* Missing art is LOUD. A silently absent sprite gets mistaken for a
       logic bug and costs an hour; a magenta box does not. */
    g.fillStyle = '#FF00A0';
    g.fillRect(d.sx - 4 * d.S, d.sy - 8 * d.S, 8 * d.S, 8 * d.S);
    return true;
  }
  function sheetWidth(e, S) {
    var sh = e.sheet && NEU.sheets && NEU.sheets[e.sheet];
    return sh ? sh.fw * sheetScale(sh, S, e) / S : 10;
  }

  /* A door's name plate: a few letters in a 3x5 pixel font, on the wall
     above it (the prize corridor's ranks). Gold once its lock is
     satisfied, grey while it is shut. Only the glyphs a plate needs. */
  var GLYPH = {
    T: ['111', '010', '010', '010', '010'], S: ['111', '100', '111', '001', '111'],
    A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
    C: ['011', '100', '100', '100', '011'], Z: ['111', '001', '010', '100', '111'],
    '\u2013': ['000', '000', '111', '000', '000']
  };
  function plate(g, text, x, y, S, open) {
    var n = text.length, w = (n * 4 + 3) * S, h = 9 * S, left = Math.round(x - w / 2), top = Math.round(y - h / 2);
    g.fillStyle = '#0A0810'; g.fillRect(left - S, top - S, w + 2 * S, h + 2 * S);
    g.fillStyle = open ? '#3A2A10' : '#14121C'; g.fillRect(left, top, w, h);
    g.fillStyle = open ? '#FFD34E' : '#6E6880';
    for (var k = 0; k < n; k++) {
      var gl = GLYPH[text.charAt(k)];
      if (!gl) continue;
      for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) {
        if (gl[r].charAt(c) === '1') g.fillRect(left + (2 + k * 4 + c) * S, top + (2 + r) * S, S, S);
      }
    }
  }
  function unlocked(e) { return !e.locked || !!(NEU.save && NEU.save.flagged(e.locked)); }

  /* ── exit ─────────────────────────────────────────────────────────── */
  kind('exit', {
    interactive: function () { return true; },
    fire: function (e, sys) {
      /* A locked door says what it is waiting for. "Nothing happens"
         is the least useful sentence a game can produce. */
      if (e.locked && !(NEU.save && NEU.save.flagged(e.locked))) {
        sys.say(e.lines || ['it will not move yet.'], 'narr');
        sfx('locked');
        return;
      }
      sys.go(e.to, e.spawn);
    },
    /* An exit is normally a hole in the wall with nothing to draw — but
       one carrying a `sheet` is a THING (b7_altar's fire door). A locked
       one gets a small padlock so "this is a door, and it is shut" can
       be read before you walk into it. */
    drawn: function (e) { return true; },
    draw: function (g, e, d) {
      if (e.sheet) { drawSheet(g, e, d); return; }
      if (e.label) plate(g, e.label, d.sx, d.sy - 24 * d.S, d.S, unlocked(e));
      if (unlocked(e)) return;
      var S = d.S, x = d.sx, y = d.sy - 14 * S;
      g.fillStyle = '#120F18'; g.fillRect(x - 3 * S, y - 3 * S, 6 * S, 7 * S);
      g.fillStyle = '#C8A04A'; g.fillRect(x - 2 * S, y, 4 * S, 3 * S);
      g.fillStyle = '#8A7A4A'; g.fillRect(x - 2 * S, y - 2 * S, S, 2 * S); g.fillRect(x + S, y - 2 * S, S, 2 * S);
      g.fillRect(x - 2 * S, y - 3 * S, 4 * S, S);
      g.fillStyle = '#120F18'; g.fillRect(x, y + S, S, S);
    },
    width: function (e, S) { return e.sheet ? sheetWidth(e, S) : 0; },
    light: function (e) {
      if (e.sheet === 'firedoor') return { r: 70, col: '#FF8A3A', glow: 0.22 };
      /* A door that carries `glowOpen` glows in that colour once its lock
         is satisfied: the prize corridor's doors you earned, in the gold
         the show lit them with on its board a moment before. */
      if (e.glowOpen && e.locked && NEU.save && NEU.save.flagged(e.locked)) {
        return { r: 30, col: e.glowOpen, glow: 0.24 };
      }
      return null;
    }
  });

  /* ── pickup ───────────────────────────────────────────────────────── */
  kind('pickup', {
    interactive: function () { return true; },
    fire: function (e, sys) {
      if (e.dead) return;
      e.dead = true;
      if (NEU.save) NEU.save.give(e.item);
      /* Taken stays taken even after the item is spent somewhere else.
         v1 read "taken" off the inventory alone, so a pickup came back
         the moment its item went into an altar. */
      if (NEU.save && sys.room()) NEU.save.flag('p:' + sys.room().id + ':' + e.x + ',' + e.y, 1);
      sys.say(e.lines || ['you take it.'], e.who || 'narr');
      sfx('snap');
      /* SMALL. A pickup must register without competing with a boss
         death — the tier table is what keeps that honest. */
      if (NEU.juice) { NEU.juice.hit('small'); sys.burst(e, 10, '#B892FF'); }
    },
    draw: function (g, e, d) {
      var lift = L().reduced ? 0 : Math.round(Math.sin(d.now / 380 + e.x) * 1.5) * d.S;
      if (e.sheet) { var sy = d.sy; d.sy = sy - 3 * d.S + lift; drawSheet(g, e, d); d.sy = sy; return; }
      var S = d.S, x = d.sx, y = d.sy - 7 * S + lift;
      g.fillStyle = '#120F18'; g.fillRect(x - 3 * S, y - 3 * S, 6 * S, 6 * S);
      g.fillStyle = e.colour || '#B892FF'; g.fillRect(x - 2 * S, y - 2 * S, 4 * S, 4 * S);
      g.fillStyle = '#FFFFFF'; g.fillRect(x - S, y - S, S, S);
    },
    width: function () { return 7; },
    light: function (e) { return { r: 22, col: e.colour || '#B892FF', glow: 0.25 }; }
  });

  /* ── save point ───────────────────────────────────────────────────── */
  var SAVE = { pal: { y: '#E4C46A', w: '#FFF2C4', k: '#8F7016' },
    rows: ['....k....', '....y....', '...kyk...', '.kkyywkk.', 'kyywwwyyk', '.kkyywkk.', '...kyk...', '....y....', '....k....'] };
  kind('save', {
    interactive: function () { return true; },
    fire: function (e, sys) {
      if (NEU.save) { NEU.save.capture(); NEU.save.flush(); }
      sys.say(['saved.'], 'narr');
      sfx('tick');
    },
    /* The save point breathes; it is the one thing in a room that is
       always glad to see you. */
    draw: function (g, e, d) {
      var t = d.now / 420, red = L().reduced;
      var lift = red ? 0 : Math.round(Math.sin(t) * 1) * d.S;
      g.globalAlpha = red ? 1 : 0.85 + Math.sin(t) * 0.15;
      L().stamp(g, SAVE.rows, SAVE.pal, d.sx, d.sy - 4 * d.S + lift, d.S);
      g.globalAlpha = 1;
    },
    width: function () { return 8; },
    light: function () { return { r: 46, col: '#FFE6A0', glow: 0.24 }; }
  });

  /* ── sign ─────────────────────────────────────────────────────────── */
  kind('sign', {
    interactive: function () { return true; },
    fire: function (e, sys) {
      /* A hint the player asked for by walking up to it. Signs are read,
         never consumed, and always answer in narration. E while this
         sign's own box is still typing is a no-op — `say()` is untracked,
         so pressing again used to restart it from line 1. Run hooks do
         NOT get this guard: they carry their own state and must fire
         even while an unrelated box is open. */
      if (tboxOpen()) return;
      sys.say(e.lines || ['a wooden sign. nothing else.'], 'narr');
      sfx('tick');
    },
    draw: function (g, e, d) { L().drawProp(g, 'signpost', null, d.sx, d.sy, d.S, d.now, 0); },
    width: function () { return 10; }
  });

  /* ── npc ──────────────────────────────────────────────────────────── */
  kind('npc', {
    interactive: function () { return true; },
    fire: function (e, sys) {
      /* A run hook wins over lines: the mushrooms, the witch, the
         merchant answer differently depending on the state of the world
         and a fixed `lines` array cannot do that. */
      if (hasRun(e)) { e.run(sys.api); return; }
      /* E while THIS dialogue is showing is a no-op. */
      if (tboxOpen()) return;
      var room = sys.room();
      var dk = 'd:' + room.id + ':' + e.x + ',' + e.y;
      var at = NEU.save ? (NEU.save.flag(dk) || 0) : 0;
      var base = e.lines || ['...'];
      var total = base.length;
      var who = e.who || 'narr';
      /* Picked up where they left off: resume from the line they were
         at, capped with a closing beat. Finished talks replay whole. */
      var lines = (at > 0 && at < total) ? base.slice(at).concat(e.close || ['...']) : base;
      sys.say(lines, who);
      if (NEU.talkWatch) {
        var seen = at;
        NEU.talkWatch(function (i) {
          if (i < 0) {
            NEU.talkUnwatch();
            if (NEU.save) NEU.save.flag(dk, seen >= total ? 0 : seen);
            return;
          }
          seen = at + i;
        });
      }
    },
    draw: function (g, e, d) {
      if (e.sheet) { drawSheet(g, e, d); return; }
      var look = L().lookFor(e);
      /* the socket holds a flame once the room is solved */
      if (look === 'socket' && d.api.solved(d.room.id)) look = 'torch';
      L().drawProp(g, look, e.colour, d.sx, d.sy, d.S, d.now, e.x * 7 + e.y);
    },
    width: function (e, S) { return e.sheet ? sheetWidth(e, S) : L().propWidth(L().lookFor(e)); },
    light: function (e, d) {
      if (e.mush) return { r: 20, col: '#FF8AA0', glow: 0.16 };
      var look = L().lookFor(e);
      if (look === 'torch') return { r: 18, col: '#FFB347', glow: 0.3, flicker: true };
      if (look === 'socket' && d && d.api.solved(d.room.id)) return { r: 90, col: '#FFB347', glow: 0.26, flicker: true };
      if (look === 'vending') return { r: 44, col: '#9FE0FF', glow: 0.2 };
      if (look === 'sans' || look === 'merchant') return { r: 26, col: '#FFE6A0', glow: 0.1 };
      if (look === 'bigdoor') return { r: 60, col: '#7FA8FF', glow: 0.22 };
      if (look === 'gate') return { r: 54, col: '#FF6A5A', glow: 0.2 };
      return null;
    }
  });

  /* ── altar ────────────────────────────────────────────────────────── */
  var ALTAR = { pal: { k: '#2A2238', s: '#8A8598', l: '#C4B8CC', a: '#4A4560' },
    rows: ['...kkkkk...', '..klllllk..', '..klaaalk..', '..kklllkk..', '...kkkkk...', '....sss....',
           '....sss....', '...sssss...', '..kssssskk.', '..kkkkkkkk.'] };
  kind('altar', {
    interactive: function () { return true; },
    fire: function (e, sys) {
      if (!NEU.save || !NEU.save.has(e.needs)) {
        sys.say(e.empty || ['it wants something you do not have.'], 'narr');
        return;
      }
      NEU.save.take(e.needs);
      sys.flag(e.gives, 1);
      sys.say(e.lines || ['it takes it.'], 'narr');
    },
    draw: function (g, e, d) { L().stamp(g, ALTAR.rows, ALTAR.pal, d.sx, d.sy, d.S); },
    width: function () { return 9; },
    light: function (e) {
      return (NEU.save && NEU.save.flagged(e.gives)) ? { r: 40, col: '#FF8A3A', glow: 0.2 } : null;
    }
  });

  /* ── block ────────────────────────────────────────────────────────── */
  kind('block', {
    /* pressing e against a block goes through tryPush, not fire */
    interactive: function () { return false; },
    promptable: function (e) { return !!e.push; },
    draw: function (g, e, d) {
      var S = d.S, x = d.sx - 7 * S, y = d.sy - 15 * S;
      g.fillStyle = '#120F18'; g.fillRect(x - S, y - S, 16 * S, 16 * S);
      g.fillStyle = '#8A7E9C'; g.fillRect(x, y, 14 * S, 5 * S);           /* top */
      g.fillStyle = '#A89CBA'; g.fillRect(x, y, 14 * S, S);
      g.fillStyle = '#564B66'; g.fillRect(x, y + 5 * S, 14 * S, 9 * S);    /* face */
      g.fillStyle = '#463C56'; g.fillRect(x, y + 10 * S, 14 * S, 4 * S);
      g.fillStyle = '#6A5E7C'; g.fillRect(x + 2 * S, y + 7 * S, 10 * S, S);
      g.fillStyle = '#2E2638'; g.fillRect(x + 6 * S, y + 8 * S, 2 * S, 3 * S);
    },
    width: function () { return 15; }
  });

  /* ── plate ────────────────────────────────────────────────────────── */
  kind('plate', {
    interactive: function () { return false; },
    floor: true,
    /* Drawn UNDER everything and inset, so a block sitting on one is
       still visibly a block on a plate. A slide-armed plate stays lit. */
    draw: function (g, e, d) {
      var lit = !!d.entHere(e.x, e.y, 'block') || !!e.armed;
      var S = d.S, x = d.sx - 6 * S, y = d.sy - 11 * S;
      g.fillStyle = '#120F18'; g.fillRect(x - S, y - S, 14 * S, 8 * S);
      g.fillStyle = lit ? '#3E8A4E' : '#3A3448'; g.fillRect(x, y, 12 * S, 6 * S);
      g.fillStyle = lit ? '#7BE38A' : '#5E567A';
      g.fillRect(x + 2 * S, y + 2 * S, 8 * S, S); g.fillRect(x + 5 * S, y + S, 2 * S, 4 * S);
    },
    light: function (e, d) {
      return (d && (d.entHere(e.x, e.y, 'block') || e.armed)) ? { r: 20, col: '#7BE38A', glow: 0.2 } : null;
    }
  });

  /* ── brazier ──────────────────────────────────────────────────────── */
  kind('brazier', {
    interactive: function (e) { return hasRun(e); },
    fire: function (e, sys) { if (hasRun(e)) e.run(sys.api); },
    draw: function (g, e, d) {
      var S = d.S, x = d.sx, y = d.sy, on = !!e.lit;
      g.fillStyle = '#120F18'; g.fillRect(x - 5 * S, y - 9 * S, 10 * S, 9 * S);
      g.fillStyle = '#4A4058'; g.fillRect(x - 4 * S, y - 8 * S, 8 * S, 3 * S);   /* bowl */
      g.fillStyle = '#2E2638'; g.fillRect(x - S, y - 5 * S, 2 * S, 5 * S);       /* stem */
      g.fillRect(x - 3 * S, y - S, 6 * S, S);
      if (!on) { g.fillStyle = '#2A2A38'; g.fillRect(x - 3 * S, y - 9 * S, 6 * S, S); return; }
      var w = L().reduced ? 0 : ((d.now / 90) | 0) % 3;
      g.fillStyle = '#E4602A'; g.fillRect(x - 3 * S, y - (12 + w) * S, 6 * S, (4 + w) * S);
      g.fillStyle = '#FFB347'; g.fillRect(x - 2 * S, y - (14 + w) * S, 4 * S, (5 + w) * S);
      g.fillStyle = '#FFF2C4'; g.fillRect(x - S, y - (12 + w) * S, 2 * S, 3 * S);
    },
    width: function () { return 10; },
    light: function (e) { return e.lit ? { r: 66, col: '#FFB347', glow: 0.26, flicker: true } : null; }
  });

  /* ── trigger ──────────────────────────────────────────────────────── */
  kind('trigger', { interactive: function () { return false; }, hidden: true });

  /* ── default ──────────────────────────────────────────────────────── */
  kind('default', {
    interactive: function (e) { return hasRun(e); },
    fire: function (e, sys) { if (hasRun(e)) e.run(sys.api); },
    draw: function (g, e, d) {
      if (e.sheet) { drawSheet(g, e, d); return; }
      L().drawProp(g, L().lookFor(e), e.colour, d.sx, d.sy, d.S, d.now, e.x + e.y);
    },
    width: function (e, S) { return e.sheet ? sheetWidth(e, S) : 9; }
  });

  /* ── queries the engine asks ──────────────────────────────────────── */
  /* What `fire` can actually DO something with. */
  function interactive(e) {
    var k = get(e);
    return !!(k.interactive && k.interactive(e)) || hasRun(e);
  }
  /* A pushable block is worth a prompt even though pressing e goes
     through tryPush; a plate is floor paint and never is. */
  function promptable(e) {
    var k = get(e);
    return interactive(e) || !!(k.promptable && k.promptable(e));
  }
  function fire(e, sys) { var k = get(e); if (k.fire) k.fire(e, sys); else if (hasRun(e)) e.run(sys.api); }

  NEU.engineKinds = {
    kind: kind, get: get, all: K,
    interactive: interactive, promptable: promptable, fire: fire,
    known: function () { return Object.keys(K).filter(function (k) { return k !== 'default'; }); }
  };
})();
