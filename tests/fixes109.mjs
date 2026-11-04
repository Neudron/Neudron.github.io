/* fixes109.mjs — dark room cache-hit frames must clear the canvas.
   Run: node tests/fixes109.mjs

   A still player hits the litCv cache every frame. The cache-hit branch
   drew the finished torch frame source-over onto an uncleared canvas, so
   every lighter overlay from earlier frames stacked into white squares.
   This drives dark.js with a recording ctx, stands still for 30 frames and
   checks that each cache-hit frame clears the canvas before drawImage. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };

const dom = new JSDOM('<!doctype html><body><div id="dk" hidden><canvas id="dkCanvas"></canvas></div></body>',
                      { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
const frames = [];                       /* ops per rAF frame on the main canvas */
let queued = null, mainCv = null, cur = null;
w.requestAnimationFrame = (cb) => { queued = cb; return 1; };

function makeCtx(cv) {
  const st = { fillStyle: '', globalCompositeOperation: 'source-over' };
  return new Proxy({}, {
    get(t, k) {
      if (k in st) return st[k];
      if (k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'measureText') return () => ({ width: 0 });
      return (...a) => { if (cv === mainCv && cur) cur.push([k, a]); return undefined; };
    },
    set(t, k, v) { st[k] = v; return true; },
  });
}
w.HTMLCanvasElement.prototype.getContext = function () {
  if (!this._ctx) this._ctx = makeCtx(this);
  if (!mainCv && this.id === 'dkCanvas') mainCv = this;
  return this._ctx;
};

w.NEU = {};
w.eval(fs.readFileSync(path.join(ROOT, 'js', 'game', 'dark.js'), 'utf8'));
w.NEU.dark.open({ endless: false });
for (let i = 0; i < 30 && queued; i++) {
  const f = queued; queued = null;
  cur = []; f(i * 16 + 16);
  frames.push(cur); cur = null;
}

/* A cache-hit frame starts with save(); a miss frame starts with fillRect. */
const hits = frames.filter((ops) => ops.length && ops[0][0] === 'save');
ok('dark run produced frames', frames.length >= 10);
ok('still player hits the cache on later frames', hits.length >= 10);
const cleared = hits.every((ops) => {
  const di = ops.findIndex((o) => o[0] === 'drawImage');
  const ci = ops.findIndex((o) => o[0] === 'clearRect');
  return di > 0 && ci >= 0 && ci < di && ops[ci][1][2] === mainCv.width && ops[ci][1][3] === mainCv.height;
});
ok('cache-hit frame clears the full canvas before drawImage(litCv)', cleared);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
