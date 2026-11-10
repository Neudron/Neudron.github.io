# Audio policy

Existing project music is largely synthesized with Web Audio. Preserve the fast and offline-capable portfolio where possible.

- Each area has a documented 3-layer plan: ambience bed, local object sound, interaction/music cue. Transitions between physical neighbors crossfade without restarting an identical bed.
- Door, footsteps, spell, environment and UI sound must point to the visible source; never play unrelated impact audio.
- Boss escalation affects arrangement and dynamic range without masking attack audio.
- Prefer authored or cleared audio; record license and creator. Do not rip commercial game soundtracks or ship a sampled track without permission.
- Muted/reduced sensory settings remain effective through cutscenes and mode switches. Resume Web Audio only after valid user gesture; gracefully handle suspended contexts.
- Record peak level and stop/fade behavior per cinematic. No permanent sound source when its scene is left.
