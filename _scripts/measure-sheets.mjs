/* measure-sheets.mjs — settle the provisional frame counts with data.
   Run: node _scripts/measure-sheets.mjs

   `data/sheets.js` carries five entries marked `provisional: true` and
   two marked `verify: 'orientation'`. The frame count of a Terraria /
   Calamity sheet does not live in the PNG — it lives in the mod's C#
   (`Main.npcFrameCount[type]`) — so the numbers in the manifest were
   best-fit rather than measured. This measures them.

   NO DEPENDENCIES. A PNG is IHDR + zlib(IDAT) + per-scanline filters,
   and node ships zlib, so decoding one is about eighty lines. Adding
   an image library to a project whose first rule is "no build step"
   to answer seven questions would be the wrong trade.

   THE METHOD
   1. Decode the alpha channel.
   2. A row is "content" if any pixel has alpha > 12. The threshold is
      not 0 because faint antialiasing in the gutters welds adjacent
      cells together and turns eight frames into one.
   3. Count the bands of content separated by empty rows. If the sheet
      has clean gutters, that count IS the frame count.
   4. Cross-check: height must divide by that count, and every band
      must sit inside its own cell. If either fails, the sheet is
      reported AMBIGUOUS and nothing is claimed.

   Step 4 is the point. A script that always produces a number is
   worse than one that admits which sheets it cannot settle. */

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG = path.join(ROOT, 'site', 'img', 'act4');

/* ── the smallest PNG decoder that answers the question ───────────*/
function decode(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');

  let p = 8, w = 0, h = 0, depth = 0, type = 0, pal = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const tag = buf.toString('ascii', p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (tag === 'IHDR') {
      w = body.readUInt32BE(0); h = body.readUInt32BE(4);
      depth = body[8]; type = body[9];
      if (body[12] !== 0) throw new Error('interlaced png not supported');
    } else if (tag === 'PLTE') pal = Buffer.from(body);
    else if (tag === 'tRNS') trns = Buffer.from(body);
    else if (tag === 'IDAT') idat.push(Buffer.from(body));
    else if (tag === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error('bit depth ' + depth + ' not supported');

  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!CH) throw new Error('colour type ' + type + ' not supported');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * CH;
  const out = Buffer.alloc(h * stride);

  /* Undo the five PNG scanline filters. Each row names its own. */
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= CH ? cur[x - CH] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= CH) ? prev[x - CH] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }

  /* Alpha per pixel, whatever the colour type. */
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * stride + x * CH;
    let a = 255;
    if (type === 6) a = out[i + 3];
    else if (type === 4) a = out[i + 1];
    else if (type === 3 && trns) { const ix = out[i]; a = ix < trns.length ? trns[ix] : 255; }
    alpha[y * w + x] = a;
  }
  return { w, h, type, alpha };
}

const T = 12;   /* alpha threshold; see the header */

/* ── WHY BAND COUNTING WAS THROWN AWAY ────────────────────────────
   The first version of this script counted bands of content separated
   by empty rows and called that the frame count. Run against the six
   sheets whose counts are already confirmed, it got three of them
   wrong:

     ashes   6 frames -> measured 7   (a sprite with a transparent
                                       row through its middle reads
                                       as two frames)
     scal   21 frames -> measured 19  (two pairs of frames touch
                                       across the gutter and weld
                                       into one band)
     dart    4 frames -> the bands cross cell edges (the sprite
                                       bleeds into its neighbour)

   Those controls are the only reason this is not now sitting in the
   manifest as fact. A measurement that cannot reproduce the answers
   you already know is not a measurement.

   WHAT REPLACED IT. Frame height must divide the sheet height, so
   there are only ever a handful of candidates. Score each one:

     - reject it if any cell comes out completely empty (an empty
       frame is not a frame, and this is what stops "twice as many
       half-height frames" always scoring perfectly)
     - otherwise score = how much ink sits ON the cut lines, relative
       to the average row. Gutters are nearly empty, so the true frame
       height puts the cuts in the gaps and scores near zero.

   Tolerant of both failure modes above: an internal transparent row
   costs nothing, and a little welding raises the score slightly
   without moving the minimum. The runner-up is printed too, because
   a winner that barely beats the next candidate is a coin toss and
   should be visible as one. */
function rowMass(img) {
  const m = new Float64Array(img.h);
  for (let y = 0; y < img.h; y++) {
    let s = 0;
    for (let x = 0; x < img.w; x++) { const a = img.alpha[y * img.w + x]; if (a > T) s += a; }
    m[y] = s;
  }
  return m;
}

/* Physical bounds, not fudge factors. A frame cell in this art is
   never 4 pixels tall and a sheet never holds 360 of them; without
   these the profile correlates with itself at tiny lags on pure pixel
   noise and "90 frames of 4px" wins. Both numbers are far outside the
   real range (smallest real cell here is 24, largest real count 21). */
const MIN_FH = 16, MAX_N = 40;

function divisors(h) {
  const out = [];
  for (let d = MIN_FH; d <= h / 2; d++) if (h % d === 0 && h / d <= MAX_N) out.push(d);
  return out;
}

/* SECOND METHOD, ALSO THROWN AWAY: least ink on the cut lines. It
   reproduced 1 control out of 6, because the metric is biased. Two
   frames means one cut line, and one cut line that happens to land in
   a gap scores a perfect zero; twenty-one frames means twenty chances
   to clip a pixel. It ranked `heart` as 2 frames with score 0.000 and
   `polter` as 2 frames instead of 12. Fewer cuts is not better art,
   it is just fewer cuts.

   THIRD METHOD, THE ONE BELOW: autocorrelation. "These cells are
   frames of one animation" means the row profile REPEATS with period
   fh. So correlate the profile against itself shifted by each
   candidate fh and take the smallest period that correlates, because
   every multiple of the true period correlates too.

   This is honest about its own failure: an animation whose frames
   genuinely differ (a blast that grows) will not correlate, and the
   sheet is reported AMBIGUOUS rather than given a number. */
function pearson(m, lag, h) {
  const n = h - lag;
  if (n < 8) return 0;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += m[i]; sb += m[i + lag]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = m[i] - ma, y = m[i + lag] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return (da > 0 && db > 0) ? num / Math.sqrt(da * db) : 0;
}

function scoreFrames(img) {
  const m = rowMass(img);
  const avg = m.reduce((a, b) => a + b, 0) / img.h;
  if (avg === 0) return [];
  const out = [];
  for (const fh of divisors(img.h)) {
    const n = img.h / fh;
    if (n < 2) continue;
    let empty = false;
    for (let k = 0; k < n && !empty; k++) {
      let s = 0;
      for (let y = k * fh; y < (k + 1) * fh; y++) s += m[y];
      if (s === 0) empty = true;
    }
    if (empty) continue;
    let cut = 0, cuts = 0;
    for (let k = 1; k < n; k++) { cut += m[k * fh - 1] + m[k * fh]; cuts += 2; }
    out.push({ fh, n, corr: pearson(m, fh, img.h), ink: cuts ? (cut / cuts) / avg : 1 });
  }
  /* Smallest period that correlates wins; everything else is ranked
     under it so the runner-up is still visible. */
  /* STRONGEST period wins, not the smallest. "Smallest that clears a
     threshold" was the previous rule and it reproduced 3 controls out
     of 6: a row profile correlates weakly with itself at almost any
     small lag, so hellblast came out as 44 frames of 4px (r 0.67)
     while its real answer, 4 frames of 44px, was sitting right there
     at r 0.98. Ties within 0.03 go to the smaller cell, since a true
     period always correlates at its multiples too. */
  out.sort(function (a, b) {
    if (Math.abs(a.corr - b.corr) > 0.03) return b.corr - a.corr;
    return a.fh - b.fh;
  });
  return out;
}

function bands(img) {
  const rows = [];
  for (let y = 0; y < img.h; y++) {
    let on = false;
    for (let x = 0; x < img.w; x++) if (img.alpha[y * img.w + x] > T) { on = true; break; }
    rows.push(on);
  }
  const out = [];
  let start = -1;
  for (let y = 0; y < img.h; y++) {
    if (rows[y] && start < 0) start = y;
    if (!rows[y] && start >= 0) { out.push([start, y - 1]); start = -1; }
  }
  if (start >= 0) out.push([start, img.h - 1]);
  return out;
}

/* Vertical centre of mass of the opaque pixels, 0 = top, 1 = bottom.
   Used only for the two slash sheets. */
function centroidY(img, y0, y1) {
  let sum = 0, n = 0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < img.w; x++) {
    const a = img.alpha[y * img.w + x];
    if (a > T) { sum += (y - y0) * a; n += a; }
  }
  return n ? sum / n / (y1 - y0 || 1) : 0.5;
}

/* ── the manifest entries under question ──────────────────────────*/
const CASES = [
  ['fireblast', 'calamity/SCalBrimstoneFireblast.png', 5, 'provisional'],
  ['gigablast', 'calamity/SCalBrimstoneGigablast.png', 6, 'provisional'],
  ['sepulcher', 'calamity/SepulcherHead.png',          2, 'provisional'],
  ['heart',     'calamity/BrimstoneHeart.png',         5, 'provisional'],
  ['hook',      'calamity/PolterghastHook.png',        2, 'provisional'],
  /* known-good controls: if the method disagrees with these, the
     method is wrong, not the manifest. */
  ['dart',      'calamity/BrimstoneBarrage.png',       4, 'confirmed'],
  ['hellblast', 'calamity/BrimstoneHellblast2.png',    4, 'confirmed'],
  ['ashes',     'calamity/AshesofAnnihilation.png',    6, 'confirmed'],
  ['polter',    'calamity/Polterghast.png',           12, 'confirmed'],
  ['scal',      'calamity/SupremeCalamitas.png',      21, 'confirmed'],
  ['fist',      'calamity/SupremeCataclysmFist.png',   4, 'confirmed'],
  ['slashTop',  'calamity/SupremeCatastropheSlash.png',    4, 'orientation'],
  ['slashBot',  'calamity/SupremeCatastropheSlashAlt.png', 4, 'orientation']
];

console.log('sheet        dims        says  best fh/n  corr    2nd          verdict');
console.log('-'.repeat(86));

const results = [];
let controlsOk = 0, controlsRun = 0;

for (const [name, rel, claimed, kind] of CASES) {
  const file = path.join(IMG, rel);
  if (!fs.existsSync(file)) { console.log(name.padEnd(13) + 'MISSING ' + rel); continue; }
  let img;
  try { img = decode(file); }
  catch (e) { console.log(name.padEnd(13) + 'DECODE FAILED: ' + e.message); continue; }

  const s = scoreFrames(img);
  const best = s[0], second = s[1];
  const n = best ? best.n : null;

  /* Only a correlated candidate counts. Anything below the threshold
     is the script saying it does not know. */
  const clear = !!best && best.corr >= 0.60;

  const agrees = n === claimed;
  const verdict = !best ? 'NO CANDIDATE'
                : !clear ? 'AMBIGUOUS (no period correlates)'
                : agrees ? 'CONFIRMS manifest'
                : 'DISAGREES -> ' + n + ' frames';

  if (kind === 'confirmed') { controlsRun++; if (agrees && clear) controlsOk++; }

  console.log(
    name.padEnd(13) +
    (img.w + 'x' + img.h).padEnd(12) +
    String(claimed).padEnd(6) +
    (best ? best.fh + '/' + best.n : '-').padEnd(11) +
    (best ? best.corr.toFixed(3) : '-').padEnd(8) +
    (second ? second.fh + '/' + second.n + ' r' + second.corr.toFixed(2) : '-').padEnd(12) +
    verdict);

  results.push({ name, kind, claimed, measured: n, best, second, clear, agrees, img });
}

console.log('\ncontrols (sheets whose count is already confirmed): ' +
            controlsOk + '/' + controlsRun + ' reproduced');
if (controlsOk !== controlsRun) {
  console.log('  >> THE METHOD IS WRONG, NOT THE MANIFEST. Do not write any');
  console.log('     of the numbers above into data/sheets.js.');
}

/* ── raw evidence for anything that did not settle ────────────────
   When the verdict is AMBIGUOUS or DISAGREES the useful output is not
   another number, it is the shape of the sheet, so a human can settle
   it in one look with the dev inspector. */
const unsettled = results.filter(r => r.kind !== 'confirmed' &&
                                      (!r.clear || !r.agrees) && r.kind !== 'orientation');
if (unsettled.length) {
  console.log('\nunsettled sheets: content bands (alpha > ' + T + ')');
  console.log('-'.repeat(78));
  for (const r of unsettled) {
    const b = bands(r.img);
    console.log('  ' + r.name + '  ' + r.img.w + 'x' + r.img.h +
                '  manifest says ' + r.claimed + ' frames of ' +
                (r.img.h / r.claimed) + 'px');
    console.log('    ' + b.length + ' band(s): ' +
                b.map(([a, z]) => a + '-' + z + ' (' + (z - a + 1) + 'px)').join(', '));
    const divs = [];
    for (let d = 1; d <= r.img.h; d++) if (r.img.h % d === 0) divs.push(d);
    console.log('    possible cell heights: ' + divs.filter(d => d >= 16 && r.img.h / d <= 40).join(', '));
  }
}

/* ── the two slash sheets ─────────────────────────────────────────*/
console.log('\nslash orientation');
console.log('-'.repeat(78));
for (const r of results.filter(r => r.kind === 'orientation')) {
  const fh = r.best ? r.best.fh : r.img.h;
  const c = centroidY(r.img, 0, fh - 1);
  console.log('  ' + r.name.padEnd(11) +
              'frame 0 centre of mass at ' + (c * 100).toFixed(1) + '% down its cell' +
              (c < 0.45 ? '  (mass sits HIGH)' : c > 0.55 ? '  (mass sits LOW)' : '  (centred)'));
}
console.log('\n  Centre of mass is a hint, not a proof: which sheet the mod');
console.log('  uses for the upper arc is decided by `ai[1] == 0` in its C#,');
console.log('  and that does not travel with the image. Reported, not decided.');
