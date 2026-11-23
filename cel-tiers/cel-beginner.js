/* cel.js: frame-exact kernel for imported mod maps (work order CEL-1, local-only).
   Behavioural port of the public Player.cs (NoelFB/Celeste, educational release) plus Celeste 1.4 crouch dash,
   Monocle Actor movement (integer position + float remainder), and CommunalHelper's dream tunnel (MIT).
   Native units: 8 px tiles, 320x180 camera, 60 fps, float32 arithmetic (Math.fround) to match C# float. */
/* Portions ported from MIT-licensed code:
     Celeste Player.cs, Copyright (c) 2018 Noel Berry (github.com/NoelFB/Celeste)
     CommunalHelper, Copyright (c) 2020 Flynn Swainston-Calcutt (github.com/CommunalHelper/CommunalHelper)
     MaxHelpingHand, Copyright (c) 2019 maddie480 (github.com/maddie480/MaddieHelpingHand)
   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
   documentation files (the "Software"), to deal in the Software without restriction, including without limitation
   the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
   permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright
   notice and this permission notice shall be included in all copies or substantial portions of the Software.
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
   WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
   COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
   OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var f = Math.fround, DT = f(0.0166667);
  var NORMAL = 0, CLIMB = 1, DASH = 2, SWIM = 3, DREAMDASH = 9, INTROWALK = 12, INTRORESPAWN = 14, INTROWAKEUP = 15, CASSETTEFLY = 21, TUNNEL = 30, BOOST = 31;
  var BufferTime = f(0.08), MaxFall = 160, Gravity = 900, HalfGravThreshold = 40, FastMaxFall = 240, FastMaxAccel = 300, MaxRun = 90, RunAccel = 1000,
    RunReduce = 400, AirMult = f(0.65), DuckFriction = 500, DuckCorrectCheck = 4, DuckCorrectSlide = 50, DodgeSlideSpeedMult = f(1.2),
    DuckSuperJumpXMult = f(1.25), DuckSuperJumpYMult = f(0.5), JumpGraceTime = f(0.1), JumpSpeed = -105, JumpHBoost = 40, VarJumpTime = f(0.2),
    CeilingVarJumpGrace = f(0.05), UpwardCornerCorrection = 5, WallSpeedRetentionTime = f(0.06), WallJumpCheckDist = 3, WallJumpForceTime = f(0.16),
    WallJumpHSpeed = 130, WallSlideStartMax = 20, WallSlideTime = f(1.2), BounceVarJumpTime = f(0.2), BounceSpeed = -140, SuperBounceVarJumpTime = f(0.2),
    SuperBounceSpeed = -185, SuperJumpH = 260, SuperWallJumpSpeed = -160, SuperWallJumpVarTime = f(0.25), SuperWallJumpH = 170, DashSpeed = 240,
    EndDashSpeed = 160, EndDashUpMult = f(0.75), DashTime = f(0.15), DashCooldown = f(0.2), DashRefillCooldown = f(0.1), DashHJumpThruNudge = 6,
    DashCornerCorrection = 4, DashVFloorSnapDist = 3, DashAttackTime = f(0.3), ClimbMaxStamina = 110, ClimbUpCost = f(100 / f(2.2)), ClimbStillCost = 10,
    ClimbJumpCost = f(27.5), ClimbCheckDist = 2, ClimbUpCheckDist = 2, ClimbNoMoveTime = f(0.1), ClimbTiredThreshold = 20, ClimbUpSpeed = -45,
    ClimbDownSpeed = 80, ClimbSlipSpeed = 30, ClimbAccel = 900, ClimbGrabYMult = f(0.2), ClimbHopY = -120, ClimbHopX = 100, ClimbHopForceTime = f(0.2),
    ClimbJumpBoostTime = f(0.2), JumpThruAssistSpeed = -40, SwimYSpeedMult = f(0.5), SwimMaxRise = -60, SwimMax = 80, SwimUnderwaterMax = 60,
    SwimAccel = 600, SwimReduce = 400, SwimDashSpeedMult = f(0.75), SideBounceSpeed = 240, SideBounceForceMoveXTime = f(0.3), RespawnTime = f(2.5),
    TransitionDuration = f(0.65), DIAG = f(1 / f(Math.sqrt(2)));
  var HB = { normal: [8, 11, -4, -11], duck: [8, 6, -4, -6], hurt: [8, 9, -4, -11], duckHurt: [8, 4, -4, -6] };
  var DONE = {};
  var FL = NEU.celFlags || {};   // rule-experiment toggles read as FL.name (scripts/cel/variants.mjs); none are live, keep it that way in play

  function sign(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function roundEven(v) { var fl = Math.floor(v), d = v - fl; return d > 0.5 ? fl + 1 : d < 0.5 ? fl : (fl % 2 === 0 ? fl : fl + 1); }
  function approach(v, t, m) { return v > t ? f(Math.max(f(v - m), t)) : f(Math.min(f(v + m), t)); }
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function lerp(a, b, t) { return f(a + f(f(b - a) * t)); }
  var PI = f(Math.PI), PI2 = f(Math.PI / 2);   // Monocle Ease (MathHelper.Pi / PiOver2)
  function sineIn(t) { return f(-f(Math.cos(f(PI2 * t))) + 1); }
  function sineInOut(t) { return f(f(-f(Math.cos(f(PI * t))) / 2) + f(0.5)); }
  function cubeOut(t) { var u = f(1 - t); return f(1 - f(f(u * u) * u)); }
  function aimDir(x, y) { return x && y ? [f(x * DIAG), f(y * DIAG)] : [x, y]; }

  /* ---------- input: Monocle VirtualButton / VirtualIntegerAxis (TakeNewer) ---------- */
  function Btn(nodes, buffer) { this.nodes = nodes; this.buffer = buffer; this.counter = 0; this.down = {}; this.hit = {}; }
  Btn.prototype.update = function (k) {
    var any = false, i, n;
    this.counter = f(this.counter - DT);
    for (i = 0; i < this.nodes.length; i++) {
      n = this.nodes[i]; this.hit[n] = !!k[n] && !this.down[n]; this.down[n] = !!k[n];
      if (this.hit[n]) { this.counter = this.buffer; any = true; } else if (this.down[n]) any = true;
    }
    if (!any) this.counter = 0;
  };
  Btn.prototype.pressed = function () { if (this.counter > 0) return true; for (var i = 0; i < this.nodes.length; i++) if (this.hit[this.nodes[i]]) return true; return false; };
  Btn.prototype.check = function () { for (var i = 0; i < this.nodes.length; i++) if (this.down[this.nodes[i]]) return true; return false; };
  Btn.prototype.consume = function () { this.counter = 0; };
  function Axis(neg, pos) { this.neg = neg; this.pos = pos; this.value = 0; this.turned = false; }
  Axis.prototype.update = function (k) {
    var p = !!k[this.pos], n = !!k[this.neg];
    if (p && n) { if (!this.turned) { this.value *= -1; this.turned = true; } }
    else { this.turned = false; this.value = p ? 1 : n ? -1 : 0; }
  };
  var In = { jump: new Btn(['J', 'K'], BufferTime), dash: new Btn(['X', 'C'], BufferTime), crouch: new Btn(['Z', 'V'], BufferTime),
    grab: new Btn(['G', 'H'], 0), mx: new Axis('L', 'R'), my: new Axis('U', 'D'), ax: new Axis('L', 'R'), ay: new Axis('U', 'D') };
  function inputUpdate(k) { In.jump.update(k); In.dash.update(k); In.crouch.update(k); In.grab.update(k); In.mx.update(k); In.my.update(k); In.ax.update(k); In.ay.update(k); }
  function aimVector(facing) {
    var x = In.ax.value, y = In.ay.value;
    if (!x && !y) return [facing, 0];
    return aimDir(x, y);
  }

  /* ---------- world ---------- */
  var M = null, G = null, room = null, ents = [], solids = [], jts = [], sjts = [], waters = [], pcs = [], trigs = [], p = null;
  var L = { freeze: 0, time: 0, frame: 0, trans: null, cam: { x: 0, y: 0 }, camOffX: 0, camOffY: 0, done: false, deaths: 0, respawn: null, log: null, flags: {}, sw: false };
  function buildGrid() {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, i, r, w, h, cells, row, cx, cy, ch, bx, by;
    for (i = 0; i < M.rooms.length; i++) { r = M.rooms[i]; x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    w = (x1 - x0) / 8; h = (y1 - y0) / 8; cells = new Uint8Array(w * h);
    for (i = 0; i < M.rooms.length; i++) {
      r = M.rooms[i]; bx = (r.x - x0) / 8; by = (r.y - y0) / 8;
      for (cy = 0; cy < r.fg.length && cy < r.h / 8; cy++) { row = r.fg[cy];
        for (cx = 0; cx < row.length && cx < r.w / 8; cx++) { ch = row.charAt(cx); if (ch !== '0' && ch !== ' ') cells[(by + cy) * w + bx + cx] = ch.charCodeAt(0); } }
    }
    G = { ox: x0, oy: y0, w: w, h: h, cells: cells };
  }
  function gridHit(l, t, w, h) {
    var x0 = Math.floor((l - G.ox) / 8), y0 = Math.floor((t - G.oy) / 8), x1 = Math.floor((l + w - 1 - G.ox) / 8), y1 = Math.floor((t + h - 1 - G.oy) / 8), x, y;
    if (x1 < 0 || y1 < 0 || x0 >= G.w || y0 >= G.h) return false;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(G.w - 1, x1); y1 = Math.min(G.h - 1, y1);
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) if (G.cells[y * G.w + x]) return true;
    return false;
  }
  function cellAt(tx, ty) { var x = tx - G.ox / 8, y = ty - G.oy / 8; return x < 0 || y < 0 || x >= G.w || y >= G.h ? 0 : G.cells[y * G.w + x]; }
  function overlap(l, t, w, h, e) { return l < e.x + e.w && l + w > e.x && t + h > e.y && t < e.y + e.h; }
  function rectCircle(l, t, w, h, cx, cy, r) {
    if (cx >= l && cy >= t && cx < l + w && cy < t + h) return true;
    var nx = clamp(cx, l, l + w), ny = clamp(cy, t, t + h), dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }
  var TILE_HIT = { tiles: true };
  var BX = [0, 0, 0, 0];   // scratch: boxAt() is the hot path, so it reuses one array
  function boxAt(x, y, hb) { hb = hb || p.hb; BX[0] = x + hb[2]; BX[1] = y + hb[3]; BX[2] = hb[0]; BX[3] = hb[1]; return BX; }
  function solidFirst(x, y, hb) {
    var b = boxAt(x, y, hb), i, e;
    if (gridHit(b[0], b[1], b[2], b[3])) return TILE_HIT;
    for (i = 0; i < solids.length; i++) { e = solids[i]; if (!e.coll) continue;
      if (e.dream && p && p.st === DREAMDASH) continue;   // DreamBlock: pass through while dream-dashing
      if (overlap(b[0], b[1], b[2], b[3], e)) return e; }
    return null;
  }
  function solidAt(x, y, hb) { return !!solidFirst(x, y, hb); }
  function dreamAt(x, y) { var b = boxAt(x, y), i, e; for (i = 0; i < solids.length; i++) { e = solids[i]; if (e.dream && e.coll && overlap(b[0], b[1], b[2], b[3], e)) return e; } return null; }
  function jtAt(x, y, e) { var b = boxAt(x, y); return overlap(b[0], b[1], b[2], b[3], e); }
  function jtOutside(x, y) { for (var i = 0; i < jts.length; i++) if (jtAt(x, y, jts[i]) && !jtAt(p.x, p.y, jts[i])) return jts[i]; return null; }
  function jtHere() { for (var i = 0; i < jts.length; i++) if (jtAt(p.x, p.y, jts[i])) return jts[i]; return null; }
  function waterFirst(x, y) { var b = boxAt(x, y), i; for (i = 0; i < waters.length; i++) if (overlap(b[0], b[1], b[2], b[3], waters[i])) return waters[i]; return null; }

  /* ---------- player ---------- */
  function freshPlayer(x, y) {
    return { x: x | 0, y: y | 0, rx: 0, ry: 0, sx: 0, sy: 0, hb: HB.normal, hurt: HB.hurt, facing: 1, st: -1, prev: 0, co: { active: false },
      dashes: 1, stamina: ClimbMaxStamina, onGround: false, wasOnGround: false, moveX: 0, jumpGrace: 0, autoJump: false, autoJumpTimer: 0,
      varJumpSpeed: 0, varJumpTimer: 0, forceMoveX: 0, forceMoveXTimer: 0, hopWaitX: 0, hopWaitXSpeed: 0, lastAim: [1, 0], dashCd: 0, dashRefillCd: 0,
      dashDir: [0, 0], wallSlideTimer: WallSlideTime, wallSlideDir: 0, climbNoMove: 0, wallSpeedRetentionTimer: 0, wallSpeedRetained: 0,
      wallBoostDir: 0, wallBoostTimer: 0, maxFall: MaxFall, dashAttack: 0, dashStartedOnGround: false, lastClimbMove: 0, beforeDash: [0, 0],
      demoDashed: false, dreamJump: false, dead: false, deadTimer: 0, tunnelEnd: 0, tunnelSolid: null, startedDashing: false, introTimer: 0,
      liftX: 0, liftY: 0, lastLiftX: 0, lastLiftY: 0, liftTimer: 0, cfB: null, cfC: null, cfE: null, cfLerp: 0 };
  }
  function ducking() { return p.hb === HB.duck; }
  function setDuck(v) { p.hb = v ? HB.duck : HB.normal; p.hurt = v ? HB.duckHurt : HB.hurt; }
  function canUnDuck() { return !ducking() || !solidAt(p.x, p.y, HB.normal); }
  function canUnDuckAt(x, y) { return !ducking() || !solidAt(x, y, HB.normal); }
  function duckFreeAt(x, y) {
    if (solidAt(x, y, HB.duck)) return false;
    if (!sjts.length) return true;
    var was = p.hb; p.hb = HB.duck; var r = !sjtSide(x, y, false, false); p.hb = was; return r;
  }
  function left() { return p.x + p.hb[2]; } function right() { return p.x + p.hb[2] + p.hb[0]; }
  function top() { return p.y + p.hb[3]; } function bottom() { return p.y + p.hb[3] + p.hb[1]; }
  function dashAttacking() { return p.dashAttack > 0; }
  function canDash() { return (In.crouch.pressed() || In.dash.pressed()) && p.dashCd <= 0 && p.dashes > 0; }
  function isTired() { return (p.wallBoostTimer > 0 ? f(p.stamina + ClimbJumpCost) : p.stamina) < ClimbTiredThreshold; }
  function inControl() { return p.st !== INTROWALK && p.st !== INTRORESPAWN && p.st !== INTROWAKEUP; }
  function refillDash() { if (p.dashes < 1) { p.dashes = 1; return true; } return false; }
  function refillStamina() { p.stamina = ClimbMaxStamina; }
  function onGroundAt(x, y) { return solidAt(x, y + 1) || !!jtOutsideFrom(x, y, x, y + 1); }
  function jtOutsideFrom(ox, oy, x, y) { for (var i = 0; i < jts.length; i++) if (jtAt(x, y, jts[i]) && !jtAt(ox, oy, jts[i])) return jts[i]; return null; }

  function moveHExact(n, cb, pusher) {
    var s = sign(n), moved = 0, hit, tx = p.x + n, ty = p.y;
    while (n !== 0) {
      hit = solidFirst(p.x + s, p.y) || sjtBlock(p.x + s, p.y, s);
      if (hit) { p.rx = 0; if (cb) cb({ dx: s, dy: 0, hit: hit, moved: moved, pusher: pusher || null, tx: tx, ty: ty }); return true; }
      moved += s; n -= s; p.x += s;
    }
    return false;
  }
  function moveVExact(n, cb, pusher) {
    var s = sign(n), moved = 0, hit, tx = p.x, ty = p.y + n;
    while (n !== 0) {
      hit = solidFirst(p.x, p.y + s);
      if (!hit && n > 0) hit = jtOutside(p.x, p.y + s);
      if (hit) { p.ry = 0; if (cb) cb({ dx: 0, dy: s, hit: hit, moved: moved, pusher: pusher || null, tx: tx, ty: ty }); return true; }
      moved += s; n -= s; p.y += s;
    }
    return false;
  }
  function moveH(a, cb) { p.rx = f(p.rx + a); var n = roundEven(p.rx); if (n !== 0) { p.rx = f(p.rx - n); return moveHExact(n, cb); } return false; }
  function moveV(a, cb) { p.ry = f(p.ry + a); var n = roundEven(p.ry); if (n !== 0) { p.ry = f(p.ry - n); return moveVExact(n, cb); } return false; }
  function moveTowardsX(tx, m, cb) { var to = approach(f(p.x + p.rx), tx, m); return moveH(f(to - p.x - p.rx), cb); }
  function moveTowardsY(ty, m, cb) { var to = approach(f(p.y + p.ry), ty, m); return moveV(f(to - p.y - p.ry), cb); }
  function naiveMove(ax, ay) {
    p.rx = f(p.rx + ax); p.ry = f(p.ry + ay);
    var nx = roundEven(p.rx), ny = roundEven(p.ry);
    p.x += nx; p.y += ny; p.rx = f(p.rx - nx); p.ry = f(p.ry - ny);
  }

  /* ---------- MaxHelpingHand sideways jump-through (MIT): blocks one horizontal direction ---------- */
  function sjtOutside(x, y) { var i; for (i = 0; i < sjts.length; i++) if (jtAt(x, y, sjts[i]) && !jtAt(p.x, p.y, sjts[i])) return sjts[i]; return null; }
  function sjtBlock(x, y, s) { if (!sjts.length) return null; var j = sjtOutside(x, y); return j && j.allowLR !== (s > 0) ? j : null; }
  function sjtSide(x, y, climb, wj) {   // entityCollideCheckWithSidewaysJumpthrus (player)
    if (!sjts.length || x === p.x) return false;
    var j = sjtOutside(x, y);
    return !!j && j.allowLR === (p.x > x) && (!wj || j.wj) && (!climb || j.climb) && j.y + j.h >= top() + (y - p.y) + 3;
  }
  function solidSide(x, y, climb, wj) { return solidAt(x, y) || sjtSide(x, y, climb, wj); }
  function sjtPoint(x, y) { for (var i = 0; i < sjts.length; i++) { var j = sjts[i]; if (x >= j.x && y >= j.y && x < j.x + j.w && y < j.y + j.h) return true; } return false; }

  /* ---------- Actor lift speed (Monocle Actor.LiftSpeed, 0.16 s grace) ---------- */
  function setLift(x, y) { p.liftX = x; p.liftY = y; if (x !== 0 || y !== 0) { p.lastLiftX = x; p.lastLiftY = y; p.liftTimer = f(0.16); } }
  function liftBoost() {
    var x = p.liftX, y = p.liftY;
    if (x === 0 && y === 0) { x = p.lastLiftX; y = p.lastLiftY; }
    if (Math.abs(x) > 250) x = 250 * sign(x);
    if (y > 0) y = 0; else if (y < -130) y = -130;
    return [x, y];
  }
  function addLift() { var b = liftBoost(); p.sx = f(p.sx + b[0]); p.sy = f(p.sy + b[1]); }

  /* ---------- Monocle Solid movement: riders, pushing, squish, static movers ---------- */
  function ridingSolid(s) {
    if (p.dead || !s.coll) return false;
    var b = p.st === DREAMDASH ? boxAt(p.x, p.y) : p.st === CLIMB ? boxAt(p.x + p.facing, p.y) : boxAt(p.x, p.y + 1);
    return overlap(b[0], b[1], b[2], b[3], s);
  }
  function playerOverlaps(s) { var b = boxAt(p.x, p.y); return overlap(b[0], b[1], b[2], b[3], s); }
  function moveStatics(s, dx, dy) {
    for (var i = 0; i < s.statics.length; i++) { var e = s.statics[i]; e.x += dx; e.y += dy;
      if (e.box) { e.box.x += dx; e.box.y += dy; } if (e.bar) { e.bar.x += dx; e.bar.y += dy; } }
  }
  function solidMoveHExact(s, move) {
    var ride = ridingSolid(s), b, mh;
    if (!p.dead && In.mx.value === sign(move) && sign(p.sx) === sign(move) && !ride) {
      b = boxAt(p.x, p.y);
      if (overlap(b[0], b[1], b[2], b[3], { x: s.x + move, y: s.y - 1, w: s.w, h: s.h })) moveV(1);
    }
    s.x += move; moveStatics(s, move, 0);
    if (!s.coll || p.dead) return;
    if (playerOverlaps(s)) { b = boxAt(p.x, p.y); mh = move <= 0 ? s.x - (b[0] + b[2]) : s.x + s.w - b[0];
      s.coll = false; moveHExact(mh, onSquish, s); setLift(s.liftX, s.liftY); s.coll = true; }
    else if (ride) { s.coll = false; moveHExact(move); setLift(s.liftX, s.liftY); s.coll = true; }
  }
  function solidMoveVExact(s, move) {
    var ride = ridingSolid(s), b, mv;
    s.y += move; moveStatics(s, 0, move);
    if (!s.coll || p.dead) return;
    if (playerOverlaps(s)) { b = boxAt(p.x, p.y); mv = move <= 0 ? s.y - (b[1] + b[3]) : s.y + s.h - b[1];
      s.coll = false; moveVExact(mv, onSquish, s); setLift(s.liftX, s.liftY); s.coll = true; }
    else if (ride) { s.coll = false; moveVExact(move); setLift(s.liftX, s.liftY); s.coll = true; }
  }
  function solidMoveH(s, a) { s.liftX = f(a / DT); s.mrx = f(s.mrx + a); var n = roundEven(s.mrx); if (n !== 0) { s.mrx = f(s.mrx - n); solidMoveHExact(s, n); } }
  function solidMoveV(s, a) { s.liftY = f(a / DT); s.mry = f(s.mry + a); var n = roundEven(s.mry); if (n !== 0) { s.mry = f(s.mry - n); solidMoveVExact(s, n); } }
  function solidMoveTo(s, x, y) { solidMoveH(s, f(x - f(s.x + s.mrx))); solidMoveV(s, f(y - f(s.y + s.mry))); }
  function solidInit(e) { e.coll = true; e.mrx = 0; e.mry = 0; e.liftX = 0; e.liftY = 0; e.statics = []; solids.push(e); }
  function onSquish(d) {   // Player.OnSquish
    var ducked = false, wx, wy;
    if (!ducking()) {
      ducked = true; setDuck(true); d.pusher.coll = true;
      if (!solidAt(p.x, p.y)) { d.pusher.coll = false; return; }
      wx = p.x; wy = p.y; p.x = d.tx; p.y = d.ty;
      if (!solidAt(p.x, p.y)) { d.pusher.coll = false; return; }
      p.x = wx; p.y = wy; d.pusher.coll = false;
    }
    if (!trySquishWiggle(d)) die(); else if (ducked && canUnDuck()) setDuck(false);
  }
  function trySquishWiggle(d) {   // Actor.TrySquishWiggle(data, 3, 3)
    var i, j, a, b;
    d.pusher.coll = true;
    for (i = 0; i <= 3; i++) for (j = 0; j <= 3; j++) {
      if (i === 0 && j === 0) continue;
      for (a = 1; a >= -1; a -= 2) for (b = 1; b >= -1; b -= 2)
        if (!solidAt(p.x + i * a, p.y + j * b)) { p.x += i * a; p.y += j * b; d.pusher.coll = false; return true; }
    }
    d.pusher.coll = false; return false;
  }
  /* Monocle Coroutine on an entity: e.cs = step, e.cw = wait */
  function entCo(e, fn) {
    if (e.cs < 0) return;
    if (e.cw > 0) { e.cw = f(e.cw - DT); return; }
    var r = fn(e);
    if (r === DONE) e.cs = -1; else if (typeof r === 'number') e.cw = f(r);
  }

  /* state machine */
  var UPD = {}, BEGIN = {}, END = {}, CORO = {};
  function setState(s) {
    if (p.st === s) return;
    var prev = p.st; p.prev = prev; p.st = s;
    if (END[prev]) END[prev]();
    if (BEGIN[s]) BEGIN[s]();
    if (p.st !== s) return;   // a begin handler switched again; the nested call already set the coroutine
    p.co = CORO[s] ? { s: s, step: 0, wait: 0, active: true } : { active: false };
  }
  function coUpdate(c) {
    if (!c.active) return;
    if (c.wait > 0) { c.wait = f(c.wait - DT); return; }
    var r = CORO[c.s](c);
    if (p.co !== c) return;
    if (r === DONE) c.active = false; else if (typeof r === 'number') c.wait = r;
  }

  function jump() {
    In.jump.consume(); p.jumpGrace = 0; p.varJumpTimer = VarJumpTime; p.autoJump = false; p.dashAttack = 0; p.wallSlideTimer = WallSlideTime; p.wallBoostTimer = 0;
    p.sx = f(p.sx + f(JumpHBoost * p.moveX)); p.sy = JumpSpeed; addLift(); p.varJumpSpeed = p.sy;
  }
  function superJump() {
    In.jump.consume(); p.jumpGrace = 0; p.varJumpTimer = VarJumpTime; p.autoJump = false; p.dashAttack = 0; p.wallSlideTimer = WallSlideTime; p.wallBoostTimer = 0;
    p.sx = f(SuperJumpH * p.facing); p.sy = JumpSpeed; addLift();
    if (ducking()) { setDuck(false); p.sx = f(p.sx * DuckSuperJumpXMult); p.sy = f(p.sy * DuckSuperJumpYMult); }
    p.varJumpSpeed = p.sy;
  }
  function climbBoundsCheck(d) { return left() + d * ClimbCheckDist >= room.x && right() + d * ClimbCheckDist < room.x + room.w; }
  function wallJumpCheck(d) { return climbBoundsCheck(d) && solidSide(p.x + d * WallJumpCheckDist, p.y, false, true); }
  function climbCheck(d, yAdd) { return climbBoundsCheck(d) && solidSide(p.x + d * ClimbCheckDist, p.y + (yAdd || 0), true, false); }
  function wallJump(d) {
    setDuck(false); In.jump.consume(); p.jumpGrace = 0; p.varJumpTimer = VarJumpTime; p.autoJump = false; p.dashAttack = 0; p.wallSlideTimer = WallSlideTime; p.wallBoostTimer = 0;
    if (p.moveX !== 0) { p.forceMoveX = d; p.forceMoveXTimer = WallJumpForceTime; }
    if (p.liftX === 0 && p.liftY === 0 && p.lastLiftX === 0 && p.lastLiftY === 0) { var wall = solidFirst(p.x + WallJumpCheckDist, p.y); if (wall && wall !== TILE_HIT) setLift(wall.liftX || 0, wall.liftY || 0); }   // Player.cs checks +X only
    p.sx = f(WallJumpHSpeed * d); p.sy = JumpSpeed; addLift(); p.varJumpSpeed = p.sy;
  }
  function superWallJump(d) {
    setDuck(false); In.jump.consume(); p.jumpGrace = 0; p.varJumpTimer = SuperWallJumpVarTime; p.autoJump = false; p.dashAttack = 0; p.wallSlideTimer = WallSlideTime; p.wallBoostTimer = 0;
    p.sx = f(SuperWallJumpH * d); p.sy = SuperWallJumpSpeed; addLift(); p.varJumpSpeed = p.sy;
  }
  function climbJump() {
    if (!p.onGround) p.stamina = f(p.stamina - ClimbJumpCost);
    p.dreamJump = false; jump();
    if (p.moveX === 0) { p.wallBoostDir = -p.facing; p.wallBoostTimer = ClimbJumpBoostTime; }
  }
  function superBounce(fromY) {
    var was = p.hb; p.hb = HB.normal;
    moveV(f(fromY - bottom()));
    refillDash(); refillStamina(); setState(NORMAL);
    p.jumpGrace = 0; p.varJumpTimer = SuperBounceVarJumpTime; p.autoJump = true; p.autoJumpTimer = 0; p.dashAttack = 0; p.wallSlideTimer = WallSlideTime; p.wallBoostTimer = 0;
    p.sx = 0; p.varJumpSpeed = p.sy = SuperBounceSpeed;
    p.hb = was;
  }
  function sideBounce(d, fromX, fromY) {
    if (Math.abs(p.sx) > 240 && sign(p.sx) === d) return false;
    var was = p.hb; p.hb = HB.normal;
    moveV(clamp(f(fromY - bottom()), -4, 4));
    if (d > 0) moveH(f(fromX - left())); else if (d < 0) moveH(f(fromX - right()));
    refillDash(); refillStamina(); setState(NORMAL);
    p.jumpGrace = 0; p.varJumpTimer = BounceVarJumpTime; p.autoJump = true; p.autoJumpTimer = 0; p.dashAttack = 0; p.wallSlideTimer = WallSlideTime;
    p.forceMoveX = d; p.forceMoveXTimer = SideBounceForceMoveXTime; p.wallBoostTimer = 0;
    p.sx = f(SideBounceSpeed * d); p.varJumpSpeed = p.sy = BounceSpeed;
    p.hb = was; return true;
  }
  function useRefill(two) {
    var n = two ? 2 : 1;
    if (p.dashes < n || p.stamina < 20) { p.dashes = n; refillStamina(); return true; }
    return false;
  }
  function die() {
    if (p.dead) return;
    p.dead = true; p.deadTimer = 0; p.sx = p.sy = 0; L.deaths++;
    if (L.log) L.log('death', L.frame, room.name, p.x, p.y);
  }
  function startDash() {
    p.dashes = Math.max(0, p.dashes - 1); p.demoDashed = In.crouch.pressed(); In.dash.consume(); In.crouch.consume();
    return DASH;
  }

  /* collisions */
  function dashCollide(d, dx, dy) {   // Player.OnCollideH/V dash blocks: true when handled
    var r = d.hit.onDash(dx, dy);
    if (r === 'rebound') { rebound(dx ? -sign(p.sx) : 0); return true; }
    if (r === 'bounce') { if (dx) reflectBounce(-sign(p.sx), 0); else reflectBounce(0, -sign(p.sy)); return true; }
    if (r === 'dream') { p.dreamIdx = solids.indexOf(d); setState(DREAMDASH); return true; }
    return r === 'ignore';
  }
  var DreamDashSpeed = 240;   // vanilla Player.DreamDashSpeed
  BEGIN[DREAMDASH] = function () { p.sx = f(p.dashDir[0] * DreamDashSpeed); p.sy = f(p.dashDir[1] * DreamDashSpeed); p.dreamT = 0; p.dreamJump = false; };
  UPD[DREAMDASH] = function () { return DREAMDASH; };
  END[DREAMDASH] = function () { refillDash(); refillStamina(); };
  function rebound(dir) {
    p.sx = f(dir * 120); p.sy = -120; p.varJumpSpeed = p.sy; p.varJumpTimer = f(0.15); p.autoJump = true; p.autoJumpTimer = 0;
    p.dashAttack = 0; p.wallSlideTimer = WallSlideTime; p.wallBoostTimer = 0; p.forceMoveXTimer = 0; setState(NORMAL);
  }
  function reflectBounce(dx, dy) {
    if (dx) p.sx = f(dx * 220); if (dy) p.sy = f(dy * 220);
    p.autoJumpTimer = 0; p.dashAttack = 0; p.wallSlideTimer = WallSlideTime; p.wallBoostTimer = 0; p.forceMoveXTimer = 0; setState(NORMAL);
  }
  function onCollideH(d) {
    if (p.st === DREAMDASH || p.st === TUNNEL) return;
    if (tunnelCheck(sign(p.sx), 0)) return;
    if (dashAttacking() && d && d.hit && d.hit.onDash && d.dx === sign(p.dashDir[0]) && dashCollide(d, d.dx, 0)) return;
    if (p.st === DASH) {
      if (p.onGround && duckFreeAt(p.x + sign(p.sx), p.y)) { setDuck(true); return; }
      if (p.sy === 0 && p.sx !== 0) {
        for (var i = 1; i <= DashCornerCorrection; i++) for (var j = 1; j >= -1; j -= 2)
          if (!solidSide(p.x + sign(p.sx), p.y + i * j, false, false)) { moveVExact(i * j); moveHExact(sign(p.sx)); return; }
      }
    }
    if (p.wallSpeedRetentionTimer <= 0) { p.wallSpeedRetained = p.sx; p.wallSpeedRetentionTimer = WallSpeedRetentionTime; }
    p.sx = 0; p.dashAttack = 0;
  }
  function onCollideV(d) {
    var i;
    if (p.st === SWIM) { p.sy = 0; return; }
    if (p.st === DREAMDASH || p.st === TUNNEL) return;
    if (tunnelCheck(0, sign(p.sy))) return;
    if (d && d.hit && d.hit.onDash && dashAttacking() && d.dy === sign(p.dashDir[1]) && dashCollide(d, 0, d.dy)) return;
    if (p.sy > 0) {
      if (p.st === DASH && !p.dashStartedOnGround) {
        if (p.sx <= 0) for (i = -1; i >= -DashCornerCorrection; i--) if (!onGroundAt(p.x + i, p.y)) { moveHExact(i); moveVExact(1); return; }
        if (p.sx >= 0) for (i = 1; i <= DashCornerCorrection; i++) if (!onGroundAt(p.x + i, p.y)) { moveHExact(i); moveVExact(1); return; }
      }
      if (p.dashDir[0] !== 0 && p.dashDir[1] > 0 && p.sy > 0) {
        p.dashDir = [sign(p.dashDir[0]), 0]; p.sy = 0; p.sx = f(p.sx * DodgeSlideSpeedMult); setDuck(true);
      }
    } else if (p.sy < 0) {
      if (p.sx <= 0) for (i = 1; i <= UpwardCornerCorrection; i++) if (!solidAt(p.x - i, p.y - 1)) { p.x -= i; p.y -= 1; return; }
      if (p.sx >= 0) for (i = 1; i <= UpwardCornerCorrection; i++) if (!solidAt(p.x + i, p.y - 1)) { p.x += i; p.y -= 1; return; }
      if (p.varJumpTimer < f(VarJumpTime - CeilingVarJumpGrace)) p.varJumpTimer = 0;
    }
    p.dashAttack = 0; p.sy = 0;
  }

  /* CommunalHelper dream tunnel dash (default configuration) */
  var DTN = { count: 0, canStart: false, attacking: false, timer: 0 };
  function tunnelCheck(dx, dy) {
    if (!(DTN.attacking && dashAttacking() && (dx === sign(p.dashDir[0]) || dy === sign(p.dashDir[1])))) return false;
    if (left() + dx < room.x || right() + dx > room.x + room.w || top() + dy < room.y || bottom() + dy > room.y + room.h) return false;
    var s = solidFirst(p.x + dx, p.y + dy);
    if (!s) { DTN.attacking = false; return false; }
    setState(TUNNEL); p.tunnelSolid = s; p.dashAttack = 0;
    return true;
  }
  function startTunnelAttack(dirFromCoroutine) {
    if (!DTN.canStart) return;
    DTN.attacking = true; DTN.timer = p.dashAttack;
    var c = dirFromCoroutine || aimVector(p.facing), dx = sign(c[0]), dy = sign(c[1]);
    if (!solidAt(p.x, p.y) && solidAt(p.x + dx, p.y + dy)) {
      if (!dirFromCoroutine) { p.sx = c[0]; p.sy = c[1]; p.dashDir = [c[0], c[1]]; }
      moveHExact(dx, onCollideH); moveVExact(dy, onCollideV);
    }
    DTN.canStart = false;
  }
  BEGIN[TUNNEL] = function () {
    p.startedDashing = false;
    var dx = sign(p.dashDir[0]), dy = sign(p.dashDir[1]), n;
    if (!solidAt(p.x, p.y) && solidAt(p.x + dx, p.y + dy)) naiveMove(dx, dy);
    if (p.dashDir[1] > 0) setDuck(false);
    p.sx = f(p.dashDir[0] * DashSpeed); p.sy = f(p.dashDir[1] * DashSpeed);
    p.tunnelEnd = f(0.1); refillStamina(); p.dreamJump = false;
  };
  END[TUNNEL] = function () {
    if (!p.dreamJump) { p.autoJump = true; p.autoJumpTimer = 0; }
    refillDash(); refillStamina();
    if (p.tunnelSolid) { if (p.dashDir[0] !== 0) { p.jumpGrace = f(0.1); p.dreamJump = true; } else p.jumpGrace = 0; p.tunnelSolid = null; }
  };
  UPD[TUNNEL] = function () {
    naiveMove(f(p.sx * DT), f(p.sy * DT));
    if (p.tunnelEnd > 0) p.tunnelEnd = f(p.tunnelEnd - DT);
    var s = solidFirst(p.x, p.y);
    if (!s) {
      if (p.tunnelEnd <= 0) {
        freeze(0.05);
        if (In.jump.pressed() && p.dashDir[0] !== 0) { p.dreamJump = true; jump(); }
        else if (p.dashDir[1] >= 0 || p.dashDir[0] !== 0) {
          if (p.dashDir[0] > 0 && solidAt(p.x - 5, p.y)) moveHExact(-5);
          else if (p.dashDir[0] < 0 && solidAt(p.x + 5, p.y)) moveHExact(5);
          var l = climbCheck(-1, 0), r = climbCheck(1, 0);
          if (In.grab.check() && ((p.moveX === 1 && r) || (p.moveX === -1 && l))) { p.facing = p.moveX; return CLIMB; }
        }
        return NORMAL;
      }
    } else p.tunnelSolid = s;
    return TUNNEL;
  };

  /* Booster (base-game): constant-speed dash until the timer expires */
  var BoostSpeed = 320;   // vanilla Booster.BoostSpeed
  BEGIN[BOOST] = function () { p.boostT = f(0.3); };
  UPD[BOOST] = function () { return BOOST; };
  END[BOOST] = function () { p.dashAttack = 0; };

  /* Normal */
  BEGIN[NORMAL] = function () { p.maxFall = MaxFall; };
  END[NORMAL] = function () { p.wallBoostTimer = 0; p.wallSpeedRetentionTimer = 0; p.hopWaitX = 0; };
  UPD[NORMAL] = function () {
    var i, mult, max, mf = MaxFall, fmf = FastMaxFall, w, lb = liftBoost();
    if (lb[1] < 0 && p.wasOnGround && !p.onGround && p.sy >= 0) p.sy = lb[1];   // lift boost when walked off a platform
    if (In.grab.check() && !isTired() && !ducking()) {
      if (p.sy >= 0 && sign(p.sx) !== -p.facing) {
        if (climbCheck(p.facing)) { setDuck(false); return CLIMB; }
        if (In.my.value < 1) for (i = 1; i <= ClimbUpCheckDist; i++)
          if (!solidAt(p.x, p.y - i) && climbCheck(p.facing, -i)) { moveVExact(-i); setDuck(false); return CLIMB; }
      }
    }
    if (canDash()) { addLift(); return startDash(); }
    if (ducking()) {
      if (p.onGround && In.my.value !== 1) {
        if (canUnDuck()) setDuck(false);
        else if (p.sx === 0) {
          for (i = DuckCorrectCheck; i > 0; i--) {
            if (canUnDuckAt(p.x + i, p.y)) { moveH(f(DuckCorrectSlide * DT)); break; }
            else if (canUnDuckAt(p.x - i, p.y)) { moveH(f(-DuckCorrectSlide * DT)); break; }
          }
        }
      }
    } else if (p.onGround && In.my.value === 1 && p.sy >= 0) setDuck(true);
    if (ducking() && p.onGround) p.sx = approach(p.sx, 0, f(DuckFriction * DT));
    else {
      mult = p.onGround ? 1 : AirMult; max = MaxRun;
      if (Math.abs(p.sx) > max && sign(p.sx) === p.moveX) p.sx = approach(p.sx, f(max * p.moveX), f(f(RunReduce * mult) * DT));
      else p.sx = approach(p.sx, f(max * p.moveX), f(f(RunAccel * mult) * DT));
    }
    if (In.my.value === 1 && p.sy >= mf) p.maxFall = approach(p.maxFall, fmf, f(FastMaxAccel * DT));
    else p.maxFall = approach(p.maxFall, mf, f(FastMaxAccel * DT));
    if (!p.onGround) {
      max = p.maxFall;
      if ((p.moveX === p.facing || (p.moveX === 0 && In.grab.check())) && In.my.value !== 1) {
        if (p.sy >= 0 && p.wallSlideTimer > 0 && climbBoundsCheck(p.facing) && solidSide(p.x + p.facing, p.y, false, true) && canUnDuck()) { setDuck(false); p.wallSlideDir = p.facing; }
        if (p.wallSlideDir !== 0) max = lerp(MaxFall, WallSlideStartMax, f(p.wallSlideTimer / WallSlideTime));
      }
      mult = (Math.abs(p.sy) < HalfGravThreshold && (In.jump.check() || p.autoJump)) ? f(0.5) : 1;
      p.sy = approach(p.sy, max, f(f(Gravity * mult) * DT));
    }
    if (p.varJumpTimer > 0) { if (p.autoJump || In.jump.check()) p.sy = Math.min(p.sy, p.varJumpSpeed); else p.varJumpTimer = 0; }
    if (In.jump.pressed()) {
      if (p.jumpGrace > 0) jump();
      else if (canUnDuck()) {
        if (wallJumpCheck(1)) {
          if (p.facing === 1 && In.grab.check() && p.stamina > 0) climbJump();
          else if (dashAttacking() && p.dashDir[0] === 0 && p.dashDir[1] === -1) superWallJump(-1);
          else wallJump(-1);
        } else if (wallJumpCheck(-1)) {
          if (p.facing === -1 && In.grab.check() && p.stamina > 0) climbJump();
          else if (dashAttacking() && p.dashDir[0] === 0 && p.dashDir[1] === -1) superWallJump(1);
          else wallJump(1);
        } else if ((w = waterFirst(p.x, p.y + 2))) jump();
      }
    }
    if (p.sx !== 0 && sjtBlock(p.x + sign(p.sx), p.y, sign(p.sx))) p.sx = 0;
    return NORMAL;
  };

  /* Climb */
  BEGIN[CLIMB] = function () {
    p.autoJump = false; p.sx = 0; p.sy = f(p.sy * ClimbGrabYMult); p.wallSlideTimer = WallSlideTime; p.climbNoMove = ClimbNoMoveTime; p.wallBoostTimer = 0; p.lastClimbMove = 0;
    for (var i = 0; i < ClimbCheckDist; i++) if (!solidSide(p.x + p.facing, p.y, true, false)) p.x += p.facing; else break;
  };
  END[CLIMB] = function () { p.wallSpeedRetentionTimer = 0; };
  function climbHop() {
    var s = solidFirst(p.x + p.facing, p.y);
    if (s) { p.hopWaitX = p.facing; p.hopWaitXSpeed = f(p.facing * ClimbHopX); } else { p.hopWaitX = 0; p.sx = f(p.facing * ClimbHopX); }
    p.sy = Math.min(p.sy, ClimbHopY); p.forceMoveX = 0; p.forceMoveXTimer = ClimbHopForceTime;
  }
  function slipCheck(addY) {
    addY = addY || 0;
    var ax = p.facing === 1 ? right() : left() - 1, ay = top() + 4 + addY;
    return !gridPoint(ax, ay) && !gridPoint(ax, ay + (-4 + addY)) && !sjtPoint(ax, ay) && !sjtPoint(ax, ay + (-4 + addY));
  }
  function gridPoint(x, y) {
    var i, e, tx = Math.floor((x - G.ox) / 8), ty = Math.floor((y - G.oy) / 8);
    if (tx >= 0 && ty >= 0 && tx < G.w && ty < G.h && G.cells[ty * G.w + tx]) return true;
    for (i = 0; i < solids.length; i++) { e = solids[i]; if (e.coll && x >= e.x && y >= e.y && x < e.x + e.w && y < e.y + e.h) return true; }
    return false;
  }
  function climbHopBlocked() { return solidAt(p.x, p.y - 6) || (!!sjts.length && !!sjtOutside(p.x + p.facing, p.y)); }
  UPD[CLIMB] = function () {
    var target = 0, trySlip = false;
    p.climbNoMove = f(p.climbNoMove - DT);
    if (p.onGround) p.stamina = ClimbMaxStamina;
    if (In.jump.pressed() && (!ducking() || canUnDuck())) { if (p.moveX === -p.facing) wallJump(-p.facing); else climbJump(); return NORMAL; }
    if (canDash()) { addLift(); return startDash(); }
    if (!In.grab.check()) { addLift(); return NORMAL; }
    if (!solidSide(p.x + p.facing, p.y, true, false)) { if (p.sy < 0) climbHop(); return NORMAL; }
    if (p.climbNoMove <= 0) {
      if (In.my.value === -1) {
        target = ClimbUpSpeed;
        if (solidAt(p.x, p.y - 1) || (climbHopBlocked() && slipCheck(-1))) { if (p.sy < 0) p.sy = 0; target = 0; trySlip = true; }
        else if (slipCheck()) { climbHop(); return NORMAL; }
      } else if (In.my.value === 1) {
        target = ClimbDownSpeed;
        if (p.onGround) { if (p.sy > 0) p.sy = 0; target = 0; }
      } else trySlip = true;
    } else trySlip = true;
    p.lastClimbMove = sign(target);
    if (trySlip && slipCheck()) target = ClimbSlipSpeed;
    p.sy = approach(p.sy, target, f(ClimbAccel * DT));
    if (In.my.value !== 1 && p.sy > 0 && !solidSide(p.x + p.facing, p.y + 1, true, false)) p.sy = 0;
    if (p.climbNoMove <= 0) {
      if (p.lastClimbMove === -1) p.stamina = f(p.stamina - f(ClimbUpCost * DT));
      else if (p.lastClimbMove === 0) p.stamina = f(p.stamina - f(ClimbStillCost * DT));
    }
    if (p.stamina <= 0) { addLift(); return NORMAL; }
    return CLIMB;
  };

  /* Dash */
  BEGIN[DASH] = function () {
    p.dashStartedOnGround = p.onGround;
    freeze(0.05);
    p.dashCd = DashCooldown; p.dashRefillCd = DashRefillCooldown; p.startedDashing = true; p.wallSlideTimer = WallSlideTime;
    p.dashAttack = DashAttackTime; p.beforeDash = [p.sx, p.sy]; p.sx = 0; p.sy = 0; p.dashDir = [0, 0];
    if (!p.onGround && ducking() && canUnDuck()) setDuck(false);
    else if (!ducking() && (p.demoDashed || In.my.value === 1)) setDuck(true);
    if (DTN.count > 0) { DTN.canStart = true; DTN.count--; } else DTN.canStart = false;
    startTunnelAttack(null);
  };
  UPD[DASH] = function () {
    var i, j;
    p.startedDashing = false;
    if (p.dashDir[1] === 0) for (i = 0; i < jts.length; i++) { j = jts[i]; if (jtAt(p.x, p.y, j) && bottom() - j.y <= DashHJumpThruNudge) moveVExact(j.y - bottom()); }
    if (canUnDuck() && In.jump.pressed() && p.jumpGrace > 0) { superJump(); return NORMAL; }
    if (p.dashDir[0] === 0 && p.dashDir[1] === -1) {
      if (In.jump.pressed() && canUnDuck()) { if (wallJumpCheck(1)) { superWallJump(-1); return NORMAL; } else if (wallJumpCheck(-1)) { superWallJump(1); return NORMAL; } }
    } else if (In.jump.pressed() && canUnDuck()) { if (wallJumpCheck(1)) { wallJump(-1); return NORMAL; } else if (wallJumpCheck(-1)) { wallJump(1); return NORMAL; } }
    return DASH;
  };
  CORO[DASH] = function (c) {
    {
      if (c.step === 0) { c.step = 1; return null; }
      if (c.step === 1) {
        c.step = 2;
        var dir = p.lastAim, nx = f(dir[0] * DashSpeed), ny = f(dir[1] * DashSpeed);
        if (sign(p.beforeDash[0]) === sign(nx) && Math.abs(p.beforeDash[0]) > Math.abs(nx)) nx = p.beforeDash[0];
        p.sx = nx; p.sy = ny;
        if (waterFirst(p.x, p.y)) { p.sx = f(p.sx * SwimDashSpeedMult); p.sy = f(p.sy * SwimDashSpeedMult); }
        p.dashDir = [dir[0], dir[1]];
        if (p.dashDir[0] !== 0) p.facing = sign(p.dashDir[0]);
        if (p.onGround && !DTN.attacking && p.dashDir[0] !== 0 && p.dashDir[1] > 0 && p.sy > 0) {
          p.dashDir = [sign(p.dashDir[0]), 0]; p.sy = 0; p.sx = f(p.sx * DodgeSlideSpeedMult); setDuck(true);
        }
        return DashTime;
      }
      p.autoJump = true; p.autoJumpTimer = 0;
      if (p.dashDir[1] <= 0) { p.sx = f(p.dashDir[0] * EndDashSpeed); p.sy = f(p.dashDir[1] * EndDashSpeed); }
      if (p.sy < 0) p.sy = f(p.sy * EndDashUpMult);
      setState(NORMAL);
      return DONE;
    }
  };

  /* Swim */
  function swimCheck() { return !!waterFirst(p.x, p.y - 8) && !!waterFirst(p.x, p.y); }
  function swimUnderwater() { return !!waterFirst(p.x, p.y - 9); }
  BEGIN[SWIM] = function () { if (p.sy > 0) p.sy = f(p.sy * SwimYSpeedMult); p.stamina = ClimbMaxStamina; };
  UPD[SWIM] = function () {
    var under, mv, maxX, maxY = SwimMax;
    if (!swimCheck()) return NORMAL;
    if (canUnDuck()) setDuck(false);
    if (canDash()) { p.demoDashed = In.crouch.pressed(); In.dash.consume(); In.crouch.consume(); return DASH; }
    under = swimUnderwater();
    if (!under && p.sy >= 0 && In.grab.check() && !isTired() && canUnDuck())
      if (sign(p.sx) !== -p.facing && climbCheck(p.facing)) if (!moveVExact(-1)) { setDuck(false); return CLIMB; }
    mv = aimDir(In.ax.value, In.ay.value);
    maxX = under ? SwimUnderwaterMax : SwimMax;
    if (Math.abs(p.sx) > SwimMax && sign(p.sx) === sign(mv[0])) p.sx = approach(p.sx, f(maxX * mv[0]), f(SwimReduce * DT));
    else p.sx = approach(p.sx, f(maxX * mv[0]), f(SwimAccel * DT));
    if (mv[1] === 0 && !waterFirst(p.x, p.y - 18)) p.sy = approach(p.sy, SwimMaxRise, f(SwimAccel * DT));
    else if (mv[1] >= 0 || swimUnderwater()) {
      if (Math.abs(p.sy) > SwimMax && sign(p.sy) === sign(mv[1])) p.sy = approach(p.sy, f(maxY * mv[1]), f(SwimReduce * DT));
      else p.sy = approach(p.sy, f(maxY * mv[1]), f(SwimAccel * DT));
    }
    if (!under && p.moveX !== 0 && solidAt(p.x + p.moveX, p.y) && !solidAt(p.x + p.moveX, p.y - 3)) climbHop();
    if (In.jump.pressed() && !waterFirst(p.x, p.y - 14)) { jump(); return NORMAL; }
    return SWIM;
  };

  /* Cassette fly (PlayerBubbleRegion, Player.StartCassetteFly) */
  UPD[CASSETTEFLY] = function () { return CASSETTEFLY; };
  CORO[CASSETTEFLY] = function (c) {
    var t, r, a, b, q, pt;
    if (c.step === 0) { c.step = 1; return f(0.4); }
    if (c.step === 1) {
      if (p.cfLerp < 1) {
        p.cfLerp = approach(p.cfLerp, 1, f(f(1.6) * DT)); t = sineInOut(p.cfLerp); r = f(1 - t);
        a = f(r * r); b = f(f(2 * r) * t); q = f(t * t);   // SimpleCurve.GetPoint
        p.x = f(f(f(a * p.cfB[0]) + f(b * p.cfC[0])) + f(q * p.cfE[0])); p.y = f(f(f(a * p.cfB[1]) + f(b * p.cfC[1])) + f(q * p.cfE[1]));
        pt = camTargetAt(p.x, p.y); L.cam.x = pt.x; L.cam.y = pt.y; return null;
      }
      p.x = p.cfE[0]; p.y = p.cfE[1]; c.step = 2; return f(0.2);
    }
    setState(NORMAL); return DONE;
  };

  /* Intro walk / respawn */
  CORO[INTROWALK] = function (c) {
    var dir = M.intro === 'WalkInLeft' ? -1 : 1;
    if (c.step === 0) { c.step = 1; c.sx = p.x; c.sy = p.y; p.x = dir > 0 ? room.x - 16 : room.x + room.w + 16; p.facing = dir; return f(0.3); }
    if (c.step === 1) {
      if (Math.abs(p.x - c.sx) > 2 && !solidAt(p.x + p.facing, p.y)) { moveTowardsX(c.sx, f(64 * DT)); return null; }
      p.x = c.sx; p.y = c.sy; c.step = 2; return f(0.2);
    }
    setState(NORMAL); return DONE;
  };
  // shortcut: IntroWakeUpCoroutine is 0.5 s + the wakeUp sprite animation + 0.2 s; the animation length is not public, so the map registry gives it in frames (TAS-fitted)
  UPD[INTROWAKEUP] = function () { if (p.wake > 0) { p.wake--; return INTROWAKEUP; } return NORMAL; };
  BEGIN[INTRORESPAWN] = function () { p.introTimer = f(0.6); };
  UPD[INTRORESPAWN] = function () { p.introTimer = f(p.introTimer - DT); return p.introTimer <= 0 ? NORMAL : INTRORESPAWN; };

  /* ---------- Player.Update ---------- */
  function playerUpdate() {
    var first, w, s, i, e, was, to;
    if (p.dead) { p.deadTimer = f(p.deadTimer + DT); if (p.deadTimer > 1) respawn(); return; }
    if (p.st === DREAMDASH || p.st === TUNNEL || p.st === BOOST) p.onGround = false;
    else if (p.sy >= 0) p.onGround = solidAt(p.x, p.y + 1) || !!jtOutside(p.x, p.y + 1);
    else p.onGround = false;
    if (p.wallSlideDir !== 0) { p.wallSlideTimer = Math.max(f(p.wallSlideTimer - DT), 0); p.wallSlideDir = 0; }
    if (p.wallBoostTimer > 0) {
      p.wallBoostTimer = f(p.wallBoostTimer - DT);
      if (p.moveX === p.wallBoostDir) { p.sx = f(WallJumpHSpeed * p.moveX); p.stamina = f(p.stamina + ClimbJumpCost); p.wallBoostTimer = 0; }
    }
    if (p.onGround && p.st !== CLIMB) { p.autoJump = false; p.stamina = ClimbMaxStamina; p.wallSlideTimer = WallSlideTime; }
    if (p.dashAttack > 0) p.dashAttack = f(p.dashAttack - DT);
    if (p.onGround) { p.dreamJump = false; p.jumpGrace = JumpGraceTime; } else if (p.jumpGrace > 0) p.jumpGrace = f(p.jumpGrace - DT);
    if (p.dashCd > 0) p.dashCd = f(p.dashCd - DT);
    if (p.dashRefillCd > 0) p.dashRefillCd = f(p.dashRefillCd - DT);
    else if (p.st === SWIM) refillDash();
    else if (p.onGround && (solidAt(p.x, p.y + 1) || jtOutside(p.x, p.y + 1))) refillDash();
    if (p.varJumpTimer > 0) p.varJumpTimer = f(p.varJumpTimer - DT);
    if (p.autoJumpTimer > 0) { if (p.autoJump) { p.autoJumpTimer = f(p.autoJumpTimer - DT); if (p.autoJumpTimer <= 0) p.autoJump = false; } else p.autoJumpTimer = 0; }
    if (p.forceMoveXTimer > 0) { p.forceMoveXTimer = f(p.forceMoveXTimer - DT); p.moveX = p.forceMoveX; } else p.moveX = In.mx.value;
    if (p.moveX !== 0 && inControl() && p.st !== CLIMB) p.facing = p.moveX;
    p.lastAim = aimVector(p.facing);
    if (p.wallSpeedRetentionTimer > 0) {
      if (sign(p.sx) === -sign(p.wallSpeedRetained)) p.wallSpeedRetentionTimer = 0;
      else if (!solidAt(p.x + sign(p.wallSpeedRetained), p.y)) { p.sx = p.wallSpeedRetained; p.wallSpeedRetentionTimer = 0; }
      else p.wallSpeedRetentionTimer = f(p.wallSpeedRetentionTimer - DT);
    }
    if (p.hopWaitX !== 0) {
      if (sign(p.sx) === -p.hopWaitX || p.sy > 0) p.hopWaitX = 0;
      else if (!solidAt(p.x + p.hopWaitX, p.y)) { p.sx = p.hopWaitXSpeed; p.hopWaitX = 0; }
    }
    /* base.Update: the state machine and its coroutine */
    if (UPD[p.st]) setState(UPD[p.st]());
    if (p.co.active) coUpdate(p.co);
    p.liftX = 0; p.liftY = 0; if (p.liftTimer > 0) { p.liftTimer = f(p.liftTimer - DT); if (p.liftTimer <= 0) { p.lastLiftX = 0; p.lastLiftY = 0; } }   // Actor.Update
    if (!p.onGround && p.sy <= 0 && (p.st !== CLIMB || p.lastClimbMove === -1) && jtHere()) moveV(f(JumpThruAssistSpeed * DT));
    if (!p.onGround && dashAttacking() && p.dashDir[1] === 0) {
      if (solidAt(p.x, p.y + DashVFloorSnapDist) || jtOutside(p.x, p.y + DashVFloorSnapDist)) moveVExact(DashVFloorSnapDist);
    }
    if (p.sy > 0 && canUnDuck() && !p.onGround) setDuck(false);
    if (p.st !== DREAMDASH && p.st !== TUNNEL && p.st !== BOOST) moveH(f(p.sx * DT), onCollideH);
    if (p.st !== DREAMDASH && p.st !== TUNNEL && p.st !== BOOST) moveV(f(p.sy * DT), onCollideV);
    if (p.st === DREAMDASH) {
      naiveMove(f(p.sx * DT), f(p.sy * DT));
      if (dreamAt(p.x, p.y)) p.dreamT = 0; else {
        p.dreamT = f(p.dreamT + DT);
        if (p.dreamT > f(0.1)) {
          var db = solids[p.dreamIdx];
          if (db && db.one) { db.coll = false; db.gone = true; }
          freeze(f(0.05));
          if (In.jump.pressed() && p.dashDir[0] !== 0) { p.dreamJump = true; jump(); }
          setState(NORMAL);
        }
      }
    } else if (p.st === BOOST) {
      naiveMove(f(p.sx * DT), f(p.sy * DT));
      p.boostT = f(p.boostT - DT);
      if (p.boostT <= 0) setState(NORMAL);
    }
    if (p.st === SWIM) {
      if (p.sy < 0 && p.sy >= SwimMaxRise) while (!swimCheck()) { p.sy = 0; if (moveVExact(1)) break; }
    } else if (p.st === NORMAL && swimCheck()) setState(SWIM);
    else if (p.st === CLIMB && swimCheck()) {
      w = waterFirst(p.x, p.y);
      if (w && p.y + p.hb[3] + p.hb[1] / 2 < w.y + w.h / 2) { while (swimCheck()) if (moveVExact(-1)) break; if (swimCheck()) setState(SWIM); }
      else setState(SWIM);
    }
    triggers();
    if (inControl()) cameraFollow();
    if (!p.dead && p.st !== CASSETTEFLY) {
      was = p.hb; p.hb = p.hurt;
      for (i = 0; i < pcs.length; i++) { e = pcs[i]; if (e.coll && e.hit(e)) { e.touch(e); if (p.dead) { p.hb = was; return; } } }
      if (p.hb === p.hurt) p.hb = was;
    }
    if (inControl() && !p.dead && p.st !== DREAMDASH) enforceBounds();
    p.wasOnGround = p.onGround;
    /* CommunalHelper Player.Update hook */
    if (p.dashAttack < DTN.timer) DTN.timer = p.dashAttack; else if (DTN.timer > 0) DTN.timer = f(DTN.timer - DT);
    if (DTN.timer <= 0) DTN.attacking = false;
  }
  function hurtHit(e) { var b = boxAt(p.x, p.y); return overlap(b[0], b[1], b[2], b[3], e); }

  /* ---------- level ---------- */
  function freeze(t) { if (L.freeze < t) L.freeze = f(t); }
  function roomAt(x, y) { for (var i = 0; i < M.rooms.length; i++) { var r = M.rooms[i]; if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r; } return null; }
  function canTransitionTo(x, y) { var r = roomAt(x, y); return r && r !== room ? r : null; }
  function enforceBounds() {
    var cx = p.x, cy = p.y + p.hb[3] + p.hb[1] / 2, r;
    if (L.trans) return;
    if (p.st === TUNNEL && (right() > room.x + room.w || left() < room.x || top() < room.y || bottom() > room.y + room.h)) { die(); return; }
    if (left() < room.x) { if ((r = canTransitionTo(cx - 8, cy))) { next(r, -1, 0); return; } p.x = room.x - p.hb[2]; p.sx = 0; }
    if (right() > room.x + room.w) { if ((r = canTransitionTo(cx + 8, cy))) { next(r, 1, 0); return; } p.x = room.x + room.w - p.hb[2] - p.hb[0]; p.sx = 0; }
    if (cy < room.y) {
      if ((r = canTransitionTo(cx, cy - 12))) { beforeUp(); next(r, 0, -1); return; }
      if (top() < room.y - 24) { p.y = room.y - 24 - p.hb[3]; p.sy = 0; }
    } else if (bottom() > room.y + room.h && room.down && (r = canTransitionTo(cx, cy + 12))) {
      if (!solidAt(p.x, p.y + 4)) { beforeDown(); next(r, 0, 1); }
    } else if (top() > room.y + room.h + 4) die();
  }
  function beforeUp() {
    p.sx = 0; setState(NORMAL); p.varJumpSpeed = p.sy = JumpSpeed;
    p.autoJump = true; p.autoJumpTimer = 0; p.varJumpTimer = VarJumpTime; p.dashCd = f(0.2);
  }
  function beforeDown() { setState(NORMAL); p.sy = Math.max(0, p.sy); p.autoJump = false; p.varJumpTimer = 0; }
  function inBounds(r, x, y, px, py) {
    return x >= r.x + Math.max(px, 0) && y >= r.y + Math.max(py, 0) && x <= r.x + r.w - Math.max(-px, 0) && y <= r.y + r.h - Math.max(-py, 0);
  }
  function next(r, dx, dy) {
    var padX = dx * 4, padY = dy === 1 ? 12 : dy * 4, tx = p.x, ty = p.y;
    if (L.log) L.log('exit', L.frame, room.name, '->', r.name, p.x, p.y, p.sx, p.sy);
    loadRoom(r);
    while (dx !== 0 && ty >= r.y + r.h) ty -= 1;
    while (!inBounds(r, tx, ty, padX, padY)) { tx += dx; ty += dy; }
    L.trans = { tx: tx, ty: ty, at: 0, from: { x: L.cam.x, y: L.cam.y }, to: camTargetAt(tx, ty), step: 0 };
  }
  function transitionStep() {
    var t = L.trans, done;
    if (t.step > 0) {
      t.at = approach(t.at, 1, f(DT / TransitionDuration));
      if (t.at > f(0.9)) { L.cam.x = t.to.x; L.cam.y = t.to.y; }
      else { var e = f(1 - Math.pow(1 - t.at, 3)); L.cam.x = lerp(t.from.x, t.to.x, e); L.cam.y = lerp(t.from.y, t.to.y, e); }
    }
    t.step++;
    if (p.st === TUNNEL) { naiveTowards(t.tx, t.ty); done = p.x === t.tx && p.y === t.ty; }
    else { moveTowardsX(t.tx, f(60 * DT)); moveTowardsY(t.ty, f(60 * DT)); done = p.x === t.tx && p.y === t.ty; }
    if (done) { p.rx = 0; p.ry = 0; p.sx = roundEven(p.sx); p.sy = roundEven(p.sy); }
    if (done && t.at >= 1) {
      L.trans = null;
      p.wallSlideTimer = WallSlideTime; p.jumpGrace = 0; p.forceMoveXTimer = 0; refillDash(); refillStamina();
      if (L.log) L.log('enter', L.frame, room.name, p.x, p.y, p.sx, p.sy);
    }
  }
  function naiveTowards(tx, ty) {
    var toX = approach(f(p.x + p.rx), tx, f(60 * DT)); naiveMove(f(toX - p.x - p.rx), 0);
    var toY = approach(f(p.y + p.ry), ty, f(60 * DT)); naiveMove(0, f(toY - p.y - p.ry));
  }
  function camTargetAt(x, y) {
    var tx = f(x - 160 + L.camOffX), ty = f(y - 90 + L.camOffY);
    return { x: clamp(tx, room.x, room.x + room.w - 320), y: clamp(ty, room.y, room.y + room.h - 180) };
  }
  function cameraFollow() {
    var t = camTargetAt(p.x, p.y), k = f(1 - f(Math.pow(0.01, DT)));
    L.cam.x = f(L.cam.x + f(f(t.x - L.cam.x) * k)); L.cam.y = f(L.cam.y + f(f(t.y - L.cam.y) * k));
  }
  function triggers() {
    var b = boxAt(p.x, p.y), i, t;
    for (i = 0; i < trigs.length; i++) {
      t = trigs[i];
      if (overlap(b[0], b[1], b[2], b[3], t)) {
        if (!t.inside) { t.inside = true; if (t.t === 'cameraOffsetTrigger') { L.camOffX = f(+t.a.cameraX * 48); L.camOffY = f(+t.a.cameraY * 32); }
          if (t.t === 'changeRespawnTrigger') L.respawn = nearestSpawn(t.x + t.w / 2, t.y + t.h / 2); }
      } else t.inside = false;
    }
  }
  function nearestSpawn(x, y) {
    var best = null, d = 1e18, i, s, dd;
    for (i = 0; i < room.spawns.length; i++) { s = room.spawns[i]; dd = (s[0] - x) * (s[0] - x) + (s[1] - y) * (s[1] - y); if (dd < d) { d = dd; best = s; } }
    return best || [p.x, p.y];
  }

  /* entities */
  var KIND = {

    zipMover: function (e) { solidInit(e); e.x0 = e.x; e.y0 = e.y; e.cs = 0; e.cw = 0; e.at = 0;
      e.update = function () { entCo(e, zipSeq); e.liftX = 0; e.liftY = 0; }; },
    switchGate: function (e) { solidInit(e); e.x0 = e.x; e.y0 = e.y; e.cs = 0; e.cw = 0; e.rate = 0; e.tw = null; e.left = 0;
      if (e.flag && L.flags[e.flag]) { e.x = e.nx; e.y = e.ny; e.cs = -1; }   // MHH FlagSwitchGate: flag already set on load
      e.update = function () { entCo(e, gateSeq); if (e.tw) gateTween(e); e.liftX = 0; e.liftY = 0; }; },
    touchSwitch: function (e) { e.coll = true; e.box = { x: e.x - 15, y: e.y - 15, w: 30, h: 30 };   // PlayerCollider Hitbox(30, 30, -15, -15)
      e.on = !!(e.flag && e.persistent && L.flags[e.flag] === !e.inverted);
      e.hit = function () { return hurtHit(e.box); };
      e.touch = function () { if (!e.on) { e.on = true; switchFinishCheck(e.flag, e.inverted); } }; pcs.push(e); },
    dashBlock: function (e) { solidInit(e);
      e.onDash = function () { if (!e.canDash) return 'normal'; e.coll = false; e.broken = true;
        for (var i = 0; i < e.statics.length; i++) { e.statics[i].coll = false; e.statics[i].gone = true; } return 'rebound'; }; },
    sideJT: function (e) { e.w = 5; if (e.allowLR) e.x += 3; sjts.push(e); },
    bubbleRegion: function (e) { e.coll = true; e.hit = function () { return hurtHit(e); };
      e.touch = function () { if (!p.dead && p.st !== CASSETTEFLY) { setState(CASSETTEFLY); p.cfB = [p.x, p.y]; p.cfE = e.end; p.cfC = e.ctrl; p.cfLerp = 0; p.sx = 0; p.sy = 0; } }; pcs.push(e); },
    spinner: function (e) { e.r = 6; e.vis = false; e.coll = false; e.bar = { x: e.x - 8, y: e.y - 3, w: 16, h: 4 };
      e.hit = function () { var b = boxAt(p.x, p.y); return rectCircle(b[0], b[1], b[2], b[3], e.x, e.y, 6) || overlap(b[0], b[1], b[2], b[3], e.bar); };
      e.touch = function () { die(); };
      e.update = function () {
        if (!e.vis) { e.coll = false; if (e.x > L.cam.x - 16 && e.y > L.cam.y - 16 && e.x < L.cam.x + 336 && e.y < L.cam.y + 196) e.vis = true; }
        else e.coll = Math.abs(p.x - e.x) < 128 && Math.abs(p.y - e.y) < 128;   // shortcut: game re-checks every 0.05 s at a per-spinner random offset; checked every frame here
      }; pcs.push(e); },
    refill: function (e) { refillLike(e, function () { return useRefill(e.two); }); },
    dreamRefill: function (e) { refillLike(e, function () {
      if (!(p.stamina < 20 || DTN.count < 1)) return false;
      refillDash(); refillStamina(); DTN.count = 1; return true; }); },
    spring: function (e) {
      e.coll = true;
      var hb = e.o === 'F' ? [16, 6, -8, -6] : e.o === 'L' ? [6, 16, 0, -8] : [6, 16, -6, -8];
      e.box = { x: e.x + hb[2], y: e.y + hb[3], w: hb[0], h: hb[1] };
      e.hit = function () { return hurtHit(e.box); };
      e.touch = function () {
        if (p.st === DREAMDASH || p.st === TUNNEL || !e.use) return;
        if (e.o === 'F') { if (p.sy >= 0) { superBounce(e.box.y); e.flash = 0.25; } }
        else if (e.o === 'L') { if (sideBounce(1, e.box.x + e.box.w, e.box.y + e.box.h / 2)) e.flash = 0.25; }
        else if (sideBounce(-1, e.box.x, e.box.y + e.box.h / 2)) e.flash = 0.25;
      }; pcs.push(e); },
    jumpThru: function (e) { e.h = 5; e.coll = true; jts.push(e); },
    water: function (e) { waters.push(e); },
    exitBlock: function (e) { e.coll = true; solids.push(e); if (hurtHit(e) || overlapPlayerBody(e)) e.coll = false;
      e.update = function () { if (!e.coll && !overlapPlayerBody(e)) e.coll = true; }; },
    barrier: function (e) { e.coll = true; solids.push(e); },
    spikes: function (e) {
      var d = e.d, s = d === 'U' || d === 'D' ? e.w : e.h;
      e.box = d === 'U' ? { x: e.x, y: e.y - 3, w: s, h: 3 } : d === 'D' ? { x: e.x, y: e.y, w: s, h: 3 } : d === 'L' ? { x: e.x - 3, y: e.y, w: 3, h: s } : { x: e.x, y: e.y, w: 3, h: s };
      e.coll = true; e.hit = function () { return hurtHit(e.box); };
      e.touch = function () { if ((d === 'U' && p.sy >= 0 && bottom() <= e.box.y + e.box.h) || (d === 'D' && p.sy <= 0) || (d === 'L' && p.sx >= 0) || (d === 'R' && p.sx <= 0)) die(); };
      pcs.push(e); },
    killbox: function (e) { e.box = { x: e.x, y: e.y, w: e.w, h: 32 }; e.coll = true; e.hit = function () { return hurtHit(e.box); }; e.touch = function () { die(); }; pcs.push(e); },
    heart: function (e) { e.coll = true; e.box = { x: e.x - 8, y: e.y - 8, w: 16, h: 16 }; e.hit = function () { return hurtHit(e.box); };
      e.touch = function () { if (dashAttacking()) { e.coll = false; L.done = true; if (L.log) L.log('heart', L.frame); } }; pcs.push(e); },
    berry: function (e) { e.coll = true; e.box = { x: e.x - 7, y: e.y - 7, w: 14, h: 14 }; e.hit = function () { return hurtHit(e.box); };
      e.touch = function () { if (inBlockField()) return; e.coll = false; e.got = true; }; pcs.push(e); },

    /* ---- Spring Collab 2020: base-game entities ---- */
    dreamBlock: function (e) { solidInit(e); e.dream = true; e.hit = { onDash: function () { return 'dream'; } }; },
    blockField: function (e) { e.coll = true; e.box = { x: e.x, y: e.y, w: e.w, h: e.h }; },   // Strawberry Blockfield region; checked by inBlockField()
    swapBlock: function (e) { solidInit(e); e.x0 = e.x; e.y0 = e.y; e.cs = 0; e.at = 0; e.tw = null;
      e.update = function () { entCo(e, swapSeq); if (e.tw) tweenSolid(e, 0.4, false); e.liftX = 0; e.liftY = 0; }; },
    booster: function (e) { e.coll = true; e.box = { x: e.x - 8, y: e.y - 8, w: 16, h: 16 }; e.hit = function () { return hurtHit(e.box); };
      e.touch = function () { if (!dashAttacking() || !e.coll) return;
        var d = p.lastAim; p.sx = f(d[0] * BoostSpeed); p.sy = f(d[1] * BoostSpeed);
        if (p.dashDir[0] !== 0) p.facing = sign(p.dashDir[0]); setState(BOOST);
        if (e.red) { e.coll = false; e.gone = true; } }; pcs.push(e); },
    dashSwitch: function (e) { solidInit(e); e.on = false;
      e.hit = { onDash: function () { if (!e.on) { e.on = true; L.swN = (L.swN || 0) + 1; } return 'rebound'; } }; },
    seeker: function (e) { e.coll = true; e.box = { x: e.x - 6, y: e.y - 6, w: 12, h: 12 };
      e.hit = function () { var b = boxAt(p.x, p.y); return rectCircle(b[0], b[1], b[2], b[3], e.x, e.y, 6); };
      e.touch = function () { die(); };
      e.x0 = e.x; e.y0 = e.y; e.sx = 0; e.sy = 0; e.phase = 0; e.locked = false; e.dir = 1;
      if (!e.nx && !e.ny) { e.nx = e.x + 32; e.ny = e.y; }
      e.update = function () { seekerUpdate(e); }; pcs.push(e); },
    seekerBarrier: function (e) { e.coll = true; e.barrier = true; },   // blocks seekers only, not the player
    templeGate: function (e) { solidInit(e); e.y0 = e.y; e.cs = 0; e.at = 0; e.open = false;
      e.update = function () { entCo(e, gateSeqTemple); }; },
    templeCrackedBlock: function (e) { solidInit(e);
      e.hit = { onDash: function () { e.coll = false; e.gone = true; return 'ignore'; } }; },
    trackSpinner: function (e) { e.coll = true; e.box = { x: e.x - 6, y: e.y - 6, w: 12, h: 12 };
      e.hit = function () { var b = boxAt(p.x, p.y); return rectCircle(b[0], b[1], b[2], b[3], e.x, e.y, 6); };
      e.touch = function () { die(); };
      e.x0 = e.x; e.y0 = e.y; e.at = 0; e.dir = 1;
      e.spd = e.speed === 'Fast' ? 80 : e.speed === 'Slow' ? 30 : 50;
      e.update = function () { spinnerTrack(e); }; pcs.push(e); },
    rotateSpinner: function (e) { e.coll = true; e.box = { x: e.x - 6, y: e.y - 6, w: 12, h: 12 };
      e.hit = function () { var b = boxAt(p.x, p.y); return rectCircle(b[0], b[1], b[2], b[3], e.x, e.y, 6); };
      e.touch = function () { die(); };
      e.ang = Math.atan2(e.y - e.cy, e.x - e.cx); e.rad = Math.sqrt((e.x - e.cx) * (e.x - e.cx) + (e.y - e.cy) * (e.y - e.cy));
      e.update = function () { e.ang = f(e.ang + DT * (e.clockwise ? 1.5 : -1.5)); e.x = f(e.cx + e.rad * Math.cos(e.ang)); e.y = f(e.cy + e.rad * Math.sin(e.ang)); }; pcs.push(e); },
    fakeWall: function (e) { solidInit(e);
      e.hit = { onDash: function () { e.coll = false; e.gone = true; return 'ignore'; } }; },
    lockBlock: function (e) { solidInit(e); e.open = false; e.box = { x: e.x, y: e.y, w: 16, h: 16 };
      e.update = function () { if (e.open && e.coll) { e.coll = false; e.gone = true; } }; },
    key: function (e) { e.coll = true; e.box = { x: e.x - 5, y: e.y - 7, w: 10, h: 14 };
      e.hit = function () { return hurtHit(e.box); };
      e.car = false; e.touch = function () { if (!e.coll || e.car) return; e.car = true; };
      e.update = function () { if (!e.car) return;
        e.x = p.x; e.y = f(p.y - 12);
        for (var i = 0; i < ents.length; i++) if (ents[i].t === 'lockBlock' && !ents[i].open && overlap(e.x - 5, e.y - 7, 10, 14, ents[i])) {
          ents[i].open = true; e.car = false; e.coll = false; e.gone = true; } }; pcs.push(e); }
  };

  /* ---- base-game entity helpers (Spring Collab maps) ---- */
  function inBlockField() {
    var i, e, b = boxAt(p.x, p.y);
    for (i = 0; i < ents.length; i++) { e = ents[i]; if (e.t !== 'blockField') continue;
      if (overlap(b[0], b[1], b[2], b[3], e.box || e)) return true; }
    return false;
  }
  function tweenSolid(e, dur) {
    var t = e.tw, pc, k;
    if (t.fresh) { t.fresh = false; return; }
    t.left = f(t.left - DT); pc = f(1 - f(Math.max(0, t.left) / f(dur))); k = sineInOut(pc);
    if (e.dir > 0) solidMoveTo(e, lerp(e.x0, e.nx, k), lerp(e.y0, e.ny, k));
    else solidMoveTo(e, lerp(e.nx, e.x0, k), lerp(e.ny, e.y0, k));
    if (t.left <= 0) e.tw = null;
  }
  function swapSeq(e) {   // vanilla SwapBlock: swap between start and node on touch
    switch (e.cs) {
      case 0: if (!overlapPlayerBody(e)) return null; e.dir = 1; e.cs = 1; return null;
      case 1: e.tw = { left: f(0.4), fresh: true }; e.cs = 2; return f(0.45);
      case 2: e.tw = null; e.cs = 3; return null;
      case 3: if (!overlapPlayerBody(e)) return null; e.dir = -1; e.cs = 4; return null;
      case 4: e.tw = { left: f(0.4), fresh: true }; e.cs = 5; return f(0.45);
      case 5: e.tw = null; e.cs = 0; return null;
    }
    return null;
  }
  function seekerUpdate(e) {
    var tx, ty, dx, dy, d, sp, vx, vy, nx, ny, i, o;
    if (!e.locked && Math.abs(p.x - e.x) < 120 && Math.abs(p.y - e.y) < 120) e.locked = true;
    if (e.locked) { tx = p.x; ty = f(p.y - 4); sp = f(40 + Math.min(160, e.phase)); }
    else { tx = e.dir > 0 ? e.nx : e.x0; ty = e.dir > 0 ? e.ny : e.y0; sp = 40; }
    dx = f(tx - e.x); dy = f(ty - e.y); d = Math.sqrt(dx * dx + dy * dy) || 1;
    vx = f(f(dx / d) * sp); vy = f(f(dy / d) * sp); nx = f(e.x + vx); ny = f(e.y + vy);
    for (i = 0; i < ents.length; i++) { o = ents[i]; if (o.t !== 'seekerBarrier') continue;
      if (overlap(f(nx - 6), f(ny - 6), 12, 12, o)) { e.locked = false; e.dir = -e.dir; vx = -vx; vy = -vy; nx = f(e.x + vx); ny = f(e.y + vy); break; } }
    e.x = nx; e.y = ny;
    if (e.locked) e.phase = f(e.phase + f(200 * DT)); else e.phase = 0;
    if (!e.locked && Math.abs(e.x - (e.dir > 0 ? e.nx : e.x0)) < 4 && Math.abs(e.y - (e.dir > 0 ? e.ny : e.y0)) < 4) e.dir = -e.dir;
  }
  function spinnerTrack(e) {
    var dx = f(e.nx - e.x0), dy = f(e.ny - e.y0), len = Math.sqrt(dx * dx + dy * dy) || 1;
    e.at = f(e.at + f(f(e.spd * DT) / len) * e.dir);
    if (e.at > 1) { e.at = f(2 - e.at); e.dir = -1; }
    if (e.at < 0) { e.at = -e.at; e.dir = 1; }
    e.x = f(e.x0 + dx * e.at); e.y = f(e.y0 + dy * e.at);
  }
  function gateSeqTemple(e) {   // vanilla TempleGate: slides up when its switch group is on
    if (!e.open && (L.swN || 0)) { e.open = true; e.cs = 1; }
    if (!e.open || e.cs < 0) return null;
    e.at = f(e.at + f(DT / f(0.4))); if (e.at > 1) e.at = 1;
    solidMoveTo(e, e.x, f(e.y0 - e.h * e.at));
    if (e.at >= 1) e.cs = -1;
    return null;
  }
  function zipSeq(e) {   // vanilla ZipMover.Sequence
    var t;
    switch (e.cs) {
      case 0: if (!ridingSolid(e)) return null; e.cs = 1; return f(0.1);
      case 1: e.at = 0; e.cs = 2; return null;
      case 2: e.at = approach(e.at, 1, f(2 * DT)); t = sineIn(e.at); solidMoveTo(e, lerp(e.x0, e.nx, t), lerp(e.y0, e.ny, t));
        if (e.at < 1) return null; e.cs = 3; return f(0.5);
      case 3: e.at = 0; e.cs = 4; return null;
      case 4: e.at = approach(e.at, 1, f(0.5 * DT)); t = sineIn(e.at); solidMoveTo(e, lerp(e.nx, e.x0, t), lerp(e.ny, e.y0, t));
        if (e.at < 1) return null; e.cs = 0; return f(0.5);
    }
    return null;
  }
  function gateOn(e) { return e.flag ? L.flags[e.flag] === !e.inverted : L.sw; }
  function gateSeq(e) {   // vanilla SwitchGate.Sequence / MaxHelpingHand FlagSwitchGate.moveSequence (MIT)
    switch (e.cs) {
      case 0: if (!gateOn(e)) return null; e.cs = 1; return f(0.1);
      case 1: e.rate = 0; e.cs = 2; e.rate = f(e.rate + f(DT / f(e.shake))); return null;
      case 2: if (e.rate < 1) { e.rate = f(e.rate + f(DT / f(e.shake))); return null; } e.rate = 1; e.cs = 3; return f(0.1);
      case 3: e.tw = { left: f(f(e.moveTime) + (e.eased ? f(0.2) : 0)), fresh: true }; e.tw.dur = e.tw.left; e.left = f(e.moveTime); e.cs = 4; return null;
      case 4: e.left = f(e.left - DT); if (e.left > 0) return null; e.cs = -1; return DONE;
    }
    return null;
  }
  function gateTween(e) {   // Monocle Tween.Update, Oneshot
    var t = e.tw, pc, k;
    if (t.fresh) { t.fresh = false; return; }   // added mid-update: first tick next frame
    t.left = f(t.left - DT); pc = f(1 - f(Math.max(0, t.left) / t.dur)); k = e.eased ? cubeOut(pc) : pc;
    solidMoveTo(e, lerp(e.x0, e.nx, k), lerp(e.y0, e.ny, k));
    if (t.left <= 0) e.tw = null;
  }
  function switchFinishCheck(flag, inv) {   // Switch.FinishedCheck / MHH FlagTouchSwitch: all switches of this group on
    for (var i = 0; i < ents.length; i++) if (ents[i].t === 'touchSwitch' && (ents[i].flag || '') === (flag || '') && !ents[i].on) return;
    if (flag) L.flags[flag] = !inv; else L.sw = true;
  }
  function attachStatics() {   // Solid.Awake: riders (spikes, spring, berry, refill, spinner, key) move with the solid
    var i, j, s, e, b;
    for (i = 0; i < solids.length; i++) { s = solids[i]; if (!s.statics) continue;
      for (j = 0; j < ents.length; j++) { e = ents[j]; if (['spikes', 'spring', 'berry', 'refill', 'spinner', 'key'].indexOf(e.t) < 0 || e.att) continue; b = e.box || e.bar; if (!b) continue;
        if (overlap(b.x - 2, b.y - 2, b.w + 4, b.h + 4, s)) { e.att = true; s.statics.push(e); } } }
  }
  function overlapPlayerBody(e) { var b = boxAt(p.x, p.y, p.hb); return overlap(b[0], b[1], b[2], b[3], e); }
  function refillLike(e, use) {
    e.coll = true; e.respawn = 0; e.co = 0; e.box = { x: e.x - 8, y: e.y - 8, w: 16, h: 16 };
    e.hit = function () { return hurtHit(e.box); };
    e.touch = function () { if (use()) { e.coll = false; e.co = 1; e.respawn = RespawnTime; } };
    e.update = function () {
      if (e.co === 1) { freeze(e.two ? f(0.0667) : 0.05); e.co = 0; }   // refill coroutine runs the frame it is touched (TAS-pinned, see engine-rules)
      if (e.respawn > 0) { e.respawn = f(e.respawn - DT); if (e.respawn <= 0) e.coll = true; }
    };
    pcs.push(e);
  }
  function loadRoom(r) {
    var i, e;
    room = r; ents = []; solids = []; jts = []; sjts = []; waters = []; pcs = []; trigs = []; L.sw = false; L.swN = 0;
    for (i = 0; i < r.ents.length; i++) { e = {}; for (var k in r.ents[i]) e[k] = r.ents[i][k]; if (KIND[e.t]) { KIND[e.t](e); ents.push(e); } }
    attachStatics();
    for (i = 0; i < r.trig.length; i++) { e = {}; for (var k2 in r.trig[i]) e[k2] = r.trig[i][k2]; trigs.push(e); }
    L.respawn = nearestSpawn(p.x, p.y);
  }
  function respawn() {
    var s = L.respawn || room.spawns[0];
    p = freshPlayer(s[0], s[1]); loadRoom(room); setDuck(false); setState(INTRORESPAWN); L.freeze = 0; DTN.count = 0; DTN.attacking = false;
    var t = camTargetAt(p.x, p.y); L.cam.x = t.x; L.cam.y = t.y;
  }

  /* ---------- one Engine.Update ---------- */
  function step(keys) {
    L.frame++;
    inputUpdate(keys || {});
    if (L.freeze > 0) { L.freeze = Math.max(f(L.freeze - DT), 0); return; }
    L.time = f(L.time + DT);
    if (L.trans) { transitionStep(); return; }
    playerUpdate();
    for (var i = 0; i < ents.length; i++) if (ents[i].update) ents[i].update();
  }
  function start(map, opts) {
    opts = opts || {};
    var nm = typeof map === 'string' ? NEU.celMaps[map] : map;
    if (nm !== M || !G) { M = nm; buildGrid(); }
    var r = null, i;
    for (i = 0; i < M.rooms.length && !r; i++) if (M.rooms[i].name === (opts.room || M.rooms[0].name)) r = M.rooms[i];
    L.freeze = 0; L.time = 0; L.frame = 0; L.trans = null; L.done = false; L.deaths = 0; L.camOffX = 0; L.camOffY = 0; L.log = opts.log || null; L.flags = {}; L.sw = false; L.swN = 0;
    DTN.count = 0; DTN.canStart = false; DTN.attacking = false; DTN.timer = 0;
    if (!r.spawns || !r.spawns.length) for (i = 0; i < M.rooms.length; i++) if (M.rooms[i].spawns && M.rooms[i].spawns.length) { r = M.rooms[i]; break; }
    p = freshPlayer(r.spawns[0][0], r.spawns[0][1]); room = r; loadRoom(r);
    if (opts.spawn) { p.x = opts.spawn[0]; p.y = opts.spawn[1]; }
    if (opts.state) for (var sk in opts.state) p[sk] = opts.state[sk];
    if (opts.duck) setDuck(true);
    var t = camTargetAt(p.x, p.y); L.cam.x = t.x; L.cam.y = t.y;
    // shortcut: WalkIn and WakeUp intros are simulated; others start in control (the TAS idles through them), add each when a map needs it
    p.wake = opts.wake || 0;
    setState(opts.intro === false ? NORMAL : M.intro === 'WakeUp' ? (p.wake > 0 ? INTROWAKEUP : NORMAL) : !/^WalkIn/.test(M.intro || 'WalkInRight') ? NORMAL : INTROWALK);
    for (i = 0; i < In.jump.nodes.length; i++) In.jump.down[In.jump.nodes[i]] = false;
    return api;
  }
  /* snapshot/restore for search tools: plain data only (coroutines are data, entity closures stay) */
  var EKEYS = ['coll', 'vis', 'respawn', 'co', 'flash', 'got', 'inside', 'x', 'y', 'box', 'bar', 'mrx', 'mry', 'liftX', 'liftY', 'cs', 'cw', 'at', 'rate', 'tw', 'left', 'on', 'broken', 'gone', 'dream', 'x0', 'y0', 'dir', 'phase', 'locked', 'sx', 'sy', 'spd', 'open', 'car', 'dreamIdx', 'dreamT'];
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hbName(h) { for (var k in HB) if (HB[k] === h) return k; return 'normal'; }
  function snapshot() {
    var pc = {}, k, i, e, es = [];
    for (k in p) if (k !== 'hb' && k !== 'hurt' && k !== 'tunnelSolid') pc[k] = p[k];
    pc = clone(pc); pc.hb = hbName(p.hb); pc.hurt = hbName(p.hurt); pc.tunnelSolid = !!p.tunnelSolid;
    for (i = 0; i < ents.length; i++) { e = {}; for (k = 0; k < EKEYS.length; k++) e[EKEYS[k]] = ents[i][EKEYS[k]]; es.push(e); }
    var tr = []; for (i = 0; i < trigs.length; i++) tr.push(!!trigs[i].inside);
    var lc = {}; for (k in L) if (k !== 'log') lc[k] = L[k];
    return clone({ p: pc, L: lc, DTN: DTN, room: room.name, ents: es, trigs: tr,
      In: { jump: [In.jump.counter, In.jump.down, In.jump.hit], dash: [In.dash.counter, In.dash.down, In.dash.hit], crouch: [In.crouch.counter, In.crouch.down, In.crouch.hit],
        grab: [In.grab.counter, In.grab.down, In.grab.hit], ax: [In.mx.value, In.mx.turned, In.my.value, In.my.turned, In.ax.value, In.ax.turned, In.ay.value, In.ay.turned] } });
  }
  function restore(s) {
    var i, k, r = null;
    for (i = 0; i < M.rooms.length; i++) if (M.rooms[i].name === s.room) r = M.rooms[i];
    s = clone(s);
    p = s.p; p.hb = HB[s.p.hb]; p.hurt = HB[s.p.hurt]; p.tunnelSolid = s.p.tunnelSolid ? TILE_HIT : null;
    room = r; var log = L.log; loadRoom(r);
    for (k in s.L) L[k] = s.L[k]; L.log = log;
    for (i = 0; i < ents.length && i < s.ents.length; i++) for (k in s.ents[i]) ents[i][k] = s.ents[i][k];
    for (i = 0; i < trigs.length && i < s.trigs.length; i++) trigs[i].inside = s.trigs[i];
    for (k in s.DTN) DTN[k] = s.DTN[k];
    ['jump', 'dash', 'crouch', 'grab'].forEach(function (n) { In[n].counter = s.In[n][0]; In[n].down = s.In[n][1]; In[n].hit = s.In[n][2]; });
    var a = s.In.ax; In.mx.value = a[0]; In.mx.turned = a[1]; In.my.value = a[2]; In.my.turned = a[3]; In.ax.value = a[4]; In.ax.turned = a[5]; In.ay.value = a[6]; In.ay.turned = a[7];
  }
  var api = NEU.cel = {
    start: start, step: step, DT: DT, snapshot: snapshot, restore: restore, setDuck: function (v) { setDuck(!!v); },
    get player() { return p; }, get room() { return room; }, get level() { return L; }, get ents() { return ents; }, get map() { return M; },
    get grid() { return G; }, cellAt: cellAt, STATES: { NORMAL: NORMAL, CLIMB: CLIMB, DASH: DASH, SWIM: SWIM, DREAMDASH: DREAMDASH, INTROWALK: INTROWALK, TUNNEL: TUNNEL, CASSETTEFLY: CASSETTEFLY, BOOST: BOOST }
  };
})();
