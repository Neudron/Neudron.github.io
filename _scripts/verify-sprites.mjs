/* verify-sprites.mjs — prove every shipped Calamity sprite is a faithful
   crop of the current upstream texture (github.com/CalamityTeam/
   CalamityModPublic @ 1.4.4), freshly downloaded into _sources/calamity/.

   ────────────────────────────────────────────────────────────────────
   WHY. The sprites were cropped by hand across several sessions from
   wiki GIFs and older atlas dumps. Upstream moves; a crop that was
   right in August can silently be stale by October, and nothing in the
   jsdom suites can see pixels. This walks img/act4/calamity/*.png,
   decodes both the shipped file and its upstream counterpart, and
   answers one question per file: is the shipped image EXACTLY this
   upstream file, or EXACTLY a sub-region of it (after trimming fully-
   transparent borders off both)?

   Verdicts:
     EXACT        identical dimensions and bytes
     CROP @x,y    shipped appears verbatim inside upstream at that offset
     TRIMMED      equal after transparent-border trim (same art, less padding)
     MISMATCH     decodes, overlaps, but differs — re-crop needed
     NO-SOURCE    no upstream counterpart (custom recolor / wiki-only)
     SKIP         not a .png

   Usage: node _scripts/verify-sprites.mjs [--quiet]
   ──────────────────────────────────────────────────────────────────── */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHIP_DIR = path.join(ROOT, 'img', 'act4', 'calamity');
const SRC_DIR = path.join(ROOT, '_sources', 'calamity');

/* ── minimal PNG decode ───────────────────────────────────────────── */

function decodePNG(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error('not a png');
  let pos = 8, ihdr = null, idat = [], plte = null, trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4),
        depth: data[8], colorType: data[9],
        compression: data[10], filter: data[11], interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const { width: w, height: h, depth, colorType, interlace } = ihdr;
  if (interlace) throw new Error('interlaced png unsupported');
  if (depth !== 8) throw new Error('bit depth ' + depth + ' unsupported');

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('colorType ' + colorType + ' unsupported');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const px = new Uint8Array(w * h * 4);          /* always out RGBA */

  let p = 0;
  const prev = new Uint8Array(stride);
  const line = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    for (let i = 0; i < stride; i++, p++) {
      const x = line[i], b = raw[p];
      const a = i >= channels ? line[i - channels] : 0;
      const up = prev[i];
      const ul = i >= channels ? prev[i - channels] : 0;
      let v;
      switch (ft) {
        case 0: v = b; break;
        case 1: v = b + a; break;
        case 2: v = b + up; break;
        case 3: v = b + ((a + up) >> 1); break;
        case 4: {
          const pa = Math.abs(up - ul), pb = Math.abs(a - ul), pc = Math.abs(a + up - 2 * ul);
          v = b + (pa <= pb && pa <= pc ? a : pb <= pc ? up : ul);
          break;
        }
        default: throw new Error('filter ' + ft);
      }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * channels;
      if (colorType === 0) { const g = line[s]; px[o] = px[o + 1] = px[o + 2] = g; px[o + 3] = 255; }
      else if (colorType === 4) { const g = line[s]; px[o] = px[o + 1] = px[o + 2] = g; px[o + 3] = line[s + 1]; }
      else if (colorType === 2) { px[o] = line[s]; px[o + 1] = line[s + 1]; px[o + 2] = line[s + 2]; px[o + 3] = 255; }
      else if (colorType === 6) { px[o] = line[s]; px[o + 1] = line[s + 1]; px[o + 2] = line[s + 2]; px[o + 3] = line[s + 3]; }
      else if (colorType === 3) {
        const idx = line[s] * 3;
        px[o] = plte[idx]; px[o + 1] = plte[idx + 1]; px[o + 2] = plte[idx + 2];
        px[o + 3] = trns && idx / 3 < trns.length ? trns[idx / 3] : 255;
      }
    }
    prev.set(line);
  }
  return { w, h, px };
}

/* ── comparison helpers ───────────────────────────────────────────── */

function boundsOf(img) {           /* tight box of non-transparent px */
  const { w, h, px } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] !== 0) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function regionEqual(A, ox, oy, B) {  /* B inside A at offset — exact bytes */
  const { w: aw, h: ah, px: ap } = A, { w: bw, h: bh, px: bp } = B;
  return regionSub(ap, aw, ah, bp, bw, bh, ox, oy);
}
function regionSub(ap, aw, ah, bp, bw, bh, ox, oy) {
  if (ox < 0 || oy < 0 || ox + bw > aw || oy + bh > ah) return false;
  for (let y = 0; y < bh; y++) {
    const ao = ((oy + y) * aw + ox) * 4, bo = y * bw * 4;
    for (let i = 0; i < bw * 4; i++) if (ap[ao + i] !== bp[bo + i]) return false;
  }
  return true;
}

/* ── shipped → upstream name map ──────────────────────────────────── */

const MAP = {
  'scal-forcefield.png': 'ForcefieldTexture.png',
  'scal-shield-top.png': 'SupremeShieldTop.png',
  'scal-shield-bottom.png': 'SupremeShieldBottom.png',
  'scal-head-hood.png': 'HoodedHeadIcon.png',
  'scal-head.png': 'HoodlessHeadIcon.png',
  'rage-bar.png': 'RageBar.png',
  'rage-bar-border.png': 'RageBarBorder.png',
  'rage-full-anim.png': 'RageFullAnimation.png',
};
const direct = f => f;                            /* same name upstream */

/* ── run ──────────────────────────────────────────────────────────── */

export { decodePNG, boundsOf, cropImg, findSub };

const isMain = process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();

function main() {
const quiet = process.argv.includes('--quiet');
const shippedFiles = fs.readdirSync(SHIP_DIR).filter(f => f.endsWith('.png')).sort();
const rows = [];
let bad = 0, nosrc = 0, good = 0;

for (const f of shippedFiles) {
  const upName = MAP[f] || direct(f);
  const upPath = path.join(SRC_DIR, upName);
  if (!fs.existsSync(upPath)) {
    rows.push([f, upName, 'NO-SOURCE', '(custom recolor or non-GitHub origin)']);
    nosrc++;
    continue;
  }
  let ship, up;
  try {
    ship = decodePNG(fs.readFileSync(path.join(SHIP_DIR, f)));
    up = decodePNG(fs.readFileSync(upPath));
  } catch (e) {
    rows.push([f, upName, 'DECODE-ERR', e.message]); bad++;
    continue;
  }

  let verdict, extra = '';
  if (ship.w === up.w && ship.h === up.h && Buffer.from(ship.px).equals(Buffer.from(up.px))) {
    verdict = 'EXACT';
  } else {
    /* try verbatim sub-region first … */
    const hit = findSub(up, ship);
    if (hit) verdict = 'CROP @' + hit.x + ',' + hit.y;
    else {
      /* … then trimmed-on-both-sides equality */
      const bs = boundsOf(ship), bu = boundsOf(up);
      if (!bs || !bu) { verdict = 'MISMATCH'; extra = 'one side fully transparent'; }
      else {
        const tS = cropImg(ship, bs), tU = cropImg(up, bu);
        if (tS.w === tU.w && tS.h === tU.h && Buffer.from(tS.px).equals(Buffer.from(tU.px)))
          verdict = 'TRIMMED-EQUAL (' + bs.w + 'x' + bs.h + ' of ' + bu.w + 'x' + bu.h + ')';
        else {
          const hit2 = findSub(tU, tS);
          verdict = hit2 ? 'TRIMMED-CROP @' + hit2.x + ',' + hit2.y : 'MISMATCH';
          if (!hit2) extra = 'shipped ' + ship.w + 'x' + ship.h + ' vs upstream ' + up.w + 'x' + up.h;
        }
      }
    }
  }  if (/EXACT|CROP|TRIMMED/.test(verdict)) good++; else bad++;
  rows.push([f, upName, verdict, extra]);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('shipped', 30) + pad('upstream', 30) + 'verdict');
console.log('─'.repeat(104));
for (const [f, u, v, e] of rows) console.log(pad(f, 30) + pad(u, 30) + pad(v, 34) + e);
console.log('─'.repeat(104));
console.log(good + ' verified, ' + bad + ' MISMATCH/ERR, ' + nosrc + ' no-source');
process.exitCode = bad ? 1 : 0;
}

/* helpers used above, defined last so the report reads first */
function findSub(big, small) {
  const { w: aw, h: ah, px: ap } = big, { w: bw, h: bh, px: bp } = small;
  if (bw > aw || bh > ah) return null;
  let sy = -1;
  for (let y = 0; y < bh && sy < 0; y++)
    for (let x = 0; x < bw; x++) if (bp[(y * bw + x) * 4 + 3] !== 0) { sy = y; break; }
  if (sy < 0) return null;
  const so = sy * bw * 4;
  for (let oy = 0; oy + bh <= ah; oy++) {
    const rowBase = (oy + sy) * aw * 4;
    outer:
    for (let ox = 0; ox + bw <= aw; ox++) {
      const ao = rowBase + ox * 4;
      for (let i = 0; i < bw * 4; i += 4) {
        if (bp[so + i + 3] === 0) continue;
        if (ap[ao + i] !== bp[so + i] || ap[ao + i + 1] !== bp[so + i + 1] ||
            ap[ao + i + 2] !== bp[so + i + 2] || ap[ao + i + 3] !== bp[so + i + 3]) continue outer;
      }
      for (let y = 0; y < bh; y++) {
        const a = ((oy + y) * aw + ox) * 4, b = y * bw * 4;
        for (let i = 0; i < bw * 4; i++) if (ap[a + i] !== bp[b + i]) continue outer;
      }
      return { x: ox, y: oy };
    }
  }
  return null;
}
function cropImg(img, r) {
  const out = new Uint8Array(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++)
      for (let c = 0; c < 4; c++)
        out[(y * r.w + x) * 4 + c] = img.px[((r.y + y) * img.w + (r.x + x)) * 4 + c];
  return { w: r.w, h: r.h, px: out };
}
