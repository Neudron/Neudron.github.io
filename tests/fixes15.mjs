/* fixes15.mjs — thumb controls (pending item 2.5, PLAN.md Phase 2.5).
   Run: node fixes15.mjs

   Act IV was keyboard-only. `core/touch.js` draws a stick and buttons
   and synthesises real KeyboardEvents, so no scene needed changing.

   The whole design rests on one assumption: every scene listens for
   `keydown`/`keyup` on `window` and switches on `e.key`. If any scene
   ever reads input another way, or starts checking `isTrusted`, touch
   silently stops working for that scene with no error. §1 pins that
   assumption down so it fails loudly instead.

   §5 is the one that matters most. A stuck direction key is the worst
   possible bug here — nothing releases it, and the player walks into a
   wall until they reload. Every exit path is tested. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');

const SCENES = [
  ['core/engine.js',   'engine'], ['act4/boss-scal.js', 'scal'],
  ['act4/boss-polt.js','polt'],   ['act4/quiz.js',      'quiz'],
  ['act4/rhythm.js',   'rhythm'], ['act4/craft.js',     'craft'],
  ['game/bullet.js',   'bullet'], ['game/dark.js',      'dark'],
  ['game/deck.js',     'deck'],   ['act4/shop.js',      'shop']
];

console.log('\n1. the assumption touch.js is built on');

for (const [f] of SCENES) {
  const s = read(f);
  ok(f + ': listens for keydown on window',
     /addEventListener\(\s*'keydown'/.test(s));
}
const anyTrusted = SCENES.some(([f]) => /isTrusted/.test(read(f)));
ok('>>> no scene rejects synthetic events (isTrusted) <<<', !anyTrusted);
if (anyTrusted)
  console.log('       a scene checks isTrusted — synthesised keys will be ignored there');

console.log('\n2. every scene answers "am I running?"');

for (const [f, name] of SCENES) {
  const s = read(f);
  ok(name + ': exposes a running flag',
     new RegExp('get running\\s*\\(\\)').test(s));
}

console.log('\n3. the profiles cover every scene, with the right keys');

const T = read('core/touch.js');
const profs = [...T.matchAll(/\{\s*id:\s*'([a-z0-9]+)'[\s\S]*?(?=[\r\n]{2,}\s*\{ id:|\s*\];)/g)]
  .map(m => ({ id: m[1], body: m[0] }));
ok('touch.js defines profiles (' + profs.length + ')', profs.length >= 9);

const covered = new Set(profs.map(p => p.id));
for (const [, name] of SCENES)
  ok(name + ': has a profile', covered.has(name));

/* Each profile's action key must be one the scene actually reads.
   A profile sending 'z' to a scene that only listens for 'Enter' looks
   fine in the source and does nothing on a phone. */
for (const [f, name] of SCENES) {
  const p = profs.find(x => x.id === name);
  if (!p) continue;
  const s = read(f);
  const a = (p.body.match(/\ba:\s*'([^']+)'/) || [])[1];
  const keysRead = new Set([...s.matchAll(/e\.key === '([^']+)'/g)].map(m => m[1]));
  /* case-insensitive: scenes test both 'e' and 'E' */
  const hit = a && ([...keysRead].some(k => k.toLowerCase() === a.toLowerCase()));
  ok('>>> ' + name + ": action key '" + a + "' is one it listens for <<<", !!hit);
  if (!hit) console.log('       it reads: ' + [...keysRead].join(' '));
}

/* focus mode only belongs where there are bullets to dodge */
for (const p of profs) {
  const wantsShift = /x:\s*'Shift'/.test(p.body);
  /* scal dropped Shift for a hold-to-charge phone layout (2026-08-27);
     polt + bullet still dodge with focus. */
  const isDanmaku = ['polt', 'bullet'].includes(p.id);
  ok(p.id + (wantsShift ? ': has focus mode' : ': no focus mode') +
     (isDanmaku ? ' (bullet hell)' : ''), wantsShift === isDanmaku);
}

/* Auto-repeat belongs on menus and nowhere else. On movement it
   stutters; in the rhythm game one flick is one note and a repeat
   would spam the lane. */
/* deck's Play/Quit are click buttons — no stick repeat needed. */
const MENUS = ['craft', 'shop'];
for (const p of profs) {
  const rep = /repeat:\s*true/.test(p.body);
  ok(p.id + ': repeat ' + (rep ? 'on' : 'off') +
     (MENUS.includes(p.id) ? ' (menu)' : ''), rep === MENUS.includes(p.id));
}
ok('no dead profile flags left behind', !/tapStick/.test(T));

console.log('\n4. it stays off desktop');

ok('checks for a coarse pointer', /pointer:\s*coarse/.test(T));
ok('a real touch also turns it on', /'touchstart'/.test(T));
ok('an explicit setting overrides both', /'on'/.test(T) && /'off'/.test(T));
ok('settings.js offers the override',
   /settTouch/.test(read('core/settings.js')));

console.log('\n5. keys can never stick  ← the one that matters');

ok('has a single release-everything path', /function releaseAll/.test(T));
for (const [what, re] of [
  ['pointercancel releases',   /'pointercancel'/],
  ['pointerleave releases',    /'pointerleave'/],
  ['window blur releases',     /addEventListener\('blur', releaseAll\)/],
  ['tab hidden releases',      /visibilitychange/],
  ['closing a scene releases', /if \(cur\) \{ releaseAll\(\)/],
  ['changing scene releases',  /releaseAll\(\);\s*\/\* never carry a key across scenes/],
  /* a timer that outlives its scene is the same bug as a stuck key */
  ['releaseAll also kills a running repeat',
    /function releaseAll\(\)\s*\{\s*killRepeat\(\)/],
  ['the stick hands its stopper to releaseAll', /killRepeat = stopRepeat/],
  /* LOW 15: releaseAll must also clear the stick pointer latch */
  ['releaseAll also clears the stick pointer latch', /clearStick\(\)/],
  ['clearStick is wired to end(null) (skips pointer-id guard)',
   /clearStick\s*=\s*function\s*\(\s*\)\s*\{\s*end\(null\)/],
  /* LOW 16: a physical keyup must invalidate the pad's held latch */
  ['physical keyup clears the pad latch', /held\[e\.key\]\s*=\s*false/]
]) ok(what, re.test(T));

console.log('\n6. behaviour, in a real DOM');

const dom = new JSDOM('<!doctype html><html><body>' +
  '<div id="tbox" hidden></div></body></html>',
  { pretendToBeVisual: true, url: 'https://www.neu.ac/', runScripts: 'outside-only' });
const w = dom.window;
w.matchMedia = q => ({ matches: /coarse/.test(q), addListener(){}, addEventListener(){} });
w.NEU = { juice: { hit(){} } };
try { w.eval(T); } catch (e) { console.log('  !! touch.js: ' + e.message); }

const NT = w.NEU.touch;
ok('NEU.touch exists', !!NT);

if (NT) {
  /* nothing running → nothing shown, nothing held */
  NT._sync();
  ok('hidden while no scene is running', !NT.visible);
  ok('holds no keys at rest', Object.keys(NT.held).length === 0);

  /* a scene starts */
  const seen = [];
  w.addEventListener('keydown', e => seen.push('+' + e.key));
  w.addEventListener('keyup',   e => seen.push('-' + e.key));

  w.NEU.engine = { running: true };
  NT._sync();
  ok('>>> shows once a scene is running <<<', NT.visible);
  ok('picks the right profile', NT.scene === 'engine');

  /* synthesised keys reach a normal window listener */
  NT._send('ArrowLeft', true);
  ok('>>> a synthesised keydown reaches window listeners <<<',
     seen.includes('+ArrowLeft'));
  ok('the key registers as held', !!NT.held.ArrowLeft);

  /* repeats are suppressed — the rhythm game scores per keydown */
  const before = seen.length;
  NT._send('ArrowLeft', true);
  ok('>>> a repeated press does not re-fire <<<', seen.length === before);

  /* release */
  NT._send('ArrowLeft', false);
  ok('keyup fires on release', seen.includes('-ArrowLeft'));

  /* two directions at once — diagonals must be possible */
  NT._send('ArrowLeft', true); NT._send('ArrowUp', true);
  ok('>>> two directions can be held at once (diagonals) <<<',
     !!NT.held.ArrowLeft && !!NT.held.ArrowUp);

  /* the scene ends while keys are down */
  w.NEU.engine.running = false;
  NT._sync();
  ok('>>> closing a scene releases every held key <<<',
     Object.keys(NT.held).length === 0);
  ok('and hides the pad', !NT.visible);

  /* the dialogue box takes over */
  w.NEU.engine.running = true;
  NT._sync();
  const shownBefore = NT.visible;
  w.document.getElementById('tbox').hidden = false;
  NT._sync();
  ok('shown before the box opens', shownBefore);
  ok('>>> hides while the dialogue box is up <<<', !NT.visible);
  w.document.getElementById('tbox').hidden = true;
  NT._sync();
  ok('and comes back when the box closes', NT.visible);

  /* the override */
  NT.set('off');
  ok('setting "off" hides it even mid-scene', !NT.visible);
  NT.set('auto');
  ok('setting "auto" brings it back on a coarse pointer', NT.visible);

  /* profile switch must not leak a key into the next scene */
  NT._send('ArrowRight', true);
  w.NEU.engine.running = false;
  w.NEU.scal = { running: true };
  NT._sync();
  ok('>>> switching scenes leaves no key held <<<',
     Object.keys(NT.held).length === 0);
  ok('and adopts the new profile', NT.scene === 'scal');

  /* LOW 15: releaseAll clears the stick's pointer latch */
  const stick = w.document.querySelector('.tpad__stick');
  if (stick) {
    stick.classList.add('is-down');
    NT._release();
    ok('>>> releaseAll removes the stuck stick class <<<', !stick.classList.contains('is-down'));
  } else {
    ok('stick element exists for the latch test', false);
  }

  /* LOW 16: a physical keyup clears the pad's held latch */
  NT._send('ArrowLeft', true);
  ok('pad holds ArrowLeft', !!NT.held.ArrowLeft);
  w.dispatchEvent(new w.KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
  ok('>>> physical keyup clears the pad latch <<<', !NT.held.ArrowLeft);
  /* re-sending should work now (the latch was cleared) */
  NT._send('ArrowLeft', true);
  ok('pad can re-arm after a physical keyup', !!NT.held.ArrowLeft);
}

console.log('\n7. it is wired in and does not break the rules');

const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok('index.html loads it', /src="js\/core\/touch\.js"/.test(HTML));
ok('loads after the scenes it polls',
   HTML.indexOf('js/core/touch.js') > HTML.indexOf('js/act4/crack.js'));

const CSS = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
ok('has styles', /\n\.tpad \{/.test(CSS));
/* the z-index ladder: above every scene, below the dialogue box */
const z = (CSS.match(/\.tpad \{[\s\S]*?z-index:\s*(\d+)/) || [])[1];
ok('sits above the scenes and below .tbox (' + z + ')',
   +z > 78 && +z < 96);
ok('touch-action is disabled so the page cannot scroll under it',
   /touch-action:\s*none/.test(CSS));
ok('targets are at least 44px',
   /min-width:\s*(\d+)px/.test(CSS) &&
   +CSS.match(/\.tpad__b \{[\s\S]*?min-width:\s*(\d+)px/)[1] >= 44);
ok('honours prefers-reduced-motion',
   /prefers-reduced-motion[\s\S]*?\.tpad__nub/.test(CSS));

/* house rule 3: ES5 only in shipped js */
ok('>>> no arrow functions in touch.js (ES5 rule) <<<', !/=>/.test(T));
ok('no let/const in touch.js', !/\b(let|const)\s/.test(T));
ok('no optional chaining', !/\?\./.test(T));

console.log(
  '\n' + (fail ? 'FAILURES: ' + fail + ' (passed ' + pass + ')' : 'ALL PASS (' + pass + ')'));
process.exit(fail ? 1 : 0);
