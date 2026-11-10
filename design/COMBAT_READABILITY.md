# Combat readability policy

Each attack definition: owner, state, origin anchor, target vector, visual travel, hitbox, reaction, timing (target frames), cooldown, sound, camera, safe counterplay, phase usage, reduced-motion behavior, test evidence.

Ordinary dodgeable attacks should communicate their trajectory through the actual sprite and movement; **no new telegraph by default**. Keep original helpful indicators. Add a telegraph only when an attack would otherwise be unreadable or effectively undodgeable; never duplicate original warnings. Dash attacks require separately reviewed directional information. The intended Calamitas final all-out attack remains deliberately untelegraphed.

At all times the drawn projectile's active collision position must lie inside the actual fight coordinates or exit cleanly; do not spawn attacks offscreen and call them fair. TP acquisition, damage invulnerability, weapon equipment and state changes must be visible and mechanically synchronized.

Boss phase shift sequence: finish outgoing damaging projectiles safely -> lock phase -> health/readout alteration -> boss body reaction -> arena/environment response -> playable next state. Never swap a boss sprite without an in-world cause.
