/* pad-sheet.mjs — add transparent rows to the bottom of a sprite sheet.
   Run: node _scripts/pad-sheet.mjs BrimstoneHeart.png 372

   WHY THIS EXISTS, once, for one file.

   `BrimstoneHeart.png` holds six heartbeat frames. Looked at with the
   cell rules drawn on (`contact-sheet.mjs`), the 62px grid is obviously
   the right one — every rule lands in the gap between two hearts, and
   the 74px grid the manifest used cuts through frames three, four and
   five.

   But the file is 370 rows tall and 6 x 62 is 372. The sheet is two
   rows short of its own grid, which is what a scraper does when it
   trims fully-transparent edges on the way out. So this is restoring
   the grid the art was drawn on, not inventing one.

   Two transparent rows. Nothing visible changes. It makes
   `frames * fh === h` exact again, which is an invariant fixes7 checks
   and which has caught real bugs — worth more than leaving a special
   case in it.

   REVERSING IT: crop the last 2 rows, or re-download the file from the
   Calamity wiki and set `heart` back to `h: 370`. See memory/assets.md.

   The encoder writes colour type 6 (RGBA). A sprite sheet flattened to
   RGB would lose every transparent pixel, which is the entire image. */

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG = path.join(ROOT, 'site', 'img', 'act4', 'calamity');

const name = process.argv[2], want = Number(process.argv[3]);
if (!name || !want) { console.log('usage: node pad-sheet.mjs <File.png> <newHeight>'); process.exit(1); }
const file = path.join(IMG, name);

/* ── decode to RGBA ───────────────────────────────────────────────*/
function decode(buf) {
  let p = 8, w = 0, h = 0, type = 0, pal = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const tag = buf.toString('ascii', p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (tag === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4);
      if (body[8] !== 8) throw new Error('bit depth ' + body[8]); type = body[9]; }
    else if (tag === 'PLTE') pal = Buffer.from(body);
    else if (tag === 'tRNS') trns = Buffer.from(body);
    else if (tag === 'IDAT') idat.push(Buffer.from(body));
    else if (tag === 'IEND') break;
    p += 12 + len;
  }
  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * CH;
  const flat = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = flat.subarray(y * stride, (y + 1) * stride);
    const prev = y ? flat.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= CH ? cur[x - CH] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= CH) ? prev[x - CH] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    const s = i * CH;
    let r, g, b, al = 255;
    if (type === 6) { r = flat[s]; g = flat[s + 1]; b = flat[s + 2]; al = flat[s + 3]; }
    else if (type === 2) { r = flat[s]; g = flat[s + 1]; b = flat[s + 2]; }
    else if (type === 0) { r = g = b = flat[s]; }
    else if (type === 4) { r = g = b = flat[s]; al = flat[s + 1]; }
    else { const ix = flat[s]; r = pal[ix * 3]; g = pal[ix * 3 + 1]; b = pal[ix * 3 + 2];
           al = (trns && ix < trns.length) ? trns[ix] : 255; }
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = al;
  }
  return { w, h, px };
}

/* ── encode RGBA ──────────────────────────────────────────────────*/
const CRC = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t; })();
function crc32(b) { let c = -1; for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(tag, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(tag, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encode(w, h, px) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const src = decode(fs.readFileSync(file));
if (src.h === want) { console.log(name + ' is already ' + want + ' tall; nothing to do'); process.exit(0); }
if (want < src.h) { console.log('refusing to SHRINK ' + src.h + ' -> ' + want); process.exit(1); }

const out = Buffer.alloc(src.w * want * 4, 0);          /* 0 = fully transparent */
src.px.copy(out, 0);
const bytes = encode(src.w, want, out);
/* The backup goes OUTSIDE site/. Left next to the original it would be
   picked up by the mirror and deployed — a second copy of every sheet
   anyone ever pads, shipped forever. */
const bak = path.join(ROOT, '_scripts', 'orig');
fs.mkdirSync(bak, { recursive: true });
fs.copyFileSync(file, path.join(bak, name + '.orig'));
fs.writeFileSync(file, bytes);

/* Prove it round-tripped: same size, same pixels in the original rows. */
const back = decode(fs.readFileSync(file));
let same = back.w === src.w && back.h === want;
for (let i = 0; same && i < src.px.length; i++) if (back.px[i] !== src.px[i]) same = false;
console.log(name + ': ' + src.h + ' -> ' + want + ' rows, backup at _scripts/orig/' + name + '.orig');
console.log('round-trip identical in the original rows: ' + same);
if (!same) process.exit(1);
