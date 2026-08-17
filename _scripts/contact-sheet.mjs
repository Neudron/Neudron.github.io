/* contact-sheet.mjs — make a sprite sheet legible to an actual eye.
   Run: node _scripts/contact-sheet.mjs <name> [cellHeight ...]

   `measure-sheets.mjs` answers "what is the frame period" with
   statistics. Statistics could not settle `heart` or `sepulcher`, and
   the honest next step is to look at the thing — but a 44x370 PNG on a
   transparent background is unreadable at native size, and the two
   slash sheets are 168x240 of dark red on nothing.

   So this builds a PNG you can actually read:
     - nearest-neighbour upscale (no smoothing, it is pixel art)
     - flattened onto a checkerboard, so transparent is visibly
       transparent rather than looking black
     - laid out as columns, one per candidate cell height, with a
       bright rule drawn at every cell boundary

   If a rule cuts through a sprite, that candidate is wrong. That is a
   thing you can see in one glance and cannot see in a table.

   Encoder included: PNG is zlib + a CRC table, and node ships both.
   Still no dependencies. */

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG = path.join(ROOT, 'site', 'img', 'act4', 'calamity');
const OUT = path.join(ROOT, '_scripts', 'out');

/* ── decode (same as measure-sheets.mjs, RGBA out) ────────────────*/
function decode(file) {
  const buf = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, depth = 0, type = 0, pal = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const tag = buf.toString('ascii', p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (tag === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; type = body[9]; }
    else if (tag === 'PLTE') pal = Buffer.from(body);
    else if (tag === 'tRNS') trns = Buffer.from(body);
    else if (tag === 'IDAT') idat.push(Buffer.from(body));
    else if (tag === 'IEND') break;
    p += 12 + len;
  }
  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * CH;
  const out = Buffer.alloc(h * stride);
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
      if (f === 1) v += a; else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  const px = new Uint8Array(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    const s = i * CH;
    let r, g, b, a = 255;
    if (type === 6) { r = out[s]; g = out[s + 1]; b = out[s + 2]; a = out[s + 3]; }
    else if (type === 2) { r = out[s]; g = out[s + 1]; b = out[s + 2]; }
    else if (type === 0) { r = g = b = out[s]; }
    else if (type === 4) { r = g = b = out[s]; a = out[s + 1]; }
    else { const ix = out[s]; r = pal[ix * 3]; g = pal[ix * 3 + 1]; b = pal[ix * 3 + 2];
           a = (trns && ix < trns.length) ? trns[ix] : 255; }
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = a;
  }
  return { w, h, px };
}

/* ── encode ───────────────────────────────────────────────────────*/
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c; }
  return t;
})();
function crc32(b) { let c = -1; for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(tag, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(tag, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encode(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy ? rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
             : Buffer.from(rgb.subarray(y * stride, (y + 1) * stride)).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ── compose ──────────────────────────────────────────────────────*/
const name = process.argv[2];
const cells = process.argv.slice(3).map(Number).filter(n => n > 0);
if (!name) { console.log('usage: node contact-sheet.mjs <File.png> [cellHeight ...]'); process.exit(1); }

const src = decode(path.join(IMG, name));
const S = Math.max(2, Math.min(8, Math.floor(700 / (src.w * Math.max(1, cells.length || 1)))));
const GUT = 14;
const cols = cells.length || 1;
const CW = src.w * S;
const W = cols * CW + (cols + 1) * GUT;
const H = src.h * S + 2 * GUT;
const rgb = Buffer.alloc(W * H * 3, 0x1a);

function put(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; rgb[i] = r; rgb[i + 1] = g; rgb[i + 2] = b;
}

for (let c = 0; c < cols; c++) {
  const ox = GUT + c * (CW + GUT), oy = GUT;
  for (let y = 0; y < src.h * S; y++) for (let x = 0; x < CW; x++) {
    const sx = (x / S) | 0, sy = (y / S) | 0;
    const i = (sy * src.w + sx) * 4;
    const a = src.px[i + 3] / 255;
    /* checkerboard under the alpha, 8 device px per square */
    const chk = (((x >> 3) + (y >> 3)) & 1) ? 0x3a : 0x2a;
    put(ox + x, oy + y,
        Math.round(src.px[i] * a + chk * (1 - a)),
        Math.round(src.px[i + 1] * a + chk * (1 - a)),
        Math.round(src.px[i + 2] * a + chk * (1 - a)));
  }
  /* cell rules */
  const fh = cells[c];
  if (fh) for (let k = 0; k * fh <= src.h; k++) {
    const y = oy + k * fh * S;
    for (let x = ox - 6; x < ox + CW + 6; x++) put(x, y, 0x00, 0xE5, 0xFF);
    for (let x = ox - 6; x < ox + CW + 6; x++) put(x, y + 1, 0x00, 0xE5, 0xFF);
  }
  for (let y = oy - 2; y < oy + src.h * S + 2; y++) { put(ox - 2, y, 0xFF, 0x3B, 0x8A); put(ox + CW + 1, y, 0xFF, 0x3B, 0x8A); }
}

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, name.replace(/\.png$/i, '') + '-sheet.png');
fs.writeFileSync(file, encode(W, H, rgb));
console.log('wrote ' + file + '  ' + W + 'x' + H + '  scale ' + S + 'x  cells: ' +
            (cells.length ? cells.join(', ') : 'none'));
