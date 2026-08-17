/* ═══════════════════════════════════════════════════════════════════
   neu — boot, scroll, reveals, lights.

   Plain script, no module. scene.js is the module and talks to this
   file through window.NEU, a four-property bus. Everything here runs
   off one rAF loop; nothing writes layout during a scroll event.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Firefox restores the previous scroll position on reload. On a page
     that opens with a boot sequence and a hero, that means a refresh
     can drop you mid-document — the intro never plays, and the scroll
     cue is correctly hidden because you are, in fact, already scrolled.
     Every reload should start at the top. */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* shared bus ─────────────────────────────────────────────────── */
  /* merge, never replace — another module may already have registered
     on this object and a bare assignment would drop it silently */
  var NEU = window.NEU = window.NEU || {};
  Object.assign(NEU, {
    ready: false,
    heroT: 1,          // 1 = hero fully in frame, 0 = fully scrolled past
    _q: [],
    onReady: function (fn) { this.ready ? fn() : this._q.push(fn); },
    fireReady: function () {
      if (this.ready) return;
      this.ready = true;
      this._q.splice(0).forEach(function (f) { f(); });
    }
  });

  /* ── work list ──────────────────────────────────────────────────
     Rendered as real DOM text, not painted into a canvas, so it is
     selectable, searchable and readable by a screen reader.        */
  (function renderWorks() {
    var list  = document.getElementById('works');
    var empty = document.getElementById('worksEmpty');
    var works = window.NEU_WORKS || [];

    if (!list) return;
    if (!works.length) { list.hidden = true; if (empty) empty.hidden = false; return; }

    var frag = document.createDocumentFragment();

    works.forEach(function (w, i) {
      var li = document.createElement('li');
      li.style.setProperty('--i', i);

      var inner = document.createElement(w.link ? 'a' : 'div');
      if (w.link) {
        inner.href = w.link;
        if (!/^(mailto:|#|\/)/.test(w.link)) { inner.target = '_blank'; inner.rel = 'noopener'; }
      }

      var n = document.createElement('span');
      n.className = 'works__n';
      n.textContent = String(i + 1).padStart(2, '0');
      n.setAttribute('aria-hidden', 'true');   // the <ol> already numbers these

      var body = document.createElement('span');
      var t = document.createElement('span');
      t.className = 'works__t';
      t.textContent = w.title || 'untitled';
      body.appendChild(t);

      if (w.desc) {
        var d = document.createElement('span');
        d.className = 'works__d';
        d.textContent = w.desc;
        body.appendChild(d);
      }

      var meta = document.createElement('span');
      meta.className = 'works__meta';
      meta.textContent = w.meta || '';

      inner.append(n, body, meta);
      li.appendChild(inner);
      frag.appendChild(li);
    });

    list.appendChild(frag);
  })();

  /* ── boot ───────────────────────────────────────────────────────
     The bar creeps to 96 on its own, then waits on the real scene.
     A 9s bail-out means a slow CDN can never trap anyone behind it. */
  (function boot() {
    var el   = document.getElementById('boot');
    var fill = document.getElementById('bootFill');
    var pct  = document.getElementById('bootPct');
    var shown = 0, target = 0, done = false;

    function paint(v) {
      shown = v;
      if (fill) fill.style.right = (100 - v) + '%';
      if (pct)  pct.textContent = String(Math.round(v)).padStart(3, '0');
    }

    function frame() {
      if (done) return;
      paint(shown + (target - shown) * 0.14);
      requestAnimationFrame(frame);
    }

    function crawl() {
      target = Math.min(96, target + 7);
      if (target < 96) setTimeout(crawl, reduce ? 24 : 95);
      else finish();
    }

    function finish() {
      var released = false;
      function release() {
        if (released) return;
        released = true;
        target = 100; paint(100);
        setTimeout(function () {
          done = true;
          if (el) el.classList.add('is-done');
          document.body.classList.remove('is-booting');
          document.body.classList.add('is-ready');
          booted = true;
          // frame() already wrote opacity:0 inline while we were booting,
          // and an inline style beats the stylesheet — repaint or the
          // glass stays invisible until the visitor happens to scroll.
          onScroll();
          showIfNear();
        }, reduce ? 40 : 400);
      }
      NEU.onReady(release);
      setTimeout(release, 9000);
    }

    requestAnimationFrame(frame);
    setTimeout(crawl, reduce ? 0 : 180);
  })();


  /* ── sound ──────────────────────────────────────────────────────
     Synthesised, not sampled. Two reasons: the vine boom is somebody
     else's audio and I am not shipping it, and a couple of oscillators
     weigh nothing next to an mp3 that has to load before the joke can
     land. Everything is built on the first click, which is also the
     user gesture browsers require before audio may start. */
  var audio = (function () {
    var ctx = null, master = null;

    function wake() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.35;          // deliberately not loud
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function noise(dur) {
      var n = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      return src;
    }

    /* A switch that clicks but does not engage: a dry contact tick,
       no body behind it, then a weaker second tick as it drops back.
       The absence of any low end is what makes it read as "broken". */
    function dud() {
      if (!wake()) return;
      [[0, 0.5], [0.075, 0.22]].forEach(function (p) {
        var t = ctx.currentTime + p[0];
        var src = noise(0.05);
        var bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 6;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(p[1], t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
        src.connect(bp).connect(g).connect(master);
        src.start(t); src.stop(t + 0.06);
      });
    }

    /* The boom.

       The real vine boom is a sample, and it is not mine to ship — so
       this looks for one first and only synthesises if it is absent.
       Drop the mp3 at audio/vine-boom.mp3 and it will be used instead;
       see audio/README.txt.

       The synthesised version is modelled on what the sample actually
       is: not one tone but a struck body. A fast pitch drop carries the
       impact, a second partial a fifth above gives it the metallic
       edge, a lowpassed noise transient is the hit itself, and a long
       tail underneath is what makes it read as a room rather than a
       beep. Saturating the sum is what stops it sounding polite. */
    function synthBoom() {
      if (!wake()) return;
      var t = ctx.currentTime;

      var shaper = ctx.createWaveShaper();
      var n = 256, curve = new Float32Array(n);
      for (var i = 0; i < n; i++) curve[i] = Math.tanh((i / (n - 1) * 2 - 1) * 3.1);
      shaper.curve = curve;
      shaper.connect(master);

      // body: the drop that carries the punch
      var o1 = ctx.createOscillator(), g1 = ctx.createGain();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(210, t);
      o1.frequency.exponentialRampToValueAtTime(48, t + 0.18);
      o1.frequency.exponentialRampToValueAtTime(33, t + 0.9);
      g1.gain.setValueAtTime(0.0001, t);
      g1.gain.exponentialRampToValueAtTime(1, t + 0.008);
      g1.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      o1.connect(g1); g1.connect(shaper);
      o1.start(t); o1.stop(t + 1.6);

      // partial above it: the edge that keeps it from being a soft thud
      var o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(320, t);
      o2.frequency.exponentialRampToValueAtTime(72, t + 0.14);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.42, t + 0.006);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o2.connect(g2); g2.connect(shaper);
      o2.start(t); o2.stop(t + 0.55);

      // the strike itself
      var hit = noise(0.12), lp = ctx.createBiquadFilter(), hg = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(1600, t);
      lp.frequency.exponentialRampToValueAtTime(180, t + 0.12);
      hg.gain.setValueAtTime(0.7, t);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      hit.connect(lp); lp.connect(hg); hg.connect(shaper);
      hit.start(t); hit.stop(t + 0.14);

      // tail: low rumble that decays slowly, so it lands in a space
      var o3 = ctx.createOscillator(), g3 = ctx.createGain();
      o3.type = 'sine';
      o3.frequency.setValueAtTime(41, t);
      g3.gain.setValueAtTime(0.0001, t);
      g3.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
      g3.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
      o3.connect(g3); g3.connect(master);
      o3.start(t); o3.stop(t + 2);
    }

    /* Prefer the real sample if it is there. HTMLAudioElement rather
       than a decoded buffer: it is one line, and a miss costs a 404
       instead of a failed decode. */
    var sample = null, sampleOk = false;
    try {
      sample = new Audio('audio/vine-boom.mp3');
      sample.preload = 'auto';
      sample.volume = 0.55;
      sample.addEventListener('canplaythrough', function () { sampleOk = true; });
      sample.addEventListener('error', function () { sampleOk = false; });
    } catch (e) { sample = null; }

    function boom() {
      if (sampleOk && sample) {
        try { sample.currentTime = 0; sample.play(); return; } catch (e) {}
      }
      synthBoom();
    }

    return { dud: dud, boom: boom };
  })();

  /* ── the cat ────────────────────────────────────────────────────*/
  var cat = (function () {
    var box = document.getElementById('cat');
    var img = document.getElementById('catImg');
    var tPop = null, tEnd = null;
    if (!box || !img) return { show: function () {} };

    return {
      show: function () {
        clearTimeout(tPop); clearTimeout(tEnd);
        /* Re-setting src restarts an animated gif from frame one.
           The cache-buster is what forces that; without it the browser
           reuses the decoded image and a looping gif never resets. */
        img.src = 'img/cat.gif?' + Date.now();
        box.classList.remove('is-on', 'is-pop');
        void box.offsetWidth;              // reflow, so the animation replays
        box.classList.add('is-on');
        if (NEU.quest) NEU.quest.lock(true);

        /* Minecraft picks a random drift target each time the totem
           fires, which is why no two pops travel the same way. Same
           idea: a direction with a bias upward, because an item that
           drifts down reads as dropped rather than released. */
        var a = Math.random() * Math.PI * 2;
        box.style.setProperty('--tx', (Math.cos(a) * 26).toFixed(1) + 'vw');
        box.style.setProperty('--ty', (Math.sin(a) * 14 - 12).toFixed(1) + 'vh');

        tPop = setTimeout(function () {
          box.classList.add('is-pop');     // spins backwards out, totem-style
          /* 2000ms exactly — the animation is 40 ticks and the class
             must not come off mid-flight or the image snaps back to
             its resting transform for a frame. */
          tEnd = setTimeout(function () {
            box.classList.remove('is-on', 'is-pop');
            if (NEU.quest) NEU.quest.lock(false);
          }, 2000);
        }, 1500);
      }
    };
  })();

  /* ── lights ─────────────────────────────────────────────────────
     A goth site with a light mode. scene.js listens for the same
     flag and lifts the environment intensity to match.

     The switch is broken on the first press: it twitches, makes a dry
     contact click with no low end behind it, and does not engage. Every
     press after that works — and brings the cat and the boom with it. */
  (function lights() {
    var btn = document.getElementById('lightsToggle');
    if (!btn) return;
    var tried = false;

    function set(on) {
      document.body.classList.toggle('is-lit-mode', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', on ? '#EFEBE4' : '#08080B');
      if (NEU.setLights) NEU.setLights(on);
      try { localStorage.setItem('neu_lights', on ? '1' : '0'); } catch (e) {}
    }

    btn.addEventListener('click', function () {
      /* sans.js gets first refusal. Depending on what you are carrying
         this one control smashes the light, refuses to be a light any
         more, or gets repaired — and only falls through to the normal
         toggle when none of those apply. */
      if (NEU.switchHook && NEU.switchHook()) return;
      if (!tried) {
        /* first attempt: nothing happens, loudly */
        tried = true;
        audio.dud();
        btn.classList.remove('is-broken');
        void btn.offsetWidth;
        btn.classList.add('is-broken');
        setTimeout(function () { btn.classList.remove('is-broken'); }, 360);
        return;
      }
      set(!document.body.classList.contains('is-lit-mode'));
      audio.boom();
      cat.show();
    });

    try {
      if (localStorage.getItem('neu_lights') === '1') {
        // Already-on from a previous visit means the switch demonstrably
        // works, so do not make them fight it again.
        tried = true;
        // scene.js may not have registered yet — replay once it has
        NEU.onReady(function () { set(true); });
        set(true);
      }
    } catch (e) {}
  })();

  /* ── scroll ─────────────────────────────────────────────────────
     Two jobs: drift each element at its own rate, and report how
     much of the hero is left so the glass can fade and pause.

     Depth is a fraction of the viewport. Negative values move
     against the scroll — that opposition is what reads as depth,
     so keep some of each in every section.                        */
  var DEPTH = {
    'el--moon': 0.15,  'el--star-a': -0.12, 'el--star-b': 0.09,
    'el--flower': -0.11, 'el--star-c': 0.07,
    'el--die': -0.12,  'el--disc': 0.13,    'el--star-d': -0.09,
    'lay--tag': 0.05, 'lay--h': -0.045, 'lay--bio': 0.035,
    'lay--works': 0.025, 'lay--links': -0.04, 'lay--colophon': 0.03
  };

  var movers = [].slice.call(document.querySelectorAll('.el, .lay'));
  movers.forEach(function (m) {
    var d = 0;
    for (var k in DEPTH) if (m.classList.contains(k)) d = DEPTH[k];
    m.__d = d;
  });

  var glass = document.getElementById('glassStage');
  var hero  = document.getElementById('top');
  var ticking = false;
  var wasScrolled = false;
  var booted = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  }

  function frame() {
    ticking = false;
    var vh = innerHeight;

    /* hero coverage, 1 → 0 across one viewport of scrolling */
    if (hero) {
      var r = hero.getBoundingClientRect();
      var t = 1 - Math.min(1, Math.max(0, -r.top / (vh * 0.85)));
      NEU.heroT = t;
      if (glass) glass.style.opacity = document.body.classList.contains('is-ready')
        ? (t * t).toFixed(3) : '0';

      /* The scroll cue has made its point once you have moved — but
         only hide it once the page has actually settled. Hiding it
         from a layout read taken during boot, or from a scroll the
         browser performed on our behalf, makes it look like the cue
         was never there at all. */
      if (booted) {
        var scrolled = -r.top > vh * 0.06;
        if (scrolled !== wasScrolled) {
          wasScrolled = scrolled;
          document.body.classList.toggle('is-scrolled', scrolled);
        }
      }
    }

    if (reduce) return;

    for (var i = 0; i < movers.length; i++) {
      var m = movers[i];
      if (!m.__d) continue;
      var box = m.parentNode.getBoundingClientRect();
      if (box.bottom < -vh || box.top > vh * 2) continue;   // far off-screen
      var p = (box.top + box.height / 2 - vh / 2) / vh;     // -1 … 1
      m.style.setProperty('--ty', (p * m.__d * vh).toFixed(1) + 'px');
    }

    showIfNear();
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  frame();

  /* ── reveals ────────────────────────────────────────────────────
     IntersectionObserver, plus a per-element failsafe.

     PER ELEMENT, deliberately. A blanket "show everything after N
     seconds" kills every reveal below the fold, and dropping the
     failsafe entirely leaves content invisible if the observer
     never fires. This checks only what is actually on screen and
     stops itself once nothing is left hidden.                     */
  var targets = [].slice.call(document.querySelectorAll('.lay, .el, .works li'));
  var io = null;

  function show(el) {
    el.classList.add('is-shown');
    if (io) io.unobserve(el);
  }

  function showIfNear() {
    if (!guard) return;                     // nothing left to reveal
    var vh = innerHeight, pending = 0;

    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      if (el.classList.contains('is-shown')) continue;

      var r = el.getBoundingClientRect();

      /* An element with no box — display:none, or [hidden] like the
         empty-state notice — can never intersect anything. Counting it
         as pending would keep this interval alive for the life of the
         page, so skip it entirely rather than waiting on it forever. */
      if (r.width === 0 && r.height === 0) continue;

      pending++;
      if (r.top < vh && r.bottom > 0) show(el);
    }

    if (!pending) { clearInterval(guard); guard = null; }
  }

  var guard = null;

  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-shown'); });
  } else {
    targets.forEach(function (el) { el.classList.add('rev'); });
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) show(e.target); });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el) { io.observe(el); });

    /* Backstop for a misfiring observer, on a slow interval. It is NOT
       wired to scroll — that would run a full pass of layout reads on
       every scroll event. The rAF loop in frame() already calls it. */
    guard = setInterval(showIfNear, 900);
  }

  /* ── in-page nav ────────────────────────────────────────────── */
  document.querySelectorAll('[data-nav]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });
})();
