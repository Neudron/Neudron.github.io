# Game-feel policy

- **Inputs:** every keypress maps to one intended action in the active gameplay mode. State ownership passes after a visible transition-ready frame, never mid-animation; held movement through a forest seam remains held.
- **Movement:** exploration is fixed 60 Hz, 96 units/s top speed, current acceleration ~1100u/s² and friction ~1400u/s². Preserve its swept collision and corner forgiveness until measured tests justify tuning. Do not globally alter platforming/rhythm physics.
- **Enemy readability:** idle -> notice (head/body turns) -> anticipation (weapon retracts) -> active collision -> recovery -> damage reaction -> death. The damaging hitbox must follow the drawn attack. Make heavy attacks readable; ordinary dodgeable moves do not require arrows and warning text.
- **Hit priority:** routine contact = 1 brief response, no screen shake; significant hit = small directional knockback and restrained hit-stop; boss phase = authored environmental response and camera framing. Never stack all effects on every hit.
- **Risk and reward:** harder puzzles need reasoning, not hidden controls; deaths explain the specific collision, reset to an expected checkpoint and restore input.
- **Cancellations:** all temporary modes release active input and timers on exit, death, restart, reduced-motion toggle and visibility changes.
- **Sensitivity:** camera shake, flash and vibration are individually switchable. Flash rate must remain <=3 Hz. Reduced motion shortens/disables camera shake and artificial waits, not core rules.
- **Proof:** paired normal/reduced-motion recordings, same deterministic simulation at 60/144/240 render Hz, keyboard and touch input replay.
