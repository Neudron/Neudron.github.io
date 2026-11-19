/* Original VFX strips for www.neu.ac.
   Deterministic, dependency-free pixel raster -> PNG (RGBA8, filter 0).
   Dimensions, frame counts and cell sizes come from js/data/sheets.js so
   the output always matches the runtime contract. Run from anywhere:

     node scripts/v3/gen-art/vfx.mjs
     VFX_OUT=/tmp/vfx-check node scripts/v3/gen-art/vfx.mjs

   No source images, franchise shapes, blur or smooth gradients. Every
   colour is a token from visual-design/references/palettes.md. */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.resolve(process.env.VFX_OUT || path.join(ROOT, 'img/act4/original/vfx'));

/* ── site ramp ─────────────────────────────────────────────────── */

const TOKENS = {
  void: '#08080B', ink: '#14141C', crypt: '#22222E', panel: '#3A3550',
  edge: '#5C5C70', ghost: '#8A8598', bone: '#EDE7DE', white: '#F4F0FF',
  blood: '#8C2F4A', soul: '#E23B55', redHi: '#FF4D6A',
  dim: '#3E8FB0', electric: '#4FC3F7', glow: '#9FF0FF',
  goldLo: '#C8901E', gold: '#FFD34E', lilac: '#B892FF'
};
const rgb = {};
for (const k in TOKENS) {
  const h = TOKENS[k];
  rgb[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const c = k => rgb[k];

/* ── integer raster ────────────────────────────────────────────── */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function surface(w, h) { return { w, h, d: new Uint8Array(w * h * 4) }; }

function put(s, x, y, col, cov = 1) {
  x = x | 0; y = y | 0;
  if (x < 0 || y < 0 || x >= s.w || y >= s.h || cov <= 0) return;
  if (cov < 1 && BAYER[((y & 3) << 2) | (x & 3)] >= cov * 16) return;
  const p = (y * s.w + x) << 2, v = c(col);
  s.d[p] = v[0]; s.d[p + 1] = v[1]; s.d[p + 2] = v[2]; s.d[p + 3] = 255;
}
function rect(s, x, y, w, h, col, cov = 1) {
  for (let j = y | 0; j < (y | 0) + h; j++)
    for (let i = x | 0; i < (x | 0) + w; i++) put(s, i, j, col, cov);
}
function line(s, x0, y0, x1, y1, col, thick = 1, cov = 1) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, guard = 0;
  for (;;) {
    rect(s, x0 - ((thick - 1) >> 1), y0 - ((thick - 1) >> 1), thick, thick, col, cov);
    if (x0 === x1 && y0 === y1 || ++guard > 512) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function disc(s, cx, cy, r, col, cov = 1) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r + 0.001) put(s, cx + x, cy + y, col, cov);
}
function ring(s, cx, cy, r, thick, col, cov = 1) {
  const inner = (r - thick) * (r - thick), outer = (r + 0.5) * (r + 0.5);
  for (let y = -r - 1; y <= r + 1; y++)
    for (let x = -r - 1; x <= r + 1; x++) {
      const q = x * x + y * y;
      if (q >= inner && q <= outer) put(s, cx + x, cy + y, col, cov);
    }
}
function glyph(s, rows, scale, cx, cy, col, accent) {
  const h = rows.length, w = rows[0].length;
  const ox = cx - ((w * scale) >> 1), oy = cy - ((h * scale) >> 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === ' ') continue;
      rect(s, ox + x * scale, oy + y * scale, scale, scale,
           ch === '+' ? accent : col);
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
const seedOf = name => {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return h >>> 0;
};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const fade = (t, head, tail) => Math.min(1, t / head, (1 - t) / tail);

/* ── effect primitives ─────────────────────────────────────────── */

function burst(s, f, t, name, ramp, maxR, spokes) {
  const { cx, cy } = s, r = 1 + t * maxR, cov = fade(t, 0.05, 0.22);
  if (cov <= 0) return;
  if (cov < 0.4) {                       /* collapse to a core, no speckle */
    disc(s, cx, cy, Math.max(1, Math.round(r * 0.12)), ramp[3]);
    return;
  }
  const rand = rng(seedOf(name));
  ring(s, cx, cy, r, 2, ramp[0], cov);
  ring(s, cx, cy, r * 0.74, 2, ramp[1], cov);
  ring(s, cx, cy, r * 0.44, 2, ramp[2], cov);
  disc(s, cx, cy, Math.max(1, Math.round(r * 0.16)), ramp[3], cov);
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2 + rand() * 0.3;
    const len = r * (0.7 + rand() * 0.45), wob = (rand() - 0.5) * 3;
    const x1 = Math.round(cx + Math.cos(a) * len), y1 = Math.round(cy + Math.sin(a) * len + wob);
    line(s, cx, cy, x1, y1, ramp[1], 2, cov);
    line(s, cx, cy, Math.round(cx + Math.cos(a) * len * 0.6),
         Math.round(cy + Math.sin(a) * len * 0.6), ramp[2], 1, cov);
    put(s, x1, y1, ramp[3], cov);
  }
  for (let k = 0; k < spokes * 2; k++) {
    const a = rand() * Math.PI * 2, d = r * (0.9 + rand() * 0.35);
    put(s, cx + Math.cos(a) * d, cy + Math.sin(a) * d, k % 3 ? ramp[1] : ramp[3], cov);
  }
}

function slash(s, f, t, name, ramp, diag = true) {
  const { w, h, cx, cy } = s, span = Math.min(w, h) * 0.42 * Math.min(1, t * 3.2);
  const cov = fade(t, 0.03, 0.2), rand = rng(seedOf(name));
  const dx = diag ? 0.75 : 1, dy = diag ? -0.66 : 0;
  const x0 = cx - dx * span, y0 = cy - dy * span, x1 = cx + dx * span, y1 = cy + dy * span;
  line(s, x0, y0, x1, y1, ramp[0], 5, cov);
  line(s, x0, y0, x1, y1, ramp[1], 3, cov);
  line(s, x0, y0, x1, y1, ramp[2], 1, cov);
  line(s, x0 + (diag ? 2 : 0), y0 + (diag ? 3 : 8), x1 + (diag ? 2 : 0), y1 + (diag ? 3 : 8), ramp[0], 2, cov * 0.7);
  for (let k = 0; k < 8; k++) {
    const a = rand() * 6.28, d = 7 + rand() * span * 0.5;
    put(s, cx + Math.cos(a) * d, cy + Math.sin(a) * d, k % 2 ? ramp[1] : ramp[2], cov);
  }
  disc(s, cx, cy, 2, ramp[3], cov);
}

function column(s, f, t, name, ramp) {
  const { w, h, cx } = s, cov = fade(t, 0.04, 0.18), rand = rng(seedOf(name));
  const grow = Math.min(1, t * 2.4), top = Math.round(h * (1 - grow) * 0.4);
  const half = Math.round(3 + 5 * Math.sin(Math.PI * Math.min(1, t * 1.5)));
  rect(s, cx - half - 3, top, (half + 3) * 2, h - top, ramp[0], cov * 0.55);
  rect(s, cx - half, top, half * 2, h - top, ramp[1], cov);
  rect(s, cx - 2, top, 4, h - top, ramp[2], cov);
  rect(s, cx - 1, top, 2, h - top, ramp[3], cov);
  for (let k = 0; k < 3; k++) {
    const y = Math.round(top + (h - top) * (k + 1) / 4);
    rect(s, cx - half - 4 - k, y, (half + 4 + k) * 2, 2, ramp[0], cov);
  }
  for (let k = 0; k < 14; k++) {
    const side = rand() < 0.5 ? -1 : 1;
    const x = cx + side * (half + 2 + rand() * 10);
    const y = top + rand() * (h - top);
    put(s, x, y, k % 3 ? ramp[1] : ramp[2], cov);
  }
}

function fetchSparks(s, f, t, name, ramp, inward) {
  const { w, h, cx, cy } = s, N = 18, rand = rng(seedOf(name));
  const cov = fade(t, 0.05, 0.22), R = Math.min(w, h) * 0.46;
  if (cov <= 0) return;
  if (inward) {
    const rr = Math.max(2, Math.round(R * (1 - t)));
    /* a shrinking diamond reads as gathering even at 1x; dots alone do not */
    const pts = [[cx, cy - rr], [cx + rr, cy], [cx, cy + rr], [cx - rr, cy]];
    for (let k = 0; k < 4; k++) line(s, pts[k][0], pts[k][1],
                                      pts[(k + 1) % 4][0], pts[(k + 1) % 4][1], ramp[1], 1, cov);
  }
  for (let k = 0; k < N; k++) {
    const a = rand() * 6.28, d0 = 5 + rand() * R;
    const d = inward ? d0 * (1 - t) + 2 : d0 * (0.4 + t);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    put(s, x, y, ramp[k % 3], cov);
    if (k % 4 === 0) rect(s, x, y - 2, 1, 5, ramp[3], cov);
  }
  if (inward && t > 0.6) {
    ring(s, cx, cy, 3 + (t - 0.6) * 20, 2, ramp[2], cov);
    disc(s, cx, cy, 2, ramp[3], cov);
  }
}

function heal(s, f, t, name) {
  const { w, h, cx, cy } = s, rand = rng(seedOf(name));
  const cov = fade(t, 0.04, 0.2), pulse = 4 + Math.round(3 * Math.sin(t * 6.28));
  rect(s, cx - 1, cy - 11 - pulse, 3, 22 + pulse * 2, 'gold', cov);
  rect(s, cx - 11 - pulse, cy - 1, 22 + pulse * 2, 3, 'gold', cov);
  rect(s, cx, cy - 9 - pulse, 1, 18 + pulse * 2, 'bone', cov);
  rect(s, cx - 9 - pulse, cy, 18 + pulse * 2, 1, 'bone', cov);
  disc(s, cx, cy, 3, 'white', cov);
  ring(s, cx, cy, 13 + t * 16, 1, 'goldLo', cov * 0.8);
  for (let k = 0; k < 16; k++) {
    const x = cx + (rand() - 0.5) * (w - 8), y = cy + 10 - rand() * (h - 12) * t;
    put(s, x, y, k % 3 ? 'gold' : 'white', cov * 0.85);
  }
}

function ward(s, f, t, name) {
  const { cx, cy } = s, rand = rng(seedOf(name));
  const cov = fade(t, 0.04, 0.18), r = 12 + 13 * Math.sin(Math.PI * t);
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + k * Math.PI / 3;
    pts.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]);
  }
  for (let k = 0; k < 6; k++) {
    const p = pts[k], q = pts[(k + 1) % 6];
    line(s, p[0], p[1], q[0], q[1], 'dim', 3, cov);
    line(s, p[0], p[1], q[0], q[1], 'electric', 1, cov);
    disc(s, p[0], p[1], 2, 'glow', cov);
  }
  ring(s, cx, cy, r * 0.66, 1, 'lilac', cov * 0.8);
  disc(s, cx, cy, 3, 'white', cov);
  for (let k = 0; k < 12; k++) {
    const a = rand() * 6.28, d = r + 3 + rand() * 8;
    put(s, cx + Math.cos(a) * d, cy + Math.sin(a) * d, k % 2 ? 'glow' : 'lilac', cov);
  }
}

function smoke(s, f, t, name) {
  const { w, h, cx, cy } = s, rand = rng(seedOf(name));
  for (let k = 0; k < 4; k++) {
    const phase = (t + k / 4) % 1;
    const px = cx + Math.round(Math.sin(phase * 6.28 + k) * 9 + (k - 1.5) * 7);
    const py = cy + h * 0.28 - Math.round(phase * h * 0.8);
    const r = 7 + Math.round(4 * Math.sin(phase * Math.PI));
    const cover = clamp(0.85 - phase * 0.6, 0, 1) * (k % 2 ? 0.62 : 0.85);
    disc(s, px, py, r, k % 3 === 0 ? 'crypt' : 'edge', cover);
    disc(s, px, py, Math.max(1, r - 4), 'ghost', cover * 0.7);
  }
  for (let k = 0; k < 8; k++) {
    const phase = (t + k / 8) % 1;
    put(s, cx + Math.round((rand() - 0.5) * w * 0.7),
        cy + h * 0.3 - Math.round(phase * h * 0.9), 'edge', 0.5 - phase * 0.35);
  }
}

function emberFlame(s, t, name) {
  const { w, h, cx } = s, rand = rng(seedOf(name));
  const base = h - 2, tall = Math.round(h * (0.55 + 0.2 * Math.sin(t * 6.28 + seedOf(name) % 7)));
  for (let y = 0; y < tall; y++) {
    const u = y / tall;
    const half = Math.max(1, Math.round((w * 0.32) * (1 - u) + 1));
    const wob = Math.round(Math.sin(u * 7 + t * 6.28) * 2);
    rect(s, cx + wob - half, base - y, half * 2, 1, u < 0.35 ? 'goldLo' : 'gold');
    rect(s, cx + wob - Math.max(0, half - 2), base - y, (half - 2) * 2, 1, 'bone');
    if (u < 0.6) put(s, cx + wob, base - y, 'white');
  }
  for (let k = 0; k < 5; k++)
    put(s, cx + Math.round((rand() - 0.5) * w * 0.6),
        Math.max(1, base - tall - Math.round(rand() * 6)), k % 2 ? 'gold' : 'bone');
}

function verdictIcon(s, f, t, name, kind) {
  const { w, h, cx, cy } = s, rand = rng(seedOf(name));
  const r = 14 + Math.round(3 * Math.sin(t * 6.28));
  const good = kind !== 'no';
  const ringCol = good ? 'gold' : 'blood', outer = good ? 'goldLo' : 'soul';
  ring(s, cx, cy, r, 2, outer, 0.85);
  ring(s, cx, cy, r - 3, 1, ringCol, 0.8);
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + t * 0.4;
    put(s, cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4),
        k % 2 ? ringCol : 'bone', 0.7);
  }
  if (kind === 'ok') {
    glyph(s, ['       ++', '      ++ ', '     ++  ', '++  ++   ', ' ++ ++   ', '  ++++   ', '   ++    '],
          3, cx, cy, 'bone', 'white');
  } else if (kind === 'no') {
    glyph(s, ['++     ++', ' ++   ++ ', '  ++ ++  ', '   +++   ', '  ++ ++  ', ' ++   ++ ', '++     ++'],
          3, cx, cy, 'soul', 'redHi');
  } else if (kind === 'thumb') {
    glyph(s, ['  ++       ', '  ++       ', '  ++       ', '  ++       ', '  +++++++  ',
              '++++++++++ ', '+++++++++++', '+++++++++++', ' +++++++++ ', '  +++++++  ', '  +++++    '],
          2, cx, cy, 'electric', 'glow');
  } else {
    const letters = {
      S: [' +++++ ', '++   ++', '+      ', ' +++++ ', '      +', '++   ++', ' +++++ '],
      A: ['  +++  ', ' ++ ++ ', '++   ++', '+++++++', '++   ++', '++   ++', '++   ++'],
      B: ['+++++  ', '++  ++ ', '++  ++ ', '+++++  ', '++  ++ ', '++  ++ ', '+++++  '],
      C: [' +++++ ', '++   ++', '+      ', '+      ', '+      ', '++   ++', ' +++++ ']
    };
    const tone = { S: ['gold', 'white'], A: ['bone', 'gold'], B: ['goldLo', 'bone'], C: ['electric', 'glow'] }[kind];
    glyph(s, letters[kind], 3, cx, cy, tone[0], tone[1]);
    if (kind === 'S') {
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + t * 0.5;
        rect(s, cx + Math.cos(a) * 16 - 1, cy + Math.sin(a) * 16 - 1, 3, 3, 'white', 0.9);
      }
    }
  }
  for (let k = 0; k < 6; k++) {
    const a = rand() * 6.28, d = r + 7 + rand() * 4;
    put(s, cx + Math.cos(a) * d, cy + Math.sin(a) * d, good ? 'gold' : 'soul', 0.6);
  }
}

/* ── per-file art ──────────────────────────────────────────────── */

const ART = {
  FxBullet: s => {
    rect(s, 2, 3, 4, 2, 'goldLo'); rect(s, 3, 3, 3, 2, 'gold');
    put(s, 5, 3, 'white'); put(s, 1, 4, 'goldLo');
  },
  FxPellet: s => {
    rect(s, 2, 2, 4, 4, 'goldLo'); rect(s, 3, 2, 3, 3, 'gold');
    put(s, 3, 2, 'white'); put(s, 4, 3, 'bone');
  },
  FxSoul: s => {
    rect(s, 4, 2, 4, 2, 'soul'); rect(s, 2, 4, 8, 3, 'soul');
    rect(s, 3, 7, 6, 2, 'soul'); rect(s, 4, 9, 4, 1, 'blood');
    rect(s, 5, 4, 2, 2, 'redHi'); put(s, 4, 4, 'bone');
  },
  FxFlame: s => {
    rect(s, 5, 1, 2, 4, 'glow'); rect(s, 4, 4, 4, 4, 'electric');
    rect(s, 3, 7, 6, 3, 'dim'); rect(s, 5, 5, 2, 3, 'white');
    put(s, 5, 0, 'white'); put(s, 3, 6, 'glow'); put(s, 8, 6, 'glow');
  },
  FxGhost: s => {
    rect(s, 4, 1, 4, 5, 'glow'); rect(s, 3, 3, 6, 4, 'electric');
    rect(s, 3, 7, 2, 3, 'electric'); rect(s, 7, 7, 2, 3, 'electric');
    put(s, 5, 4, 'void'); put(s, 7, 4, 'void'); put(s, 6, 2, 'white');
  },
  FxBolt: s => {
    line(s, 10, 1, 7, 8, 'gold', 2); line(s, 7, 8, 11, 8, 'gold', 2);
    line(s, 11, 8, 5, 15, 'gold', 2); line(s, 10, 2, 7, 7, 'white', 1);
    line(s, 8, 9, 6, 13, 'white', 1); put(s, 10, 1, 'bone');
  },
  FxFire: (s, f) => emberFlame(s, f / 4, 'FxFire'),
  FxBoom: (s, f, t) => burst(s, f, t, 'FxBoom', ['blood', 'soul', 'gold', 'white'], 22, 8),
  FxHoly: (s, f, t) => column(s, f, t, 'FxHoly', ['dim', 'glow', 'bone', 'white']),
  GigBoomO: (s, f, t) => burst(s, f, t, 'GigBoomO', ['blood', 'goldLo', 'gold', 'white'], 30, 10),
  GigBoomV: (s, f, t) => burst(s, f, t, 'GigBoomV', ['panel', 'lilac', 'glow', 'white'], 45, 12),
  GigHitV: (s, f, t) => slash(s, f, t, 'GigHitV', ['lilac', 'panel', 'glow', 'white']),
  GigHitY: (s, f, t) => slash(s, f, t, 'GigHitY', ['goldLo', 'gold', 'bone', 'white']),
  GigCast: (s, f, t) => fetchSparks(s, f, t, 'GigCast', ['dim', 'electric', 'glow', 'white'], true),
  GigNova: (s, f, t) => burst(s, f, t, 'GigNova', ['dim', 'electric', 'glow', 'white'], 15, 12),
  GigMend: (s, f, t) => heal(s, f, t, 'GigMend'),
  GigWard: (s, f, t) => ward(s, f, t, 'GigWard'),
  GigBrim: (s, f, t) => column(s, f, t, 'GigBrim', ['blood', 'soul', 'gold', 'white']),
  GigSmoke: (s, f, t) => smoke(s, f, t, 'GigSmoke'),
  GigOK: (s, f, t) => verdictIcon(s, f, t, 'GigOK', 'ok'),
  GigNO: (s, f, t) => verdictIcon(s, f, t, 'GigNO', 'no'),
  GigThumb: (s, f, t) => verdictIcon(s, f, t, 'GigThumb', 'thumb'),
  GigRankS: (s, f, t) => verdictIcon(s, f, t, 'GigRankS', 'S'),
  GigRankA: (s, f, t) => verdictIcon(s, f, t, 'GigRankA', 'A'),
  GigRankB: (s, f, t) => verdictIcon(s, f, t, 'GigRankB', 'B'),
  GigRankC: (s, f, t) => verdictIcon(s, f, t, 'GigRankC', 'C')
};

/* ── read the runtime contract ─────────────────────────────────── */

const manifest = fs.readFileSync(path.join(ROOT, 'js/data/sheets.js'), 'utf8');
const re = /src:\s*IMG\s*\+\s*'[^']*vfx\/([A-Za-z]+)\.png'\s*,\s*w:\s*(\d+),\s*h:\s*(\d+),\s*frames:\s*(\d+),\s*fw:\s*(\d+),\s*fh:\s*(\d+)/g;
const specs = [];
let m;
while ((m = re.exec(manifest))) {
  specs.push({ name: m[1], w: +m[2], h: +m[3], frames: +m[4], fw: +m[5], fh: +m[6] });
}
if (specs.length !== 26) throw new Error('expected 26 vfx sheets in sheets.js, found ' + specs.length);
for (const sp of specs) {
  if (!ART[sp.name]) throw new Error('no generator for ' + sp.name);
  if (sp.frames * sp.fw * sp.fh !== sp.w * sp.h) throw new Error('cell mismatch: ' + sp.name);
  if (Math.max(sp.w, sp.h) > 4096) throw new Error('oversize: ' + sp.name);
}

/* ── PNG encoder ───────────────────────────────────────────────── */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
    t[n] = v;
  }
  return t;
})();
function crc32(buf) {
  let v = -1;
  for (let i = 0; i < buf.length; i++) v = CRC[(v ^ buf[i]) & 255] ^ (v >>> 8);
  return (v ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encode(s) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s.w, 0); ihdr.writeUInt32BE(s.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = s.w * 4, raw = Buffer.alloc(s.h * (stride + 1));
  for (let y = 0; y < s.h; y++) {
    const row = y * (stride + 1);
    raw[row] = 0;
    Buffer.from(s.d.buffer, y * stride, stride).copy(raw, row + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ── emit ──────────────────────────────────────────────────────── */

fs.mkdirSync(OUT, { recursive: true });
for (const sp of specs) {
  const s = surface(sp.w, sp.h);
  s.cx = sp.fw >> 1; s.cy = sp.fh >> 1;
  const horizontal = sp.w === sp.frames * sp.fw && sp.w !== sp.fh;
  for (let f = 0; f < sp.frames; f++) {
    const cell = surface(sp.fw, sp.fh);
    cell.cx = sp.fw >> 1; cell.cy = sp.fh >> 1;
    ART[sp.name](cell, f, sp.frames === 1 ? 0.5 : (f + 1) / sp.frames);
    const ox = horizontal ? f * sp.fw : 0, oy = horizontal ? 0 : f * sp.fh;
    for (let y = 0; y < sp.fh; y++)
      for (let x = 0; x < sp.fw; x++) {
        const src = (y * sp.fw + x) << 2, dst = ((oy + y) * sp.w + ox + x) << 2;
        s.d[dst] = cell.d[src]; s.d[dst + 1] = cell.d[src + 1];
        s.d[dst + 2] = cell.d[src + 2]; s.d[dst + 3] = cell.d[src + 3];
      }
  }
  fs.writeFileSync(path.join(OUT, sp.name + '.png'), encode(s));
}
console.log('wrote ' + specs.length + ' original VFX strips to ' + OUT);
