# Work order V3-101 — visible forest seam implementation

**Base:** after V3-100. **Owner:** Opus 5.5 exclusively. **Allowed:** `js/core/engine.js`, `js/core/engine-look.js`, `index.html` load order and new visual-only modules; `js/act4/rooms-a.js` only with exclusive ownership. **Forbidden:** `save.js` schema change, unrelated boss, shop, puzzle or portfolio. **Depends:** V3-000, V3-100.

Implement `SC-A1-A2` and `SC-A2-A3` from `SCENES.md` without immediate room destruction, full-screen blackout, velocity reset or camera snap. Neighbor visuals enter camera bounds before player's feet cross. Keep constant 16-unit tile/pixel density, foreground tree occlusion, continuous ambient channel and legal transition-specific collision. Pre-bake neighbor in a bounded cache, commit destination room once, write save once at stable spawn, and unload old room safely. Preserve original `go/land` for other routes.

Test hold-right A1 to A2 and A2 to A3 (including A2 upper-to-lower bend), immediate reverse from A3 to A2 and A2 to A1, reload in each, 60/144Hz fixed speed, touch and reduced motion, gates unchanged, no duplicated onEnter/cinematic and no camera shake in player coords. Capture three screenshots and a short before/mid/after video per crossing. **Done:** real-browser visual score major categories >=4 and all gates. **Rollback:** disable seam feature flag, use old transition.
