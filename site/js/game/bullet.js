/* bullet.js — the room behind the door.
   ───────────────────────────────────────────────────────────────────
   A twenty-second survival, Touhou by way of Undertale: you are a
   small soul in a bounded box and several emitters are extremely
   interested in where you are standing.

   Why a full-screen overlay and not a canvas inside the panel: a
   bullet pattern needs room to be readable. Cramped into a 420px
   sidebar the same pattern stops being a pattern and becomes noise,
   and dodging turns into luck. The panel starts it; the game takes
   the screen.

   Conventions borrowed on purpose, because they are load-bearing:

     · SHIFT focuses — you move slower and your true hitbox is drawn.
       Every danmaku game does this, and it is the difference between
       "unfair" and "tight". The hitbox is much smaller than the
       sprite, and you cannot dodge well without being shown that.
     · Invulnerability frames after a hit, with the soul flashing.
       Without them one bad frame costs all three HP in a row.
     · Bullets spawn OUTSIDE the arena and are culled well beyond it,
       so nothing ever pops into existence on top of you.

   Everything is drawn with integer fillRect, matching the rest of the
   page — this site is made of hard pixels and a smooth anti-aliased
   circle would look like it came from a different website.          */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('bh');
  var cv   = document.getElementById('bhCanvas');
  if (!wrap || !cv) { NEU.bullet = { open: function () {}, close: function () {} }; return; }
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.bullet = { open: function () {}, close: function () {} }; return; }

  var hud  = document.getElementById('bhHud');
  var msg  = document.getElementById('bhMsg');

  var dm = NEU.danmaku || {};
  var SURVIVE   = 20;          // seconds
  var PLAYER_R  = (dm.soul && dm.soul.R) || 3.2; // the TRUE hitbox. the sprite is much bigger.
  var SPEED     = dm.SPEED || 258, FOCUS_SPEED = dm.FOCUS || 112;
  var MAX_B     = 700;

  var COL = { bone: '#EDE7DE', lilac: '#B892FF', blood: '#C2405F',
              dim: '#8A8598', soul: '#E23B55', void_: '#08080B' };

  /* Blaster skull. '#' is bone, 'o' is socket. */
  var SKULL = [
    '..#####..',
    '.#######.',
    '#oo###oo#',
    '#oo###oo#',
    '#########',
    '.#######.',
    '..#####..',
    '...#.#...'
  ];
  function stamp(rows, cx, cy, s, on, off) {
    if (dm.soul && dm.soul.stamp) {
      dm.soul.stamp(ctx, rows, cx, cy, s, on, off);
      return;
    }
    var h = rows.length, w = rows[0].length;
    var x0 = (cx - w * s / 2) | 0, y0 = (cy - h * s / 2) | 0;
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) {
      var ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = (ch === 'o') ? off : on;
      ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
    }
  }

  /* Lightning glyph stamped on the electric blaster's brow, so the
     blue one is distinguishable at a glance and not only by colour —
     colour alone is the classic way to make a mechanic unreadable. */
  var BOLT = [
    '..##.',
    '.##..',
    '####.',
    '.##..',
    '.#...'
  ];

  var blasters = [];
  var BL_CHARGE = 0.85, BL_FIRE = 0.42, BL_HALF = 17;

  /* ── the electric blaster ─────────────────────────────────────────
     Its rule is INVERTED and that is the whole point: it hurts you if
     you are moving and charges the console if you are not. Every other
     thing in this room punishes standing still, so the correct play
     here is the one the last twenty seconds trained out of you.

     Charge survives between runs — asking someone to take both hits in
     a single attempt would make a joke into a grind. */
  var ELEC_EVERY = 4.4;
  var charge = 0, chargeFx = 0, emptyFx = 0;
  /* sans.js owns the console; this room only asks whether it is in
     your hands right now. */
  function carrying() { return !!(NEU.hasConsole && NEU.hasConsole()); }
  NEU.charge = function () { return charge; };
  NEU.devCharge = function (n) {
    charge = Math.max(0, Math.min(100, n | 0));
    if (NEU.quest) NEU.quest.bump('charge', charge / 50);
    if (NEU.tvState) NEU.tvState();
    return charge;
  };
  var dying = 0;

  var running = false, won = false;
  var t = 0, hp = 3, inv = 0, last = 0;
  var px = 0, py = 0, keys = {};
  var bullets = [], emitters = [];
  var AW = 0, AH = 0, AX = 0, AY = 0;     // arena rect, canvas space
  var cheat = '';                          // the 69420 buffer

  /* ── layout ───────────────────────────────────────────────────────
     Fixed backing store at devicePixelRatio, arena derived from it.
     Recomputed on resize because a mid-run resize otherwise leaves the
     player outside the box. */
  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var w = innerWidth, h = innerHeight;
    cv.width = (w * dpr) | 0; cv.height = (h * dpr) | 0;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    var ar = dm.arena ? dm.arena(w, h, 760, 520, 22) : null;
    if (ar) {
      AW = ar.AW; AH = ar.AH; AX = ar.AX; AY = ar.AY;
    } else {
      AW = Math.min(760, w - 48);
      AH = Math.min(520, h - 190);
      AX = ((w - AW) / 2) | 0;
      AY = ((h - AH) / 2 + 22) | 0;
    }
    px = Math.min(Math.max(px, AX + 12), AX + AW - 12);
    py = Math.min(Math.max(py, AY + 12), AY + AH - 12);
  }
  addEventListener('resize', function () { if (running) layout(); });

  /* ── emitters ─────────────────────────────────────────────────────
     Each has its own cadence and a phase, so they drift out of sync
     rather than all firing on the same beat — synchronised emitters
     produce corridors you can stand in forever. */
  function resetEmitters() {
    emitters = [
      { kind: 'ring',   every: 1.30, next: 0.8, ang: 0 },
      { kind: 'aimed',  every: 0.95, next: 1.6, ang: 0 },
      { kind: 'spiral', every: 0.075, next: 5.0, ang: 0 },
      { kind: 'wall',   every: 2.60, next: 10.0, ang: 0 },
      { kind: 'blaster',every: 3.10, next: 7.5,  ang: 0 },
      { kind: 'elec',   every: ELEC_EVERY, next: 4.2, ang: 0 }
    ];
    blasters = [];
  }

  function add(x, y, vx, vy, r, c) {
    if (dm.shot) {
      dm.shot(bullets, x, y, vx, vy, r, c, 0, MAX_B);
    } else {
      if (bullets.length >= MAX_B) return;
      bullets.push({ x: x, y: y, vx: vx, vy: vy, r: r, c: c });
    }
  }

  /* Difficulty ramp: 0 at the start, 1 at the end. Everything scales
     off this one number so the curve stays legible and tunable. */
  /* Story mode caps at 1.0 because the run ends there. Endless keeps
     going — the curve is the content once there is no finish line. */
  function ramp() {
    return endless ? Math.min(2.4, t / SURVIVE) : Math.min(1, t / SURVIVE);
  }

  function fire(e) {
    var k = ramp();
    var cx = AX + AW / 2, cy = AY + AH / 2;

    if (e.kind === 'ring') {
      var n = 10 + Math.round(k * 12);
      var sp = 78 + k * 52;
      e.ang += 0.31;
      for (var i = 0; i < n; i++) {
        var a = e.ang + i * (Math.PI * 2 / n);
        add(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14,
            Math.cos(a) * sp, Math.sin(a) * sp, 4, COL.lilac);
      }
    } else if (e.kind === 'aimed') {
      /* Fired from a random edge point, spread around the player's
         current position. Aimed shots are what stop you parking in a
         corner; rings alone are dodgeable by standing still. */
      var side = (Math.random() * 4) | 0, sx, sy;
      if (side === 0) { sx = AX + Math.random() * AW; sy = AY - 16; }
      else if (side === 1) { sx = AX + AW + 16; sy = AY + Math.random() * AH; }
      else if (side === 2) { sx = AX + Math.random() * AW; sy = AY + AH + 16; }
      else { sx = AX - 16; sy = AY + Math.random() * AH; }
      var base = Math.atan2(py - sy, px - sx);
      var cnt = 3 + Math.round(k * 3), spd = 128 + k * 92;
      for (var j = 0; j < cnt; j++) {
        var off = (j - (cnt - 1) / 2) * 0.17;
        add(sx, sy, Math.cos(base + off) * spd, Math.sin(base + off) * spd, 4, COL.bone);
      }
    } else if (e.kind === 'spiral') {
      if (t < 5) return;
      e.ang += 0.42;
      var arms = 2 + Math.round(k * 2), s2 = 96 + k * 44;
      for (var m = 0; m < arms; m++) {
        var a2 = e.ang + m * (Math.PI * 2 / arms);
        add(cx, cy, Math.cos(a2) * s2, Math.sin(a2) * s2, 3, COL.blood);
      }
    } else if (e.kind === 'blaster') {
      if (t < 7) return;
      /* Axis-aligned, the way sans' own are: they line up on an edge
         and fire straight across. It also keeps the beam an
         axis-aligned rectangle, which makes the collision honest and
         the pixels square.

         The lane is offset from where you are RIGHT NOW rather than
         aimed exactly, so standing still is punished but the shot is
         still dodgeable during the charge — which is the entire job
         of the charge. */
      var horiz = Math.random() < 0.5, bl = { horiz: horiz, t: 0 };
      if (horiz) {
        bl.lane = Math.min(Math.max(py + (Math.random() - 0.5) * 110, AY + 34), AY + AH - 34);
        bl.from = Math.random() < 0.5 ? 'l' : 'r';
      } else {
        bl.lane = Math.min(Math.max(px + (Math.random() - 0.5) * 110, AX + 34), AX + AW - 34);
        bl.from = Math.random() < 0.5 ? 't' : 'b';
      }
      blasters.push(bl);
    } else if (e.kind === 'elec') {
      if (charge >= 100) return;          // nothing left to charge
      var eh = Math.random() < 0.5, be = { horiz: eh, t: 0, elec: true, took: false };
      if (eh) {
        be.lane = Math.min(Math.max(py + (Math.random() - 0.5) * 80, AY + 34), AY + AH - 34);
        be.from = Math.random() < 0.5 ? 'l' : 'r';
      } else {
        be.lane = Math.min(Math.max(px + (Math.random() - 0.5) * 80, AX + 34), AX + AW - 34);
        be.from = Math.random() < 0.5 ? 't' : 'b';
      }
      blasters.push(be);
    } else if (e.kind === 'wall') {
      if (t < 10) return;
      /* A line with one gap. The gap is the entire point — a wall with
         no gap is not a pattern, it is a cutscene. */
      var vertical = Math.random() < 0.5;
      var gap = 0.18 + Math.random() * 0.5;
      var cells = 16, sp3 = 104 + k * 46;
      for (var q = 0; q < cells; q++) {
        var f = q / (cells - 1);
        if (Math.abs(f - gap) < 0.13) continue;
        if (vertical) {
          var fromTop = Math.random() < 0.5;
          add(AX + f * AW, fromTop ? AY - 14 : AY + AH + 14, 0, fromTop ? sp3 : -sp3, 4, COL.dim);
        } else {
          var fromLeft = Math.random() < 0.5;
          add(fromLeft ? AX - 14 : AX + AW + 14, AY + f * AH, fromLeft ? sp3 : -sp3, 0, 4, COL.dim);
        }
      }
    }
  }

  /* ── loop ─────────────────────────────────────────────────────────*/
  function step(now) {
    if (!running) return;
    requestAnimationFrame(step);

    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (NEU.juice && NEU.juice.frozen()) { draw(); return; }
    t += dt;

    /* move */
    var vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }      // no free diagonal speed
    var sp = keys.focus ? FOCUS_SPEED : SPEED;
    px += vx * sp * dt; py += vy * sp * dt;
    px = Math.min(Math.max(px, AX + 7), AX + AW - 7);
    py = Math.min(Math.max(py, AY + 7), AY + AH - 7);

    /* fire */
    for (var i = 0; i < emitters.length; i++) {
      var e = emitters[i];
      if (t >= e.next) { e.next = t + e.every; fire(e); }
    }

    /* advance + cull + collide */
    if (inv > 0) inv -= dt;
    var keep = [];
    for (var b, n = 0; n < bullets.length; n++) {
      b = bullets[n];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < AX - 60 || b.x > AX + AW + 60 || b.y < AY - 60 || b.y > AY + AH + 60) continue;
      keep.push(b);
      if (inv <= 0) {
        var dx = b.x - px, dy = b.y - py, rr = b.r + PLAYER_R;
        if (dx * dx + dy * dy < rr * rr) {
          hp--; inv = dm.IFRAMES || 1.15;
          /* MEDIUM: felt, but never enough to make the pattern
             unreadable on the frame you most need to read it. */
          if (NEU.juice) { NEU.juice.hit('medium'); NEU.juice.burst(px, py, 10, COL.soul); }
          if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
          if (hp <= 0) { startDeath(); return; }
        }
      }
    }
    bullets = keep;

    /* blasters */
    var kb = [];
    for (var q = 0; q < blasters.length; q++) {
      var bl = blasters[q];
      bl.t += dt;
      if (bl.t > BL_CHARGE + BL_FIRE) continue;
      kb.push(bl);
      if (bl.t > BL_CHARGE) {
        var off = bl.horiz ? Math.abs(py - bl.lane) : Math.abs(px - bl.lane);
        var inBeam = off < BL_HALF + PLAYER_R;

        if (bl.elec) {
          /* Standing still is safe AND is what charges it. `held` is
             true only while no movement key is down — checking speed
             would let you cheese it by tapping between frames.

             It only charges something you actually brought in with
             you. Filling a battery you had never picked up made the
             console decorative; now the beam has to have a target. */
          var held = !(keys.left || keys.right || keys.up || keys.down);
          if (inBeam && !bl.took) {
            if (held && carrying()) {
              bl.took = true;
              charge = Math.min(100, charge + 50);
              chargeFx = performance.now();
              if (NEU.juice) { NEU.juice.hit('large', { colour: '#4FC3F7' });
                               NEU.juice.burst(px, py, 26, '#4FC3F7', 190); }
              if (NEU.quest) NEU.quest.bump('charge', charge / 50);
              if (NEU.tvState) NEU.tvState();
            } else if (held) {
              /* Safe, but nothing happens. Said out loud, because
                 "stood still and got no charge" is otherwise
                 indistinguishable from a bug. */
              bl.took = true;
              emptyFx = performance.now();
            } else if (inv <= 0) {
              bl.took = true;
              hp--; inv = dm.IFRAMES || 1.15;
              /* MEDIUM: felt, but never enough to make the pattern
                 unreadable on the frame you most need to read it. */
              if (NEU.juice) { NEU.juice.hit('medium'); NEU.juice.burst(px, py, 10, COL.soul); }
              if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
              if (hp <= 0) { startDeath(); return; }
            }
          }
        } else if (inv <= 0 && inBeam) {
          hp--; inv = dm.IFRAMES || 1.15;
          /* MEDIUM: felt, but never enough to make the pattern
             unreadable on the frame you most need to read it. */
          if (NEU.juice) { NEU.juice.hit('medium'); NEU.juice.burst(px, py, 10, COL.soul); }
          if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
          if (hp <= 0) { startDeath(); return; }
        }
      }
    }
    blasters = kb;

    if (!endless && t >= SURVIVE) { finish(true); return; }
    draw();
  }

  function drawCarried() {
    if (!carrying()) {
      if (emptyFx && performance.now() - emptyFx < 2200) {
        ctx.fillStyle = COL.dim;
        ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
        ctx.textAlign = 'center';
        ctx.fillText('nothing on you to charge', innerWidth / 2, AY + AH + 12);
        ctx.textAlign = 'left';
      }
      return;
    }
    var w = 74, h = 26;
    var x = ((innerWidth - w) / 2) | 0, y = AY + AH + 10;

    /* the handheld: body, screen, two grips */
    ctx.fillStyle = '#1B1B24'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#4FC3F7'; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = '#0B0B10'; ctx.fillRect(x + 12, y + 5, w - 24, h - 10);
    ctx.fillStyle = '#2A2A38';
    ctx.fillRect(x + 2, y + 4, 8, h - 8);
    ctx.fillRect(x + w - 10, y + 4, 8, h - 8);

    /* the battery inside the screen. Red under 50 because the dock
       wants 100 and half is a fail state, not a warning. */
    var iw = w - 28, ih = h - 14;
    var ix = x + 14, iy = y + 7;
    ctx.fillStyle = '#22222E'; ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = charge >= 100 ? '#7BE38A' : (charge >= 50 ? '#4FC3F7' : '#C2405F');
    ctx.fillRect(ix, iy, (iw * charge / 100) | 0, ih);

    ctx.fillStyle = COL.bone;
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textAlign = 'center';
    ctx.fillText(charge + '%', innerWidth / 2, y + h + 4);
    if (charge < 100) {
      ctx.fillStyle = COL.dim;
      ctx.fillText('hold still in the blue one', innerWidth / 2, y + h + 24);
    }
    ctx.textAlign = 'left';
  }


  function draw() {
    var w = innerWidth, h = innerHeight;
    var shook = NEU.juice ? NEU.juice.begin(ctx, w, h) : false;
    ctx.fillStyle = 'rgba(8,8,11,0.92)';
    ctx.fillRect(0, 0, w, h);

    /* arena */
    ctx.fillStyle = COL.void_;
    ctx.fillRect(AX, AY, AW, AH);
    ctx.fillStyle = COL.bone;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3);
    ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH);
    ctx.fillRect(AX + AW, AY, 3, AH);

    /* bullets — squares on integer coords, like everything else here */
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i], s = (b.r * 2) | 0;
      ctx.fillStyle = b.c;
      ctx.fillRect((b.x - b.r) | 0, (b.y - b.r) | 0, s, s);
    }

    /* blasters: a warning line while charging, a beam while firing.
       The telegraph is not politeness — an untelegraphed instant beam
       is unreadable and the death feels arbitrary. */
    for (var q = 0; q < blasters.length; q++) {
      var bl = blasters[q];
      var charging = bl.t < BL_CHARGE;
      var k = charging ? bl.t / BL_CHARGE : 1;
      var sx2, sy2;
      if (bl.horiz) { sx2 = bl.from === 'l' ? AX - 26 : AX + AW + 26; sy2 = bl.lane; }
      else          { sx2 = bl.lane; sy2 = bl.from === 't' ? AY - 26 : AY + AH + 26; }

      var ec = bl.elec ? '#4FC3F7' : COL.bone;
      if (charging) {
        if (((bl.t * 20) | 0) % 2 === 0) {
          ctx.fillStyle = bl.elec ? 'rgba(79,195,247,0.30)' : 'rgba(237,231,222,0.22)';
          if (bl.horiz) ctx.fillRect(AX, (bl.lane - 1) | 0, AW, 2);
          else          ctx.fillRect((bl.lane - 1) | 0, AY, 2, AH);
        }
        stamp(SKULL, sx2, sy2, 2 + (k * 2) | 0, ec, COL.void_);
        if (bl.elec) stamp(BOLT, sx2, sy2 - 20, 3, '#FFF06A', COL.void_);
      } else {
        var f = 1 - (bl.t - BL_CHARGE) / BL_FIRE;      // beam narrows as it dies
        var hh = (BL_HALF * f) | 0;
        ctx.fillStyle = ec;
        if (bl.horiz) ctx.fillRect(AX, (bl.lane - hh) | 0, AW, hh * 2);
        else          ctx.fillRect((bl.lane - hh) | 0, AY, hh * 2, AH);
        ctx.fillStyle = bl.elec ? '#CFF3FF' : '#FFFFFF';
        if (bl.horiz) ctx.fillRect(AX, (bl.lane - hh / 3) | 0, AW, Math.max(2, (hh / 1.5) | 0));
        else          ctx.fillRect((bl.lane - hh / 3) | 0, AY, Math.max(2, (hh / 1.5) | 0), AH);
        stamp(SKULL, sx2, sy2, 4, ec, COL.void_);
        if (bl.elec) stamp(BOLT, sx2, sy2 - 26, 3, '#FFF06A', COL.void_);
      }
    }

    /* the soul. flashes while invulnerable so the state is visible. */
    if (dm.soul && dm.soul.draw) dm.soul.draw(ctx, px, py, inv, COL.soul);
    /* focus reveals the true hitbox — the whole reason focus exists */
    if (keys.focus) {
      ctx.fillStyle = COL.bone;
      ctx.fillRect((px - PLAYER_R) | 0, (py - PLAYER_R) | 0, 3, 3);
    }

    /* hud: time bar + hp */
    var bw = AW, bx = AX, by = AY - 22;
    ctx.fillStyle = '#22222E'; ctx.fillRect(bx, by, bw, 6);
    /* In endless the bar shows the difficulty ramp instead of progress
       toward a finish that does not exist. */
    ctx.fillStyle = endless ? '#C2405F' : COL.lilac;
    ctx.fillRect(bx, by, (bw * Math.min(1, (endless ? ramp() / 2.4 : t / SURVIVE))) | 0, 6);
    ctx.fillStyle = COL.bone;
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('HP ' + Math.max(0, hp) + '/3', AX, AY + AH + 12);
    ctx.fillText(endless ? t.toFixed(1) + 's'
                         : Math.max(0, SURVIVE - t).toFixed(1) + 's',
                 AX + AW - 44, AY + AH + 12);
    drawCarried();
    if (NEU.juice) { NEU.juice.drawParts(ctx, 1 / 60);
                     NEU.juice.end(ctx, shook);
                     NEU.juice.overlay(ctx, w, h); }

    /* ── what you brought in with you ───────────────────────────────
       The chip tray is a page element and this room covers the whole
       page, so the console had no way to be visible in the one place
       it exists to be used. It gets drawn into the arena hud instead:
       a small handheld with a battery in it, bottom-centre, under the
       arena floor where it cannot be confused for a bullet.

       Drawn even at 0% — an empty battery is information. Absent
       entirely reads as "this room doesn't do that". */
    /* the charge cutscene: centre screen, unmissable, ~1.6s */
    if (chargeFx && performance.now() - chargeFx < 1600) {
      var e2 = (performance.now() - chargeFx) / 1600;
      var bw2 = 210, bh2 = 96;
      var bx2 = ((innerWidth - bw2) / 2) | 0, by2 = ((innerHeight - bh2) / 2) | 0;
      ctx.globalAlpha = e2 > 0.8 ? (1 - e2) / 0.2 : 1;
      ctx.fillStyle = COL.void_;  ctx.fillRect(bx2 - 10, by2 - 10, bw2 + 20, bh2 + 46);
      ctx.fillStyle = '#4FC3F7';
      ctx.fillRect(bx2 - 10, by2 - 10, bw2 + 20, 3);
      ctx.fillRect(bx2 - 10, by2 + bh2 + 33, bw2 + 20, 3);
      ctx.fillStyle = '#22222E'; ctx.fillRect(bx2, by2, bw2, bh2);
      ctx.fillStyle = '#4FC3F7';
      ctx.fillRect(bx2 + 6, by2 + 6, ((bw2 - 12) * (charge / 100) * Math.min(1, e2 * 3)) | 0, bh2 - 12);
      ctx.fillStyle = COL.bone;
      ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CHARGING  ' + charge + '%', innerWidth / 2, by2 + bh2 + 12);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  /* ── start / finish ───────────────────────────────────────────────*/
  function begin() {
    layout();
    t = 0; hp = 3; inv = 0; won = false; cheat = '';
    bullets = []; resetEmitters();
    px = AX + AW / 2; py = AY + AH - 60;
    keys = {};
    running = true; last = performance.now();
    if (msg) msg.hidden = true;
    requestAnimationFrame(step);
  }

  /* ── death ────────────────────────────────────────────────────────
     Undertale holds the cracked soul for a beat before it goes, and
     that beat is the whole animation. Shatter it on the frame of the
     hit and it reads as a rendering glitch; hold it for ~400ms with a
     split down the middle and it reads as a death. */
  function startDeath() {
    running = false;                 // stops the main loop's next frame
    dying = performance.now();
    if (dm.resetDeath) dm.resetDeath();
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    requestAnimationFrame(deathStep);
  }

  function arena() {
    ctx.fillStyle = 'rgba(8,8,11,0.92)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = COL.void_; ctx.fillRect(AX, AY, AW, AH);
    ctx.fillStyle = COL.bone;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3);
    ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH);
    ctx.fillRect(AX + AW, AY, 3, AH);
  }

  function deathStep(now) {
    var ms = now - dying;
    arena();

    var playing = dm.death ? dm.death(ctx, px, py, ms, COL.soul) : (ms <= 1700);
    if (!playing) { dying = 0; finish(false, true); return; }
    requestAnimationFrame(deathStep);
  }

  function finish(good, quiet) {
    running = false; won = good;
    if (!quiet) draw();

    if (endless) {
      /* No win state out here, so the only number that matters is how
         long you lasted. Recorded before the message so the message
         can say whether it was a record. */
      var secs = Math.round(t * 10) / 10;
      var prev = NEU.save ? NEU.save.best('twenty') : 0;
      var pb = secs > prev;
      if (NEU.save) NEU.save.best('twenty', secs);
      if (msg) {
        msg.hidden = false;
        msg.innerHTML = '<b>' + secs.toFixed(1) + 's</b><br>' +
          (pb ? 'a new best.' : 'best ' + prev.toFixed(1) + 's') +
          '<br><small>enter to go again &middot; esc to leave</small>';
      }
      return;
    }

    if (msg) {
      msg.hidden = false;
      msg.innerHTML = good
        ? '<b>you made it.</b><br>twenty seconds. take the dog food.<br><small>esc to leave</small>'
        : '<b>ouch.</b><br>enter to try again &middot; esc to leave';
    }
    if (good) {
      if (NEU.quest) NEU.quest.mark('survive');
      if (NEU.grantDogFood) NEU.grantDogFood();
    }
  }

  /* ── input ────────────────────────────────────────────────────────*/
  function keyName(e) {
    var k = e.key;
    if (k === 'ArrowLeft'  || k === 'a' || k === 'A') return 'left';
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
    if (k === 'ArrowUp'    || k === 'w' || k === 'W') return 'up';
    if (k === 'ArrowDown'  || k === 's' || k === 'S') return 'down';
    if (k === 'Shift') return 'focus';
    return null;
  }

  addEventListener('keydown', function (e) {
    if (wrap.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (!running && e.key === 'Enter') { begin(); return; }

    var n = keyName(e);
    if (n) { keys[n] = true; e.preventDefault(); }

    /* the code. buffered rather than matched per-key so it survives
       being typed while you are also dodging with the other hand. */
    if (running && /^[0-9]$/.test(e.key)) {
      cheat = (cheat + e.key).slice(-5);
      if (cheat === '69420') { t = SURVIVE; }
    }
  });
  addEventListener('keyup', function (e) {
    if (wrap.hidden) return;
    var n = keyName(e);
    if (n) keys[n] = false;
  });

  /* ── endless ──────────────────────────────────────────────────────
     The story run is twenty seconds because twenty seconds is the ask.
     Launched from the console's library it has no cap: the ramp keeps
     climbing past 1.0, there is no win state, and the score is how
     long you lasted. A library whose games end after twenty seconds
     is not a library.

     Same module, one flag. Forking it would mean two copies of every
     emitter and the electric blaster's inverted rule. */
  var endless = false;
  function open(opts) {
    endless = !!(opts && opts.endless);
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    begin();
  }
  function close() {
    running = false;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    /* You came in here to charge the console; tell the dock about it
       on the way out rather than making the label wait for the next
       scroll to notice. */
    if (NEU.tvState) NEU.tvState();
  }

  var startBtn = document.getElementById('bhStart');
  if (startBtn) startBtn.addEventListener('click', open);
  var quitBtn = document.getElementById('bhQuit');
  if (quitBtn) quitBtn.addEventListener('click', close);

  NEU.bullet = { open: open, close: close, get endless() { return endless; }, get running() { return running; },
                 get won() { return won; } };
})();
