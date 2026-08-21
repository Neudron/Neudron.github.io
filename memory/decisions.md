# Decision log

Why things are the way they are — including what was tried and rejected, so it
does not get re-tried.

## Rejected approaches

**The boss fight.** Docking the console used to open an Undertale fight where
FIGHT connects and his HP bar never moves. Mechanically the joke was good —
the interface had been lying about it since the top of the page. But it has
exactly one punchline and you can only hear it once. Replaced 2026-08-16 with
the console home screen, which is a joke you can browse. `js/boss.js` is dead
code.

**Two text-blip samples.** Alternating `txtsans` with `txtsans2` was meant to
stop long lines sounding mechanical. The two files are near-identical in pitch
and length, so back to back they read as one blip with a flam on it. Four
copies of one file is the fix; four different files was the bug.

**A smooth radial torch in the blackout.** Continuous falloff is the obvious
way to do a light and it looks wrong here — every other pixel on this site has
a hard edge, so a soft vignette reads as a different program. Five discrete
rings.

**Per-frame random debris.** Scenery that reshuffles every frame is worse than
no scenery: it actively lies about where you are. Seeded LCG instead.

**Time-driven walk cycles.** Stepping every N milliseconds means the legs keep
moving when you stop and slide when you change speed. Frame advances on
distance travelled.

**`rotate(180deg)` to flip the objectives tab.** A 180° rotation mirrors
*both* axes, and the vertical half is what made the glyphs read upside down.
`scaleX(-1)`.

**Gating the observer on state.** `hideSans()` used to be skipped once you
picked the sword up, so he stayed pinned in the corner for the whole trip up
the page — which is the entire point of the errand. He now leaves whenever the
contact section leaves, regardless of what you carry.

**A flat timer for the sleep.** `setTimeout(goToSleep, 2200)` from fitting the
clicker swapped a standing skeleton for a sleeping one while you were staring
at both. That does not read as "time passed", it reads as a sprite bug.

**A canvas for the console menu.** Everything else full-screen here is a
canvas because everything else is a game. A menu is an interface: canvas text
is unselectable, invisible to screen readers, and has to be re-laid-out by
hand on resize. The deck is DOM.

## Bugs worth remembering

**Glass invisible on vertical screens.** `.stars`, `.glass` and `#glassCanvas`
had no CSS rules at all — an earlier edit had deleted the block. The camera
maths was correct the whole time. `renderer.setSize(w, h, false)` means CSS
must size the canvas.

**Dialogue permanently visible.** `.tbox { display: grid }` outranks the UA
`[hidden]` rule. Fixed globally, not per-element.

**Dialogue buried.** `.tbox` sat at z-index 44, under the petting hand (46),
the inside panel (55) and the dev console (80). Now 96, and the whole ladder
is written down in `architecture.md`.

**Pages never deployed.** Two rounds were spent blaming the CNAME file. The
actual cause: Pages source was set to *GitHub Actions* with zero workflows in
the repo. The user's pasted settings page identified it.

**Replay dead end.** `dark.js` kept `through` and `fixed` at module scope
across runs, so a second blackout found a grey door that had already given up
its clicker and handed over nothing. `smashLight()` now calls
`NEU.dark.reset()` plus `quest.replay([...])`.

**Cooldown guard.** `(keyHit.at || 0)` made the throw cooldown active for the
first 900ms of page life. Needs `keyHit.at && ...`.

**Totem sound on every line.** `summonDog()` and `fitClicker()` both called
`totemSound()`. It belongs to `popTotem()` and nowhere else.

## Corrections from the user (verbatim intent)

- "very ugly use the exact same asthethic, yours are awful" — match the
  existing look, do not invent a new one.
- "use the original sprites of the game do not make new ones".
- "not the particles" — be precise about which effect is meant.
- "must point at www.neu.ac NOT neu.ac".
- "flip it left to right (NOT UP TO DOWN!)".
- "sans is doing double sounds only use the 1".
- "stop commiting to github without permission" — 2026-08-16.

## Spawn animation

Rejected twice. Root cause was never the easing — it was the ~4000px flight
distance from the bottom of the page. Fixed by starting the animation in the
middle of the *screen* and travelling up from there.
