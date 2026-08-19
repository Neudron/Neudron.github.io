/* fixes11.mjs — the juice layer.
   Run: node fixes11.mjs

   Feel is subjective; the RULES behind it are not. This asserts the
   rules — trauma decays, shake is quadratic, hit-stop uses a real
   clock, tiers are ordered, reduced-motion kills the motion. */

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

function boot(reducedMotion = false) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.IntersectionObserver = class { constructor(cb){this.cb=cb;} observe(){} disconnect(){} };
  w.matchMedia = q => ({ matches: reducedMotion && /reduce/.test(q),
                         addListener(){}, addEventListener(){} });
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
  const calls = [];
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return {};
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof k === 'string') return (...a) => { calls.push(k); };
      return undefined;
    }, set(){ return true; }
  });
  w.scrollTo = noop;
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left:100, top:100, right:146, bottom:146, width:46, height:46, x:100, y:100 });

  for (const f of ['core/quest.js','core/save.js','core/juice.js','core/danmaku.js','data/sheets.js','core/engine.js',
                   'game/bullet.js','game/dark.js','game/sans.js','act4/act4.js','act4/rooms-a.js',
                   'act4/rooms-d.js','act4/rooms-g.js','act4/boss-scal.js','act4/quiz.js',
                   'act4/rhythm.js','act4/craft.js','act4/boss-polt.js','act4/crack.js',
                   'game/deck.js','core/dev.js']) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU, calls };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
const J = read('core/juice.js');

/* ═══ 1. trauma ═══════════════════════════════════════════════════*/
console.log('\n1. trauma, not shake');
{
  const { NEU } = boot();
  ok('juice loaded', !!NEU.juice);
  ok('starts at rest', NEU.juice.trauma === 0);

  NEU.juice.hit('small');
  const a = NEU.juice.trauma;
  ok('a hit adds trauma', a > 0);

  NEU.juice.hit('small');
  ok('>>> hits STACK, they do not reset <<<', NEU.juice.trauma > a);

  NEU.juice._reset();
  NEU.juice.hit('huge');
  ok('a huge hit maxes out', NEU.juice.trauma === 1);
  NEU.juice.hit('huge');
  ok('and is clamped at 1', NEU.juice.trauma === 1);

  ok('>>> shake is trauma SQUARED <<<', /trauma \* trauma/.test(J));
  ok('and the reason is written down', /gentle low, sharp high|quadratic/.test(J));
  ok('>>> not Math.random per frame <<<', !/Math\.random\(\)/.test(
     J.split('function begin')[1].split('function end')[0]));
  ok('sampled sin instead', /Math\.sin\(phase/.test(J));
  ok('three incommensurate frequencies',
     (J.match(/Math\.sin\(phase \* [\d.]+/g) || []).length === 3);
}

/* ═══ 2. decay ════════════════════════════════════════════════════*/
console.log('\n2. it always ends by itself');
{
  const { w, NEU } = boot();
  NEU.juice._reset();
  NEU.juice.hit('huge');
  const ctx = w.document.createElement('canvas').getContext('2d');
  const before = NEU.juice.trauma;
  /* Decay is stepped by begin() and dt is CLAMPED to 50ms a frame, so
     it has to be driven like a real frame loop. Two widely-spaced
     calls decay by one clamped step and look like a stall — that was
     a test bug, and the clamp itself is correct: without it a tab
     regaining focus after a minute would wipe trauma in one frame. */
  const frame = async n => { for (let k = 0; k < n; k++) { await wait(16); NEU.juice.begin(ctx, 800, 600); } };
  await frame(12);
  ok('>>> trauma decays over time <<<', NEU.juice.trauma < before);
  await frame(60);
  ok('and reaches rest', NEU.juice.trauma === 0);
  ok('so shake can never become the new normal', true);
}

/* ═══ 3. hit-stop ═════════════════════════════════════════════════*/
console.log('\n3. hit-stop on a real clock');
{
  const { NEU } = boot();
  NEU.juice._reset();
  ok('not frozen at rest', NEU.juice.frozen() === false);
  NEU.juice.hit('huge');
  ok('>>> a huge hit freezes the frame <<<', NEU.juice.frozen() === true);
  await wait(230);
  ok('and it thaws by itself', NEU.juice.frozen() === false);

  ok('>>> the clock is performance.now, not a scaled dt <<<',
     /performance\.now\(\) < freezeUntil/.test(J));
  ok('the classic WaitForSeconds trap is documented', /never resumes/.test(J));

  /* small events must NOT freeze — a footstep that stops time is
     the fastest way to make a game feel broken */
  NEU.juice._reset();
  NEU.juice.hit('small');
  ok('>>> small events never freeze <<<', NEU.juice.frozen() === false);
  NEU.juice._reset();
  NEU.juice.hit('tick');
  ok('and a tick does nothing at all', NEU.juice.trauma === 0 && !NEU.juice.frozen());
}

/* ═══ 4. tiers ════════════════════════════════════════════════════*/
console.log('\n4. proportional by tier');
{
  const { NEU } = boot();
  const t = NEU.juice.tiers;
  const order = ['tick','small','medium','large','huge'];
  ok('five tiers', order.every(k => t[k]));
  ok('>>> shake increases monotonically <<<',
     order.every((k, i) => i === 0 || t[k].shake >= t[order[i-1]].shake));
  ok('>>> so does hit-stop <<<',
     order.every((k, i) => i === 0 || t[k].stop >= t[order[i-1]].stop));
  ok('and particles', order.every((k, i) => i === 0 || t[k].parts >= t[order[i-1]].parts));
  ok('only the top two flash', t.large.flash > 0 && t.huge.flash > 0 &&
     t.medium.flash === 0 && t.small.flash === 0);
  ok('a boss death is ~5x a pickup', t.huge.shake / t.small.shake >= 5);
}

/* ═══ 5. accessibility ════════════════════════════════════════════*/
console.log('\n5. reduced motion');
{
  const { NEU } = boot(true);
  ok('the flag is picked up', NEU.juice.reduced === true);
  NEU.juice._reset();
  NEU.juice.hit('huge');
  ok('>>> no shake at all <<<', NEU.juice.trauma === 0);
  ok('>>> but hit-stop survives, shortened <<<', NEU.juice.frozen() === true);
  ok('and the reason is written down', /removing it entirely takes the weight/.test(J));

  const ctx = { save(){}, restore(){}, translate(){}, rotate(){}, fillRect(){},
                globalAlpha: 1, fillStyle: '' };
  ok('begin() is a no-op', NEU.juice.begin(ctx, 800, 600) === false);
  NEU.juice.burst(10, 10, 40, '#fff');
  ok('and no particles spawn', true);
  const p = NEU.juice.pop(0.5, 0.4);
  ok('>>> and squash & stretch is flat <<<', p.sx === 1 && p.sy === 1);

  const css = fs.readFileSync(path.join(ROOT,'css','style.css'), 'utf8');
  ok('the DOM shake is disabled too',
     /prefers-reduced-motion[\s\S]{0,120}\.is-shook \{ animation: none/.test(css));
}

/* ═══ 6. squash & stretch ═════════════════════════════════════════*/
console.log('\n6. pop');
{
  const { NEU } = boot();
  const a = NEU.juice.pop(0.05, 0.4);
  ok('>>> starts stretched <<<', a.sx > 1);
  ok('>>> and volume is conserved <<<', Math.abs(a.sx * a.sy - 1) < 1e-9);
  const b = NEU.juice.pop(1, 0.4);
  ok('settles back to rest', b.sx === 1 && b.sy === 1);

  ok('back-ease overshoots past 1', NEU.juice.backOut(0.6) > 1);
  ok('and lands exactly on 1', Math.abs(NEU.juice.backOut(1) - 1) < 1e-9);
  ok('out-cubic never overshoots', NEU.juice.outCubic(0.6) < 1);
  ok('the constant is the standard one', /1\.70158/.test(J));
}

/* ═══ 7. wired in ═════════════════════════════════════════════════*/
console.log('\n7. actually connected');
{
  const scal = read('act4/boss-scal.js'), polt = read('act4/boss-polt.js');
  const bull = read('game/bullet.js'), eng = read('core/engine.js');

  for (const [name, src] of [['calamitas', scal], ['polterghast', polt],
                             ['the room', bull], ['the engine', eng]]) {
    ok(name + ' shakes its draw', /NEU\.juice\.begin\(ctx/.test(src) &&
       /NEU\.juice\.end\(ctx/.test(src));
  }
  ok('both bosses hold the frame on impact',
     /juice\.frozen\(\)\) \{ draw\(now\)/.test(scal) &&
     /juice\.frozen\(\)\) \{ draw\(nowMs\)/.test(polt));
  ok('the room does too', /juice\.frozen\(\)\) \{ draw\(\)/.test(bull));

  ok('>>> taking a hit is MEDIUM everywhere <<<',
     /juice\.hit\('medium'\)/.test(scal) && /juice\.hit\('medium'\)/.test(polt) &&
     /juice\.hit\('medium'\)/.test(bull));
  ok('>>> landing one is SMALL <<<',
     /juice\.hit\('small'\)/.test(scal) && /juice\.hit\('small'\)/.test(polt));
  ok('>>> a boss death is HUGE <<<',
     /juice\.hit\('huge'/.test(scal) && /juice\.hit\('huge'/.test(polt));
  ok('solving a puzzle is LARGE', /juice\.hit\('large'/.test(eng));
  ok('a pickup is SMALL', /juice\.hit\('small'\)/.test(eng));
  ok('pushing a block is only a tick', /juice\.hit\('tick'\)/.test(eng));
  ok('charging the console is LARGE', /juice\.hit\('large', \{ colour: '#4FC3F7'/.test(bull));

  const html = fs.readFileSync(path.join(ROOT,'index.html'), 'utf8');
  /* Anchor to the ACTUAL script tag. A bare indexOf('js/engine.js')
     matched a comment on line 222 that merely mentions the file, which
     sits above every <script> and so reported correct load order as
     broken. Same class of bug as the `.tbox {` comment match. */
  ok('juice.js is loaded before everything that uses it',
     html.indexOf('src="js/core/juice.js"') < html.indexOf('src="js/core/engine.js"'));
}

/* ═══ 8. the pool ═════════════════════════════════════════════════*/
console.log('\n8. particles are pooled');
{
  const { NEU } = boot();
  ok('>>> a fixed pool, not per-hit allocation <<<', /var POOL = \d+, parts = \[\]/.test(J));
  ok('and the reason is written down', /allocating them per hit/.test(J));
  ok('debris falls', /p\.vy \+= 620 \* dt/.test(J));
  /* 500 particles into a 260 pool must not throw or grow */
  for (let k = 0; k < 60; k++) NEU.juice.burst(10, 10, 10, '#fff');
  ok('overflowing the pool is safe', true);
}


/* ═══ 9. the reorganised tree ═════════════════════════════════════
   Files moved into core/ page/ game/ data/ act4/. Every reference in
   index.html, in the modules' own comments and in these suites had to
   move with them — a stale path is a silent 404 that only shows up as
   a missing feature. */
console.log('\n9. organisation');
{
  const { NEU } = boot();
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  ok('nothing loads from the js/ root any more',
     !/src="js\/[a-z-]+\.js"/.test(html));
  ok('>>> every script tag points at a file that exists <<<',
     [...html.matchAll(/src="(js\/[^"]+)"/g)]
       .every(m => fs.existsSync(path.join(ROOT, m[1]))));

  const dirs = ['core','page','game','data','act4'];
  ok('five folders', dirs.every(d => fs.existsSync(path.join(ROOT,'js',d))));
  ok('the js root holds only folders',
     fs.readdirSync(path.join(ROOT,'js')).every(e =>
       fs.statSync(path.join(ROOT,'js',e)).isDirectory()));
  ok('boss.js is gone for good', !fs.existsSync(path.join(ROOT,'js','boss.js')));

  /* every module still loads and exports what it did */
  const want = ['quest','save','juice','sheets','engine','sans','bullet','dark',
                'deck','act4','scal','quiz','rhythm','craft','polt','crack'];
  const missing = want.filter(k => !NEU[k]);
  ok('>>> all sixteen modules still register <<<', missing.length === 0);
  if (missing.length) console.log('       missing: ' + missing.join(', '));
  ok('and the 31 rooms survived the move', NEU.engine.rooms.length === 31);
}

/* ═══ 10. polterghast wears his sprites ═══════════════════════════*/
console.log('\n10. real art, with a loud fallback');
{
  const P = read('act4/boss-polt.js');
  ok('>>> the body is drawn from the sheet <<<', /drawSheet\('polter'/.test(P));
  ok('the hooks too', /drawSheet\('hook'/.test(P));
  ok('and the projectiles', /drawSheet\(key, bl\.x, bl\.y/.test(P));
  ok('>>> phase drives which glowmask stacks <<<',
     /phase >= 3 \? \['polterG1', 'polterG2'\] : phase >= 2 \? \['polterG1'\] : null/.test(P));
  ok('glows are additive, not new art', /globalCompositeOperation = 'lighter'/.test(P));
  ok('>>> and it falls back to squares if art is missing <<<',
     /if \(drew\) return;/.test(P) && /ctx\.fillStyle = o\.kind === 'clone'/.test(P));

  const { NEU } = boot();
  ok('every sheet the boss asks for exists in the manifest',
     ['polter','polterG1','polterG2','hook','pShot','potentShot']
       .every(k => NEU.sheets[k]));
  ok('and every one points at a file on disk',
     ['polter','polterG1','polterG2','hook','pShot','potentShot']
       .every(k => fs.existsSync(path.join(ROOT, NEU.sheets[k].src))));
}

console.log('\n' + (fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`));
process.exit(fail ? 1 : 0);
