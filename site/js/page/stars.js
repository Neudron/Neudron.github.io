/* ═══════════════════════════════════════════════════════════════════
   neu — pixel starfield.

   Ported from a React/TS component to plain script. The technique is
   the interesting part and it survives the port intact:

     · every star snaps to a pixelSize grid, so nothing is ever drawn
       on a half-pixel — that grid IS the retro look
     · twinkle steps between two discrete opacities instead of easing
       between them. A smooth fade reads as modern; a hard step reads
       as 16-bit
     · the whole loop is capped at 16fps. Not a performance measure —
       a low frame rate is part of the aesthetic
     · a slice of the field is replaced every few seconds, so the sky
       drifts without anything visibly moving

   The canvas is FIXED and viewport-sized. It therefore covers the
   page at every scroll position — the sky is present from the first
   pixel to the last — and because nothing moves it with the scroll,
   the stars hold still while the content passes over them.

   A document-height canvas was tried and reverted. Making the layer
   `position: absolute` inside a `position: relative` body, on a body
   that already carries `overflow-x: hidden`, changes which element
   owns the page's scrolling box. That is subtle, differs between
   engines, and broke scrolling outright. A fixed layer touches none
   of that.

   Changed from the original on purpose: the 16-bit rainbow palette
   (light red, green, cyan, purple) reads as confetti here, so it is
   weighted to bone and ash; the canvas is NOT scaled by
   devicePixelRatio, because one canvas pixel covering two device
   pixels is exactly the chunk we want; the shooting stars are gone,
   since something darting past every few seconds pulls the eye off
   the text; and the backdrop is a flat fill matching --page exactly
   rather than a gradient — any region the canvas does not cover
   falls back to the page colour, and a lit gradient against a flat
   fallback shows as a hard seam.

   The canvas is published on NEU.stars so scene.js can use it as a
   texture: the glass then refracts real stars.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.getElementById('starCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  /* ── configuration ──────────────────────────────────────────── */
  var PIXEL          = 5;        // star size, and the grid they snap to
  var DENSITY        = 0.00006;  // stars per square pixel
  var TWINKLE_CHANCE = 0.7;
  var TWINKLE_MIN    = 2;        // seconds per half-cycle
  var TWINKLE_MAX    = 4;
  var REGEN_EVERY    = 5000;     // ms
  var REGEN_FRACTION = 0.15;
  var TARGET_FPS     = 16;
  var FRAME_MS       = 1000 / TARGET_FPS;

  /* Weighted by repetition — bone dominates, blood is a rare accent.
     Restraint here is what keeps it goth rather than Halloween. */
  var COLORS = [
    '#EDE7DE', '#EDE7DE', '#EDE7DE', '#EDE7DE', '#EDE7DE',
    '#C9C3D6', '#C9C3D6', '#C9C3D6',
    '#B892FF', '#B892FF',
    '#FFF2CF',
    '#8C2F4A'
  ];
  var COLORS_LIT = [
    '#3A3550', '#3A3550', '#3A3550', '#3A3550', '#3A3550',
    '#4A4560', '#4A4560', '#4A4560',
    '#5E33BE', '#5E33BE',
    '#6B5A3A',
    '#8C2F4A'
  ];

  var stars = [];
  var lit = false;
  var w = 0, h = 0;

  NEU.stars = {
    canvas: canvas,
    version: 0,       // bumped on every repaint; scene.js watches this
    setLit: function (on) { lit = !!on; recolor(); paint(); }
  };

  function palette() { return lit ? COLORS_LIT : COLORS; }

  function makeStar() {
    var pal = palette();
    var base = Math.random() * 0.5 + 0.5;
    var ci = Math.floor(Math.random() * pal.length);
    return {
      ci: ci,
      x: Math.floor(Math.random() * (w / PIXEL)) * PIXEL,
      y: Math.floor(Math.random() * (h / PIXEL)) * PIXEL,
      color: pal[ci],
      base: base,
      alpha: base,
      twinkle: Math.random() < TWINKLE_CHANCE,
      speed: TWINKLE_MIN + Math.random() * (TWINKLE_MAX - TWINKLE_MIN),
      dir: -1,
      timer: Math.random() * TWINKLE_MAX   // desync, or they all blink together
    };
  }

  /* Swap ink, keep the constellation. Rebuilding here would
     re-randomise every position, so flipping the lights would throw
     away the sky the visitor was looking at. The palettes are index-
     aligned, so a star keeps its brightness class across themes. */
  function recolor() {
    var pal = palette();
    for (var i = 0; i < stars.length; i++) stars[i].color = pal[stars[i].ci];
  }

  function rebuild() {
    stars = [];
    var n = Math.floor(w * h * DENSITY);
    for (var i = 0; i < n; i++) stars.push(makeStar());
  }

  function regenerate() {
    if (!stars.length) return;
    var n = Math.max(1, Math.floor(stars.length * REGEN_FRACTION));
    for (var i = 0; i < n; i++) {
      stars[Math.floor(Math.random() * stars.length)] = makeStar();
    }
  }

  /* ── painting ───────────────────────────────────────────────────
     Flat fill, exactly --page. Anything the canvas does not cover
     falls back to the body colour, so the two must be identical or
     the boundary reads as a hard line. */
  function paint() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = lit ? '#EFEBE4' : '#08080B';
    ctx.fillRect(0, 0, w, h);

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, PIXEL, PIXEL);
    }

    ctx.globalAlpha = 1;
    NEU.stars.version++;
  }

  /* ── loop ───────────────────────────────────────────────────── */
  var last = 0;
  var visible = !document.hidden;
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

  function tick(now) {
    requestAnimationFrame(tick);
    if (!visible || now - last < FRAME_MS) return;
    last = now;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (!s.twinkle) continue;
      s.timer += 1 / TARGET_FPS;
      if (s.timer >= s.speed) { s.timer = 0; s.dir *= -1; }
      /* two states, no interpolation — the hard step is the point */
      var half = s.timer / s.speed < 0.5;
      s.alpha = (s.dir < 0) === half ? s.base : s.base * 0.3;
    }

    paint();
  }

  /* ── size ───────────────────────────────────────────────────────
     Viewport only. No document measuring, so nothing here can feed
     back into layout. */
  function resize() {
    var nw = innerWidth, nh = innerHeight;
    if (nw === w && nh === h) return;
    w = canvas.width  = nw;
    h = canvas.height = nh;
    rebuild();
    paint();
  }
  addEventListener('resize', resize, { passive: true });
  resize();

  if (reduce) {
    /* A still night sky: the field is there, nothing blinks.
       resize() has already painted it, so there is nothing to do. */
  } else {
    requestAnimationFrame(tick);
    setInterval(regenerate, REGEN_EVERY);
  }
})();
