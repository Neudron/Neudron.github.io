/* fixes26.mjs — F10: the classic script order in index.html.
   Run: node tests/fixes26.mjs

   Nothing here is bundled. Every file under js/ is a classic <script>
   tag that runs in document order, and several of them reach into
   window.NEU at load time. A tag moved to the wrong side of its
   dependency does not fail a build, because there is no build: it
   throws on boot, or quietly reads undefined, and the first sign is a
   page that half works. The order lives only in index.html.

   This suite reads index.html the way the parser does — comments
   removed, module and importmap tags set aside — and checks the result
   against an explicit fixture written below. Changing the order on
   purpose means changing the fixture AND the rule it breaks. The
   dependency rules are the ones the code actually relies on, not a
   guess at what a sensible order looks like. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* Today's real order, copied from index.html. The fixture is the point:
   a reorder must show up here as a diff, not as a surprise at boot. */
const FIXTURE = [
  'js/data/data.js', 'js/page/main.js', 'js/page/stars.js',
  'js/core/quest.js', 'js/core/save.js', 'js/core/juice.js', 'js/core/danmaku.js',
  'js/data/sheets.js', 'js/core/engine-look.js', 'js/core/engine-kinds.js', 'js/core/engine.js',
  'js/game/sword.js', 'js/game/sans.js', 'js/game/bullet.js', 'js/game/dark.js',
  'js/act4/act4.js', 'js/act4/rooms-a.js', 'js/act4/rooms-d.js', 'js/act4/shop.js',
  'js/act4/boss-scal.js', 'js/act4/scal-worm.js', 'js/act4/scal-seekers.js',
  'js/act4/rooms-g.js', 'js/act4/quiz.js', 'js/act4/rhythm.js', 'js/act4/craft.js',
  'js/act4/boss-polt.js', 'js/act4/crack.js', 'js/game/deck.js',
  'js/core/music.js', 'js/core/perf.js', 'js/core/settings.js', 'js/core/touch.js',
  'js/core/dev.js'
];

/* ── 1. parse index.html the way the parser sees it ───────────────*/
console.log('\n1. what index.html loads, in order');
{
  /* A commented-out tag is not a loaded script. */
  const live = HTML.replace(/<!--[\s\S]*?-->/g, '');
  const tags = [...live.matchAll(/<script\b([^>]*)>/gi)].map(m => {
    const attrs = m[1];
    const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || 'classic';
    const src = (attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
    return { type, src };
  });
  const classic = tags.filter(t => t.type === 'classic' && t.src).map(t => t.src);
  const modules = tags.filter(t => t.type === 'module').map(t => t.src);

  ok('the parser finds the classic script tags', classic.length > 0);
  ok('every classic script is a js/ file', classic.every(s => s.startsWith('js/')));
  ok('the only module script is js/page/scene.js', modules.length === 1 && modules[0] === 'js/page/scene.js');

  for (let i = 0; i < classic.length; i += 4)
    console.log('       ' + classic.slice(i, i + 4).map((s, j) =>
      String(i + j + 1).padStart(2) + ' ' + s.replace(/^js\//, '')).join('   '));

  /* ── 2. the fixture ─────────────────────────────────────────── */
  console.log('\n2. the order matches the fixture');
  ok(`${classic.length} classic scripts, fixture has ${FIXTURE.length}`, classic.length === FIXTURE.length);
  ok('the page loads exactly the fixture order',
     JSON.stringify(classic) === JSON.stringify(FIXTURE));
  ok('no script is listed twice', new Set(classic).size === classic.length);
  ok('every fixture entry exists on disk', FIXTURE.every(f => fs.existsSync(path.join(ROOT, f))));

  /* Every js/ file is either a classic script or the module entry —
     a new file that nobody adds to index.html would never run. */
  const all = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) all.push(path.relative(ROOT, p).split(path.sep).join('/'));
    }
  })(path.join(ROOT, 'js'));
  const orphan = all.filter(f => !classic.includes(f) && !modules.includes(f));
  ok(`every one of the ${all.length} js/ files is loaded by index.html`, orphan.length === 0);
  if (orphan.length) console.log('       not loaded: ' + orphan.join(', '));

  /* ── 3. js/core/ — each file exactly once ───────────────────── */
  console.log('\n3. js/core/ is loaded once per file');
  const core = fs.readdirSync(path.join(ROOT, 'js/core')).filter(f => f.endsWith('.js'))
                 .map(f => 'js/core/' + f);
  const counts = core.map(f => [f, classic.filter(s => s === f).length]);
  ok(`js/core/ has ${core.length} files, each listed exactly once`,
     counts.every(([, n]) => n === 1));
  for (const [f, n] of counts) if (n !== 1) console.log('       ' + f + ' listed ' + n + ' times');

  /* ── 4. dependency rules the code relies on ─────────────────── */
  console.log('\n4. dependency rules');
  const at = f => classic.indexOf(f);
  const Q = 'js/core/quest.js', SV = 'js/core/save.js', SH = 'js/data/sheets.js',
        E = 'js/core/engine.js', M = 'js/core/music.js', T = 'js/core/touch.js';
  const gameAct4 = classic.filter(f => /^js\/(game|act4)\//.test(f));
  const rooms = classic.filter(f => /^js\/act4\/rooms-[^/]+\.js$/.test(f));

  ok('core/quest.js loads before core/save.js', at(Q) >= 0 && at(Q) < at(SV));

  const saveLate = gameAct4.filter(f => !(at(SV) < at(f)));
  ok(`core/save.js loads before all ${gameAct4.length} game/ and act4/ scripts`,
     gameAct4.length > 0 && saveLate.length === 0);
  if (saveLate.length) console.log('       too early: ' + saveLate.join(', '));

  ok('data/sheets.js loads before core/engine.js', at(SH) >= 0 && at(SH) < at(E));
  /* engine v2: the look kit and the kinds registry load before the sim */
  ok('core/engine-look.js and core/engine-kinds.js load before core/engine.js',
     at('js/core/engine-look.js') >= 0 && at('js/core/engine-kinds.js') >= 0 &&
     at('js/core/engine-look.js') < at(E) && at('js/core/engine-kinds.js') < at(E));

  const roomsEarly = rooms.filter(f => !(at(E) < at(f)));
  ok(`core/engine.js loads before all ${rooms.length} act4/rooms-*.js`,
     rooms.length > 0 && roomsEarly.length === 0);

  const musicEarly = gameAct4.filter(f => !(at(M) > at(f)));
  ok('core/music.js loads after every game/ and act4/ script',
     gameAct4.length > 0 && musicEarly.length === 0);
  if (musicEarly.length) console.log('       before music: ' + musicEarly.join(', '));

  const touchEarly = gameAct4.filter(f => !(at(T) > at(f)));
  ok('core/touch.js loads after every game/ and act4/ script',
     gameAct4.length > 0 && touchEarly.length === 0);
  if (touchEarly.length) console.log('       before touch: ' + touchEarly.join(', '));

  ok('core/dev.js is the last classic script',
     classic[classic.length - 1] === 'js/core/dev.js');
}

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
