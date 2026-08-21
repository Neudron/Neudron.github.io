#!/usr/bin/env node
/* Generates apple-touch-icon.png — a 180x180 PNG matching the favicon's
   design: near-black bg (#08080B) with italic 'n' in #EDE7DE.
   No build step, no npm install — just node + zlib. */
const fs = require('fs');
const zlib = require('zlib');

const W = 180, H = 180;
const BG = [0x08, 0x08, 0x0B];
const FG = [0xED, 0xE7, 0xDE];

const pixels = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const idx = (y * W + x) * 4;
    // Rounded corners (radius 40)
    const r = 40;
    let inside = true;
    if (x < r && y < r && Math.hypot(r - x, r - y) > r) inside = false;
    if (x > W - r - 1 && y < r && Math.hypot(x - (W - r - 1), r - y) > r) inside = false;
    if (x < r && y > H - r - 1 && Math.hypot(r - x, y - (H - r - 1)) > r) inside = false;
    if (x > W - r - 1 && y > H - r - 1 && Math.hypot(x - (W - r - 1), y - (H - r - 1)) > r) inside = false;

    if (!inside) {
      pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
      continue;
    }

    let R = BG[0], G = BG[1], B = BG[2];

    // 'n' shape: two vertical stems + connecting arc
    const inLeftStem  = x >= 55 && x <= 68 && y >= 50 && y <= 130;
    const inRightStem = x >= 112 && x <= 125 && y >= 50 && y <= 130;
    const arcCx = 90, arcCy = 55, arcRx = 35, arcRy = 22;
    const adx = (x - arcCx) / arcRx, ady = (y - arcCy) / arcRy;
    const inArcTop = (adx*adx + ady*ady) <= 1.0 && y >= 50 && y <= 72;

    if (inLeftStem || inRightStem || inArcTop) {
      R = FG[0]; G = FG[1]; B = FG[2];
    }

    pixels[idx] = R; pixels[idx+1] = G; pixels[idx+2] = B; pixels[idx+3] = 255;
  }
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  pixels.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const idat = zlib.deflateSync(raw);

const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync('apple-touch-icon.png', png);
console.log('Created apple-touch-icon.png: ' + png.length + ' bytes (' + W + 'x' + H + ')');
