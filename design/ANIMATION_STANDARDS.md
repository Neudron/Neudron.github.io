# Animation standards

A storyboard defines states and time **before** sprites are commissioned. Each character has pivot, anchor, idle, locomotion, anticipation, action, recovery, hurt and exit states as applicable. Effects have a named birth point, travel curve, impact position, expiry and cancellation behavior.

- Keep same logical feet anchor across frames to prevent jitter.
- Use whole pixel cluster movement where gameplay-sized sprites are scaled.
- Match animation active frames to collisions; opening panels and gates release collision only at traversable width.
- Default to restraint: idle breath is less intense than damage, and damage less intense than phase transition.
- Provide start/mid/end state for every camera/door/portal scene; no mysterious one-frame teleport.
- Describe reduced-motion alternate as deliberate instant/shortened staging, not skipped state changes.
- Verify three different gameplay scales, repeated play and skip/cancel paths.
