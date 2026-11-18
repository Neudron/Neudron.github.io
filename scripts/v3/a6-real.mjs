// node scripts/v3/a6-real.mjs — A6V real-browser proof, no js/** edits.
// Serves nothing: run with the built dist on A6V_PORT (default 8931).
// R1 = five real trusted physical-key hits (one on a remapped lane).
// R6/R7 = two synthetic-blur -> consumed click -> explicit Escape resume cycles.
// Blur is SYNTHETIC: window.dispatchEvent(new Event('blur')). Keys and clicks are real.
// Captures: scripts/v3/out/w3/A6V/ (git-ignored). Modern JS allowed under scripts/.
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(process.cwd() + '/tests/');
const { chromium } = require('playwright-core');

const PORT = Number(process.env.A6V_PORT || 8931);
const OUT = 'scripts/v3/out/w3/A6V';
fs.mkdirSync(OUT, { recursive: true });
const cache = process.env.HOME + '/.cache/ms-playwright';
const dir = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
if (!dir) { console.error('no chromium build in ' + cache); process.exit(2); }
const browser = await chromium.launch({ executablePath: `${cache}/${dir}/chrome-linux/chrome`, headless: true });

let fails = 0;
const check = (name, cond, detail) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : ' :: ' + JSON.stringify(detail)));
  if (!cond) fails++;
};
const state = page => page.evaluate(() => ({
  running: !!(window.NEU && NEU.rhythm && NEU.rhythm.running),
  paused: !!(window.NEU && NEU.rhythm && NEU.rhythm.state && NEU.rhythm.state.paused),
  judged: window.NEU && NEU.rhythm && NEU.rhythm.state ? NEU.rhythm.state.judged : -1,
  score: window.NEU && NEU.rhythm && NEU.rhythm.state ? NEU.rhythm.state.score : -1,
  leave: !!document.getElementById('confirmExit'),
  visibleLeave: [...document.querySelectorAll('[role="alertdialog"]')].some(el => el.getClientRects().length > 0)
}));
const snap = async (page, name) => {
  const overlay = await page.evaluate(() => ({
    okButton: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'ok'),
    leave: !!document.getElementById('confirmExit')
  }));
  check('capture clean (no overlay): ' + name, !overlay.okButton && !overlay.leave, overlay);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const tag = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  const dismiss = () => page.evaluate(() => document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'ok') b.click(); }));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 8000 });
  await page.waitForTimeout(600);
  await dismiss();
  await page.evaluate(async () => {
    if (window.__NEU_GAME_LOAD__) window.__NEU_GAME_LOAD__();
    for (let i = 0; i < 200 && !window.__NEU_GAME_READY__; i++) await new Promise(r => setTimeout(r, 50));
  });
  check('real game bundle loaded ' + tag, await page.evaluate(() => !!(window.NEU && window.NEU.rhythm && typeof NEU.rhythm.open === 'function' && NEU.rhythm.notes && NEU.rhythm.state)));
  await page.evaluate(() => { if (window.NEU && NEU.motion && NEU.motion.set) NEU.motion.set('full', 'full'); });
  await dismiss();

  // ---- R1: five trusted physical-key hits, at least one on the remapped lane ----
  await page.evaluate(() => { NEU.keys.reset(); NEU.keys.set('a', 'j'); NEU.rhythm.open(); });
  await page.waitForFunction(() => window.NEU && NEU.rhythm && NEU.rhythm.notes && NEU.rhythm.notes.length > 0, null, { timeout: 5000 });
  const route = await page.evaluate(() => ({ get: NEU.keys.get('a'), route: NEU.keys.route('j') }));
  check('a remapped to j, j routes to a ' + tag, route.get === 'j' && route.route.to === 'a' && route.route.swallow === false, route);

  const sp0 = await page.evaluate(() => NEU.rhythm.songPos());
  await page.waitForTimeout(200);
  const sp1 = await page.evaluate(() => NEU.rhythm.songPos());
  check('audio clock advances ' + tag, sp1 > sp0, { sp0, sp1 });

  const targets = await page.evaluate(() => NEU.rhythm.notes
    .filter(n => n.mine && !n.done && !n.kind && n.t > 1.5 && n.t < 16)
    .sort((a, b) => a.t - b.t).slice(0, 12).map(n => ({ t: n.t, lane: n.lane })));
  let picks = targets.slice(0, 5);
  if (!picks.some(n => n.lane === 0) && targets.some(n => n.lane === 0))
    picks[4] = targets.find(n => n.lane === 0);
  check('five hittable notes available ' + tag, picks.length === 5, picks);
  const keyFor = lane => (lane === 0 ? 'j' : lane === 1 ? 's' : lane === 2 ? 'w' : 'd');

  let hits = 0, remapped = 0;
  const before = await state(page);
  for (const n of picks) {
    await page.waitForFunction(t => window.NEU.rhythm.songPos() >= t, n.t - 0.045, { polling: 'raf', timeout: 20000 });
    const key = keyFor(n.lane);
    await page.keyboard.press(key, { delay: 24 });
    const res = await page.evaluate(t => {
      const note = NEU.rhythm.notes.filter(x => x.mine && !x.kind && Math.abs(x.t - t) < 0.001)[0];
      return { hit: !!(note && note.hit), done: !!(note && note.done) };
    }, n.t);
    if (res.hit) { hits++; if (key === 'j') remapped++; }
    check(`trusted hit t=${n.t.toFixed(3)} lane=${n.lane} key=${key} ${tag}`, res.hit, res);
  }
  const after = await state(page);
  console.log(`R1 judged=${after.judged - before.judged} hits=${hits}/5 remappedHits=${remapped} size=${tag}`);
  check('R1 >=5 trusted hits ' + tag, hits >= 5, { hits });
  check('R1 remapped key among hits ' + tag, remapped >= 1, { remapped });

  // ---- R6 correction: first refocus click consumed & still paused; Escape resumes ----
  for (let cycle = 1; cycle <= 2; cycle++) {
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // SYNTHETIC blur
    await page.waitForTimeout(120);
    const paused = await state(page);
    check(`cycle${cycle} synthetic blur pauses ${tag}`, paused.paused === true && !paused.leave, paused);
    await snap(page, `paused-${tag}-cycle${cycle}-synthetic-blur`);

    const pt = await page.evaluate(() => {
      const r = document.getElementById('fnf').getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await page.mouse.click(pt.x, pt.y); // real click; consumed by refocus guard
    await page.waitForTimeout(120);
    const clicked = await state(page);
    check(`cycle${cycle} first click consumed, still paused, no leave ${tag}`,
      clicked.paused === true && !clicked.leave && !clicked.visibleLeave, clicked);
    await snap(page, `after-click-${tag}-cycle${cycle}-synthetic-blur`);

    await page.keyboard.press('Escape'); // explicit resume
    await page.waitForTimeout(120);
    const resumed = await state(page);
    console.log(`R7 cycle=${cycle} size=${tag} resumed=${resumed.paused === false} leavePrompt=${resumed.leave || resumed.visibleLeave}`);
    check(`cycle${cycle} explicit Escape resumes ${tag}`,
      resumed.paused === false && !resumed.leave && !resumed.visibleLeave, resumed);
    await snap(page, `after-resume-${tag}-cycle${cycle}`);
  }

  check('no page errors ' + tag, errs.length === 0, errs);
  console.log('no errors ' + tag);
  await page.close();
}

await browser.close();
console.log(fails ? `A6V FAIL (${fails})` : 'A6V PASS');
process.exit(fails ? 1 : 0);
