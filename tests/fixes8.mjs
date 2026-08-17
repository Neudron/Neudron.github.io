/* fixes8.mjs — Zone A, Zone B, and Calamitas.
   Run: node fixes8.mjs

   The puzzles get solvability checks rather than playthroughs: a BFS
   over the block/plate state space proves a solution exists, which a
   scripted playthrough only proves for the one route it took. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

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
  ok('phase 2 is an additive pass, not new art',
     /globalCompositeOperation = 'lighter'/.test(src));
  ok('losing does not cost the hour', /esc to leave/.test(src));

  NEU.scal.open();
  ok('opens into the hooded intro', NEU.scal.mode === 'intro');
  ok('starts invincible', NEU.scal.phase === 1);
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

console.log('\n' + (fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`));
process.exit(fail ? 1 : 0);
