#!/usr/bin/env node
/* calamity.mjs — deterministic ORIGINAL pixel-art replacements for the 59
   rights-pending sheets in img/act4/calamity/. Reads the authoritative
   geometry from js/data/sheets.js and the real PNG headers, then paints
   generic archetypes (hooded witch, armored brothers, ghost, worm, bolts,
   UI) on the SAME cell grid with TRUE alpha. No franchise shape, name,
   palette or sprite is read from the old art — only its width and height.

   Node tooling only; no dependencies (zlib is built in). Modern JS is fine
   here — nothing in scripts/ ships to the browser.                      */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const ORIG = path.join(ROOT, 'img/act4/calamity');
export const OUT = path.join(ROOT, 'img/act4/original/calamity');

/* ── site palette tokens (visual-design/references/palettes.md) ─────── */
const hx = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const C = {
  void: hx('#08080B'), ink: hx('#14141C'), crypt: hx('#22222E'), outline: hx('#12081E'),
  edge: hx('#5C5C70'), ghost: hx('#8A8598'), bone: hx('#EDE7DE'), bone2: hx('#c9b9a2'),
  lilac: hx('#B892FF'), lilacLo: hx('#6E4BA8'), lilacHi: hx('#DCC8FF'),
  blood: hx('#8C2F4A'), bloodHi: hx('#C2405F'), soul: hx('#E23B55'), soulHi: hx('#FF6D84'),
  electric: hx('#4FC3F7'), electricLo: hx('#2A6E9E'), gold: hx('#FFD34E'), goldLo: hx('#C8901E')
};

/* ── deterministic RNG (mulberry32; no Math.random / Date) ──────────── */
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[(r() * a.length) | 0];

/* ── RGBA buffer + integer painter (source-over, no smoothing) ─────── */
const buf = (w, h) => ({ w, h, d: Buffer.alloc(w * h * 4) });
function put(b, x, y, c, a = 255) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= b.w || y >= b.h || a <= 0) return;
  const i = (y * b.w + x) * 4;
  if (a >= 255) { b.d[i] = c[0]; b.d[i + 1] = c[1]; b.d[i + 2] = c[2]; b.d[i + 3] = 255; return; }
  const sa = a / 255, da = b.d[i + 3] / 255, oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  b.d[i] = (c[0] * sa + b.d[i] * da * (1 - sa)) / oa | 0;
  b.d[i + 1] = (c[1] * sa + b.d[i + 1] * da * (1 - sa)) / oa | 0;
  b.d[i + 2] = (c[2] * sa + b.d[i + 2] * da * (1 - sa)) / oa | 0;
  b.d[i + 3] = oa * 255 | 0;
}
/* Local painter: clips every primitive to its own fw×fh cell. */
function local(b, ox, oy, w, h) {
  const g = { w, h };
  g.put = (x, y, c, a) => { if (x >= 0 && y >= 0 && x < w && y < h) put(b, ox + x, oy + y, c, a); };
  g.rect = (x, y, rw, rh, c, a) => { for (let j = y | 0; j < (y + rh | 0); j++) for (let i = x | 0; i < (x + rw | 0); i++) g.put(i, j, c, a); };
  g.disc = (cx, cy, r, c, a) => { const rr = r * r; for (let dy = -r; dy <= r; dy++) { const dx = Math.floor(Math.sqrt(rr - dy * dy)); g.rect(cx - dx, cy + dy, dx * 2 + 1, 1, c, a); } };
  g.ell = (cx, cy, rx, ry, c, a) => { for (let dy = -ry; dy <= ry; dy++) { const dx = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry))); g.rect(cx - dx, cy + dy, dx * 2 + 1, 1, c, a); } };
  g.ring = (cx, cy, r, t, c, a) => { const ro = r * r, ri = (r - t) * (r - t); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const d = dx * dx + dy * dy; if (d <= ro && d >= ri) g.put(cx + dx, cy + dy, c, a); } };
  g.line = (x0, y0, x1, y1, t, c, a) => {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) { g.disc(x0, y0, t, c, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  };
  g.poly = (pts, c, a) => {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) xs.push(p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1]));
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) g.put(x, y, c, a);
    }
  };
  return g;
}
const bob = (fr, n, amp) => Math.round(Math.sin(fr / n * Math.PI * 2) * amp);
const sway = (fr, n, amp) => Math.round(Math.cos(fr / n * Math.PI * 2) * amp);

/* ── archetypes. Every fn gets a clipped cell painter + frame + RNG ── */

function witch(g, cw, ch, fr, n, col, hood) {
  const cx = cw >> 1, h = Math.round(ch * 0.82), top = ch - h - 2, bot = ch - 2;
  const by = bob(fr, n, 2), arms = ((fr / n) * 3 | 0) % 3;
  const w = Math.round(cw * 0.56), hem = Math.round(w * 0.78);
  /* robe */
  g.poly([[cx - w / 2, top + 16], [cx + w / 2, top + 16], [cx + hem / 2 + 2, bot], [cx - hem / 2 - 2, bot]], C.crypt);
  g.poly([[cx - w / 2 + 2, top + 18], [cx - 3, top + 18], [cx - 6, bot - 2], [cx - hem / 2 + 4, bot - 2]], C.ink);
  g.line(cx - w / 2 + 1, top + 18, cx - hem / 2 + 3, bot - 2, 1, C.lilacLo, 200);
  g.line(cx + w / 2 - 1, top + 18, cx + hem / 2 - 3, bot - 2, 1, C.lilacLo, 140);
  /* sash */
  g.line(cx - w / 3, top + 22 + by, cx + w / 4, top + 34 + by, 2, C.blood);
  /* arms: cast / punch / idle */
  const ay = top + 22 + by;
  if (arms === 1 || col === 1) { g.line(cx + w / 2 - 2, ay, cx + w / 2 + 9, ay - 15, 3, C.crypt); g.disc(cx + w / 2 + 10, ay - 17, 4, C.soul); g.disc(cx + w / 2 + 10, ay - 17, 2, C.bone); }
  else if (arms === 2) { g.line(cx - w / 2 + 2, ay, cx - w / 2 - 11, ay + 5, 3, C.crypt); g.disc(cx - w / 2 - 12, ay + 5, 3, C.lilac); }
  else { g.line(cx - w / 2 + 2, ay, cx - w / 2 - 5, ay + 10, 2, C.crypt); g.line(cx + w / 2 - 2, ay, cx + w / 2 + 5, ay + 10, 2, C.crypt); }
  /* head / hood */
  const hy = top + 8 + by;
  if (hood) {
    g.poly([[cx - 11, hy + 11], [cx - 9, hy - 1], [cx - 4, hy - 8], [cx + 4, hy - 8], [cx + 9, hy - 1], [cx + 11, hy + 11], [cx + 6, hy + 14], [cx - 6, hy + 14]], C.lilacLo);
    g.poly([[cx - 7, hy + 10], [cx - 5, hy], [cx + 5, hy], [cx + 7, hy + 10], [cx, hy + 12]], C.void);
    g.rect(cx - 4, hy + 5, 3, 1, C.lilac); g.rect(cx + 1, hy + 5, 3, 1, C.lilac);
    g.line(cx - 9, hy - 1, cx - 4, hy - 8, 1, C.lilacHi, 180);
  } else {
    g.ell(cx, hy + 3, 7, 9, C.bone2);
    g.rect(cx - 4, hy + 2, 2, 2, C.outline); g.rect(cx + 2, hy + 2, 2, 2, C.outline);
    g.rect(cx - 5, hy - 5, 10, 3, C.ghost);
    g.line(cx - 7, hy - 3, cx - 8, hy + 9, 2, C.lilacLo);
    g.line(cx + 7, hy - 3, cx + 8, hy + 9, 2, C.lilacLo);
  }
  /* hovering flame motes */
  for (let i = 0; i < 3; i++) {
    const a = fr / n * Math.PI * 2 + i * 2.1, mx = cx + Math.round(Math.cos(a) * (w / 2 + 9)), my = top + 20 + Math.round(Math.sin(a) * 8) + by;
    g.disc(mx, my, 3, C.soul, 210); g.disc(mx, my, 2, C.lilac); g.put(mx, my - 1, C.bone);
  }
}
function headIcon(g, cw, ch, fr, hood) {
  const cx = cw >> 1, cy = ch >> 1;
  if (hood) {
    g.poly([[cx - 14, cy + 16], [cx - 12, cy - 4], [cx - 6, cy - 14], [cx + 6, cy - 14], [cx + 12, cy - 4], [cx + 14, cy + 16], [cx + 8, cy + 18], [cx - 8, cy + 18]], C.lilacLo);
    g.poly([[cx - 9, cy + 14], [cx - 7, cy + 1], [cx + 7, cy + 1], [cx + 9, cy + 14], [cx, cy + 16]], C.void);
  } else {
    g.ell(cx, cy + 2, 11, 15, C.bone);
    g.ell(cx, cy - 8, 11, 5, C.ghost);
    g.line(cx - 11, cy - 5, cx - 12, cy + 14, 2, C.lilacLo);
    g.line(cx + 11, cy - 5, cx + 12, cy + 14, 2, C.lilacLo);
  }
  g.rect(cx - 6, cy + 4, 4, 2, C.soul); g.rect(cx + 2, cy + 4, 4, 2, C.soul);
  g.rect(cx - 5, cy + 4, 2, 1, C.bone); g.rect(cx + 3, cy + 4, 2, 1, C.bone);
  g.line(cx - 9, cy - 6, cx - 4, cy - 13, 1, C.lilacHi, 180);
}

function brother(g, cw, ch, fr, n, col, kind, glow) {
  const cx = cw >> 1, h = Math.round(ch * 0.84), top = ch - h - 2, bot = ch - 2;
  const w = Math.min(Math.round(cw * 0.62), Math.round(h * 0.8));
  const by = bob(fr, n, 2), reach = fr > n * 0.55 ? Math.round((fr - n * 0.55) / (n * 0.45) * w * 0.35) : 0;
  const dark = kind === 'a' ? C.lilacLo : C.blood, lit = kind === 'a' ? C.lilac : C.soul, hot = kind === 'a' ? C.electric : C.soulHi;
  if (glow) {
    g.ring(cx, top + Math.round(h * 0.42) + by, Math.round(w * 0.13), 3, lit, 150);
    g.disc(cx, top + Math.round(h * 0.42) + by, Math.round(w * 0.07), hot);
    g.rect(cx - Math.round(w * 0.18), top + Math.round(h * 0.16) + by, 4, 2, hot);
    g.rect(cx + Math.round(w * 0.14), top + Math.round(h * 0.16) + by, 4, 2, hot);
    g.ring(cx, top + h / 2 + by, Math.round(h * 0.42), 2, lit, 90);
    if (reach) g.disc(cx + (col ? -1 : 1) * (w / 2 + reach), top + h / 2 + by, 5, hot, 210);
    return;
  }
  /* cloak */
  g.poly([[cx - w / 2, top + h * 0.2], [cx + w / 2, top + h * 0.2], [cx + w * 0.62, bot], [cx - w * 0.62, bot]], C.ink);
  g.line(cx - w / 2, top + h * 0.2, cx - w * 0.62, bot, 2, dark, 180);
  /* legs */
  g.rect(cx - w * 0.26, bot - h * 0.22, w * 0.2, h * 0.22, C.crypt);
  g.rect(cx + w * 0.06, bot - h * 0.22, w * 0.2, h * 0.22, C.crypt);
  /* torso plate */
  g.poly([[cx - w * 0.33, top + h * 0.22 + by], [cx + w * 0.33, top + h * 0.22 + by], [cx + w * 0.28, top + h * 0.62 + by], [cx - w * 0.28, top + h * 0.62 + by]], C.ghost);
  g.poly([[cx - w * 0.3, top + h * 0.23 + by], [cx, top + h * 0.25 + by], [cx, top + h * 0.6 + by], [cx - w * 0.27, top + h * 0.61 + by]], C.edge);
  /* pauldrons */
  g.ell(cx - w * 0.38, top + h * 0.24 + by, w * 0.16, h * 0.07, dark);
  g.ell(cx + w * 0.38, top + h * 0.24 + by, w * 0.16, h * 0.07, dark);
  g.line(cx - w * 0.5, top + h * 0.22 + by, cx - w * 0.28, top + h * 0.2 + by, 2, lit, 180);
  /* arms */
  const ay = top + h * 0.32 + by;
  g.line(cx - w * 0.38, ay, cx - w * 0.44, ay + h * 0.18, Math.max(3, w * 0.06), C.crypt);
  const fx = cx + w * 0.38 + (col ? -reach : reach);
  g.line(cx + w * 0.38, ay, fx, ay + h * (reach ? 0.04 : 0.18), Math.max(3, w * 0.06), C.crypt);
  g.disc(fx, ay + h * (reach ? 0.04 : 0.18), Math.max(4, w * 0.09), dark);
  /* helm */
  g.poly([[cx - w * 0.16, top + h * 0.2 + by], [cx - w * 0.13, top + h * 0.06 + by], [cx, top + by], [cx + w * 0.13, top + h * 0.06 + by], [cx + w * 0.16, top + h * 0.2 + by]], C.crypt);
  g.line(cx, top + by, cx, top + h * 0.08 + by, 2, lit);
  g.rect(cx - Math.round(w * 0.11), top + Math.round(h * 0.13) + by, Math.max(3, Math.round(w * 0.07)), 2, hot);
  g.rect(cx + Math.round(w * 0.04), top + Math.round(h * 0.13) + by, Math.max(3, Math.round(w * 0.07)), 2, hot);
  /* chest core */
  g.disc(cx, top + Math.round(h * 0.42) + by, Math.max(3, Math.round(w * 0.08)), lit);
  g.disc(cx, top + Math.round(h * 0.42) + by, Math.max(2, Math.round(w * 0.04)), hot);
}

function attack(g, cw, ch, fr, n, alt, kind) {
  const cx = cw >> 1, cy = ch >> 1, p = fr / n;
  const grow = p < 0.6 ? 0.55 + p / 0.6 * 0.45 : 1 - (p - 0.6) / 0.4 * 0.2;
  const R = Math.round(Math.min(cw, ch) * 0.42 * grow), a = alt ? 180 : 0;
  const rad = (d) => (d + a) * Math.PI / 180;
  if (kind === 'fist') {
    const fx = cx + Math.round(Math.cos(rad(-90)) * R * 0.35), fy = cy + Math.round(Math.sin(rad(-90)) * R * 0.35);
    g.ell(fx, fy, R * 0.5, R * 0.42, C.crypt);
    g.ell(fx, fy - 2, R * 0.42, R * 0.32, C.ghost);
    for (let i = -1; i <= 1; i++) g.rect(fx + i * Math.round(R * 0.22) - 2, fy - Math.round(R * 0.28), 4, Math.round(R * 0.3), C.bone2);
    g.rect(fx - Math.round(R * 0.3), fy + Math.round(R * 0.18), Math.round(R * 0.6), 2, C.soul);
  } else {
    const pts = [];
    for (let i = -55; i <= 55; i += 11) pts.push([cx + Math.round(Math.cos(rad(i)) * R), cy + Math.round(Math.sin(rad(i)) * R)]);
    for (let i = 55; i >= -55; i -= 11) pts.push([cx + Math.round(Math.cos(rad(i)) * R * 0.76), cy + Math.round(Math.sin(rad(i)) * R * 0.76)]);
    g.poly(pts, C.blood);
    for (let i = -45; i <= 45; i += 15) g.line(cx + Math.round(Math.cos(rad(i)) * R * 0.82), cy + Math.round(Math.sin(rad(i)) * R * 0.82), cx + Math.round(Math.cos(rad(i)) * R * 0.97), cy + Math.round(Math.sin(rad(i)) * R * 0.97), 2, C.bone);
    g.line(cx + Math.round(Math.cos(rad(-55)) * R), cy + Math.round(Math.sin(rad(-55)) * R), cx + Math.round(Math.cos(rad(55)) * R), cy + Math.round(Math.sin(rad(55)) * R), 1, C.soulHi, 200);
  }
}

function worm(g, cw, ch, kind, fr, n, glow) {
  const cx = cw >> 1, cy = ch >> 1, w = cw * 0.82, h = ch * 0.82;
  const plate = (x, y, rx, ry) => {
    g.ell(x, y, rx, ry, C.crypt);
    g.ell(x - 1, y - 1, rx - 2, ry - 2, C.bone2);
    g.rect(x - Math.round(rx * 0.5), y - Math.round(ry * 0.7), 2, Math.round(ry * 0.4), C.bone);
    g.rect(x + Math.round(rx * 0.2), y + Math.round(ry * 0.3), Math.round(rx * 0.4), 2, C.ghost);
    if (!glow) { g.line(x, y - ry + 1, x, y + ry - 1, 1, C.lilacLo, 190); g.put(x, y, C.soul); }
  };
  if (glow) {
    g.disc(cx, cy, Math.max(3, Math.round(w * 0.14)), C.soul, 190);
    g.disc(cx, cy, Math.max(2, Math.round(w * 0.07)), C.bone);
    return;
  }
  if (kind === 'head') {
    plate(cx, cy + h * 0.08, w * 0.38, h * 0.35);
    g.poly([[cx - w * 0.3, cy + h * 0.2], [cx - w * 0.42, cy + h * 0.45], [cx - w * 0.16, cy + h * 0.32]], C.bone2);
    g.poly([[cx + w * 0.3, cy + h * 0.2], [cx + w * 0.42, cy + h * 0.45], [cx + w * 0.16, cy + h * 0.32]], C.bone2);
    g.rect(cx - Math.round(w * 0.24), cy - Math.round(h * 0.05), 4, 3, C.soul);
    g.rect(cx + Math.round(w * 0.16), cy - Math.round(h * 0.05), 4, 3, C.soul);
    g.line(cx - w * 0.2, cy + h * 0.16, cx + w * 0.2, cy + h * 0.16, 2, C.outline);
  } else if (kind === 'tail') {
    plate(cx, cy, w * 0.32, h * 0.32);
    g.poly([[cx - w * 0.2, cy + h * 0.15], [cx + w * 0.2, cy + h * 0.15], [cx, cy + h * 0.45]], C.crypt);
    g.line(cx, cy, cx, cy + h * 0.4, 1, C.lilacLo, 180);
  } else if (kind === 'body' || kind === 'bodyAlt') {
    plate(cx, cy, w * 0.42, h * 0.4);
    if (kind === 'bodyAlt') { g.ring(cx, cy, Math.round(w * 0.28), 2, C.bone2, 160); g.disc(cx, cy, Math.max(3, Math.round(w * 0.1)), C.soul); }
    for (let i = -1; i <= 1; i++) g.rect(cx + i * Math.round(w * 0.2) - 1, cy - Math.round(h * 0.35), 2, Math.round(h * 0.18), C.bone, 180);
  } else if (kind === 'arm' || kind === 'forearm') {
    g.rect(cx - Math.max(2, cw * 0.16), cy - ch * 0.42, Math.max(4, cw * 0.32), ch * 0.6, C.crypt);
    g.rect(cx - Math.max(1, cw * 0.12), cy - ch * 0.4, Math.max(2, cw * 0.24), ch * 0.5, C.bone2);
    g.line(cx, cy - ch * 0.36, cx, cy + ch * 0.2, 1, C.lilacLo, 200);
    g.ell(cx, cy + ch * 0.22, cw * 0.24, ch * 0.1, C.bone2);
  } else if (kind === 'hand') {
    g.ell(cx, cy + ch * 0.16, cw * 0.3, ch * 0.18, C.crypt);
    g.ell(cx, cy + ch * 0.12, cw * 0.26, ch * 0.14, C.bone2);
    for (let i = -1; i <= 1; i++) { g.line(cx + i * Math.round(cw * 0.18), cy, cx + i * Math.round(cw * 0.26), cy - ch * 0.38, 2, C.bone); g.disc(cx + i * Math.round(cw * 0.26), cy - ch * 0.38, 2, C.soul); }
  }
}
function energyBall(g, cw, ch, fr, n) {
  const cx = cw >> 1, cy = ch >> 1, r = Math.min(cw, ch) * 0.36 + bob(fr, n, 2);
  g.ring(cx, cy, r, 2, C.soul, 170);
  g.disc(cx, cy, r * 0.8, C.lilacLo, 200);
  g.disc(cx, cy, r * 0.5, C.lilac);
  g.disc(cx - 1, cy - 1, r * 0.25, C.bone);
}

function ghost(g, cw, ch, fr, n, mood, r) {
  const cx = cw >> 1, by = bob(fr, n, Math.max(1, ch * 0.04));
  const w = cw * 0.36, top = ch * 0.22 + by;
  g.ell(cx, top + ch * 0.22, w, ch * 0.24, C.ghost);
  g.ell(cx - 1, top + ch * 0.2, w * 0.85, ch * 0.2, C.bone2);
  g.poly([[cx - w, top + ch * 0.3], [cx + w, top + ch * 0.3], [cx + w * 1.1, ch * 0.86], [cx + w * 0.5, ch * 0.74], [cx, ch * 0.9], [cx - w * 0.5, ch * 0.74], [cx - w * 1.1, ch * 0.86]], C.ghost, 210);
  const ey = top + ch * 0.2;
  g.disc(cx - w * 0.4, ey, Math.max(1, w * 0.18), C.outline); g.disc(cx + w * 0.4, ey, Math.max(1, w * 0.18), C.outline);
  g.put(cx - w * 0.4, ey, C.soul); g.put(cx + w * 0.4, ey, C.soul);
  const my = ey + ch * 0.14;
  if (mood === 'sad') g.line(cx - w * 0.3, my + 1, cx + w * 0.3, my + 1, 1, C.ink);
  else if (mood === 'angry') { g.line(cx - w * 0.5, ey - ch * 0.06, cx - w * 0.2, ey - ch * 0.01, 1, C.blood); g.line(cx + w * 0.5, ey - ch * 0.06, cx + w * 0.2, ey - ch * 0.01, 1, C.blood); g.line(cx - w * 0.2, my + 1, cx + w * 0.2, my + 1, 1, C.ink); }
  else { g.line(cx - w * 0.3, my - 1, cx + w * 0.3, my - 1, 1, C.ink); g.put(cx + w * 0.8, top + ch * 0.1, C.lilac); }
  if (r) { g.disc(cx - w * 1.2, top + ch * 0.5 + sway(fr, n, 3), 1, C.lilac, 180); g.disc(cx + w * 1.2, top + ch * 0.4 + bob(fr, n, 3), 1, C.electric, 160); }
}
function polter(g, cw, ch, fr, n, layer) {
  const cx = cw >> 1, by = bob(fr, n, 4), cy = ch * 0.4 + by;
  if (layer === 2) {
    const r = rng(hash('pg2' + fr)), count = fr < n * 0.5 ? 2 : 4;
    for (let i = 0; i < count; i++) g.disc(cx + Math.round((r() - 0.5) * cw * 0.6), ch * 0.35 + Math.round(r() * ch * 0.5), 1 + (r() * 2 | 0), C.soul, 190);
    return;
  }
  const W = cw * 0.3;
  if (layer === 1) {
    g.ring(cx, cy, W * 1.25, 2, C.soul, 120);
    g.disc(cx - W * 0.38, cy, W * 0.2, C.soulHi); g.disc(cx + W * 0.38, cy, W * 0.2, C.soulHi);
    g.ring(cx, ch * 0.62 + by, W * 1.5, 2, C.lilac, 70);
    return;
  }
  g.poly([[cx - W * 1.3, cy + W], [cx + W * 1.3, cy + W], [cx + W * 1.6, ch * 0.92], [cx + W * 0.7, ch * 0.82], [cx, ch * 0.96], [cx - W * 0.7, ch * 0.82], [cx - W * 1.6, ch * 0.92]], C.crypt);
  g.ell(cx, cy, W, ch * 0.16, C.bone2);
  g.ell(cx, cy - 3, W * 0.86, ch * 0.13, C.bone);
  g.rect(cx - Math.round(W * 0.5), cy - 2, Math.max(3, Math.round(W * 0.32)), 4, C.outline);
  g.rect(cx + Math.round(W * 0.18), cy - 2, Math.max(3, Math.round(W * 0.32)), 4, C.outline);
  g.put(cx - Math.round(W * 0.36), cy, C.soul); g.put(cx + Math.round(W * 0.32), cy, C.soul);
  for (let i = -2; i <= 2; i++) g.rect(cx + i * Math.round(W * 0.3) - 1, cy + ch * 0.08, 2, 3, C.bone2);
  for (let i = 0; i < 3; i++) { const wx = cx + (i - 1) * W * 1.3 + sway(fr, n, 4 + i); g.line(wx, ch * 0.6 + by, wx + (i - 1) * 3, ch * (0.78 + i * 0.04) + by, 1, C.ghost, 150); }
}
function hook(g, cw, ch, fr) {
  const cx = cw >> 1, cy = ch >> 1, k = fr ? 3 : 0;
  g.line(cx, 2, cx, cy + 6, 2, C.edge);
  g.ring(cx, cy + 9 + k, Math.max(3, cw * 0.16), 2, C.ghost);
  for (let i = -1; i <= 1; i++) g.poly([[cx + i * Math.round(cw * 0.16) - 3, cy + 10 + k], [cx + i * Math.round(cw * 0.16) + 3, cy + 10 + k], [cx + i * Math.round(cw * 0.2), ch - 2]], C.bone2);
  g.disc(cx, cy + 9 + k, 2, C.soul);
}
function chain(g, cw, ch) {
  const cx = cw >> 1, cy = ch >> 1;
  g.ring(cx, cy - ch * 0.2, cw * 0.28, 2, C.edge);
  g.ring(cx, cy + ch * 0.2, cw * 0.28, 2, C.ghost);
  g.line(cx, cy - 2, cx, cy + 2, 2, C.bone2);
}

/* bolts, flames, bursts — generic VFX, no franchise silhouettes */
function bolt(g, cw, ch, fr, n, style) {
  const cx = cw >> 1, cy = ch >> 1, r = rng(hash('bolt' + style + fr));
  const grow = 0.85 + 0.15 * Math.sin(fr / n * Math.PI * 2);
  if (style === 'spear') {
    g.line(cx, 2, cx, ch - 2, Math.max(2, cw * 0.14), C.edge);
    g.line(cx - 1, 3, cx - 1, ch - 3, 1, C.ghost);
    g.poly([[cx, 0], [cx - cw * 0.32, ch * 0.24], [cx + cw * 0.32, ch * 0.24]], C.bone2);
    g.poly([[cx, ch], [cx - cw * 0.2, ch * 0.76], [cx + cw * 0.2, ch * 0.76]], C.lilacLo);
    g.disc(cx, ch * 0.24, 2, C.soul);
  } else if (style === 'ray') {
    g.rect(cx - Math.max(1, cw * 0.22), 0, Math.max(2, cw * 0.44), ch, C.blood, 150);
    g.rect(cx - Math.max(1, cw * 0.1), 0, Math.max(2, cw * 0.2), ch, C.soulHi);
    g.rect(cx - 1, 0, 2, ch, C.bone);
  } else {
    const len = ch * 0.44 * grow, wid = cw * 0.36;
    g.poly([[cx, cy - len], [cx + wid, cy], [cx + wid * 0.5, cy + len * 0.7], [cx, cy + len], [cx - wid * 0.5, cy + len * 0.7], [cx - wid, cy]], style === 'ghost' ? C.electricLo : C.blood);
    g.poly([[cx, cy - len * 0.8], [cx + wid * 0.55, cy], [cx, cy + len * 0.8], [cx - wid * 0.55, cy]], style === 'ghost' ? C.electric : C.soul);
    g.disc(cx, cy, Math.max(2, wid * 0.45), C.bone);
    for (let i = 0; i < 3; i++) g.disc(cx + Math.round((r() - 0.5) * cw * 0.7), cy + Math.round((r() - 0.5) * ch * 0.7), 1, C.lilac, 160);
  }
}
function burst(g, cw, ch, fr, n, style) {
  const cx = cw >> 1, cy = ch >> 1, p = n > 1 ? fr / (n - 1) : 0.5, R = Math.min(cw, ch) * (0.3 + p * 0.24), r = rng(hash('burst' + fr));
  const fade = p > 0.7 ? Math.round(255 * (1 - p) / 0.3) : 255;
  g.ring(cx, cy, R, Math.max(2, R * 0.18), style === 'ghost' ? C.electric : C.soul, fade);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + fr * 0.1; const d = R * (0.9 + r() * 0.5); g.disc(cx + Math.round(Math.cos(a) * d), cy + Math.round(Math.sin(a) * d), 1 + (r() * 2 | 0), i % 2 ? C.bone : C.lilac, fade); }
  g.disc(cx, cy, Math.max(2, R * 0.28), C.bone, fade);
}
function demon(g, cw, ch, fr, n) {
  const cx = cw >> 1, cy = ch * 0.52 + bob(fr, n, 3), w = cw * 0.26;
  g.poly([[cx - w, cy - ch * 0.1], [cx - w * 2.2, cy - ch * 0.36], [cx - w * 0.8, cy + ch * 0.04]], C.crypt);
  g.poly([[cx + w, cy - ch * 0.1], [cx + w * 2.2, cy - ch * 0.36], [cx + w * 0.8, cy + ch * 0.04]], C.crypt);
  g.ell(cx, cy, w, ch * 0.3, C.blood);
  g.ell(cx, cy - 2, w * 0.8, ch * 0.24, C.bloodHi);
  g.rect(cx - Math.round(w * 0.5), cy - 2, 3, 2, C.gold); g.rect(cx + Math.round(w * 0.2), cy - 2, 3, 2, C.gold);
  g.poly([[cx - w * 0.5, cy - ch * 0.26], [cx - w * 0.1, cy - ch * 0.44], [cx, cy - ch * 0.24]], C.bone2);
  g.poly([[cx + w * 0.5, cy - ch * 0.26], [cx + w * 0.1, cy - ch * 0.44], [cx, cy - ch * 0.24]], C.bone2);
  g.line(cx - w, cy + ch * 0.24, cx - w * 1.3, cy + ch * 0.42, 2, C.blood);
  g.line(cx + w, cy + ch * 0.24, cx + w * 1.3, cy + ch * 0.42, 2, C.blood);
}
function heart(g, cw, ch, fr, n) {
  const cx = cw >> 1, cy = ch * 0.5 + bob(fr, n, 2), s = Math.min(cw, ch) * 0.34 * (1 + 0.06 * Math.sin(fr / n * Math.PI * 2));
  g.poly([[cx, cy + s], [cx - s, cy - s * 0.2], [cx - s * 0.8, cy - s * 0.85], [cx, cy - s * 0.45], [cx + s * 0.8, cy - s * 0.85], [cx + s, cy - s * 0.2]], C.blood);
  g.poly([[cx, cy + s * 0.7], [cx - s * 0.7, cy - s * 0.25], [cx - s * 0.55, cy - s * 0.7], [cx, cy - s * 0.35]], C.soul);
  g.disc(cx - s * 0.3, cy - s * 0.35, 2, C.bone);
  g.ring(cx, cy, s * 1.1, 1, C.lilac, 120);
}
function seeker(g, cw, ch, fr, n, glow) {
  const cx = cw >> 1, cy = ch * 0.5 + bob(fr, n, 5), r = Math.min(cw, ch) * 0.3;
  if (glow) { g.ring(cx, cy, r * 1.1, 3, C.soul, 160); g.disc(cx, cy, r * 0.5, C.bone, 150); return; }
  g.ring(cx, cy, r, 3, C.ghost);
  g.ell(cx, cy, r * 0.8, r * 0.7, C.crypt);
  g.ell(cx, cy - 2, r * 0.7, r * 0.55, C.bone2);
  g.rect(cx - Math.round(r * 0.5), cy - 2, 3, 3, C.soul); g.rect(cx + Math.round(r * 0.25), cy - 2, 3, 3, C.soul);
  for (let i = 0; i < 4; i++) { const a = fr / n * Math.PI * 2 + i * Math.PI / 2; g.line(cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), cx + Math.round(Math.cos(a) * r * 1.4), cy + Math.round(Math.sin(a) * r * 1.4), 1, C.lilac, 180); }
}
function ash(g, cw, ch, fr, n) {
  const cx = cw >> 1, cy = ch * 0.6, r = rng(hash('ash' + fr));
  g.poly([[cx, ch * 0.2], [cx + cw * 0.28, cy], [cx + cw * 0.18, ch * 0.9], [cx - cw * 0.18, ch * 0.9], [cx - cw * 0.28, cy]], C.crypt);
  g.poly([[cx, ch * 0.24], [cx + cw * 0.18, cy], [cx, ch * 0.78], [cx - cw * 0.18, cy]], C.blood);
  g.disc(cx, cy, Math.max(2, cw * 0.12), C.soul);
  g.disc(cx - 1, cy - 1, 2, C.bone);
  for (let i = 0; i < 4; i++) g.disc(cx + Math.round((r() - 0.5) * cw * 0.8), ch * 0.2 + Math.round(r() * ch * 0.5), 1, i % 2 ? C.gold : C.soulHi, 190);
}
function shield(g, cw, ch, kind) {
  const cx = cw >> 1, cy = ch >> 1;
  if (kind === 'field') {
    for (let y = 6; y < ch - 6; y += 10) for (let x = 6 + ((y / 10 | 0) % 2) * 9; x < cw - 6; x += 18) {
      g.poly([[x, y - 6], [x + 9, y], [x, y + 6], [x - 9, y]], C.lilac, 70);
      g.put(x, y, C.bone, 120);
    }
    g.ring(cx, cy, Math.min(cw, ch) * 0.42, 2, C.soul, 130);
  } else {
    const top = kind === 'top';
    const pts = [];
    const y0 = top ? 4 : ch - 4, y1 = top ? ch * 0.8 : ch * 0.2;
    for (let i = 0; i <= 12; i++) { const t = i / 12, x = cx + (t - 0.5) * cw * 0.92, y = y1 + (y0 - y1) * Math.abs(t - 0.5) * 2; pts.push([x, y]); }
    for (let i = 12; i >= 0; i--) { const t = i / 12, x = cx + (t - 0.5) * cw * 0.72, y = y1 + (y0 - y1) * Math.abs(t - 0.5) * 2 + (top ? 7 : -7); pts.push([x, y]); }
    g.poly(pts, C.lilacLo, 170);
    for (let i = 0; i <= 12; i++) g.put(pts[i][0] | 0, pts[i][1] | 0, C.bone, 210);
  }
}
function bar(g, cw, ch, fr, n, kind) {
  const pad = 2, x0 = pad, x1 = cw - pad - 1, y0 = (ch >> 1) - 4, y1 = y0 + 8;
  const hot = kind === 'rage' ? C.soul : C.electric, dark = kind === 'rage' ? C.blood : C.electricLo;
  g.rect(x0, y0, x1 - x0, y1 - y0, C.void);
  g.line(x0, y0, x1, y0, 1, C.edge); g.line(x0, y1, x1, y1, 1, C.edge);
  g.line(x0, y0, x0, y1, 1, C.ghost); g.line(x1, y0, x1, y1, 1, C.ghost);
  if (kind === 'border' || kind === 'borderFill') {
    const span = kind === 'borderFill' ? Math.round((x1 - x0) * (fr + 1) / n) : x1 - x0;
    g.rect(x0 + 2, y0 + 2, span - 4, y1 - y0 - 4, dark);
    g.rect(x0 + 2, y0 + 2, Math.max(0, span - 6), 2, hot);
    for (let i = 0; i < span; i += 8) g.rect(x0 + 2 + i, y0 + 4, 2, y1 - y0 - 4, C.void, 120);
  } else if (kind === 'anim') {
    const full = (fr + 1) / n, span = Math.round((x1 - x0 - 4) * full);
    g.rect(x0 + 2, y0 + 2, span, y1 - y0 - 4, dark);
    g.rect(x0 + 2, y0 + 2, span, 2, hot);
    g.disc(x0 + 2 + span, (y0 + y1) >> 1, 3, hot);
    g.disc(x0 + 2 + span, (y0 + y1) >> 1, 1, C.bone);
  } else {
    g.rect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4, dark);
    g.rect(x0 + 2, y0 + 2, x1 - x0 - 8, 2, hot);
  }
}

/* ── filename → archetype manifest (original artwork never consulted) - */
const ARCH = {
  'SupremeCalamitas.png': ['witch', 0], 'SupremeCalamitasHooded.png': ['witch', 1],
  'HoodlessHeadIcon.png': ['face', 0], 'HoodedHeadIcon.png': ['face', 1],
  'SupremeCataclysm.png': ['brother', 'a'], 'SupremeCatastrophe.png': ['brother', 'b'],
  'SupremeCataclysmGlow.png': ['brotherGlow', 'a'], 'SupremeCatastropheGlow.png': ['brotherGlow', 'b'],
  'SupremeCataclysmFist.png': ['fist', 0], 'SupremeCataclysmFistAlt.png': ['fist', 1],
  'SupremeCatastropheSlash.png': ['slash', 0], 'SupremeCatastropheSlashAlt.png': ['slash', 1],
  'SepulcherHead.png': ['worm', 'head'], 'SepulcherBody.png': ['worm', 'body'],
  'SepulcherBodyAlt.png': ['worm', 'bodyAlt'], 'SepulcherTail.png': ['worm', 'tail'],
  'SepulcherArm.png': ['worm', 'arm'], 'SepulcherForearm.png': ['worm', 'forearm'],
  'SepulcherHand.png': ['worm', 'hand'], 'SepulcherBodyEnergyBall.png': ['ball'],
  'Polterghast.png': ['polter', 0], 'PolterghastGlow.png': ['polter', 1], 'PolterghastGlow2.png': ['polter', 2],
  'PolterghastHook.png': ['hook'], 'PolterghastChain.png': ['chain'],
  'PhantomSpirit.png': ['phantom', 'plain'], 'PhantomSpiritS.png': ['phantom', 'sad'],
  'PhantomSpiritM.png': ['phantom', 'angry'], 'PhantomSpiritL.png': ['phantom', 'happy'],
  'RenegadeWarlock.png': ['warlock'],
  'BrimstoneBarrage.png': ['bolt', 'dart'], 'BrimstoneHellblast2.png': ['bolt', 'fire'],
  'SCalBrimstoneFireblast.png': ['bolt', 'fire'], 'SCalBrimstoneGigablast.png': ['bolt', 'fire'],
  'AcceleratingDarkMagicFlame.png': ['bolt', 'fire'], 'CondemnationArrowSCal.png': ['bolt', 'spear'],
  'BrimstoneRayMid.png': ['bolt', 'ray'], 'BrimstoneRayEnd.png': ['bolt', 'ray'],
  'RedirectingDarkSoul.png': ['bolt', 'ghost'],
  'SuicideBomberDemonHostile.png': ['demon'], 'SuicideBomberDemonExplosion.png': ['burst', 'fire'],
  'PhantomHookShot.png': ['bolt', 'ghost'], 'PhantomGhostShot.png': ['bolt', 'ghost'],
  'PhantomBlast.png': ['burst', 'ghost'], 'PhantomBlast2.png': ['burst', 'ghost'],
  'PhantomMine.png': ['mine'], 'SoulSeekerSupreme.png': ['seeker', 0],
  'SoulSeekerSupremeGlow.png': ['seeker', 1], 'BrimstoneHeart.png': ['heart'],
  'AshesofAnnihilation.png': ['ash'], 'ForcefieldTexture.png': ['shield', 'field'],
  'SupremeShieldTop.png': ['shield', 'top'], 'SupremeShieldBottom.png': ['shield', 'bottom'],
  'RageBar.png': ['bar', 'rage'], 'RageBarBorder.png': ['bar', 'border'],
  'RageFullAnimation.png': ['bar', 'rageAnim'], 'AdrenalineBar.png': ['bar', 'tp'],
  'AdrenalineBarBorder.png': ['bar', 'borderFill'], 'AdrenalineFullAnimation.png': ['bar', 'tpAnim']
};

/* ── authoritative geometry: manifest + real PNG header ────────────── */
export function pngHeader(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a PNG: ' + file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bit: b[24], type: b[25] };
}
export function loadSpec() {
  const src = fs.readFileSync(path.join(ROOT, 'js/data/sheets.js'), 'utf8');
  const sb = { window: {} }; vm.createContext(sb); vm.runInContext(src, sb);
  const all = { ...sb.window.NEU.sheets, ...sb.window.NEU.dgSheets };
  const byFile = {};
  for (const [key, v] of Object.entries(all)) {
    const m = /calamity\/([^']+\.png)/.exec(v.src || '');
    if (!m) continue;
    const rec = { key, w: v.w, h: v.h, fw: v.fw, fh: v.fh, frames: v.frames, cols: v.cols || 1, fps: v.fps, lin: !!v.lin };
    if (byFile[m[1]]) byFile[m[1]].keys.push(key);
    else byFile[m[1]] = { ...rec, keys: [key] };
  }
  const files = fs.readdirSync(ORIG).filter(f => f.endsWith('.png')).sort();
  return files.map(f => {
    const meta = byFile[f];
    if (!meta) throw new Error('no manifest entry for ' + f);
    const hdr = pngHeader(path.join(ORIG, f));
    if (hdr.w !== meta.w || hdr.h !== meta.h) throw new Error('header/manifest mismatch: ' + f);
    if (!ARCH[f]) throw new Error('no archetype for ' + f);
    return { file: f, ...meta, ...hdr };
  });
}

/* ── deterministic PNG encoder (RGBA, 8-bit, no interlace) ─────────── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, cr]);
}
export function encodePNG(b) {
  const raw = Buffer.alloc((b.w * 4 + 1) * b.h);
  for (let y = 0; y < b.h; y++) { raw[y * (b.w * 4 + 1)] = 0; b.d.copy(raw, y * (b.w * 4 + 1) + 1, y * b.w * 4, (y + 1) * b.w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(b.w, 0); ihdr.writeUInt32BE(b.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ── paint one whole sheet ─────────────────────────────────────────── */
export function render(spec) {
  const b = buf(spec.w, spec.h), [kind, arg] = ARCH[spec.file];
  for (let fr = 0; fr < spec.frames; fr++) for (let col = 0; col < spec.cols; col++) {
    const g = local(b, col * spec.fw, fr * spec.fh, spec.fw, spec.fh);
    if (kind === 'witch') witch(g, spec.fw, spec.fh, fr, spec.frames, col, arg);
    else if (kind === 'face') headIcon(g, spec.fw, spec.fh, fr, arg);
    else if (kind === 'brother') brother(g, spec.fw, spec.fh, fr, spec.frames, col, arg, false);
    else if (kind === 'brotherGlow') brother(g, spec.fw, spec.fh, fr, spec.frames, col, arg, true);
    else if (kind === 'fist') attack(g, spec.fw, spec.fh, fr, spec.frames, arg, 'fist');
    else if (kind === 'slash') attack(g, spec.fw, spec.fh, fr, spec.frames, arg, 'slash');
    else if (kind === 'worm') worm(g, spec.fw, spec.fh, arg, fr, spec.frames, false);
    else if (kind === 'ball') energyBall(g, spec.fw, spec.fh, fr, spec.frames);
    else if (kind === 'polter') polter(g, spec.fw, spec.fh, fr, spec.frames, arg);
    else if (kind === 'hook') hook(g, spec.fw, spec.fh, fr);
    else if (kind === 'chain') chain(g, spec.fw, spec.fh);
    else if (kind === 'phantom') ghost(g, spec.fw, spec.fh, fr, spec.frames, arg, true);
    else if (kind === 'warlock') { witch(g, spec.fw, spec.fh, fr, spec.frames, 0, true); g.line(spec.fw * 0.8, 6, spec.fw * 0.8, spec.fh - 4, 1, C.edge); g.disc(spec.fw * 0.8, 6, 2 + (fr % 2), C.soul); }
    else if (kind === 'bolt') bolt(g, spec.fw, spec.fh, fr, spec.frames, arg);
    else if (kind === 'burst') burst(g, spec.fw, spec.fh, fr, spec.frames, arg);
    else if (kind === 'demon') demon(g, spec.fw, spec.fh, fr, spec.frames);
    else if (kind === 'heart') heart(g, spec.fw, spec.fh, fr, spec.frames);
    else if (kind === 'mine') { const cx = spec.fw >> 1, cy = spec.fh >> 1; g.ring(cx, cy, Math.min(spec.fw, spec.fh) * 0.36, 2, C.electric); g.disc(cx, cy, Math.min(spec.fw, spec.fh) * 0.24, C.electricLo); g.disc(cx, cy, 3, C.bone); g.ring(cx, cy, Math.min(spec.fw, spec.fh) * 0.45, 1, C.ghost, 140); }
    else if (kind === 'seeker') seeker(g, spec.fw, spec.fh, fr, spec.frames, arg);
    else if (kind === 'ash') ash(g, spec.fw, spec.fh, fr, spec.frames);
    else if (kind === 'shield') shield(g, spec.fw, spec.fh, arg);
    else if (kind === 'bar') bar(g, spec.fw, spec.fh, fr, spec.frames, arg);
    else throw new Error('unhandled archetype ' + kind);
    /* speckle control: flecks seeded above stay inside the cell by g.put */
  }
  /* no magenta may ever be emitted (the site's missing-texture colour) */
  for (let i = 0; i < b.d.length; i += 4) if (b.d[i] === 255 && b.d[i + 1] === 0 && b.d[i + 2] === 255) throw new Error('magenta pixel in ' + spec.file);
  return encodePNG(b);
}
export function buildAll() {
  const out = new Map();
  for (const s of loadSpec()) out.set(s.file, render(s));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(OUT, { recursive: true });
  const all = buildAll();
  for (const [f, data] of all) fs.writeFileSync(path.join(OUT, f), data);
  console.log('calamity: wrote ' + all.size + ' original sheets to ' + path.relative(ROOT, OUT));
}
