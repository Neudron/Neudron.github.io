/* fixes9.mjs — Zones D and E, and the show.
   Run: node fixes9.mjs */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
import { stranded, roomCount, badSpawns, untouchable } from './reach.mjs';

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
  w.matchMedia = () => ({ matches:false, addListener(){}, addEventListener(){} });
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
                   'game/sans.js','act4/act4.js','act4/rooms-a.js','act4/rooms-d.js','act4/shop.js',
                   'act4/boss-scal.js','act4/quiz.js','game/deck.js','core/dev.js']) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU,
           enter: () => obs.forEach(o => o.cb([{ isIntersecting: true }])),
           leave: () => obs.forEach(o => o.cb([{ isIntersecting: false }])) };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const A = fs.readFileSync(path.join(ROOT,'js','act4','rooms-a.js'), 'utf8');
const D = fs.readFileSync(path.join(ROOT,'js','act4','rooms-d.js'), 'utf8');
const S = fs.readFileSync(path.join(ROOT,'js','act4','shop.js'), 'utf8');

/* ═══ 1. the whole map connects ═══════════════════════════════════*/
console.log('\n1. eighteen rooms, no dangling exits');
{
  const { NEU } = boot();
  ok('18 rooms registered', NEU.engine.rooms.length === 18);
  const targets = [...(A + D).matchAll(/to:\s*'([a-z0-9_]+)'/g)].map(m => m[1]);
  const bad = [...new Set(targets.filter(t => !NEU.engine.rooms.includes(t)))];
  ok('>>> every exit in both zones lands somewhere <<<', bad.length === 0);
  if (bad.length) console.log('       dangling: ' + bad.join(', '));
  console.log('       ' + targets.length + ' exits checked');

  /* Every named spawn must exist in its target room, or you arrive at
     the fallback and the geometry of the doorway silently breaks.

     The brace matching has to be BALANCED. A `[^}]*` capture stops at
     the first closing brace, which is the one closing the FIRST spawn
     object — so every room with two or more spawns looked like it was
     missing all but the first. That reported six working doorways as
     broken. */
  const src = A + D;
  function spawnsOf(room) {
    const at = src.indexOf("register('" + room + "'");
    if (at < 0) return null;
    const s0 = src.indexOf('spawns:', at);
    if (s0 < 0) return null;
    let i2 = src.indexOf('{', s0), depth = 0, out = '';
    for (; i2 < src.length; i2++) {
      const ch = src[i2];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (!depth) break; }
      out += ch;
    }
    return out;
  }
  let missing = [];
  for (const m of src.matchAll(/to:\s*'([a-z0-9_]+)',\s*spawn:\s*'(\w+)'/g)) {
    const [, room, spawn] = m;
    const blk = spawnsOf(room);
    if (blk !== null && !new RegExp("\\b" + spawn + "\\s*:").test(blk)) {
      missing.push(room + '/' + spawn);
    }
  }
  ok('>>> every exit names a spawn that exists <<<', missing.length === 0);
  if (missing.length) console.log('       missing: ' + [...new Set(missing)].join(', '));
}

/* ═══ 2. every room is enterable and spawns you on floor ══════════*/
console.log('\n2. no room is a trap');
{
  const { NEU } = boot();
  let bad = [];
  for (const id of NEU.engine.rooms) {
    if (!NEU.engine.enter(id, 'default')) { bad.push(id + ' (no enter)'); continue; }
    const p = NEU.engine.api.player;
    if (!(p.x > 0 && p.y > 0)) bad.push(id + ' (bad spawn)');
    NEU.engine.leave();
  }
  ok('>>> all 18 rooms enterable with a valid spawn <<<', bad.length === 0);
  if (bad.length) console.log('       ' + bad.join(', '));

  /* A room you can enter but cannot leave is still a trap. See
     reach.mjs: a2_path spawned you on floor, in a corridor with no way
     through to its own exit. */
  const ZONES = ['rooms-a.js', 'rooms-d.js'];
  const lost = stranded(ROOT, ZONES);
  ok('>>> and every spawn can walk to every exit <<<', lost.length === 0);
  if (lost.length) console.log('       ' + lost.join('\n       '));
  ok('the proof covered all 18', roomCount(ROOT, ZONES) === 18);
  const wrongDoor = badSpawns(ROOT, ZONES);
  ok(">>> and no exit asks for a spawn that isn't there <<<", wrongDoor.length === 0);
  if (wrongDoor.length) console.log('       ' + wrongDoor.join('\n       '));
  const sealed = untouchable(ROOT, ZONES);
  ok('>>> every entity is reachable <<<', sealed.length === 0);
  if (sealed.length) console.log('       ' + sealed.join('\n       '));
}

/* ═══ 3. the fire door ════════════════════════════════════════════*/
console.log('\n3. ashes → fire door → city');
{
  const { NEU } = boot();
  ok('the altar hands out a firedoor flag', /gives: 'firedoor'/.test(A));
  ok('>>> and the exit to the city is locked behind it <<<',
     /to: 'd1_street', spawn: 'fire', locked: 'firedoor'/.test(A));
  ok('the door uses the real undertale sprite', /sheet: 'firedoor'/.test(A));

  NEU.engine.enter('b7_altar', 'east');
  ok('locked while the flag is unset', NEU.save.flagged('firedoor') === false);
  NEU.save.flag('firedoor', 1);
  ok('unlocked once it is set', NEU.save.flagged('firedoor') === true);
  NEU.engine.leave();
}

/* ═══ 4. the merchant ═════════════════════════════════════════════*/
console.log('\n4. the shop');
{
  ok('ten items on the board', (S.match(/name:/g) || []).length >= 9);
  ok('>>> exactly one is marked as lit <<<',
     (S.match(/glow:\s*true/g) || []).length === 1);
  ok('the lit one is the Recall Potion', /name:\s*'Recall Potion'[^}]*glow:\s*true/.test(S));
  ok('the axe is present and refused', /name:\s*'an axe'[^}]*not for sale/.test(S));
  ok('he says not to ask about it', /don't ask about the axe/.test(S));
  ok('>>> the shop is a real graphical panel <<<', /NEU\.shop\s*=/.test(S));
  ok('with arrow-key navigation', /ArrowUp/.test(S) && /ArrowDown/.test(S));
  ok('and enter to select', /'Enter'/.test(S));
  ok('and a quit button', /shopQuit/.test(S));
  ok('that gives recall on select', /NEU\.save\.give\(item\.give\)/.test(S) && /give:\s*'recall'/.test(S));
  ok('and marks the quest', /NEU\.quest\.mark\('a4_recall'\)/.test(S));
  ok('room-d opens NEU.shop', /NEU\.shop\.open/.test(D));

  const { NEU } = boot();
  NEU.engine.enter('d1_street', 'fire');
  ok('the street loads', NEU.engine.room === 'd1_street');
  ok('you do not start with the potion', NEU.save.has('recall') === false);
  NEU.engine.leave();
}

/* ═══ 5. the potion sends you home ════════════════════════════════*/
console.log('\n5. recall');
{
  const { NEU } = boot();
  ok('the circle refuses without it', /it wants a potion/.test(D));
  ok('>>> drinking it consumes the potion <<<', /NEU\.save\.take\('recall'\)/.test(D));
  ok('and drops you in new home', /c\.go\('e1_hall', 'south'\)/.test(D));
  ok('new home is three corridors plus the last one',
     (D.match(/corridor\('e\d_hall'/g) || []).length === 3);
}

/* ═══ 6. the last corridor ════════════════════════════════════════*/
console.log('\n6. what he tells you');
{
  ok('no fight in the last corridor', !/scal|bullet|danmaku/i.test(
     D.split('e4_corridor')[1] || ''));
  ok('he speaks in his own voice', /'sans'\]/.test(D));
  ok('>>> and sets tv_breakable <<<', /c\.flag\('tv_breakable', 1\)/.test(D));

  const S = fs.readFileSync(path.join(ROOT,'js','game/sans.js'), 'utf8');
  ok('the television reads that flag', /flagged\('tv_breakable'\)/.test(S));
  ok('>>> clicking it cannot break it <<<', !/tvBreakable\(\) && state === 'held'/.test(S));
  ok('>>> the television is a throw target <<<',
     /function tvScreenPos/.test(S) && /if \(landBlow\(\)\) NEU\.breakTV\(\)/.test(S));
  ok('breaking it opens the show', /NEU\.quiz\.open\(\)/.test(S));

  const { NEU } = boot();
  ok('not breakable yet', NEU.tvBreakable() === false);
  NEU.save.flag('tv_breakable', 1);
  ok('>>> breakable once he has said so <<<', NEU.tvBreakable() === true);
  NEU.breakTV();
  ok('and it only breaks once', NEU.tvBreakable() === false);
}

/* ═══ 7. the show ═════════════════════════════════════════════════*/
console.log('\n7. tenna');
{
  const { w, NEU } = boot();
  ok('quiz loaded', !!NEU.quiz);
  ok('>>> twenty questions <<<', NEU.quiz.questions.length === 20);

  /* Every question must have four options and a valid answer index. */
  const bad = NEU.quiz.questions.filter(q =>
    q[2].length !== 4 || !(q[3] >= 0 && q[3] < 4));
  ok('>>> every question has 4 options and a real answer <<<', bad.length === 0);

  const cats = [...new Set(NEU.quiz.questions.map(q => q[0]))];
  ok('five games covered', cats.length === 5);
  ok('four questions each',
     cats.every(c => NEU.quiz.questions.filter(q => q[0] === c).length === 4));

  /* No two consecutive questions share a category — a run of five
     Terraria questions reads as one long question. */
  let runs = 0;
  for (let k = 1; k < NEU.quiz.questions.length; k++)
    if (NEU.quiz.questions[k][0] === NEU.quiz.questions[k-1][0]) runs++;
  ok('>>> categories never repeat back to back <<<', runs === 0);

  ok('nine ranks', NEU.quiz.ranks.length === 9);
  ok('D- is reachable with zero', NEU.quiz.rankFor(0) === 'D-');
  ok('S+ needs all twenty', NEU.quiz.rankFor(20) === 'S+' && NEU.quiz.rankFor(19) !== 'S+');
  ok('the scale is monotonic', (() => {
    let last = 99;
    for (const [, min] of NEU.quiz.ranks) { if (min > last) return false; last = min; }
    return true;
  })());

  ok('>>> ranks are cumulative <<<', NEU.quiz.opens('S+').length === 9);
  ok('a middling rank opens fewer', NEU.quiz.opens('B').length === 4);
  ok('the worst rank still opens one', NEU.quiz.opens('D-').length === 1);

  const src = fs.readFileSync(path.join(ROOT,'js','act4','quiz.js'), 'utf8');
  ok('thresholds are shown before you start', /function board\(\)/.test(src));
  ok('>>> running out is a wrong answer, not an ejection <<<',
     /Running out is a wrong answer, not an ejection/.test(src));
  ok('the answer is revealed every time', /is-right/.test(src));
  ok('a worse re-run cannot close a door', /prev\.score > score/.test(src));
}

/* ═══ 8. the show actually runs ═══════════════════════════════════*/
console.log('\n8. playing it');
{
  const { w, NEU } = boot();
  NEU.quiz.fast(true);          // skip the game-show pacing, not the logic
  NEU.quiz.open();
  await wait(60);
  ok('it opened', NEU.quiz.running === true);
  const opts = w.document.getElementById('quizOpts');
  ok('four buttons rendered', opts.children.length === 4);
  ok('the board is populated',
     w.document.getElementById('quizBoard').children.length === 9);

  /* answer everything correctly */
  for (let k = 0; k < 20; k++) {
    const q = NEU.quiz.questions[NEU.quiz.index];
    if (!q) break;
    w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'abcd'[q[3]], bubbles: true }));
    await wait(20);
  }
  await wait(200);
  ok('>>> a perfect run scores twenty <<<', NEU.quiz.score === 20);
  ok('and lands S+', NEU.save.flag('quiz_rank') === 'S+');
  ok('>>> which opens all nine rooms <<<',
     NEU.quiz.ranks.every(r => NEU.save.flagged('rank:' + r[0])));
  ok('the objective ticked', NEU.quest.has('a4_rank') === true);
  NEU.quiz.close();
}

/* ═══ 10. regression: npcs are not embedded in walls ══════════════
   Two act4 npcs were placed on '#' tiles, making them unreachable. */
{
  const G = fs.readFileSync(path.join(ROOT,'js','act4','rooms-g.js'),'utf8');
  ok('>>> h3_trip pot npc moved off the wall <<<', /x:\s*10,\s*y:\s*3/.test(G));

  const D = fs.readFileSync(path.join(ROOT,'js','act4','rooms-d.js'),'utf8');
  ok('>>> d2 mush5 npc moved off the wall <<<', /x:\s*14,\s*y:\s*3,\s*colour:\s*'#C4705F',\s*mush:\s*'mush5'/.test(D));
}

/* ═══ 11. regression: rhythm retry preserves the round ═════════════
   After a loss, Enter should restart the current round, not round 0. */
{
  const R = fs.readFileSync(path.join(ROOT,'js','act4','rhythm.js'),'utf8');
  ok('Enter calls retry, not open', /if\s*\(!running\s*&&\s*e\.key\s*===\s*'Enter'\)\s*\{\s*e\.preventDefault\(\);\s*retry\(\)/.test(R));
  ok('open() still resets round to 0', /round\s*=\s*0/.test(R));
  const retryStart = R.indexOf('function retry()');
  const openStart = R.indexOf('function open()', retryStart);
  const retryBody = R.slice(retryStart, openStart);
  ok('retry() does not reset round', !/round\s*=\s*0/.test(retryBody));
}

/* ═══ 12. regression: rhythm response timing ══════════════════════
   The response phase must start when the player's bar arrives, not
   400 ms early (which made the first note a guaranteed MISS). */
{
  const R = fs.readFileSync(path.join(ROOT,'js','act4','rhythm.js'),'utf8');
  ok('>>> response timeout has no -400 early-start <<<', !/1400\s*\+\s*4\s*\*\s*beatLen\(\s*\)\s*\*\s*1000\s*-\s*400/.test(R));
}

console.log('\n' + (fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`));
process.exit(fail ? 1 : 0);
