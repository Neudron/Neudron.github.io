/* sans.js — the corner encounter.
   ───────────────────────────────────────────────────────────────────
   He fades in only once you reach the last section, so the trip back
   up for the sword is a real trip: while you are at the top he is
   genuinely gone, not sitting in the corner watching.

   The state machine, in order:

     away   nothing on screen. the default.
     here   sans is in the corner and clickable.
     stuck  sword is planted at the top of the DOCUMENT. you have to
            scroll up to it.
     held   you have it. it tracks the cursor while you scroll back.
     swing  released over sans. totem pops on him, he says his piece,
            and the sword goes home — so every swing costs another
            round trip, which is the joke.

   Releasing anywhere that is not sans also sends it home. That was a
   deliberate choice: it makes carrying the thing an actual task
   instead of a formality.

   Coarse pointers get a different contract — see CARRY below. You
   cannot hold a finger down and scroll with the same finger, so on
   touch it is tap-to-carry rather than press-and-hold.             */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var sans   = document.getElementById('sans');
  var btn    = document.getElementById('sansBtn');
  var pop    = document.getElementById('sansPop');
  var sword  = document.getElementById('sword');
  var tbox   = document.getElementById('tbox');
  var ttxt   = document.getElementById('tboxTxt');
  var tmore  = document.getElementById('tboxMore');
  if (!sans || !btn || !sword || !tbox || !ttxt) return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CARRY   = matchMedia('(pointer: coarse)').matches;   // tap-to-carry

  /* ── what he says ───────────────────────────────────────────────
     Written for this page rather than quoted, so nothing here is
     lifted dialogue. Index 0 is the greeting; 1 onward are swings.
     The list holds on its last entry, so a very determined visitor
     gets "..." forever, which is the correct response. */
  var GREET = [
    "heya. you're lookin' at me like i owe you money.",
    "i don't. but if you feel strongly about it, there's a sword at the top of the page.",
    "take your time. i'm not going anywhere."
  ];
  var LINES = [
    "swing and a miss. classic.",
    "still here, buddy.",
    "you're really puttin' your back into it. i'd lend you mine, but i'm using it.",
    "i'd dodge, but that sounds like a lot of work.",
    "tibia honest, i didn't think you'd still be going.",
    "that's five round trips. i counted. i had the time.",
    "i'm bone tired just watchin' you, kid.",
    "..."
  ];
  var BREAK = [
    "...huh.",
    "welp. there goes the plot device.",
    "keep the handle. broken hero key. it's the only one you're getting, so try not to lose it.",
    "there's a door on the right face of that cube up top. it's a long way up.",
    "i'd throw it, personally. hard."
  ];
  var swings = 0;

  /* ── the blip ───────────────────────────────────────────────────
     Its own tiny context rather than reaching into main.js's audio
     module, which is closed over. Square wave, very short, detuned a
     little each character so a long line doesn't turn into a siren. */
  var actx = null;

  /* His ACTUAL text blip, snd_txtsans from the game files.

     ONE sample, not two. Alternating txtsans with txtsans2 was meant
     to stop a long line sounding mechanical and instead made every
     character sound doubled — the two files are near-identical in
     pitch and length, so back-to-back they read as one blip with a
     flam on it rather than as variation.

     Still a pool of four elements: characters land 42ms apart and a
     single Audio can only play one instance at a time, so one element
     would cut itself off on every character. Four copies of the SAME
     file is the fix; four different files was the bug. */
  var blipPool = [], blipI = 0, blipOk = true;
  try {
    for (var bi = 0; bi < 4; bi++) {
      var ba = new Audio('audio/txtsans.wav');
      ba.preload = 'auto'; ba.volume = 0.32;
      ba.addEventListener('error', function () { blipOk = false; });
      blipPool.push(ba);
    }
  } catch (e) { blipOk = false; }

  /* ── who is talking ─────────────────────────────────────────────
     snd_txtsans is HIS voice. Using it for the dog, for the narrator,
     and for the television made every box on the page sound like the
     same skeleton, which quietly undoes the one joke the sample is
     doing any work for: you should be able to tell he has walked into
     the conversation without reading a word.

     So the sample is reserved for lines he actually says, and the
     other two speakers are synthesised — deliberately NOT sampled,
     because a second real voice would compete with his rather than
     get out of the way.

       sans — the real wav, warm and mid
       narr — a short high tick. Undertale's narration is a typewriter,
              not a person; it should read as text appearing.
       dog  — low, with a downward slide. Big animal, small opinion. */
  var VOICE = {
    sans: null,                                  // sample, handled below
    narr: { type: 'square',   f: 760, to: 760, g: 0.030, ms: 0.022, jit: 60 },
    dog:  { type: 'triangle', f: 220, to: 150,  g: 0.075, ms: 0.075, jit: 22 },
    tv:   { type: 'sawtooth', f: 330, to: 300,  g: 0.026, ms: 0.030, jit: 14 }
  };

  function blip(who) {
    if (reduced) return;
    if (who && who !== 'sans') { synthVoice(VOICE[who] || VOICE.narr); return; }
    if (blipOk && blipPool.length) {
      try {
        var a = blipPool[blipI++ % blipPool.length];
        a.currentTime = 0;
        /* Four copies of ONE file, so every blip is identical. ±5%
           scatter on the rate is what stops a long line reading as a
           machine gun. */
        a.playbackRate = 1 + (Math.random() * 0.1 - 0.05);
        var p = a.play();
        if (p && p.catch) p.catch(synthBlip);
        return;
      } catch (e) {}
    }
    synthBlip();
  }

  function synthBlip() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = 'square';
      o.frequency.setValueAtTime(420 + Math.random() * 90, t);
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + 0.04);
    } catch (e) {}
  }

  /* One oscillator per character, detuned a little each time. The jitter
     is what stops a long line turning into a dial tone — without it the
     ear locks onto the pitch and stops hearing individual letters. */
  function synthVoice(v) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      var d = (Math.random() - 0.5) * v.jit;
      o.type = v.type;
      o.frequency.setValueAtTime(v.f + d, t);
      if (v.to !== v.f) o.frequency.exponentialRampToValueAtTime(v.to + d, t + v.ms);
      g.gain.setValueAtTime(v.g, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + v.ms);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + v.ms + 0.01);
    } catch (e) {}
  }

  /* ── the totem sound ────────────────────────────────────────────
     Sample first, synth if it isn't there — same deal as the vine
     boom. Drop the real one at audio/totem.mp3 and it gets used
     automatically; it isn't bundled because it's Mojang's recording.

     The synth is modelled on what the sound actually is rather than
     on a generic chime: a major triad sweeping up a fifth (the
     "blessing" shape that makes it read as a save rather than a hit),
     with a staggered sparkle an octave and a half above so the top
     end shimmers instead of sitting still. */
  var tSample = null, tSampleOk = true;
  try {
    tSample = new Audio();
    /* The real one is item.totem.use, subtitle "Totem activates", and
       the wiki serves it as Totem_of_Undying.ogg. Chrome and Firefox
       play ogg/vorbis natively so that is preferred; Safari does not,
       hence the mp3 branch if you convert one. See audio/README.txt. */
    var canOgg = !!tSample.canPlayType &&
                 tSample.canPlayType('audio/ogg; codecs="vorbis"') !== '';
    tSample.src = canOgg ? 'audio/totem.ogg' : 'audio/totem.mp3';
    tSample.preload = 'auto';
    tSample.volume = 0.40;        /* the real file is mastered loud — it is
                                     a "you nearly died" cue, not a ui blip */
    tSample.addEventListener('error', function () { tSampleOk = false; });
  } catch (e) { tSampleOk = false; }

  function totemSound() {
    if (reduced) return;
    if (tSampleOk && tSample) {
      try {
        tSample.currentTime = 0;
        var p = tSample.play();
        if (p && p.catch) p.catch(synthTotem);
        return;
      } catch (e) {}
    }
    synthTotem();
  }

  function synthTotem() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var t = actx.currentTime;
      var out = actx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      out.connect(actx.destination);

      [523.25, 659.25, 783.99].forEach(function (f, i) {      // C E G
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = i === 0 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(f * 0.75, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.55);
        g.gain.setValueAtTime(0.22 / (i + 1.4), t);
        o.connect(g); g.connect(out);
        o.start(t); o.stop(t + 1.5);
      });

      for (var k = 0; k < 5; k++) (function (k) {
        var o = actx.createOscillator(), g = actx.createGain(), st = t + 0.06 * k;
        o.type = 'sine';
        o.frequency.setValueAtTime(1568 * (1 + k * 0.22), st);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.055, st + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.42);
        o.connect(g); g.connect(out);
        o.start(st); o.stop(st + 0.45);
      })(k);
    } catch (e) {}
  }

  /* ── blade noises ───────────────────────────────────────────────
     whoosh fires as the strike begins, not when it lands — air moves
     before the blow, and hearing it early is most of what sells the
     speed. snap is the break: a short bright crack with a low thud
     under it, no sustain. locked is the door refusing. */
  function noiseBuf(len) {
    var b = actx.createBuffer(1, Math.max(1, (actx.sampleRate * len) | 0), actx.sampleRate);
    var ch = b.getChannelData(0);
    for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return b;
  }
  function ctx() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function whoosh() {
    if (reduced) return;
    try {
      var a = ctx(), t = a.currentTime, len = 0.26;
      var s = a.createBufferSource(); s.buffer = noiseBuf(len);
      var bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(380, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 0.11);
      bp.frequency.exponentialRampToValueAtTime(320, t + len);
      var g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.20, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(bp); bp.connect(g); g.connect(a.destination);
      s.start(t); s.stop(t + len);
    } catch (e) {}
  }

  function snap() {
    if (reduced) return;
    try {
      var a = ctx(), t = a.currentTime;
      var s = a.createBufferSource(); s.buffer = noiseBuf(0.09);
      var hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2100;
      var g = a.createGain();
      g.gain.setValueAtTime(0.34, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      s.connect(hp); hp.connect(g); g.connect(a.destination);
      s.start(t); s.stop(t + 0.1);

      var o = a.createOscillator(), og = a.createGain();   // the weight under it
      o.type = 'sine';
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.16);
      og.gain.setValueAtTime(0.30, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.connect(og); og.connect(a.destination);
      o.start(t); o.stop(t + 0.35);
    } catch (e) {}
  }

  function locked() {
    if (reduced) return;
    try {
      var a = ctx(), t = a.currentTime;
      for (var k = 0; k < 2; k++) {
        var s = a.createBufferSource(); s.buffer = noiseBuf(0.05);
        var bp = a.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = 1400; bp.Q.value = 6;
        var g = a.createGain();
        g.gain.setValueAtTime(0.16, t + k * 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.1 + 0.05);
        s.connect(bp); bp.connect(g); g.connect(a.destination);
        s.start(t + k * 0.1); s.stop(t + k * 0.1 + 0.06);
      }
    } catch (e) {}
  }

  /* Menu navigation. Deliberately the quietest thing in this file —
     it fires on every arrow key, and anything with body to it becomes
     unbearable by the fourth tile. Sine, 25ms, no decay tail. */
  function tick() {
    if (reduced) return;
    try {
      var a = ctx(), t = a.currentTime;
      var o = a.createOscillator(), g = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1180, t);
      g.gain.setValueAtTime(0.045, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + 0.03);
    } catch (e) {}
  }

  NEU.sfx = { whoosh: whoosh, snap: snap, locked: locked, tick: tick };

  /* ── the particles ──────────────────────────────────────────────
     Drawn as integer-aligned fillRects, never circles — this page is
     pixels, and a half-pixel coordinate makes the browser antialias
     the edges into mush. Green and gold, thrown outward with gravity
     and a little drag. The loop stops itself the moment the last one
     dies, so nothing runs between bursts. */
  var pcv  = document.getElementById('sansParts');
  var pctx = (pcv && pcv.getContext) ? pcv.getContext('2d') : null;
  var parts = [], praf = 0, plast = 0;
  var PAL = ['#3FBF6F', '#7CE07C', '#C9A227', '#EFEBE4'];

  function burst() {
    if (!pctx || reduced) return;
    var cx = pcv.width / 2, cy = pcv.height / 2;
    parts = [];
    for (var i = 0; i < 26; i++) {
      var a = Math.random() * Math.PI * 2, sp = 26 + Math.random() * 62;
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 26,        // biased up, so it lifts before it falls
        life: 0, max: 0.7 + Math.random() * 0.5,
        s: 2 + (Math.random() * 3 | 0),
        c: PAL[Math.random() * PAL.length | 0]
      });
    }
    if (!praf) { plast = performance.now(); praf = requestAnimationFrame(pstep); }
  }

  function pstep(now) {
    var dt = Math.min(0.05, (now - plast) / 1000); plast = now;
    pctx.clearRect(0, 0, pcv.width, pcv.height);
    var alive = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      alive++;
      p.vy += 150 * dt;                    // gravity
      p.vx *= 0.98; p.vy *= 0.98;          // drag
      p.x += p.vx * dt; p.y += p.vy * dt;
      pctx.globalAlpha = 1 - p.life / p.max;
      pctx.fillStyle = p.c;
      pctx.fillRect(p.x | 0, p.y | 0, p.s, p.s);
    }
    pctx.globalAlpha = 1;
    praf = alive ? requestAnimationFrame(pstep) : 0;
    if (!alive) pctx.clearRect(0, 0, pcv.width, pcv.height);
  }

  /* ── the textbox ────────────────────────────────────────────────
     Letter by letter, because an undertale box that just appears
     fully written is not an undertale box. */
  /* The second argument names the speaker, and it can be a single
     string for the whole call or an array running parallel to `lines`
     — the dog handing over the hammer is narration first and him
     second, and forcing that into one voice loses the beat. */
  var queue = [], queueV = [], typing = null, curV = 'sans';
  var curIdx = 0, curTotal = 0, watch = null;
  var tface = document.getElementById('tboxFace');
  var tfaceImg = document.getElementById('tboxFaceImg');
  var FACE = { sans: 'img/Sans_sprite.webp', dog: 'img/annoying-dog.gif', tv: 'img/tv.svg',
               witch: 'img/act4/witch-face.png',
               /* real mod filenames — HoodlessHeadIcon/HoodedHeadIcon from
                  NPCs/SupremeCalamitas/, see js/data/sheets.js scalFace* */
               scal: 'img/act4/calamity/HoodlessHeadIcon.png',
               scalHood: 'img/act4/calamity/HoodedHeadIcon.png' };

  /* Only the src is set here. Whether the portrait shows at all is a
     css question, because hiding it also has to re-do the box's grid
     columns — doing that from js would mean the layout rule lived in
     two files. A speaker with no face in FACE hides the portrait: it
     used to keep the PREVIOUS speaker's face, which is how narration
     and the witch wore Sans's. */
  function setFace(who) {
    var src = FACE[who];
    if (tface) tface.hidden = !src;
    if (src && tfaceImg && tfaceImg.getAttribute('src') !== src) {
      tfaceImg.setAttribute('src', src);
    }
  }
  function say(lines, who) {
    queue = lines.slice();
    queueV = lines.map(function (_, i) {
      return Array.isArray(who) ? (who[i] || 'narr') : (who || 'sans');
    });
    curIdx = 0; curTotal = lines.length;
    tbox.hidden = false;
    next();
  }
  function next() {
    clearInterval(typing); clearTimeout(next.hold);
    if (!queue.length) {
      tbox.hidden = true;
      /* the talk ended or was cut short — the watcher wants to know */
      if (watch) watch(-1, -1);
      return;
    }
    var line = queue.shift(), i = 0;
    curV = queueV.shift() || 'sans';
    curIdx++;
    if (watch) watch(curIdx, curTotal);
    /* The box wears the speaker too. His portrait sat in the corner of
       EVERY box on the page — including the dog's and the television's
       — which is the loudest reason it all read as him talking. The
       face follows the voice, and narration has no face at all,
       because narration is not a person. */
    tbox.setAttribute('data-who', curV);
    setFace(curV);
    ttxt.textContent = '';
    if (tmore) tmore.hidden = true;
    if (reduced) {                       // no typing, just the line
      ttxt.textContent = line;
      if (tmore) tmore.hidden = false;
      next.hold = setTimeout(next, 2600);
      return;
    }
    var v = curV;
    typing = setInterval(function () {
      ttxt.textContent = line.slice(0, ++i);
      if (i % 2 === 0) blip(v);
      if (i >= line.length) {
        clearInterval(typing);
        if (tmore) tmore.hidden = false;
        next.hold = setTimeout(next, 2400);
      }
    }, 42);
  }

  /* The dialogue box is the only one on the site and every new scene
     needs it, so it is lent out rather than reimplemented. Act IV
     talks through this — same typing, same voices, same portraits,
     same z-index, no second box to keep in sync. */
  NEU.talk = function (lines, who) { say(lines, who); };
  /* Clear the box without saying anything new — rooms call this on
     entry so a door does not carry the last room's half-typed line. */
  NEU.talk.close = function () {
    clearInterval(typing); clearTimeout(next.hold);
    queue = [];
    if (tbox) tbox.hidden = true;
    if (watch) watch(-1, -1);
  };
  NEU.hush = function () { shutUp(); };
  /* Watchers get (index, total) as each line starts and (-1, -1) when
     the box closes, interrupted or finished — the engine uses it to
     remember where a dialogue was abandoned. */
  NEU.talkWatch = function (fn) { watch = fn; };
  NEU.talkUnwatch = function () { watch = null; };
  NEU.tboxOpen = function () { return !tbox.hidden; };

  /* Kills the box mid-sentence. Needed because he can be scrolled off
     screen while still talking, and a dialog box for someone who is no
     longer there is just litter. */
  function shutUp() {
    clearInterval(typing); clearTimeout(next.hold);
    queue = []; queueV = []; ttxt.textContent = ''; tbox.hidden = true;
    if (watch) watch(-1, -1);
  }

  /* ── the small totem pop ────────────────────────────────────────
     The real totem webp, which already spins by itself over 60 frames
     / 1830ms. So this uses totemRise rather than the cat's totemPop:
     same timing curve and same drift, no rotation, because the sprite
     is doing the rotating. Two spins fighting each other looked like a
     glitch.

     Re-setting src with a cache-buster is what restarts an animated
     webp from frame one — without it the browser reuses the decoded
     image and the second pop starts wherever the first left off. */
  var popImg = document.getElementById('sansPopImg');
  var popT = null;
  function popTotem() {
    if (!pop || !popImg) return;
    clearTimeout(popT);
    pop.classList.remove('is-pop');
    popImg.src = 'img/totem.webp?' + Date.now();
    void pop.offsetWidth;
    var a = Math.random() * Math.PI * 2;
    pop.style.setProperty('--tx', (Math.cos(a) * 30).toFixed(1) + 'px');
    pop.style.setProperty('--ty', (Math.sin(a) * 14 - 30).toFixed(1) + 'px');
    pop.classList.add('is-pop');
    burst();
    totemSound();
    popT = setTimeout(function () { pop.classList.remove('is-pop'); }, 1830);
  }

  /* ── sword position ─────────────────────────────────────────────
     The element is position:fixed and moved only by transform, so
     nothing here triggers layout. Home is a DOCUMENT coordinate; the
     loop converts it to a screen coordinate every frame, which is
     what makes it sit still at the top of the page while you scroll
     past it. */
  var state = 'away';
  var px = 0, py = 0;              // current screen position
  var fx = 0, fy = 0, ft = 0;      // flight: target + start time
  var FLY_MS = 620;

  function homeDoc() {
    return { x: innerWidth * 0.78, y: innerHeight * 0.30 };
  }
  function homeScreen() {
    var h = homeDoc();
    return { x: h.x, y: h.y - scrollY };
  }

  /* ── the launch ─────────────────────────────────────────────────
     The old spawn tweened the sword between two points on a cubic and
     it never read as a throw. Three things were wrong and all three
     are the same class of mistake:

       · it appeared at full size out of nothing — no cause
       · it travelled in a straight line — a thrown object moves on a
         PARABOLA, and gravity is the entire vocabulary of "thrown"
       · it left the screen with no trace, so you lost the object

     So: materialise in his hand (260ms scale-in, ease-out because
     entering is ease-out), dip back toward his shoulder and
     decelerate — the same anticipation that fixed the swing — then
     release with a real velocity and let gravity have it.

     The velocity is SOLVED rather than guessed. To pass through the
     target in time T under gravity g:
         vx = (tx - x) / T
         vy = (ty - y) / T - ½·g·T
     which is why it arcs up, slows, and arrives instead of sliding
     there in a straight line. */
  var SP_HOLD = 900, SP_DIP = 1120, SP_GO = 1560;
  var spawnT0 = 0, launched = false;
  var slast = performance.now();
  var cue = document.getElementById('swordCue'), cueDone = false;

  function loop(now) {
    requestAnimationFrame(loop);
    now = now || performance.now();
    var dt = Math.min(0.05, (now - slast) / 1000); slast = now;

    /* The key runs its own physics independent of the sword's state —
       by the time it exists the sword is gone, and it has to keep
       falling whether or not sans is on screen. */
    if (kstate !== 'off' && kel) keyStep(now);

    if (state === 'away' || state === 'here' || state === 'broken') return;

    if (state === 'spawn') {
      /* Centre of the VIEWPORT, not sans' hand. This is the whole fix:
         you click him at the bottom of a five-viewport page, so the
         old version solved a parabola across ~4000px and the sword
         crossed the screen in two frames — technically a beautiful arc,
         visually a blink. Nothing about the easing could rescue that,
         because the problem was the distance.

         So the animation no longer travels the distance. It plays out
         entirely on screen — appear, be looked at, wind up, leave —
         and the 4000px journey is implied by the exit rather than
         animated. The sword is simply placed at the top of the
         document once it is out of sight. */
      var ms = now - spawnT0;
      var cx = innerWidth / 2, cy = innerHeight * 0.44;

      if (ms < SP_HOLD) {                       // present it. hold. be looked at.
        px = cx; py = cy;
        NEU.sword && NEU.sword.setBoost(1.55);
      } else if (ms < SP_DIP) {                 // wind up: dip, decelerating
        var kd = 1 - Math.pow(1 - (ms - SP_HOLD) / (SP_DIP - SP_HOLD), 3);
        px = cx; py = cy + 30 * kd;
        NEU.sword && NEU.sword.setBoost(1.55 - 0.15 * kd);
      } else {                                  // and away, accelerating
        if (!launched) {
          launched = true;
          NEU.sword && NEU.sword.setPose('fly');
          if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
        }
        var kg = Math.min(1, (ms - SP_DIP) / (SP_GO - SP_DIP));
        px = cx;
        /* ease-IN on the way out: leaving accelerates, entering
           decelerates. The reverse is the single most common way to
           make an exit feel wrong. */
        py = cy + 30 - (cy + 30 + 220) * (kg * kg);
        NEU.sword && NEU.sword.setBoost(1.40 - 0.40 * kg);
        if (ms >= SP_GO) {
          NEU.sword && NEU.sword.setBoost(1);
          state = 'stuck';
          NEU.sword && NEU.sword.setPose('stuck');
        }
      }
    } else if (state === 'fly') {
      var k = Math.min(1, (now - ft) / FLY_MS);
      var ee = 1 - Math.pow(1 - k, 3);
      var h = homeScreen();
      px = fx + (h.x - fx) * ee;
      py = fy + (h.y - fy) * ee;
      if (k >= 1) { state = 'stuck'; NEU.sword && NEU.sword.setPose('stuck'); }
    } else if (state === 'stuck') {
      var s = homeScreen(); px = s.x; py = s.y;
    }

    /* Spatial continuity. Once it is above the fold you have no idea
       where it went, which was the single worst thing about the old
       spawn — worse than the easing. This points at it. */
    /* Once. It is a one-time orientation aid, not a permanent badge —
       after the first trip you know where the sword lives. */
    if (cue && !cueDone && state === 'stuck' && py < -24) {
      cueDone = true;
      cue.classList.add('is-on');
      setTimeout(function () { cue.classList.remove('is-on'); }, 4200);
    }

    NEU.sword && NEU.sword.setScreenPos(px, py);
  }
  requestAnimationFrame(loop);

  function flyHome() {
    fx = px; fy = py; ft = performance.now();
    state = 'fly';
    NEU.sword && NEU.sword.setPose('fly');
  }

  /* ── he comes and goes with the scroll ──────────────────────────
     This used to be gated on state, which was the bug: the moment you
     picked the sword up the observer stopped hiding him, so he stayed
     pinned in the corner for the whole trip up the page. He now leaves
     whenever the contact section leaves, regardless of what you are
     carrying — which is the entire point of the errand. Go up for the
     sword and he is gone; come back down and he is there again.

     hideT holds the `hidden` attribute back until the fade has
     actually finished. Set it immediately and display:none lands on
     the first frame, so the transition never gets to render. */
  var hideT = null;
  var onScreen = false;          // is the contact section in view right now

  function showSans() {
    onScreen = true;
    /* The sleep is queued rather than immediate — see goToSleep. If it
       is still pending when you come back, do the swap NOW, while he is
       still behind the `hidden` attribute, so what fades in is the pile
       of blankets rather than him popping out of existence. */
    if (wantSleep && !asleep) goToSleep();
    if (asleep) { maybeSwitch(); tvState(); return; }
    clearTimeout(hideT);
    sans.hidden = false;
    requestAnimationFrame(function () { sans.classList.add('is-in'); });
    if (state === 'away') state = 'here';
    if (NEU.quest) NEU.quest.mark('sans');
  }
  function hideSans() {
    onScreen = false;
    clearTimeout(hideT);
    sans.classList.remove('is-in');
    hideT = setTimeout(function () { sans.hidden = true; trySleep(); }, 520);
    shutUp();
  }

  var contact = document.getElementById('contact');
  if (contact && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.isIntersecting ? showSans() : hideSans(); });
    }, { threshold: 0.35 }).observe(contact);
  } else {
    showSans();
  }

  /* ── click sans ─────────────────────────────────────────────────*/
  btn.addEventListener('click', function () {
    /* Feeding him beats everything else he might have to say. */
    if (hasFood) { summonDog(); return; }
    if (state === 'broken') {
      say(dogOut ? ["he's not going anywhere either."]
                 : ["door's up top. the key's around here somewhere."]);
      return;
    }
    if (state === 'here') {
      say(GREET);
      /* Appears in his left hand, winds up, then gets thrown. See the
         launch block below for why it is a solved parabola and not a
         tween. */
      px = innerWidth / 2; py = innerHeight * 0.44;
      launched = false;
      NEU.sword && NEU.sword.show();
      NEU.sword && NEU.sword.materialise();
      NEU.sword && NEU.sword.setPose('spawn');
      state = 'spawn'; spawnT0 = performance.now();
    } else if (state === 'stuck' || state === 'fly') {
      say(["it's up at the top. i'm not going to get it for you."]);
    }
  });

  /* ── pick it up ─────────────────────────────────────────────────*/
  function overSans(x, y) {
    if (sans.hidden) return false;
    var r = sans.getBoundingClientRect();
    var m = 14;                                   // a little forgiveness
    return x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
  }

  sword.addEventListener('pointerdown', function (e) {
    if (state !== 'stuck') return;
    e.preventDefault();
    state = 'held';
    NEU.sword && NEU.sword.setPose('held');
    px = e.clientX; py = e.clientY;
    if (!CARRY) sword.setPointerCapture && sword.setPointerCapture(e.pointerId);
  });

  addEventListener('pointermove', function (e) {
    if (state !== 'held') return;
    px = e.clientX; py = e.clientY;
  }, { passive: true });

  /* A hit lands on him, not just near him. */
  function shake() {
    sans.classList.remove('is-hit');
    void sans.offsetWidth;
    sans.classList.add('is-hit');
    setTimeout(function () { sans.classList.remove('is-hit'); }, 380);
  }

  /* ── the break ──────────────────────────────────────────────────
     He runs out of things to say and takes the sword off you. The
     blade half spins away and fades; the hilt stays, and the hilt IS
     the key — pommel for the bow, grip for the shaft, guard and the
     snapped stub for the bit. That is why the break is drawn just
     above the guard rather than through it. */
  /* ── the key, as an object with weight ──────────────────────────
     Not an inventory entry. It lands to his left, falls, bounces once
     or twice and stays where it stops — and if you drop it halfway up
     the page it stays THERE, because a thing with mass does not
     politely return to your hand.

     The door is opened by throwing it, not by clicking: pick it up,
     carry it to the hero, and flick. Velocity comes from the last
     ~90ms of pointer travel rather than from the release point alone,
     so a fast flick reads as fast even if the pointer barely moved on
     the final frame — sampling one frame gives wildly noisy speeds.

     Screen space throughout, matching the sword. The element is fixed
     and moved only by transform, so none of this causes layout. */
  var hasKey = false;
  var chip = document.getElementById('keyChip');
  var kel  = document.getElementById('keyObj');

  var kstate = 'off';                    // off | fall | rest | held | thrown
  /* kx is a screen x (there is no horizontal scroll) but ky is a
     DOCUMENT y — the key falls to the bottom of the PAGE, not the
     bottom of the viewport, so it keeps falling past the fold and
     comes to rest on the last pixel of the document. Screen position
     is ky - scrollY, applied only at draw time. */
  var kx = 0, ky = 0, kvx = 0, kvy = 0, krot = 0, kRest = 90, klast = 0;
  function docH() {
    var b = document.body, e = document.documentElement;
    return Math.max(b.scrollHeight, e.scrollHeight, e.offsetHeight);
  }
  var GRAV = 2400, FLOOR = 46, WALL = 26;
  var THROW_MIN = 950;                   // px/s before it counts as "with force"
  var trk = [];

  function keyStep(now) {
    var dt = Math.min(0.033, (now - klast) / 1000); klast = now;

    if (kstate === 'held') {
      krot += (0 - krot) * 0.2;          // held upright, ready to throw
    } else if (kstate === 'rest') {
      krot += (kRest - krot) * 0.14;     // settles onto its side
    } else {
      var fromX = kx, fromY = ky;        // kept for the swept hit test
      kvy += GRAV * dt;
      kx  += kvx * dt;
      ky  += kvy * dt;
      krot += kvx * dt * 0.85;           // spin follows travel, so it tumbles

      var fy = docH() - FLOOR;            // bottom of the PAGE
      if (ky >= fy) {
        ky = fy;
        kvy = -kvy * 0.30;               // a dead-ish bounce; it is a lump of metal
        kvx *= 0.68;
        if (Math.abs(kvy) < 70) {
          kvy = 0; kvx = 0; kstate = 'rest';
          kRest = Math.round((krot - 90) / 360) * 360 + 90;   // lie down the short way
        }
      }
      if (kx < WALL) { kx = WALL; kvx = -kvx * 0.5; }
      if (kx > innerWidth - WALL) { kx = innerWidth - WALL; kvx = -kvx * 0.5; }

      /* Follow it down.

         The floor is the bottom of the DOCUMENT, and from where sans
         stands that can be several hundred pixels below the viewport
         edge — so the key dropped straight past the fold, landed out
         of sight, and only turned up if you happened to scroll to the
         very bottom later. That was the whole of "it doesn't display
         at first" AND "it gets stuck": you never saw it fall, so the
         fall looked like it never happened.

         Only on the initial drop, and only downward. A throw is aimed,
         and yanking the page around mid-throw would be hostile.
         `behavior: 'instant'` matters — html has scroll-behavior:
         smooth, and a smooth scroll would lag a frame behind the key
         every step and turn the follow into a rubber band. */
      if (kstate === 'fall') {
        var edge = scrollY + innerHeight - 96;
        if (ky > edge) {
          try { window.scrollTo({ top: ky - innerHeight + 96, behavior: 'instant' }); }
          catch (e) { window.scrollTo(0, ky - innerHeight + 96); }
        }
      }

      if (kstate === 'thrown') keyHit(fromX, fromY);
    }

    kel.style.transform = 'translate3d(' + Math.round(kx) + 'px,' +
                          Math.round(ky - scrollY) + 'px,0) translate(-50%,-50%) rotate(' +
                          krot.toFixed(1) + 'deg)';
  }

  /* A hit only counts against a door you can actually see — doorScreenPos
     returns null when the hero has scrolled away or the door is facing
     into the page. So you have to carry it up AND turn the cube. */
  /* Distance from a point to a line SEGMENT, not to the infinite line —
     clamping t to [0,1] is what keeps it to the span actually
     travelled this frame. */
  function segDist(ax, ay, bx, by, cx, cy) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(cx - ax, cy - ay);
    var t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / l2));
    return Math.hypot(cx - (ax + t * dx), cy - (ay + t * dy));
  }

  function keyHit(fromX, fromY) {
    var d = NEU.doorScreenPos && NEU.doorScreenPos();
    if (!d) return;
    /* SWEPT, not point-in-circle. A hard throw covers more ground in a
       single frame than the door is wide — 6000px/s at 60fps is 100px
       per step against a ~70px target — so testing only where the key
       ENDED UP lets a good throw tunnel clean through. Testing the
       segment it crossed is the difference between the mechanic
       working and it silently failing on exactly the hardest throws,
       which are the ones the player is most sure they got right. */
    if (segDist(fromX, fromY, kx, ky, d.x, d.y + scrollY) > d.r + 20) return;

    if (Math.hypot(kvx, kvy) < THROW_MIN) {
      if (!keyHit.nagged) { keyHit.nagged = true; say(["put some shoulder into it."]); }
      return;
    }

    /* A short cooldown, because a hit reflects the key rather than
       removing it — without this the next frame is still inside the
       door's radius and the panel reopens every frame.

       The `keyHit.at &&` guard is load-bearing. Defaulting the
       timestamp to 0 and comparing against it means the cooldown is
       "active" for the first 900ms of page life, so a throw made in
       that window is silently swallowed. By hand you would never
       notice; through the dev console, where you can be holding the
       key one second after load, it fails every time. Only apply a
       cooldown once there has actually been a hit to cool down from. */
    var nowMs = performance.now();
    if (keyHit.at && nowMs - keyHit.at < 900) return;
    keyHit.at = nowMs;

    /* The key BOUNCES OFF. It used to be consumed here, and that was
       a dead end: the key vanished, the door had no memory of being
       opened, and once you closed the panel the room was unreachable
       forever. Objects that evaporate on use also make the world feel
       thin — you threw a lump of metal at a door, it should still be
       a lump of metal afterwards. */
    kvx = -kvx * 0.42;
    kvy = -Math.abs(kvy) * 0.42 - 120;
    kstate = 'thrown';

    NEU.sfx && NEU.sfx.snap && NEU.sfx.snap();
    unlockDoor();
    openPanel();
  }

  if (kel) {
    kel.addEventListener('pointerdown', function (e) {
      if (kstate === 'off' || kstate === 'held') return;
      e.preventDefault();
      kstate = 'held'; trk.length = 0;
      kx = e.clientX; ky = e.clientY + scrollY;
      kel.classList.add('is-held');
      kel.setPointerCapture && kel.setPointerCapture(e.pointerId);
    });

    addEventListener('pointermove', function (e) {
      if (kstate !== 'held') return;
      kx = e.clientX; ky = e.clientY + scrollY;
      trk.push({ t: performance.now(), x: kx, y: ky });
      if (trk.length > 8) trk.shift();
    }, { passive: true });

    addEventListener('pointerup', function (e) {
      if (kstate !== 'held') return;
      kel.classList.remove('is-held');
      var now = performance.now(), a = null;
      for (var i = trk.length - 1; i >= 0; i--) {
        if (now - trk[i].t > 90) break;
        a = trk[i];
      }
      if (a && now - a.t > 8) {
        var dt = (now - a.t) / 1000;
        kvx = (e.clientX - a.x) / dt;
        kvy = (e.clientY + scrollY - a.y) / dt;
      } else { kvx = 0; kvy = 0; }
      kx = e.clientX; ky = e.clientY + scrollY;
      kstate = 'thrown'; keyHit.nagged = false;
      if (Math.hypot(kvx, kvy) > 420 && NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    });
  }

  function gainKey() {
    NEU.sword && NEU.sword.hide();
    state = 'broken';
    hasKey = true; NEU.hasKey = true;
    if (NEU.doorGlow) NEU.doorGlow(true);
    if (NEU.quest) NEU.quest.mark('break');

    /* to his LEFT, tossed out of his hand, then gravity has it */
    var r = sans.getBoundingClientRect();
    kx = r.left - 34; ky = r.top + r.height * 0.35 + scrollY;
    kvx = -130; kvy = -190; krot = 0;
    kstate = 'fall'; klast = performance.now();
    if (kel) kel.hidden = false;

    /* the chip names it once and then gets out of the way — the key
       itself is the thing you interact with, not a corner badge */
    if (chip) {
      chip.hidden = false;
      requestAnimationFrame(function () { chip.classList.add('is-in'); });
      setTimeout(function () {
        chip.classList.remove('is-in');
        setTimeout(function () { chip.hidden = true; }, 520);
      }, 4200);
    }
    say(BREAK);
  }

  function attempt(x, y) {
    if (state !== 'held') return;
    if (!overSans(x, y)) { flyHome(); return; }

    state = 'swing';
    var willBreak = swings >= LINES.length;    // nothing left to say

    NEU.sword.swing(
      function () {                            // on impact
        shake();
        if (willBreak) {
          snap();
          NEU.sword.breakApart(gainKey);       // cancels the follow-through
          return;
        }
        popTotem();
        say([LINES[swings]]);
        swings++;
      },
      function () {                            // after the follow-through
        if (!willBreak) flyHome();
      }
    );
  }

  /* ── the door ───────────────────────────────────────────────────
     scene.js raycasts the click and calls this; it does not know or
     care whether you are carrying anything. */
  var panel = document.getElementById('panel');

  function openPanel() {
    if (!panel) return;
    panel.hidden = false;
    requestAnimationFrame(function () { panel.classList.add('is-open'); });
    var c = document.getElementById('panelClose');
    c && c.focus();
  }
  function closePanel() {
    if (!panel) return;
    panel.classList.remove('is-open');
    setTimeout(function () { panel.hidden = true; }, 420);
  }

  /* ── the door stays unlocked ────────────────────────────────────
     A lock you have already opened does not re-lock itself, and making
     the visitor repeat a physics throw to get back into a room they
     have already earned is busywork. Once it's open:

       · clicking the door just opens it
       · a small "inside" chip appears and stays, because the door is
         at the top of the page on a face you have to rotate the cube
         to see — findable once, tedious every time after that

     The chip is the actual answer to "there's no way back in". The
     unlocked door is the consistent one. */
  var doorOpened = false;

  function unlockDoor() {
    if (doorOpened) return;
    doorOpened = true;
    NEU.doorOpen = true;
    if (NEU.doorGlow) NEU.doorGlow(true);   // stays lit: it is usable, not locked
    if (NEU.quest) NEU.quest.mark('door');
  }

  NEU.tryDoor = function () {
    if (doorOpened) { openPanel(); return; }
    locked();
    if (!hasKey) { say(["that's locked, buddy. doors do that."]); return; }
    say(["you've got the key. clickin' at it isn't gonna do much.", "throw it."]);
  };

  if (panel) {
    var pc = document.getElementById('panelClose');
    pc && pc.addEventListener('click', closePanel);
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) closePanel();
    });
  }

  if (CARRY) {
    /* Touch: you cannot hold a finger down and scroll with it, so the
       press-and-hold contract is impossible here. Tap to pick up, tap
       sans to swing. A tap that lands on neither drops the sword back
       home — otherwise the blade is stranded mid-scroll with no way to
       re-grab it (grabbing requires the 'stuck' state). */
    addEventListener('pointerup', function (e) {
      if (state !== 'held') return;
      if (overSans(e.clientX, e.clientY)) attempt(e.clientX, e.clientY);
      else flyHome();
    });
    addEventListener('pointercancel', function () { if (state === 'held') flyHome(); });
  } else {
    addEventListener('pointerup', function (e) { attempt(e.clientX, e.clientY); });
    addEventListener('pointercancel', function () { if (state === 'held') flyHome(); });
  }

  /* Clicking the box advances it, the way it should. */
  tbox.addEventListener('click', next);

  /* ── dog food, and what it buys ─────────────────────────────────
     Survive twenty seconds in the room and you come out holding
     "dog food?" — the question mark is doing a lot of work there.
     Give it to him and the dog turns up, which is the only way to
     learn about the code. That ordering is the point: the reward for
     the hard version is being told there was an easy version. */
  var hasFood = false, dogOut = false;
  var foodChip = document.getElementById('foodChip');
  var dogEl    = document.getElementById('dog');

  function showChip(el, on) {
    if (!el) return;
    if (on) {
      el.hidden = false;
      requestAnimationFrame(function () { el.classList.add('is-in'); });
    } else {
      el.classList.remove('is-in');
      setTimeout(function () { el.hidden = true; }, 520);
    }
  }

  NEU.grantDogFood = function () {
    if (hasFood || dogOut) return;
    hasFood = true;
    showChip(foodChip, true);
  };

  function summonDog() {
    if (!dogEl || dogOut) return;
    dogOut = true; hasFood = false;
    showChip(foodChip, false);
    dogEl.hidden = false;
    requestAnimationFrame(function () { dogEl.classList.add('is-in'); });
    if (NEU.quest) NEU.quest.mark('dog');
    /* No totemSound() here. It was firing on every line he speaks in
       this path, and it is a "you nearly died" cue — it belongs to the
       totem actually appearing (popTotem) and nowhere else. */
    say([
      "huh. you actually fed it.",
      "that's toby. he isn't mine. he isn't anyone's, really.",
      "he says thanks. he also says you're doing this the hard way.",
      "type 69420 while you're dodging. clears the whole run.",
      "flip the cosmolight off and back on if you want another go.",
      "door stays open, by the way. corner of your eye, bottom left."
    ]);
  }

  /* The cosmolight resets it, so the whole sequence is replayable
     without a reload. He tells you this himself, which is the only
     reason it is discoverable. */
  var wasLit = document.body.classList.contains('is-lit-mode');
  if (window.MutationObserver) {
    new MutationObserver(function () {
      var lit = document.body.classList.contains('is-lit-mode');
      if (lit === wasLit) return;
      wasLit = lit;
      hasFood = false;
      showChip(foodChip, false);
      if (dogOut) {
        dogOut = false;
        dogEl.classList.remove('is-in');
        setTimeout(function () { dogEl.hidden = true; }, 520);
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── dev hooks ──────────────────────────────────────────────────
     Driven by js/core/dev.js. Deliberately blunt: they set the end state
     directly rather than fast-forwarding the animations, because the
     point is to be standing in the room a second from now. */
  NEU.devSkip = function () {
    /* The skip sets end state directly instead of replaying gainKey,
       so it has to report the steps gainKey would have reported —
       otherwise the tracker permanently disagrees with the game for
       anyone who used the console. */
    if (NEU.quest) { NEU.quest.mark('sans'); NEU.quest.mark('break'); }
    swings = LINES.length;
    state = 'broken';
    hasKey = true; NEU.hasKey = true;
    if (NEU.sword) NEU.sword.hide();
    if (NEU.doorGlow) NEU.doorGlow(true);
    showSans();
    var r = sans.getBoundingClientRect();
    kx = Math.max(48, r.left - 40);
    ky = scrollY + innerHeight - FLOOR;
    kvx = kvy = 0; krot = 90; kRest = 90;
    kstate = 'rest'; klast = performance.now();
    if (kel) kel.hidden = false;
  };
  NEU.devOpenRoom = function () { unlockDoor(); openPanel(); };
  NEU.devDog = function () { hasFood = true; summonDog(); };
  NEU.devSleep = function () { wantSleep = true; goToSleep(); };
  NEU.devSwitch = function () { NEU.devSleep(); switchSeen = false; maybeSwitch(); };
  /* Takes the console AND fills it, because the two things the dock
     needs are exactly the two things that take five minutes to earn. */
  NEU.devTake = function () {
    NEU.devSwitch();
    if (NEU.devCharge) NEU.devCharge(100);
    if (sleepSw) sleepSw.click();
  };
  NEU.devReset = function () { location.reload(); };

  /* ── the dog, the hammer, and the light ─────────────────────────
     Talk to him enough and he produces a hammer. There is exactly one
     thing on this page worth hitting with it.

     The chain deliberately makes you break something that works: the
     Cosmolight is the oldest interaction on the site, and taking it
     away is the only way the blackout means anything. */
  var dogTalks = 0, hasHammer = false, broken = false, hasClicker = false;
  var stuck = false;              // jams the moment you are handed a hammer
  var swBtn = document.getElementById('lightsToggle');
  var hammerChip  = document.getElementById('hammerChip');
  var clickerChip = document.getElementById('clickerChip');
  var darkChip    = document.getElementById('darkChip');
  var dogBtn      = document.getElementById('dogBtn');
  var petHand     = document.getElementById('petHand');
  var sleepEl     = document.getElementById('sleep');
  var sleepSw     = document.getElementById('sleepSwitch');
  var tvEl        = document.getElementById('tv');
  var tvLbl       = document.getElementById('tvLbl');
  var asleep = false, switchSeen = false, docked = false;

  /* The hand lands where the dog actually is rather than at a fixed
     spot, so it reads as petting THAT dog and not as a cursor. */
  function petSwipe() {
    if (!petHand || !dogBtn || reduced) return;
    var r = dogBtn.getBoundingClientRect();
    petHand.hidden = false;
    petHand.style.left = (r.left + r.width / 2) + 'px';
    petHand.style.top  = (r.top + r.height * 0.34) + 'px';
    petHand.classList.remove('is-pet');
    void petHand.offsetWidth;
    petHand.classList.add('is-pet');
  }

  var DOGTALK = [
    "he's looking at you.",
    "still looking.",
    "he wants something. or he's asleep. hard to tell with him.",
    "he's chewing on something.",
    "...okay, that is definitely a hammer."
  ];

  function talkDog() {
    petSwipe();
    if (hasHammer || broken) { say(["he's out of hammers."], 'narr'); return; }
    say([DOGTALK[Math.min(dogTalks, DOGTALK.length - 1)]], 'dog');
    dogTalks++;
    if (dogTalks >= DOGTALK.length) {
      hasHammer = true;
      showChip(hammerChip, true);
      if (NEU.quest) NEU.quest.mark('hammer');
      /* The switch jams at the same moment. Being handed a tool and
         then finding something broken is a much better motivation than
         being handed a tool and told to go vandalise a working one. */
      stuck = true;
      if (swBtn) swBtn.classList.add('is-stuck');
      /* He stops fidgeting once he has given the thing up. */
      if (dogEl) dogEl.classList.add('is-settled');
      setTimeout(function () {
        /* Narration, then him. He does not narrate the dog. */
        say(["he spat out a hammer.",
             "huh. cosmolight's jammed too. that's new.",
             "you've got a hammer. i'm sure it'll be fine."],
            ['narr', 'sans', 'sans']);
      }, 1500);
    }
  }
  if (dogBtn) dogBtn.addEventListener('click', talkDog);

  function smashLight() {
    /* Every state the last repair consumed has to come back, or the
       second blackout is a dead end: the grey door remembers it
       already handed over a clicker, so it hands over nothing, and
       there is no way to fix the light again. Reported as "you get
       stuck if you redo the hammer part" — this is that fix. */
    if (NEU.dark && NEU.dark.reset) NEU.dark.reset();
    if (NEU.quest) NEU.quest.replay(['greydoor', 'answers', 'clicker', 'fixed']);
    hasClicker = false;
    showChip(clickerChip, false);
    hasHammer = false; broken = true; stuck = false;
    showChip(hammerChip, false);
    if (swBtn) { swBtn.classList.remove('is-stuck'); swBtn.classList.add('is-smashed'); }
    document.body.classList.add('is-blackout');
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    if (NEU.quest) NEU.quest.mark('smash');
    showChip(darkChip, true);
    setTimeout(function () { if (NEU.dark) NEU.dark.open(); }, 750);
  }

  NEU.grantClicker = function () {
    if (hasClicker) return;
    hasClicker = true;
    showChip(clickerChip, true);
  };

  NEU.fitClicker = function () { fitClicker(); };
  NEU.hasClicker = function () { return hasClicker; };
  function fitClicker() {
    /* Reset the dog so the whole loop can be run again from the top. */
    dogTalks = 0;
    if (dogEl) dogEl.classList.remove('is-settled');
    hasClicker = false; broken = false;
    showChip(clickerChip, false);
    showChip(darkChip, false);
    document.body.classList.remove('is-blackout');
    if (NEU.dark) NEU.dark.close();
    if (NEU.quest) NEU.quest.mark('fixed');
    if (swBtn) swBtn.classList.remove('is-smashed');
    /* Everyone has had a long day — but he is standing right in front
       of you, so this only ARMS the sleep. goUp() sends the page back
       to the top, he leaves the viewport, and the swap happens where
       you cannot see it. */
    var first = !asleep;             // the loop is replayable; the sleep isn't
    wantSleep = first;
    say(first
      ? ["huh. it fits.",
         "wax free. still not sure what wax was doing in there.",
         "i'm gonna go lie down. don't wait up."]
      : ["huh. it fits. again.",
         "you really like that hammer."]);
    if (first) setTimeout(goUp, 2600);
  }

  /* main.js asks this before doing anything with the switch. Returning
     true means "handled, don't run the normal toggle" — which is how
     one control ends up meaning four different things depending on
     what you are carrying. */
  /* One control, four meanings, in order of precedence. Note that
     fitting the clicker is NOT here any more — the repair happens at
     the switch's guts down in the dark, not at the faceplate. */
  NEU.switchHook = function () {
    if (broken) {
      if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
      say(hasClicker
        ? ["you're holding the part. it doesn't go in from out here."]
        : ["that's a hole in the wall now, buddy."]);
      return true;
    }
    if (stuck && hasHammer) {
      say(["...you hit it.", "you hit the jammed light with a hammer."], 'narr');
      smashLight();
      return true;
    }
    if (stuck) {
      if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
      say(["it's stuck. won't budge either way.",
           "you'd need to hit it with something. hypothetically."]);
      return true;
    }
    return false;
  };

  if (darkChip) darkChip.addEventListener('click', function () {
    if (NEU.dark) NEU.dark.open();
  });

  /* ── the long sleep ─────────────────────────────────────────────
     Nobody leaves. The console turns up beside them on a LATER visit
     rather than immediately, so returning to the page has a reason to
     be interesting a second time.

     IT MUST NOT HAPPEN IN FRONT OF YOU. Fitting the clicker put you
     right next to him, so the old code swapped a standing skeleton for
     a sleeping one while you were staring at both — which does not
     read as "time passed", it reads as a sprite bug. Two halves to the
     fix: the swap is queued behind `wantSleep`, and fitting the clicker
     scrolls the page back to the top so he leaves the viewport on his
     own. Come back down and they have been asleep the whole time. */
  var wantSleep = false;

  function trySleep() {
    if (!wantSleep || asleep) return;
    if (onScreen) return;               // not while you are looking
    goToSleep();
  }

  /* Send the reader up the page. The scroll is what makes him leave,
     and the observer firing hideSans is what actually triggers the
     swap — so this is not decoration, it is the mechanism. */
  function goUp() {
    try {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    } catch (e) { window.scrollTo(0, 0); }
    /* Belt and braces: if the page cannot scroll (short viewport, or a
       browser that ignores the request) nothing will ever leave the
       screen, and a queued sleep that never fires is a dead end. */
    setTimeout(function () { if (wantSleep && !asleep && !onScreen) goToSleep(); }, 1200);
    setTimeout(function () { if (wantSleep && !asleep) goToSleep(); }, 6000);
  }

  function goToSleep() {
    if (asleep) return;
    asleep = true; wantSleep = false;
    if (dogEl)   { dogEl.classList.remove('is-in'); setTimeout(function () { dogEl.hidden = true; }, 520); }
    /* The dog is leaving the page with him, so the flag has to follow
       the DOM — otherwise a slept-through visit keeps telling
       grantDogFood and summonDog that the dog is still out, and the
       feed sequence can never be replayed without the cosmolight. */
    if (dogOut) dogOut = false;
    sans.classList.remove('is-in');
    setTimeout(function () { sans.hidden = true; }, 520);
    if (sleepEl) {
      sleepEl.hidden = false;
      requestAnimationFrame(function () { sleepEl.classList.add('is-in'); });
    }
    if (tvEl) {
      tvEl.hidden = false;
      requestAnimationFrame(function () { tvEl.classList.add('is-in'); });
    }
    tvState();
    if (NEU.quest) NEU.quest.mark('sleep');
  }

  /* Called by the observer: the second time you come back to them. */
  function maybeSwitch() {
    if (!asleep || switchSeen || !sleepSw) return;
    switchSeen = true;
    sleepSw.hidden = false;
    if (NEU.quest) NEU.quest.mark('console');
    say(["...", "that wasn't there before."], 'narr');
  }

  /* ── the dock ───────────────────────────────────────────────────
     What was wrong with it: the console was a decoration. It appeared
     on the blanket and stayed there forever, the television read the
     charge straight out of the bullet room, and "docking" was a
     boolean — you clicked a television across the room and a console
     you had never touched was suddenly inside it.

     Now it is an object. You pick it up (it goes in the tray with the
     hammer and the clicker), it is what carries the charge, and
     docking physically moves it: the sprite flies from wherever it is
     into the television, and the television lights up when it lands.

     The label also has to stop lying. It used to refresh only when the
     contact section re-entered the viewport, so it would read "0% —
     flat" for a fully charged console until you scrolled away and back
     — the single most likely reason this looked broken. It now polls
     while it is on screen, which costs one comparison every 400ms. */
  var hasConsole = false, docking = false;
  var swChip = document.getElementById('swChip');
  var swChipTxt = swChip ? swChip.querySelector('span') : null;
  /* The room reads this to decide whether its blue beam has anything
     to charge. */
  NEU.hasConsole = function () { return hasConsole; };

  function charge() { return NEU.charge ? NEU.charge() : 0; }

  function tvState() {
    if (!tvLbl) return;
    var pct = charge();
    if (docked)          tvLbl.textContent = 'playing';
    else if (!hasConsole) tvLbl.textContent = switchSeen ? 'empty dock' : 'dock';
    else if (pct >= 100) tvLbl.textContent = 'dock it';
    else                 tvLbl.textContent = pct + '% — flat';
    if (tvEl) tvEl.classList.toggle('is-ready', !docked && hasConsole && pct >= 100);
    /* The chip carries the charge with it, so the thing in your hands
       and the thing in the dock never disagree about the number. */
    var label = pct >= 100 ? 'a console, charged'
              : pct > 0    ? 'a console, ' + pct + '%'
                           : 'a console, flat';
    if (swChipTxt && hasConsole) swChipTxt.textContent = label;
    /* The room you charge it in is reached through the panel, so the
       panel is where you find out whether you brought it. */
    var pc = document.getElementById('panelCarry');
    if (pc) {
      pc.hidden = !hasConsole || docked;
      var pt = document.getElementById('panelCarryTxt');
      if (pt) pt.textContent = label + (pct >= 100 ? '' : ' — the blue one fills it');
    }
  }
  NEU.tvState = tvState;

  setInterval(function () {
    if (asleep && tvEl && !tvEl.hidden && !docked) tvState();
  }, 400);

  /* Pick it up. */
  if (sleepSw) sleepSw.addEventListener('click', function (e) {
    e.stopPropagation();
    if (hasConsole || docked) return;
    hasConsole = true;
    sleepSw.classList.add('is-taken');
    showChip(swChip, true);
    tvState();
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    say(["you pick it up. it is completely dead.",
         "there's a dock over there. it needs the thing charged first."], 'narr');
  });

  /* Fly it into the dock. Both rects are viewport-space, so the flier
     is position:fixed and no ancestor's transform can drag it off
     course — the console and the television live in different
     positioned containers. */
  function flyToDock(from, to, done) {
    if (reduced || !from || !to) { done(); return; }
    var img = document.createElement('img');
    img.src = 'img/switch2.svg';
    img.alt = '';
    img.className = 'swfly';
    img.style.left = from.left + 'px';
    img.style.top = from.top + 'px';
    img.style.width = Math.max(28, from.width) + 'px';
    document.body.appendChild(img);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
        var dy = (to.top + to.height * 0.62) - (from.top + from.height / 2);
        img.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.34)';
        img.style.opacity = '0.15';
      });
    });
    setTimeout(function () { img.remove(); done(); }, 760);
  }

  /* ── breaking it ────────────────────────────────────────────────
     He tells you to do this at the end of the last corridor, and the
     flag is what makes an object two acts old gain a new verb. Before
     the flag it is a television. After it, it is a television you can
     hit with a sword. Nothing about the television changes. */
  NEU.tvBreakable = function () {
    return !!(NEU.save && NEU.save.flagged('tv_breakable')) && !tvBroken;
  };
  var tvBroken = false;
  NEU.breakTV = function () {
    if (!NEU.tvBreakable()) return false;
    tvBroken = true;
    if (NEU.save) NEU.save.flag('tv_broken', 1);
    if (tvEl) { tvEl.classList.add('is-broke'); tvEl.classList.remove('is-live'); }
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    if (NEU.quest) NEU.quest.mark('a4_smash');
    say(["you put the sword through the television.",
         "something climbs out of it."], 'narr');
    setTimeout(function () { if (NEU.quiz) NEU.quiz.open(); }, 2600);
    return true;
  };

  if (tvEl) tvEl.addEventListener('click', function () {
    /* Carrying the sword and allowed to swing it beats every other
       meaning the television has. */
    if (NEU.tvBreakable() && state === 'held') { NEU.breakTV(); return; }
    if (docked || docking) {
      /* Once it is in, the television is just a way back to the menu. */
      if (docked && NEU.deck) { NEU.deck.open(); return; }
      say(["it's already playing."], 'tv'); return;
    }
    if (!switchSeen) { say(["a television. nothing to put in it."], 'tv'); return; }
    if (!hasConsole) {
      say(["an empty dock.", "the thing that goes in it is over there, on the blanket."], 'tv');
      return;
    }
    var pct = charge();
    if (pct < 100) {
      say(["it's flat. " + pct + "%.",
           "something in that room hits hard enough to charge it. hold still."],
          ['tv', 'sans']);
      return;
    }
    docking = true;
    showChip(swChip, false);
    var from = sleepSw ? sleepSw.getBoundingClientRect() : null;
    /* The console is in your pocket by now, so the flight starts from
       the chip if the sprite on the blanket is no longer laid out. */
    if ((!from || !from.width) && swChip) from = swChip.getBoundingClientRect();
    flyToDock(from, tvEl.getBoundingClientRect(), function () {
      docking = false;
      docked = true;
      hasConsole = false;
      if (sleepSw) sleepSw.hidden = true;
      tvEl.classList.add('is-live');
      tvEl.classList.remove('is-ready');
      tvState();
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.quest) NEU.quest.mark('docked');
      /* The television used to start a fight. It starts a home screen
         now — a fight has one punchline and you can only hear it
         once, a library is a joke you can browse. */
      setTimeout(function () { if (NEU.deck) NEU.deck.open(); }, 420);
    });
  });

  /* ── boot re-arm: the sleep chain is page-lifetime state ────────
      asleep/switchSeen/hasConsole/docked used to live only in module
      vars, so ANY refresh after "let them rest" booted an awake sans,
      an empty dock and no Switch — while the persisted objectives kept
      saying "dock it". Act IV resumes solely through the docked deck,
      so that was a cross-session softlock for the whole second half.
      The quest marks already remember where you were; re-arm from
      them. A console not yet docked comes back empty-handed: the blue
      blaster re-earns the charge, which is the battery's own rule. */
  if (NEU.quest) {
    if (NEU.quest.has('sleep')) {
      asleep = true; switchSeen = true;
      if (sleepSw) sleepSw.hidden = false;
    }
    if (NEU.quest.has('docked')) docked = true;
    else if (NEU.quest.has('console')) hasConsole = true;
  }

  NEU.sans = {
    get state()   { return state; },
    get asleep()  { return asleep; },
    get wantSleep(){ return wantSleep; },
    get onScreen(){ return onScreen; },
    get switchSeen() { return switchSeen; },
    get hasConsole() { return hasConsole; },
    get docked()  { return docked; },
    get voice()   { return curV; },
    get hasHammer(){ return hasHammer; },
    get broken()  { return broken; },
    get hasClicker(){ return hasClicker; },
    get dogTalks(){ return dogTalks; },
    get swings()  { return swings; },
    get hasKey()  { return hasKey; },
    get hasFood() { return hasFood; },
    get dogOut()  { return dogOut; },
    get lines()   { return LINES.length; }
  };
})();
