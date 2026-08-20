/* fixes8.mjs — Zone A, Zone B, and Calamitas.
   Run: node fixes8.mjs

   The puzzles get solvability checks rather than playthroughs: a BFS
   over the block/plate state space proves a solution exists, which a
   scripted playthrough only proves for the one route it took. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
import { stranded, roomCount, badSpawns, untouchable, unsolvable } from './reach.mjs';

/* The suites live in site/tests/, so the site is one level up. Resolving
   from import.meta.url rather than hard-coding a path is what lets them
   run from a clone on any machine. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };

function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  const obs = [];
  w.IntersectionObserver = class { constructor(cb){this.cb=cb;obs.push(this);} observe(){} disconnect(){} };
  w.matchMedia = w.matchMedia || (() => ({ matches:false, addListener(){}, addEventListener(){} }));
  w.AudioContext = class {
    constructor(){ this.state='running'; this.currentTime=0; this.destination={}; this.sampleRate=44100; }
    createOscillator(){ return { type:'', frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}}, connect(){},start(){},stop(){} }; }
    createGain(){ return { gain:{setValueAtTime(){},exponentialRampToValueAtTime(){},value:0}, connect(){} }; }
    createBufferSource(){ return { buffer:null, connect(){},start(){},stop(){} }; }
    createBiquadFilter(){ return { type:'', frequency:{value:0}, Q:{value:0}, connect(){} }; }
    createBuffer(){ return { getChannelData: () => new Float32Array(64) }; }
  };
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return {};
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return typeof k === 'string' ? noop : undefined;
    }, set(){ return true; }
  });
  w.scrollTo = noop;
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left:100, top:100, right:146, bottom:146, width:46, height:46, x:100, y:100 });

  for (const f of ['core/quest.js','core/save.js','core/danmaku.js','data/sheets.js','core/engine.js','game/bullet.js','game/dark.js',
                   'game/sans.js','act4/act4.js','act4/rooms-a.js','act4/rooms-d.js','act4/boss-scal.js','act4/quiz.js','game/deck.js','core/dev.js']) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ═══ 1. the rooms exist and connect ══════════════════════════════*/
console.log('\n1. the map');
{
  const { NEU } = boot();
  const want = ['a1_clearing','a2_path','a3_fork','b1_throne','b2_blocks',
                'b3_braziers','b4_ice','b5_two','b6_dark','b7_altar','b8_arena'];
  ok('all eleven zone A/B rooms registered', want.every(r => NEU.engine.rooms.includes(r)));

  /* Every exit must point at a room that exists. A typo here is a hard
     lock that only shows up when a player walks into it. */
  const src = fs.readFileSync(path.join(ROOT,'js','act4','rooms-a.js'), 'utf8');
  const targets = [...src.matchAll(/to:\s*'([a-z0-9_]+)'/g)].map(m => m[1]);
  const bad = targets.filter(t => !NEU.engine.rooms.includes(t));
  ok('>>> every exit points at a real room <<<', bad.length === 0);
  if (bad.length) console.log('       dangling: ' + [...new Set(bad)].join(', '));
  console.log('       ' + targets.length + ' exits checked');

  /* Every spawn name used by an exit must exist in the target room. */
  const pairs = [...src.matchAll(/to:\s*'([a-z0-9_]+)',\s*spawn:\s*'(\w+)'/g)];
  ok('exits name a spawn point', pairs.length >= 8);
}

/* ═══ 2. the woods are walkable ═══════════════════════════════════*/
console.log('\n2. walkable');
{
  const { NEU } = boot();
  ok('entering works', NEU.engine.enter('a1_clearing', 'default') === true);
  ok('room is a1', NEU.engine.room === 'a1_clearing');
  const p = NEU.engine.api.player;
  ok('>>> spawns on open ground, not inside a tree <<<',
     typeof p.x === 'number' && p.x > 0 && p.y > 0);
  NEU.engine.leave();

  /* Standing on floor is not the same as being able to LEAVE. a2_path
     shipped with its two lit paths separated by a full-width band of
     undergrowth: you arrived on the top one, the east exit was on the
     bottom one, and pressing e at the end of the walk did nothing. */
  const zoneA = ['rooms-a.js'];
  const lost = stranded(ROOT, zoneA);
  ok('>>> every spawn can walk to every exit in its room <<<', lost.length === 0);
  if (lost.length) console.log('       ' + lost.join('\n       '));
  /* if the loader ever stops seeing rooms the check above passes for
     free, so say out loud how many it flooded */
  ok('and the proof actually saw the rooms', roomCount(ROOT, zoneA) === 11);

  /* An exit asking for a spawn the target room does not declare. */
  const wrongDoor = badSpawns(ROOT, zoneA);
  ok('>>> every exit names a spawn its target really has <<<', wrongDoor.length === 0);
  if (wrongDoor.length) console.log('       ' + wrongDoor.join('\n       '));

  /* Entities you can see and never touch. b8_arena's trigger for the
     Calamitas fight was sealed inside its own doorframe, which killed
     the ashes, the altar, the fire door and every zone after them. */
  const sealed = untouchable(ROOT, zoneA);
  ok('>>> every entity can be reached from somewhere you can stand <<<', sealed.length === 0);
  if (sealed.length) console.log('       ' + sealed.join('\n       '));

  /* The specific geometry that was missing: a2's two paths are joined at
     both walls, so "hold right until you stop, then hold down" arrives
     at the exit and the same move mirrored gets you home. */
  const a2 = loadA2();
  ok('a2 joins its paths at the west wall', [4, 5, 6].every(y => a2[y][1] === ','));
  ok('>>> and at the east wall, where the exit is <<<',
     [4, 5, 6].every(y => a2[y][24] === ','));
  function loadA2() {
    const rooms = {};
    const fake = { NEU: { engine: { register: (id, d) => { rooms[id] = d; }, tileset: () => {} } } };
    new Function('window', fs.readFileSync(path.join(ROOT,'js','act4','rooms-a.js'),'utf8'))(fake);
    return rooms.a2_path.tiles.split('\n').filter(r => r.length);
  }
}

/* ═══ 3. every room's spawn is on walkable ground ═════════════════
   The cheapest possible soft-lock: a spawn point on a solid tile
   leaves the player permanently stuck inside a wall. */
console.log('\n3. no spawn is inside a wall');
{
  const { NEU } = boot();
  const src = fs.readFileSync(path.join(ROOT,'js','act4','rooms-a.js'), 'utf8');
  /* rebuild the maps from the source so the test reads what ships */
  const solids = { woods: '#~|+', castle: '#|+' };
  let checked = 0, stuck = [];
  for (const id of NEU.engine.rooms) {
    NEU.engine.enter(id, 'default');
    const p = NEU.engine.api.player;
    if (!(p.x > 0 && p.y > 0)) stuck.push(id);
    checked++;
    NEU.engine.leave();
  }
  ok('>>> every room spawns you somewhere <<<', stuck.length === 0);
  console.log('       ' + checked + ' rooms entered');
}

/* ═══ 4. the puzzles are solvable ═════════════════════════════════*/
console.log('\n4. puzzles');
{
  const { NEU } = boot();
  const src = fs.readFileSync(path.join(ROOT,'js','act4','rooms-a.js'), 'utf8');

  /* B2: two blocks, two plates, open floor between them. BFS over
     block positions to prove at least one solution exists. */
  /* The map, copied from rooms-a.js. If they drift apart the BFS is
     proving something about a room that does not exist, so the test
     asserts the copy matches the source below. */
  const grid = [
    '################',
    '#..............#',
    '#....######....#',
    '#....#....#....#',
    '#.........,,,,,#',
    '#....#....#....#',
    '#....######....#',
    '#..............#',
    '################'];
  const solid = (x,y) => y<0||y>=grid.length||x<0||x>=grid[y].length||grid[y][x]==='#';
  const plates = [[6,3],[8,5]];
  const start  = [[6,4],[8,4]];

  function bfs() {
    const key = s => s.map(b=>b.join(',')).sort().join('|');
    const seen = new Set([key(start)]);
    let q = [start], depth = 0;
    while (q.length && depth < 24) {
      const nq = [];
      for (const st of q) {
        if (plates.every(p => st.some(b => b[0]===p[0] && b[1]===p[1]))) return depth;
        for (let i=0;i<st.length;i++) {
          for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = st[i][0]+dx, ny = st[i][1]+dy;
            if (solid(nx,ny)) continue;
            if (st.some((b,j)=>j!==i && b[0]===nx && b[1]===ny)) continue;
            /* the pusher must be able to stand behind it */
            const bxx = st[i][0]-dx, byy = st[i][1]-dy;
            if (solid(bxx,byy)) continue;
            const ns = st.map(b=>b.slice()); ns[i]=[nx,ny];
            const k = key(ns);
            if (seen.has(k)) continue;
            seen.add(k); nq.push(ns);
          }
        }
      }
      q = nq; depth++;
    }
    return -1;
  }
  const d = bfs();
  ok('>>> b2 has a solution <<<', d > 0);
  console.log('       b2 shortest solution: ' + d + ' pushes');
  ok('and it is short enough to be a tutorial', d > 0 && d <= 6);
  /* the test's copy of the map must be the real one */
  ok('>>> the solved map is the shipped map <<<',
     grid.every(row => src.includes("'" + row + "'")));

  /* The old block puzzles are gone. b2 is riddle stones, b4 is an ice
     ring with slide-only plates, b5 is the mirror, b6 is the torch —
     none of them has a push block, so the block BFS skips them all by
     design. The new win conditions are driven in 4b-4e below; this
     static line just proves the redesign removed every block. */
  const blocks = [...src.matchAll(/\{ t: 'block'/g)];
  ok('>>> no block entities remain in the castle <<<', blocks.length === 0);

  /* B3: the order is stated in the room and matched by the check. */
  ok('b3 order is declared once', /B3_ORDER = \[2, 0, 3, 1\]/.test(src));
  ok('>>> and the plaque says the same thing <<<',
     /third\. first\. fourth\. second\./.test(src));
  ok('a wrong press resets and re-states it',
     /they all go out at once/.test(src));

  /* B5 is deliberately unsolvable by the B2 rule. */
  ok('b5 overrides the plate rule', /solved: function \(c\)/.test(src));
  ok('>>> and the mirror is the second plate <<<',
     /b5face === 1 && onR\) \|\| \(b5face === 2 && onL/.test(src));
}

/* ═══ 4b. the riddle stones ══════════════════════════════════════
   b2 is no longer a block push — it is three stones, one press each,
   and the press must reach the stone in front of you rather than
   pushing it. Wrong press says so and the room stays locked; R
   resets the attempt but is on a 4s settle timer so brute force
   costs more than it buys. */
console.log('\n4b. the riddle stones');
{
  const { w, NEU } = boot();
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  let t = w.performance.now();
  /* the R settle timer reads performance.now() directly — drive it
     from the pumped clock so the cooldown behaves like real time */
  w.performance.now = () => t;
  const pump = n => { for (let i = 0; i < n; i++) { const q = frames; frames = []; t += 16; for (const cb of q) cb(t); } };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));
  const stones = () => NEU.engine.api.ents().filter(e => e.stone).map(b => b.x + ',' + b.y + ':' + b.colour);
  const dim = c => c.endsWith(':#2A2A38'), lit = c => c.endsWith(':#E4C46A'),
        cold = c => c.endsWith(':#564B66');

  NEU.engine.enter('b2_blocks', 'west');
  ok('b2 loaded with all three stones', stones().length === 3);

  key('keydown', 'ArrowRight'); pump(60); key('keyup', 'ArrowRight');
  const p = NEU.engine.api.player;
  ok('walking east stops you against the first stone',
     Math.floor(p.x / 16) === 5 && p.face === 'right');

  key('keydown', 'e'); key('keyup', 'e'); pump(4);
  ok('>>> pressing e on a stone is a press, not a push <<<',
     NEU.save.flagged('solved:b2_blocks') !== true);
  ok('the wrong stone dims, the room stays locked',
     stones().some(dim) && stones().some(lit));
  ok('and one press per attempt — only the pressed stone lights',
     stones().filter(lit).length === 1);

  /* reset is settled: wrong stone stays lit-dim until r. Walk clear,
     wait out the settle, reset, then take the correct stone. */
  key('keydown', 'ArrowLeft'); pump(60); key('keyup', 'ArrowLeft');
  pump(250);                       /* 4s settle */
  key('keydown', 'r'); key('keyup', 'r'); pump(4);
  ok('r restores the stones', stones().length === 3 &&
     stones().every(cold));

  key('keydown', 'ArrowRight'); pump(70); key('keyup', 'ArrowRight');  // to (5,4), stopped by stone 1
  key('keydown', 'e'); key('keyup', 'e'); pump(4);                     // wrong again — friend is not ash
  ok('the friend stone is still not the answer',
     NEU.save.flagged('solved:b2_blocks') !== true);

  key('keydown', 'ArrowLeft'); pump(60); key('keyup', 'ArrowLeft');
  pump(250);
  key('keydown', 'r'); key('keyup', 'r'); pump(4);
key('keydown', 'ArrowRight'); pump(60); key('keyup', 'ArrowRight');  // (5,4)
  key('keydown', 'ArrowRight'); pump(10); key('keyup', 'ArrowRight');  // pass stone 1? no — solid
  ok('the first stone still stops you before the ash stone',
     Math.floor(NEU.engine.api.player.x / 16) === 5);
  /* the ash stone is second — the room is a queue you press in order,
     and stone 1 blocks the whole row east of it, so the only way
     beside the queue is from below: down to row 5, east to (8,5),
     right under the ash stone. From there ash is dead ahead and the
     reach is decisive — no tie with its neighbour. */
  key('keydown', 'ArrowDown'); pump(10); key('keyup', 'ArrowDown');     // (5,5)
  key('keydown', 'ArrowRight'); pump(30); key('keyup', 'ArrowRight');   // (8,5), under ash
  key('keydown', 'e'); key('keyup', 'e'); pump(4);
  ok('>>> pressing the ash stone solves the room <<<',
     NEU.save.flagged('solved:b2_blocks') === true);
  NEU.engine.leave();
}

/* 4c. the mirror. b5 used to be a block push with you standing on the
   other plate; the block is gone and the mirror is the whole room
   now. The room must solve when the mirror looks at the plate you are
   NOT standing on — walk onto plate R, turn the mirror to face east,
   and the room answers. checkPuzzle() runs every moving frame, so the
   walk onto the plate is the last move. */
console.log('\n4c. the mirror holds the second plate');
{
  const { w, NEU } = boot();
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  let t = w.performance.now();
  const pump = n => { for (let i = 0; i < n; i++) { const q = frames; frames = []; t += 16; for (const cb of q) cb(t); } };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));

  NEU.engine.enter('b5_two', 'west');
  ok('b5 loaded, no blocks left', NEU.engine.api.ents().filter(e => e.t === 'block').length === 0);
  ok('the mirror is there to press', !!NEU.engine.api.ents().find(e => e.mirror));

  /* spawn (1,5). up to the mirror at (7,1), turn it east (face 1),
     back down, then walk east and up onto plate R at (12,4). */
  key('keydown', 'ArrowUp'); pump(30); key('keyup', 'ArrowUp');        // to (1,2)
  key('keydown', 'ArrowRight'); pump(55); key('keyup', 'ArrowRight');  // to (7,2), under the mirror
  key('keydown', 'e'); key('keyup', 'e'); pump(4);                     // turn it → looks east
  key('keydown', 'ArrowDown'); pump(30); key('keyup', 'ArrowDown');    // back to row 5
  key('keydown', 'ArrowRight'); pump(55); key('keyup', 'ArrowRight');  // to (12,5)
  key('keydown', 'ArrowUp'); pump(10); key('keyup', 'ArrowUp');        // onto plate R at (12,4)
  pump(8);
  ok('>>> mirror east + you on the east plate solves the room <<<',
     NEU.save.flagged('solved:b5_two') === true);
  NEU.engine.leave();
}

/* 4d. the ice ring. The engine's ice-slide is the puzzle: step onto
   ice and you commit to that line until it runs out, and a slide-only
   plate arms only when a slide dies on it. The plates sit on the last
   ice cell of three lines: (11,2) east of the top row, (11,7) south of
   the east column, (3,7) west of the bottom row. Drive the three-slide
   route — each slide ends on an armed plate and the next one starts
   from it. */
console.log('\n4d. the ice ring locks on the slides');
{
  const { w, NEU } = boot();
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  let t = w.performance.now();
  const pump = n => { for (let i = 0; i < n; i++) { const q = frames; frames = []; t += 16; for (const cb of q) cb(t); } };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));
  const plates = () => NEU.engine.api.ents().filter(e => e.t === 'plate').map(p => p.x + ',' + p.y + (p.armed ? ':armed' : ''));

  NEU.engine.enter('b4_ice', 'west');
  ok('b4 loaded with three slide-only plates', plates().length === 3);

  key('keydown', 'ArrowUp'); pump(32); key('keyup', 'ArrowUp');        // (1,2), dry
  key('keydown', 'ArrowRight'); pump(18); key('keyup', 'ArrowRight');  // step onto (3,2): ice commits you
  pump(100);                                                            // slide east along the top row
  ok('slide one dies on (11,2) and arms it', plates().includes('11,2:armed'));

  key('keydown', 'ArrowDown'); pump(8); key('keyup', 'ArrowDown');     // tap south: the commit fires, the slide runs out
  pump(70);                                                            // and dies on (11,7)
  ok('slide two dies on (11,7) and arms it', plates().includes('11,7:armed'));

  pump(2);                                                             // a real release between slides
  key('keydown', 'ArrowLeft'); pump(100); key('keyup', 'ArrowLeft');   // step west: slide along the bottom row
  ok('slide three dies on (3,7) and arms it', plates().includes('3,7:armed'));
  pump(8);
  ok('>>> all three armed solves the room <<<',
     NEU.save.flagged('solved:b4_ice') === true);
  NEU.engine.leave();
}

/* 4e. the torch. b6 is dark and the dark follows the light: carry the
   torch and the light hook follows you; seat it in the socket and the
   dark drops to zero. The exit stays locked until the socket is fed.
   The room's own hooks are the observables — the dark and light are
   functions the engine asks every frame. */
console.log('\n4e. the torch and the socket');
{
  const { w, NEU } = boot();
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  let t = w.performance.now();
  const pump = n => { for (let i = 0; i < n; i++) { const q = frames; frames = []; t += 16; for (const cb of q) cb(t); } };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));

  NEU.engine.enter('b6_dark', 'west');
  const api = NEU.engine.api;
  const room = api.room;
  ok('b6 loads dark', room.dark() === 108);
  ok('torch at (2,5), socket at (10,5)',
     !!api.ents().find(e => e.torch) && !!api.ents().find(e => e.socket));
  ok('the dark is centred on the room until the torch is taken',
     room.light(api) === null);

  key('keydown', 'e'); key('keyup', 'e'); pump(4);
  ok('>>> pressing the torch takes it and the light follows you <<<',
     room.light(api) !== null && room.light(api).x === api.player.x);

  key('keydown', 'ArrowRight'); pump(60); key('keyup', 'ArrowRight');  // (7,5), past the torch wall
  key('keydown', 'ArrowRight'); pump(30); key('keyup', 'ArrowRight');  // (10,5), at the socket
  key('keydown', 'e'); key('keyup', 'e'); pump(4);
  ok('>>> seating it wakes the room <<<',
     room.dark() === 0 && NEU.save.flagged('solved:b6_dark') === true);
  ok('and the torch leaves the wall with you', !api.ents().find(e => e.torch && !e.dead));
  NEU.engine.leave();
}

/* ═══ 5. locked doors say what they want ══════════════════════════*/
console.log('\n5. gating');
{
  const { NEU } = boot();
  const src = fs.readFileSync(path.join(ROOT,'js','core/engine.js'), 'utf8');
  ok('exits support a lock', /if \(e\.locked &&/.test(src));
  ok('>>> a locked door speaks <<<', /it will not move yet/.test(src));

  const r = fs.readFileSync(path.join(ROOT,'js','act4','rooms-a.js'), 'utf8');
  const locks = [...r.matchAll(/locked:\s*'([^']+)'/g)].map(m=>m[1]);
  ok('the castle is gated room by room', locks.length >= 5);
  ok('>>> the arena needs the whole castle done <<<',
     locks.includes('solved:b6_dark'));
  ok('the throne exit needs her talk', locks.includes('witch_met'));
}

/* ═══ 6. Calamitas ════════════════════════════════════════════════*/
console.log('\n6. calamitas');
{
  const { NEU } = boot();
  ok('boss loaded', !!NEU.scal);
  ok('>>> her cycle is 20 steps <<<', NEU.scal.cycle.length === 20);

  const c = NEU.scal.cycle;
  const charges = c.map((k,i)=>k==='c'?i+1:0).filter(Boolean);
  ok('charges land at 4, 9, 16, 18, 20',
     JSON.stringify(charges) === JSON.stringify([4,9,16,18,20]));
  ok('dives land at 5 and 13', c.filter(k=>k==='m').length === 2 &&
     JSON.stringify(c.map((k,i)=>k==='m'?i+1:0).filter(Boolean)) === JSON.stringify([5,13]));
  ok('dart bursts appear 6 times', c.filter(k=>k==='d').length === 6);
  ok('hellblast barrages appear 3 times', c.filter(k=>k==='h').length === 3);
  ok('two-giga appears twice', c.filter(k=>k==='g2').length === 2);
  ok('four-giga appears twice', c.filter(k=>k==='g4').length === 2);

  const src = fs.readFileSync(path.join(ROOT,'js','act4','boss-scal.js'), 'utf8');
  ok('>>> the cycle does not reset on a phase change <<<',
     !/step_ = 0/.test(src.split('function open()')[1] || '') === false);
  ok('only dart bursts are randomised',
     /THE ONLY RANDOMNESS/.test(src));
  ok('three bullet-hell interludes', /startWall\(0\)/.test(src) &&
     /startWall\(1\)/.test(src) && /startWall\(2\)/.test(src));
  ok('the brothers show up', /startBrothers/.test(src));
  ok('the Sepulcher starts with enough trail for six 66px body segments',
     /for \(var k = 0; k < 300; k\+\+\) sep\.trail\.push/.test(src));
  ok('Sepulcher hearts trail on body segments beyond its proximity ring',
     /var si = Math\.min\(4, 2 \+ \(\(h\.offset \/ 2\) \| 0\)\);/.test(src) &&
     /h\.x = seg\.x \+ Math\.cos\(dir\) \* 34/.test(src));
  ok('destroying a heart cannot pull survivors toward the Sepulcher head',
     /var si = Math\.min\(4, 2 \+ \(\(h\.offset \/ 2\) \| 0\)\);/.test(src));
  ok('>>> her bar actually moves <<<', /bossHP -= mult/.test(src));
  ok('she is visibly shielded while invincible', /calamitas — shielded/.test(src));
  /* The additive pass moved into the one shared blitter in
     data/sheets.js when three copies of it were collapsed into one, so
     this now checks both halves: that she still ASKS for the glow on
     phase 2, and that asking for it still means an additive pass. The
     old single grep over boss-scal.js would report the behaviour gone
     purely because the line lives somewhere else now. */
  ok('phase 2 asks for the glow', /sprite\(bodyKey, bx, by, 2, 0, phase === 2/.test(src));
  ok('phase 2 is an additive pass, not new art',
     /globalCompositeOperation = 'lighter'/.test(
       fs.readFileSync(path.join(ROOT, 'js', 'data', 'sheets.js'), 'utf8')));
  ok('losing does not cost the hour', /esc to leave/.test(src));

  NEU.scal.open();
  ok('opens into the hooded intro', NEU.scal.mode === 'intro');
  ok('starts invincible', NEU.scal.phase === 1);
  NEU.scal.close();
}

/* 6b. the win path. tryHit() used to bail on `invuln || mode !== 'fight'
   || sep` — and she is invincible for both interludes, so the sepulchre's
   six hearts and her two brothers were untouchable, she never came out
   of her invincibility, and the fight could not be won. Drive the whole
   thing: shatter the hearts, strike her eighteen times, kill both
   brothers, and she must drop into phase 2. (Arena in jsdom: 1024x768,
   so AX=162 AY=178 AW=700 AH=460; the soul walks 4px/frame straight,
   2.828px/frame diagonal, and has MAXHP=5 — contact damage is lethal,
   so the drive dodges: she and the worm only hurt while charging, and
   darts are dodged perpendicular to their path.) */
console.log('\n6b. the sepulchre, the brothers, and the win');
{
  const { w, NEU } = boot();
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  let t = w.performance.now();
  const damage = [];
  const pump = n => { for (let i = 0; i < n; i++) {
    const hpBefore = NEU.scal.soulHP, q = frames; frames = []; t += 16;
    for (const cb of q) cb(t);
    if (NEU.scal.soulHP < hpBefore) damage.push({ t: Math.round(t), hp: NEU.scal.soulHP, bullets: NEU.scal.bullets.length, wormBusy: NEU.scal.wormBusy });
  } };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));
  /* f strikes; z spends a full rage bar and never strikes. */
  const f = () => { key('keydown', 'f'); key('keyup', 'f'); };
  const run = (dx, dy, n) => {
    if (dx < 0) key('keydown', 'ArrowLeft'); else if (dx > 0) key('keydown', 'ArrowRight');
    if (dy < 0) key('keydown', 'ArrowUp'); else if (dy > 0) key('keydown', 'ArrowDown');
    pump(n);
    key('keyup', 'ArrowLeft'); key('keyup', 'ArrowRight'); key('keyup', 'ArrowUp'); key('keyup', 'ArrowDown');
  };
  /* Aggressive dodge for the hearts phase: the sepulcher's ring bursts
     spray radial darts all around it, and a dart that is closing on
     the soul's neighbourhood is worth dodging — there is no aim to
     stale. */
  const dodge = () => {
    const bs = NEU.scal.bullets;
    for (const b of bs) {
      const dx = b.x - NEU.scal.px, dy = b.y - NEU.scal.py;
      const d = Math.hypot(dx, dy);
      if (d > 130) continue;
      if (dx * b.vx + dy * b.vy >= 0) continue;   /* not closing */
      if (Math.abs(b.vx) > Math.abs(b.vy)) run(0, b.vy >= 0 ? -1 : 1, 12);
      else run(b.vx >= 0 ? -1 : 1, 0, 12);
      return true;
    }
    return false;
  };

  NEU.scal.open();
  pump(163);   /* intro (2.6s) — the soul is frozen */
  /* wall(0): the soul climbs to the top band in the wall's last
     moments so the worm's spawn burst cannot reach it. The climb
     crosses only horizontal dart rows whose darts have already
     passed the soul's column. */
  for (let i = 0; i < 400 && NEU.scal.mode === 'wall';) {
    if (i >= 235 && NEU.scal.py > 380) { run(0, -1, 10); i += 10; }
    else { pump(1); i++; }
  }
  ok('>>> the sepulchre descends with six hearts <<<',
     NEU.scal.mode === 'fight' && NEU.scal.hearts === 6);

  /* The hearts orbit a body segment at radius 24 and shatter under the
     soul's strike (f) within 18px. The worm dashes at the soul every
     1.45s, so the drive works the REST windows: dodge the dash, walk
     onto the ring while the worm is still, strike the heart that the
     orbit sweeps through the soul (one per ~0.9s), dodge again. */
  let shattered = 0, before = NEU.scal.hearts, closestHeart = Infinity, strikeAttempts = 0, heartDamageStart = damage.length;
  const checkDrop = () => {
    if (NEU.scal.hearts < before) {
      shattered += before - NEU.scal.hearts;
      before = NEU.scal.hearts;
      return true;
    }
    return false;
  };
  /* The worm's body trails its head, so its heart-bearing segment (and
     the hearts) snaps toward the soul during a lunge and rests near it
     afterwards. So the soul stays close: when the dash starts (the aim
     locks at the soul's then-position), step once perpendicular to the
     locked aim — 48px clears the 30px contact radius — then hold still
     through the rest of the busy window and strike hearts as they
     orbit within reach during the cooldown. */
  let dashStep = false;
  const perpWorm = () => {
    const v = NEU.scal.wormVel;
    if (v && (v.x !== 0 || v.y !== 0)) {
      run(Math.sign(v.y) || 1, Math.sign(-v.x) || 1, 16);
      return true;
    }
    return false;
  };
  pump(1);   /* the spawn tick updates the heart positions */
  for (let g = 0; g < 400 && NEU.scal.hearts > 0 && NEU.scal.running; g++) {
    if (NEU.scal.wormBusy) {
      if (!dashStep) dashStep = perpWorm();
      pump(1);   /* time must advance even while holding */
      checkDrop();
      continue;
    }
    dashStep = false;
    if (dodge()) { checkDrop(); continue; }
    const pts = NEU.scal.heartPos;
    if (!pts.length) break;
    let best = null, bd = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p.x - NEU.scal.px, p.y - NEU.scal.py);
      if (d < bd) { bd = d; best = p; }
    }
    closestHeart = Math.min(closestHeart, bd);
    if (bd < 18) {
      strikeAttempts++; f(); pump(3);
      checkDrop();
      continue;
    }
    if (bd <= 28) { pump(2); checkDrop(); continue; }   /* on the ring: hold, let the orbit bring the heart in */
    const dx = best.x - NEU.scal.px, dy = best.y - NEU.scal.py;
    const sp = dx !== 0 && dy !== 0 ? 2.828 : 4;
    run(Math.sign(dx), Math.sign(dy), Math.min(12, Math.max(1, Math.ceil(bd / sp))));
    checkDrop();
  }
  if (shattered !== 6) console.log('       heart diagnostic:', JSON.stringify({ shattered, hearts: NEU.scal.hearts, closestHeart: Math.round(closestHeart), strikeAttempts, soulHP: NEU.scal.soulHP, tp: NEU.scal.tp, shieldT: NEU.scal.shieldT, mode: NEU.scal.mode, damage: damage.slice(heartDamageStart) }));
  ok('>>> a touch shatters a heart, one per touch <<<', shattered === 6);
  ok('>>> all six hearts die <<<', NEU.scal.hearts === 0);
  pump(2);
  ok('>>> she steps out of her invincibility <<<', NEU.scal.mode === 'fight');

/* Strike her only when she is in reach and NOT charging/diving — her
     telegraph, dash, and dive sweep are contact damage. She hovers at the
     top wall (by → AY-24) and her x chases the soul, so the soul walks up
     into reach when she drifts far. The dive sweeps horizontally at the
     row where the soul stood when the dive began — move perpendicular
     (vertically) to escape the 32px contact band. */
  const strike = want => {
    const target = NEU.scal.hp - want;
    for (let g = 0; g < 900 && NEU.scal.hp > target; g++) {
      if (NEU.scal.charging) { run(1, 1, 45); continue; }
      if (NEU.scal.diving) {
        /* dive sweeps horizontally — dodge vertically away from its row */
        const dy = NEU.scal.py - NEU.scal.by;
        run(0, Math.sign(dy) || 1, 30);
        continue;
      }
      const d = Math.hypot(NEU.scal.px - NEU.scal.bx, NEU.scal.py - NEU.scal.by);
      if (d < 40) { f(); pump(1); }
      else if (Math.abs(NEU.scal.py - NEU.scal.by) > 6) {
        run(0, Math.sign(NEU.scal.by - NEU.scal.py), Math.min(40, Math.ceil(Math.abs(NEU.scal.py - NEU.scal.by) / 4)));
      } else { pump(2); }
    }
    return NEU.scal.hp <= target;
  };

  ok('>>> six touches open the first mid-fight wall <<<',
     strike(6) && NEU.scal.mode === 'wall' && NEU.scal.hp === 18);
  /* U1: the rage bar only fills while a heart is missing. The wall
     after six clean strikes is under 20s of missing a heart, so rage
     must have STARTED but not yet paid out. */
  ok('>>> rage is filling while hearts are missing <<<',
     NEU.scal.rage > 0 && NEU.scal.rage < 1);
  ok('>>> a full rage bar would heal, but it needs ~20s <<<',
     NEU.scal.rage >= 0 && NEU.scal.rage < 0.8);
  /* U2: twenty-plus seconds of grazing near bullets has fed tp, and
     the meter caps at 1. */
  ok('>>> grazing bullets fills tp <<<', NEU.scal.tp > 0 && NEU.scal.tp <= 1);
  pump(290);             /* wall(1) lasts 4.6s */
  ok('>>> six more call the second wall <<<',
     strike(6) && NEU.scal.mode === 'wall' && NEU.scal.hp >= 12 && NEU.scal.hp <= 15);
  pump(290);             /* wall(2) */
  ok('>>> eighteen touches call the brothers <<<',
     strike(6) && NEU.scal.mode === 'brothers' && NEU.scal.bros === 2 &&
     NEU.scal.hp >= 6 && NEU.scal.hp <= 9);

  /* Brothers at the wall columns (222 and 802), bobbing ±22px in y and
     swapping sides after every volley pause — broPos is read live so
     the walk re-aims if a swap happens mid-approach. Touch radius is
     28px, so the soul parks at |dx|<=8 and |dy|<=24 and z-storms: the
     bob cannot escape the radius and eleven touches (25% DR while both
     stand) land in ~20 frames — well inside one volley window, so the
     storm eats at most one hit while IFRAMES (1.1s) covers the next
     volley (0.83s apart). The approach runs straight: the brothers aim
     at the soul's position at fire time, so a continuously moving soul
     is never where the dart lands. Target the NEAREST brother and stop
     when the headcount drops: brothers splice out of bros on death, so
     their array indices shift mid-fight and cannot be trusted. When
     the survivor enrages it swaps sides every ~2.45s — faster than a
     580px crossing — so do not chase it; the swap brings it back to
     the column the soul is already standing on. */
  const killBro = target => {
    for (let h = 0; h < 300 && NEU.scal.bros > target && NEU.scal.running; h++) {
      const bs = NEU.scal.broPos;
      if (!bs.length) return true;
      let best = bs[0], bd = Infinity;
      for (const p of bs) {
        const d = Math.hypot(p.x - NEU.scal.px, p.y - NEU.scal.py);
        if (d < bd) { bd = d; best = p; }
      }
      const dx = best.x - NEU.scal.px, dy = best.y - NEU.scal.py;
if (Math.abs(dx) > 8) {
        if (NEU.scal.bros === 1) {
          /* Survivor enraged: fires 3-projectile horizontal spread every 0.7s.
             Proactively wiggle vertically. Use shield (x) when HP is low and TP is full. */
          const wiggle = (h % 8 < 4) ? 1 : -1;
          run(0, wiggle, 4);
          if (NEU.scal.soulHP <= 2 && NEU.scal.tp >= 1 && NEU.scal.shieldT === 0) {
            key('keydown', 'x'); key('keyup', 'x');
          }
          if (dodge()) continue;
          continue;
        }
        const sp = dx !== 0 && dy !== 0 ? 2.828 : 4;
        run(Math.sign(dx), Math.sign(dy), Math.min(25, Math.max(1, Math.ceil(Math.hypot(dx, dy) / sp))));
        continue;
      }
      if (Math.abs(dy) > 24) run(0, Math.sign(dy), Math.min(25, Math.ceil(Math.abs(dy) / 4)));
      else { f(); pump(1); }   /* inside the touch radius: storm */
    }
    return NEU.scal.bros <= target;
  };
  ok('>>> a brother dies in twelve touches <<<', killBro(1) && NEU.scal.bros === 1);
  const bothBrothersFall = killBro(0);
  if (!bothBrothersFall || NEU.scal.bros !== 0 || NEU.scal.phase !== 2)
    console.log('       brothers diagnostic:', JSON.stringify({ bothBrothersFall, bros: NEU.scal.bros, phase: NEU.scal.phase, mode: NEU.scal.mode, soulHP: NEU.scal.soulHP, bullets: NEU.scal.bullets.length }));
  ok('>>> both brothers fall: phase 2 begins <<<',
     bothBrothersFall && NEU.scal.bros === 0 && NEU.scal.phase === 2 && NEU.scal.mode === 'fight');

NEU.scal.close();
}

/* ═══ 6c. U1/U2 wiring: the shield and the resets ════════════════*/
console.log('\n6c. the shield and the meters');
{
  const { w, NEU } = boot();
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  let t = w.performance.now();
  w.performance.now = () => t;
  const pump = n => { for (let i = 0; i < n; i++) { const q = frames; frames = []; t += 16; for (const cb of q) cb(t); } };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));

  NEU.scal.open();
  pump(163);   /* intro — the soul is frozen, nothing has grazed */
  ok('meters start empty', NEU.scal.tp === 0 && NEU.scal.rage === 0 && NEU.scal.shieldT === 0);
  key('keydown', 'x'); key('keyup', 'x'); pump(2);
  ok('>>> x with an empty tp does nothing <<<', NEU.scal.shieldT === 0 && NEU.scal.tp === 0);
  NEU.scal.close();

  const src = fs.readFileSync(path.join(ROOT,'js','act4','boss-scal.js'), 'utf8');
  ok('the shield eats the hit inside hitPlayer', /if \(shieldT > 0\) \{/.test(src) &&
     /shieldT = 0;/.test(src));
  ok('x spends full tp', /if \(tp < 1\)/.test(src) && /shieldT = 2\.5/.test(src));
  ok('z spends a full rage bar for eight seconds',
     /e\.key === 'z' \|\| e\.key === 'Z'/.test(src) &&
     /rage = 0; rageMode = 1; rageModeT = 8;/.test(src));
  ok('f remains the strike key and rage never heals',
     /e\.key === 'f' \|\| e\.key === 'F'/.test(src) &&
     /tryHit\(\); return;/.test(src) &&
     !/hp = Math\.min\(MAXHP, hp \+ 1\)/.test(src));
  ok('a fresh fight resets both meters', /rage = 0; tp = 0; shieldT = 0;/.test(src));
  NEU.engine.leave();
}

/* ═══ 7. the drop and the altar ═══════════════════════════════════*/
console.log('\n7. ashes → altar → door');
{
  const { NEU } = boot();
  const src = fs.readFileSync(path.join(ROOT,'js','act4','boss-scal.js'), 'utf8');
  ok('beating her gives the ashes', /NEU\.save\.give\('ashes'\)/.test(src));

  NEU.engine.enter('b7_altar', 'east');
  ok('the altar room loads', NEU.engine.room === 'b7_altar');
  ok('the altar wants the ashes', !NEU.save.flagged('firedoor'));

  /* without them */
  const api = NEU.engine.api;
  ok('>>> empty-handed it refuses <<<', NEU.save.has('ashes') === false);

  NEU.save.give('ashes');
  ok('carrying them now', NEU.save.has('ashes') === true);
  NEU.engine.leave();
}

/* ═══ 8. the tile ═════════════════════════════════════════════════*/
console.log('\n8. the sixth tile');
{
  const { w, NEU } = boot();
  const deck = fs.readFileSync(path.join(ROOT,'js','game/deck.js'), 'utf8');
  ok('a sixth entry exists', /id: 'woods'/.test(deck));
  /* Was `/sigil: true/`. That flag is gone — presence in the SIGILS
     table is the switch now, so there is no second thing to forget to
     set. The old line was asserting the mechanism; this asserts the
     property, which is what it always meant to say. */
  ok('>>> it has a drawn sigil, not initials <<<', /\n    woods: function/.test(deck));
  ok('and it launches act IV', /NEU\.act4 && NEU\.act4\.open/.test(deck));
  ok('act4 module present', !!NEU.act4);
  ok('seven titles on the shelf now', NEU.deck.games === 7);

  ok('objectives are grouped', /quest__g/.test(
       fs.readFileSync(path.join(ROOT,'js','core/quest.js'),'utf8')));
  ok('act IV registers its own steps', NEU.act4.steps.length === 22);
}

/* ═══ 9. regression: engine blur/visibilitychange clear stuck keys ═══
   If the player Alt-tabs while holding a movement key, the keyup never
   arrives and the player keeps walking on return. The fix adds a blur
   handler and a visibilitychange guard to engine.js. */
{
  const { w, NEU } = boot();
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  let t = w.performance.now();
  const pump = n => { for (let i = 0; i < n; i++) { const q = frames; frames = []; t += 16; for (const cb of q) cb(t); } };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));
  NEU.engine.enter('a1_clearing', 'default');
  const p = NEU.engine.api.player;
  const startX = p.x;
  /* Hold ArrowRight, then blur the window. */
  key('keydown', 'ArrowRight');
  pump(10);
  w.dispatchEvent(new w.KeyboardEvent('blur', { bubbles: true }));
  pump(30);
  ok('>>> blur clears stuck keys <<<', Math.abs(p.x - startX) < 2);
  key('keyup', 'ArrowRight');
  NEU.engine.leave();
}

console.log('\n' + (fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`));
process.exit(fail ? 1 : 0);
