# Visual review rubric (0–5 each)

Score composition, cohesion, silhouettes, lighting, animation, environment, interaction clarity, camera, transitions and narrative impact from **real screenshots/video**, not only code. A major category below 4 requires revision or a documented deliberate exception.

Review sheet for every changed scene:
- Scene ID, commit SHA, device, resolution, zoom, input type, motion setting, tester, screenshot/video links.
- Before: visible spawn, exits, safe movement lanes, interactable silhouettes.
- During: actor origin, effect trajectory, hitbox agreement, camera framing, occlusion and sound cue.
- After: final state, control recovery, save flags, repeat and reverse traversal.
- Failure: wrong puzzle state, death, interruption, resize, reduced motion, reload and previous-save state.

Write concrete feedback (“left gate occludes feet at x=10 during frame 18”) rather than “looks unpolished.” A mockup is not a playtest.
