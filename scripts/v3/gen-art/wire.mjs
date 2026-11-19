/* Original replacements for the remaining rights-pending images.
   Deterministic, dependency-free raster -> PNG; WebP/GIF frames are encoded
   from those PNGs by ffmpeg with bitexact flags (same bytes on every run).

     node scripts/v3/gen-art/wire.mjs

   Output mirrors the source basename, pixel dimensions and transparency under
   img/act4/original/. No franchise shape is copied: every pixel is drawn from
   the site palette below. Status stays GENERATED_UNREVIEWED until a human signs
   off; this generator claims no rightsholder licence. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.resolve(process.env.WIRE_OUT || path.join(ROOT, 'img/act4/original'));

/* Site ramp. No brand colours, no sampled franchise pixels. */
const TOKENS = {
  void: '#08080B', ink: '#14141C', crypt: '#22222E', panel: '#3A3550',
  edge: '#5C5C70', ghost: '#8A8598', bone: '#EDE7DE', white: '#F4F0FF',
  blood: '#8C2F4A', soul: '#E23B55', redHi: '#FF4D6A',
  dim: '#3E8FB0', electric: '#4FC3F7', glow: '#9FF0FF',
  goldLo: '#C8901E', gold: '#FFD34E', lilac: '#B892FF',
  moss: '#3A6B4A', leaf: '#6FA36B', wood: '#7A5538', woodLo: '#523824'
};
const RGB = {};
for (const k in TOKENS) {
  const h = TOKENS[k];
  RGB[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function surface(w, h) { return { w, h, d: new Uint8Array(w * h * 4) }; }
function put(s, x, y, col, alpha = 255) {
  x = x | 0; y = y | 0;
  if (x < 0 || y < 0 || x >= s.w || y >= s.h || alpha <= 0) return;
  if (alpha < 255 && BAYER[((y & 3) << 2) | (x & 3)] * 16 >= alpha) return;
  const p = (y * s.w + x) << 2, v = RGB[col] || RGB.bone;
  s.d[p] = v[0]; s.d[p + 1] = v[1]; s.d[p + 2] = v[2]; s.d[p + 3] = 255;
}
function rect(s, x, y, w, h, col, alpha) {
  for (let j = y | 0; j < (y | 0) + h; j++)
    for (let i = x | 0; i < (x | 0) + w; i++) put(s, i, j, col, alpha);
}
function line(s, x0, y0, x1, y1, col, t = 1) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, n = 0;
  for (;;) {
    rect(s, x0 - ((t - 1) >> 1), y0 - ((t - 1) >> 1), t, t, col);
    if ((x0 === x1 && y0 === y1) || ++n > 2048) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
function disc(s, cx, cy, r, col) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r + 0.001) put(s, cx + x, cy + y, col);
}
function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const a = (y * src.w + x) << 2, b = ((dy + y) * dst.w + dx + x) << 2;
      for (let k = 0; k < 4; k++) dst.d[b + k] = src.d[a + k];
    }
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (name) => {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return h >>> 0;
};

/* ── PNG encoder (RGBA8, filter 0) ────────────────────────────────── */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
    t[n] = v;
  }
  return t;
})();
function crc32(b) {
  let v = -1;
  for (let i = 0; i < b.length; i++) v = CRC[(v ^ b[i]) & 255] ^ (v >>> 8);
  return (v ^ -1) >>> 0;
}
function chunk(type, data) {
  const o = Buffer.alloc(12 + data.length);
  o.writeUInt32BE(data.length, 0);
  o.write(type, 4, 'ascii');
  data.copy(o, 8);
  o.writeUInt32BE(crc32(o.subarray(4, 8 + data.length)), 8 + data.length);
  return o;
}
function encode(s, withAlpha = true) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s.w, 0); ihdr.writeUInt32BE(s.h, 4);
  ihdr[8] = 8; ihdr[9] = withAlpha ? 6 : 2;
  const bpp = withAlpha ? 4 : 3, stride = s.w * bpp, raw = Buffer.alloc(s.h * (stride + 1));
  for (let y = 0; y < s.h; y++) {
    const row = y * (stride + 1);
    raw[row] = 0;
    for (let x = 0; x < s.w; x++) {
      const a = (y * s.w + x) << 2, b = row + 1 + x * bpp;
      raw[b] = s.d[a]; raw[b + 1] = s.d[a + 1]; raw[b + 2] = s.d[a + 2];
      if (withAlpha) raw[b + 3] = s.d[a + 3];
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ── small sprite vocabulary ──────────────────────────────────────── */
function skull(s, x, y, w, h, sleep) {
  rect(s, x + 1, y, w - 2, 1, 'bone');
  rect(s, x, y + 1, w, h - 3, 'bone');
  rect(s, x + 1, y + h - 2, w - 2, 2, 'bone');
  const ey = y + Math.max(2, (h >> 2));
  if (sleep) {
    line(s, x + 2, ey, x + (w >> 1) - 1, ey, 'ink');
    line(s, x + (w >> 1) + 1, ey, x + w - 3, ey, 'ink');
  } else {
    rect(s, x + 2, ey, 3, Math.max(2, h >> 2), 'void');
    rect(s, x + w - 5, ey, 3, Math.max(2, h >> 2), 'void');
    put(s, x + 3, ey, 'white'); put(s, x + w - 4, ey, 'white');
  }
  for (let i = 2; i < w - 2; i += 2) put(s, x + i, y + h - 4, 'void');
}
function coat(s, x, y, w, h) {
  rect(s, x, y, w, h, 'ink');
  rect(s, x + 1, y, w - 2, 2, 'crypt');
  rect(s, x + 2, y + 2, w - 4, h - 4, 'panel');
  line(s, x + 1, y + 2, x + 1, y + h - 2, 'ghost');
  line(s, x + w - 2, y + 2, x + w - 2, y + h - 2, 'ghost');
  rect(s, x + (w >> 1), y + 3, 2, h - 6, 'void');
  rect(s, x + (w >> 1) - 2, y + 3, 2, 2, 'goldLo');
}
function sans(s, f, sleep) {
  skull(s, 5, 1, 13, 11, sleep);
  coat(s, 4, 12, 15, 13);
  rect(s, 6, 25, 4, 4, 'ink'); rect(s, 13, 25, 4, 4, 'ink');
  rect(s, 5, 28, 6, 2, 'void'); rect(s, 12, 28, 6, 2, 'void');
  if (f === 1) { /* shrug: arms lifted */
    line(s, 4, 14, 1, 10, 'bone', 2); line(s, 19, 14, 22, 10, 'bone', 2);
  } else {
    line(s, 4, 15, 2, 23, 'bone', 2); line(s, 19, 15, 21, 23, 'bone', 2);
  }
}
function walker(s, f) {
  const ox = f * 20, step = [0, -2, 0, 2][f];
  rect(s, ox + 7, 1, 7, 4, 'crypt');
  rect(s, ox + 6, 4, 9, 3, 'panel');
  rect(s, ox + 8, 5, 5, 2, 'void');
  rect(s, ox + 6, 7, 9, 11, 'ink');
  rect(s, ox + 8, 8, 5, 8, 'crypt');
  line(s, ox + 6, 9, ox + 3, 16 + step, 'bone', 2);
  line(s, ox + 15, 9, ox + 17, 16 - step, 'bone', 2);
  rect(s, ox + 7, 18 + (step > 0 ? 1 : 0), 3, 10 - Math.abs(step), 'void');
  rect(s, ox + 11, 18 + (step < 0 ? 1 : 0), 3, 10 - Math.abs(step), 'void');
}
function debris(s, f) {
  const rand = rng(seedOf('debris' + f));
  for (let k = 0; k < 22; k++) {
    const x = 2 + Math.round(rand() * 34), y = 30 + Math.round(rand() * 4);
    const w = 2 + Math.round(rand() * 5), h = 1 + Math.round(rand() * 4);
    rect(s, x, y, w, h, k % 3 ? 'crypt' : 'panel');
    if (k % 4 === 0) put(s, x, y, 'ghost');
  }
  rect(s, 6, 4 + f, 12, 20, 'ink');
  rect(s, 18, 8 + f, 9, 16, 'crypt');
  line(s, 8, 10 + f, 16, 22 + f, 'panel', 2);
}
function lamp(s) {
  rect(s, 7, 0, 3, 28, 'woodLo');
  rect(s, 2, 10, 13, 10, 'wood');
  rect(s, 4, 12, 9, 6, 'goldLo');
  rect(s, 5, 13, 7, 4, 'gold');
  rect(s, 1, 37, 15, 5, 'ink');
  rect(s, 2, 38, 13, 3, 'crypt');
}
function shelf(s) {
  rect(s, 0, 0, 52, 57, 'woodLo');
  rect(s, 2, 2, 48, 53, 'ink');
  for (let r = 0; r < 3; r++) {
    const y = 4 + r * 18;
    rect(s, 2, y + 15, 48, 3, 'wood');
    const rand = rng(seedOf('shelf' + r));
    let x = 4;
    while (x < 46) {
      const w = 2 + Math.round(rand() * 4), h = 8 + Math.round(rand() * 6);
      rect(s, x, y + 15 - h, w, h, ['blood', 'dim', 'moss', 'goldLo', 'panel'][(x + r) % 5]);
      x += w + 1;
    }
  }
}
function rug(s) {
  rect(s, 0, 1, 7, 8, 'blood');
  rect(s, 1, 2, 5, 6, 'goldLo');
  rect(s, 2, 3, 3, 4, 'panel');
}
function witchFace(s) {
  rect(s, 7, 8, 26, 3, 'void');
  rect(s, 3, 6, 34, 3, 'crypt');
  for (let i = 0; i < 12; i++) rect(s, 14 - i, 6 - i, 12 + i * 2, 1, 'crypt');
  rect(s, 11, 11, 18, 20, 'bone');
  rect(s, 9, 14, 3, 12, 'goldLo');
  rect(s, 28, 14, 3, 12, 'goldLo');
  rect(s, 14, 18, 3, 2, 'void'); rect(s, 23, 18, 3, 2, 'void');
  rect(s, 18, 24, 4, 2, 'blood');
  rect(s, 12, 29, 16, 2, 'void');
}
function bigSans(s) {
  const u = 10, X = (n) => n * u;
  /* 36x47 unit grid: skull across the top, coat below. */
  rect(s, X(6), X(1), X(24), X(2), 'bone');
  rect(s, X(5), X(3), X(26), X(11), 'bone');
  rect(s, X(6), X(14), X(24), X(2), 'bone');
  rect(s, X(9), X(6), X(5), X(6), 'void');
  rect(s, X(22), X(6), X(5), X(6), 'void');
  put(s, X(10), X(6), 'white'); put(s, X(23), X(6), 'white');
  for (let i = 9; i < 27; i += 2) put(s, X(i), X(13), 'void');
  rect(s, X(4), X(17), X(28), X(28), 'ink');
  rect(s, X(6), X(17), X(24), X(27), 'panel');
  rect(s, X(8), X(19), X(20), X(24), 'crypt');
  rect(s, X(17), X(18), X(2), X(26), 'void');
  rect(s, X(14), X(19), X(3), X(2), 'goldLo');
  line(s, X(5), X(20), X(2), X(37), 'ghost', 3);
  line(s, X(31), X(20), X(34), X(37), 'ghost', 3);
}
function totem(s, f) {
  const spin = (f * 6) % 60, lit = spin < 30;
  rect(s, 22, 18, 84, 92, 'woodLo');
  rect(s, 26, 22, 76, 84, 'wood');
  rect(s, 30, 26, 68, 76, 'crypt');
  rect(s, 40, 38, 48, 14, 'ink');
  rect(s, 48, 42, 8, 8, lit ? 'gold' : 'goldLo');
  rect(s, 72, 42, 8, 8, lit ? 'gold' : 'goldLo');
  rect(s, 50, 60, 28, 6, 'void');
  rect(s, 42, 76, 44, 10, 'panel');
  for (let k = 0; k < 5; k++) rect(s, 46 + k * 8, 78, 4, 6, k % 2 ? 'ghost' : 'bone');
  const a = f / 60 * Math.PI * 2;
  const gx = 64 + Math.round(Math.cos(a) * 52), gy = 64 + Math.round(Math.sin(a) * 52);
  disc(s, gx, gy, 4, 'lilac');
  rect(s, 20, 108, 88, 8, 'woodLo');
}
function dog(s, f) {
  const bob = f % 5 === 0 ? 1 : 0;
  rect(s, 8, 12 + bob, 28, 20, 'wood');
  rect(s, 6, 6 + bob, 8, 12, 'woodLo');
  rect(s, 30, 6 + bob, 8, 12, 'woodLo');
  rect(s, 12, 16 + bob, 20, 12, 'panel');
  put(s, 15, 20 + bob, 'void'); put(s, 27, 20 + bob, 'void');
  rect(s, 19, 25 + bob, 6, 4, 'ink');
  rect(s, 14, 31 + bob, 16, 3, 'bone');
  line(s, 36, 26, 42, 22 + (f % 3), 'wood', 2);
}
function cat(s, f) {
  const blink = f % 11 === 0, tail = Math.round(Math.sin(f / 44 * Math.PI * 4) * 14);
  rect(s, 0, 0, s.w, s.h, 'void'); /* source gif has no transparent index */
  rect(s, 56, 44, 108, 130, 'crypt');
  rect(s, 40, 20, 32, 44, 'crypt');
  rect(s, 148, 20, 32, 44, 'crypt');
  rect(s, 60, 28, 100, 132, 'panel');
  rect(s, 74, 66, 22, blink ? 4 : 22, 'void');
  rect(s, 126, 66, 22, blink ? 4 : 22, 'void');
  if (!blink) { rect(s, 78, 70, 8, 8, 'glow'); rect(s, 130, 70, 8, 8, 'glow'); }
  rect(s, 100, 104, 20, 12, 'soul');
  rect(s, 84, 134, 52, 8, 'ink');
  line(s, 164, 150, 194 + tail, 132, 'crypt', 10);
  line(s, 194 + tail, 132, 206 + tail, 108, 'crypt', 8);
  const rand = rng(seedOf('cat' + f));
  for (let k = 0; k < 8; k++) {
    rect(s, 66 + Math.round(rand() * 88), 96 + Math.round(rand() * 24), 2, 2, 'ghost');
  }
}

/* ── emit ─────────────────────────────────────────────────────────── */
const PNG = [
  ['act123/dark-debris.png', 40, 72, (s) => {
    for (let f = 0; f < 2; f++) {
      const cell = surface(40, 36);
      debris(cell, f);
      blit(s, cell, 0, f * 36);
    }
  }],
  ['act123/dark-door.png', 36, 52, (s) => {
    rect(s, 2, 8, 32, 44, 'woodLo'); rect(s, 5, 4, 26, 48, 'ink');
    rect(s, 8, 8, 20, 44, 'crypt'); rect(s, 10, 10, 16, 42, 'panel');
    rect(s, 20, 28, 3, 3, 'gold'); line(s, 8, 8, 28, 52, 'panel', 1);
  }],
  ['act123/dark-floor.png', 40, 40, (s) => {
    for (let y = 0; y < 40; y += 8)
      for (let x = 0; x < 40; x += 8) {
        rect(s, x, y, 8, 8, (x + y) % 16 ? 'crypt' : 'ink');
        rect(s, x, y, 8, 1, 'panel');
      }
  }],
  ['act123/sans-face.png', 36, 33, (s) => skull(s, 2, 1, 32, 30, false)],
  ['act123/sans-idle.png', 23, 30, (s) => sans(s, 0, false)],
  ['act123/sans-shrug.png', 23, 30, (s) => sans(s, 1, false)],
  ['act123/sans-sleep.png', 23, 30, (s) => sans(s, 0, true)],
  ['act123/sleep-lamp.png', 17, 43, lamp],
  ['act123/sleep-rug.png', 7, 10, rug],
  ['act123/sleep-shelf.png', 52, 57, shelf],
  ['act123/you-walk.png', 80, 120, (s) => { for (let f = 0; f < 4; f++) walker(s, f); }],
  ['witch-face.png', 40, 40, witchFace]
];
/* ffmpeg's GIF encoder sets the GCE transparency flag even on fully opaque
   frames. The cat source has no transparent index, so clear that flag to keep
   the alpha contract identical (the index is ignored when the bit is off). */
function stripGifAlpha(file) {
  const b = fs.readFileSync(file);
  for (let i = 0; i < b.length - 5; i++) {
    if (b[i] === 0x21 && b[i + 1] === 0xf9 && b[i + 2] === 4) b[i + 3] &= 0xfe;
  }
  fs.writeFileSync(file, b);
}

const ANIM = [
  { file: 'root/Sans_sprite.webp', w: 360, h: 470, frames: 1, fps: 1, kind: 'webp', draw: bigSans },
  { file: 'root/totem.webp', w: 128, h: 128, frames: 60, fps: 12, kind: 'anim', draw: totem },
  { file: 'root/annoying-dog.gif', w: 44, h: 38, frames: 10, fps: 8, kind: 'gif', draw: dog },
  { file: 'root/cat.gif', w: 220, h: 216, frames: 44, fps: 8, kind: 'gif', draw: cat, opaque: true }
];

/* Test seam: rebuild one frame without running the emitter. */
export function surfaceFor(rel, frame) {
  const p = PNG.find((x) => x[0] === rel);
  if (p) { const s = surface(p[1], p[2]); p[3](s); return s; }
  const a = ANIM.find((x) => x.file === rel);
  if (a) { const s = surface(a.w, a.h); a.draw(s, frame || 0); return s; }
  return null;
}

/* These two source PNGs have no tRNS and no alpha channel; mirror that. */
const OPAQUE = ['act123/dark-floor.png', 'act123/sleep-rug.png'];

const isMain = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
fs.mkdirSync(OUT, { recursive: true });
for (const [rel, w, h, draw] of PNG) {
  const s = surface(w, h);
  draw(s);
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.writeFileSync(path.join(OUT, rel), encode(s, OPAQUE.indexOf(rel) < 0));
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'neu-wire-'));
try {
  const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y'].concat(args));
  for (const a of ANIM) {
    const dir = path.join(TMP, a.file.replace(/[^\w]/g, '_'));
    fs.mkdirSync(dir, { recursive: true });
    for (let f = 0; f < a.frames; f++) {
      const s = surface(a.w, a.h);
      a.draw(s, f);
      fs.writeFileSync(path.join(dir, 'f' + String(f).padStart(3, '0') + '.png'), encode(s));
    }
    const pattern = path.join(dir, 'f%03d.png');
    const flags = ['-fflags', '+bitexact', '-flags', '+bitexact', '-map_metadata', '-1'];
    const dest = path.join(OUT, a.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (a.kind === 'webp')
      ff(['-i', pattern, '-c:v', 'libwebp', '-lossless', '1', '-pix_fmt', 'rgba'].concat(flags, [dest]));
    else if (a.kind === 'anim')
      ff(['-f', 'image2', '-framerate', String(a.fps), '-i', pattern, '-c:v', 'libwebp_anim',
          '-lossless', '1', '-loop', '0'].concat(flags, [dest]));
    else
      ff(['-f', 'image2', '-framerate', String(a.fps), '-i', pattern, '-c:v', 'gif'].concat(flags, [dest]));
    if (a.opaque) stripGifAlpha(dest);
  }
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
console.log('wrote ' + (PNG.length + ANIM.length) + ' original replacements to ' + OUT);
}
