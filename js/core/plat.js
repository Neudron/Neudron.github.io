(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var TILE = 16, SCALE = 2, STEP = 1 / 60, MAX_STEPS = 8;
  var levels = {}, kinds = {}, current = null, live = false, paused = false, replaying = false;
  var canvas = document.getElementById('platCanvas'), overlay = document.getElementById('plat');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var keys = {}, accumulator = 0, camera = { x: 0, y: 0 }, baked = null, afterimages = [];
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var player = fresh();

  function fresh() {
    return { x: 0, y: 0, vx: 0, vy: 0, face: 1, dashes: 1, onGround: false,
      stamina: 110, dead: 0, coyote: 0, jumpBuffer: 0, varJump: 0,
      dashTime: 0, dashCooldown: 0, dashX: 0, dashY: 0,
      wallTime: 0, forceX: 0, forceDir: 0, pogo: false, squash: 0, stretch: 0 };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function approach(v, target, delta) { return v < target ? Math.min(target, v + delta) : Math.max(target, v - delta); }
  function grid(text) { return String(text || '').split('\n').filter(function (r) { return r.length; }); }
  function level(id, def) {
    def = def || {};
    def.id = id; def.grid = grid(def.tiles); def.h = def.grid.length;
    def.w = def.grid.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    def.entities = (def.entities || []).map(function (e, i) {
      var v = {}, k;
      for (k in e) if (Object.prototype.hasOwnProperty.call(e, k)) v[k] = e[k];
      v.id = v.id || id + ':' + v.t + ':' + v.x + ',' + v.y + ':' + i;
      v.t0 = 0; v.dead = false; v.solid = v.t === 'zip';
      return v;
    });
    levels[id] = def; return def;
  }
  function cell(x, y) {
    if (!current || y < 0 || y >= current.h || x < 0 || x >= current.w) return '#';
    if (current.broken && current.broken[x + ',' + y]) return '.';
    return (current.grid[y] || '')[x] || '.';
  }
  function solidChar(c, dy, oldBottom) {
    return c === '#' || c === 'x' || (c === '=' && dy > 0 && oldBottom <= Math.floor(oldBottom / TILE) * TILE + 0.01);
  }
  function overlapsTile(x, y, c) {
    var x0 = Math.floor((x - 12) / TILE), x1 = Math.floor((x + 12 - 0.01) / TILE);
    var y0 = Math.floor((y - 32) / TILE), y1 = Math.floor((y - 0.01) / TILE), tx, ty;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) if (cell(tx, ty) === c) return true;
    return false;
  }
  function blocked(x, y, dy, oldBottom) {
    var x0 = Math.floor((x - 12) / TILE), x1 = Math.floor((x + 12 - 0.01) / TILE);
    var y0 = Math.floor((y - 32) / TILE), y1 = Math.floor((y - 0.01) / TILE), tx, ty, c, i, e;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) {
      c = cell(tx, ty); if (c === '#' || c === 'x' || (c === '=' && dy > 0 && oldBottom <= ty * TILE + 0.01)) return true;
      for (i = 0; i < current.entities.length; i++) {
        e = current.entities[i];
        if (e.solid && !e.dead && Math.floor(e.x) === tx && Math.floor(e.y) === ty) return true;
      }
    }
    return false;
  }
  function sweep(dx, dy) {
    var n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 8)), sx = dx / n, sy = dy / n;
    var i, nx, ny, oldBottom, hitX = false, hitY = false;
    for (i = 0; i < n; i++) {
      nx = player.x + sx;
      if (!blocked(nx, player.y, 0, player.y)) player.x = nx;
      else { hitX = true; player.vx = 0; }
      oldBottom = player.y; ny = player.y + sy;
      if (!blocked(player.x, ny, sy, oldBottom)) player.y = ny;
      else { hitY = true; player.vy = 0; }
    }
    return { x: hitX, y: hitY };
  }
  function nearbyWall(dir) { return blocked(player.x + dir * 13, player.y - 8, 0, player.y); }
  function doJump(dir) {
    player.vy = -210; player.varJump = 0.2; player.coyote = 0; player.jumpBuffer = 0;
    player.onGround = false; player.vx += dir * 80; player.face = dir || player.face;
    player.stretch = 0.12;
  }
  function refill() { player.dashes = 1; }
  function die() {
    if (player.dead > 0) return;
    player.dead = 0.35; player.vx = 0; player.vy = 0;
    if (NEU.juice && NEU.juice.burst && !reduced) NEU.juice.burst(player.x, player.y - 16, 12, '#FF5577', 140);
  }
  function parseInput(input) {
    var out = {}, k, parts;
    if (typeof input === 'string') {
      parts = input.toLowerCase().split(/[ ,+]+/);
      for (var i = 0; i < parts.length; i++) out[parts[i]] = true;
      out.left = out.left || out.a; out.right = out.right || out.d;
      out.up = out.up || out.w; out.down = out.down || out.s;
      out.jump = out.jump || out.space; out.grab = out.grab || out.shift;
    } else if (input) for (k in input) if (Object.prototype.hasOwnProperty.call(input, k)) out[k.toLowerCase()] = !!input[k];
    return out;
  }
  function hitSpike(px, py, down) {
    var x0 = Math.floor((px - 12) / TILE), x1 = Math.floor((px + 12) / TILE);
    var y0 = Math.floor((py - 32) / TILE), y1 = Math.floor(py / TILE), tx, ty, ch;
    var top = py - 32, left, right, mid, reach, contact;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) {
      ch = cell(tx, ty); contact = false;
      if (ch === '^') {
        reach = py - ty * TILE; mid = (tx + 0.5) * TILE;
        contact = reach >= 2 && reach <= TILE && px + 12 >= mid - reach / 2 && px - 12 <= mid + reach / 2;
      } else if (ch === 'v') {
        reach = (ty + 1) * TILE - top; mid = (tx + 0.5) * TILE;
        contact = reach >= 2 && reach <= TILE && px + 12 >= mid - reach / 2 && px - 12 <= mid + reach / 2;
      } else if (ch === '<') {
        reach = px + 12 - tx * TILE; mid = (ty + 0.5) * TILE;
        contact = reach >= 2 && reach <= TILE && py >= mid - reach / 2 && top <= mid + reach / 2;
      } else if (ch === '>') {
        reach = (tx + 1) * TILE - (px - 12); mid = (ty + 0.5) * TILE;
        contact = reach >= 2 && reach <= TILE && py >= mid - reach / 2 && top <= mid + reach / 2;
      }
      if (ch === '^' && (player.vy < 0 || (player.vy === 0 && !player.onGround))) contact = false;
      if (contact) {
        if (down && ch === '^' && player.vy >= 0) { player.vy = -280; player.pogo = true; refill(); return true; }
        die(); return true;
      }
    }
    return false;
  }
  function touchEntities(input, melee) {
    var i, e, ex, ey, dx, dy, k, kind;
    for (i = 0; i < current.entities.length; i++) {
      e = current.entities[i]; if (e.dead || (e.t === 'refill' && e.t0 > 0)) continue;
      ex = (e.x + 0.5) * TILE; ey = (e.y + 1) * TILE;
      dx = Math.abs(player.x - ex); dy = Math.abs((player.y - 16) - (ey - 8));
      if (dx > 22 || dy > 24) continue;
      kind = kinds[e.t]; if (kind && kind.touch) kind.touch(e, input, melee, dx, dy);
    }
  }
  function step(dt, raw) {
    var input = parseInput(raw), dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var pressedJump = !!input.jump, pressedDash = !!input.dash, pressedMelee = !!input.melee;
    var oldGround, target, accel, dashDirX, dashDirY, hit, downStrike, i, broke;
    if (!current || current.exited) return getState();
    dt = clamp(Number(dt) || STEP, 0, 0.1);
    if (player.dead > 0) {
      player.dead = Math.max(0, player.dead - dt);
      if (!player.dead) respawn();
      return getState();
    }
    player.coyote = player.onGround ? 0.1 : Math.max(0, player.coyote - dt);
    player.jumpBuffer = pressedJump ? 0.08 : Math.max(0, player.jumpBuffer - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.wallTime = Math.max(0, player.wallTime - dt);
    player.forceX = Math.max(0, player.forceX - dt);
    oldGround = player.onGround;
    if (oldGround) { refill(); player.stamina = 110; }
    if (pressedMelee) player.swing = 0.12;
    else player.swing = Math.max(0, (player.swing || 0) - dt);
    downStrike = pressedMelee && input.down;

    if (input.grab && (nearbyWall(-1) || nearbyWall(1)) && !oldGround && player.stamina > 0) {
      if (input.up) { player.vy = -90; player.stamina = Math.max(0, player.stamina - 45.45 * dt); }
      else if (input.down) { player.vy = 160; }
      else { player.vy = Math.min(player.vy, 40); player.stamina = Math.max(0, player.stamina - 10 * dt); }
      if (pressedJump) { player.stamina = Math.max(0, player.stamina - 27.5); doJump(nearbyWall(-1) ? 1 : -1); }
    } else {
      if (player.dashTime <= 0 && pressedDash && player.dashes > 0 && player.dashCooldown <= 0) {
        dashDirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        dashDirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
        if (!dashDirX && !dashDirY) dashDirX = player.face;
        var len = Math.sqrt(dashDirX * dashDirX + dashDirY * dashDirY) || 1;
        player.dashX = dashDirX / len; player.dashY = dashDirY / len;
        player.vx = player.dashX * 480; player.vy = player.dashY * 480;
        player.dashes--; player.onGround = false; player.dashTime = 0.15; player.dashCooldown = 0.2;
      }
      if (player.dashTime > 0) {
        player.dashTime = Math.max(0, player.dashTime - dt);
        if (player.dashTime < 0.000001) player.dashTime = 0;
        if (!reduced) {
          afterimages.push({ x: player.x, y: player.y, t: 0.12 });
          while (afterimages.length > 3) afterimages.shift();
        }
        broke = false;
        var bx0 = Math.floor((player.x + player.vx * dt - 12) / TILE);
        var bx1 = Math.floor((player.x + player.vx * dt + 12) / TILE);
        var by0 = Math.floor((player.y + player.vy * dt - 32) / TILE);
        var by1 = Math.floor((player.y + player.vy * dt - 1) / TILE), tx, ty;
        for (ty = by0; ty <= by1; ty++) for (tx = bx0; tx <= bx1; tx++)
          if (cell(tx, ty) === 'x') { if (!current.broken) current.broken = {}; current.broken[tx + ',' + ty] = true; broke = true; }
        if (broke) bake();
        hit = sweep(player.vx * dt, player.vy * dt);
        if (hit.x || hit.y) player.dashTime = 0;
        if (player.dashTime === 0) { player.vx = player.dashX * 320; player.vy = player.dashY * 320 * (player.dashY < 0 ? 0.75 : 1); }
      } else {
        if (dir) player.face = dir;
        target = dir * 180;
        accel = oldGround ? (dir && player.vx * dir < 0 ? 800 : 2000) : 1300;
        if (dir) player.vx = approach(player.vx, target, accel * dt);
        else player.vx = approach(player.vx, 0, 800 * dt);
        if (player.forceX > 0) player.vx = player.forceDir * 260;
        if (player.jumpBuffer > 0 && (player.coyote > 0 || player.onGround)) doJump(dir);
        else if (player.jumpBuffer > 0 && (nearbyWall(-1) || nearbyWall(1))) {
          doJump(nearbyWall(-1) ? 1 : -1); player.vx = (nearbyWall(-1) ? 1 : -1) * 260;
          player.forceX = 0.16; player.forceDir = player.vx > 0 ? 1 : -1;
        }
        if (player.vy < 0 && player.varJump > 0 && input.jump) player.vy = Math.max(player.vy, -210);
        player.vy += 1800 * (Math.abs(player.vy) < 80 && input.jump && player.varJump > 0 ? 0.5 : 1) * dt;
        player.vy = Math.min(player.vy, input.down ? 480 : 320);
        if (player.varJump > 0) player.varJump = Math.max(0, player.varJump - dt);
        hit = sweep(player.vx * dt, player.vy * dt);
        if (hit.x && player.vy < 0) { for (i = 1; i <= 8; i++) if (!blocked(player.x, player.y - i, 0, player.y)) { player.y -= i; break; } }
        player.onGround = hit.y && player.vy >= 0;
        if (!player.onGround && (nearbyWall(-1) || nearbyWall(1)) && player.vy > 40) player.vy = 40;
        if (hit.y && player.vy < 0) player.varJump = 0;
        if (player.onGround) { player.coyote = 0.1; player.squash = 0.12; if (!oldGround) refill(); }
      }
    }
    if (downStrike && hitSpike(player.x, player.y, true)) {}
    else if (!downStrike) hitSpike(player.x, player.y, false);
    touchEntities(input, pressedMelee);
    for (i = 0; i < current.entities.length; i++) if (kinds[current.entities[i].t] && kinds[current.entities[i].t].tick) kinds[current.entities[i].t].tick(current.entities[i], dt);
    if (player.x < -24 || player.y > current.h * TILE + 64) die();
    player.squash = Math.max(0, player.squash - dt); player.stretch = Math.max(0, player.stretch - dt);
    for (i = afterimages.length - 1; i >= 0; i--) { afterimages[i].t -= dt; if (afterimages[i].t <= 0) afterimages.splice(i, 1); }
    return getState();
  }
  function getState() { return { x: player.x, y: player.y, vx: player.vx, vy: player.vy,
    dashes: player.dashes, onGround: player.onGround, stamina: player.stamina, dead: player.dead > 0 }; }
  function respawn() {
    player.x = (current.spawn.x + 0.5) * TILE; player.y = (current.spawn.y + 1) * TILE;
    player.vx = 0; player.vy = 0; player.onGround = false; player.dashes = 1;
  }
  function bake() {
    if (!current || !document.createElement) return;
    baked = document.createElement('canvas'); baked.width = current.w * TILE; baked.height = current.h * TILE;
    var c = baked.getContext('2d'); if (!c) return;
    var colors = current.tileset === 'mountain' ? ['#14202b', '#516d74', '#99b6aa'] : ['#181725', '#51455c', '#b892ff'];
    c.fillStyle = colors[0]; c.fillRect(0, 0, baked.width, baked.height);
    for (var y = 0; y < current.h; y++) for (var x = 0; x < current.w; x++) {
      var ch = cell(x, y), px = x * TILE, py = y * TILE;
      if (ch === '#' || ch === 'x') { c.fillStyle = ch === 'x' ? '#9a4263' : colors[1]; c.fillRect(px, py, TILE, TILE); c.fillStyle = colors[2]; c.fillRect(px, py, TILE, 2); }
      else if (ch === '=') { c.fillStyle = colors[2]; c.fillRect(px, py, TILE, 3); }
      else if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') { c.fillStyle = '#ff5577'; c.fillRect(px + 4, py + 4, 8, 8); }
    }
  }
  function draw() {
    if (!ctx || !current || !live) return;
    var w = canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
    var h = canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0a12'; ctx.fillRect(0, 0, w, h);
    var scale = Math.min(w / 640, h / 360), ox = (w - 640 * scale) / 2, oy = (h - 360 * scale) / 2;
    camera.x = clamp(player.x - 320, 0, Math.max(0, current.w * TILE - 640));
    camera.y = clamp(player.y - 180, 0, Math.max(0, current.h * TILE - 360));
    ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale); ctx.imageSmoothingEnabled = false;
    if (baked) ctx.drawImage(baked, -camera.x, -camera.y);
    var ai;
    if (!reduced) for (ai = 0; ai < afterimages.length; ai++) {
      ctx.globalAlpha = (afterimages[ai].t / 0.12) * 0.28;
      ctx.fillStyle = player.dashes ? '#B892FF' : '#8A8598';
      ctx.fillRect(afterimages[ai].x - camera.x - 12, afterimages[ai].y - camera.y - 32, 24, 32);
    }
    ctx.globalAlpha = 1;
    var i, e;
    for (i = 0; i < current.entities.length; i++) {
      e = current.entities[i]; if (!e.dead) drawEntity(e, ctx, camera.x, camera.y);
    }
    if (player.dead <= 0) drawPlayer(ctx, camera.x, camera.y);
    if (player.dead <= 0 && player.swing > 0) {
      ctx.fillStyle = '#fff0a6'; ctx.globalAlpha = Math.min(1, player.swing / 0.12);
      ctx.fillRect(player.x - camera.x + player.face * 12, player.y - camera.y - 24, player.face * 12, 3);
      ctx.fillRect(player.x - camera.x + player.face * 17, player.y - camera.y - 18, player.face * 3, 8);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function drawEntity(e, c, x, y) {
    var px = e.x * TILE - x, py = e.y * TILE - y;
    c.fillStyle = e.t === 'refill' ? '#64e8ff' : e.t === 'spring' ? '#ffcf4a' : e.t === 'exit' ? '#a9ff8a' : e.t === 'coin' ? '#ffe35a' : e.t === 'checkpoint' ? '#ff8ac8' : '#b892ff';
    if (e.t === 'zip' || e.t === 'crumble' || e.t === 'door') c.fillRect(px, py, 16, 16);
    else { c.fillRect(px + 4, py + 4, 8, 8); }
  }
  function drawPlayer(c, x, y) {
    var px = player.x - x - 12, py = player.y - y - 32;
    var sx = player.squash > 0 ? 1.12 : 1, sy = player.squash > 0 ? 0.88 : 1;
    if (player.stretch > 0 || (player.varJump > 0 && player.vy < 0)) { sx = 0.88; sy = 1.12; }
    c.fillStyle = player.dashes ? '#B892FF' : '#8A8598';
    c.save(); c.translate(px + 12, py + 16); c.scale(sx, sy); c.fillRect(-12, -16, 24, 32); c.restore();
    c.fillStyle = '#f4f0ff'; c.fillRect(px + (player.face > 0 ? 16 : 4), py + 8, 4, 4);
  }
  function open(id, opts) {
    if (!levels[id]) return false;
    if (live) close();
    current = cloneLevel(levels[id]); player = fresh(); opts = opts || {};
    if (opts.spawn) current.spawn = opts.spawn;
    player.x = (current.spawn.x + 0.5) * TILE; player.y = (current.spawn.y + 1) * TILE;
    accumulator = 0; afterimages = []; live = true; paused = false; if (overlay) overlay.hidden = false; bake(); draw();
    if (NEU.kernel) NEU.kernel.push('plat'); return true;
  }
  function cloneLevel(src) {
    var out = {}, k;
    for (k in src) if (Object.prototype.hasOwnProperty.call(src, k) && k !== 'entities') out[k] = src[k];
    out.entities = src.entities.map(function (e) { var v = {}, p; for (p in e) if (Object.prototype.hasOwnProperty.call(e, p)) v[p] = e[p]; return v; });
    return out;
  }
  function close() { if (!live) return; live = false; if (overlay) overlay.hidden = true; if (NEU.kernel && NEU.kernel.current() === 'plat') NEU.kernel.pop(); }
  function tick(dt) {
    if (!live || paused) return;
    accumulator += Math.min(0.25, Math.max(0, dt)) / 1000;
    var n = 0;
    while (accumulator >= STEP && n++ < MAX_STEPS) { step(STEP, keys); accumulator -= STEP; }
    draw();
  }
  function replay(id, recording) {
    var oldLevel = current, oldPlayer = player, oldLive = live, oldPaused = paused;
    var oldAccumulator = accumulator, oldImages = afterimages, oldBaked = baked;
    var oldStack = NEU.kernel ? NEU.kernel.stack.slice() : null;
    if (!open(id)) return { reached: false, deaths: 0, frames: 0 };
    replaying = true;
    var frames = 0, deaths = 0, i, j, pair, state, wasDead = false;
    for (i = 0; i < recording.length; i++) {
      pair = recording[i];
      for (j = 0; j < pair[0]; j++) { state = step(STEP, pair[1]); frames++; if (state.dead && !wasDead) deaths++; wasDead = state.dead; if (current.exited) break; }
      if (current.exited) break;
    }
    var reached = !!current.exited;
    replaying = false;
    live = oldLive; current = oldLevel; player = oldPlayer; paused = oldPaused;
    accumulator = oldAccumulator; afterimages = oldImages; baked = oldBaked;
    if (oldStack && NEU.kernel) { NEU.kernel.stack.length = 0; for (i = 0; i < oldStack.length; i++) NEU.kernel.stack.push(oldStack[i]); }
    if (overlay) overlay.hidden = !live; return { reached: reached, deaths: deaths, frames: frames };
  }
  function getStateSafe() { return live ? getState() : null; }
  function onKey(e) {
    var k = e.key, down = e.type === 'keydown';
    if (!live) return;
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
  kinds.refill = { touch: function (e) { if (!(e.t0 > 0)) { refill(); e.t0 = 2.5; } }, tick: function (e, dt) { if (e.t0 > 0) { e.t0 -= dt; if (e.t0 <= 0) e.t0 = 0; } } };
  kinds.spring = { touch: function (e) { if (player.vy >= 0) { player.vy = -370; player.varJump = 0.2; refill(); e.flash = 0.2; } } };
  kinds.zip = { touch: function (e) { if (!e.go) { e.go = true; e.returning = false; e.wait = 0.2; e.sx = e.x; e.sy = e.y; } }, tick: function (e, dt) { if (!e.go) return; if (e.wait > 0) e.wait -= dt; else { var tx = e.returning ? e.sx : (e.targetX == null ? e.sx : e.targetX), ty = e.returning ? e.sy : (e.targetY == null ? e.sy - 4 : e.targetY); e.x = approach(e.x, tx, dt * 3); e.y = approach(e.y, ty, dt * 3); if (Math.abs(e.x - tx) < 0.05 && Math.abs(e.y - ty) < 0.05) { if (e.returning) e.go = false; else e.returning = true; } } } };
  kinds.crumble = { touch: function (e) { if (!e.breakAt) e.breakAt = 0.4; }, tick: function (e, dt) { if (e.breakAt > 0) { e.breakAt -= dt; if (e.breakAt <= 0) { e.dead = true; e.returnAt = 2; } } else if (e.returnAt > 0) { e.returnAt -= dt; if (e.returnAt <= 0) e.dead = false; } } };
  kinds.pogo = { touch: function (e, input, melee) { if (melee && input.down && player.vy > 0) { player.vy = -280; refill(); e.dead = e.once ? true : e.dead; } } };
  kinds.checkpoint = { touch: function (e) { current.spawn = { x: e.x, y: e.y - 1 }; e.active = true; } };
  kinds.exit = { touch: function () { current.exited = true; if (!replaying && typeof current.onExit === 'function') current.onExit(); } };
  kinds.coin = { touch: function (e) { e.dead = true; if (!replaying && NEU.save && NEU.save.addCoins && !NEU.save.flagged('plat_coin:' + e.id)) { NEU.save.addCoins(1); NEU.save.flag('plat_coin:' + e.id, 1); } } };
  kinds.npc = { touch: function (e, input, melee) { if (melee && NEU.talk) NEU.talk(e.lines || [e.text || '...'], e.who || 'narr'); } };
  kinds.door = { touch: function (e, input, melee) { if (!melee) return; var ok = !e.locked || (NEU.save && (NEU.save.flagged(e.locked) || NEU.save.has(e.locked))); if (ok) { e.dead = true; } else if (NEU.talk) NEU.talk([e.waits || ('It waits for ' + e.locked + '.')], 'narr'); } };
  kinds.barrier = { touch: function () {} };

  var api = { level: level, open: open, close: close, running: function () { return live; },
    get state() { return getStateSafe(); }, step: step, replay: replay,
    get levels() { return levels; }, _kinds: kinds };
  NEU.plat = api;
  if (NEU.kernel) NEU.kernel.register('plat', { tick: tick, open: open, close: close, running: function () { return live; } });
  document.addEventListener('keydown', function (e) {
    if (live && e.key === 'Escape') { paused = true; }
  });
})();
