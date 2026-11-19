// w8-real.mjs — W8-ROOMS real-browser two-exits-deep-and-back proof.
// Serves nothing: run against built dist on W8_PORT (default 8932).
// For each district: warp to the shipped anchor, walk the two-way socket
// two exits deep and back via the real engine.go transition, asserting the
// room + named spawn at every step. Screenshots at both viewports land in
// scripts/v3/out/W8-ROOMS/ (git-ignored). Modern JS allowed under scripts/.
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(process.cwd() + '/tests/');
const { chromium } = require('playwright-core');

const PORT = Number(process.env.W8_PORT || 8932);
const OUT = 'scripts/v3/out/W8-ROOMS';
fs.mkdirSync(OUT, { recursive: true });

/* `anchor` is the public alias; the engine resolves woods/city to their
   physical room (a1_clearing / d1_street) and area-spawn overrides the
   named landing, so anchor steps assert room only, never spawn. */
const D = [
  { key: 'woods', anchor: 'a_woods', resolved: 'a1_clearing', in: 'from_forest_trail', first: 'wex_woods_01', out: 'from_wex_woods_01',
    to2: 'from_wex_woods_01_east', second: 'wex_woods_02', back: 'from_wex_woods_02_west' },
  { key: 'city', anchor: 'd_city', resolved: 'd1_street', in: 'from_city_street', first: 'wex_city_01', out: 'from_wex_city_01',
    to2: 'from_wex_city_01_east', second: 'wex_city_02', back: 'from_wex_city_02_west' },
  { key: 'savanna', anchor: 's0_sand', resolved: 's0_sand', in: 'from_sand_path', first: 'wex_savanna_01', out: 'from_wex_savanna_01',
    to2: 'from_wex_savanna_01_east', second: 'wex_savanna_02', back: 'from_wex_savanna_02_west' },
  { key: 'lab', anchor: 'e5_dad', resolved: 'e5_dad', in: 'from_home_study', first: 'wex_lab_01', out: 'from_wex_lab_01',
    to2: 'from_wex_lab_01_east', second: 'wex_lab_02', back: 'from_wex_lab_02_west' }
];

const cache = process.env.HOME + '/.cache/ms-playwright';
const dir = fs.readdirSync(cache).filter(x => /^chromium-\d+$/.test(x)).sort().pop();
if (!dir) { console.error('no chromium build in ' + cache); process.exit(2); }
const browser = await chromium.launch({ executablePath: `${cache}/${dir}/chrome-linux/chrome`, headless: true });

let fails = 0;
const check = (name, cond, detail) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : ' :: ' + JSON.stringify(detail)));
  if (!cond) fails++;
};
const dismiss = page => page.evaluate(() => document.querySelectorAll('button').forEach(b => {
  if (b.textContent.trim() === 'ok') b.click();
}));
const where = page => page.evaluate(() => (window.NEU && NEU.engine && NEU.engine.where) ? NEU.engine.where() : null);
const go = async (page, to, spawn, tag, expectRoom, expectSpawn) => {
  const room = expectRoom || to, sp = expectSpawn === undefined ? spawn : expectSpawn;
  await page.evaluate(([t, s]) => { NEU.engine.go(t, s); }, [to, spawn]);
  let w = null;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(100);
    w = await where(page);
    if (w && w.room === room) break;
  }
  check(tag + ' -> ' + to + ' @' + spawn, !!w && w.room === room && (sp === null || w.spawn === sp), w);
  await page.waitForTimeout(350); // let any physical door transition finish before the shot
};
const shot = async (page, name) => {
  await dismiss(page); // clear first-run motion notice / any 'ok' prompt before the frame
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const tag = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 10000 });
  await page.waitForTimeout(600);
  await dismiss(page);
  await page.evaluate(async () => {
    if (window.__NEU_GAME_LOAD__) window.__NEU_GAME_LOAD__();
    for (let i = 0; i < 200 && !window.__NEU_GAME_READY__; i++) await new Promise(r => setTimeout(r, 50));
    if (window.NEU && NEU.motion && NEU.motion.set) NEU.motion.set('full', 'full');
  });
  check('game bundle loaded ' + tag, await page.evaluate(() => !!(window.NEU && NEU.engine && typeof NEU.engine.go === 'function')));
  check('all 100 wex rooms registered ' + tag,
    await page.evaluate(() => NEU.engine.rooms.filter(id => /^wex_/.test(id)).length) === 100);
  await dismiss(page);

  for (const d of D) {
    // warp to the shipped anchor using the named return spawn our hook added
    await page.evaluate(([a, s]) => NEU.engine.enter(a, s), [d.anchor, d.out]);
    await page.waitForTimeout(450);
    let w0 = await where(page);
    check(tag + ' ' + d.key + ': start at ' + d.anchor + ' (' + d.resolved + ')', !!w0 && w0.room === d.resolved, w0);
    await shot(page, `${tag}-${d.key}-0-anchor`);

    await go(page, d.first, d.in, `${tag} ${d.key}: anchor socket`);
    await shot(page, `${tag}-${d.key}-1-entry`);

    await go(page, d.second, d.to2, `${tag} ${d.key}: exit 1 deep`);
    await shot(page, `${tag}-${d.key}-2-deep`);

    await go(page, d.first, d.back, `${tag} ${d.key}: back exit 1`);
    await go(page, d.anchor, d.out, `${tag} ${d.key}: back to anchor`, d.resolved, null);
    await shot(page, `${tag}-${d.key}-3-return`);
  }

  check('no page/console errors ' + tag, errs.length === 0, errs.slice(0, 6));
  await page.close();
}

await browser.close();
console.log('\nW8-ROOMS real browser: ' + (fails === 0 ? 'ALL PASS' : fails + ' FAILED'));
process.exit(fails ? 1 : 0);
