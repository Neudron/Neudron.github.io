/* boss.js — what's on the television.
   ───────────────────────────────────────────────────────────────────
   Dock the charged console and this is what it plays: the fight the
   whole chain has been threatening since the first line he ever said.

   The joke is load-bearing and it is mechanical, not written. FIGHT
   is a real button, it aims properly, it connects — and his HP does
   not move. Not "it goes down slowly". It does not move. He told you
   that at the top of the page and the interface has been lying about
   it ever since by having a FIGHT button at all.

   MERCY is the only thing that ends this, and it is greyed out until
   you have swung enough times to have believed the HP bar. Offering
   the out immediately would let you skip the point.                 */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('boss');
  var cv   = document.getElementById('bossCanvas');
  if (!wrap || !cv) { NEU.boss = { open: function () {}, close: function () {} }; return; }
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.boss = { open: function () {}, close: function () {} }; return; }

  var COL = { bone: '#EDE7DE', lilac: '#B892FF', blood: '#C2405F',
              dim: '#8A8598', soul: '#E23B55', void_: '#08080B' };
  var HEART = ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'];

  var PLAYER_R = 3.2, SPEED = 250, FOCUS = 108, IFRAMES = 1.1;
  var MENU = ['FIGHT', 'ACT', 'MERCY'];
  var MERCY_AT = 3;                       // swings before MERCY unlocks

  var running = false, phase = 'menu';    // menu | dodge | over
  var sel = 0, swings = 0, hp = 5, inv = 0, t = 0, last = 0;
  var px = 0, py = 0, keys = {}, bullets = [];
  var AX = 0, AY = 0, AW = 0, AH = 0;
  var line = '', lineT = 0, wave = 0, waveEnd = 0, spared = false;

  var TAUNT = [
    "you brought a television to a knife fight.",
    "swing away, buddy.",
    "you're not even close.",
    "told you.",
    "this is the part where you get it."
  ];

  function stamp(rows, cx, cy, s, col) {
    var h = rows.length, w = rows[0].length;
    var x0 = (cx - w * s / 2) | 0, y0 = (cy - h * s / 2) | 0;
    ctx.fillStyle = col;
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++)
      if (rows[r][c] === '#') ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
  }

  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = (innerWidth * dpr) | 0; cv.height = (innerHeight * dpr) | 0;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    AW = Math.min(560, innerWidth - 60);
    AH = Math.min(300, innerHeight - 320);
    AX = ((innerWidth - AW) / 2) | 0;
    AY = ((innerHeight - AH) / 2 + 40) | 0;
    px = Math.min(Math.max(px, AX + 12), AX + AW - 12);
    py = Math.min(Math.max(py, AY + 12), AY + AH - 12);
  }
  addEventListener('resize', function () { if (running) layout(); });

  function say(s) { line = s; lineT = performance.now(); }

  function startWave() {
    phase = 'dodge';
    bullets = [];
    px = AX + AW / 2; py = AY + AH / 2;
    wave++;
    waveEnd = performance.now() + 5200;
  }

  function fireWave(now) {
    /* Three patterns cycling by wave, each readable on its own: a
       sweep, a ring, and aimed bones. Kept simpler than the survival
       room because here you are also reading dialogue. */
    var k = Math.min(1, wave / 5);
    if (bullets.length > 260) return;
    var cx = AX + AW / 2, cy = AY + AH / 2;
    var m = wave % 3;
    if (m === 1) {
      if ((now / 260 | 0) !== fireWave.a) {
        fireWave.a = now / 260 | 0;
        var yy = AY + 20 + Math.random() * (AH - 40);
        var fromL = Math.random() < 0.5;
        bullets.push({ x: fromL ? AX - 12 : AX + AW + 12, y: yy,
                       vx: (fromL ? 1 : -1) * (150 + k * 70), vy: 0, r: 4, c: COL.bone });
      }
    } else if (m === 2) {
      if ((now / 700 | 0) !== fireWave.b) {
        fireWave.b = now / 700 | 0;
        var n = 9 + (k * 6 | 0);
        for (var i = 0; i < n; i++) {
          var a = i * (Math.PI * 2 / n) + wave;
          bullets.push({ x: cx, y: cy, vx: Math.cos(a) * (95 + k * 45),
                         vy: Math.sin(a) * (95 + k * 45), r: 3, c: COL.lilac });
        }
      }
    } else {
      if ((now / 420 | 0) !== fireWave.c) {
        fireWave.c = now / 420 | 0;
        var sx = AX + Math.random() * AW, sy = AY - 12;
        var ang = Math.atan2(py - sy, px - sx);
        for (var j = -1; j <= 1; j++)
          bullets.push({ x: sx, y: sy, vx: Math.cos(ang + j * 0.2) * (140 + k * 60),
                         vy: Math.sin(ang + j * 0.2) * (140 + k * 60), r: 4, c: COL.blood });
      }
    }
  }

  function choose() {
    if (phase !== 'menu') return;
    var m = MENU[sel];
    if (m === 'FIGHT') {
      swings++;
      /* The bar does not move. That is the entire fight. */
      say(TAUNT[Math.min(swings - 1, TAUNT.length - 1)]);
      if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
      setTimeout(startWave, 900);
    } else if (m === 'ACT') {
      say(swings >= MERCY_AT
        ? "* you consider stopping. he looks like he'd prefer that."
        : "* you check him. ATK 1  DEF 1. the numbers are a formality.");
      setTimeout(startWave, 900);
    } else {
      if (swings < MERCY_AT) { say("* not yet. you don't believe it yet."); return; }
      spared = true; phase = 'over';
      say("* you spare him.");
      if (NEU.quest) NEU.quest.mark('spared');
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      setTimeout(function () {
        say("welp. that's the first sensible thing you've done all page.");
      }, 1600);
    }
  }

  function step(now) {
    if (!running) return;
    requestAnimationFrame(step);
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    t += dt;

    if (phase === 'dodge') {
      var vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      var vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
      var sp = keys.focus ? FOCUS : SPEED;
      px = Math.min(Math.max(px + vx * sp * dt, AX + 7), AX + AW - 7);
      py = Math.min(Math.max(py + vy * sp * dt, AY + 7), AY + AH - 7);

      fireWave(now);
      if (inv > 0) inv -= dt;

      var keep = [];
      for (var i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < AX - 40 || b.x > AX + AW + 40 || b.y < AY - 40 || b.y > AY + AH + 40) continue;
        keep.push(b);
        if (inv <= 0) {
          var ddx = b.x - px, ddy = b.y - py, rr = b.r + PLAYER_R;
          if (ddx * ddx + ddy * ddy < rr * rr) {
            hp--; inv = IFRAMES;
            if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
            if (hp <= 0) { hp = 5; phase = 'menu'; say("* you're fine. he isn't trying."); }
          }
        }
      }
      bullets = keep;
      if (now > waveEnd) { phase = 'menu'; bullets = []; }
    }
    draw(now);
  }

  function draw(now) {
    var w = innerWidth, h = innerHeight;
    ctx.fillStyle = COL.void_; ctx.fillRect(0, 0, w, h);

    /* him, up top */
    var img = document.getElementById('bossSans');
    if (img && img.complete && img.naturalWidth) {
      var iw = 92, ih = iw * (img.naturalHeight / img.naturalWidth);
      ctx.drawImage(img, ((w - iw) / 2) | 0, (AY - ih - 74) | 0, iw, ih);
    }

    /* the bar that never moves */
    var bw = 200, bx = ((w - bw) / 2) | 0, by = AY - 56;
    ctx.fillStyle = COL.bone;
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText('sans', w / 2, by - 20);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#22222E'; ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = COL.blood; ctx.fillRect(bx, by, bw, 10);   // always full

    /* arena */
    ctx.fillStyle = COL.void_; ctx.fillRect(AX, AY, AW, AH);
    ctx.fillStyle = COL.bone;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3); ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH); ctx.fillRect(AX + AW, AY, 3, AH);

    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i], s = (b.r * 2) | 0;
      ctx.fillStyle = b.c;
      ctx.fillRect((b.x - b.r) | 0, (b.y - b.r) | 0, s, s);
    }

    if (phase === 'dodge' && (inv <= 0 || ((inv * 14) | 0) % 2 === 0))
      stamp(HEART, px, py, 2, COL.soul);

    /* dialogue */
    if (line && now - lineT < 6000) {
      ctx.fillStyle = COL.bone;
      ctx.font = '16px "Undertale Sans","Comic Sans MS",cursive';
      ctx.fillText(line, AX + 8, AY + AH + 16);
      ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    }

    /* menu */
    if (phase === 'menu' || phase === 'over') {
      var my = AY + AH + 52, mw = AW / 3;
      for (var m = 0; m < MENU.length; m++) {
        var on = m === sel;
        var greyed = MENU[m] === 'MERCY' && swings < MERCY_AT;
        ctx.fillStyle = greyed ? '#3a3a46' : (on ? COL.soul : COL.bone);
        ctx.strokeStyle = ctx.fillStyle;
        var bxx = (AX + m * mw + 8) | 0, bww = (mw - 16) | 0;
        ctx.fillRect(bxx, my, bww, 3);
        ctx.fillRect(bxx, my + 37, bww, 3);
        ctx.fillRect(bxx, my, 3, 40);
        ctx.fillRect(bxx + bww - 3, my, 3, 40);
        ctx.textAlign = 'center';
        ctx.fillText(MENU[m], bxx + bww / 2, my + 12);
        ctx.textAlign = 'left';
      }
      ctx.fillStyle = COL.dim;
      ctx.fillText(phase === 'over' ? 'esc to leave'
                                    : 'arrows to choose  ·  enter to pick', AX + 8, my + 54);
    } else {
      ctx.fillStyle = COL.dim;
      ctx.fillText('HP ' + hp + '/5', AX + 8, AY + AH + 52);
    }
  }

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
    if (phase === 'menu') {
      if (e.key === 'ArrowLeft')  { sel = (sel + MENU.length - 1) % MENU.length; e.preventDefault(); return; }
      if (e.key === 'ArrowRight') { sel = (sel + 1) % MENU.length; e.preventDefault(); return; }
      if (e.key === 'Enter' || e.key === ' ') { choose(); e.preventDefault(); return; }
    }
    var n = keyName(e); if (n) { keys[n] = true; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) {
    if (wrap.hidden) return;
    var n = keyName(e); if (n) keys[n] = false;
  });

  function open() {
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    layout();
    phase = 'menu'; sel = 0; hp = 5; inv = 0; bullets = []; keys = {};
    if (!spared) { swings = 0; wave = 0; }
    say("* sans blocks the way.");
    running = true; last = performance.now();
    requestAnimationFrame(step);
  }
  function close() {
    running = false;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
  }

  var q = document.getElementById('bossQuit');
  if (q) q.addEventListener('click', close);

  NEU.boss = { open: open, close: close,
               get running() { return running; },
               get phase() { return phase; },
               get swings() { return swings; },
               get spared() { return spared; } };
})();
