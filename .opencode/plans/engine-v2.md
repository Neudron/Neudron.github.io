# Engine v2 — review and rebuild plan

Owner: orchestrator (Opus). Status: **P0–P5 shipped 2026-10-23** (P6 optional,
open). Implementation ran alongside the ultraplan batches. Work order per AGENTS.md: objective,
acceptance, touched paths, budget, phases. Progress is tracked here with
`[ ]` → `[x]` so it survives compaction.

---

## 1. Review: what the game is like to play today

Screenshots for this review: Chromium at 1280×800 and 390×844, every Act IV
zone plus every minigame (`scratchpad/review/shots/`, not committed).

### The room engine (`js/core/engine.js`, 1065 lines, Act IV)

Sound foundations that must survive the rewrite:
- rooms as readable ASCII strings, data-only room files, hooks for puzzles;
- swept, axis-separated collision (no tunnelling);
- distance-driven walk cycle; push blocks, ice, plates, triggers, the
  `resolve-a-spawn-loudly` landing; the `API` hook surface rooms use;
- palette fallback so a room plays before its art exists.

What makes it feel bad:

| Area | Today | Why it hurts |
|---|---|---|
| **Readability** | Floor, wall and "lit path" tiles differ by 2–6% luminance; the remapped atlas reads as vertical stripes | You cannot see where you can walk. The rooms' own design note ("lit ground is walkable") is invisible on screen |
| **Depth** | Walls are flat squares, same plane as the floor | No 3/4 top-down read; a room is a pattern, not a place |
| **Scale** | Fixed `SCALE = 3` | Phones see ~8 tiles across; desktop rooms float small in a black void |
| **Entities** | Default NPC is an 18×18 lilac square; blocks/plates are grey rectangles; no shadows | Characters and objects do not read as things |
| **Light** | One radial gradient for `dark` rooms, centred on the **screen**, not the player or the light source | b6 is a black screen with a ring in the middle; the player is invisible |
| **Atmosphere** | Nothing moves except the player | Woods, storm, city and castle all feel the same |
| **Movement** | Constant 96 u/s, instant start/stop, no corner forgiveness | One-tile doorways snag on corners; it feels stiff |
| **Camera** | Dead zone + instant snap, no easing, ignores the touch pad | Jerky; on a phone the player walks under the pad |
| **Interaction** | Nearest entity in a circle, regardless of facing; a bare "e" glyph | Wrong target when two things are close; prompt is easy to miss |
| **Transitions** | 0.22 s fade | Fine, but there is no sense of arriving anywhere |
| **Code shape** | `fire()` and `drawEnt()` are long `if (e.t === …)` chains; every tile redrawn every frame; render and sim share one variable-dt loop | Every new entity kind means editing two chains; frame cost grows with room size |

### The rest of the game

- **Page (acts I–III):** the website is strong (boot card, starfield, glass).
  The game hooks into it well. No engine changes needed there.
- **Bullet hell (`game/bullet.js`), dark walk (`game/dark.js`):** same visual
  vocabulary as the rooms (1-colour squares on black). They would gain the
  most from a **shared look kit** (sprites, shadows, glow, particles) that v2
  exposes; adopting it is phase 6, optional, after the rooms land.
- **Fights (Calamitas, Polterghast):** recently rebuilt against source; they
  have their own renderers and test suites. Out of scope beyond using the
  shared particle/glow helpers if it costs nothing.
- **Quiz, rhythm, craft, shop, deck:** DOM/canvas overlays, recently fixed.
  Out of scope.

## 2. Objective

Make walking around Act IV **readable, alive and good to control**, on
desktop and phone, without changing a single room file or the engine's
public API. Visual direction: the site's own dark palette, but with real
value structure. Concretely:
- 3/4 top-down walls with a lit top cap and a darker front face;
- floors with texture and contact shadows (AO) next to walls;
- warm light pools from the things that should glow;
- per-zone weather and particles;
- characters with shadows and idle life.

## 3. Constraints (from AGENTS.md / neu-builder)

- ES5 in `js/` (var/function only), classic scripts, no build step.
- Public surface stays: `NEU.engine.{register, tileset, enter, leave, go,
  confirmExit, where, running, room, zone, rooms, tilesets(), api, warp,
  drawPlayer, TILE, SCALE}` and the `API` object rooms receive
  (`say flag flagged give has go leave busy entHere reset check ents solved
  markSolved room player`). Room data format unchanged.
- `tests/reach.mjs` constants (TILE 16, REACH 22, PLAYER_H 8) stay true, or
  change in both places in the same commit.
- `prefers-reduced-motion`, `noShake`, `noFlash`, reduce-particles and
  reduce-hit-stop settings are respected by every new effect.
- Font sizes are multiples of 16px; z-index ladder unchanged.
- All 18 suites stay green after every phase; every phase gets a real-browser
  screenshot pass (desktop + phone) before commit.

## 4. Architecture

```
js/core/engine-look.js   NEW  zone looks (palette ramps, ambient, weather),
                              autotiler, static-layer baker, lightmap,
                              atmosphere particles, shared sprite stamps
js/core/engine-kinds.js  NEW  entity kind registry: one record per kind —
                              { interactive, promptable, light, draw(g,e,t),
                                fire(e, api, sys) } — replaces both if-chains
js/core/engine.js        REWRITE  sim core: rooms, collision, entities,
                              fixed-step loop, camera, input, transitions,
                              API facade (unchanged shape)
```

Load order: `engine-look.js`, `engine-kinds.js`, then `engine.js` (all before
the room files). Every suite's MODULES list gains the two new files. That is
a mechanical edit, done by script in phase 1.

### Sim
- **Fixed 60 Hz step with an accumulator**, render interpolated. `dt`
  spikes (tab switch) are clamped to 0.25 s of catch-up.
- **Movement:** acceleration 1100 u/s², friction 1400 u/s², max 96 u/s
  (unchanged top speed, so puzzle timings hold). Ice keeps today's
  commitment rules exactly.
- **Corner correction:** when an axis move is blocked and the obstruction
  overlaps the feet box by ≤ 5 u on the perpendicular axis, slide around
  it. One-tile doorways stop snagging.
- **Facing-aware targeting:** pick the interactive entity in reach with the
  lowest `distance + 10·(1 − facing·dir)`. The bias picks the thing in
  front; REACH itself is unchanged.

### Camera
- Exponential follow (`k = 1 − e^(−10·dt)`) toward a target leading
  12 u in the facing direction. Pixel-snapped at the draw scale. Clamped
  to the room; centred if the room is smaller than the view.
- **Pad-aware framing:** when `.tpad` is visible, the target shifts up by
  half the pad's height, so the player is never under a thumb.

### Viewport scale
- `scale = clamp(floor(min(W / (20·16), H / (12·16))), 2, 6)`: about 20×12
  tiles visible. Today 1280×800 shows 26×16 at 3× in a void; v2 shows
  20×12 at 4×. A 390×844 phone goes from about 8 tiles across to 12.
- `NEU.engine.SCALE` becomes a getter returning the live scale. The
  exported `TILE` is unchanged.

### Renderer (engine-look)
1. **Static layer**: baked once per room (and on resize/look change) to an
   offscreen canvas at 1 px = 1 world unit, then blitted scaled with
   smoothing off. Per-frame tile cost drops from O(visible tiles) to one
   `drawImage`.
2. **Autotiler (3/4 view)**, derived from the grid, no new art:
   - a solid cell with open floor below → **wall face** (6 u tall, darker
     ramp, highlight lip on top, mortar/bark rows by zone);
   - a solid cell with solid below → **wall top** (lighter cap, 1 u rim
     where it meets open floor on any side);
   - floor → zone texture: hash-dithered 2-tone noise plus a sparse detail
     glyph (grass tuft, crack, tile seam, puddle);
   - **contact shadow**: floor cells under a wall face get a 4 u dark band;
     floor beside walls gets a 2 u AO edge;
   - special tiles keep their meaning with clearer looks: `,` lit path is
     2–3 steps brighter and warm (it must read as "walkable", per the room
     design note), `i` ice shimmers (animated, drawn per frame), `~`
     undergrowth reads as foliage, `|` pillars get a face, `_` carpet gets
     an edge trim, `A` plinth reads as raised.
   - When a tileset's atlas is loaded, its tile is used as a **texture
     layer** under the autotile shading. The palette fallback stays
     (fixes14 asserts both exist).
3. **Entities and the player**, y-sorted, each with a soft pixel shadow
   ellipse. Player v2 uses the same 9×13 ASCII primitive, plus:
   - a 4-frame walk on distance;
   - an idle 1 px breath bob and an occasional blink;
   - a 1-frame squash on stop (off under reduced motion).
   NPCs without a sheet become a tinted "figure" sprite with an idle bob,
   not squares. Blocks get a bevel and top face; plates get a rune that
   lights; braziers get a flicker flame; exits with a lock get a small
   padlock glyph; save points keep their star and gain a light pool.
4. **Lightmap** (quarter resolution, multiplied over the scene, then an
   additive glow pass):
   - zone ambient (woods 0.62, castle 0.70, city 0.74, storm 0.58,
     prize 0.80, home 0.85);
   - light sources from kinds: save, lit brazier, lit path (faint),
     exits (faint, cool), `room.light` hook, plus a small player lantern
     in dark zones;
   - `room.dark` maps onto ambient → near-black, with the light centred
     on `room.light` or **the player**, never the screen. Light rings stay
     **stepped** (4 hard bands): the project's "every pixel has a hard
     edge" rule from the old design note.
5. **Atmosphere** per zone, cheap particles in world space:
   - woods: fireflies + drifting leaves;
   - castle: dust motes in light;
   - city: drizzle + puddle ripples;
   - storm: rain sheets + lightning (off under `noFlash`);
   - prize: sparkle;
   - home: dust.
   Particle counts are scaled by the reduce-particles switch; under
   reduced motion they become static specks.
6. **Prompt**: a small speech-bubble glyph above the target (key "E" on
   keyboard, the pad's label on touch). It eases in and bobs. It hides
   while a dialogue is open.
7. **Transitions**: a pixel "iris" (stepped circle closing on the player,
   opening on the spawn) at 0.32 s. A plain cut under reduced motion.

### Kinds registry (engine-kinds)
Today's behaviour moves **verbatim**, branch by branch, into kind records:
`exit pickup save sign npc altar block plate brazier trigger` plus a
`default` (run hook or tinted figure). `interactive()` / `promptable()`
become lookups. A room-level entity with an unknown `t` and a `run` hook
keeps working exactly as today.

## 5. Phases (each ends green + screenshots + commit)

- [x] **P0 characterisation.** `tests/fixes22.mjs` pins today's
  observable behaviour before anything moves:
  - the API surface and the `c.*` hook surface;
  - every entity kind in shipped rooms has a handler;
  - interaction cooldown, locked doors, pickups persisting, npc resume;
  - push and ice rules, puzzle solve/reset;
  - transitions landing on spawns;
  - `NEU.engine.SCALE` and `TILE` semantics;
  - no ES6 in the three engine files.
- [x] **P1 structure, no visual change.**
  - Extract `engine-kinds.js` (verbatim branches).
  - Add the fixed-step loop and the camera module.
  - Add the two new files to index.html and every suite's MODULES (by
    script).
  - Gate: 18 suites + fixes22 green, and screenshots identical in layout.
- [x] **P2 renderer.**
  - Viewport scale.
  - Static-layer bake, autotiler, floor texture, contact shadows.
  - Entity sprites, shadows, player v2.
  - Screenshot review on desktop + phone for every zone.
- [x] **P3 light + atmosphere.**
  - Lightmap with kind-declared lights; dark rooms centred on player/light.
  - Zone weather and particles, wired to every accessibility switch.
- [x] **P4 feel.**
  - Acceleration and friction, corner correction, facing-aware targeting.
  - Prompt bubble, camera easing with look-ahead, pad-aware framing.
  - Iris transition.
  - Tests: corner correction gets through a 1-tile door from a 4 u
    offset; targeting prefers what you face; the pad never covers the
    player.
- [x] **P5 proof.**
  - Human-paced playtest in Obscura and Chromium (desktop + phone touch):
    walk every zone, solve b2–b5, the b6 dark room, the doors.
  - Perf: frame time at 1280×800 and 390×844 with weather on.
  - Update `memory/architecture.md`, `pending.md`, the z-ladder note if
    anything changed.
- [ ] **P6 optional.** Adopt the look kit (shadow, glow, particles,
  player sprite) in `dark.js` and `bullet.js`.

## 6. Folded-in ultraplan items

These are delivered by this plan, not by separate batches:
- **F1** `const` in engine.js;
- **F4** `later()` scene-scoped timers (`api.later`, cleared on room change);
- **F11** TILE/REACH contract (fixes22 asserts reach.mjs agrees);
- **B3** camera kick;
- **B10** squash/stretch;
- **L4** zone ambience (atmosphere hooks);
- **K5** pad overlap (pad-aware framing).

## 7. Risks

- **Tests reading `SCALE` as a constant.** It becomes a getter: grep and
  adapt in P1.
- **Bake cost on resize.** Debounce it at 150 ms.
- **jsdom canvas Proxy.** An offscreen `createElement('canvas')` gets the
  same stub, so the bake is a no-op under tests. Logic tests are
  unaffected; visuals are proven in the browser.
- **Puzzle timing.** Top speed is unchanged and ice rules are untouched.
  Acceleration only affects the first ~90 ms.
