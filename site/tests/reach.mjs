/* reach.mjs — the walkability proof, shared by the zone suites.

   A room can pass every other check in this project and still be
   impossible to finish. a2_path did: its exits pointed at real rooms,
   its spawns were on open floor, it had no puzzle to get wrong — and
   row 5 was solid undergrowth from wall to wall, so the lit path you
   arrived on and the lit path holding the east exit were two corridors
   that never touched. You walked east, pressed e, and got silence.

   So this floods the walkable region outward from every spawn and
   asserts every exit in the room is standing in it. It is the geometry
   equivalent of the "every exit points at a real room" check: that one
   proves the door leads somewhere, this one proves you can get to the
   door.

   The maps come from evaluating the shipped rooms file against a fake
   engine that records nothing but register() and tileset(). Pulling
   tile rows out with a regex would create a second copy of every map to
   keep in sync, which is trap 2 in `neu-verify` and has already
   reported working rooms as broken here. */

import fs from 'node:fs';
import path from 'node:path';

/* Orthogonal only. An exit is interactable from its own cell or from a
   cell beside it, but NOT from a corner: REACH is 22 world units and a
   diagonal neighbour sits 22.6 away, so a diagonal approach is exactly
   out of range and must not count as reachable. */
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* engine.js's own numbers. If they ever change there, change them here —
   these checks are only as true as their agreement with the engine. */
const TILE = 16, REACH = 22, PLAYER_H = 8;

/* Load rooms the way the engine sees them, without the engine. */
export function loadRooms(root, files) {
  const rooms = {}, tilesets = {};
  const fake = { NEU: { engine: {
    register: (id, def) => { def.id = id; rooms[id] = def; return def; },
    tileset:  (name, def) => { tilesets[name] = def; return def; }
  } } };
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, 'js', 'act4', f), 'utf8');
    new Function('window', src)(fake);
  }
  return { rooms, tilesets };
}

/* Every spawn/exit pair you cannot walk between, as readable strings.
   Empty means the zone is finishable from every door you can enter by. */
export function stranded(root, files) {
  const { rooms, tilesets } = loadRooms(root, files);
  const out = [];

  for (const id of Object.keys(rooms)) {
    const def = rooms[id];
    const g = def.tiles.split('\n').filter(r => r.length);
    const ts = tilesets[def.tileset];
    /* mirrors engine.js at() + solidAt(): off the grid is wall, and an
       unknown tileset is wall rather than a hole you can walk through */
    const solid = (x, y) =>
      !ts || y < 0 || y >= g.length || x < 0 || x >= g[y].length ||
      ts.solid.indexOf(g[y][x]) >= 0;

    const exits = (def.entities || []).filter(e => e.t === 'exit');

    for (const name of Object.keys(def.spawns || {})) {
      const s = def.spawns[name];
      if (solid(s.x, s.y)) { out.push(id + ':' + name + ' spawns inside a wall'); continue; }

      const seen = new Set([s.x + ',' + s.y]);
      const q = [[s.x, s.y]];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
          if (seen.has(k) || solid(nx, ny)) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }

      for (const e of exits) {
        const usable = seen.has(e.x + ',' + e.y) ||
          NEIGHBOURS.some(([dx, dy]) => seen.has((e.x + dx) + ',' + (e.y + dy)));
        if (!usable) out.push(id + ':' + name + ' cannot reach the exit to ' + e.to);
      }
    }
  }
  return out;
}

/* How many rooms the proof actually looked at. A loader that silently
   stops matching the registration shape would make `stranded` return an
   empty array and the suites would pass while proving nothing, so every
   caller asserts this too. */
export function roomCount(root, files) {
  return Object.keys(loadRooms(root, files).rooms).length;
}

/* ── exits naming a spawn the target room does not declare ───────────
   The engine now lands you on a real spawn instead of its old hard-coded
   (2,2), so this is no longer a soft-lock — but it still means arriving
   at the wrong end of the room facing the wrong way, which is how
   d3_square dropped you in a corner of the square instead of the chalk
   circle you left from. */
export function badSpawns(root, files) {
  const { rooms } = loadRooms(root, files);
  const out = [];
  for (const id of Object.keys(rooms))
    for (const e of (rooms[id].entities || []).filter(x => x.t === 'exit')) {
      if (!e.spawn || !rooms[e.to]) continue;          // dangling doors: other checks
      const t = rooms[e.to];
      if (!(t.spawns && t.spawns[e.spawn]))
        out.push(id + " -> " + e.to + " asks for spawn '" + e.spawn + "', which it does not have");
    }
  return out;
}

/* ── entities you can see but can never touch ────────────────────────
   b8_arena's trigger for the Calamitas fight sat inside the 2x2 its own
   doorframe encloses, and the frame is solid: there was no cell in the
   room you could stand in and still be in REACH, so the fight could not
   be started and every zone behind it was dead. h1_storm had the same
   entity two cells too far in.

   Entities flagged `mush:` are the deliberate exception — the five
   mushrooms are planted in undergrowth hours early precisely so you
   walk past them and cannot have them. */
export function untouchable(root, files) {
  const { rooms, tilesets } = loadRooms(root, files);
  const out = [];
  for (const id of Object.keys(rooms)) {
    const def = rooms[id];
    const g = def.tiles.split('\n').filter(r => r.length);
    const ts = tilesets[def.tileset];
    const solid = (x, y) =>
      !ts || y < 0 || y >= g.length || x < 0 || x >= g[y].length ||
      ts.solid.indexOf(g[y][x]) >= 0;

    /* every cell you can stand in, from any door into the room */
    const stand = new Set();
    for (const name of Object.keys(def.spawns || {})) {
      const s = def.spawns[name];
      if (solid(s.x, s.y)) continue;
      const seen = new Set([s.x + ',' + s.y]), q = [[s.x, s.y]];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
          if (seen.has(k) || solid(nx, ny)) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      for (const c of seen) stand.add(c);
    }

    for (const e of (def.entities || [])) {
      if (e.t === 'exit' || e.mush) continue;      // exits: stranded(). mushrooms: deliberate
      let ok = false;
      for (const c of stand) {
        const [cx, cy] = c.split(',').map(Number);
        /* engine nearest(): entity centre vs the player's middle */
        const dx = (e.x + 0.5) * TILE - (cx + 0.5) * TILE;
        const dy = (e.y + 1) * TILE - ((cy + 1) * TILE - PLAYER_H / 2);
        if (Math.hypot(dx, dy) < REACH) { ok = true; break; }
      }
      if (!ok) out.push(id + ' ' + e.t + ' at (' + e.x + ',' + e.y + ') cannot be reached from anywhere you can stand');
    }
  }
  return out;
}

/* ── block puzzles nobody can solve ──────────────────────────────────
   fixes8 already BFS'd b2 over block positions alone. That is not
   enough: it proves a block COULD sit on the plate, not that a player
   who has to walk to the pushing cell can put it there. Three of the
   four castle puzzles passed that weaker proof and were impossible —
   b4's block could never reach the ice, b5's could never be pushed up
   off the bottom wall, b6's could never be pushed out of its column.

   So this searches (block positions + where the player is standing),
   mirroring engine.js tryPush exactly: the pusher must occupy the cell
   directly opposite the push, the pusher does NOT move, and a block
   whose cell is ice keeps going until the next cell is blocked. */
export function unsolvable(root, files, cap = 60) {
  const { rooms, tilesets } = loadRooms(root, files);
  const out = [], lengths = {};
  for (const id of Object.keys(rooms)) {
    const def = rooms[id];
    const plates = (def.entities || []).filter(e => e.t === 'plate');
    const blocks = (def.entities || []).filter(e => e.t === 'block');
    if (!plates.length || !blocks.length) continue;

    const g = def.tiles.split('\n').filter(r => r.length);
    const ts = tilesets[def.tileset];
    const solid = (x, y) =>
      !ts || y < 0 || y >= g.length || x < 0 || x >= g[y].length ||
      ts.solid.indexOf(g[y][x]) >= 0;
    const ice = (x, y) => (g[y] && g[y][x]) === 'i';
    const sp = def.spawns[Object.keys(def.spawns)[0]];

    /* Rooms with their own win rule get asked, not assumed: b5 wants a
       block on one plate and YOU on the other, and calling its real
       solved() beats keeping a second copy of that rule in here. */
    const win = (bs, p) => {
      if (typeof def.solved === 'function') return !!def.solved({
        player: { x: (p[0] + 0.5) * TILE, y: (p[1] + 1) * TILE },
        entHere: (x, y, kind) =>
          (!kind || kind === 'block') && bs.some(b => b[0] === x && b[1] === y) ? {} : null
      });
      return plates.every(pl => bs.some(b => b[0] === pl.x && b[1] === pl.y));
    };

    const key = (bs, p) => bs.map(b => b.join(',')).sort().join('|') + '@' + p.join(',');
    const start = [blocks.map(b => [b.x, b.y]), [sp.x, sp.y]];
    const seen = new Set([key(...start)]);
    let q = [start], depth = 0, solved = -1;
    while (q.length && depth < cap && solved < 0) {
      const next = [];
      for (const [bs, p] of q) {
        if (win(bs, p)) { solved = depth; break; }
        const occ = new Set(bs.map(b => b[0] + ',' + b[1]));
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = p[0] + dx, ny = p[1] + dy;
          if (solid(nx, ny)) continue;
          if (occ.has(nx + ',' + ny)) {
            let tx = nx + dx, ty = ny + dy, guard = 0;
            if (solid(tx, ty) || occ.has(tx + ',' + ty)) continue;
            while (ice(tx, ty) && guard++ < 64) {
              const ax = tx + dx, ay = ty + dy;
              if (solid(ax, ay) || occ.has(ax + ',' + ay)) break;
              tx = ax; ty = ay;
            }
            const nb = bs.map(b => (b[0] === nx && b[1] === ny) ? [tx, ty] : b.slice());
            const k = key(nb, p);                     // the pusher stays put
            if (!seen.has(k)) { seen.add(k); next.push([nb, p]); }
          } else {
            const k = key(bs, [nx, ny]);
            if (!seen.has(k)) { seen.add(k); next.push([bs, [nx, ny]]); }
          }
        }
      }
      q = next; depth++;
    }
    if (solved < 0) out.push(id + ': no solution within ' + cap + ' moves from spawn (' + sp.x + ',' + sp.y + ')');
    else lengths[id] = solved;
  }
  return { unsolvable: out, lengths };
}
