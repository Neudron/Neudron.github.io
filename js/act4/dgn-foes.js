/* dgn-foes.js — the dungeon's foes (B4) and the hero's soul kit.
   Terraria hardmode dungeon + Calamity dungeon foes, by AI family (terraria.wiki.gg / calamitymod.wiki.gg numbers,
   speeds are Terraria px/tick x 60; a Terraria px is a world px here). HP counts hits, not Terraria numbers.
   The hero swings the axe (Z, plat.js) and runs a NEU.kit: hold Z for the equipped soul shot, C for the TP strip.
   Every attack shows its own shape first (aim line, beam path, mark, sparkle), then fires along it. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat, def = P && P.levels && P.levels.dgn;
  if (!def) return;
  var T = 16, GRAV = 1080, MAXF = 600, HOP = -330, PIT = 1 / 60;
  var KIND = {
    u: { s: 'dgSkull', ai: 'skull', hp: 2, v: 60 },
    U: { s: 'dgSkullG', ai: 'skull', hp: 6, v: 50, flame: 1, big: 1 },
    a: { s: 'dgBonesB', ai: 'fighter', hp: 3, v: 90, big: 1 },
    t: { s: 'dgBonesR', ai: 'fighter', hp: 3, v: 80, big: 1 },
    h: { s: 'dgBonesH', ai: 'fighter', hp: 3, v: 100, big: 1 },
    j: { s: 'dgBoneLee', ai: 'fighter', hp: 6, v: 220, leap: 1, big: 1 },
    E: { s: 'dgPaladin', ai: 'fighter', hp: 25, v: 50, hammer: 1, big: 1, stiff: 1 },
    y: { s: 'dgSniper', ai: 'ranged', hp: 3, v: 59, gun: 'sniper', big: 1 },
    T: { s: 'dgTactic', ai: 'ranged', hp: 3, v: 70, gun: 'shotgun', big: 1 },
    C: { s: 'dgCommando', ai: 'ranged', hp: 3, v: 70, gun: 'rocket', big: 1 },
    N: { s: 'dgNecro', ai: 'caster', hp: 4, spell: 'beam', big: 1 },
    G: { s: 'dgRagged', ai: 'caster', hp: 4, spell: 'souls', big: 1 },
    X: { s: 'dgDiabol', ai: 'caster', hp: 4, spell: 'inferno', big: 1 },
    Y: { s: 'dgWarlock', ai: 'warlock', hp: 4, v: 120, big: 1 },
    Q: { s: 'dgPhantom', ai: 'spirit', hp: 2, v: 1020, phantom: 1 },
    s: { s: 'dgSpirit', ai: 'spirit', hp: 2, v: 600 },
    O: { s: 'dgBall', ai: 'ball', hp: 0 },
    W: { s: 'dgWheel', ai: 'wheel', hp: 0, v: 90 }
  };
  /* Calamity's four Phantom Spirits: normal, sad, angry, happy (the only one that shoots), equal odds */
  var MOODS = [['dgPhantom', 1020, 0], ['dgPhantomS', 900, 0], ['dgPhantomM', 810, 0], ['dgPhantomL', 720, 1]];
  /* sniper: first shot 1.67 s after it sees you, then every 3.33 s; a hit sets it back to 2.17 s */
  var GUN = { sniper: { first: 1.67, every: 3.33, hit: 2.17, range: 700, v: 1600 }, shotgun: { first: 1.5, every: 3, hit: 2, range: 420, v: 700 },
    rocket: { first: 1.5, every: 4, hit: 2.5, range: 520, v: 300 } };
  /* casters: first windup 1.67 s; necromancer beams every 0.83 s after, five per cycle; ragged 3 volleys of 3 souls
     0.33 s apart, 1 s between volleys; diabolist 3 bolts, 1.67 s each, then it teleports */
  var SPELL = { beam: { first: 1.67, next: 0.83, per: 5, cycle: 7.5, hitTp: 0.5 }, souls: { first: 1.67, next: 1, per: 3, cycle: 9, hitTp: 0 },
    inferno: { first: 1.67, next: 1.67, per: 3, cycle: 6.67, hitTp: 1 } };
  var PHANTOM = ['* Wails echo through the dilapidated dungeon halls...', '* Long-dead prisoners seek their zealous revenge...'];
  var foes = [], shots = [], pops = [], fxs = [], kit = null, F = { x: 0, y: 0, fx: 1, fy: 0 }, box = { AX: 0, AY: 0, AW: 640, AH: 360 }, lastDir = 0;

  function sheet(k) { return NEU.dgSheets && NEU.dgSheets[k]; }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function rnd() { return Math.random(); }
  function hero() { return P.hero(); }
  function hx() { return hero().x; }
  function hy() { return hero().y - P.hh / 2; }
  function solidAt(px, py) { return P.solid(Math.floor(px / T), Math.floor(py / T)); }
  function seeLine(x0, y0, x1, y1) {
    var d = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)), n = Math.ceil(d / 8), i;
    for (i = 1; i < n; i++) if (solidAt(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    return true;
  }
  /* a ground foe's feet belong on the first standable tile under its spawn char — a char that floats
     (d3's 'a' sits two tiles over the floor) must not materialize with its head inside the ceiling */
  function floorBelow(x, y) { var fy = y + 1; while (fy < y + 200 && !P.solid(x, fy) && P.cell(x, fy) !== '=') fy++; return fy; }
  function spawn(k, x, y, sp) {
    var d = KIND[k], sh, m, f;
    if (!d) return null;
    f = { k: k, d: d, s: d.s, v: d.v, x: (x + 0.5) * T, y: 0, vx: 0, vy: 0, hp: d.hp, face: -1, t: 0, a: 0, n: 0, st: 0, sp: sp || null, walked: 0, flash: 0, cd: 0, shoots: 0 };
    if (d.phantom) { m = MOODS[(rnd() * 4) | 0]; f.s = m[0]; f.v = m[1]; f.shoots = m[2]; }
    sh = sheet(f.s); f.w = sh && sh.hit ? sh.hit.w : 16; f.h = sh && sh.hit ? sh.hit.h : 16; f.r = Math.min(f.w, f.h) / 2;
    f.y = d.ai === 'fighter' || d.ai === 'ranged' || d.ai === 'caster' || d.ai === 'warlock' ? floorBelow(x, y) * T - f.h / 2 : (y + 0.5) * T;
    if (d.ai === 'ball') { f.px = f.x; f.py = (y + 0.5) * T; f.len = 9 * T; }
    if (d.ai === 'wheel') { f.dx = 1; f.dy = 0; f.cx = x; f.cy = y; f.pr = 0; }
    if (d.ai === 'ranged') f.t = -1;
    if (d.ai === 'caster') { f.t = SPELL[d.spell].first; f.cyc = SPELL[d.spell].cycle; }
    foes.push(f); return f;
  }
  /* ── bodies that walk: Terraria NPC gravity (0.3 px/tick^2) and tile collision, jumpthru shelves from above ── */
  function boxHits(f, x, y, dy, oldB) {
    var x0 = Math.floor((x - f.w / 2) / T), x1 = Math.floor((x + f.w / 2 - 0.01) / T), y0 = Math.floor((y - f.h / 2) / T), y1 = Math.floor((y + f.h / 2 - 0.01) / T), tx, ty;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++)
      if (P.solid(tx, ty) || (dy > 0 && P.cell(tx, ty) === '=' && oldB <= ty * T + 0.01)) return true;
    return false;
  }
  function body(f, dt) {
    var n, i, sx, sy, ob, hitX = false;
    f.vy = Math.min(MAXF, f.vy + GRAV * dt); f.ground = false;
    n = Math.max(1, Math.ceil(Math.max(Math.abs(f.vx), Math.abs(f.vy)) * dt / 4)); sx = f.vx * dt / n; sy = f.vy * dt / n;
    for (i = 0; i < n; i++) {
      if (!boxHits(f, f.x + sx, f.y, 0, 0)) f.x += sx; else hitX = true;
      ob = f.y + f.h / 2;
      if (!boxHits(f, f.x, f.y + sy, sy, ob)) f.y += sy; else { if (sy > 0) f.ground = true; f.vy = 0; sy = 0; }
    }
    if (f.ground) f.walked += Math.abs(f.vx) * dt;
    return hitX;
  }
  function touchHero(f) {
    var h = hero();
    return h.x + P.hw > f.x - f.w / 2 && h.x - P.hw < f.x + f.w / 2 && h.y > f.y - f.h / 2 && h.y - P.hh < f.y + f.h / 2;
  }
  function hurtHero(n, dir) {
    var h = hero();
    if (h.dead > 0 || h.inv > 0 || P.replaying()) return;
    lastDir = dir || sgn(h.x - F.x) || 1;
    if (kit && kit.hit(n)) { h.inv = P.C.hurtInv; fxs.push({ x: h.x, y: h.y - 6, t: 0.4, d: 0.4, k: 'fxGigHitV' }); }
  }
  function shoot(o) { o.age = 0; o.r = o.r || 4; shots.push(o); return o; }
  function aimAt(f, sp, spread) { var a = Math.atan2(hy() - f.y, hx() - f.x) + (spread || 0); return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: a }; }

  /* foe shot sprites (img/act4/vfx, CC0/AI sources — see .opencode/plans/vfx-assets.md).
     A missing file just falls back to the old glow+rect, same as before. */
  var FXS = { bullet: 'dgFxBullet', pellet: 'dgFxPellet', soul: 'dgFxSoul', flame: 'dgFxFlame', ghost: 'dgFxGhost', bolt: 'dgFxBolt' };
  function fxIm(k) {
    var sh = k && NEU.dgSheets && NEU.dgSheets[k];
    if (!sh) return null;
    /* Draw the alpha-cleaned dungeon sprites for projectiles too. */
    return NEU.dungeonLook && NEU.dungeonLook.sheet ? NEU.dungeonLook.sheet(k) : NEU.sheetReady(sh);
  }
  function fxShot(c, s, k) {
    var im = fxIm(k), sh = im && NEU.dgSheets[k], w, h, angle;
    if (!im) return false;
    w = sh.fw || sh.w; h = sh.fh || sh.h;
    angle = Math.atan2(s.vy || 0, s.vx || 1);
    if (sh.forward === 'up') angle += Math.PI / 2;
    else if (sh.forward === 'down') angle -= Math.PI / 2;
    else if (sh.forward === 'left') angle += Math.PI;
    c.save(); c.translate(Math.round(s.x), Math.round(s.y)); c.rotate(angle);
    c.imageSmoothingEnabled = false;
    c.drawImage(im, 0, 0, w, h, -w / 2, -h / 2, w, h); c.restore();
    return true;
  }

    /* ── AI families ───────────────────────────────────────────────────── */
  function fighter(f, dt) {
    var d = f.d, dx = hx() - f.x, stuck, v;
    if (f.st === 1) { f.t -= dt; f.vx *= 0.8; if (f.t <= 0) { throwHammer(f); f.st = 0; f.cd = 3; } body(f, dt); return; }
    if (f.turn > 0) f.turn -= dt; else f.face = sgn(dx) || f.face;
    v = f.face * f.v;
    f.vx += Math.max(-f.v * 4 * dt, Math.min(f.v * 4 * dt, v - f.vx));
    stuck = body(f, dt);
    if (stuck && f.ground) f.vy = HOP;
    if (Math.abs(f.vx) < 8) f.stall = (f.stall || 0) + dt; else f.stall = 0;
    if (f.stall > 2) { f.turn = 2; f.face = -f.face; f.stall = 0; }
    if (d.leap && f.ground && (f.cd -= dt) <= 0 && Math.abs(dx) < 96 && Math.abs(hy() - f.y) < 40) { f.vx = sgn(dx) * 360; f.vy = -300; f.cd = 2; }
    if (d.hammer && (f.cd -= dt) <= 0 && Math.abs(dx) < 25 * T && onScreen(f.x, f.y, 0) && seeLine(f.x, f.y, hx(), hy())) { f.st = 1; f.t = 0.6; f.aim = { x: hx(), y: hy() }; }
  }
  function throwHammer(f) { var a = Math.atan2(f.aim.y - f.y, f.aim.x - f.x); shoot({ k: 'hammer', x: f.x, y: f.y - 8, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, r: 12, life: 2.2, back: 0.9, home: f, ghost: 1 }); }
  function ranged(f, dt) {
    var g = GUN[f.d.gun], dx = hx() - f.x, d = Math.sqrt(dx * dx + (hy() - f.y) * (hy() - f.y)), see = d < g.range && onScreen(f.x, f.y, 0) && seeLine(f.x, f.y - 6, hx(), hy());
    if (see && f.ground) {
      f.vx *= 0.7; f.face = sgn(dx) || f.face; body(f, dt);
      if (f.t < 0) f.t = g.first;
      f.t -= dt;
      if (f.t > 0.25) f.aim = { x: hx(), y: hy() };
      f.warn = f.t < 1;
      if (f.t <= 0) { fire(f, g); f.t = g.every; f.warn = false; }
      return;
    }
    f.warn = false; if (f.t >= 0 && !see) f.t = Math.max(f.t, 0.5);
    f.face = sgn(dx) || f.face; f.vx += Math.max(-f.v * 4 * dt, Math.min(f.v * 4 * dt, f.face * f.v - f.vx));
    if (body(f, dt) && f.ground) f.vy = HOP;
  }
  function fire(f, g) {
    var a = Math.atan2(f.aim.y - (f.y - 6), f.aim.x - f.x), k;
    if (f.d.gun === 'shotgun') { for (k = -1; k <= 1; k++) shoot({ k: 'pellet', x: f.x, y: f.y - 6, vx: Math.cos(a + k * 0.15) * g.v, vy: Math.sin(a + k * 0.15) * g.v, life: 1 }); }
    else shoot({ k: f.d.gun === 'rocket' ? 'rocket' : 'bullet', x: f.x + f.face * 10, y: f.y - 6, vx: Math.cos(a) * g.v, vy: Math.sin(a) * g.v, life: 2, boom: f.d.gun === 'rocket' ? 32 : 0 });
  }
  /* Terraria Caster AI: a floor tile with 3x4 clear air above and a dungeon wall behind, inside 41x41 tiles round you
     (where you will be in 0.33 s) and more than 5 tiles away; prefer one on screen */
  function spot(f) {
    var h = hero(), cx = Math.floor((h.x + h.vx * 0.33) / T), cy = Math.floor((h.y + h.vy * 0.33) / T), i, x, y, a, b, ok, v = P.view(), c = P.cam();
    for (i = 0; i < 80; i++) {
      x = cx - 20 + ((rnd() * 41) | 0); y = cy - 20 + ((rnd() * 41) | 0);
      if (Math.abs(x - cx) <= 5 && Math.abs(y - cy) <= 5) continue;
      if (!P.solid(x, y) || P.solid(x, y - 1)) continue;
      ok = P.cell(x, y - 1) !== ' ';
      for (a = -1; a <= 1 && ok; a++) for (b = 1; b <= 4 && ok; b++) if (P.solid(x + a, y - b)) ok = false;
      if (ok && i < 60 && ((x * T < c.x || x * T > c.x + v.w || y * T < c.y || y * T > c.y + v.h))) continue;
      if (ok) return { x: (x + 0.5) * T, y: y * T - f.h / 2, t: 0.5 };
    }
    return null;
  }
  function caster(f, dt) {
    var sp = SPELL[f.d.spell];
    body(f, dt); f.vx = 0; f.face = sgn(hx() - f.x) || f.face;
    if (f.tp) { f.tp.t -= dt; if (f.tp.t <= 0) { f.x = f.tp.x; f.y = f.tp.y; f.tp = null; f.n = 0; f.t = sp.first; f.mute = false; f.cyc = sp.cycle; } return; }
    f.cyc -= dt;
    if (f.cyc <= 0 || f.n >= sp.per * (f.d.spell === 'souls' ? 3 : 1)) { f.tp = spot(f); if (!f.tp) { f.n = 0; f.cyc = sp.cycle; } return; }
    if (f.mute || !onScreen(f.x, f.y, 0)) return;
    f.t -= dt;
    if (f.d.spell === 'beam') {
      if (f.t < 0.5 && !f.path) f.path = beamPath(f.x, f.y - 8, Math.atan2(hy() - f.y + 8, hx() - f.x) + (rnd() - 0.5) * 0.1);
      if (f.t <= 0) { shoot({ k: 'beam', x: f.x, y: f.y, vx: 0, vy: 0, life: 0.15, path: f.path, hit: 1 }); f.path = null; f.n++; f.t = sp.next; }
    } else if (f.d.spell === 'souls') {
      if (f.t <= 0) { var o = aimAt(f, 120); shoot({ k: 'soul', x: f.x, y: f.y - 10, vx: o.vx, vy: o.vy, life: 2.5, home: 1, ghost: 1 }); f.n++; f.t = f.n % 3 ? 0.33 : sp.next; }
    } else {
      if (!f.mark) f.mark = { x: hx(), y: hy(), t: f.t };
      if (f.t <= 0) { shoot({ k: 'bolt', x: f.x, y: f.y - 10, tx: f.mark.x, ty: f.mark.y, vx: 0, vy: 0, life: 3, ghost: 1 }); f.mark = null; f.n++; f.t = sp.next; }
    }
  }
  /* Necromancer shadow beam: an instant ray that bounces off walls, 112.5 tiles long */
  function beamPath(x, y, a) {
    var pts = [x, y], vx = Math.cos(a) * 4, vy = Math.sin(a) * 4, n, len = 1800, b = 0;
    for (n = 0; n < len / 4 && b < 4; n++) {
      if (solidAt(x + vx, y)) { vx = -vx; pts.push(x, y); b++; }
      if (solidAt(x, y + vy)) { vy = -vy; pts.push(x, y); b++; }
      x += vx; y += vy;
    }
    pts.push(x, y); return pts;
  }
  /* Cursed Skull: drifts at you through walls on a wobble; every 4 s it stops, glows, and lunges */
  function skull(f, dt) {
    var a = Math.atan2(hy() - f.y, hx() - f.x), w;
    f.t += dt; f.face = sgn(hx() - f.x) || f.face;
    if (f.st === 0) {
      w = Math.sin(f.t * 4) * 30;
      f.vx = Math.cos(a) * f.v - Math.sin(a) * w; f.vy = Math.sin(a) * f.v + Math.cos(a) * w;
      if (f.t > 4) { f.st = 1; f.t = 0; }
      if (f.d.flame && (f.cd -= dt) <= 0) { f.cd = 2; if ((!solidAt(f.x, f.y) || f.angry) && onScreen(f.x, f.y, 0)) f.glow = 0.4; }
    } else if (f.st === 1) { f.vx *= 0.9; f.vy *= 0.9; if (f.t > 0.4) { f.st = 2; f.t = 0; f.lx = Math.cos(a) * 240; f.ly = Math.sin(a) * 240; } }
    else { f.vx = f.lx; f.vy = f.ly; if (f.t > 0.6) { f.st = 0; f.t = 0; } }
    if (f.glow > 0 && (f.glow -= dt) <= 0) { var o = aimAt(f, 360); shoot({ k: 'flame', x: f.x, y: f.y, vx: o.vx, vy: o.vy, life: 3, ghost: 1 }); }
    f.x += f.vx * dt; f.y += f.vy * dt;
  }
  /* DungeonSpiritAI (CalamityRegularEnemyAI.cs): velocity = (velocity*100 + toward*speed) / 101 per tick */
  function spirit(f, dt) {
    var dx = hx() - f.x, dy = hy() - f.y, d = Math.sqrt(dx * dx + dy * dy) || 1, k = 1 - Math.pow(100 / 101, dt * 60);
    f.vx += (dx / d * f.v - f.vx) * k; f.vy += (dy / d * f.v - f.vy) * k; f.x += f.vx * dt; f.y += f.vy * dt; f.face = sgn(f.vx) || f.face;
    if (f.shoots && (f.t += dt) >= 2.5 && onScreen(f.x, f.y, 0)) { f.t = 0; var o = aimAt(f, 600); shoot({ k: 'ghost', x: f.x, y: f.y, vx: o.vx, vy: o.vy, life: 2, ghost: 1 }); }
  }
  /* Renegade Warlock: a fighter (Chaos Elemental AIType) that blinks next to you when it cannot reach you */
  function warlock(f, dt) {
    var h = hero(), c, i, x, y;
    if (f.tp) { f.tp.t -= dt; if (f.tp.t <= 0) { f.x = f.tp.x; f.y = f.tp.y; f.tp = null; f.lost = 0; } return; }
    fighter(f, dt);
    f.lost = (Math.abs(hy() - f.y) > 4 * T || f.stall > 1.2) ? (f.lost || 0) + dt : 0;
    if (f.lost > 1.5) {
      c = Math.floor(h.x / T); y = Math.floor(h.y / T);
      for (i = 0; i < 20 && !f.tp; i++) { x = c + (rnd() < 0.5 ? -1 : 1) * (3 + ((rnd() * 4) | 0)); if (P.solid(x, y) && !P.solid(x, y - 1) && !P.solid(x, y - 2) && !P.solid(x, y - 3)) f.tp = { x: (x + 0.5) * T, y: y * T - f.h / 2, t: 0.5 }; else if (!P.solid(x, y) && P.solid(x, y + 1) && !P.solid(x, y - 1) && !P.solid(x, y - 2)) f.tp = { x: (x + 0.5) * T, y: (y + 1) * T - f.h / 2, t: 0.5 }; }
      f.lost = 0;
    }
  }
  function ball(f, dt) { f.t += dt; var a = Math.sin(f.t * Math.PI * 2 / 2.4) * 0.6; f.x = f.px + Math.sin(a) * f.len; f.y = f.py + Math.cos(a) * f.len; }
  /* Blazing Wheel: crawls round block edges, keeping the wall on its right */
  function wheel(f, dt) {
    var tries, nx, ny, r, d = null;
    f.pr += f.v * dt / T;
    while (f.pr >= 1) {
      f.pr -= 1; f.cx += f.dx; f.cy += f.dy;
      for (tries = 0; tries < 4; tries++) {
        r = tries === 0 ? [-f.dy, f.dx] : tries === 1 ? [f.dx, f.dy] : tries === 2 ? [f.dy, -f.dx] : [-f.dx, -f.dy];
        nx = f.cx + r[0]; ny = f.cy + r[1];
        if (!P.solid(nx, ny)) { d = r; break; }
      }
      if (d) { f.dx = d[0]; f.dy = d[1]; }
    }
    f.x = (f.cx + 0.5 + f.dx * f.pr) * T; f.y = (f.cy + 0.5 + f.dy * f.pr) * T;
  }
  var AI = { fighter: fighter, ranged: ranged, caster: caster, skull: skull, spirit: spirit, warlock: warlock, ball: ball, wheel: wheel };

  /* ── hits ──────────────────────────────────────────────────────────── */
  function pop(x, y, text) { pops.push({ x: x, y: y, t: 0.8, s: text }); }
  function hitFoe(f, n, dir) {
    var sp;
    if (!f || f.dead) return;
    if (!f.d.hp) { if (!f.said || f.said < 0) pop(f.x, f.y - 20, 'INVULNERABLE'); f.said = 0.6; return; }
    f.hp -= n; f.flash = 0.12;
    if (!f.d.stiff && f.d.ai !== 'spirit' && f.d.ai !== 'skull') { f.vx = dir * 180; f.vy = -120; }
    if (f.d.ai === 'ranged') f.t = GUN[f.d.gun].hit;
    if (f.d.ai === 'caster') { sp = SPELL[f.d.spell]; if (rnd() < sp.hitTp) f.tp = spot(f); else if (f.d.spell === 'souls') { f.mute = true; f.cyc = Math.min(f.cyc, 2.33); } }
    if (f.d.flame) f.angry = true;
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small');
    if (f.hp <= 0) die(f);
  }
  function die(f) {
    var n;
    f.dead = true; if (f.sp) f.sp.cd = 20;
    if (NEU.juice && NEU.juice.burst) NEU.juice.burst(f.x, f.y, 10, '#E8DCC8', 120);
    fxs.push({ x: f.x, y: f.y, t: 0.45, d: 0.45, k: f.d.hammer ? 'fxHolySmite' : 'fxGigHitY' });
    if (NEU.save && NEU.save.addCoins && !P.replaying()) NEU.save.addCoins(1 + ((rnd() * 2) | 0));
    if (f.d.big && rnd() < 1 / 6) spawn('s', f.x / T - 0.5, f.y / T - 0.5);
    if (f.d.phantom && NEU.save && NEU.save.flag) {
      n = (NEU.save.flag('dgn_phantoms') | 0) + 1; NEU.save.flag('dgn_phantoms', n);
      if ((n === 10 || n === 20) && NEU.talk) NEU.talk([PHANTOM[n / 10 - 1]], 'narr');
    }
  }
  /* the axe: a front arc 28 px out, or under the feet on a down-swing; it breaks pots and hits foes */
  function axe(h, down) {
    var x0 = down ? h.x - 14 : h.face > 0 ? h.x : h.x - 30, x1 = down ? h.x + 14 : h.face > 0 ? h.x + 30 : h.x, y0 = down ? h.y - 4 : h.y - 30, y1 = down ? h.y + 18 : h.y + 2, i, f, e, L = P.level0();
    for (i = 0; i < foes.length; i++) {
      f = foes[i];
      if (!f.dead && f.x + f.w / 2 > x0 && f.x - f.w / 2 < x1 && f.y + f.h / 2 > y0 && f.y - f.h / 2 < y1) hitFoe(f, 1, h.face);
    }
    for (i = 0; i < L.entities.length; i++) {
      e = L.entities[i];
      if (e.t === 'pot' && !e.dead && (e.x + 2) * T > x0 && e.x * T < x1 && (e.y + 1) * T > y0 && (e.y - 1) * T < y1) {
        e.dead = true;
        if (NEU.juice && NEU.juice.burst) NEU.juice.burst((e.x + 1) * T, e.y * T, 8, '#8A9AB8', 90);
        if (NEU.save && NEU.save.addCoins && !P.replaying()) NEU.save.addCoins(1 + ((rnd() * 2) | 0));
      }
    }
  }

  /* ── the level hooks ──────────────────────────────────────────────── */
  function active(f) { var v = P.view(); return Math.abs(f.x - hx()) < v.w * 1.5 && Math.abs(f.y - hy()) < v.h * 1.5; }
  function onScreen(x, y, m) { var v = P.view(), c = P.cam(); return x > c.x - m && x < c.x + v.w + m && y > c.y - m && y < c.y + v.h + m; }
  function tick(dt) {
    var i, f, s, sp, sps = def.spawners, h = hero(), dx, dy, d;
    F.x = h.x; F.y = h.y - P.hh / 2; F.fx = h.face; F.fy = 0;
    if (kit) { kit.hp = h.hp; kit.tick(dt); }
    if (P.replaying()) return;
    for (i = 0; i < foes.length; i++) {
      f = foes[i]; if (f.dead || !active(f)) continue;
      if (f.flash > 0) f.flash -= dt; if (f.said > 0) f.said -= dt;
      AI[f.d.ai](f, dt);
      if (!f.dead && touchHero(f)) hurtHero(1, sgn(h.x - f.x));
    }
    for (i = shots.length - 1; i >= 0; i--) {
      s = shots[i]; s.age += dt;
      if (s.k === 'hammer' && s.age > s.back) { dx = s.home.x - s.x; dy = s.home.y - s.y; d = Math.sqrt(dx * dx + dy * dy) || 1; s.vx = dx / d * 360; s.vy = dy / d * 360; if (d < 12 || s.home.dead) s.age = s.life; }
      if (s.k === 'soul' && Math.abs(hx() - s.x) + Math.abs(hy() - s.y) < 200) { dx = hx() - s.x; dy = hy() - s.y; d = Math.sqrt(dx * dx + dy * dy) || 1; s.vx += (dx / d * Math.min(160, d * 2) - s.vx) * 0.05; s.vy += (dy / d * Math.min(160, d * 2) - s.vy) * 0.05; }
      if (s.k === 'bolt') { dx = s.tx - s.x; dy = s.ty - s.y; d = Math.sqrt(dx * dx + dy * dy); if (d < 12) { s.k = 'fire'; s.age = 0; s.life = 2; s.r = 28; s.vx = s.vy = 0; } else { s.vx = dx / d * 700; s.vy = dy / d * 700; } }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.age >= s.life) { shots.splice(i, 1); continue; }
      if (!s.ghost && s.k !== 'beam' && s.k !== 'fire' && s.k !== 'boom' && solidAt(s.x, s.y)) { if (s.boom) explode(s); shots.splice(i, 1); continue; }
      if (s.k === 'beam') { if (s.hit && onBeam(s.path)) hurtHero(1, 0); s.hit = 0; continue; }
      if (kit) kit.graze(s);
      if (Math.abs(hx() - s.x) < P.hw + s.r && Math.abs(hy() - s.y) < P.hh / 2 + s.r) {
        if (s.boom) explode(s); else hurtHero(1, sgn(s.vx));
        if (s.k === 'hammer' && !s.smit) { s.smit = 1; fxs.push({ x: s.x, y: s.y, t: 0.4, d: 0.4, k: 'fxHolySmite' }); }
        if (s.k !== 'fire' && s.k !== 'boom' && s.k !== 'hammer') shots.splice(i, 1);
      }
    }
    for (i = pops.length - 1; i >= 0; i--) if ((pops[i].t -= dt) <= 0) pops.splice(i, 1);
    for (i = fxs.length - 1; i >= 0; i--) if ((fxs[i].t -= dt) <= 0) fxs.splice(i, 1);
    /* Terraria-style respawn: a spawner refills off screen and far away after 20 s; a fighter is Bone Lee 1 in 30 */
    for (i = 0; i < sps.length; i++) {
      sp = sps[i]; if (sp.foe && !sp.foe.dead) continue;
      if (sp.cd > 0) { sp.cd -= dt; continue; }
      if (onScreen((sp.x + 0.5) * T, (sp.y + 0.5) * T, 48) || Math.abs((sp.x + 0.5) * T - h.x) < 24 * T) continue;
      sp.foe = spawn('ath'.indexOf(sp.k) >= 0 && rnd() < 1 / 30 ? 'j' : sp.k, sp.x, sp.y, sp);
    }
    for (i = foes.length - 1; i >= 0; i--) if (foes[i].dead) foes.splice(i, 1);
  }
  function explode(s) { if (s.k === 'boom') return; s.k = 'boom'; s.age = 0; s.life = 0.3; s.r = s.boom; s.vx = s.vy = 0; shots.push(s); if (Math.abs(hx() - s.x) < s.boom + P.hw && Math.abs(hy() - s.y) < s.boom + P.hh / 2) hurtHero(1, sgn(hx() - s.x)); }
  function onBeam(p) {
    var i, ax, ay, bx, by, t, qx, qy, L;
    for (i = 0; i + 3 < p.length; i += 2) {
      ax = p[i]; ay = p[i + 1]; bx = p[i + 2]; by = p[i + 3]; L = (bx - ax) * (bx - ax) + (by - ay) * (by - ay) || 1;
      t = Math.max(0, Math.min(1, ((hx() - ax) * (bx - ax) + (hy() - ay) * (by - ay)) / L)); qx = ax + (bx - ax) * t; qy = ay + (by - ay) * t;
      if (Math.abs(hx() - qx) < P.hw + 2 && Math.abs(hy() - qy) < P.hh / 2 + 2) return true;
    }
    return false;
  }
  function open() {
    var i, sps = def.spawners;
    foes.length = 0; shots.length = 0; pops.length = 0; fxs.length = 0;
    kit = NEU.kit ? NEU.kit.create({ F: F, box: box, noMelee: true, adapter: {
      targets: function () { var out = [], i; for (i = 0; i < foes.length; i++) if (!foes[i].dead && foes[i].d.hp && onScreen(foes[i].x, foes[i].y, 0)) out.push(foes[i]); return out; },
      damage: function (t, n, kind) { if (kind !== 'melee') hitFoe(t, 1, sgn(t.x - F.x)); },
      hurtPlayer: function (n) { P.hurt(n, lastDir); }
    } }) : null;
    if (P.replaying()) return;
    for (i = 0; i < sps.length; i++) { sps[i].cd = 0; sps[i].foe = spawn(sps[i].k, sps[i].x, sps[i].y, sps[i]); }
  }

  /* ── drawing: bodies under the light map, telegraphs and shots above it ── */
  /* Terraria NPC textures face left. Keep state-specific frame windows
     inside each sheet and drive walk cycles by distance, not wall clock. */
  function frameOf(f, sh, now) {
    var n = Math.max(1, sh.frames | 0), d = f.d;
    var t = Math.floor((now === undefined ? Date.now() : now) / 160);
    var walk = Math.floor((f.walked || 0) / 10), moving = Math.abs(f.vx || 0) > 8, a, idx;
    if (d.ai === 'fighter' || d.ai === 'warlock') {
      if (!f.ground) idx = Math.min(1, n - 1);
      else if (moving) idx = 2 + walk % Math.max(1, Math.min(n - 2, 6));
      else idx = 0;
    } else if (d.ai === 'ranged') {
      if (f.warn || (f.t >= 0 && !moving)) {
        a = Math.atan2((f.aim ? f.aim.y : f.y) - f.y, Math.abs((f.aim ? f.aim.x : f.x) - f.x) || 1);
        idx = Math.max(0, Math.min(4, Math.round(2 + a / 0.6)));
      } else idx = moving ? 5 + walk % Math.max(1, Math.min(n - 5, 6)) : 0;
    } else if (d.ai === 'caster') idx = f.t < 0.5 ? (f.t < 0.15 ? 2 : 1) : 0;
    else if (d.ai === 'skull') idx = n > 3 ? (f.glow > 0 ? 3 + t % 3 : t % 3) : f.st ? 2 : 0;
    else idx = t % n;
    return Math.max(0, Math.min(n - 1, idx));
  }
    function draw(c, cx, cy) {
    var i, f, sh, k, L = NEU.dungeonLook;
    for (i = 0; i < foes.length; i++) {
      f = foes[i]; if (f.dead || !onScreen(f.x, f.y, 64)) continue;
      sh = sheet(f.s); if (!sh) continue;
      if (f.d.ai === 'ball') for (k = 0; k < f.len; k += 12) L.cut(c, 'dgLink', 0, 0, 12, 12, f.px + (f.x - f.px) * k / f.len - 6 - cx, f.py + (f.y - f.py) * k / f.len - 6 - cy);
      if (f.tp && ((Date.now() / 150) | 0) & 1) c.globalAlpha = 0.5;
       /* Floating bodies use centre pivots; grounded bodies use their feet.
          Turning changes the sprite, never its collision box. */
       var floating = f.d.ai === 'skull' || f.d.ai === 'spirit' || f.d.ai === 'ball' || f.d.ai === 'wheel';
       var sy = floating ? f.y - sh.fh / 2 - cy : f.y + f.h / 2 - sh.fh - cy + 2;
       L.cut(c, f.s, 0, frameOf(f, sh) * sh.fh, sh.fw, sh.fh,
             Math.round(f.x - sh.fw / 2 - cx), Math.round(sy), f.face > 0);
      c.globalAlpha = 1;
      if (f.flash > 0) { c.globalAlpha = 0.5; P.fr(c, (f.x - f.w / 2 - cx) | 0, (f.y - f.h / 2 - cy) | 0, f.w, f.h, '#FFFFFF'); c.globalAlpha = 1; }
    }
  }
  function line(c, x0, y0, x1, y1, col, step) {
    var d = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)), n = Math.max(1, Math.floor(d / (step || 4))), i;
    c.fillStyle = col;
    for (i = 0; i <= n; i++) c.fillRect((x0 + (x1 - x0) * i / n) | 0, (y0 + (y1 - y0) * i / n) | 0, 2, 2);
  }
  function ring(c, x, y, r, col) { var k; c.fillStyle = col; for (k = 0; k < 16; k++) c.fillRect((x + Math.cos(k * 0.3927) * r) | 0, (y + Math.sin(k * 0.3927) * r) | 0, 2, 2); }
  function hud(c, cx, cy) {
    var i, f, s, v = P.view(), k, p, still = P.reduced();
    box.AX = cx; box.AY = cy; box.AW = v.w; box.AH = v.h;
    c.save(); c.translate(-cx, -cy);
    for (i = 0; i < foes.length; i++) {
      f = foes[i]; if (f.dead) continue;
      if (f.d.ai === 'ranged' && f.aim && f.t >= 0 && f.t < 1.67) line(c, f.x + f.face * 10, f.y - 6, f.aim.x, f.aim.y, f.t < 0.25 ? '#FF4040' : 'rgba(255,64,64,0.45)', f.t < 0.25 ? 3 : 6);
      if (f.st === 1 && f.aim && f.d.hammer) line(c, f.x, f.y - 8, f.aim.x, f.aim.y, 'rgba(255,224,128,0.6)', 8);
      if (f.path) for (p = 0; p + 3 < f.path.length; p += 2) line(c, f.path[p], f.path[p + 1], f.path[p + 2], f.path[p + 3], 'rgba(176,96,255,0.5)', 6);
      if (f.mark) ring(c, f.mark.x, f.mark.y, 28, f.t < 0.5 ? '#FF6A3A' : 'rgba(255,106,58,0.5)');
      if (f.tp) { ring(c, f.tp.x, f.tp.y, 6 + (still ? 0 : (f.tp.t * 20) | 0), '#E8D8FF'); P.fr(c, f.tp.x - 1, f.tp.y - 1, 2, 2, '#FFFFFF'); }
      if (f.glow > 0 || f.st === 1 && f.d.ai === 'skull') ring(c, f.x, f.y, f.r + 4, '#FF4040');
      if (f.d.ai === 'caster' && f.d.spell === 'souls' && f.t < 0.5 && !f.tp && !f.mute) P.fr(c, (f.x + f.face * 10 - 2) | 0, (f.y - 12) | 0, 4, 4, '#9AF0FF');
    }
    for (i = 0; i < shots.length; i++) {
      s = shots[i];
      if (s.k === 'beam') { for (p = 0; p + 3 < s.path.length; p += 2) line(c, s.path[p], s.path[p + 1], s.path[p + 2], s.path[p + 3], '#D8A0FF', 2); continue; }
      if (s.k === 'fire' || s.k === 'boom') {
        P.glow(c, s.x, s.y, s.r * 1.5, '#FF6A3A', 0.3); ring(c, s.x, s.y, s.r, '#FFB050'); ring(c, s.x, s.y, s.r * 0.6, '#FFE0A0');
        var bim = fxIm(s.k === 'fire' ? 'dgFxFire' : 'dgFxBoom');
        if (bim) {
          if (s.k === 'fire') { var f = (s.age * 6) | 0, fs = 32; c.drawImage(bim, (f % 4) * fs, 0, fs, fs, (s.x - fs / 2) | 0, (s.y - fs / 2) | 0, fs, fs); }
          else { var bs = Math.max(48, Math.min(160, (s.r * 1.4) | 0)); c.drawImage(bim, 0, 0, 48, 48, (s.x - bs / 2) | 0, (s.y - bs / 2) | 0, bs, bs); }
        }
        continue;
      }
      if (s.k === 'hammer') {
        /* the mace turns with its flight — same rule fxShot applies to
           the other projectiles */
        var him = fxIm('dgHammer');
        if (him) {
          c.save(); c.translate(s.x | 0, s.y | 0);
          c.rotate((s.age || 0) * 12); c.imageSmoothingEnabled = false;
          c.drawImage(him, -19, -19, 38, 38);
          c.restore();
        } else NEU.dungeonLook.cut(c, 'dgHammer', 0, 0, 38, 38, s.x - 19, s.y - 19);
        continue;
      }
      k = { bullet: '#FFE8A0', pellet: '#FFD070', rocket: '#FF8A3A', soul: '#9AF0FF', flame: '#E8E8FF', ghost: '#7FE3C4', bolt: '#FF6A3A' }[s.k] || '#FFFFFF';
      P.glow(c, s.x, s.y, 12, k, 0.25);
      if (!fxShot(c, s, FXS[s.k])) P.fr(c, (s.x - s.r / 2) | 0, (s.y - s.r / 2) | 0, Math.max(2, s.r), Math.max(2, s.r), k);
    }
    for (i = 0; i < fxs.length; i++) if (NEU.fxBurst) NEU.fxBurst(c, fxs[i].k, fxs[i].x, fxs[i].y, 1 - fxs[i].t / fxs[i].d, 1.4);
    c.font = '16px "Determination Mono","Pixelify Sans",monospace'; c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (i = 0; i < pops.length; i++) { c.fillStyle = '#12081E'; c.fillText(pops[i].s, (pops[i].x + 1) | 0, (pops[i].y + 1) | 0); c.fillStyle = '#FFE8A0'; c.fillText(pops[i].s, pops[i].x | 0, pops[i].y | 0); }
    c.textAlign = 'left';
    if (kit) kit.draw(c);
    c.restore();
  }
  function key(k, down) {
    var lk = String(k).toLowerCase(), h = hero();
    if (!kit) return false;
    if (down && kit.stripOpen) { kit.hp = h.hp; kit.keydown(k); h.hp = Math.max(h.hp, kit.hp); return true; }
    if (down && lk === 'c') { kit.keydown('c'); return true; }
    if (lk === 'z') { if (down) kit.keydown('z'); else kit.keyup('z'); }
    return false;
  }
  function lights(list) {
    var h = hero(), i;
    list.push(h.x / T, (h.y - 11) / T, 0.8);
    if (kit) for (i = 0; i < kit.shots.length; i++) list.push(kit.shots[i].x / T, kit.shots[i].y / T, 0.75);
    for (i = 0; i < shots.length; i++) if (shots[i].k !== 'beam') list.push(shots[i].x / T, shots[i].y / T, shots[i].k === 'fire' || shots[i].k === 'boom' ? 1 : 0.5);
  }
  function chain(name, fn) { var prev = def[name]; def[name] = prev ? function (a, b, c2, d) { prev(a, b, c2, d); return fn(a, b, c2, d); } : fn; }
  chain('onOpen', open); chain('tick', tick);
  def.draw = draw; def.hud = hud; def.key = key; def.lights = lights; def.swing = axe;
  def.slow = function () { return kit ? kit.slow : 1; };
  def.tp = function () { return kit ? kit.tp : 0; };
  def.onClose = function () { shots.length = 0; };
  NEU.dgnFoes = { kinds: KIND, foes: foes, shots: shots, pops: pops, spawn: spawn, hit: hitFoe, axe: axe, kit: function () { return kit; },
    gun: GUN, spell: SPELL, moods: MOODS, beamPath: beamPath, spot: spot, frameOf: frameOf };
})();
