# Work order — harden the audio-unlock gate

File: js/core/music.js (gesture-gate section, ~lines 216-234) + one test
section in tests/fixes16.mjs.

## Background (researcher verdict, sources in .opencode/log/pilot-a-researcher.md)
The unlock works on iOS 17/18 but has four weaknesses: (1) arm() latches
forever, so a first gesture swallowed by a scroll can leave the context
suspended with no retry; (2) touchstart/touch-pointerdown are NOT spec
activation triggers (Safari accepts them via undocumented leniency);
(3) Web Audio sits on the ringer channel and dies on the silent switch —
navigator.audioSession.type='playback' fixes that on Safari 16.4+/iOS 17+;
(4) backgrounding suspends the context and nothing resumes it.

## Acceptance criteria (all must hold)
A1. A gesture while `actx.state === 'suspended'` retries resume() and the
    pending-replay path — arming is never permanently consumed by a failed
    attempt. (Keep the context-lazy-build behaviour exactly as-is.)
A2. Capture-phase `pointerup` AND `touchend` listeners call arm() alongside
    the existing pointerdown/keydown/touchstart.
A3. Once at init: if `navigator.audioSession` exists, set its `type` to
    "playback", guarded try/catch, ES5 property access.
A4. On visibilitychange becoming visible: if the context exists and is
    suspended, resume() runs (same pending-replay courtesy).
A5. TDD order: the new fixes16 section lands FIRST and fails against the
    current source; then the implementation turns it green. Show both
    states.
A6. ES5 only; no await/Promise hop between gesture and resume(); comments
    match the file's voice.

## Budget
One dispatch. node --check every touched file before returning.
