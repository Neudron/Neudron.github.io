/* music.js — the Act IV soundtrack. Synthesised, not sampled.
   ───────────────────────────────────────────────────────────────────
   Act IV had no music layer at all. Everything in it was either a
   one-shot sound effect or silence.

   WHY THERE ARE NO AUDIO FILES HERE.
   Eight zones at two minutes each, encoded at a polite 96 kbps, is
   about ten megabytes. This is a site people open on a phone, on
   data, and Act IV sits three hours into a chain — nobody is going
   to wait through a download to hear a forest. The whole music layer
   is oscillators and one noise buffer built at runtime: fourteen
   kilobytes of javascript that gzips to about four, and zero bytes of
   audio requested, ever.

   The second reason is the better one. A recorded loop cannot answer
   the game. This one can: layers arrive as a boss loses health, the
   whole bed ducks under dialogue, and moving between two rooms of the
   same zone does not restart anything.

   HOW IT DECIDES WHAT TO PLAY.
   It asks. Nothing calls into this module — no scene was changed to
   add music, exactly as no scene was changed to add thumb controls.
   A 250ms poll reads which scene is running and, in a room, asks the
   engine which tileset it is standing on. **The tileset name IS the
   track name.** That is deliberate: a second room-id → zone map would
   drift the first time a room changed tileset, and fixes16 asserts
   every registered tileset has a track so adding a zone without music
   fails loudly instead of going quiet.

   TIMING COMES FROM AudioContext.currentTime, NEVER from a timer.
   Same rule as rhythm.js. setInterval drifts by tens of milliseconds
   under load, which on a 16th-note grid is audible as a limp. The
   interval only decides *when to schedule*; every note is stamped
   with an exact context time computed by adding step durations.

   NOTHING SOUNDS BEFORE A USER GESTURE. The context is not even
   constructed until the first pointerdown/keydown/touchstart. A track
   asked for earlier is remembered and starts when the gesture lands.

   prefers-reduced-motion does NOT silence this. That preference is a
   statement about vestibular safety, not about sound, and reading it
   as "no audio" takes the soundtrack away from people who never asked
   for that. Anyone who wants it gone has a volume slider in settings
   that goes to zero and persists.                                   */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  if (NEU.music) return;                       /* already built (re-run) */

  var K_VOL = 'opt_music';
  var DEFAULT_VOL = 55;          /* out of 100 — present, not insistent */
  var PEAK = 0.20;               /* what 100 actually means at the bus  */

  var LOOK = 0.20;               /* seconds of notes scheduled ahead    */
  var TICK = 40;                 /* ms between scheduling passes        */
  var POLL = 250;                /* ms between "what scene is running?" */
  var FADE = 1.1;                /* crossfade between zones             */
  var DUCK = 0.34;               /* bed level while the textbox is up   */

  /* ── scales ─────────────────────────────────────────────────────
     Semitones from the root. Phrygian's flat second is doing all the
     gothic work in the castle; the harmonic minor's raised seventh is
     what makes Calamitas sound like she means it. */
  var AEOL = [0, 2, 3, 5, 7, 8, 10];
  var PHRY = [0, 1, 3, 5, 7, 8, 10];
  var DORI = [0, 2, 3, 5, 7, 9, 10];
  var MAJR = [0, 2, 4, 5, 7, 9, 11];
  var HARM = [0, 2, 3, 5, 7, 8, 11];
  var PHDM = [0, 1, 4, 5, 7, 8, 10];

  /* ── the patterns ───────────────────────────────────────────────
     Sixteen characters, one bar, one character per 16th note. '.' is
     a rest; a digit (or 'a'/'b' for 10 and 11) is a scale degree
     ABOVE that bar's chord root, so one pattern moves with the
     harmony instead of needing four copies of itself.

     Written as strings because a bar of music should be legible as a
     bar of music. Nested arrays of nulls are not. */
  function pat(s) {
    var a = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      a.push(c === '.' ? null : parseInt(c, 16));
    }
    return a;
  }

  /* ── the tracks ─────────────────────────────────────────────────
     `chords` is one scale degree per bar — the root the whole bar is
     built on. `base` is the resting intensity: which layers are
     audible when nothing is escalating. Bosses override it.

     Six of these are named after tilesets and must stay that way. */
  var TRACKS = {

    /* zone a — the woods. Sparse and unhurried; you have just walked
       into somebody else's forest and nothing is chasing you yet. */
    woods: {
      bpm: 76, root: 57, scale: AEOL, chords: [0, 5, 3, 4], base: 0.5,
      pad:  { wave: 'triangle', gain: 0.030, oct: 0 },
      bass: { wave: 'sine',     gain: 0.085, oct: -12, pat: pat('0.......4...2...') },
      lead: { wave: 'triangle', gain: 0.050, oct: 12,  pat: pat('....4.2....7..4.') },
      perc: null
    },

    /* zone b — the castle. A drone with a bell over it. The bar
       chords barely move because the room barely does. */
    castle: {
      bpm: 66, root: 50, scale: PHRY, chords: [0, 0, 1, 0], base: 0.5,
      pad:  { wave: 'sawtooth', gain: 0.022, oct: -12 },
      bass: { wave: 'sine',     gain: 0.095, oct: -12, pat: pat('0.......0.......') },
      lead: { wave: 'sine',     gain: 0.045, oct: 24,  pat: pat('......4.....2...') },
      perc: null
    },

    /* zone d — the city. The first track with a pulse in it. */
    city: {
      bpm: 104, root: 48, scale: DORI, chords: [0, 3, 4, 3], base: 0.8,
      pad:  { wave: 'triangle', gain: 0.024, oct: 0 },
      bass: { wave: 'square',   gain: 0.070, oct: -12, pat: pat('0...4...2...4...') },
      lead: { wave: 'square',   gain: 0.038, oct: 12,  pat: pat('0.2.4.2.7.4.2.0.') },
      perc: { gain: 0.085, pat: pat0('k.h.s.h.k.h.s.h.') }
    },

    /* zone e — home. The cute is allowed out here and nowhere else.
       Major, but the sixth degree keeps pulling it back to wistful. */
    home: {
      bpm: 84, root: 53, scale: MAJR, chords: [0, 3, 4, 5], base: 0.8,
      pad:  { wave: 'triangle', gain: 0.030, oct: 0 },
      bass: { wave: 'sine',     gain: 0.080, oct: -12, pat: pat('0.......2...4...') },
      lead: { wave: 'triangle', gain: 0.048, oct: 12,  pat: pat('..4...2...0...7.') },
      perc: { gain: 0.050, pat: pat0('k.....h...k...h.') }
    },

    /* zone g — the prize floor. A game show that has been running
       unattended for some time. */
    prize: {
      bpm: 124, root: 55, scale: MAJR, chords: [0, 4, 5, 3], base: 0.9,
      pad:  { wave: 'square',   gain: 0.018, oct: 0 },
      bass: { wave: 'square',   gain: 0.070, oct: -12, pat: pat('0.0.4.4.2.2.4.4.') },
      lead: { wave: 'square',   gain: 0.040, oct: 12,  pat: pat('4.2.0.2.4.2.7.4.') },
      perc: { gain: 0.090, pat: pat0('k.h.s.h.k.h.s.hh') }
    },

    /* zone k — the storm. Tense, and the pad is doing the tensing. */
    storm: {
      bpm: 96, root: 52, scale: AEOL, chords: [0, 6, 5, 4], base: 0.9,
      pad:  { wave: 'sawtooth', gain: 0.020, oct: 0 },
      bass: { wave: 'square',   gain: 0.080, oct: -12, pat: pat('0.0.....4.4.2...') },
      lead: { wave: 'triangle', gain: 0.042, oct: 12,  pat: pat('....7...4...2...') },
      perc: { gain: 0.080, pat: pat0('k..hk..hs..hk.hh') }
    },

    /* Calamitas. Starts at half strength on purpose — the lead and
       the drums are what she takes off you as the fight turns. */
    scal: {
      bpm: 148, root: 45, scale: HARM, chords: [0, 0, 5, 4], base: 0.45,
      pad:  { wave: 'sawtooth', gain: 0.018, oct: 0 },
      bass: { wave: 'square',   gain: 0.085, oct: -12, pat: pat('00.00.0.00.00.0.') },
      lead: { wave: 'square',   gain: 0.040, oct: 12,  pat: pat('7.4.2.4.7.9.7.4.') },
      perc: { gain: 0.095, pat: pat0('k.hks.hkk.hks.hh') },
      boss: 'scal'
    },

    /* Polterghast. Faster, and phrygian dominant so the second scale
       degree sits a semitone off the root the entire time. */
    polt: {
      bpm: 158, root: 48, scale: PHDM, chords: [0, 1, 0, 4], base: 0.5,
      pad:  { wave: 'sawtooth', gain: 0.018, oct: 0 },
      bass: { wave: 'square',   gain: 0.085, oct: -12, pat: pat('0.0.0.0.4.4.2.2.') },
      lead: { wave: 'square',   gain: 0.038, oct: 12,  pat: pat('0.4.7.4.b.7.4.2.') },
      perc: { gain: 0.095, pat: pat0('khhkshhkkhhkshhh') },
      boss: 'polt'
    }
  };

  /* Percussion patterns are letters, not degrees — k kick, s snare,
     h hat — so they get their own parser. Hoisted, hence a function
     declaration rather than the var above. */
  function pat0(s) {
    var a = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      a.push(c === '.' ? null : c);
    }
    return a;
  }

  /* ── which layers are audible at a given intensity ──────────────
     Pad and bass are the bed and never leave; taking the floor out
     from under a track reads as a dropout, not as a dynamic. */
  var GATE = { pad: 0, bass: 0, lead: 0.34, perc: 0.66 };

  /* ── audio plumbing ─────────────────────────────────────────────*/
  var actx = null, bus = null, duckG = null, noise = null;
  var armed = false, pending = null, failed = false;

  function vol() {
    var v = NEU.save && NEU.save.flag ? NEU.save.flag(K_VOL) : null;
    if (v === undefined || v === null || isNaN(v)) v = DEFAULT_VOL;
    v = Math.max(0, Math.min(100, +v));
    return v;
  }

  /* Ramp a param if the browser gives us one, set it if it does not.
     Worth the four lines: a partial AudioParam is exactly what a test
     stub hands you, and a hard throw here would take the whole module
     down over a volume change. */
  function ramp(p, v, secs) {
    if (!p) return;
    try {
      var t = actx.currentTime;
      if (p.cancelScheduledValues) p.cancelScheduledValues(t);
      if (p.setValueAtTime) p.setValueAtTime(typeof p.value === 'number' ? p.value : v, t);
      if (p.linearRampToValueAtTime) { p.linearRampToValueAtTime(v, t + secs); return; }
    } catch (e) {}
    try { p.value = v; } catch (e2) {}
  }

  function build() {
    if (actx || failed) return actx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { failed = true; return null; }
      actx = new AC();
      bus = actx.createGain();
      duckG = actx.createGain();
      bus.gain.value = (vol() / 100) * PEAK;
      duckG.gain.value = 1;
      duckG.connect(bus);
      bus.connect(actx.destination);

      /* One second of white noise, made once. Every hat and snare in
         the game is a filtered slice of this buffer; allocating a new
         one per hit is how a boss fight starts stuttering. */
      var n = (actx.sampleRate * 1) | 0;
      noise = actx.createBuffer(1, Math.max(1, n), actx.sampleRate);
      var ch = noise.getChannelData(0);
      for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    } catch (e) { failed = true; actx = null; }
    return actx;
  }

  /* ── the gesture gate ───────────────────────────────────────────
     Browsers block audio until the user has done something, and a
     console full of autoplay warnings is the least of it — a site
     that makes noise at you unprompted is a site people close. The
     context is not constructed until then either, so nothing is
     holding an audio device open on a page that is only being read. */
  function arm() {
    if (armed) return;
    armed = true;
    build();
    try { if (actx && actx.state === 'suspended') actx.resume(); } catch (e) {}
    /* `play()` remembered what was asked for by setting curId, so a
       straight replay would take its own "same track, do nothing"
       early exit and start silence. Clear it first. */
    if (pending) { var p = pending; pending = null; curId = null; play(p); }
  }
  addEventListener('pointerdown', arm, true);
  addEventListener('keydown', arm, true);
  addEventListener('touchstart', arm, true);

  /* ── voices ─────────────────────────────────────────────────────
     A voice is one track, playing. Two exist only during a crossfade:
     the outgoing one keeps its own step counter and its own gain and
     is dropped when it reaches silence. Reusing one voice and swapping
     its track mid-bar puts the new track's notes on the old track's
     grid, which sounds exactly as bad as it reads. */
  var voices = [];
  var curId = null;
  var ducked = false;
  var hpMax = {};

  var SPB = 16;                                      /* steps per bar */
  function stepDur(tr) { return (60 / tr.bpm) / 4; } /* a 16th note   */

  function freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  /* Degree → midi. Degrees run past the end of the scale on purpose:
     degree 7 is the root an octave up, degree 9 is the third above
     that, so a pattern can climb without a second array. */
  function note(tr, deg) {
    var L = tr.scale.length;
    var oct = Math.floor(deg / L);
    return tr.root + tr.scale[((deg % L) + L) % L] + 12 * oct;
  }

  function tone(dest, wave, f, t, dur, peak, detune) {
    try {
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(f, t);
      if (detune && o.detune && o.detune.setValueAtTime) o.detune.setValueAtTime(detune, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }

  function drum(dest, kind, t, gain) {
    try {
      if (kind === 'k') {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + 0.17);
        return;
      }
      var s = actx.createBufferSource(); s.buffer = noise;
      var f = actx.createBiquadFilter();
      var ng = actx.createGain();
      var len = kind === 's' ? 0.13 : 0.045;
      f.type = 'highpass';
      f.frequency.value = kind === 's' ? 1400 : 7200;
      ng.gain.setValueAtTime(gain * (kind === 's' ? 0.9 : 0.34), t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(f); f.connect(ng); ng.connect(dest);
      s.start(t); s.stop(t + len + 0.02);
    } catch (e) {}
  }

  /* One step of one voice, stamped at an exact context time. */
  function schedule(v, step, t) {
    var tr = v.tr, sd = stepDur(tr);
    var bar = Math.floor(step / SPB) % tr.chords.length;
    var idx = step % SPB;
    var croot = tr.chords[bar];

    /* The pad is one chord per bar, not one per step — a sustained
       voice re-triggered sixteen times a bar is a buzz, not a pad. */
    if (idx === 0 && tr.pad) {
      var barLen = SPB * sd;
      for (var c = 0; c < 3; c++) {
        var d = croot + c * 2;
        tone(v.lg.pad, tr.pad.wave, freq(note(tr, d) + tr.pad.oct),
             t, barLen * 0.98, tr.pad.gain / (c + 1.2), c === 1 ? 6 : -5);
      }
    }

    if (tr.bass && tr.bass.pat[idx] !== null && tr.bass.pat[idx] !== undefined)
      tone(v.lg.bass, tr.bass.wave,
           freq(note(tr, croot + tr.bass.pat[idx]) + tr.bass.oct),
           t, sd * 1.7, tr.bass.gain, 0);

    if (tr.lead && tr.lead.pat[idx] !== null && tr.lead.pat[idx] !== undefined)
      tone(v.lg.lead, tr.lead.wave,
           freq(note(tr, croot + tr.lead.pat[idx]) + tr.lead.oct),
           t, sd * 1.4, tr.lead.gain, 0);

    if (tr.perc && tr.perc.pat[idx]) drum(v.lg.perc, tr.perc.pat[idx], t, tr.perc.gain);
  }

  function makeVoice(id) {
    var tr = TRACKS[id];
    var v = { id: id, tr: tr, step: 0, at: 0, g: null, lg: {}, dying: false };
    if (!actx) return v;
    try {
      v.g = actx.createGain();
      v.g.gain.value = 0.0001;
      v.g.connect(duckG);
      var names = ['pad', 'bass', 'lead', 'perc'], i;
      for (i = 0; i < names.length; i++) {
        var lg = actx.createGain();
        lg.gain.value = 0;
        lg.connect(v.g);
        v.lg[names[i]] = lg;
      }
      v.at = actx.currentTime + 0.06;
    } catch (e) {}
    return v;
  }

  /* ── intensity ──────────────────────────────────────────────────
     Zones sit at their resting value. Bosses climb: a step for the
     phase change, then a smooth ramp on health lost, so the drums do
     not arrive on a hard boundary the player can hear coming.

     Maximum HP is not exposed by either boss, and it does not need to
     be — both reset to full in open(), so the first reading after a
     fight starts IS the maximum. Captured when the track changes. */
  function intensity(v) {
    var tr = v.tr;
    if (!tr.boss) return tr.base;
    var b = NEU[tr.boss];
    if (!b) return tr.base;
    var ph = typeof b.phase === 'number' ? b.phase : 1;
    var hp = typeof b.hp === 'number' ? b.hp : null;
    if (hp !== null) {
      if (hpMax[tr.boss] == null || hp > hpMax[tr.boss]) hpMax[tr.boss] = hp;
    }
    var lost = 0;
    if (hp !== null && hpMax[tr.boss]) lost = 1 - (hp / hpMax[tr.boss]);
    var x = tr.base + (ph - 1) * 0.22 + lost * 0.36;
    return Math.max(0, Math.min(1, x));
  }

  function applyLayers(v) {
    if (!v.g) return;
    var x = intensity(v);
    v.x = x;
    var names = ['pad', 'bass', 'lead', 'perc'], i;
    for (i = 0; i < names.length; i++) {
      var n = names[i];
      if (!v.lg[n]) continue;
      var want = (v.tr[n] || n === 'pad') && x >= GATE[n] ? 1 : 0;
      if (v.dying) want = 0;
      if (v.lgWant && v.lgWant[n] === want) continue;
      v.lgWant = v.lgWant || {};
      v.lgWant[n] = want;
      ramp(v.lg[n].gain, want, 0.9);      /* layers arrive, never snap */
    }
  }

  /* ── the scheduler ──────────────────────────────────────────────*/
  var timer = null;

  function tick() {
    if (!actx || !voices.length) return;
    var now;
    try { now = actx.currentTime; } catch (e) { return; }

    for (var i = voices.length - 1; i >= 0; i--) {
      var v = voices[i];
      if (v.dead) { voices.splice(i, 1); continue; }
      if (!v.g) continue;

      /* A backgrounded tab stops firing this interval while the audio
         clock keeps running. Without this the while-loop below would
         "catch up" by scheduling every missed step at once, which is
         not a stall — it is every note of the last four minutes
         arriving in the same tenth of a second. Realign to the next
         bar and carry on. */
      if (v.at < now - 0.5) {
        v.at = now + 0.06;
        v.step = Math.ceil(v.step / SPB) * SPB;
      }

      var sd = stepDur(v.tr), guard = 0;
      while (v.at < now + LOOK && guard++ < 256) {
        schedule(v, v.step, v.at);
        v.step++;
        v.at += sd;
      }
      applyLayers(v);
    }
  }

  function startTimer() {
    if (timer !== null) return;
    timer = setInterval(tick, TICK);
  }
  function stopTimer() {
    if (timer === null) return;
    clearInterval(timer); timer = null;
  }

  /* ── play / stop ────────────────────────────────────────────────*/
  function play(id) {
    if (id && !TRACKS[id]) return false;
    if (id === curId) return true;              /* same zone: do nothing */

    if (!armed) { pending = id; curId = id; return false; }
    if (!build()) { curId = id; return false; }

    var i;
    for (i = 0; i < voices.length; i++) {
      voices[i].dying = true;
      applyLayers(voices[i]);
      ramp(voices[i].g && voices[i].g.gain, 0.0001, FADE);
      (function (v) {
        setTimeout(function () { v.dead = true; }, FADE * 1000 + 200);
      })(voices[i]);
    }

    curId = id;
    if (!id) { stopSoon(); return true; }

    if (TRACKS[id].boss) hpMax[TRACKS[id].boss] = null;   /* new fight */

    var nv = makeVoice(id);
    voices.push(nv);
    applyLayers(nv);
    ramp(nv.g && nv.g.gain, 1, FADE);
    startTimer();
    return true;
  }

  /* Let the tail of the outgoing voice ring out before the scheduler
     shuts down, or the crossfade ends in a cut. */
  function stopSoon() {
    setTimeout(function () {
      if (curId) return;                        /* something started again */
      voices = [];
      stopTimer();
    }, FADE * 1000 + 300);
  }

  function setVolume(v) {
    v = Math.max(0, Math.min(100, Math.round(+v || 0)));
    if (NEU.save && NEU.save.flag) NEU.save.flag(K_VOL, v);
    if (bus) ramp(bus.gain, (v / 100) * PEAK, 0.15);
    return v;
  }

  /* ── ducking ────────────────────────────────────────────────────
     The dialogue box is the whole point of most of this game and the
     blips are quiet by design. Reading #tbox directly keeps sans.js
     the single source of truth about whether anyone is talking. */
  function talking() {
    var t = document.getElementById('tbox');
    return !!(t && !t.hidden);
  }

  function duck(on) {
    on = !!on;
    if (on === ducked) return;
    ducked = on;
    if (duckG) ramp(duckG.gain, on ? DUCK : 1, 0.3);
  }

  /* ── the director ───────────────────────────────────────────────
     Ordered most-specific first. The rhythm game is FIRST and returns
     silence: it is a call-and-response chart at its own BPM, and a
     second tempo underneath it does not layer, it fights. */
  function pick() {
    if (NEU.rhythm && NEU.rhythm.running) return null;
    if (NEU.scal && NEU.scal.running) return 'scal';
    if (NEU.polt && NEU.polt.running) return 'polt';
    if (NEU.quiz && NEU.quiz.running) return 'prize';
    if (NEU.craft && NEU.craft.running) return 'home';
    if (NEU.engine && NEU.engine.running) {
      var z = NEU.engine.zone ? NEU.engine.zone() : null;
      return z && TRACKS[z] ? z : null;
    }
    return null;
  }

  function sync() {
    duck(talking());
    var want = pick();
    if (want !== curId) play(want);
  }

  setInterval(sync, POLL);
  document.addEventListener('visibilitychange', function () {
    /* Not a pause — the fade would be audible on the way back and the
       scheduler realigns itself anyway. Just stop burning cycles. */
    if (document.hidden) stopTimer(); else if (voices.length) startTimer();
  });

  NEU.music = {
    play: play,
    stop: function () { play(null); },
    duck: duck,
    setVolume: setVolume,
    get volume() { return vol(); },
    get track() { return curId; },
    get playing() { return !!curId && armed; },
    get armed() { return armed; },
    get ducked() { return ducked; },
    get intensity() { return voices.length ? voices[voices.length - 1].x : 0; },
    get voices() { return voices.length; },
    tracks: TRACKS,
    /* tests + dev. `_v` hands out the live voice array so a suite can
       assert the crossfade (two voices, one dying) and the layer gates
       without listening to anything. */
    _v: function () { return voices; },
    _pick: pick,
    _sync: sync,
    _tick: tick,
    _arm: arm,
    _gate: GATE
  };
})();
