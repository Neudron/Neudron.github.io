// scripts/v3/w9read-cvd.mjs — VIP-12 (W9-READ) real-browser evidence.
// Grayscale + CVD (deuteranopia / protanopia) screenshots of every boss that
// draws through the shared danmaku hitbox/bar, plus the colour baseline.
// Run from the worktree root with a static server on SHOT_PORT (default 8790):
//   python3 -m http.server 8790 --bind 127.0.0.1 &
//   SHOT_PORT=8790 node scripts/v3/w9read-cvd.mjs
// Scripts may use modern JS (only js/** is ES5-gated).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.cwd() + '/tests/');
const { chromium } = require('playwright-core');
const CACHE = process.env.HOME + '/.cache/ms-playwright';
const exe = fs.readdirSync(CACHE).find(d => d.startsWith('chromium_headless_shell'));
const PORT = process.env.SHOT_PORT || 8790;
const OUT = 'scripts/v3/out/W9-READ';
fs.mkdirSync(OUT, { recursive: true });

// SVG feColorMatrix approximations (Vienot et al.) for dichromacy.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" style="position:absolute"><defs>` +
  `<filter id="cvd-deutan" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0"/></filter>` +
  `<filter id="cvd-protan" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0"/></filter>` +
  `</defs></svg>`;
const FILTERS = [
  ['color', 'none'],
  ['grayscale', 'grayscale(1)'],
  ['deuteranopia', 'url(#cvd-deutan)'],
  ['protanopia', 'url(#cvd-protan)']
];
// dismiss first-run + photosensitivity notes, then release the sim hold
const DISMISS = `document.querySelectorAll('button').forEach(function(x){var t=x.textContent.trim();if(t==='ok'||t==='no')x.click();});if(NEU.juice){NEU.juice._reset&&NEU.juice._reset();NEU.juice.pause(false);}`;

const BOSSES = [
  { key: 'bullet', setup: `
      NEU.dev.run('game'); ${DISMISS}
      NEU.bullet.soul.focus = true;
      var bx = NEU.bullet.box, B = NEU.bullet.bullets;
      var cx = bx.AX + bx.AW/2, cy = bx.AY + bx.AH/2;
      var cols = ['#B892FF','#E24A6A','#EDE7DE','#4FC3F7','#8A8598'];
      for (var i=0;i<26;i++){ var a=i*(Math.PI*2/26), rr=44+(i%4)*46;
        B.push({x:cx+Math.cos(a)*rr, y:cy+Math.sin(a)*rr, vx:0, vy:0,
                r:(i%3===0?3:4), c:cols[i%cols.length], k:0, age:0}); }`, wait: 300 },
  { key: 'scal', setup: `
      NEU.dev.run('reset scal'); ${DISMISS}
      NEU.scal.invincible(true); NEU.scal.simulate(7);
      NEU.scal.hold(true); NEU.scal.drawFrame();`, wait: 300 },
  { key: 'polt', setup: `NEU.dev.run('reset polt'); ${DISMISS}`, wait: 4200 },
  { key: 'draedon', setup: `NEU.dev.run('reset draedon'); ${DISMISS}`, wait: 4200 },
  { key: 'exo', setup: `NEU.dev.run('reset exo'); ${DISMISS} NEU.exo.pick('ares');`, wait: 4200 }
];

const b = await chromium.launch({ executablePath: `${CACHE}/${exe}/chrome-linux/headless_shell` });
let bad = 0;
for (const boss of BOSSES) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  try {
    await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 8000 });
    await p.waitForTimeout(600);
    await p.evaluate(DISMISS);
    await p.evaluate(boss.setup);
    await p.waitForTimeout(boss.wait);
    await p.evaluate(DISMISS);           // a flash note may appear on open
    // freeze the sim so all four filters capture the identical frame
    await p.evaluate(() => { if (NEU.juice) NEU.juice.pause(true); });
    await p.evaluate(html => { document.body.insertAdjacentHTML('beforeend', html); }, SVG);
    await p.waitForTimeout(120);
    const state = await p.evaluate(() => ({
      cur: NEU.kernel && NEU.kernel.current(),
      frozen: !!(NEU.juice && NEU.juice.frozen && NEU.juice.frozen()),
      bulletN: NEU.bullet && NEU.bullet.bullets.length,
      scalShots: NEU.scal && NEU.scal.shots,
      poltShots: NEU.polt && NEU.polt.state.shots,
      draedonAttack: NEU.draedon && NEU.draedon.state.attack,
      exoAttack: NEU.exo && NEU.exo.state.attack,
      exoMode: NEU.exo && NEU.exo.state.mode
    }));
    for (const [name, css] of FILTERS) {
      await p.evaluate(v => { document.body.style.filter = v; }, css);
      await p.waitForTimeout(140);
      const out = `${OUT}/${boss.key}-${name}.png`;
      await p.screenshot({ path: out });
    }
    await p.evaluate(() => { document.body.style.filter = 'none'; });
    console.log(boss.key, JSON.stringify(state), errs.length ? 'ERR:' + errs.slice(0, 3).join(' | ') : 'clean');
    if (errs.length) bad++;
  } catch (e) {
    console.log(boss.key, 'FAILED', e.message);
    bad++;
  }
  await p.close();
}
await b.close();
console.log(bad ? `${bad} boss(es) with page errors` : 'all bosses captured with no page errors');
process.exit(bad ? 1 : 0);
