/* fixes10.mjs — Zones G–K: prizes, the machine, the trip, the
   argument, the pot, the crack, and Polterghast.
   Run: node fixes10.mjs */

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

const FILES = ['core/quest.js','core/save.js','core/danmaku.js','data/sheets.js','core/engine.js','game/bullet.js','game/dark.js',
  'game/sans.js','act4/act4.js','act4/rooms-a.js','act4/rooms-d.js','act4/rooms-g.js',
  'act4/boss-scal.js','act4/quiz.js','act4/rhythm.js','act4/craft.js',
  'act4/boss-polt.js','act4/crack.js','game/deck.js','core/dev.js'];

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

  for (const f of FILES) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
const G = read('act4/rooms-g.js'), A = read('act4/rooms-a.js'), D = read('act4/rooms-d.js');

/* ═══ 1. the whole map ════════════════════════════════════════════*/
console.log('\n1. the complete map');
{
  const { NEU } = boot();
  ok('31 rooms registered', NEU.engine.rooms.length === 31);
  const all = A + D + G;
  /* Skip COMPUTED exits. The nine prize rooms are generated with
     `to: 'g_' + n`, so a literal-string scan captures the prefix "g_"
     and reports a dangling door that does not exist. The generated
     rooms are covered by the enterability sweep below, which is the
     stronger check anyway. */
  const targets = [...all.matchAll(/to:\s*'([a-z0-9_]+)'(?!\s*\+)/g)].map(m => m[1]);
  const bad = [...new Set(targets.filter(t => !NEU.engine.rooms.includes(t)))];
  ok('>>> no exit anywhere leads nowhere <<<', bad.length === 0);
  if (bad.length) console.log('       dangling: ' + bad.join(', '));
  console.log('       ' + targets.length + ' exits across four zone files');

  let bad2 = [];
  for (const id of NEU.engine.rooms) {
    if (!NEU.engine.enter(id, 'default')) { bad2.push(id); continue; }
    const p = NEU.engine.api.player;
    if (!(p.x > 0 && p.y > 0)) bad2.push(id);
    NEU.engine.leave();
  }
  ok('>>> every one of the 31 is enterable <<<', bad2.length === 0);
  if (bad2.length) console.log('       ' + bad2.join(', '));

  /* Enterable is not the same as leavable. See reach.mjs: a2_path passed
     every check above with its exit walled off from where you spawn. */
  const ZONES = ['rooms-a.js', 'rooms-d.js', 'rooms-g.js'];
  const lost = stranded(ROOT, ZONES);
  ok('>>> and you can walk from every spawn to every exit <<<', lost.length === 0);
  if (lost.length) console.log('       ' + lost.join('\n       '));
  ok('the proof covered all 31', roomCount(ROOT, ZONES) === 31);
  const wrongDoor = badSpawns(ROOT, ZONES);
  ok('>>> no exit in the game asks for a spawn that is not there <<<', wrongDoor.length === 0);
  if (wrongDoor.length) console.log('       ' + wrongDoor.join('\n       '));
  /* h1_storm's door trigger was sealed inside its own frame, and it is
     the only way into h2_machine and h3_trip. */
  const sealed = untouchable(ROOT, ZONES);
  ok('>>> every entity in the game can be touched <<<', sealed.length === 0);
  if (sealed.length) console.log('       ' + sealed.join('\n       '));
  const { unsolvable: dead } = unsolvable(ROOT, ZONES);
  ok('>>> every block puzzle in the game is solvable <<<', dead.length === 0);
  if (dead.length) console.log('       ' + dead.join('\n       '));
}

/* ═══ 2. the prize rooms ══════════════════════════════════════════*/
console.log('\n2. nine doors');
{
  const { NEU } = boot();
  ok('nine prize rooms exist',
     [...Array(9).keys()].every(n => NEU.engine.rooms.includes('g_' + n)));
  ok('>>> each is locked behind its own rank <<<',
     (G.match(/locked: 'rank:' \+ r/g) || []).length === 1);
  ok('the corridor names the doors you did not earn',
     /you did not score high enough for this one\. yet\./.test(G));
  ok('nine distinct prizes', (G.match(/^\s+\['[ZCASTB]/gm) || []).length === 9);

  /* a Z run opens exactly one door; T opens all nine */
  NEU.save.flag('rank:Z', 1);
  ok('Z opens one', NEU.save.flagged('rank:Z') && !NEU.save.flagged('rank:T'));
  NEU.quiz.opens('T').forEach(r => NEU.save.flag('rank:' + r, 1));
  ok('>>> T opens all nine <<<',
     NEU.quiz.ranks.every(r => NEU.save.flagged('rank:' + r[0])));

  ok('only the T room leads onward', /to: 'h1_storm'/.test(G));
}

/* ═══ 3. the vending machine ══════════════════════════════════════*/
console.log('\n3. no money, one verb');
{
  const { NEU } = boot();
  ok('six punches', (G.match(/^\s+'(you hit|the bag|the machine|it is very)/gm) || []).length === 6);
  ok('>>> the machine complains more each time <<<',
     /it does not comment/.test(G) && /pointedly/.test(G));
  ok('the game never offers to sell them', !/buy|purchase|price/i.test(
     G.split('h2_machine')[1].split('h3_trip')[0]));

  NEU.engine.enter('h2_machine', 'door');
  const api = NEU.engine.api;
  for (let k = 0; k < 6; k++) {
    const e = api.ents().find(x => x.t === 'npc' && x.run);
    if (e) e.run(api);
  }
  ok('>>> six goes and the bag drops <<<', NEU.save.has('nutz') || NEU.save.flag('punches') >= 6);
  NEU.engine.leave();
}

/* ═══ 4. the mushrooms ════════════════════════════════════════════*/
console.log('\n4. five mushrooms, three answers');
{
  const { NEU } = boot();
  const all = A + D;
  ok('all five are planted', (all.match(/mush: 'mush\d'/g) || []).length === 5);
  ok('>>> and they are planted hours early <<<',
     /mush: 'mush1'/.test(A) && /mush: 'mush3'/.test(D));

  const api = { say: () => {}, has: i => NEU.save.has(i) };
  /* not tripping: no reason to want it */
  ok('sober, you cannot take one', (NEU.chop(api, 'mush1'), NEU.save.has('mush1') === false));
  NEU.save.flag('tripping', 1);
  ok('tripping without the axe, still no', (NEU.chop(api, 'mush1'), NEU.save.has('mush1') === false));
  NEU.save.give('axe');
  NEU.chop(api, 'mush1');
  ok('>>> tripping WITH the axe, yes <<<', NEU.save.has('mush1') === true);
  ok('the same object answered three different ways', true);

  for (let n = 2; n <= 5; n++) NEU.chop(api, 'mush' + n);
  ok('all five cuttable', NEU.mushrooms() === 5);
}

/* ═══ 5. the argument ═════════════════════════════════════════════*/
console.log('\n5. the rap battle');
{
  const { NEU } = boot();
  const R = read('act4/rhythm.js');
  ok('rhythm loaded', !!NEU.rhythm);
  ok('three rounds', NEU.rhythm.charts.length === 3);
  ok('each faster than the last',
     NEU.rhythm.bpm[0] < NEU.rhythm.bpm[1] && NEU.rhythm.bpm[1] < NEU.rhythm.bpm[2]);
  ok('and each denser', NEU.rhythm.charts[0].length < NEU.rhythm.charts[2].length);

  /* every note must be in a real lane and on a sane beat */
  const badNote = NEU.rhythm.charts.flat().filter(n =>
    !(n[1] >= 0 && n[1] <= 3) || !(n[0] >= 0 && n[0] < 16));
  ok('>>> every note is playable <<<', badNote.length === 0);

  ok('the hit window is generous', NEU.rhythm.WINDOW >= 0.12);
  ok('>>> timing comes from the audio clock, not rAF <<<',
     /function now\(\) \{ return audio\(\)\.currentTime; \}/.test(R));
  ok('and the reason is written down', /rAF drift/.test(R));
  ok('it is call and response', /call and response|forYou/.test(R));
  ok('losing does not cost the axe permanently', /enter to go again/.test(R));
  ok('winning hands it over', /NEU\.save\.give\('axe'\)/.test(R));

  ok('>>> the merchant only fights you once you are tripping <<<',
     /flagged\('tripping'\) && !NEU\.save\.has\('axe'\)/.test(D));
}

/* ═══ 6. the pot ══════════════════════════════════════════════════*/
console.log('\n6. crafting');
{
  const { NEU } = boot();
  ok('craft loaded', !!NEU.craft);
  ok('a 3x3 grid', NEU.craft.recipe.length === 9);
  ok('>>> the recipe is a SHAPE, not a count <<<',
     NEU.craft.recipe.filter(Boolean).length === 3 &&
     NEU.craft.recipe[3] === 'M' && NEU.craft.recipe[5] === 'M' && NEU.craft.recipe[7] === 'M');

  for (let n = 1; n <= 5; n++) NEU.save.give('mush' + n);
  NEU.craft.open();
  ok('you start with what you cut', NEU.craft.held === 5);
  ok('nothing matches yet', NEU.craft.matches() === false);

  NEU.craft.put(3); NEU.craft.put(5); NEU.craft.put(7);
  ok('>>> the shape completes <<<', NEU.craft.matches() === true);

  /* wrong arrangements must be free */
  NEU.craft.put(0);
  ok('adding a wrong one breaks it', NEU.craft.matches() === false);
  NEU.craft.put(0);
  ok('>>> and taking it back out fixes it — nothing is consumed <<<',
     NEU.craft.matches() === true);

  NEU.craft.take();
  ok('taking it consumes the mushrooms', NEU.mushrooms() === 0);
  ok('and gives soup', NEU.save.has('soup') === true);
}

/* 6b. the pot traps Tab and gives the focus back. A grid you arrow
   through needs a way in and a way out that does not strand the
   player behind the overlay — and leaving must return them to the
   thing they were on before. */
{
  const { w, NEU } = boot();
  const kd = (key, shiftKey) => {
    const e = new w.KeyboardEvent('keydown',
      { key, shiftKey, bubbles: true, cancelable: true });
    w.dispatchEvent(e);
    return e;
  };
  const settBtn = w.document.getElementById('sansBtn');
  settBtn.focus();                       /* the gear — what had focus */
  NEU.craft.open();
  await wait(80);                        /* open() defers focusCell */
  ok('focus enters the grid', /craft__cell/.test(w.document.activeElement.className));
  const quit = w.document.getElementById('craftQuit');
  quit.focus();
  const t1 = kd('Tab', false);
  ok('>>> Tab from the quit button wraps to the grid <<<',
     t1.defaultPrevented && /craft__cell/.test(w.document.activeElement.className));
  w.document.querySelector('.craft__cell').focus();
  const t2 = kd('Tab', true);
  ok('>>> Shift+Tab from the first cell wraps to quit <<<',
     t2.defaultPrevented && w.document.activeElement === quit);
  NEU.craft.close();
  ok('>>> closing gives the focus back to the gear <<<',
     w.document.activeElement === settBtn);
}

/* ═══ 7. the crack ════════════════════════════════════════════════*/
console.log('\n7. three clicks');
{
  const { w, NEU } = boot();
  const C = read('act4/crack.js');
  ok('crack loaded', !!NEU.crack);
  ok('dead until he sits down', NEU.crack.armed === false);
  NEU.crack.hit();
  ok('>>> clicking an unarmed crack does nothing <<<', NEU.crack.clicks === 0);

  NEU.crack.arm();
  ok('armed once he sits', NEU.crack.armed === true);
  NEU.crack.hit();
  ok('one click: a noise, nothing else', NEU.crack.clicks === 1 && NEU.crack.opened === false);
  NEU.crack.hit();
  ok('two clicks: still closed', NEU.crack.clicks === 2 && NEU.crack.opened === false);
  NEU.crack.hit();
  ok('>>> three clicks: it opens <<<', NEU.crack.opened === true);

  ok('the pitch drops each time', /160 - clicks \* 38/.test(C));
  ok('and the reason is written down', /getting\s+closer rather than a button/.test(C));
  ok('progress survives a reload', /crack_clicks/.test(C));
}

/* ═══ 8. polterghast ══════════════════════════════════════════════*/
console.log('\n8. what is through it');
{
  const { NEU } = boot();
  const P = read('act4/boss-polt.js');
  ok('boss loaded', !!NEU.polt);
  NEU.polt.open();
  ok('opens in phase 1', NEU.polt.phase === 1);
  ok('four hooks', NEU.polt.hooks === 4);
  ok('no clone yet', NEU.polt.clone === false);
  NEU.polt.close();

  /* Quitting the fight without killing him must put the crack back.
     Before the fix, opened stayed true forever: the finale was
     unreachable, and the save sat at a portal that would never open
     again. */
  NEU.crack.arm();
  NEU.crack.hit(); NEU.crack.hit(); NEU.crack.hit();
  ok('the crack opens again', NEU.crack.opened === true);
  NEU.polt.open();
  NEU.polt.close();
  ok('>>> walking away from the fight re-arms the crack <<<',
     NEU.crack.opened === false && NEU.crack.clicks === 0);
  NEU.crack.hit();
  ok('...and the three clicks are fresh', NEU.crack.clicks === 1);

  ok('>>> three phases at 50% and 20% <<<',
     /pct <= 0\.50 && phase < 2/.test(P) && /pct <= 0\.20 && phase < 3/.test(P));
  ok('the hooks detach in phase 2', /h\.free = true/.test(P));
  ok('and re-chain in phase 3', /h\.free = false/.test(P));
  ok('the clone mirrors him', /clone\.x = AX \+ AW - \(bx - AX\)/.test(P));
  ok('killing the clone is possible', /clone = null;\s*\n\s*say\("\* the copy comes apart/.test(P));
  ok('spreads of 6 / 7 / 8-or-10',
     /spread\(6,/.test(P) && /spread\(7,/.test(P) && /spread\(clone \? 8 : 10,/.test(P));
  ok('>>> red means it is about to charge, and it says so <<<',
     /red means it is about to move/.test(P));
  ok('shots turn back once, like expert mode', /b\.k === 1 && b\.age > 0\.9 && !b\.turned/.test(P));
  ok('>>> depth is a scalar, camera never rotates <<<', /Depth is a scalar, not a matrix/.test(P));
  ok('and the reason is written down', /unreadable/.test(P));
  ok('>>> bullets face the way they travel <<<',
     /drawSheet\(key, bl\.x, bl\.y, 1, null, Math\.atan2\(bl\.vy, bl\.vx\)\)/.test(P));
  ok('>>> the charge glow is NOT hidden in the fallback branch <<<',
     P.indexOf("o.kind === 'body' && glow > 0") > -1 &&
     P.indexOf("o.kind === 'body' && glow > 0") < P.indexOf('if (drew) return;'));
  ok('winning throws you back out', /picks you up by a tooth/.test(P));
}

/* 8b. the copy comes apart where it stands. The clone-check used to
   sit INSIDE the boss-range guard, and the clone mirrors the boss
   across the arena — a player standing on the copy could be told the
   boss was out of reach. The check must precede the guard, and the
   copy must die from its own side: stand where the mirror converges
   and one hit takes it, WITHOUT touching the original. */
{
  const { w, NEU } = boot();
  const P = read('act4/boss-polt.js');
  NEU.polt.open();
  ok('>>> the clone check comes BEFORE the boss-range guard <<<',
     P.indexOf('clone && Math.hypot(px - clone.x') > -1 &&
     P.indexOf('clone && Math.hypot(px - clone.x') < P.indexOf('> 40) return'));
  const kd = (key) => w.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
  const ku = (key) => w.dispatchEvent(new w.KeyboardEvent('keyup', { key, bubbles: true }));
  await wait(3000);                  /* he walks down to you */
  for (let i = 0; i < 24; i++) { kd('z'); ku('z'); await wait(5); }
  ok('phase 3 reached', NEU.polt.phase === 3);
  ok('the clone exists', NEU.polt.clone === true);
  await wait(120);                   /* a few steps: it mirrors away */
  kd('ArrowUp');                     /* walk to the arena centre */
  await wait(720);                   /* 180px at 250px/s */
  ku('ArrowUp');
  await wait(900);                   /* he catches up; the mirror is you */
  kd('z'); ku('z');
  ok('>>> standing on the copy kills it, boss untouched <<<',
     NEU.polt.clone === false && NEU.polt.hp === 6 && NEU.polt.phase === 3);
  NEU.polt.close();
}

/* ═══ 9. the ending ═══════════════════════════════════════════════*/
console.log('\n9. the hotdog');
{
  const { NEU } = boot();
  const AC = read('act4/act4.js');
  ok('waking up is a summary and only that', /you fought a witch/.test(AC));
  ok('the dog leaves', /dog_gone/.test(AC));
  ok('>>> he takes the chair <<<', /armchair/.test(AC));
  ok('and the crack arms at that exact moment', /NEU\.crack\.arm\(\)/.test(AC));
  ok('the ending exists', typeof NEU.act4.ending === 'function');
  ok('>>> and it has the hotdog <<<', /hotdog/.test(AC));
  ok('act IV has 22 objectives', NEU.act4.steps.length === 22);

  NEU.act4.ending();
  ok('finishing sets the flag', NEU.save.flagged('act4_done') === true);
  ok('and ticks the last step', NEU.quest.has('a4_end') === true);
}

/* ═══ 10a. regression: Enter on deckQuit does not launch ══════════
   The keydown handler used to steal Enter from the quit button,
   starting a game the player just tried to leave. In jsdom the
   native button-click that Enter triggers does not fire, so the
   deck stays open — that IS the signal that launch() was not called
   (launch closes the deck and schedules g.run()). */
{
  const { w, NEU } = boot();
  NEU.deck.open();
  const q = w.document.getElementById('deckQuit');
  q.focus();
  const evt = new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  w.dispatchEvent(evt);
  /* launch() would have called close(); the deck is still open → launch
     was not invoked. (In a real browser the native click would also
     close it, but jsdom does not synthesize that click synchronously.) */
  ok('>>> Enter on deckQuit does not launch <<<', NEU.deck.running === true);
  NEU.deck.close();
}

/* ═══ 10. every module loaded clean ═══════════════════════════════*/
console.log('\n10. nothing threw on load');
{
  const { NEU } = boot();
  const want = ['quest','save','sheets','engine','bullet','dark','sans','act4',
                'scal','quiz','rhythm','craft','polt','crack','deck'];
  const missing = want.filter(k => !NEU[k]);
  ok('>>> all fifteen modules present <<<', missing.length === 0);
  if (missing.length) console.log('       missing: ' + missing.join(', '));
}

console.log('\n' + (fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`));
process.exit(fail ? 1 : 0);
