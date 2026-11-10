# Accessibility acceptance baseline

- Keyboard-only and touch navigation can reach every required progression step and exit an active minigame.
- Focus is visible; overlays trap focus only while active and return it on close.
- `prefers-reduced-motion` removes decorative shake, strobing and long artificial animated waits, but preserves story, hit windows and puzzles.
- Flash frequency <=3 Hz, no required recognition of an affordance by color alone.
- HUD/puzzle text has sufficient contrast (WCAG AA where applicable) and legible pixel scale. Avoid 15px resampling of existing bitmap-like faces.
- Interaction and combat feedback combine shape, motion and text/audio, so users with muted audio can understand events.
- No player controls lost during resize, hidden tab, sleep/wake, pause, restart, dialogue or camera transition.
- Test on mobile portrait/landscape plus desktop keyboard with screenshots and measured controls.
