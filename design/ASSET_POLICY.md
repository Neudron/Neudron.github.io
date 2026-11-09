# Assets — provenance and production gate

1. Reuse project-owned and rights-cleared sprites first; clean pivots, transparency and frame cadence.
2. Audit all external candidates against the license at the exact source URL; store creator, permission type, modification/attribution/redistribution restrictions and the original file ID. **Availability online is not consent.**
3. Do not assume existing Calamity, Terraria, Undertale or Deltarune files are cleared for public redistribution because they are already in the repository.
4. For missing designs use an original GPT-Image brief, then normalize palette, pixel grid and alpha, crop equal-size frames, verify 1×/gameplay scale and inspect inside the actual scene.
5. Mark candidates as PROPOSED, RIGHTS_PENDING, GENERATED_UNREVIEWED, APPROVED or REJECTED. Never publish RIGHTS_PENDING or GENERATED_UNREVIEWED.
6. Record dimensions/pivot/palette/frame count in `assets/manifest.v3.json` after image inspection; unknown fields remain null, not guessed.
7. Reference screenshots from other games are research links, not sprite source licenses.
8. Assets are integrated in scene context alongside their gameplay change rather than as a late blind visual overlay.
