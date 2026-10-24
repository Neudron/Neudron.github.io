/* fixes24.mjs — the contrast budget, per theme, read from the real CSS.
   Run: node tests/fixes24.mjs

   G7. The palette is hand-written in css/style.css and nothing checked
   it against WCAG. This suite parses the custom properties out of the
   file, resolves var() chains the way the cascade does, and computes the
   WCAG 2.x contrast ratio for every theme the page can show:

     dark                          :root
     light                         body.is-lit-mode (overrides :root)
     dark  + prefers-contrast:more @media block that redeclares :root
     light + prefers-contrast:more both of the above, light winning

   Hex and rgb values only; anything else is an error, not a skip.

   Thresholds follow what each token is used for. The usage is read from
   the CSS itself: a token set as `color:` in any rule is text and needs
   4.5:1; --accent needs 3:1 only if nothing uses it as text. --edge is a
   control border (3:1). --rule is decorative and not checked.

   --ghost is the one token NOT measured against --page. The first draft
   of this suite did, and reported 3.00:1 (1.70:1 with prefers-contrast)
   on the light page as a defect. Checking where it is painted showed
   every --ghost rule sits on a game overlay with its own dark
   background (quiz, shop, craft, deck, settings, boot), so it is never
   drawn on the light page at all. It is measured against those
   surfaces instead, and §2 fails the moment any page-level rule starts
   using it — that is the real hazard, and it is now guarded. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const CSS = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const MORE = '(prefers-contrast: more)';

/* ── a small CSS reader: comments, nested @media, flat declarations ── */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* Split on `sep` only outside parentheses, so url(...) and rgb(...) stay whole. */
function splitTop(s, sep) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseDecls(body) {
  const out = [];
  for (const d of splitTop(body, ';')) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    const name = d.slice(0, i).trim();
    if (name) out.push([name, d.slice(i + 1).trim().replace(/\s+/g, ' ')]);
  }
  return out;
}

function parseRules(text, media = '', out = []) {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    let head = text.slice(i, open);
    const semi = head.lastIndexOf(';');            // drop @import-style lines
    if (semi >= 0) head = head.slice(semi + 1);
    let depth = 1, j = open + 1;
    while (j < text.length && depth) {
      if (text[j] === '{') depth++; else if (text[j] === '}') depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1);
    const sel = head.trim().replace(/\s+/g, ' ');
    if (sel.startsWith('@media')) parseRules(body, sel.slice(6).trim(), out);
    else if (!sel.startsWith('@')) out.push({ sel, media, decls: parseDecls(body) });
    i = j;
  }
  return out;
}

const RULES = parseRules(stripComments(CSS));
const declsOf = (sel, media = '') =>
  RULES.filter(r => r.sel === sel && r.media === media).flatMap(r => r.decls);
const toMap = list => { const m = {}; for (const [k, v] of list) m[k] = v; return m; };

/* Resolve one element's custom properties. `own` are the declarations on
   this element; anything it does not declare is inherited from `parent`.
   var() inside a declaration resolves against this element's own
   values, which is how the cascade works for custom properties. */
function resolveScope(own, parent) {
  const cache = {}, stack = new Set();
  const subst = raw => raw.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g,
    (_, name, fb) => {
      const v = lookup(name);
      return v !== undefined ? v : (fb !== undefined ? fb.trim() : '');
    });
  function lookup(name) {
    if (name in cache) return cache[name];
    if (!(name in own)) return parent[name];
    if (stack.has(name)) throw new Error('cycle through ' + name);
    stack.add(name);
    cache[name] = subst(own[name]);
    stack.delete(name);
    return cache[name];
  }
  const out = { ...parent };
  for (const name of Object.keys(own)) out[name] = lookup(name);
  return out;
}

function tokensFor({ lit, more }) {
  const rootOwn = toMap([...declsOf(':root'), ...(more ? declsOf(':root', MORE) : [])]);
  const rootC = resolveScope(rootOwn, {});
  if (!lit) return rootC;
  return resolveScope(toMap(declsOf('body.is-lit-mode')), rootC);
}

/* ── colour maths ──────────────────────────────────────────────── */
function rgbOf(v) {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (h) {
    let x = h[1];
    if (x.length === 3) x = [...x].map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
  }
  const r = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*1(?:\.0+)?\s*)?\)$/i.exec(v);
  if (r) return [1, 2, 3].map(i => +r[i]);
  throw new Error(`unsupported colour value "${v}" (hex and rgb only)`);
}
const chan = c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const contrast = (a, b) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/* How many rules set a token as text colour (`color: var(--x)`). */
const textUses = tok => RULES.filter(r =>
  r.decls.some(([k, v]) => k === 'color' && v === `var(${tok})`)).length;

/* ═══ 0. the parser found the blocks it is supposed to read ═══════*/
console.log('\n0. the parser found the token blocks');
const rootKeys = declsOf(':root').map(([k]) => k).filter(k => k.startsWith('--'));
ok(`:root declares the palette (${rootKeys.length} custom properties)`,
   ['--page', '--text', '--dim', '--ghost', '--edge', '--accent'].every(k => rootKeys.includes(k)));
const litKeys = declsOf('body.is-lit-mode').map(([k]) => k);
ok(`body.is-lit-mode overrides the page tokens (${litKeys.length} declarations)`,
   ['--page', '--text', '--dim', '--edge', '--accent'].every(k => litKeys.includes(k)));
const moreKeys = declsOf(':root', MORE).map(([k]) => k);
ok(`prefers-contrast: more redeclares :root (${moreKeys.join(', ')})`, moreKeys.includes('--dim'));

/* ═══ 1. every theme, every token that carries text or a border ═══*/
const THEMES = [
  { name: 'dark',                          lit: false, more: false },
  { name: 'light',                         lit: true,  more: false },
  { name: 'dark + prefers-contrast: more', lit: false, more: true  },
  { name: 'light + prefers-contrast: more', lit: true, more: true  },
];

const ghostUses = textUses('--ghost');
/* The surfaces --ghost text actually sits on (their own `background`
   declarations in style.css). Lightest first — the worst case. */
const OVERLAY_SURFACES = [
  { name: 'quiz',     bg: '#1B0E2E' },
  { name: 'shop row', bg: '#170D1F' },
  { name: 'settings', bg: '#120A1E' },
  { name: 'deck',     bg: '#0B0E14' },
];
/* Selectors allowed to paint with --ghost: the game's own overlays. A
   page-level rule using it would put 3:1 text on the light page. */
const OVERLAY_PREFIX = /^(\.boot|\.quiz|\.shop|\.craft|\.deck|\.sett|\.fnf|\.polt|\.bh|\.dk|\.eng|\.crack|\.tbox|\.sheetbox|\.dev|\.fps)/;
const dimUses = textUses('--dim');
const accentUses = textUses('--accent');
console.log(`\n1. contrast per theme (usage read from the CSS: --ghost text in ${ghostUses} rules, ` +
            `--dim in ${dimUses}, --accent in ${accentUses})`);

for (const theme of THEMES) {
  console.log(`\n  ${theme.name}`);
  const t = tokensFor(theme);
  const page = rgbOf(t['--page']);
  const check = (label, token, min) => {
    const r = contrast(rgbOf(t[token]), page);
    ok(`${theme.name}: ${label} ${token} ${t[token]} on ${t['--page']} = ${r.toFixed(2)}:1 (min ${min})`,
       r >= min);
  };
  check('body text', '--text', 4.5);
  check('secondary text', '--dim', 4.5);
  /* --ghost is an OVERLAY token: every rule that paints with it sits on
     a game surface with its own dark background (boot, quiz, shop,
     craft, deck, settings — §2 below proves no page-level rule uses
     it). So it is measured against those surfaces, worst case first,
     not against --page, which it is never drawn on. */
  for (const surf of OVERLAY_SURFACES) {
    const r = contrast(rgbOf(t['--ghost']), rgbOf(surf.bg));
    ok(`${theme.name}: ghost text --ghost ${t['--ghost']} on ${surf.name} ${surf.bg} = ${r.toFixed(2)}:1 (min 4.5)`,
       r >= 4.5);
  }
  check(accentUses > 0 ? `accent text (${accentUses} rules)` : 'accent (no text use)', '--accent',
        accentUses > 0 ? 4.5 : 3);
  check('control border', '--edge', 3);
}

/* ═══ 2. --ghost never paints on the page ═════════════════════════*/
console.log('\n2. --ghost is overlay-only');
{
  const ghostSel = RULES.filter(r => r.decls.some(([k, v]) => /^(color|background|background-color)$/.test(k) && /var\(--ghost\)/.test(v)))
    .flatMap(r => r.sel.split(',').map(x => x.trim()));
  const leaks = ghostSel.filter(sel => !OVERLAY_PREFIX.test(sel));
  ok(`every rule painting with --ghost is inside an overlay (${ghostSel.length} selectors)`, leaks.length === 0);
  if (leaks.length) console.log('       leaks: ' + leaks.join(' | '));
}

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
