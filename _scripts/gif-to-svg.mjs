/* gif-to-svg.mjs — decode a GIF's first frame and emit a pixel-art SVG.
   Usage: node _scripts/gif-to-svg.mjs <input.gif> <output.svg> [palette-map]
   palette-map is optional: JSON like {"#ffffff":"H"} to rename colors.
   The output matches the format make-sprites.mjs produces: one <rect> per
   horizontal run of same-colour pixels, crispEdges, aria-label.        */

import fs from 'node:fs';

const [, , inPath, outPath, paletteMapArg] = process.argv;
if (!inPath || !outPath) { console.error('usage: gif-to-svg.mjs <in.gif> <out.svg>'); process.exit(1); }

const paletteMap = paletteMapArg ? JSON.parse(fs.readFileSync(paletteMapArg, 'utf8')) : null;

const buf = fs.readFileSync(inPath);
const w = buf.readUInt16LE(6), h = buf.readUInt16LE(8);
const packed = buf[10];
const hasGCT = (packed & 0x80) !== 0;
const ctSize = 1 << ((packed & 0x07) + 1);
const ctOffset = 13;
const palette = [];
for (let i = 0; i < ctSize; i++)
  palette.push([buf[ctOffset + i * 3], buf[ctOffset + i * 3 + 1], buf[ctOffset + i * 3 + 2]]);
let pos = ctOffset + ctSize * 3;

// Find image descriptor (0x2C) or skip extensions (0x21)
while (pos < buf.length) {
  if (buf[pos] === 0x2C) break;
  if (buf[pos] === 0x21) {
    pos += 2;
    while (buf[pos] !== 0) pos += buf[pos] + 1;
    pos++;
  } else { pos++; }
}
if (pos >= buf.length) { console.error('No image descriptor found'); process.exit(1); }

const imgW = buf.readUInt16LE(pos + 5), imgH = buf.readUInt16LE(pos + 7);
const imgPacked = buf[pos + 9];
const hasLCT = (imgPacked & 0x80) !== 0;
let imgPalette = palette;
if (hasLCT) {
  const lctSize = 1 << ((imgPacked & 0x07) + 1);
  const lctOff = pos + 10;
  imgPalette = [];
  for (let i = 0; i < lctSize; i++)
    imgPalette.push([buf[lctOff + i * 3], buf[lctOff + i * 3 + 1], buf[lctOff + i * 3 + 2]]);
  pos = lctOff + lctSize * 3;
} else { pos += 10; }

// Collect LZW data from sub-blocks
const minCodeSize = buf[pos++];
const clearCode = 1 << minCodeSize;
const endCode = clearCode + 1;
let codeSize = minCodeSize + 1;
const lzwData = [];
let p = pos;
while (buf[p] !== 0) {
  const sz = buf[p];
  for (let i = 1; i <= sz; i++) lzwData.push(buf[p + i]);
  p += sz + 1;
}

// Bit reader (LSB first)
let bitPos = 0;
function readBits(n) {
  let val = 0;
  for (let i = 0; i < n; i++) {
    const byteIdx = (bitPos / 8) | 0;
    const bitIdx = bitPos % 8;
    if (byteIdx >= lzwData.length) return -1;
    val |= ((lzwData[byteIdx] >> bitIdx) & 1) << i;
    bitPos++;
  }
  return val;
}

// LZW decode
const pixels = [];
let dict = [];
function resetDict() {
  dict = [];
  for (let i = 0; i < clearCode; i++) dict[i] = [i];
  dict[clearCode] = null; dict[endCode] = null;
}
resetDict();
let code = readBits(codeSize);
let old = -1;
if (code >= 0 && code < clearCode) { pixels.push(code); old = code; }
while (true) {
  code = readBits(codeSize);
  if (code === -1) break;
  if (code === clearCode) {
    resetDict(); codeSize = minCodeSize + 1;
    code = readBits(codeSize);
    if (code >= 0 && code < clearCode) { pixels.push(code); old = code; }
    continue;
  }
  if (code === endCode) break;
  if (old < 0) { old = code; continue; }
  let entry;
  if (code < dict.length) entry = dict[code];
  else if (code === dict.length) entry = dict[old].concat([dict[old][0]]);
  else break;
  for (const px of entry) pixels.push(px);
  dict.push(dict[old].concat([entry[0]]));
  old = code;
  if (dict.length >= (1 << codeSize) && codeSize < 12) codeSize++;
}

// Classify pixels using the GIF's transparent index from the GCE
// Find the Graphic Control Extension to get the transparent color index
let transparentIdx = -1;
let gcePos = ctOffset + ctSize * 3;
while (gcePos < buf.length - 8) {
  if (buf[gcePos] === 0x21 && buf[gcePos + 1] === 0xF9) {
    const gcPacked = buf[gcePos + 3];
    if ((gcPacked & 0x01) !== 0) transparentIdx = buf[gcePos + 6];
    break;
  }
  gcePos++;
}

function classify(px) {
  if (px === transparentIdx) return null; // transparent
  const [r, g, b] = imgPalette[px] || [0, 0, 0];
  if (r > 200 && g > 200 && b > 200) return '#F4F2FA'; // white -> site highlight
  if (r < 60 && g < 60 && b < 60) return '#191426';   // black -> site outline
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); // other
}

const grid = [];
for (let y = 0; y < h; y++) {
  const row = [];
  for (let x = 0; x < w; x++) {
    const idx = y * w + x;
    row.push(idx < pixels.length ? classify(pixels[idx]) : null);
  }
  grid.push(row);
}

// Build SVG with merged horizontal runs
let rects = '';
for (let y = 0; y < h; y++) {
  let x = 0;
  while (x < w) {
    const c = grid[y][x];
    if (c === null) { x++; continue; }
    let run = 1;
    while (x + run < w && grid[y][x + run] === c) run++;
    rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${c}"/>`;
    x += run;
  }
}

const label = inPath.replace(/[/\\]/g, ' ').replace(/^.* /, '').replace(/\.\w+$/, '');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" role="img" aria-label="${label}">${rects}</svg>`;
fs.writeFileSync(outPath, svg);

// Stats
const colors = new Set();
for (const row of grid) for (const c of row) if (c) colors.add(c);
console.log(`${outPath}: ${w}x${h}, ${rects.split('>').length - 1} rects, colors: ${[...colors].join(', ')}`);

// Also print the grid for verification
const charMap = {};
charMap['#191426'] = '#';
charMap['#F4F2FA'] = 'W';
let gstr = '';
for (const row of grid) {
  for (const c of row) gstr += (c === null ? ' ' : (charMap[c] || '?'));
  gstr += '\n';
}
console.log(gstr);
