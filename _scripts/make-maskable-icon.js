#!/usr/bin/env node
/* Generates icon-512.png — the 512x512 MASKABLE install icon (manifest
   D1). Same design as make-apple-icon.js (near-black, the italic-ish 'n'
   in bone), but full-bleed — a maskable icon must paint every pixel,
   the launcher crops it — and the glyph is scaled to sit well inside
   the 80% safe-zone circle (radius 205px), so no mask can clip it.
   The 'n' is the exact shape from make-apple-icon.js, sampled through a
   coordinate map rather than redrawn, so the two icons cannot drift.
   No build step, no npm install — just node + zlib. */
const fs = require('fs');
const zlib = require('zlib');

const W = 512, H = 512;
const BG = [0x08, 0x08, 0x0B];
const FG = [0xED, 0xE7, 0xDE];
const K = 3;                 /* 180-space -> 512-space scale */
const CX = 90, CY = 90;      /* the glyph's centre in 180-space */

/* the 'n' from make-apple-icon.js, in its own 180px coordinates */
function inGlyph(x, y) {
  const inLeftStem  = x >= 55 && x <= 68 && y >= 50 && y <= 130;
  const inRightStem = x >= 112 && x <= 125 && y >= 50 && y <= 130;
  const adx = (x - 90) / 35, ady = (y - 55) / 22;
  const inArcTop = (adx * adx + ady * ady) <= 1.0 && y >= 50 && y <= 72;
  return inLeftStem || inRightStem || inArcTop;
}

const pixels = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const u = (x + 0.5 - W / 2) / K + CX, v = (y + 0.5 - H / 2) / K + CY;
    const c = inGlyph(u, v) ? FG : BG;
    pixels[i] = c[0]; pixels[i + 1] = c[1]; pixels[i + 2] = c[2]; pixels[i + 3] = 255;
  }
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; pixels.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync('icon-512.png', png);
console.log('Created icon-512.png: ' + png.length + ' bytes (' + W + 'x' + H + ', maskable)');
