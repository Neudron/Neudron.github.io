(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var TILE = 16, STEP = 1 / 60, MAX_STEPS = 8, HW = 8, HH = 22, DEATH = 0.6, WIPE = 0.25;
  /* Celeste Player.cs x2 (Celeste tiles are 8 px, ours 16): numbers only, from .opencode/research/celeste-plat.md
     (Player.cs L5880-6205) and the plan's CrumblePlatform / Spikes / Spring / Input numbers. */
  var C = { maxFall: 320, grav: 1800, halfGrav: 80, fastFall: 480, fastAccel: 600, run: 180, runAccel: 2000, runReduce: 800,
    air: 0.65, coyote: 0.1, jump: -210, jumpH: 80, varJump: 0.2, upCorner: 8, dashUpCorner: 10, wallCheck: 6, superWallCheck: 10,
    wallForce: 0.16, wallH: 260, slideStart: 40, slideTime: 1.2, superH: 520, superWallV: -320, superWallH: 340, superWallVar: 0.25,
    dash: 480, endDash: 320, endUp: 0.75, dashTime: 0.15, dashCd: 0.2, refillCd: 0.1, dashCorner: 8, dashAttack: 0.3, jtNudge: 12,
    stamina: 110, climbUp: 45.45, climbStill: 10, climbJump: 27.5, climbUpV: -90, climbDownV: 160, climbSlip: 60, climbAccel: 1800,
    grabY: 0.2, hopY: -240, hopX: 200, hopForce: 0.2, boostTime: 0.2, climbNoMove: 0.1, buffer: 0.08, spring: -370, springVar: 0.2,
    duckX: 1.25, duckY: 0.5, slideMult: 1.2, pogo: -280, swing: 0.15, hurtInv: 0.67, kbX: 270, kbY: -210, dashI: 0.25 };
  var levels = {}, kinds = {}, current = null, live = false, paused = false, replaying = false;
  var canvas = document.getElementById('platCanvas'), overlay = document.getElementById('plat');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var keys = {}, accumulator = 0, simClock = 0, camera = { x: 0, y: 0 }, baked = null, afterimages = [], bakeCache = {};
  var reduced = redNow(), view = { w: 640, h: 360, scale: 1 }, area = { x0: 0, y0: 0, x1: 640, y1: 360 };
  var painters = [], padB = {}, sprCache = {}, lastDraw = 0, chunks = {}, chunkOrder = [], CHUNK = 32, LRU = 12;
  function redNow() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  var player = fresh();

  function fresh() {
    return { x: 0, y: 0, vx: 0, vy: 0, face: 1, dashes: 1, onGround: false, st: 0, prev: {},
      stamina: C.stamina, dead: 0, wipe: 0, coyote: 0, jumpBuf: 0, dashBuf: 0, meleeBuf: 0, varJump: 0, varSpeed: 0,
      maxFall: C.maxFall, dashTime: 0, dashCd: 0, refillCd: 0, dashAttack: 0, dashX: 0, dashY: 0, duck: false,
      wallSlide: C.slideTime, slideDir: 0, wallBoost: 0, boostDir: 0, forceX: 0, forceDir: 0, climbNoMove: 0, lastClimb: 0,
      swing: 0, pogo: false, squash: 0, stretch: 0, walked: 0, hp: 0, inv: 0, hopWait: 0 };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sign(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function approach(v, target, delta) { return v < target ? Math.min(target, v + delta) : Math.max(target, v - delta); }
  function grid(text) { return String(text || '').split('\n').filter(function (r) { return r.length; }); }
  function level(id, def) {
    def = def || {};
    def.id = id; def.grid = def.rows || grid(def.tiles); def.h = def.grid.length;
    def.w = def.grid.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    def.entities = (def.entities || []).map(function (e, i) {
      var v = {}, k;
      for (k in e) if (Object.prototype.hasOwnProperty.call(e, k)) v[k] = e[k];
      v.id = v.id || id + ':' + v.t + ':' + v.x + ',' + v.y + ':' + i;
      v.t0 = 0; v.dead = false; v.solid = v.t === 'zip' || v.t === 'crumble';
      return v;
    });
    levels[id] = def; return def;
  }
  function cell(x, y) {
    if (!current || y < 0 || y >= current.h || x < 0 || x >= current.w) return '#';
    if (current.broken && current.broken[x + ',' + y]) return '.';
    return (current.grid[y] || '')[x] || '.';
  }
  function solidCell(c) { return c === '#' || c === 'x' || (!!current.solid && current.solid.indexOf(c) >= 0); }
  function solidPoint(px, py) {
    var tx = Math.floor(px / TILE), ty = Math.floor(py / TILE), i, e;
    if (solidCell(cell(tx, ty))) return true;
    for (i = 0; i < current.solids.length; i++) { e = current.solids[i]; if (!e.dead && px >= e.x * TILE && px < e.x * TILE + TILE && py >= e.y * TILE && py < e.y * TILE + TILE) return true; }
    return false;
  }
  /* the hero box is HW*2 x HH (Celeste 8x11 x2), feet at y; '=' is a jumpthru, solid only to a body that was above it */
  function blocked(x, y, dy, oldBottom) {
    var x0 = Math.floor((x - HW) / TILE), x1 = Math.floor((x + HW - 0.01) / TILE);
    var y0 = Math.floor((y - HH) / TILE), y1 = Math.floor((y - 0.01) / TILE), tx, ty, c, i, e;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) {
      c = cell(tx, ty); if (solidCell(c) || (c === '=' && dy > 0 && oldBottom <= ty * TILE + 0.01)) return true;
    }
    for (i = 0; i < current.solids.length; i++) {
      e = current.solids[i];
      if (!e.dead && x + HW > e.x * TILE && x - HW < e.x * TILE + TILE && y > e.y * TILE && y - HH < e.y * TILE + TILE) return true;
    }
    return false;
  }
  function wallAt(dir, d) { return blocked(player.x + dir * d, player.y, 0, player.y); }
  function moveX(dx) {
    var s = dx > 0 ? 1 : -1, left = Math.abs(dx), st;
    while (left > 0) {
      st = Math.min(1, left);
      if (blocked(player.x + s * st, player.y, 0, player.y)) {
        if (!(player.st === 2 && player.vy === 0 && dashCorner(s))) { player.vx = 0; return true; }
        left -= 1; continue;
      }
      player.x += s * st; left -= st;
    }
    return false;
  }
  /* DashCornerCorrection: a level dash slides round a corner of up to 8 px */
  function dashCorner(s) {
    var i, j;
    for (i = 1; i <= C.dashCorner; i++) for (j = 1; j >= -1; j -= 2)
      if (!blocked(player.x + s, player.y + i * j, 0, player.y)) { player.y += i * j; player.x += s; return true; }
    return false;
  }
  function moveY(dy) {
    var s = dy > 0 ? 1 : -1, left = Math.abs(dy), st, i, n;
    while (left > 0) {
      st = Math.min(1, left);
      if (!blocked(player.x, player.y + s * st, s, player.y)) { player.y += s * st; left -= st; continue; }
      if (s < 0) {
        /* UpwardCornerCorrection: a head bump within 8 px of an edge (10 dashing) slides past it */
        n = player.st === 2 ? C.dashUpCorner : C.upCorner;
        for (i = 1; i <= n; i++) {
          if (player.vx <= 0.01 && !blocked(player.x - i, player.y - 1, -1, player.y)) { player.x -= i; break; }
          if (player.vx >= -0.01 && !blocked(player.x + i, player.y - 1, -1, player.y)) { player.x += i; break; }
        }
        if (i <= n) continue;
        player.varJump = 0;
      } else if (player.st === 2 && player.dashX && player.dashY > 0) {
        /* a down-diagonal dash into the floor turns level and ducks: the jump out of it is a hyper (wavedash) */
        player.dashX = sign(player.dashX); player.dashY = 0; player.vx *= C.slideMult; player.duck = true;
      }
      player.vy = 0; return true;
    }
    return false;
  }
  function refill() { player.dashes = 1; }
  function die() {
    if (player.dead > 0) return;
    player.dead = current && current.quickRespawn ? 0.18 : DEATH; player.vx = 0; player.vy = 0; player.st = 0;
    if (NEU.juice && NEU.juice.hit && !replaying) NEU.juice.hit('medium');
    if (NEU.sfx && NEU.sfx.hit && !replaying) NEU.sfx.hit(1);
  }
  /* kit HP: a level that sets hp counts hits; one without it dies on the first (the mountain) */
  function hurt(n, dir) {
    if (player.dead > 0 || player.inv > 0) return false;
    if (NEU.cheat && NEU.cheat.god) return false;
    if (!current || !current.hp) { die(); return true; }
    player.hp = Math.max(0, player.hp - (n || 1)); player.inv = C.hurtInv;
    player.vx = (dir || -player.face) * C.kbX; player.vy = C.kbY; player.st = 0; player.varJump = 0;
    if (NEU.juice && NEU.juice.hit && !replaying) { NEU.juice.hit('medium', { colour: '#FF5577', dx: player.vx, dy: player.vy }); if (NEU.juice.burst) NEU.juice.burst(player.x, player.y - HH / 2, 10, '#FF5577', 140); }
    if (NEU.sfx && NEU.sfx.hit && !replaying) NEU.sfx.hit(0.8);
    if (player.hp <= 0) die();
    return true;
  }
  function parseInput(input) {
    var out = {}, k, parts, i;
    if (typeof input === 'string') {
      parts = input.toLowerCase().split(/[ ,+]+/);
      for (i = 0; i < parts.length; i++) out[parts[i]] = true;
      out.left = out.left || out.a; out.right = out.right || out.d;
      out.up = out.up || out.w; out.down = out.down || out.s;
      out.jump = out.jump || out.space; out.grab = out.grab || out.shift;
    } else if (input) for (k in input) if (Object.prototype.hasOwnProperty.call(input, k)) out[k.toLowerCase()] = !!input[k];
    return out;
  }
  /* Spikes.cs: the hitbox is the 6 px band at the base, and it only hits a body moving into the points.
     Damage goes through hurt(): 1 hp, knockback away from the tile, hurtInv i-frames — never a free instakill. */
  function spikes() {
    var x0 = Math.floor((player.x - HW) / TILE), x1 = Math.floor((player.x + HW - 0.01) / TILE);
    var y0 = Math.floor((player.y - HH) / TILE), y1 = Math.floor((player.y - 0.01) / TILE), tx, ty, ch, bx, by, off;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) {
      ch = cell(tx, ty); bx = tx * TILE; by = ty * TILE;
      if ((ch === '^' && player.vy >= 0 && player.y > by + 10) || (ch === 'v' && player.vy <= 0 && player.y - HH < by + 6) ||
        (ch === '<' && player.vx >= 0 && player.x + HW > bx + 10) || (ch === '>' && player.vx <= 0 && player.x - HW < bx + 6)) {
        off = player.x - (bx + TILE / 2);
        return hurt(1, off ? sign(off) : -player.face);
      }
    }
    return false;
  }
  /* down + melee: the axe strikes 12 px under the feet and bounces off spikes and pogo orbs */
  function pogo() {
    var ty = Math.floor((player.y + 12) / TILE), tx0 = Math.floor((player.x - HW) / TILE), tx1 = Math.floor((player.x + HW - 0.01) / TILE), tx;
    for (tx = tx0; tx <= tx1; tx++) if (cell(tx, ty) === '^' || cell(tx, Math.floor(player.y / TILE)) === '^') { bounce(); return true; }
    return false;
  }
  function bounce() { player.vy = C.pogo; player.varJump = 0; player.pogo = true; player.st = 0; refill(); player.swing = 0; }
  function touchEntities(input, melee) {
    var i, e, ex, ey, dx, dy, kind;
    for (i = 0; i < current.entities.length; i++) {
      e = current.entities[i]; if (e.dead || (e.t === 'refill' && e.t0 > 0)) continue;
      ex = (e.x + 0.5) * TILE; ey = (e.y + 1) * TILE;
      dx = Math.abs(player.x - ex); dy = Math.abs((player.y - HH / 2) - (ey - 8));
      if (dx > 22 || dy > (e.t === 'painting' ? 48 : 24)) continue;
      kind = kinds[e.t]; if (kind && kind.touch) kind.touch(e, input, melee, dx, dy);
    }
  }
  function jump(mx) {
    player.jumpBuf = 0; player.coyote = 0; player.varJump = C.varJump; player.wallSlide = C.slideTime; player.wallBoost = 0;
    player.dashAttack = 0; player.vx += C.jumpH * mx; player.vy = C.jump; player.varSpeed = player.vy; player.onGround = false;
    player.stretch = 0.12; player.st = 0;
  }
  function wallJump(dir, mx) {
    jump(0); if (mx) { player.forceDir = dir; player.forceX = C.wallForce; }
    player.vx = C.wallH * dir; player.face = dir;
  }
  function climbJump(mx) {
    if (!player.onGround) player.stamina -= C.climbJump;
    jump(mx); if (!mx) { player.boostDir = -player.face; player.wallBoost = C.boostTime; }
  }
  function superWallJump(dir) {
    jump(0); player.vx = C.superWallH * dir; player.vy = C.superWallV; player.varJump = C.superWallVar; player.varSpeed = player.vy; player.face = dir;
  }
  function superJump() {
    jump(0); player.vx = C.superH * player.face;
    if (player.duck) { player.vx *= C.duckX; player.vy *= C.duckY; player.varSpeed = player.vy; }
    player.duck = false;
  }
  function dashAttacking() { return player.dashAttack > 0; }
  function superWallAngle() { return Math.abs(player.dashX) <= 0.2 && player.dashY <= -0.75; }
  function wallJumpCheck(dir) { return wallAt(dir, dashAttacking() && superWallAngle() ? C.superWallCheck : C.wallCheck); }
  function wallJumps(input, mx) {
    var d;
    for (d = 1; d >= -1; d -= 2) if (wallJumpCheck(d)) {
      if (player.face === d && input.grab && player.stamina > 0) climbJump(mx);
      else if (dashAttacking() && superWallAngle()) superWallJump(-d);
      else wallJump(-d, mx);
      return true;
    }
    return false;
  }
  function canDash() { return player.dashBuf > 0 && player.dashes > 0 && player.dashCd <= 0; }
  function startDash(mx, my) {
    var dx = mx, dy = my, len, sx;
    if (!dx && !dy) dx = player.face;
    player.dashBuf = 0; player.dashes--; player.dashCd = C.dashCd; player.refillCd = C.refillCd; player.dashAttack = C.dashAttack;
    player.inv = Math.max(player.inv, C.dashI); /* dash i-frames: 250 ms, the 150 ms dash plus a 100 ms tail */
    len = Math.sqrt(dx * dx + dy * dy); player.dashX = dx / len; player.dashY = dy / len;
    sx = player.dashX * C.dash;
    if (sign(player.vx) === sign(sx) && Math.abs(player.vx) > Math.abs(sx)) sx = player.vx;
    player.vx = sx; player.vy = player.dashY * C.dash; player.duck = false;
    if (player.onGround && dx && dy > 0) { player.dashX = sign(dx); player.dashY = 0; player.vy = 0; player.vx *= C.slideMult; player.duck = true; }
    if (dx) player.face = sign(dx);
    player.dashTime = C.dashTime; player.st = 2; player.varJump = 0;
  }
  function slipCheck() {
    var px = player.face > 0 ? player.x + HW : player.x - HW - 1, py = player.y - HH + 8;
    return !solidPoint(px, py) && !solidPoint(px, py - 8);
  }
  /* ClimbHop: up and over the ledge; while the wall still blocks the side, the push waits (hopWaitX) */
  function climbHop() {
    if (wallAt(player.face, 1)) player.hopWait = player.face; else player.vx = player.face * C.hopX;
    player.vy = Math.min(player.vy, C.hopY); player.forceDir = 0; player.forceX = C.hopForce; player.st = 0;
  }
  function toClimb() {
    var i;
    player.st = 1; player.vx = 0; player.vy *= C.grabY; player.wallSlide = C.slideTime; player.climbNoMove = C.climbNoMove;
    player.wallBoost = 0; player.lastClimb = 0;
    for (i = 0; i < 4 && !wallAt(player.face, 1); i++) player.x += player.face;
  }
  /* Room-authored wind: no RNG and no force during dash/cutscene frames.
     Cycles are anchored to the room simulation clock, so retry starts on the same gust. */
  function windNow() {
    var w = current && current.wind, period, phase, duty, edge, gain = 1;
    if (!w) return { x: 0, y: 0, active: false };
    period = Number(w.period) || 0;
    if (period > 0) {
      phase = ((((simClock + (Number(w.phase) || 0)) % period) + period) % period) / period;
      duty = clamp(w.duty == null ? 0.7 : Number(w.duty), 0, 1);
      if (phase >= duty || duty <= 0) gain = 0;
      else {
        edge = Math.min(0.12, duty / 3);
        gain = edge ? Math.min(1, phase / edge, (duty - phase) / edge) : 1;
      }
    }
    return { x: (Number(w.x) || 0) * gain, y: (Number(w.y) || 0) * gain, active: gain > 0 };
  }
  function normal(dt, input, mx, my) {
    var mult, max, wind;
    if (player.hopWait) {
      if (sign(player.vx) === -player.hopWait || player.vy > 0) player.hopWait = 0;
      else if (!wallAt(player.hopWait, 1)) { player.vx = player.hopWait * C.hopX; player.hopWait = 0; }
    }
    if (mx) player.face = mx;
    if (input.grab && player.stamina > 0 && player.vy >= 0 && sign(player.vx) !== -player.face && wallAt(player.face, 4)) { toClimb(); return; }
    if (canDash()) { startDash(mx, my); return; }
    mult = player.onGround ? 1 : C.air;
    if (Math.abs(player.vx) > C.run && sign(player.vx) === mx) player.vx = approach(player.vx, C.run * mx, C.runReduce * mult * dt);
    else player.vx = approach(player.vx, C.run * mx, C.runAccel * mult * dt);
    player.maxFall = approach(player.maxFall, my === 1 && player.vy >= C.maxFall ? C.fastFall : C.maxFall, C.fastAccel * dt);
    if (!player.onGround) {
      max = player.maxFall;
      if ((mx === player.face || (!mx && input.grab)) && my !== 1 && player.vy >= 0 && player.wallSlide > 0 && wallAt(player.face, 1)) {
        player.slideDir = player.face; max = C.maxFall + (C.slideStart - C.maxFall) * (player.wallSlide / C.slideTime);
      }
      player.vy = approach(player.vy, max, C.grav * (Math.abs(player.vy) < C.halfGrav && input.jump ? 0.5 : 1) * dt);
    }
    if (player.varJump > 0) { if (input.jump) player.vy = Math.min(player.vy, player.varSpeed); else player.varJump = 0; }
    if (!player.onGround && current.wind) {
      wind = windNow();
      /* Preserve deliberate hyper/dash momentum instead of clamping existing high speed. */
      player.vx += wind.x * dt;
      player.vy = clamp(player.vy + wind.y * dt, -C.fastFall, C.fastFall);
    }
    if (player.jumpBuf > 0) { if (player.coyote > 0) jump(mx); else wallJumps(input, mx); }
  }
  function climb(dt, input, mx, my) {
    var target = 0, slip = false;
    player.climbNoMove -= dt;
    if (player.jumpBuf > 0) { if (mx === -player.face) wallJump(-player.face, mx); else climbJump(mx); return; }
    if (canDash()) { startDash(mx, my); return; }
    if (!input.grab) { player.st = 0; return; }
    if (!wallAt(player.face, 1)) { if (player.vy < 0) climbHop(); player.st = 0; return; }
    if (player.climbNoMove <= 0) {
      if (my === -1) {
        target = C.climbUpV;
        if (blocked(player.x, player.y - 1, -1, player.y)) { if (player.vy < 0) player.vy = 0; target = 0; slip = true; }
        else if (slipCheck()) { climbHop(); return; }
      } else if (my === 1) { target = C.climbDownV; if (player.onGround) { if (player.vy > 0) player.vy = 0; target = 0; } }
      else slip = true;
    } else slip = true;
    player.lastClimb = sign(target);
    if (slip && slipCheck()) target = C.climbSlip;
    player.vy = approach(player.vy, target, C.climbAccel * dt);
    if (my !== 1 && player.vy > 0 && !blocked(player.x + player.face, player.y + 1, 0, player.y)) player.vy = 0;
    if (player.climbNoMove <= 0) player.stamina -= (player.lastClimb === -1 ? C.climbUp : player.lastClimb === 0 ? C.climbStill : 0) * dt;
    if (player.stamina <= 0) player.st = 0;
  }
  function dashing(dt, input, mx) {
    var x0, x1, tx, ty, top;
    if (!reduced && !replaying) { afterimages.push({ x: player.x, y: player.y, t: 0.12 }); while (afterimages.length > 3) afterimages.shift(); }
    if (player.dashY === 0) {
      /* DashHJumpThruNudge: a level dash with feet up to 12 px inside a jumpthru pops on top of it */
      ty = Math.floor((player.y - 0.01) / TILE); top = ty * TILE; x0 = Math.floor((player.x - HW) / TILE); x1 = Math.floor((player.x + HW - 0.01) / TILE);
      for (tx = x0; tx <= x1; tx++) if (cell(tx, ty) === '=' && player.y - top <= C.jtNudge && player.y > top) { player.y = top; break; }
      if (player.jumpBuf > 0 && player.coyote > 0) { superJump(); return; }
    }
    if (player.jumpBuf > 0 && wallJumps(input, mx)) return;
    player.dashTime -= dt;
    if (player.dashTime > 1e-6) return;
    player.dashTime = 0; player.st = 0;
    if (player.dashY <= 0) { player.vx = player.dashX * C.endDash; player.vy = player.dashY * C.endDash; }
    if (player.vy < 0) player.vy *= C.endUp;
  }
  function breakBlocks() {
    var x0 = Math.floor((player.x + player.vx * STEP - HW) / TILE), x1 = Math.floor((player.x + player.vx * STEP + HW) / TILE);
    var y0 = Math.floor((player.y + player.vy * STEP - HH) / TILE), y1 = Math.floor((player.y + player.vy * STEP - 1) / TILE), tx, ty, broke = false;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++)
      if (cell(tx, ty) === 'x') { if (!current.broken) current.broken = {}; current.broken[tx + ',' + ty] = true; broke = true; dropChunk(tx, ty); }
    if (broke && !current.chunked) { delete bakeCache[current.id]; bake(); }
  }
  function step(dt, raw) {
    var input = parseInput(raw), prev = player.prev, mx, my, i, e;
    if (!current || current.exited) return getState();
    dt = clamp(Number(dt) || STEP, 0, 0.1);
    simClock += dt;
    player.prev = input;
    if (player.wipe > 0) player.wipe = Math.max(0, player.wipe - dt);
    if (player.dead > 0) {
      player.dead = Math.max(0, player.dead - dt);
      if (!player.dead) { if (!replaying && current.onDeath && current.onDeath() !== false) return getState(); respawn(); }
      return getState();
    }
    player.jumpBuf = input.jump && !prev.jump ? C.buffer : Math.max(0, player.jumpBuf - dt);
    player.dashBuf = input.dash && !prev.dash ? C.buffer : Math.max(0, player.dashBuf - dt);
    player.meleeBuf = input.melee && !prev.melee ? C.buffer : Math.max(0, player.meleeBuf - dt);
    player.dashCd = Math.max(0, player.dashCd - dt); player.dashAttack = Math.max(0, player.dashAttack - dt);
    player.inv = Math.max(0, player.inv - dt); player.swing = Math.max(0, player.swing - dt);
    if (player.slideDir) { player.wallSlide = Math.max(0, player.wallSlide - dt); player.slideDir = 0; }
    player.onGround = player.vy >= 0 && blocked(player.x, player.y + 1, 1, player.y);
    if (player.onGround) { player.stamina = C.stamina; player.wallSlide = C.slideTime; player.coyote = C.coyote; player.pogo = false; }
    else player.coyote = Math.max(0, player.coyote - dt);
    if (player.refillCd > 0) player.refillCd -= dt; else if (player.onGround) refill();
    if (player.varJump > 0) player.varJump = Math.max(0, player.varJump - dt);
    mx = (input.right ? 1 : 0) - (input.left ? 1 : 0); my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (player.forceX > 0) { player.forceX -= dt; mx = player.forceDir; }
    if (player.wallBoost > 0) {
      player.wallBoost -= dt;
      if (mx && mx === player.boostDir) { player.vx = C.wallH * mx; player.stamina += C.climbJump; player.wallBoost = 0; }
    }
    if (player.meleeBuf > 0 && player.swing <= 0) { player.meleeBuf = 0; player.swing = C.swing; if (current.swing) current.swing(player, my === 1); }
    if (player.st === 1) climb(dt, input, mx, my);
    else if (player.st === 2) dashing(dt, input, mx);
    else normal(dt, input, mx, my);
    if (player.st === 2) breakBlocks();
    i = player.vy > 0; moveX(player.vx * dt);
    if (moveY(player.vy * dt) && i && player.vy === 0) player.squash = 0.12;
    if (player.swing > 0 && my === 1 && player.vy >= 0 && !player.onGround && pogo()) {}
    else spikes();
    if (NEU.dungeon) NEU.dungeon._liftLock = false;
    touchEntities(input, player.swing === C.swing);
    for (i = 0; i < current.entities.length; i++) { e = current.entities[i]; if (kinds[e.t] && kinds[e.t].tick) kinds[e.t].tick(e, dt); }
    if (current.tick) current.tick(dt);
    if (player.x < -24 || player.y > current.h * TILE + 64) die();
    player.squash = Math.max(0, player.squash - dt); player.stretch = Math.max(0, player.stretch - dt);
    if (player.onGround && Math.abs(player.vx) > 8) player.walked += Math.abs(player.vx) * dt;
    for (i = afterimages.length - 1; i >= 0; i--) { afterimages[i].t -= dt; if (afterimages[i].t <= 0) afterimages.splice(i, 1); }
    return getState();
  }
  function getState() { return { x: player.x, y: player.y, vx: player.vx, vy: player.vy, face: player.face, st: player.st,
    dashes: player.dashes, onGround: player.onGround, stamina: player.stamina, dead: player.dead > 0, hp: player.hp, inv: player.inv > 0,
    swing: player.swing > 0 }; }
  /* Only opted-in rooms reset interactive entities. Other acts retain their
     original death behavior (including coin/quest state), avoiding regressions. */
  function respawn() {
    var source, checkpoint, i, hadBroken;
    if (current.resetOnDeath) {
      source = levels[current.id];
      checkpoint = current.spawn;
      hadBroken = !!current.broken;
      current.entities = source.entities.map(function (e) { return Object.assign({}, e); });
      current.solids = current.entities.filter(function (e) { return e.solid; });
      current.broken = {};
      for (i = 0; i < current.entities.length; i++) if (current.entities[i].t === 'checkpoint') {
        current.entities[i].active = checkpoint.x === current.entities[i].x && checkpoint.y === current.entities[i].y - 1;
      }
      if (hadBroken) {
        if (current.chunked) { chunks = {}; chunkOrder = []; }
        else { delete bakeCache[current.id]; bake(); bakeCache[current.id] = baked; }
      }
      player = fresh();
    }
    player.x = (current.spawn.x + 0.5) * TILE; player.y = (current.spawn.y + 1) * TILE;
    player.vx = 0; player.vy = 0; player.onGround = false;
    player.dashes = 1; player.st = 0; player.hp = current.hp || 0;
    player.wipe = current.quickRespawn ? 0.07 : WIPE;
    simClock = 0;
    if (current.onRespawn) current.onRespawn();
    placeCamera(-1);
  }
  function bake() {
    if (!current || !document.createElement) return;
    var tall = (padB[current.tileset] | 0), c, x, y, ch, px, py, i, done = false;
    api._baking = true;
    baked = document.createElement('canvas');
    api._baking = false;
    baked.width = current.w * TILE; baked.height = current.h * TILE + tall;
    c = baked.getContext('2d'); if (!c) return;
    c.imageSmoothingEnabled = false;
    if (c.clearRect) c.clearRect(0, 0, baked.width, baked.height);
    for (i = 0; i < painters.length && !done; i++) done = !!painters[i](c, current);
    if (done) return;
    var colors = ['#181725', '#51455c', '#b892ff'];
    c.fillStyle = colors[0]; c.fillRect(0, 0, baked.width, baked.height);
    for (y = 0; y < current.h; y++) for (x = 0; x < current.w; x++) {
      ch = cell(x, y); px = x * TILE; py = y * TILE;
      if (ch === '#' || ch === 'x') { c.fillStyle = ch === 'x' ? '#9a4263' : colors[1]; c.fillRect(px, py, TILE, TILE); c.fillStyle = colors[2]; c.fillRect(px, py, TILE, 2); }
      else if (ch === '=') { c.fillStyle = colors[2]; c.fillRect(px, py, TILE, 3); }
      else if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') spikeTile(c, px, py, ch);
    }
  }
  function spikeTile(c, px, py, ch) {
    var body = '#FF5577', tip = '#FFD0DC';
    if (ch === '^') { fr(c, px + 7, py + 2, 2, 4, tip); fr(c, px + 4, py + 6, 8, 4, body); fr(c, px + 2, py + 10, 12, 6, body); }
    else if (ch === 'v') { fr(c, px + 2, py, 12, 6, body); fr(c, px + 4, py + 6, 8, 4, body); fr(c, px + 7, py + 10, 2, 4, tip); }
    else if (ch === '<') { fr(c, px + 2, py + 7, 4, 2, tip); fr(c, px + 6, py + 4, 4, 8, body); fr(c, px + 10, py + 2, 6, 12, body); }
    else { fr(c, px, py + 2, 6, 12, body); fr(c, px + 6, py + 4, 4, 8, body); fr(c, px + 10, py + 7, 4, 2, tip); }
  }
  /* big levels bake lazily in 32x32-tile chunks (512 px), kept in a 12-chunk LRU; painters get the tile rect */
  function chunk(cx, cy) {
    var k = current.id + ':' + cx + ',' + cy, cv = chunks[k], g, i, n = chunkOrder.indexOf(k);
    if (cv) { chunkOrder.splice(n, 1); chunkOrder.push(k); return cv; }
    cv = mk(CHUNK * TILE, CHUNK * TILE); g = cv.getContext && cv.getContext('2d');
    if (g) {
      g.imageSmoothingEnabled = false; g.translate(-cx * CHUNK * TILE, -cy * CHUNK * TILE);
      for (i = 0; i < painters.length; i++) if (painters[i](g, current, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK)) break;
    }
    chunks[k] = cv; chunkOrder.push(k);
    while (chunkOrder.length > LRU) delete chunks[chunkOrder.shift()];
    return cv;
  }
  function dropChunk(tx, ty) {
    var k, i, cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK), dx, dy;
    for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
      k = current.id + ':' + (cx + dx) + ',' + (cy + dy); i = chunkOrder.indexOf(k);
      if (i >= 0 && (Math.floor((tx + dx) / CHUNK) !== cx || Math.floor((ty + dy) / CHUNK) !== cy || (!dx && !dy))) { chunkOrder.splice(i, 1); delete chunks[k]; }
    }
  }
  /* a stepped steel spike pair in any of four directions; pal = { ink, dark, mid, light, tip, base } */
  var STEEL = { ink: '#12081E', dark: '#5A6470', mid: '#9AA0A8', light: '#E4E4EC', tip: '#FFFFFF', base: '#3A4048' };
  function spikeShape(c, px, py, ch, pal) {
    var q = pal || STEEL, W = [2, 2, 2, 4, 4, 4, 6, 6, 6, 8, 8, 8], k, n, cx, wd, v, u;
    function R(uu, vv, ww, hh, col) {
      c.fillStyle = col;
      if (ch === '^') c.fillRect(px + uu, py + vv, ww, hh);
      else if (ch === 'v') c.fillRect(px + uu, py + 16 - vv - hh, ww, hh);
      else if (ch === '<') c.fillRect(px + vv, py + uu, hh, ww);
      else c.fillRect(px + 16 - vv - hh, py + uu, hh, ww);
    }
    R(0, 13, 16, 3, q.ink); R(1, 13, 14, 2, q.dark); R(1, 13, 14, 1, q.mid);
    for (n = 0; n < 2; n++) {
      cx = 4 + n * 8;
      for (k = 0; k < 12; k++) { wd = W[k]; u = cx - (wd >> 1); v = 2 + k; R(u - 1, v, wd + 2, 1, q.ink); }
      for (k = 0; k < 12; k++) {
        wd = W[k]; u = cx - (wd >> 1); v = 2 + k;
        R(u, v, wd, 1, q.mid); R(u, v, Math.max(1, wd >> 1), 1, q.light); R(u + wd - 1, v, 1, 1, q.dark);
      }
      R(cx - 1, 2, 1, 1, q.tip);
    }
  }
  function placeCamera(dt) {
    var worldH = current.h * TILE, worldW = current.w * TILE, tx, ty, k, cfg;
    if (current.cameraMode === 'mountain') {
      cfg = current.camera || {};
      tx = clamp(player.x + clamp(player.vx * 0.12, -50, 50) + player.face * 16 - view.w / 2 + (cfg.offsetX || 0), 0, Math.max(0, worldW - view.w));
      ty = clamp(player.y - HH + clamp(player.vy * 0.16, -70, 70) - view.h * (cfg.focusY || 0.55) + (cfg.offsetY || 0), 0, Math.max(0, worldH - view.h));
      if (dt >= 0) {
        if (Math.abs(tx - camera.x) < 18) tx = camera.x;
        if (Math.abs(ty - camera.y) < 22) ty = camera.y;
      }
      k = dt < 0 ? 1 : 1 - Math.pow(0.72, dt * 60);
      camera.x += (tx - camera.x) * k; camera.y += (ty - camera.y) * k;
      return;
    }
    if (current.view === 'terraria') {
      /* Terraria: smooth follow on both axes with a small look-ahead, clamped to the world, rounded at draw */
      tx = clamp(player.x + player.face * 24 - view.w / 2, 0, Math.max(0, worldW - view.w));
      ty = clamp(player.y - HH - view.h / 2, 0, Math.max(0, worldH - view.h));
      k = dt < 0 ? 1 : 1 - Math.pow(0.85, dt * 60);
      camera.x += (tx - camera.x) * k; camera.y += (ty - camera.y) * k;
      return;
    }
    camera.x = clamp(player.x - view.w / 2, 0, Math.max(0, worldW - view.w));
    if (worldH < view.h) camera.y = (worldH - view.h) / 2;
    else camera.y = clamp(player.y - view.h / 2, 0, Math.max(0, worldH - view.h));
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  /* one cached 1x sprite; fn(R, g) paints it, R(x, y, w, h, colour) is an integer fillRect */
  function spr(key, w, h, fn) {
    var s = sprCache[key], cv, g;
    if (s) return s;
    cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    g = cv.getContext && cv.getContext('2d');
    s = sprCache[key] = { cv: cv, w: w, h: h };
    if (g) { g.imageSmoothingEnabled = false; fn(function (x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, g); }
    return s;
  }
  function rowsOf(R, rows, pal, x, y) {
    var r, i, ch;
    for (r = 0; r < rows.length; r++) for (i = 0; i < rows[r].length; i++) {
      ch = rows[r].charAt(i);
      if (ch !== '.' && pal[ch]) R(x + i, y + r, 1, 1, pal[ch]);
    }
  }
  function put(c, s, x, y) { if (s && s.cv) c.drawImage(s.cv, x | 0, y | 0); }
  function glow(c, x, y, r, col, a) {
    var L = NEU.engineLook;
    if (L && L.glow && c.createRadialGradient) L.glow(c, x, y, r, col, a);
  }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  function sizeView(w, h) {
    if (current.view === 'terraria') {
      /* integer scale only: a bigger window sees more world, never a fractional shimmer */
      view.scale = Math.max(1, Math.round(h / 540)); view.w = Math.ceil(w / view.scale); view.h = Math.ceil(h / view.scale);
      return;
    }
    view.h = 360; view.w = clamp(Math.round(360 * w / h), 240, 640);
    view.scale = Math.min(w / view.w, h / view.h);
  }
  function drawChunks(cx, cy) {
    var x0 = Math.floor(cx / (CHUNK * TILE)), y0 = Math.floor(cy / (CHUNK * TILE)), x, y, n = CHUNK * TILE;
    for (y = y0; y * n < cy + view.h; y++) for (x = x0; x * n < cx + view.w; x++)
      if (x >= 0 && y >= 0 && x * CHUNK < current.w && y * CHUNK < current.h) ctx.drawImage(chunk(x, y), x * n - cx, y * n - cy);
  }
  function draw() {
    if (!ctx || !current || !live) return;
    var dpr = window.devicePixelRatio || 1, w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    var now, dtf, ox, oy, shook = false, ai, i, e, J = NEU.juice, L = current, cx, cy, hs;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    reduced = redNow();
    now = reduced ? 0 : (window.performance && performance.now ? performance.now() : Date.now());
    dtf = clamp((now - lastDraw) / 1000, 0, 0.05); lastDraw = now;
    sizeView(w, h);
    ox = Math.round((w - view.w * view.scale) / 2); oy = Math.round((h - view.h * view.scale) / 2);
    area.x0 = Math.floor(-ox / view.scale) - 1; area.y0 = Math.floor(-oy / view.scale) - 1;
    area.x1 = Math.ceil((w - ox) / view.scale) + 1; area.y1 = Math.ceil((h - oy) / view.scale) + 1;
    placeCamera(reduced ? -1 : dtf);
    cx = Math.round(camera.x); cy = Math.round(camera.y);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!api.backdrop) { ctx.fillStyle = '#0b0a12'; ctx.fillRect(0, 0, w, h); }
    ctx.setTransform(view.scale, 0, 0, view.scale, ox, oy); ctx.imageSmoothingEnabled = false;
    /* begin() wraps save/rotate; only a live shake needs it, so a still frame paints with no transform */
    if (J && J.begin && !reduced && J.trauma > 0) shook = !!J.begin(ctx, view.w, view.h);
    if (api.backdrop) api.backdrop(ctx, cx, cy, L, now, area);
    if (L.chunked) drawChunks(cx, cy);
    else if (baked) ctx.drawImage(baked, -cx, -cy);
    if (api.live) api.live(ctx, cx, cy, L, now, area);
    if (!reduced) for (ai = 0; ai < afterimages.length; ai++) {
      ctx.globalAlpha = (afterimages[ai].t / 0.12) * 0.28;
      drawHero(ctx, afterimages[ai].x - cx, afterimages[ai].y - cy, player.face, false);
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < L.entities.length; i++) {
      e = L.entities[i];
      if (e.dead && e.t !== 'crumble') continue;
      if (e.x * TILE - cx < area.x0 - 48 || e.x * TILE - cx > area.x1 + 16 || e.y * TILE - cy < area.y0 - 64 || e.y * TILE - cy > area.y1 + 16) continue;
      drawEntity(e, ctx, cx, cy, now);
    }
    if (L.draw) L.draw(ctx, cx, cy, now);
    if (player.dead <= 0) {
      if (player.onGround) {
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#000000';
        ctx.fillRect((player.x - cx - 10) | 0, (player.y - cy) | 0, 20, 1);
        ctx.fillRect((player.x - cx - 7) | 0, (player.y - cy + 1) | 0, 14, 1);
        ctx.globalAlpha = 1;
      }
      if (player.inv > 0) ctx.globalAlpha = reduced ? 0.6 : ((((now / 170) | 0) & 1) ? 0.35 : 1); /* 340 ms period: under the 3 Hz flash cap */
      drawHero(ctx, player.x - cx, player.y - cy, player.face, player.onGround);
      ctx.globalAlpha = 1;
    } else deathRing(ctx, player.x - cx, player.y - cy - HH / 2, 1 - player.dead / DEATH);
    if (player.dead <= 0 && player.swing > 0) {
      ctx.fillStyle = '#fff0a6'; ctx.globalAlpha = Math.min(1, player.swing / C.swing);
      ctx.fillRect(player.x - cx + player.face * 10, player.y - cy - 20, player.face * 12, 3);
      ctx.fillRect(player.x - cx + player.face * 15, player.y - cy - 14, player.face * 3, 8);
      ctx.globalAlpha = 1;
    }
    if (J && J.drawParts) { ctx.save(); ctx.translate(-cx, -cy); J.drawParts(ctx, dtf || 0.016); ctx.restore(); }
    if (api.foreground) api.foreground(ctx, cx, cy, L, now, area);
    if (J && J.end) J.end(ctx, shook);
    if (L.hud) L.hud(ctx, cx, cy, now);
    if (api.hud) {
      /* the HUD sits on screen pixels: 16 CSS px text on a phone, 32 on a 1080p screen */
      hs = Math.max(1, Math.round(dpr)) * Math.max(1, Math.round(Math.min(w, h) / dpr / 540));
      ctx.setTransform(hs, 0, 0, hs, 0, 0);
      api.hud(ctx, L, view, now, { x0: 0, y0: 0, x1: Math.floor(w / hs), y1: Math.floor(h / hs) });
      ctx.setTransform(view.scale, 0, 0, view.scale, ox, oy);
    }
    wipe(ctx);
  }
  /* Celeste DeathEffect: eight orbs fly out on a ring and shrink, then a wipe covers the screen */
  function deathRing(c, x, y, t) {
    var k, a, r = reduced ? 10 : 4 + t * 36, s = Math.max(1, Math.round(6 * (1 - t)));
    c.fillStyle = (((t * 8) | 0) & 1) && !reduced ? '#FFFFFF' : '#FF5577';
    for (k = 0; k < 8; k++) { a = k * Math.PI / 4; c.fillRect((x + Math.cos(a) * r - s / 2) | 0, (y + Math.sin(a) * r - s / 2) | 0, s, s); }
  }
  function wipe(c) {
    var t, w = area.x1 - area.x0;
    if (player.dead > 0 && player.dead < DEATH * 0.4) t = 1 - player.dead / (DEATH * 0.4);
    else if (player.wipe > 0) t = player.wipe / WIPE;
    else return;
    c.fillStyle = '#000000';
    if (reduced) { c.globalAlpha = t; c.fillRect(area.x0, area.y0, w, area.y1 - area.y0); c.globalAlpha = 1; }
    else c.fillRect(area.x0, area.y0, Math.ceil(w * t), area.y1 - area.y0);
  }
  var INK = '#12081E', DEF = { key: 'def', ink: INK, deep: '#3A2418', base: '#6A4030', light: '#C4846A', rim: '#E8B090' };
  function skin() { return (api.skin && api.skin(current)) || DEF; }
  function fr(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function ell(g, ox, oy, cx, cy, rx, ry, col) {
    var y, k, hw;
    g.fillStyle = col;
    for (y = -ry; y <= ry; y++) {
      k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      if (k <= 0) continue;
      hw = Math.round(rx * Math.sqrt(k));
      g.fillRect(ox + cx - hw, oy + cy + y, hw * 2 + 1, 1);
    }
  }
  /* an arched opening: two stepped shoulders, then the straight sides */
  function archFill(c, x, y, w, h, col) {
    c.fillStyle = col;
    c.fillRect(x + 2, y, w - 4, 1); c.fillRect(x + 1, y + 1, w - 2, 1); c.fillRect(x, y + 2, w, h - 2);
  }
  var COIN_W = [10, 8, 4, 8];
  function coinSpr(f) {
    var wd = COIN_W[f];
    return spr('coin' + f, 10, 10, function (R) {
      var x0 = (10 - wd) >> 1, y, ins;
      for (y = 0; y < 10; y++) {
        ins = Math.min((y === 0 || y === 9) ? 2 : (y === 1 || y === 8) ? 1 : 0, Math.max(0, (wd >> 1) - 1));
        R(x0 + ins, y, wd - ins * 2, 1, '#6A4A08');
        if (y > 0 && y < 9) R(x0 + 1 + (ins ? 1 : 0), y, Math.max(1, wd - 2 - (ins ? 2 : 0)), 1, '#C89A1A');
      }
      if (wd >= 8) { R(x0 + 2, 2, wd - 5, 1, '#FFE35A'); R(x0 + 2, 3, 1, 3, '#FFE35A'); R(x0 + 3, 3, 2, 2, '#FFF6C0'); R(x0 + 2, 8, wd - 4, 1, '#A07810'); }
      else R(x0 + 1, 2, 1, 6, '#FFE35A');
    });
  }
  function refillSpr() {
    return spr('refill', 10, 14, function (R) {
      var W = [2, 4, 6, 8, 10, 10, 10, 10, 10, 10, 8, 6, 4, 2], y, wd, x0;
      for (y = 0; y < 14; y++) {
        wd = W[y]; x0 = (10 - wd) >> 1;
        R(x0, y, wd, 1, INK);
        if (wd > 2) { R(x0 + 1, y, wd - 2, 1, '#2AA8C0'); R(x0 + 1, y, Math.max(1, (wd - 2) >> 1), 1, '#64E8FF'); R(x0 + wd - 2, y, 1, 1, '#146878'); }
      }
      R(4, 2, 2, 2, '#E8FFFF'); R(3, 5, 1, 2, '#E8FFFF'); R(5, 12, 4, 1, '#146878');
    });
  }
  function crumbleSpr(s) {
    return spr('crumble' + s.key, 16, 16, function (R) {
      R(0, 0, 16, 16, INK); R(1, 1, 14, 14, s.base);
      R(1, 1, 14, 1, s.light); R(1, 1, 1, 14, s.light); R(1, 14, 14, 1, s.deep); R(14, 1, 1, 14, s.deep);
      R(1, 7, 14, 1, s.deep); R(8, 1, 1, 6, s.deep); R(4, 8, 1, 6, s.deep); R(11, 8, 1, 6, s.deep);
      R(3, 3, 3, 1, s.rim); R(10, 9, 3, 1, s.rim);
      R(6, 5, 2, 1, INK); R(7, 6, 2, 1, INK); R(8, 7, 1, 2, INK); R(9, 9, 2, 1, INK);
    });
  }
  function checkpointSpr() {
    return spr('checkpoint', 12, 24, function (R) {
      R(1, 21, 10, 3, INK); R(2, 21, 8, 2, '#5C4030'); R(2, 21, 8, 1, '#8A6040');
      R(4, 4, 4, 17, INK); R(5, 4, 2, 17, '#3A2A20'); R(5, 4, 1, 17, '#5C4030');
      R(4, 1, 4, 4, INK); R(5, 2, 2, 2, '#FFD36A');
    });
  }
  function skullSpr() {
    return spr('skull', 16, 14, function (R, g) {
      ell(g, 0, 0, 8, 6, 7, 6, INK); ell(g, 0, 0, 8, 6, 6, 5, '#C4A882'); ell(g, 0, 0, 7, 5, 5, 4, '#E8D2B0');
      R(4, 5, 3, 3, '#1A120C'); R(9, 5, 3, 3, '#1A120C'); R(7, 8, 2, 2, '#1A120C');
      R(3, 11, 10, 3, INK); R(4, 11, 8, 2, '#C4A882'); R(5, 11, 1, 2, '#F4E4CC'); R(7, 11, 1, 2, '#F4E4CC'); R(9, 11, 1, 2, '#F4E4CC');
      R(4, 13, 8, 1, '#8A7456');
    });
  }
  function exitSpr(s) {
    return spr('exit' + s.key, 24, 32, function (R) {
      var y;
      archFill2(R, 0, 0, 24, 32, INK); archFill2(R, 1, 1, 22, 31, s.base);
      R(1, 6, 3, 26, s.light); R(20, 6, 3, 26, s.deep); R(2, 3, 2, 3, s.light); R(8, 1, 8, 2, s.light);
      R(10, 0, 4, 3, s.rim); R(11, 3, 2, 1, INK);
      for (y = 8; y < 32; y += 8) { R(1, y, 3, 1, s.deep); R(20, y + 4, 3, 1, s.base); }
      R(0, 31, 24, 1, INK); R(0, 30, 24, 1, s.deep);
    });
  }
  function archFill2(R, x, y, w, h, col) { R(x + 2, y, w - 4, 1, col); R(x + 1, y + 1, w - 2, 1, col); R(x, y + 2, w, h - 2, col); }

  var ENT = {
    coin: function (c, px, py, e, now) { put(c, coinSpr(reduced ? 0 : ((now / 120) | 0) & 3), px + 3, py + 3); },
    refill: function (c, px, py, e, now) {
      var on = !(e.t0 > 0), dy = (on && !reduced) ? (((now / 400) | 0) & 1) : 0, k;
      if (!on) c.globalAlpha = 0.3;
      else glow(c, px + 8, py + 8, 20, '#64E8FF', 0.15);
      put(c, refillSpr(), px + 3, py + 1 + dy);
      c.globalAlpha = 1;
      if (on) { k = reduced ? 0 : ((now / 400) | 0) & 3; fr(c, px + [1, 13, 12, 2][k], py + [3, 5, 12, 11][k], 1, 1, '#64E8FF'); }
    },
    crumble: function (c, px, py, e, now) {
      var s = skin(), j = (e.cs === 1 && !reduced) ? ((((now / 40) | 0) & 1) ? 1 : -1) : 0, f = fallOf(e);
      if (f < 0) return;
      put(c, crumbleSpr(s), px + j, py + f);
      fr(c, px + 3 + j, py + 2 + f, 4, 1, s.light);
    },
    checkpoint: function (c, px, py, e, now) {
      var f = reduced ? 0 : ((now / 160) | 0) % 3, i, top = py - 22 + 3, off, up = e.active ? 0 : 6;
      put(c, checkpointSpr(), px + 2, py - 22);
      for (i = 0; i < 8; i++) {
        off = (((i + f) % 3) === 0) ? 1 : 0;
        fr(c, px + 8 + i, top + up + off, 1, 6 - (i >> 2), '#802048');
        fr(c, px + 8 + i, top + up + off + 1, 1, 3 - (i >> 2), '#C83A7A');
        fr(c, px + 8 + i, top + up + off, 1, 1, '#FF8AC8');
      }
      if (e.active) glow(c, px + 8, py - 12, 18, '#FF8AC8', 0.14);
    },
    skull: function (c, px, py) {
      put(c, skullSpr(), px, py + 1);
      fr(c, px + 5, py + 2, 3, 1, '#F4E4CC'); fr(c, px + 5, py + 6, 1, 1, '#FF5577'); fr(c, px + 10, py + 6, 1, 1, '#FF5577');
    },
    exit: function (c, px, py, e, now) {
      var s = skin(), ix = px, iy = py - 12, p = reduced ? 0 : ((now / 400) | 0) & 1;
      glow(c, px + 8, py - 2, 26, '#5AC85A', 0.12);
      put(c, exitSpr(s), px - 4, py - 16);
      archFill(c, ix, iy, 16, 28, '#1A4020'); archFill(c, ix + 2, iy + 3, 12, 25, '#5AC85A');
      archFill(c, ix + 4 + p, iy + 6 + p, 8 - p * 2, 22 - p, '#A9FF8A');
    },
    spring: function (c, px, py, e) {
      /* Spring.cs wiggle: the plate squashes, then rings at 1 + 0.2 x a decaying sine */
      var w = e.flash > 0 && !reduced ? Math.round(Math.sin((0.25 - e.flash) * 50) * e.flash * 4 * 4) : 0;
      var cmp = clamp(w, -4, 4), t = py + 4 + cmp, k, yy, gap = ((9 - cmp) / 3) | 0;
      fr(c, px + 1, py + 13, 14, 3, INK); fr(c, px + 2, py + 14, 12, 2, '#8A6410'); fr(c, px + 2, py + 13, 12, 1, '#B8861A');
      for (k = 0; k < 3; k++) {
        yy = t + 4 + k * gap;
        fr(c, px + 4, yy, 8, 2, INK); fr(c, px + 5, yy, 6, 1, '#FFCF4A'); fr(c, px + 5, yy + 1, 6, 1, '#8A6410');
      }
      fr(c, px + 1, t, 14, 4, INK); fr(c, px + 2, t + 1, 12, 2, '#FFCF4A'); fr(c, px + 2, t + 1, 12, 1, '#FFF0A0');
    },
    zip: function (c, px, py, e, now) {
      var a = reduced ? 0 : ((now / 400) | 0) & 1;
      fr(c, px, py, 16, 16, INK); fr(c, px + 1, py + 1, 14, 14, '#1A3058');
      fr(c, px + 1, py + 1, 14, 1, '#7AA2FF'); fr(c, px + 1, py + 1, 1, 14, '#7AA2FF');
      fr(c, px + 14, py + 2, 1, 13, '#0E1C38'); fr(c, px + 2, py + 14, 13, 1, '#0E1C38');
      fr(c, px + 4, py + 4, 8, 8, '#7AA2FF'); fr(c, px + 5, py + 5, 6, 6, '#26407A');
      fr(c, px + 7, py + 6 + a, 2, 4 - a, '#E8F0FF'); fr(c, px + 6, py + 7 + a, 4, 1, '#E8F0FF');
      fr(c, px + 2, py + 2, 1, 1, '#E8F0FF'); fr(c, px + 13, py + 2, 1, 1, '#E8F0FF');
    },
    barrier: function (c, px, py) {
      var i;
      for (i = 0; i < 6; i++) { fr(c, px + 2 + i * 2, py + 2 + i * 2, 4, 3, INK); fr(c, px + 12 - i * 2, py + 2 + i * 2, 4, 3, INK); }
      for (i = 0; i < 6; i++) { fr(c, px + 3 + i * 2, py + 3 + i * 2, 2, 2, '#E23B4A'); fr(c, px + 13 - i * 2, py + 3 + i * 2, 2, 2, '#E23B4A'); }
      fr(c, px + 3, py + 3, 1, 1, '#FFD0D4'); fr(c, px + 13, py + 3, 1, 1, '#FFD0D4');
    },
    pogo: function (c, px, py, e, now) {
      var b = reduced ? 0 : ((now / 400) | 0) & 1;
      glow(c, px + 8, py + 8, 16, '#3DDC97', 0.12);
      ell(c, px, py + b, 8, 8, 6, 6, INK); ell(c, px, py + b, 8, 8, 5, 5, '#146848'); ell(c, px, py + b, 7, 7, 3, 3, '#3DDC97');
      fr(c, px + 5, py + 5 + b, 2, 2, '#C8FFE4'); fr(c, px + 4, py + 14, 8, 2, INK); fr(c, px + 5, py + 14, 6, 1, '#146848');
    },
    door: function (c, px, py) {
      fr(c, px + 1, py, 14, 16, INK); fr(c, px + 2, py + 1, 12, 15, '#8A5A32');
      fr(c, px + 2, py + 1, 12, 1, '#B07A4A'); fr(c, px + 5, py + 1, 1, 15, '#3A2418'); fr(c, px + 10, py + 1, 1, 15, '#3A2418');
      fr(c, px + 11, py + 8, 2, 2, '#E8C878'); fr(c, px + 2, py + 4, 12, 1, '#3A2418'); fr(c, px + 2, py + 12, 12, 1, '#3A2418');
    },
    spike: function (c, px, py) { spikeShape(c, px, py, '^', null); }
  };
  /* CrumblePlatform.cs: tiles drop over 0.4 s, staggered 0.05 s by column; back in with a 0.25 s bounce */
  function fallOf(e) {
    if (e.cs === 2) { var t = 2 - e.ct - ((e.x | 0) & 3) * 0.05; return t <= 0 ? 0 : t >= 0.4 ? -1 : Math.round(t * t * 400); }
    if (e.bounce > 0 && !reduced) return -Math.round(Math.sin(e.bounce / 0.25 * Math.PI) * 3);
    return 0;
  }
  function drawEntity(e, c, x, y, now) {
    var px = (e.x * TILE - x) | 0, py = (e.y * TILE - y) | 0, kind = kinds[e.t];
    if (kind && kind.draw) { kind.draw(c, px, py, e, now); return; }
    if (ENT[e.t]) { ENT[e.t](c, px, py, e, now || 0); return; }
    c.fillStyle = '#FF00FF';
    c.fillRect(px, py, 16, 16);
  }
  function drawHero(c, wx, wy, face, moving) {
    var look = NEU.engineLook;
    if (look && look.drawPlayer) {
      look.drawPlayer(c, wx, wy, face > 0 ? 'right' : 'left', player.walked || 0, !!moving && !reduced, 2, 1000, { settle: player.squash > 0 && !reduced });
      return;
    }
    c.fillStyle = '#FF00FF';
    c.fillRect((wx - HW) | 0, (wy - HH) | 0, HW * 2, HH);
  }
  function open(id, opts) {
    var i, carry;
    if (!levels[id]) return false;
    opts = opts || {};
    carry = live && opts.carry ? { vx: player.vx, vy: player.vy, dashes: player.dashes, face: player.face } : null;
    if (live) close();
    current = cloneLevel(levels[id]); player = fresh(); simClock = 0;
    if (opts.spawn) current.spawn = opts.spawn;
    current.solids = current.entities.filter(function (e) { return e.solid; });
    player.x = (current.spawn.x + 0.5) * TILE; player.y = (current.spawn.y + 1) * TILE; player.hp = current.hp || 0;
    if (opts.face) player.face = opts.face;
    if (carry) {
      player.vx = carry.vx; player.vy = carry.vy;
      player.dashes = carry.dashes; if (!opts.face) player.face = carry.face;
    }
    accumulator = 0; afterimages = []; live = true; paused = false; reduced = redNow(); if (overlay) overlay.hidden = false;
    if (current.chunked) { baked = null; for (i in chunks) if (i.indexOf(id + ':') !== 0) delete chunks[i]; chunkOrder = chunkOrder.filter(function (k) { return !!chunks[k]; }); }
    /* ponytail: per-room bake cache, dropped when a crumble breaks; a room bakes on its first open only */
    else if (bakeCache[id]) baked = bakeCache[id]; else { bake(); bakeCache[id] = baked; }
    sizeView(Math.round((window.innerWidth || 640) * (window.devicePixelRatio || 1)), Math.round((window.innerHeight || 360) * (window.devicePixelRatio || 1)));
    placeCamera(-1);
    if (current.onOpen) current.onOpen(opts);
    draw();
    NEU.activeMinigame = 'plat';
    if (NEU.kernel && NEU.kernel.current() !== 'plat') NEU.kernel.push('plat'); return true;
  }
  function cloneLevel(src) {
    var out = {}, k;
    for (k in src) if (Object.prototype.hasOwnProperty.call(src, k) && k !== 'entities') out[k] = src[k];
    out.entities = src.entities.map(function (e) { var v = {}, p; for (p in e) if (Object.prototype.hasOwnProperty.call(e, p)) v[p] = e[p]; return v; });
    return out;
  }
  function close() {
    if (!live) return;
    live = false;
    if (overlay) overlay.hidden = true;
    if (current && current.onClose) current.onClose();
    if (NEU.activeMinigame === 'plat') NEU.activeMinigame = null;
    if (NEU.kernel && NEU.kernel.current() === 'plat') NEU.kernel.pop();
  }
  function tick(dt) {
    if (!live || paused) return;
    /* dt arrives in ms (kernel rAF delta); convert to seconds before the 0.25 s clamp, or every frame adds 0.00025 s and the hero never moves */
    accumulator += Math.min(0.25, Math.max(0, dt) / 1000) * (current.slow ? current.slow() : 1);
    var n = 0;
    while (accumulator >= STEP && n++ < MAX_STEPS && live) { step(STEP, keys); accumulator -= STEP; }
    draw();
  }
  function replay(id, recording, opts) {
    var oldLevel = current, oldPlayer = player, oldLive = live, oldPaused = paused;
    var oldAccumulator = accumulator, oldClock = simClock, oldImages = afterimages, oldBaked = baked;
    var oldStack = NEU.kernel ? NEU.kernel.stack.slice() : null;
    var oldMini = NEU.activeMinigame;
    replaying = true;
    if (!open(id, opts)) { replaying = false; return { reached: false, deaths: 0, frames: 0 }; }
    var frames = 0, deaths = 0, i, j, pair, state, wasDead = false;
    for (i = 0; i < recording.length; i++) {
      pair = recording[i];
      for (j = 0; j < pair[0]; j++) { state = step(STEP, pair[1]); frames++; if (state.dead && !wasDead) deaths++; wasDead = state.dead; if (current.exited) break; }
      if (current.exited) break;
    }
    var reached = !!current.exited, end = getState();
    replaying = false;
    live = oldLive; current = oldLevel; player = oldPlayer; paused = oldPaused;
    accumulator = oldAccumulator; simClock = oldClock; afterimages = oldImages; baked = oldBaked;
    if (oldStack && NEU.kernel) { NEU.kernel.stack.length = 0; for (i = 0; i < oldStack.length; i++) NEU.kernel.stack.push(oldStack[i]); }
    NEU.activeMinigame = oldMini;
    if (overlay) overlay.hidden = !live; return { reached: reached, deaths: deaths, frames: frames, end: end };
  }
  function getStateSafe() { return live ? getState() : null; }
  function routed(e) {
    var r = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (r.swallow) return null;
    return r.to;
  }
  function onTop() { return !NEU.kernel || NEU.kernel.current() === 'plat'; }
  function onKey(e) {
    var k, down;
    if (!live || !onTop()) return;
    k = routed(e);
    if (k == null) return;
    down = e.type === 'keydown';
    if (current.key && current.key(k, down)) { e.preventDefault(); return; }
    if (k === 'Escape' && down) { close(); e.preventDefault(); return; }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = down;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = down;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.up = down;
    if (k === 'ArrowDown' || k === 's' || k === 'S') keys.down = down;
    if (k === ' ' || k === 'Space' || k === 'Spacebar') keys.jump = down;
    if (k === 'x' || k === 'X') keys.dash = down;
    if (k === 'Shift') keys.grab = down;
    if (k === 'z' || k === 'Z') keys.melee = down;
    if (down && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'x', 'X'].indexOf(k) >= 0) e.preventDefault();
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  function feetOn(e) { return player.onGround && Math.abs(player.y - e.y * TILE) < 0.5 && player.x + HW > e.x * TILE && player.x - HW < e.x * TILE + TILE; }
  function climbing(e) { return player.st === 1 && Math.floor((player.x + player.face * (HW + 1)) / TILE) === Math.floor(e.x) && player.y - HH < e.y * TILE + TILE && player.y > e.y * TILE; }
  kinds.refill = { touch: function (e) { if (!(e.t0 > 0)) { refill(); e.t0 = 2.5; } }, tick: function (e, dt) { if (e.t0 > 0) { e.t0 -= dt; if (e.t0 <= 0) e.t0 = 0; } } };
  kinds.spring = { touch: function (e) {
    if (player.vy >= 0 && player.y >= (e.y + 1) * TILE - 12 && Math.abs(player.x - (e.x + 0.5) * TILE) < HW + 8) {
      player.vy = C.spring; player.varJump = C.springVar; player.varSpeed = player.vy; player.st = 0; player.dashAttack = 0; refill(); e.flash = 0.25;
    } }, tick: function (e, dt) { if (e.flash > 0) e.flash = Math.max(0, e.flash - dt); } };
  /* a zip block carries whoever stands on it */
  kinds.zip = { touch: function (e) { if (!e.go) { e.go = true; e.returning = false; e.wait = 0.2; e.sx = e.x; e.sy = e.y; } }, tick: function (e, dt) {
    var tx, ty, ox = e.x, oy = e.y, ride = feetOn(e);
    if (!e.go) return;
    if (e.wait > 0) { e.wait -= dt; return; }
    tx = e.returning ? e.sx : (e.targetX == null ? e.sx : e.targetX); ty = e.returning ? e.sy : (e.targetY == null ? e.sy - 4 : e.targetY);
    e.x = approach(e.x, tx, dt * 3); e.y = approach(e.y, ty, dt * 3);
    if (ride) { player.x += (e.x - ox) * TILE; player.y += (e.y - oy) * TILE; }
    if (Math.abs(e.x - tx) < 0.05 && Math.abs(e.y - ty) < 0.05) { if (e.returning) e.go = false; else e.returning = true; }
  } };
  /* CrumblePlatform.cs: standing shakes 0.2 s (climbing 3 x 0.2), then up to 0.4 s more that ends early when you step off;
     then it falls, and after 2 s it returns once nothing overlaps it */
  kinds.crumble = { tick: function (e, dt) {
    var on;
    if (e.bounce > 0) e.bounce = Math.max(0, e.bounce - dt);
    if (!e.cs) { on = feetOn(e); if (on || climbing(e)) { e.cs = 1; e.ct = on ? 0.6 : 1; e.top = on; } return; }
    if (e.cs === 1) {
      e.ct -= dt;
      if (e.ct <= 0 || (e.top && e.ct < 0.4 && !feetOn(e))) { e.cs = 2; e.ct = 2; e.dead = true; }
      return;
    }
    if (e.ct > 0) { e.ct -= dt; return; }
    if (!overlapsHero(e)) { e.cs = 0; e.dead = false; e.bounce = 0.25; }
  } };
  function overlapsHero(e) { return player.x + HW > e.x * TILE && player.x - HW < e.x * TILE + TILE && player.y > e.y * TILE && player.y - HH < e.y * TILE + TILE; }
  kinds.pogo = { touch: function (e, input, melee) { if (player.swing > 0 && input.down && player.vy > 0) { bounce(); e.dead = e.once ? true : e.dead; } } };
  kinds.checkpoint = { touch: function (e) {
    if (e.active) return;
    current.spawn = { x: e.x, y: e.y - 1 };
    e.active = true;
    if (!replaying && current.onCheckpoint) current.onCheckpoint(e);
  } };
  kinds.exit = { touch: function () { current.exited = true; if (!replaying && typeof current.onExit === 'function') current.onExit(); } };
  kinds.coin = { touch: function (e) { e.dead = true; if (!replaying && NEU.save && NEU.save.addCoins && !NEU.save.flagged('plat_coin:' + e.id)) { NEU.save.addCoins(1); NEU.save.flag('plat_coin:' + e.id, 1); } } };
  kinds.npc = { touch: function (e, input, melee) { if (melee && NEU.talk) NEU.talk(e.lines || [e.text || '...'], e.who || 'narr'); } };
  kinds.door = { touch: function (e, input, melee) { if (!melee) return; var ok = !e.locked || (NEU.save && (NEU.save.flagged(e.locked) || NEU.save.has(e.locked))); if (ok) { e.dead = true; } else if (NEU.talk) NEU.talk([e.waits || ('It waits for ' + e.locked + '.')], 'narr'); } };
  kinds.barrier = { touch: function () {} };

  var api = { level: level, open: open, close: close, running: function () { return live; },
    painters: painters, pad: padB, spr: spr, rows: rowsOf, ell: ell, mod: mod, spike: spikeShape, glow: glow, fr: fr, steel: STEEL,
    mk: mk, C: C, TILE: TILE, hw: HW, hh: HH,
    hash: function (x, y, z) {
      var h = (x * 374761393 + y * 668265263 + (z || 0) * 2147483647) | 0;
      h = (h ^ (h >>> 13)) * 1274126177 | 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },
    mix: function (a, b, t) {
      var x = [parseInt(a.substr(1, 2), 16), parseInt(a.substr(3, 2), 16), parseInt(a.substr(5, 2), 16)];
      var y = [parseInt(b.substr(1, 2), 16), parseInt(b.substr(3, 2), 16), parseInt(b.substr(5, 2), 16)], i, v, o = '#';
      for (i = 0; i < 3; i++) { v = Math.round(x[i] + (y[i] - x[i]) * t); o += (v < 16 ? '0' : '') + v.toString(16); }
      return o.toUpperCase();
    },
    reduced: redNow, bakedCanvas: function () { return baked; }, rebake: function () { bake(); },
    /* bake a room into the cache without opening it; restores the live level */
    prebake: function (id) {
      var keepLevel = current, keepBaked = baked;
      if (levels[id] && !bakeCache[id] && !levels[id].chunked) { current = cloneLevel(levels[id]); current.solids = []; bake(); bakeCache[id] = baked; }
      current = keepLevel; baked = keepBaked;
    },
    view: function () { return { w: view.w, h: view.h, scale: view.scale }; },
    backdrop: null, live: null, foreground: null, hud: null, skin: null,
    get state() { return getStateSafe(); }, step: step, replay: replay, tick: tick,
    hurt: hurt, die: die, heal: function (n) { if (current && current.hp) player.hp = Math.min(current.hp, player.hp + n); },
    hero: function () { return player; }, level0: function () { return current; },
    wind: windNow, time: function () { return simClock; },
    restartRoom: function () { if (!current) return false; respawn(); return true; },
    solid: function (tx, ty) { return !!current && solidCell(cell(tx, ty)); }, cell: function (tx, ty) { return current ? cell(tx, ty) : '#'; },
    chunkCount: function () { return chunkOrder.length; }, replaying: function () { return replaying; },
    snap: function () { if (current) placeCamera(-1); }, fallOf: fallOf, dropChunks: function () { chunks = {}; chunkOrder = []; }, ent: function (t, c, x, y, e, now) { if (ENT[t]) ENT[t](c, x, y, e, now || 0); },
    levelId: function () { return current ? current.id : ''; },
    get levels() { return levels; }, _kinds: kinds,
    cam: function () { return { x: camera.x, y: camera.y }; } };
  NEU.plat = api;
  if (NEU.kernel) NEU.kernel.register('plat', { tick: tick, open: open, close: close, running: function () { return live; } });
  document.addEventListener('keydown', function (e) {
    var k;
    if (!live || !onTop()) return;
    k = routed(e);
    if (k === 'Escape' && !(current && current.key)) paused = true;
  });
})();
