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
