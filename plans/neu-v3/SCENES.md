# Screen choreography — first reviewed targets (NOT YET IMPLEMENTED)

Time values are **initial tuning targets** at fixed 60Hz, not verified game timings. Tile coordinates below are source-backed where given; screen pixel positions are to be measured by browser capture. Every sequence includes starting state, player motion, camera, interactive control, persistence and failure path.

## SC-A1-A2 — Seamless forest clearing into path
**Source:** `js/act4/rooms-a.js`. A1 is 24×13 tiles; right exit tile (23,7) points to A2 spawn west (1,3). A2 is 26×11; backward exit (0,3) points to A1 east spawn (22,7).
**Before:** A1 player in clearing, torchlit line on row 7, tunnel of dark trees at right; moving path visually continues behind the canopy.
**At approach (within ~3 tiles):** lazy-load A2 floor/decor outside visible boundary; keep current foot cadence and velocity. Camera look-ahead moves toward tunnel and gradually shares A2 bounds.
**Crossing (target 12–18 frames of visual overlap):** rightward held input keeps velocity; A1 trees enter foreground masking line-of-sight, connected A2 path is seen beneath; no blackout or iris, no teleport frame. Player crosses a continuous geometric seam; engine room identity changes when their feet safely enter A2; A1 leaves renderer behind them.
**After:** A2 has upper bank path row 3, dark water row 5, lower bank path row 7; first mushroom near (8,6); A2 destination is the *upper* west bank, not the bottom east bank. Regional ambience does not restart. Reverse immediate leftward movement crosses into A1 without requiring release/re-press.
**Save:** stable source IDs; capture only a valid legal spawn/world position after commit. **Failure:** if neighbor data not loaded, retain old safe transition and log a debug warning, not an invisible wall. **Reduced motion:** retain geometric continuity, disable camera flourish.
**Proof:** video full hold-right crossing + immediate hold-left reverse, 60/144Hz comparisons, reload at both sides, keyboard/touch; no double enter hook.

## SC-A2-A3 — The loop path reaches the forest fork
A2 right exit (25,7) lands A3 west (1,7); A3 is 24×12. A2's upper and lower rows are joined at map ends; a camera-only cut to the bottom bank would misrepresent the geography.
**Before:** player follows the upper row then reaches the far end and travels down onto lower row; black water remains north; lanterns and canopy guide descent. A3's left lower bank appears beyond the tree boundary.
**Crossing:** render both zones in same 16-unit grid, blend camera over edge; player keeps their movement vector without reset and A3's fork sign is readable before reaching it.
**After:** on A3, western branch leads back, northern lit path leads to castle gate at (10,1), eastern overgrown route leads altar (23,7); save at (5,6).
**Failure / rollback:** a blocked north gate stays blocked; dynamic gate flags are not altered by seam animation; A3 fork exit left (0,7) correctly returns to A2 east spawn (24,7).

## SC-B1 — Witch unlocks the heavy east door
**Current source facts:** B1 23×14, witch NPC (9,3), eastern door (22,8) gated by `witch_met`, second throne (13,2) dialogue-only. Finishing the fifth witch dialogue presently sets `witch_met` immediately. Desired behavior is *not implemented*.
**0–15f:** close text, player briefly faces witch, camera frames central aisle and east door. Block repeated interaction; do not immediately remove collision.
**16–35f:** witch pivots toward east and raises her casting arm. Ember particles converge into crimson hand-centered seal, not floating at door.
**36–48f:** thrust and distinct projectile travel from hand to lock, synchronized with strong forward sound.
**49–65f:** projectile strikes center of lock; red cracks radiate through metal; frame stays anchored. Screen movement is a very small local impact, not global shake.
**66–96f:** bolts retract; door panels visibly part; dust falls; opening reveals lit passage. At a verified safe opening threshold, collision clears and save `witch_met` commits once.
**97–105f:** witch resumes idle, camera slides back to player, controls release. **Re-entry:** completed door remains open without replaying spell. **Interrupted/reduced motion:** commit only when door transition reaches logically open state, and provide fast accessible variant.
**Second throne:** press interact within normal reach, player faces chair, aligns feet on seat pixel anchor, sits; pressing interact/approved movement stands safely on walkable tile, without overlap. Never toggle off by a dialogue-only NPC.

## SC-B4 — Mouse under ice, cheese beyond cracks (specification proposal)
**Current source facts:** 20×12 B4, source currently has a ring of `i` ice and four slide-only plates. No mouse yet. This is a proposed replacement and must not be marked verified.
**Start:** upper ice skin is semitransparent; a small mouse shadow shifts beneath a locked multi-lane floor. Cheese and exit are visibly separate landmarks; big cracks define physically impassable lanes, not purely decorative lines.
**Rules to finalize:** change orientation of safe guide segments from above; pressure/heat states change route; mouse runs automatically until it meets obstruction. Make at least three sequential inference states, meaningful wrong routes and an always-available reset; exactly one cheese goal.
**Success:** mouse approaches cheese through final open lane, touches it, pauses, visibly nibbles, turns to player with 2-frame celebratory hop; gate melts or slides away only after that reaction. Persist `solved:b4_ice` and save once. **Before implementation:** require complete authored grid, state table, solver trace and no-softlock proof.

## SC-B6 — Torch reveals a hidden rule (specification proposal)
**Current facts:** B6 20×12, torch at (2,6), simple central socket at (10,6), east exit at (19,6), gated by `solved:b6_dark`. Need meaningful reasoning instead of placing a torch once.
**Start:** room mostly dark but traversable routes and handtorch are detectable by silhouette. Carrying torch reveals wall inscriptions only within its real beam; two off-axis mirror brackets alter the image.
**Player loop:** pick torch visibly, walk to clues, aim/rotate at mirrors, compare shadows of gate glyphs. Wrong reflection leaves gate dark but visibly indicates why; reset always possible.
**Success:** reflected beam strikes final glyph while correct shadow pattern is formed, gated stone raises with sound, save flag commits, control returns. **Before implementation:** exact clue glyphs, mirror orientations, grid, light ray model and one unique solution are required.

## SC-RECALL — Drink / bedroom arrival
**Latest source:** W08 commit says recall is implemented with a ring and iris into `e6_room`, `bed` spawn; `js/act4/act4.js` confirms consumed item and bedroom destination.
**Verify, do not rebuild blind:** bottle raised -> drink pose -> grounded teleport ring -> envelop player -> camera shifts -> bedroom bed-safe arrival -> ring dissipates -> input unlocked. Reduced-motion path must not consume twice. Reload immediately after arrival; no corridor spawn.

## SC-FNF — Rhythm to soul and back
**Latest source:** W12 says rhythm chart/soul transition and SONG CLEARED viewport fixes have been implemented; verify before work.
**Target:** finish beat judgment window; retract lanes in sync with music, character and opponent remain visible, soul slides into visible fight box, transfer input when box drawn; projectile begins from enemy hand or instrument, hits only inside active box; box retracts, soul rejoins rhythm stage, chart resumes in correct time; no frozen viewport at victory.

## SC-CRACK — Sky arrival and checkpoint
**Latest source:** W10 implemented skyCine and dungeon surface bed. Verify landing and reduced motion using real playback rather than rewriting. See `js/act4/crack.js` and `dungeon.js`.

## SC-FINALE — Reactor collapse / village chase
Private canon is not available in public checkout: shot list must be reconciled against the private walkthrough before code work. Required visible beats from user V3: Exo defeat -> desperation -> countdown -> color-shift -> SOULSHIELD -> explosion -> falling soul/body -> village wake -> lockdown -> chase -> mysterious attack -> aftermath. **No invented durations/flags until source audit.**
