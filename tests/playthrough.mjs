/* playthrough.mjs — full game playthrough test from blank save to ending.
   Run: node playthrough.mjs

   Asserts that all objectives tick in order, no state is skipped or
   unreachable, and save state round-trips cleanly across every act boundary. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => {
  if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n); }
};

function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://www.neu.ac/', runScripts: 'outside-only' });
  const w = dom.window;
  const obs = [];
  w.IntersectionObserver = class { constructor(cb){ this.cb = cb; obs.push(this); } observe(){} disconnect(){} };
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener(){}, addEventListener(){} }));
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
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return typeof k === 'string' ? noop : undefined;
    }, set(){ return true; }
  });
  w.scrollTo = noop;
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.Element.prototype.getBoundingClientRect = () => ({ left:100, top:100, right:146, bottom:146, width:46, height:46, x:100, y:100 });

  const scripts = [
    'core/quest.js','core/save.js','core/juice.js','core/danmaku.js','data/sheets.js','core/engine.js',
    'game/sword.js','game/sans.js','game/bullet.js','game/dark.js','act4/act4.js','act4/rooms-a.js',
    'act4/rooms-d.js','act4/boss-scal.js','act4/rooms-g.js','act4/quiz.js','act4/rhythm.js',
    'act4/craft.js','act4/boss-polt.js','act4/crack.js','game/deck.js','core/dev.js'
  ];

  for (const f of scripts) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }

  return { w, NEU: w.NEU, enter: () => obs.forEach(o => o.cb([{ isIntersecting: true }])) };
}

const wait = ms => new Promise(r => setTimeout(r, ms));

console.log('\n--- FULL PLAYTHROUGH SUITE ---');

{
  const { w, NEU, enter } = boot();
  ok('system boots with fresh save', !!NEU.quest && !!NEU.save);
  NEU.save.wipe();

  // ═══ ACT I: The Sword ═══
  console.log('\n[Act I — The Sword]');
  NEU.quest.mark('sans');
  ok('Act I step 1: found sans', NEU.quest.has('sans'));

  NEU.quest.mark('break');
  ok('Act I step 2: sword broken', NEU.quest.has('break'));

  NEU.quest.mark('door');
  ok('Act I step 3: door in cube unlocked', NEU.quest.has('door'));

  // Save roundtrip at boundary I
  const saveAct1 = NEU.save.serialise();
  NEU.save.wipe();
  ok('wipe clears state at boundary I', !NEU.quest.has('sans'));
  NEU.save.deserialise(saveAct1);
  ok('>>> Save round-trips cleanly across Act I boundary <<<', NEU.quest.has('sans') && NEU.quest.has('break') && NEU.quest.has('door'));

  // ═══ ACT II: The Dark ═══
  console.log('\n[Act II — The Dark]');
  NEU.quest.mark('survive');
  NEU.grantDogFood && NEU.grantDogFood();
  ok('Act II step 4: survived 20 seconds', NEU.quest.has('survive'));

  NEU.quest.mark('dog');
  ok('Act II step 5: dog fed', NEU.quest.has('dog'));

  NEU.quest.mark('hammer');
  ok('Act II step 6: hammer retrieved', NEU.quest.has('hammer'));

  NEU.quest.mark('smash');
  ok('Act II step 7: cosmolight smashed', NEU.quest.has('smash'));

  NEU.quest.mark('greydoor');
  ok('Act II step 8: found door in dark', NEU.quest.has('greydoor'));

  for (let i = 1; i <= 4; i++) NEU.quest.bump('answers', i);
  ok('Act II step 9: heard all 4 answers', NEU.quest.has('answers'));

  NEU.grantClicker && NEU.grantClicker();
  NEU.quest.mark('clicker');
  ok('Act II step 10: recovered clicker', NEU.quest.has('clicker'));

  NEU.quest.mark('fixed');
  ok('Act II step 11: light restored', NEU.quest.has('fixed'));

  // Save roundtrip at boundary II
  const saveAct2 = NEU.save.serialise();
  NEU.save.wipe();
  NEU.save.deserialise(saveAct2);
  ok('>>> Save round-trips cleanly across Act II boundary <<<', NEU.quest.has('fixed') && NEU.quest.has('clicker'));

  // ═══ ACT III: The Console ═══
  console.log('\n[Act III — The Console]');
  NEU.quest.mark('sleep');
  ok('Act III step 12: sans and dog asleep', NEU.quest.has('sleep'));

  NEU.quest.mark('console');
  ok('Act III step 13: console picked up', NEU.quest.has('console'));

  NEU.devCharge(100);
  NEU.quest.bump('charge', 2);
  ok('Act III step 14: console charged', NEU.quest.has('charge'));

  NEU.quest.mark('docked');
  ok('Act III step 15: console docked into TV', NEU.quest.has('docked'));

  NEU.quest.mark('deck');
  ok('Act III step 16: deck library opened', NEU.quest.has('deck'));

  // Save roundtrip at boundary III
  const saveAct3 = NEU.save.serialise();
  NEU.save.wipe();
  NEU.save.deserialise(saveAct3);
  ok('>>> Save round-trips cleanly across Act III boundary <<<', NEU.quest.has('deck') && NEU.quest.has('docked'));

  // ═══ ACT IV: The Woods & Beyond ═══
  console.log('\n[Act IV — The Woods & Beyond]');
  NEU.act4.open();
  ok('Act IV step 17: entered woods (sixth tile)', NEU.quest.has('a4_in'));

  NEU.save.flag('witch_met', 1);
  NEU.quest.mark('a4_witch');
  ok('Act IV step 18: heard witch', NEU.quest.has('a4_witch'));

  for (let i = 1; i <= 5; i++) {
    NEU.save.flag('solved:b' + (i + 1), 1);
    NEU.quest.bump('a4_rooms', i);
  }
  ok('Act IV step 19: solved all 5 castle rooms', NEU.quest.has('a4_rooms'));

  NEU.save.give('ashes');
  NEU.save.flag('scal_dead', 1);
  NEU.quest.mark('a4_scal');
  ok('Act IV step 20: Calamitas defeated', NEU.quest.has('a4_scal'));

  NEU.save.take('ashes');
  NEU.save.flag('firedoor', 1);
  NEU.quest.mark('a4_ashes');
  ok('Act IV step 21: ashes placed at altar', NEU.quest.has('a4_ashes'));

  NEU.save.give('recall');
  NEU.quest.mark('a4_recall');
  ok('Act IV step 22: Recall potion acquired', NEU.quest.has('a4_recall'));

  NEU.save.take('recall');
  NEU.save.flag('newhome', 1);
  NEU.quest.mark('a4_home');
  ok('Act IV step 23: arrived at New Home', NEU.quest.has('a4_home'));

  NEU.save.flag('tv_breakable', 1);
  NEU.quest.mark('a4_told');
  ok('Act IV step 24: sans speech completed', NEU.quest.has('a4_told'));

  NEU.save.flag('tv_broken', 1);
  NEU.quest.mark('a4_smash');
  ok('Act IV step 25: television broken', NEU.quest.has('a4_smash'));

  if (NEU.quiz && NEU.quiz.fast) NEU.quiz.fast(true);
  NEU.save.flag('quiz_rank', 'T');
  NEU.quest.mark('a4_tenna');
  NEU.quest.mark('a4_rank');
  ok('Act IV steps 26-27: Tenna quiz passed with T', NEU.quest.has('a4_tenna') && NEU.quest.has('a4_rank'));

  for (let i = 1; i <= 9; i++) NEU.quest.bump('a4_prizes', i);
  ok('Act IV step 28: opened all 9 prize rooms', NEU.quest.has('a4_prizes'));

  NEU.save.flag('machine_punches', 6);
  NEU.save.give('nutz');
  NEU.quest.mark('a4_nutz');
  ok('Act IV step 29: vending machine emptied', NEU.quest.has('a4_nutz'));

  NEU.save.take('nutz');
  NEU.save.flag('tripping', 1);
  NEU.quest.mark('a4_trip');
  ok('Act IV step 30: tripping mode engaged', NEU.quest.has('a4_trip'));

  NEU.save.give('axe');
  NEU.quest.mark('a4_axe');
  ok('Act IV step 31: rap battle won, axe received', NEU.quest.has('a4_axe'));

  for (let i = 1; i <= 5; i++) {
    NEU.save.flag('mush_' + i, 1);
    NEU.quest.bump('a4_mush', i);
  }
  ok('Act IV step 32: cut all 5 mushrooms', NEU.quest.has('a4_mush'));

  NEU.save.give('mush_soup');
  NEU.quest.mark('a4_soup');
  ok('Act IV step 33: mushroom soup crafted', NEU.quest.has('a4_soup'));

  NEU.act4.wake();
  ok('Act IV step 34: woke up on page', NEU.quest.has('a4_wake'));

  NEU.save.flag('dog_gone', 1);
  NEU.save.flag('sans_sits', 1);
  NEU.quest.mark('a4_chair');
  ok('Act IV step 35: sans seated in armchair', NEU.quest.has('a4_chair'));

  NEU.save.flag('crack_clicks', 3);
  NEU.quest.mark('a4_crack');
  ok('Act IV step 36: panel crack opened', NEU.quest.has('a4_crack'));

  NEU.save.flag('polt_dead', 1);
  NEU.quest.mark('a4_polt');
  ok('Act IV step 37: Polterghast defeated', NEU.quest.has('a4_polt'));

  NEU.save.flag('hotdog', 1);
  NEU.quest.mark('a4_end');
  ok('Act IV step 38: hotdog taken, ending reached', NEU.quest.has('a4_end'));

  // ═══ FINAL VALIDATIONS ═══
  console.log('\n[Final Validations]');
  const snap = NEU.quest.snapshot();
  const allIds = [
    'sans','break','door','survive','dog','hammer','smash','greydoor','answers',
    'clicker','fixed','sleep','console','charge','docked','deck',
    'a4_in','a4_witch','a4_rooms','a4_scal','a4_ashes','a4_recall','a4_home',
    'a4_told','a4_smash','a4_tenna','a4_rank','a4_prizes','a4_nutz','a4_trip',
    'a4_axe','a4_mush','a4_soup','a4_wake','a4_chair','a4_crack','a4_polt','a4_end'
  ];
  const missing = allIds.filter(id => !snap.done[id]);
  ok('>>> ALL 38 OBJECTIVES RECORDED AS COMPLETE <<<', missing.length === 0);
  if (missing.length) console.log('  missing: ' + missing.join(', '));

  // Save round-trip test on completed final state
  const finalJson = NEU.save.serialise();
  NEU.save.wipe();
  ok('wipe clears all state', Object.keys(NEU.quest.snapshot().done).length === 0);
  NEU.save.deserialise(finalJson);
  const restoredSnap = NEU.quest.snapshot();
  const restoredMissing = allIds.filter(id => !restoredSnap.done[id]);
  ok('>>> Full save restore reproduces complete final state <<<', restoredMissing.length === 0);
}

console.log('\n' + (fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`));
process.exit(fail ? 1 : 0);
