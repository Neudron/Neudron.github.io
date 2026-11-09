# NEU V3 art bible — production baseline

## Visual language
NEU is a shadow-first pixel world: readable paths and believable materials against restrained gothic lighting, with spectacular red/otherworldly events reserved for earned story beats. Borrow principles—not art—from Eastward (inhabited environments), Hyper Light Drifter (silhouettes), Deltarune (staging) and Celeste (mechanical clarity).

**Verified base:** exploration engine uses a 16-world-unit tile, room-themed palette renderers and sharp pixel art. Actual native sprite cell sizes differ by mode and must be read from `img/act4/sheets.json`, `js/data/sheets.js` and source assets before generation.

## Palette and value hierarchy
- Playable floor readable at normal brightness; walls/blocked terrain discernible by shape and value even in grayscale.
- Interactables use contrast and a unique silhouette. Never apply the same bright glow to both interactable and decorative props.
- Focus hue per zone: woods cold green/blue with sparse amber lantern pools; castle graphite/bone/wine with crimson magical accents; dungeon charcoal/iron with spectral blue; HOME warm subdued domestic light; machine arena cold metal against hazard accents.
- Author zone-specific palettes in approved swatch sheets; numeric colors in current room code are *existing*, not automatically approved global tokens.
- One dominant light direction per scene; ground-contact shadows under people and furniture; foreground occlusion only where it preserves a clear player silhouette.

## Pixel and motion discipline
- Nearest-neighbor output. No smoothing, blurred outlines, gradients baked into pixel surfaces or mixed pixel densities.
- Draw solids, background, shadows, props, characters, VFX, foreground occlusion, captions/UI in documented order. Align pivots to feet and actual collision bounds.
- At 1× preview individual clusters should read as deliberate shapes; at native gameplay scale the object must still be identifiable.
- Walk distance controls foot-cycle; camera motion does not change collision coordinates. Frame-count/hold timing per subject is approved before spritesheet production.
- Distinct idle/anticipation/action/recovery state silhouettes; no single-frame invisible switch at a major story beat.

## Environment pass
For each room define focal point, entrance/exit sightlines, visible landmark, purposeful props, physical light source, uninterrupted walkable route, enemy safe-space, and final screenshot composition. Environmental richness must not hide puzzle clues.

## Review fail examples
Random furniture without use, locked exits visually identical to open exits, opacity halos around PNGs, object collision not matching silhouette, actor casting spell from nowhere, full-screen shake for routine interaction, high-detail art illegible at 2× scale.

All downloaded art must have an entry in `assets/manifest.v3.json` with license and reuse status approved *before* shipping.
