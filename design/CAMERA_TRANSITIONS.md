# Camera and transition director

**Current:** `engine.go()` irises to black and `land()` resets velocity, world view and camera. This is correct for some dimensions; it is wrong for connected forest edges.

## Six categories
1. **SEAMLESS:** adjacent physical map coordinates; preserve actual player motion, render neighbor before crossing, gradually transfer camera bounds and ambience; reverse walk works immediately. Never fade.
2. **PHYSICAL DOOR:** hinge/panels animate, player crosses threshold behind front occluder, collision changes only when enough clearance exists, camera finds exit, then controls return.
3. **VERTICAL:** stair/shaft/lift/fall maintains visible movement along vertical axis and changes room only after safe placement.
4. **SUPERNATURAL:** portal/crack/painting/recall requires its signature geometry and causal source/destination effect; avoid generic iris except as justified.
5. **CINEMATIC:** explicit shot list, lock reason, actor timeline, state commit and guaranteed release on normal/failure/reduced motion.
6. **MODE SHIFT:** old HUD retracts, new subject/bounds enters from a consistent position, new input becomes active on readiness.

## Invariants
- Camera coordinates use world units; shake is a rendering-only offset. Existing camera inertia is retained unless profile demonstrates problems.
- Movement input cannot be dropped or duplicated across a seamless seam.
- All exits have valid target room/spawn; dynamic targets are resolved at transition time.
- Save position updated after safe landing; never persist mid-portal invalid coordinates.
- Cinematic flags written once and replay-safe; no double reward on re-entry.
- Presentation should be asynchronous only where it improves comprehension; no blind 2-second wait after completion.
- Every transition has reduced-motion behavior and at least 3 screenshots (before/middle/after).
