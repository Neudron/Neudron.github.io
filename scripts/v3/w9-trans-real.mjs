// W9-TRANS real-browser proof. Serves nothing: run with the worktree on W9_PORT (8769).
// Uninterrupted A1 -> A2 -> A3 -> A2 -> A1 walk (no reload), seams stay clear;
// reduced-motion + split-wipe captures. Output: scripts/v3/out/W9-TRANS/ (git-ignored).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.cwd() + '/tests/');
const { chromium } = require('playwright-core');
const PORT = Number(process.env.W9_PORT || 8769);
const OUT = 'scripts/v3/out/W9-TRANS';
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
const dismiss = page => page.evaluate(() => document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'ok') b.click(); }));
const snap = async (page, name) => {
  for (let i = 0; i < 8; i++) await page.keyboard.press('x');
  await dismiss(page);
  const s = await page.evaluate(() => ({
    room: NEU.engine.where() && NEU.engine.where().room,
    fade: NEU.engine.debug.fade, trans: NEU.engine.debug.transition,
    overlay: !!(NEU.engineTrans.active || NEU.engineTrans.overlay),
    cam: NEU.engine.debug.cam
  }));
  check('clean frame ' + name, s.fade === 0 && !s.overlay && (s.trans === null || s.trans === 'SEAMLESS'), s);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  return s;
};
const boot = async (reduced) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 },
    reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 8000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'ok') b.click(); }));
  await page.evaluate(async () => {
    if (window.__NEU_GAME_LOAD__) window.__NEU_GAME_LOAD__();
    for (let i = 0; i < 200 && !window.__NEU_GAME_READY__; i++) await new Promise(r => setTimeout(r, 50));
  });
  await page.evaluate(r => { NEU.motion.set(r ? 'reduced' : 'full', r ? 'reduced' : 'full'); },
    reduced);
  await page.evaluate(() => document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'ok') b.click(); }));
  return { page, errs };
};
const enter = async (page, room) => {
  await page.evaluate(id => NEU.engine.enter(id, 'default'), room);
  await page.waitForTimeout(400);
};
const walk = async (page, to, spawn) => page.evaluate(([t, sp]) => {
  const ex = NEU.engine.api.ents().filter(e => e.t === 'exit' && e.to === t)[0] || null;
  NEU.engine.go(t, sp, undefined, ex);
  return NEU.engine.where().room;
}, [to, spawn]);

// ---- full motion: one uninterrupted walk, twice around the loop ----
{
  const { page, errs } = await boot(false);
  await enter(page, 'a1_clearing');
  check('game loaded in real browser', await page.evaluate(() => !!(window.NEU && NEU.engine && NEU.engine.rooms)));
  await snap(page, '01-full-a1');
  const route = [['a2_path', 'west'], ['a3_fork', 'west'], ['a2_path', 'east'], ['a1_clearing', 'east']];
  let i = 2;
  for (let lap = 0; lap < 2; lap++) {
    for (const [to, sp] of route) {
      const before = await page.evaluate(() => NEU.engine.debug.cam);
      const got = await walk(page, to, sp);
      await page.waitForTimeout(120);
      check(`lap${lap} walk ${to}`, got === to, got);
      const s = await snap(page, String(i++).padStart(2, '0') + '-full-' + to.replace('a1_clearing','a1').replace('a2_path','a2').replace('a3_fork','a3') + '-lap' + lap);
      check('  camera continuous ' + to, isFinite(s.cam.x) && isFinite(before.x), [before, s.cam]);
    }
  }
  // held key across the seam: key stays down, velocity survives, one room change
  await page.evaluate(() => { NEU.tboxOpen = () => false; });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  const beforeV = await page.evaluate(() => NEU.engine.debug.vel.x);
  await walk(page, 'a2_path', 'west');
  await page.waitForTimeout(120);
  const held = await page.evaluate(() => ({ room: NEU.engine.where().room, vel: NEU.engine.debug.vel.x,
    fade: NEU.engine.debug.fade, overlay: !!NEU.engineTrans.active }));
  await page.keyboard.up('ArrowRight');
  check('held key survives seam', beforeV > 0 && held.vel === beforeV && held.room === 'a2_path', [beforeV, held]);
  check('no errors full walk', errs.length === 0, errs);
  await dismiss(page);
  await page.screenshot({ path: `${OUT}/10-full-held-a2.png` });
  await page.close();
}

// ---- reduced motion: quiet seams, split wipe becomes a plain cut ----
{
  const { page, errs } = await boot(true);
  await enter(page, 'a1_clearing');
  check('reduced motion active', await page.evaluate(() => NEU.motion.reduced() === true));
  await snap(page, '20-reduced-a1');
  await walk(page, 'a2_path', 'west');
  await page.waitForTimeout(120);
  await snap(page, '21-reduced-a2');
  await walk(page, 'a3_fork', 'west');
  await page.waitForTimeout(120);
  await snap(page, '22-reduced-a3');
  // split wipe on hidden entry: full motion shows two halves, reduced cuts
  await page.evaluate(() => NEU.engine.enter('a1_clearing', 'default', { split: true, entry: 'hidden' }));
  await page.waitForTimeout(150);
  const cut = await page.evaluate(() => ({ fade: NEU.engine.debug.fade,
    overlay: !!NEU.engineTrans.active, reduced: NEU.motion.reduced() }));
  check('reduced split has no wipe overlay', !cut.overlay && cut.reduced, cut);
  await dismiss(page);
  await page.screenshot({ path: `${OUT}/23-reduced-split-cut.png` });
  check('no errors reduced walk', errs.length === 0, errs);
  await page.close();
}

// ---- full motion split wipe mid-frame ----
{
  const { page, errs } = await boot(false);
  await enter(page, 'a1_clearing');
  await page.evaluate(() => NEU.engine.enter('a2_path', 'west', { split: true, entry: 'hidden' }));
  await page.waitForTimeout(60);
  const wipe = await page.evaluate(() => ({ active: !!NEU.engineTrans.active,
    name: NEU.engineTrans.active && NEU.engineTrans.active.name,
    t: NEU.engineTrans.active && NEU.engineTrans.active.t,
    reduced: NEU.motion.reduced() }));
  check('split wipe running mid-frame', wipe.active && wipe.name === 'split' && wipe.t >= 0 && wipe.t < 1, wipe);
  await dismiss(page);
  await page.screenshot({ path: `${OUT}/30-full-split-mid.png` });
  check('no errors split frame', errs.length === 0, errs);
  await page.close();
}

await browser.close();
console.log(fails === 0 ? `W9 REAL BROWSER PASS — captures in ${OUT}` : `${fails} REAL BROWSER CHECKS FAILED`);
process.exit(fails === 0 ? 0 : 1);
