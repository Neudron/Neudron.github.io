/* fixes39.mjs — metric-matched font fallbacks (ultraplan A3).
   Run: node tests/fixes39.mjs

   The two Determination faces load with font-display: swap. Until they
   arrive the text is set in a local font, and when they swap in, a
   fallback with different metrics moves every line on the page. Two
   local faces, resized and re-spaced to the real faces' metrics, hold
   the text instead. Measured in Chromium against the shipped files: the
   same sentence at 32px is 1439.7 vs 1440 px (mono) and 1117.9 vs 1118
   px (sans), with the same 33 px line box; unadjusted it was 1728 and
   1275 px with a 37 px line box.

   jsdom has no font engine, so this suite holds the rules in place:
   the faces exist with every override, they point at local fonts only,
   and the page's stacks reach them before the generic families. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const FONTS = read('fonts/webfonts/stylesheet.css');
const CSS = read('css/style.css');
const face = name => {
  const m = FONTS.match(new RegExp("@font-face \\{[^}]*font-family: '" + name + "';[^}]*\\}"));
  return m ? m[0] : '';
};
const pct = (rule, prop) => {
  const m = rule.match(new RegExp(prop + ': ([\\d.]+)%;'));
  return m ? +m[1] : NaN;
};

console.log('\n1. the two fallback faces');
for (const [name, real, size] of [['Determination Mono Fallback', 'Determination Mono', 83.32],
                                  ['Determination Sans Fallback', 'Determination Sans', 87.7]]) {
  const r = face(name);
  ok(name + ' is declared', !!r);
  ok('  it uses local fonts only (no download)', /src: local\(/.test(r) && !/url\(/.test(r));
  ok('  size-adjust is the measured ' + size + '%', pct(r, 'size-adjust') === size);
  ok('  ascent, descent and line-gap are all overridden',
     pct(r, 'ascent-override') > 0 && pct(r, 'descent-override') > 0 && pct(r, 'line-gap-override') === 0);
  /* The line box the overrides make, in em of the specified size,
     must be the real face's (0.8125 + 0.2070 from its hhea table). */
  const box = (pct(r, 'ascent-override') + pct(r, 'descent-override')) * pct(r, 'size-adjust') / 1e4;
  ok('  >>> its line box is the real face\'s 1.0195 em (' + box.toFixed(4) + ') <<<', Math.abs(box - 1.0195) < 0.002);
  ok('  the real face is still the one that swaps in', /font-display: swap;/.test(face(real)));
}

console.log('\n2. the page reaches them');
const stack = token => { const m = CSS.match(new RegExp('\\n  ' + token + ':\\s+([^;]+);')); return m ? m[1] : ''; };
const before = (s, a, b) => s.indexOf(a) >= 0 && s.indexOf(b) > s.indexOf(a);
ok('>>> --font holds the mono fallback after the real face, before the generic ones <<<',
   before(stack('--font'), '"Determination Mono"', '"Determination Mono Fallback"') &&
   before(stack('--font'), '"Determination Mono Fallback"', 'ui-monospace'));
ok('--font keeps Pixelify Sans as the designed fallback ahead of it',
   before(stack('--font'), '"Pixelify Sans"', '"Determination Mono Fallback"'));
ok('>>> --font-display holds the sans fallback the same way <<<',
   before(stack('--font-display'), '"Determination Sans"', '"Determination Sans Fallback"') &&
   before(stack('--font-display'), '"Determination Sans Fallback"', 'ui-monospace'));
ok('the font stylesheet the faces live in is the one the page links',
   /href="fonts\/webfonts\/stylesheet\.css"/.test(read('index.html')));

console.log('');
console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`);
process.exit(fail ? 1 : 0);
