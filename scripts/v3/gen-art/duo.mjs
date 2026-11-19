/*
 * duo.mjs — ORIGINAL art for the Undertale + Deltarune rights queue.
 *
 * Deterministic, dependency-free pixel-art generator. Draws generic original
 * characters and props from silhouette + material + lighting briefs only:
 * a golden-hatted merchant, a hooded wanderer, a skeletal jester, a cracked
 * television, a wooden chair, a bench, a glowing corridor panel. No source
 * art is read. Every frame cell is equal, every pixel integer, alpha is true.
 *
 * Usage:  node scripts/v3/gen-art/duo.mjs [outDir]
 * Default outDir: <repo>/img/act4/original
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'img/act4/original'));

/* ------------------------------------------------------------------ colour */
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const C = {
  ink: hex('#0b0b10'), shadow: hex('#1a1622'), mid: hex('#2e2a3a'),
  charcoal: hex('#3a3546'), panel: hex('#4a4458'), steel: hex('#6d6a7d'),
  bone: hex('#e8e0d0'), cream: hex('#f4ede0'), white: hex('#ffffff'),
  gold: hex('#d9a441'), goldHi: hex('#f2ce7a'), goldLo: hex('#8a6420'),
  wood: hex('#6b4a32'), woodHi: hex('#93694a'), woodLo: hex('#3e2a1c'),
  teal: hex('#3e8c8c'), tealHi: hex('#7fd1c7'), cyan: hex('#8fe3e0'), cyanHi: hex('#dffbf7'),
  violet: hex('#5e33be'), lilac: hex('#b892ff'),
  red: hex('#c2405f'), redHi: hex('#e2607f'), warm: hex('#ff8a3a'), warmHi: hex('#ffd08a'),
  green: hex('#4f8f5b'), greenHi: hex('#8bc98d'), greenLo: hex('#2f5c39'),
  glass: hex('#243646'), glassHi: hex('#3d5b70')
};
const Z = [0, 0, 0]; // fully transparent pixels carry no hidden colour
const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t)
];
const ramp = (base, t) => t < 0 ? mix(base, C.shadow, -t) : mix(base, C.cream, t * 0.75);

/* -------------------------------------------------------------- seeded RNG */
function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------------------------------------------- pixel buf */
class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h * 4); }
  set(x, y, c, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a;
  }
  get(x, y) { const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  fill(x, y, w, h, c, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }
  clear() { this.d.fill(0); }
  hline(x, y, w, c, a) { this.fill(x, y, w, 1, c, a); }
  vline(x, y, h, c, a) { this.fill(x, y, 1, h, c, a); }
  rect(x, y, w, h, c, a) {
    this.hline(x, y, w, c, a); this.hline(x, y + h - 1, w, c, a);
    this.vline(x, y, h, c, a); this.vline(x + w - 1, y, h, c, a);
  }
  disc(cx, cy, r, c, a) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) this.set(cx + x, cy + y, c, a);
  }
  line(x0, y0, x1, y1, c, a) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  poly(pts, c, a) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.set(x, y, c, a);
    }
  }
  /* string art: rows of chars, pal maps char -> [r,g,b] or null */
  art(x, y, rows, pal) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const c = pal[row[i]];
        if (c) this.set(x + i, y + j, c);
      }
    }
  }
  /* top-left lit, bottom-right shadowed box */
  lit(x, y, w, h, base) {
    this.fill(x, y, w, h, base);
    this.hline(x, y, w, ramp(base, 0.28));
    this.vline(x, y, h, ramp(base, 0.18));
    this.hline(x, y + h - 1, w, ramp(base, -0.30));
    this.vline(x + w - 1, y, h, ramp(base, -0.34));
  }
  speckle(x, y, w, h, colors, rand, n, alpha = 255) {
    for (let k = 0; k < n; k++) {
      const px = x + Math.floor(rand() * w), py = y + Math.floor(rand() * h);
      this.set(px, py, colors[Math.floor(rand() * colors.length)], alpha);
    }
  }
}

/* ---------------------------------------------------------- PNG (type 6) */
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
let CRCT = null;
function crcTable() {
  if (CRCT) return CRCT;
  CRCT = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    CRCT[n] = c >>> 0;
  }
  return CRCT;
}
function crc32(buf) {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encode(p) {
  const raw = Buffer.alloc((p.w * 4 + 1) * p.h);
  for (let y = 0; y < p.h; y++) {
    const so = y * (p.w * 4 + 1);
    for (let x = 0; x < p.w; x++) {
      const si = (y * p.w + x) * 4, di = so + 1 + x * 4;
      raw[di] = p.d[si]; raw[di + 1] = p.d[si + 1]; raw[di + 2] = p.d[si + 2]; raw[di + 3] = p.d[si + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(p.w, 0); ihdr.writeUInt32BE(p.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function save(rel, p) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encode(p));
  return file;
}

/* ================================================================ FIGURES */
/* The cracked-television host: a boxy CRT head, antennae, a cracked screen,
   a dark suit and a thin tie. Pose + expression vary per call. */
function host(p, cx, foot, H, o) {
  const r = rng(o.seed || 7);
  const pose = o.pose || 'idle', expr = o.expr || 'idle', lean = o.lean || 0;
  const hw = Math.max(14, Math.round(H * 0.36)), hh = Math.max(12, Math.round(H * 0.28));
  const hx = Math.round(cx - hw / 2 + lean), hy = foot - H;
  const legH = Math.round(H * 0.20), torsoTop = hy + hh, torsoBot = foot - legH;
  const tw = Math.max(16, Math.round(H * 0.34)), tx = Math.round(cx - tw / 2 + lean * 0.5);

  /* antennae */
  p.line(hx + Math.round(hw * 0.28), hy, hx + Math.round(hw * 0.18), hy - Math.round(H * 0.10), C.steel);
  p.line(hx + Math.round(hw * 0.72), hy, hx + Math.round(hw * 0.82), hy - Math.round(H * 0.10), C.steel);
  p.disc(hx + Math.round(hw * 0.18), hy - Math.round(H * 0.10), 2, C.goldHi);
  p.disc(hx + Math.round(hw * 0.82), hy - Math.round(H * 0.10), 2, C.goldHi);

  /* legs + shoes */
  const step = (pose === 'cheer' || pose === 'bow') ? 2 : 0;
  p.fill(tx + 2, torsoBot, Math.round(tw / 2) - 3, legH - 2, C.shadow);
  p.fill(tx + Math.round(tw / 2) + 1, torsoBot + step, Math.round(tw / 2) - 3, legH - 2 - step, C.shadow);
  p.fill(tx + 1, foot - 3, Math.round(tw / 2) - 1, 3, C.ink);
  p.fill(tx + Math.round(tw / 2), foot - 3 + step, Math.round(tw / 2), 3, C.ink);

  /* torso: dark suit, lit from upper-left */
  p.lit(tx, torsoTop, tw, torsoBot - torsoTop, C.charcoal);
  p.poly([[cx + lean * 0.5 - 3, torsoTop + 1], [cx + lean * 0.5 + 3, torsoTop + 1],
          [cx + lean * 0.5 + 1, torsoTop + Math.round(H * 0.16)], [cx + lean * 0.5 - 1, torsoTop + Math.round(H * 0.16)]], C.bone);
  p.fill(Math.round(cx + lean * 0.5), torsoTop + 2, 2, Math.round(H * 0.12), C.red);

  /* arms */
  const armLen = Math.round(H * 0.22), ax = tx + (pose === 'point' ? tw - 2 : 1);
  const ay = torsoTop + 3;
  function arm(x0, y0, x1, y1) {
    p.line(x0, y0, x1, y1, C.charcoal);
    p.line(x0, y0 + 1, x1, y1 + 1, C.shadow);
    p.disc(x1, y1, 2, C.bone);
  }
  if (pose === 'cheer') {
    arm(tx + 2, ay, tx - 3, ay - armLen);
    arm(tx + tw - 3, ay, tx + tw + 2, ay - armLen);
  } else if (pose === 'point') {
    arm(tx + tw - 3, ay, tx + tw + armLen, ay - 4);
    arm(tx + 2, ay, tx - 2, ay + 6);
  } else if (pose === 'shrug') {
    arm(tx + 2, ay, tx - armLen + 2, ay - 5);
    arm(tx + tw - 3, ay, tx + tw + armLen - 3, ay - 5);
  } else if (pose === 'shock') {
    arm(tx + 2, ay, tx - 3, ay - Math.round(armLen * 0.6));
    arm(tx + tw - 3, ay, tx + tw + 2, ay - Math.round(armLen * 0.6));
  } else if (pose === 'bow') {
    arm(tx + 2, ay, cx - 3, torsoBot - 2);
    arm(tx + tw - 3, ay, cx + 2, torsoBot - 2);
  } else if (pose === 'podium') {
    arm(tx + 2, ay, tx - 2, ay + Math.round(armLen * 0.7));
    arm(tx + tw - 3, ay, tx + tw + 1, ay + Math.round(armLen * 0.5));
  } else if (pose === 'sad') {
    arm(tx + 2, ay, tx + 1, ay + armLen);
    arm(tx + tw - 3, ay, tx + tw - 2, ay + armLen);
  } else {
    arm(tx + 2, ay, tx, ay + Math.round(armLen * 0.8));
    arm(tx + tw - 3, ay, tx + tw - 1, ay + Math.round(armLen * 0.8));
  }

  /* CRT head: shell, screen inset, lit corner */
  p.lit(hx, hy, hw, hh, C.charcoal);
  p.rect(hx, hy, hw, hh, C.ink);
  const sx = hx + 3, sy = hy + 3, sw = hw - 6, sh = hh - 6;
  p.fill(sx, sy, sw, sh, C.glass);
  p.hline(sx, sy, sw, C.glassHi);
  p.vline(sx, sy, sh, C.glassHi);

  /* face on the screen */
  const ew = Math.max(2, Math.round(sw * 0.16));
  const eyeY = sy + Math.round(sh * 0.42);
  if (expr === 'shock') {
    p.fill(sx + Math.round(sw * 0.22), eyeY, ew, ew + 1, C.cyanHi);
    p.fill(sx + Math.round(sw * 0.62), eyeY, ew, ew + 1, C.cyanHi);
    p.fill(sx + Math.round(sw * 0.44), sy + Math.round(sh * 0.70), 3, 5, C.cyan);
  } else if (expr === 'sad') {
    p.hline(sx + Math.round(sw * 0.20), eyeY, ew + 2, C.tealHi);
    p.hline(sx + Math.round(sw * 0.60), eyeY, ew + 2, C.tealHi);
    p.hline(sx + Math.round(sw * 0.38), sy + Math.round(sh * 0.74), Math.round(sw * 0.24), C.teal);
  } else if (expr === 'bow' || expr === 'closed') {
    p.hline(sx + Math.round(sw * 0.20), eyeY, ew + 2, C.cyanHi);
    p.hline(sx + Math.round(sw * 0.60), eyeY, ew + 2, C.cyanHi);
    p.hline(sx + Math.round(sw * 0.38), sy + Math.round(sh * 0.72), Math.round(sw * 0.24), C.cyan);
  } else if (expr === 'cheer') {
    p.fill(sx + Math.round(sw * 0.20), eyeY, ew, 2, C.cyanHi);
    p.fill(sx + Math.round(sw * 0.62), eyeY, ew, 2, C.cyanHi);
    p.hline(sx + Math.round(sw * 0.34), sy + Math.round(sh * 0.70), Math.round(sw * 0.32), C.cyanHi);
  } else {
    p.fill(sx + Math.round(sw * 0.22), eyeY, ew, 2, C.cyanHi);
    p.fill(sx + Math.round(sw * 0.62), eyeY, ew, 2, C.cyanHi);
    p.hline(sx + Math.round(sw * 0.38), sy + Math.round(sh * 0.72), Math.round(sw * 0.24), C.cyan);
  }

  /* the crack: a jagged cyan split, never a signature shape */
  p.line(sx + Math.round(sw * 0.78), sy + 1, sx + Math.round(sw * 0.66), sy + Math.round(sh * 0.35), C.cyanHi);
  p.line(sx + Math.round(sw * 0.66), sy + Math.round(sh * 0.35), sx + Math.round(sw * 0.80), sy + Math.round(sh * 0.58), C.cyan);
  p.speckle(hx + 1, hy + 1, hw - 2, hh - 2, [C.panel, C.steel], r, Math.round(hw * hh * 0.02), 120);
}

/* Golden-hatted merchant: warm robe, flat wide gold hat, coin satchel. */
function merchant(p, cx, foot, H, frame = 0) {
  const bw = Math.round(H * 0.40), bx = cx - Math.round(bw / 2);
  const bob = (frame % 2) ? 1 : 0;
  p.fill(bx + 2, foot - Math.round(H * 0.18), Math.round(bw / 2) - 3, Math.round(H * 0.18), C.woodLo);
  p.fill(cx + 1, foot - Math.round(H * 0.18) + bob, Math.round(bw / 2) - 3, Math.round(H * 0.18), C.woodLo);
  p.lit(bx, foot - Math.round(H * 0.70) - bob, bw, Math.round(H * 0.54), C.goldLo);
  p.poly([[cx - 3, foot - Math.round(H * 0.70) - bob], [cx + 3, foot - Math.round(H * 0.70) - bob],
          [cx + 2, foot - Math.round(H * 0.30)], [cx - 2, foot - Math.round(H * 0.30)]], C.cream);
  /* satchel */
  p.lit(cx + Math.round(bw * 0.22), foot - Math.round(H * 0.50), 8, 9, C.wood);
  p.disc(cx + Math.round(bw * 0.22) + 4, foot - Math.round(H * 0.50) + 4, 2, C.goldHi);
  /* head + hat */
  const hy = foot - Math.round(H * 0.86) - bob;
  p.fill(cx - 6, hy, 12, Math.round(H * 0.16), C.bone);
  p.fill(cx - 4, hy + 5, 2, 2, C.ink); p.fill(cx + 2, hy + 5, 2, 2, C.ink);
  p.fill(cx - 5, hy - 3, 10, 4, C.gold);
  p.fill(cx - 10, hy - 1, 20, 3, C.goldHi);
  p.hline(cx - 10, hy - 1, 20, C.goldHi);
  p.hline(cx - 8, hy + 1, 16, C.goldLo);
}

/* Hooded wanderer: deep-violet cloak, shadowed face, one lit eye pair. */
function wanderer(p, cx, foot, H, frame = 0) {
  const bob = (frame % 2) ? 1 : 0;
  const bx = cx - Math.round(H * 0.20);
  p.poly([[cx, foot - H - bob], [cx - Math.round(H * 0.24), foot - Math.round(H * 0.52)],
          [bx - 2, foot], [cx + Math.round(H * 0.24), foot], [cx + Math.round(H * 0.22), foot - Math.round(H * 0.52)]], C.violet);
  p.poly([[cx, foot - H - bob], [cx - Math.round(H * 0.18), foot - Math.round(H * 0.54)],
          [cx - 2, foot - Math.round(H * 0.54)]], mix(C.violet, C.lilac, 0.35));
  const fy = foot - Math.round(H * 0.78) - bob;
  p.fill(cx - 7, fy, 14, 13, C.shadow);
  p.fill(cx - 5, fy + 5, 3, 2, C.lilac); p.fill(cx + 2, fy + 5, 3, 2, C.lilac);
  p.hline(cx - 7, fy - 2, 14, C.violet);
}

/* Skeletal jester: pale bone rods, teal motley, triangular cap. */
function jester(p, cx, foot, H, frame = 0) {
  const bob = (frame % 2) ? 1 : 0;
  const hy = foot - Math.round(H * 0.74) - bob;
  p.fill(cx - 1, hy + 10, 3, Math.round(H * 0.34), C.bone);
  for (let i = 0; i < 3; i++) p.hline(cx - 3, hy + 14 + i * 5, 7, C.bone);
  p.fill(cx - 5, foot - Math.round(H * 0.40), 3, Math.round(H * 0.40), C.teal);
  p.fill(cx + 2, foot - Math.round(H * 0.40), 3, Math.round(H * 0.40), C.teal);
  p.poly([[cx - 9, hy + 2], [cx + 9, hy + 2], [cx, hy - Math.round(H * 0.16) - bob]], C.tealHi);
  p.disc(cx - 9, hy + 3, 2, C.gold); p.disc(cx + 9, hy + 3, 2, C.gold);
  p.fill(cx - 6, hy, 12, 10, C.bone);
  p.fill(cx - 4, hy + 4, 3, 3, C.ink); p.fill(cx + 1, hy + 4, 3, 3, C.ink);
  p.hline(cx - 3, hy + 8, 6, C.teal);
}

/* ------------------------------------------------------------------ ASSETS */
const A = {};

/* undertale/soul.png — original rune: a faceted lozenge, not a heart. */
A['undertale/soul.png'] = () => {
  const p = new Pix(16, 16);
  const rows = [
    '................', '................', '.......oo.......', '......obbo......',
    '.....obbbbo.....', '....obbhhbbo....', '...obbhhhhbbo...', '..obbhhwwhhbbo..',
    '..obbhhwwhhbbo..', '...obbhhhhbbo...', '....obbhhbbo....', '.....obbbbo.....',
    '......obbo......', '.......oo.......', '................', '................'
  ];
  p.art(0, 0, rows, { o: C.ink, b: C.teal, h: C.cyan, w: C.cyanHi });
  return p;
};

/* undertale/plant.png — potted sprout. */
A['undertale/plant.png'] = () => {
  const p = new Pix(16, 34);
  p.poly([[3, 20], [13, 20], [11, 33], [5, 33]], C.wood);
  p.hline(3, 20, 11, C.woodHi);
  p.hline(5, 33, 7, C.woodLo);
  p.fill(7, 10, 2, 11, C.greenLo);
  p.disc(5, 10, 3, C.green); p.disc(11, 8, 3, C.greenHi);
  p.fill(6, 6, 2, 5, C.greenHi);
  return p;
};

/* undertale/armchair.png — wooden chair, tall slatted back. */
A['undertale/armchair.png'] = () => {
  const p = new Pix(45, 83);
  p.lit(7, 4, 31, 44, C.wood);
  p.rect(7, 4, 31, 44, C.woodLo);
  for (let i = 0; i < 3; i++) { p.vline(14 + i * 8, 9, 33, C.woodHi); p.vline(15 + i * 8, 9, 33, C.woodLo); }
  p.hline(9, 14, 27, C.woodHi); p.hline(9, 38, 27, C.woodHi);
  p.lit(3, 44, 39, 9, C.woodHi);
  p.hline(3, 44, 39, C.cream);
  p.fill(5, 53, 6, 27, C.wood); p.fill(34, 53, 6, 27, C.woodLo);
  p.hline(5, 79, 6, C.woodHi); p.hline(34, 79, 6, C.wood);
  return p;
};

/* undertale/firedoor.png — glowing arched corridor door. */
A['undertale/firedoor.png'] = () => {
  const p = new Pix(55, 70);
  p.poly([[4, 70], [4, 26], [12, 10], [27, 3], [42, 10], [51, 26], [51, 70]], C.shadow);
  p.poly([[10, 70], [10, 28], [17, 16], [27, 10], [37, 16], [45, 28], [45, 70]], C.charcoal);
  p.poly([[15, 70], [15, 30], [21, 21], [27, 16], [33, 21], [40, 30], [40, 70]], C.warm);
  p.poly([[19, 70], [19, 32], [24, 25], [27, 22], [30, 25], [36, 32], [36, 70]], C.warmHi);
  p.poly([[23, 70], [23, 35], [27, 30], [31, 35], [32, 70]], C.cream);
  p.hline(4, 66, 47, C.ink);
  p.speckle(15, 20, 26, 48, [C.goldHi, C.cream], rng(11), 40, 150);
  return p;
};

/* undertale/newhome-corridor.png — glowing corridor panel strip. */
A['undertale/newhome-corridor.png'] = () => {
  const p = new Pix(743, 76);
  p.fill(0, 0, 743, 76, C.shadow);
  p.fill(0, 8, 743, 56, C.charcoal);
  p.hline(0, 8, 743, C.mid); p.hline(0, 62, 743, C.ink);
  for (let x = 0; x < 743; x += 96) {
    p.lit(x + 6, 18, 82, 34, C.panel);
    p.fill(x + 12, 24, 70, 22, C.glass);
    p.hline(x + 12, 24, 70, C.glassHi);
    /* window recesses are genuinely transparent, not a baked checkerboard */
    p.fill(x + 16, 28, 62, 14, Z, 0);
    p.fill(x + 20, 30, 54, 3, C.warm);
    p.hline(x + 20, 30, 54, C.warmHi);
    p.vline(x + 6, 18, 34, C.mid);
  }
  p.hline(0, 64, 743, C.woodLo);
  for (let x = 0; x < 743; x += 24) p.vline(x, 64, 12, C.ink);
  p.speckle(0, 8, 743, 54, [C.steel, C.mid], rng(3), 200, 90);
  return p;
};

/* undertale/gasterblaster.png — 6 equal cells of an original arcane emitter,
   charging then firing a cyan lance. */
A['undertale/gasterblaster.png'] = () => {
  const p = new Pix(258, 57), FW = 43;
  for (let f = 0; f < 6; f++) {
    const x = f * FW, r = rng(100 + f);
    /* hull */
    p.poly([[x + 8, 14], [x + 35, 14], [x + 41, 30], [x + 35, 46], [x + 8, 46], [x + 2, 30]], C.charcoal);
    p.poly([[x + 8, 14], [x + 35, 14], [x + 41, 30], [x + 35, 46], [x + 8, 46], [x + 2, 30]], C.ink);
    p.poly([[x + 10, 17], [x + 33, 17], [x + 38, 30], [x + 33, 43], [x + 10, 43], [x + 6, 30]], C.steel);
    p.disc(x + 22, 26, 6, C.ink);
    p.disc(x + 22, 26, f >= 4 ? 5 : 3, f >= 4 ? C.cyanHi : C.tealHi);
    /* muzzle energy grows across frames */
    const charge = f === 0 ? 2 : f === 1 ? 4 : f === 2 ? 6 : f === 3 ? 9 : f === 4 ? 13 : 10;
    p.poly([[x + 14, 46], [x + 29, 46], [x + 22, 46 + charge]], f >= 3 ? C.cyanHi : C.teal);
    if (f >= 4) p.fill(x + 20, 50, 4, 6, C.cyanHi);
    p.speckle(x + 6, 17, 31, 26, [C.panel, C.steel], r, 18, 110);
  }
  return p;
};

/* undertale/mushroom-dance.png — original cap-folk in a 3 x 5 grid of
   28x35 cells. Columns: rest / dance / react. Rows: bob heights. */
A['undertale/mushroom-dance.png'] = () => {
  const p = new Pix(84, 175), FW = 28, FH = 35;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
    const r = rng(500 + row * 3 + col);
    const ox = col * FW, oy = row * FH;
    const bob = row % 2;
    const lean = col === 1 ? (row % 2 ? 2 : -2) : 0;
    /* stem body */
    p.fill(ox + 12 + lean, oy + 17 + bob, 6, 12, C.bone);
    /* arms: raised on the dance column */
    if (col === 1) {
      p.line(ox + 12 + lean, oy + 20 + bob, ox + 6 + lean, oy + (row % 2 ? 14 : 24) + bob, C.bone);
      p.line(ox + 18 + lean, oy + 20 + bob, ox + 24 + lean, oy + (row % 2 ? 24 : 14) + bob, C.bone);
    } else {
      p.line(ox + 12 + lean, oy + 21 + bob, ox + 9 + lean, oy + 27 + bob, C.bone);
      p.line(ox + 18 + lean, oy + 21 + bob, ox + 21 + lean, oy + 27 + bob, C.bone);
    }
    /* feet */
    p.fill(ox + 10 + lean, oy + 28 + bob, 4, 3, C.woodLo);
    p.fill(ox + 16 + lean, oy + 28 + bob, 4, 3, C.woodLo);
    /* cap: original broad dome with spots, not a signature mushroom */
    p.poly([[ox + 3 + lean, oy + 17 + bob], [ox + 7 + lean, oy + 8 + bob],
            [ox + 14 + lean, oy + 4 + bob], [ox + 21 + lean, oy + 8 + bob], [ox + 25 + lean, oy + 17 + bob]], C.red);
    p.hline(ox + 3 + lean, oy + 16 + bob, 23, C.redHi);
    p.disc(ox + 10 + lean, oy + 11 + bob, 2, C.cream);
    p.disc(ox + 19 + lean, oy + 13 + bob, 1, C.cream);
    /* face */
    p.fill(ox + 12 + lean, oy + 19 + bob, 2, 2, C.ink);
    p.fill(ox + 16 + lean, oy + 19 + bob, 2, 2, C.ink);
    if (col === 2) p.hline(ox + 13 + lean, oy + 24 + bob, 4, C.ink);
    else p.hline(ox + 13 + lean, oy + 23 + bob, 4, C.woodLo);
    p.speckle(ox + 4 + lean, oy + 5 + bob, 21, 11, [C.redHi, C.cream], r, 6, 100);
  }
  return p;
};

/* ---------------------------------------------------------------- deltarune */
A['deltarune/bench.png'] = () => {
  const p = new Pix(39, 25);
  p.lit(2, 4, 35, 4, C.woodHi); p.hline(2, 4, 35, C.cream);
  p.fill(2, 9, 35, 3, C.wood); p.hline(2, 9, 35, C.woodHi);
  p.fill(2, 14, 35, 3, C.woodLo); p.hline(2, 14, 35, C.wood);
  p.fill(5, 17, 4, 8, C.woodLo); p.fill(30, 17, 4, 8, C.woodLo);
  p.fill(7, 8, 3, 12, C.wood); p.fill(29, 8, 3, 12, C.wood);
  return p;
};

A['deltarune/equip-icons.png'] = () => {
  const p = new Pix(48, 16);
  /* sword */
  p.line(3, 13, 12, 3, C.steel); p.line(4, 13, 13, 3, C.bone);
  p.line(10, 2, 14, 6, C.gold); p.line(2, 13, 5, 10, C.wood);
  /* shield */
  p.poly([[19, 3], [28, 3], [28, 10], [24, 14], [19, 10]], C.violet);
  p.poly([[20, 4], [27, 4], [27, 9], [24, 12], [20, 9]], C.lilac);
  p.vline(23, 5, 7, C.violet);
  /* flask */
  p.fill(35, 2, 6, 3, C.glass); p.fill(36, 5, 4, 3, C.glass);
  p.poly([[35, 8], [41, 8], [43, 14], [33, 14]], C.teal);
  p.hline(33, 13, 11, C.tealHi);
  return p;
};

/* box9.png — 9-slice framed panel; 16px corners, transparent outer corners. */
A['deltarune/tvtime/box9.png'] = () => {
  const p = new Pix(33, 33);
  p.fill(0, 0, 33, 33, C.shadow);
  /* knock out rounded outer corners to give real alpha */
  const cut = [[0, 0], [1, 0], [0, 1], [32, 0], [31, 0], [32, 1], [0, 32], [0, 31], [1, 32], [32, 32], [31, 32], [32, 31]];
  for (const [x, y] of cut) p.set(x, y, Z, 0);
  p.fill(4, 4, 25, 25, C.mid);
  p.fill(6, 6, 21, 21, C.glass);
  p.rect(2, 2, 29, 29, C.goldLo);
  p.rect(4, 4, 25, 25, C.gold);
  p.hline(4, 4, 25, C.goldHi); p.vline(4, 4, 25, C.goldHi);
  p.hline(4, 8, 25, C.goldLo);
  p.fill(2, 2, 5, 2, C.goldHi); p.fill(2, 2, 2, 5, C.goldHi);
  p.fill(26, 29, 5, 2, C.goldLo); p.fill(29, 26, 2, 5, C.goldLo);
  return p;
};

/* crowd.png — 3 equal cells of an original audience band (opaque). */
A['deltarune/tvtime/crowd.png'] = () => {
  const p = new Pix(1920, 160), FW = 640;
  for (let f = 0; f < 3; f++) {
    const r = rng(900 + f), x0 = f * FW;
    p.fill(x0, 0, FW, 160, C.shadow);
    p.fill(x0, 0, FW, 40, C.mid);
    for (let x = 0; x < FW; x += 16) {
      const h = 18 + Math.floor(r() * 16);
      const y = 96 - h + ((f + Math.floor(x / 16)) % 2) * 3;
      p.poly([[x0 + x - 7, 160], [x0 + x - 6, y + 8], [x0 + x, y], [x0 + x + 6, y + 8], [x0 + x + 7, 160]], C.charcoal);
      p.disc(x0 + x, y + 4, 5, C.ink);
      p.hline(x0 + x - 3, y + 3, 7, C.panel);
      if (r() > 0.6) p.line(x0 + x + 5, y + 10, x0 + x + 10, y - 6 + f * 2, C.charcoal);
    }
    p.hline(x0, 140, FW, C.ink);
    p.speckle(x0, 0, FW, 160, [C.mid, C.charcoal], r, 300);
  }
  return p;
};

/* face-static.png — 7 equal cells of glitchy static masks. */
A['deltarune/tvtime/face-static.png'] = () => {
  const p = new Pix(189, 24), FW = 27;
  for (let f = 0; f < 7; f++) {
    const x = f * FW, r = rng(1100 + f);
    p.fill(x + 4, 3, 19, 18, C.glass);
    p.rect(x + 4, 3, 19, 18, C.steel);
    p.hline(x + 4, 3, 19, C.glassHi);
    const jitter = Math.floor(r() * 5);
    p.fill(x + 8, 9 + (jitter % 2), 3, 3, f % 2 ? C.redHi : C.cyanHi);
    p.fill(x + 16, 9, 3, 3, f % 2 ? C.redHi : C.cyanHi);
    p.hline(x + 10, 16, 7, C.cyan);
    for (let k = 0; k < 5; k++) {
      const yy = 4 + Math.floor(r() * 16);
      p.hline(x + 5 + Math.floor(r() * 4), yy, 4 + Math.floor(r() * 12), k % 2 ? C.cyan : C.mid);
    }
  }
  return p;
};

/* faces.png — 8 equal cells of host expressions. */
A['deltarune/tvtime/faces.png'] = () => {
  const p = new Pix(576, 56), FW = 72;
  const exprs = ['idle', 'cheer', 'sad', 'shock', 'idle', 'sad', 'shock', 'cheer'];
  for (let f = 0; f < 8; f++) {
    const x = f * FW, r = rng(1300 + f);
    p.poly([[x + 16, 4], [x + 56, 4], [x + 64, 46], [x + 8, 46]], C.charcoal);
    p.rect(x + 16, 4, 40, 42, C.ink);
    p.fill(x + 20, 8, 32, 34, C.glass);
    p.hline(x + 20, 8, 32, C.glassHi);
    const ex = exprs[f];
    if (ex === 'shock') {
      p.fill(x + 26, 18, 5, 6, C.cyanHi); p.fill(x + 43, 18, 5, 6, C.cyanHi);
      p.fill(x + 34, 30, 4, 7, C.cyan);
    } else if (ex === 'sad') {
      p.hline(x + 25, 20, 7, C.tealHi); p.hline(x + 42, 20, 7, C.tealHi);
      p.hline(x + 30, 34, 14, C.teal);
    } else if (ex === 'cheer') {
      p.fill(x + 26, 19, 5, 3, C.cyanHi); p.fill(x + 43, 19, 5, 3, C.cyanHi);
      p.hline(x + 28, 31, 18, C.cyanHi);
    } else {
      p.fill(x + 26, 19, 5, 3, C.cyanHi); p.fill(x + 43, 19, 5, 3, C.cyanHi);
      p.hline(x + 30, 32, 14, C.cyan);
    }
    p.line(x + 50, 9, x + 42, 22, C.cyanHi);
    p.line(x + 42, 22, x + 51, 33, C.cyan);
    p.speckle(x + 18, 6, 36, 38, [C.panel, C.steel], r, 20, 100);
  }
  return p;
};

/* mini.png — an original atlas of small minigame sprites at the fixed slots
   quiz.js reads. One frame, transparent between slots. */
A['deltarune/tvtime/mini.png'] = () => {
  const p = new Pix(400, 136);
  /* shock burst 0,0,64x64 */
  for (let a = 0; a < 8; a++) {
    const th = a * Math.PI / 4;
    p.line(32, 32, 32 + Math.round(Math.cos(th) * 28), 32 + Math.round(Math.sin(th) * 28), a % 2 ? C.cyanHi : C.cyan);
  }
  p.disc(32, 32, 8, C.white);
  /* window 192,0,50x53 */
  p.lit(192, 0, 50, 53, C.glass); p.rect(192, 0, 50, 53, C.steel);
  p.fill(197, 5, 40, 34, C.glassHi); p.hline(197, 5, 40, C.white);
  p.vline(216, 5, 34, C.steel);
  /* aim 0,64,34x52 */
  p.line(0, 90, 34, 90, C.steel); p.line(17, 64, 17, 116, C.steel);
  p.disc(17, 90, 8, C.red); p.disc(17, 90, 3, C.white);
  /* cowboy 34,64,24x41 */
  p.poly([[46, 66], [36, 78], [56, 78]], C.wood);
  p.fill(40, 78, 12, 16, C.bone); p.fill(43, 82, 6, 4, C.ink);
  /* hit 58,64,41x40 */
  for (let a = 0; a < 6; a++) {
    const th = a * Math.PI / 3;
    p.line(78, 84, 78 + Math.round(Math.cos(th) * 18), 84 + Math.round(Math.sin(th) * 18), C.redHi);
  }
  /* cross 324,64,32x32 */
  p.fill(336, 68, 8, 24, C.gold); p.fill(328, 76, 24, 8, C.gold);
  p.hline(336, 68, 8, C.goldHi); p.vline(328, 76, 8, C.goldHi);
  /* soul 0,116,20x20 */
  p.poly([[10, 116], [18, 124], [10, 136], [2, 124]], C.teal);
  p.poly([[10, 119], [15, 124], [10, 132], [5, 124]], C.cyanHi);
  /* fire 180,116,14x14 */
  p.poly([[187, 116], [181, 126], [185, 130], [187, 130], [190, 126], [186, 120]], C.warm);
  p.poly([[187, 121], [184, 127], [189, 127]], C.warmHi);
  return p;
};

A['deltarune/tvtime/podium.png'] = () => {
  const p = new Pix(34, 44);
  p.lit(6, 6, 22, 6, C.woodHi);
  p.poly([[9, 12], [25, 12], [29, 40], [5, 40]], C.wood);
  p.hline(9, 12, 16, C.woodHi);
  p.vline(10, 14, 24, C.woodHi);
  p.hline(5, 38, 24, C.woodLo);
  p.hline(12, 20, 10, C.gold);
  p.hline(14, 20, 6, C.goldHi);
  return p;
};

A['deltarune/tvtime/portrait.png'] = () => {
  const p = new Pix(58, 80);
  p.poly([[8, 80], [12, 52], [46, 52], [50, 80]], C.charcoal);
  host(p, 29, 78, 72, { pose: 'idle', expr: 'idle', seed: 7 });
  return p;
};

/* shoot-bg.png — original dune + ruins silhouette (opaque). */
A['deltarune/tvtime/shoot-bg.png'] = () => {
  const p = new Pix(320, 160);
  for (let y = 0; y < 100; y++) {
    const t = y / 100;
    p.hline(0, y, 320, mix(C.violet, C.red, t * 0.5));
  }
  p.fill(0, 100, 320, 60, C.woodLo);
  p.hline(0, 100, 320, C.warm);
  p.poly([[0, 100], [60, 60], [110, 100]], C.shadow);
  p.poly([[180, 100], [250, 48], [320, 100]], C.shadow);
  for (let x = 0; x < 320; x += 40) { p.fill(x, 90, 6, 22, C.charcoal); p.hline(x, 90, 6, C.mid); }
  const r = rng(42);
  p.speckle(0, 0, 320, 100, [C.lilac, C.warmHi], r, 60);
  return p;
};

/* stage-bg.png — original stage: curtain, footlights, panel wall (opaque). */
A['deltarune/tvtime/stage-bg.png'] = () => {
  const p = new Pix(640, 320);
  p.fill(0, 0, 640, 320, C.shadow);
  p.fill(0, 0, 640, 60, C.charcoal);
  for (let x = 0; x < 640; x += 80) {
    p.lit(x + 4, 10, 72, 40, C.panel);
    p.fill(x + 10, 16, 60, 28, C.glass);
    p.hline(x + 10, 16, 60, C.glassHi);
  }
  /* curtain folds */
  for (let x = 0; x < 640; x += 32) {
    p.fill(x, 60, 16, 180, C.red);
    p.fill(x + 16, 60, 16, 180, C.redHi);
    p.vline(x, 60, 180, C.shadow);
  }
  p.fill(0, 240, 640, 80, C.woodLo);
  p.hline(0, 240, 640, C.wood);
  for (let x = 16; x < 640; x += 40) { p.disc(x, 236, 5, C.warmHi); p.disc(x, 236, 2, C.white); }
  const r = rng(88);
  p.speckle(0, 0, 640, 240, [C.redHi, C.panel], r, 250);
  return p;
};

/* soul.png — 2 equal cells of the original rune, dim then lit. */
A['deltarune/tvtime/soul.png'] = () => {
  const p = new Pix(32, 16);
  for (let f = 0; f < 2; f++) {
    const x = f * 16, body = f ? C.cyanHi : C.teal, inner = f ? C.white : C.cyan;
    p.poly([[x + 8, 0], [x + 15, 8], [x + 8, 15], [x + 1, 8]], C.ink);
    p.poly([[x + 8, 2], [x + 13, 8], [x + 8, 13], [x + 3, 8]], body);
    p.poly([[x + 8, 5], [x + 10, 8], [x + 8, 10], [x + 6, 8]], inner);
  }
  return p;
};

/* TV-host pose sheets: equal horizontal cells; foot anchored at cell bottom. */
function hostStrip(w, h, cols, pose, expr, seed, leanFn) {
  return () => {
    const p = new Pix(w, h), FW = w / cols;
    for (let f = 0; f < cols; f++) {
      const H = h - 8;
      host(p, Math.round(f * FW + FW / 2), h - 1, H, {
        pose, expr, seed: seed + f, lean: leanFn ? leanFn(f) : 0
      });
    }
    return p;
  };
}
A['deltarune/tvtime/tenna-podium.png'] = hostStrip(440, 133, 5, 'podium', 'idle', 2000, (f) => (f % 2 ? 1 : -1));
A['deltarune/tvtime/tenna-cheer.png'] = hostStrip(595, 121, 5, 'cheer', 'cheer', 2100);
A['deltarune/tvtime/tenna-bow.png'] = hostStrip(225, 144, 3, 'bow', 'bow', 2200, (f) => (f - 1) * 2);
A['deltarune/tvtime/tenna-point.png'] = hostStrip(82, 121, 1, 'point', 'idle', 2300);
A['deltarune/tvtime/tenna-shrug.png'] = hostStrip(94, 121, 1, 'shrug', 'idle', 2400);
A['deltarune/tvtime/tenna-shock.png'] = hostStrip(66, 125, 1, 'shock', 'shock', 2500);
A['deltarune/tvtime/tenna-sad.png'] = hostStrip(58, 107, 1, 'sad', 'sad', 2600);

/* ------------------------------------------------------------------- build */
const files = Object.keys(A).sort();
for (const rel of files) {
  const p = A[rel]();
  if (p.w > 4096 || p.h > 4096) throw new Error('oversize: ' + rel);
  save(rel, p);
}
console.log('duo: wrote ' + files.length + ' original PNGs to ' + OUT);
for (const rel of files) console.log('  ' + rel);
