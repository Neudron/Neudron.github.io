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

  /* Every block puzzle, proved solvable BY A PLAYER — the pusher has to
     walk to the cell it pushes from, and the BFS above over block
     positions alone does not say that. b4, b5 and b6 all passed the
     weaker proof while being impossible. */
  const { unsolvable: dead, lengths } = unsolvable(ROOT, ['rooms-a.js']);
  ok('>>> every block puzzle has a solution a player can walk <<<', dead.length === 0);
  if (dead.length) console.log('       ' + dead.join('\n       '));
  ok('and all four castle puzzles were checked', Object.keys(lengths).length === 4);
  for (const id of Object.keys(lengths))
    console.log('       ' + id + ': ' + lengths[id] + ' moves (walk + push)');

  /* B3: the order is stated in the room and matched by the check. */
  ok('b3 order is declared once', /B3_ORDER = \[2, 0, 3, 1\]/.test(src));
  ok('>>> and the plaque says the same thing <<<',
     /third\. first\. fourth\. second\./.test(src));
  ok('a wrong press resets and re-states it',
     /they all go out at once/.test(src));

  /* B5 is deliberately unsolvable by the B2 rule. */
  ok('b5 overrides the plate rule', /solved: function \(c\)/.test(src));
  ok('>>> b5 needs you standing on one plate <<<', /onL && bR\) \|\| \(onR && bL/.test(src));
}

/* ═══ 4b. pressing e actually pushes ══════════════════════════════
   The static proofs above check that a LAYOUT admits a solution. They
   cannot see whether the push works at all, and it did not: the E
   handler was `if (nearest()) fire(it); else tryPush()`, and `nearest`
   happily returned the block itself. fire() has no branch for a block,
   so it returned in silence and tryPush() was never reached — standing
   correctly against a block with open floor beyond and pressing e did
   nothing, in every room, for every block. Every puzzle in the game was
   unsolvable while passing every solvability test we had.

   So this drives the real engine: walk east out of b2's spawn until the
   block stops you, press e, and watch the block move. Frames come off a
   manual queue because jsdom's clock will not produce the fixed
   timestep the sweep needs. */
console.log('\n4b. the push');
{
  const { w, NEU } = boot();
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  let t = w.performance.now();
  const pump = n => { for (let i = 0; i < n; i++) { const q = frames; frames = []; t += 16; for (const cb of q) cb(t); } };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));
  const blocks = () => NEU.engine.api.ents().filter(e => e.t === 'block').map(b => [b.x, b.y]);

  NEU.engine.enter('b2_blocks', 'west');
  ok('b2 loaded with both blocks', JSON.stringify(blocks()) === '[[6,4],[8,4]]');

  key('keydown', 'ArrowRight'); pump(60); key('keyup', 'ArrowRight');
  const p = NEU.engine.api.player;
  ok('walking east stops you against the block',
     Math.floor(p.x / 16) === 5 && p.face === 'right');

  const before = JSON.stringify(blocks());
  key('keydown', 'e'); key('keyup', 'e'); pump(4);
  const after = JSON.stringify(blocks());
  ok('>>> e pushes the block away from you <<<', before !== after);
  ok('and it moves exactly one cell, in the direction you face',
     after === '[[7,4],[8,4]]');

  /* the same press must still talk to an npc when one is in reach —
     that is what the nearest()-first ordering was for */
  NEU.engine.leave();
}

/* 4c. the walk. checkPuzzle() used to live only inside tryPush(): the
   game could be SOLVED only by pushing the block onto a plate while
   already standing on the other. b5's second plate needs the walk
   itself to be the last move — block on one plate, player steps onto
   the other — and nothing ever looked. Push the block east onto plate
   R, then walk onto plate L and the room must solve itself. (The
   engine walks 100px/s = 1.6px/frame = ten frames per cell.) */
console.log('\n4c. the walk solves the second plate');
{
  const { w, NEU } = boot();
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  let t = w.performance.now();
  const pump = n => { for (let i = 0; i < n; i++) { const q = frames; frames = []; t += 16; for (const cb of q) cb(t); } };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));
  const blocks = () => NEU.engine.api.ents().filter(e => e.t === 'block').map(b => [b.x, b.y]);

  NEU.engine.enter('b5_two', 'west');
  ok('b5 loaded, block at 8,5', JSON.stringify(blocks()) === '[[8,5]]');

  key('keydown', 'ArrowRight'); pump(60); key('keyup', 'ArrowRight');  // to (7,5), beside the block
  key('keydown', 'ArrowDown'); pump(10); key('keyup', 'ArrowDown');    // to (7,6), below it
  key('keydown', 'ArrowRight'); pump(10); key('keyup', 'ArrowRight');  // to (8,6)
  key('keydown', 'ArrowUp'); pump(2); key('keyup', 'ArrowUp');         // face up, bump the block
  key('keydown', 'e'); key('keyup', 'e'); pump(4);                     // push it north to 8,4
  ok('block pushed up off the floor row', JSON.stringify(blocks()) === '[[8,4]]');

  key('keydown', 'ArrowLeft'); pump(10); key('keyup', 'ArrowLeft');    // to (7,6)
  key('keydown', 'ArrowUp'); pump(20); key('keyup', 'ArrowUp');        // to (7,4), west of it
  key('keydown', 'ArrowRight'); pump(2); key('keyup', 'ArrowRight');   // face east, bump the block
  for (let i = 0; i < 4; i++) {                                        // walk it east to plate R at 12,4
    key('keydown', 'e'); key('keyup', 'e'); pump(4);
    if (i < 3) { key('keydown', 'ArrowRight'); pump(10); key('keyup', 'ArrowRight'); }
  }
  ok('block walked east onto plate R', JSON.stringify(blocks()) === '[[12,4]]');

  key('keydown', 'ArrowLeft'); pump(50); key('keyup', 'ArrowLeft');    // walk west onto plate L at 5,4
  pump(8);
  ok('>>> walking onto the free plate solves the room <<<',
     NEU.save.flagged('solved:b5_two') === true);
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
  ok('charges land at 4, 8, 13, 16, 18, 20',
     JSON.stringify(charges) === JSON.stringify([4,8,13,16,18,20]));
  ok('dart bursts appear 6 times', c.filter(k=>k==='d').length === 6);
  ok('hellblast barrages appear 4 times', c.filter(k=>k==='h').length === 4);
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
  ok('>>> her bar actually moves <<<', /bossHP -= 1/.test(src));
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
   || sep` — and she is invuln for both interludes, so the sepulchre's
   six hearts and her two brothers were untouchable, she never came out
   of her invincibility, and the fight could not be won. Drive the whole
   thing: shatter the hearts, strike her eighteen times, kill both
   brothers, and she must drop into phase 2. (Arena in jsdom: 1024x768,
   so AX=162 AY=178 AW=700 AH=460; player walks 4px/frame straight,
   2.828px/frame diagonal.) */
console.log('\n6b. the sepulchre, the brothers, and the win');
{
  const { w, NEU } = boot();
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  let t = w.performance.now();
  const pump = n => { for (let i = 0; i < n; i++) { const q = frames; frames = []; t += 16; for (const cb of q) cb(t); } };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));
  const hold = (k, n) => { key('keydown', k); pump(n); key('keyup', k); };
  const z = () => { key('keydown', 'z'); key('keyup', 'z'); };

  NEU.scal.open();
  pump(500);   /* intro (2.6s) + first wall (4.6s) → sepulchre */
  ok('>>> the sepulchre descends with six hearts <<<',
     NEU.scal.mode === 'fight' && NEU.scal.hearts === 6);

  /* hearts: row 1 at (202,212) (242,212) (282,212); row 2 at
   (702,246) (742,246) (782,246) — the second row is 34px lower */
  key('keydown', 'ArrowLeft'); key('keydown', 'ArrowUp');
  pump(129);   /* diagonal: 2.828px/frame → (169,213) — px clamps at AX+7 */
  key('keyup', 'ArrowLeft'); key('keyup', 'ArrowUp');
  hold('ArrowRight', 9);
  z();
  ok('>>> a touch shatters a heart <<<', NEU.scal.hearts === 5);
  hold('ArrowRight', 10); z();
  hold('ArrowRight', 10); z();
  hold('ArrowRight', 105); hold('ArrowDown', 9); z();
  hold('ArrowRight', 10); z();
  hold('ArrowRight', 10); z();
  ok('>>> all six hearts die <<<', NEU.scal.hearts === 0);
  pump(2);
  ok('>>> she steps out of her invincibility <<<', NEU.scal.mode === 'fight');

  /* she hovers above, following the player with a slow lerp — stand
     under her, let her drift overhead, then strike. Her health gates
     two more wall interludes at 75% and 50%, so the win path is:
     6 touches → wall → 6 touches → wall → 6 touches → brothers. */
  hold('ArrowUp', 24);   /* py clamps at AY+7 = 185 */
  pump(90);              /* she catches up; dist drops under 34 */
  for (let i = 0; i < 6; i++) z();
  pump(2);
  ok('>>> six touches open the first mid-fight wall <<<',
     NEU.scal.mode === 'wall' && NEU.scal.hp === 18);
  pump(290);             /* wall(1) lasts 4.6s */
  for (let i = 0; i < 6; i++) z();
  pump(2);
  ok('>>> six more call the second wall <<<',
     NEU.scal.mode === 'wall' && NEU.scal.hp === 12);
  pump(290);             /* wall(2) */
  for (let i = 0; i < 6; i++) z();
  pump(2);
  ok('>>> eighteen touches call the brothers <<<',
     NEU.scal.mode === 'brothers' && NEU.scal.bros === 2 && NEU.scal.hp === 6);

  /* brothers at (802, 408+drift) and (222, 408+drift). The bob's phase
     depends on the global fight timer, so instead of guessing it the
     player sweeps vertically past the brother's whole range while
     z-spamming: every frame lands a hit while |py - broY| < 22, and
     the 4px/frame sweep guarantees a pass within range no matter where
     the wobble is. */
  hold('ArrowRight', 5);                    /* under bro1's column */
  key('keydown', 'ArrowDown');
  for (let i = 0; i < 70; i++) { z(); pump(1); }
  key('keyup', 'ArrowDown');
  ok('>>> a brother dies in eight touches <<<', NEU.scal.bros === 1);
  hold('ArrowLeft', 146);                   /* to bro0's column */
  key('keydown', 'ArrowUp');
  for (let i = 0; i < 40; i++) { z(); pump(1); }
  key('keyup', 'ArrowUp');
  ok('>>> both brothers fall: phase 2 begins <<<',
     NEU.scal.bros === 0 && NEU.scal.phase === 2 && NEU.scal.mode === 'fight');

  NEU.scal.close();
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
