# GPT-Image production prompts — initial audited scene targets

**Status: prompts only. No images generated/approved in this branch.** Exact output pixel dimensions, sprite cell size and palette must be set by visual director after checking `img/act4/sheets.json`, look modules and renderer scaling. Do not produce a sprite with a guessed pivot. All art must be original; references to commercial games describe readability only, not character copies.

Global suffix for all prompts: "Original 2D pixel art, cohesive 16-world-unit exploration tile grid where appropriate. Deliberate hard pixel clusters, consistent three-quarter top-down perspective, no bilinear smoothing, no anti-aliasing, no painterly gradients, no photos, no text, no watermark, no random unrelated props. Props and VFX isolated on true alpha where required. Every frame cell equally sized with stable ground/hand pivot. Produce for manual palette and pixel-grid normalization."

| ID | Scene | Asset family | Production prompt (append global suffix) |
|---|---|---|---|
| IMG-01 | A1/A2/A3 | Forest tiles | Cohesive gloomy green-blue forest floor, moss, dark water bank, upper and lower continuous dirt paths, roots, lantern pools, tree tunnel and seamless transition edge. Keep tile silhouettes distinguishable; design edges to tile without discontinuity. |
| IMG-02 | B1 | Throne props | Dark graphite gothic hall, matching pair of differently worn thrones, ancient carved dais, crimson aisle, columns, candles, brass lock and door panels; separate layered props and collision-safe walk lanes. |
| IMG-03 | B1 | Spell sequence | An original dark crimson witch spell: tiny sparks gather at raised hand, ring assembles, bolt launches horizontally to brass lock, lock cracks and sparks dissipate. Transparent equal-cell animation and separate bolt/impact. |
| IMG-04 | B7 | Trapdoor | Massive circular stone/iron altar seal, ash-filled seams and brass bolts, retracting latches and heavy split panels, distinct closed/unlocking/open frames plus standalone dust. |
| IMG-05 | B4 | Mouse | Tiny warm-gray mouse from above with stable shadow, idle/4-dir walk, inspect, startled, eating cheese, celebration, clean frame cells and separate under-ice blue refraction. |
| IMG-06 | B4 | Ice mechanisms | Transparent and solid ice channels, cracks, pressure arrows, cold reflections, movable guide surfaces, locks and one high-contrast cheese goal; one shared grid and light direction. |
| IMG-07 | B6 | Torch puzzle | Compact torch held up from top-down angle, wall bracket, rotated brass mirror states, carved hidden glyphs and illuminated shadow clues, inactive and active states, distinct interaction silhouettes. |
| IMG-08 | HOME | Recall | Small violet bottle UI icon, raise/drink/empty poses compatible with actual hero proportions, violet floor ring, rising teleport grains and dissipating silhouette; independent aligned animation layers. |
| IMG-09 | Crack | Red rift | Jagged floating liquid-chrome fracture, dark core, metallic red highlights, dormant/reacting/open/collapse states; same outline origin per frame, no blurry glow baked into sprite. |
| IMG-10 | Dungeon | Bed | Side-view old stone checkpoint hut, recognizable bed and doorway, lantern, worn blanket and stone path; legible safe checkpoint among hostile rock, separate prop layers. |
| IMG-11 | Mage | Shop | Gothic subterranean merchant with warm candles, cool stone and a front-facing card table; keep protagonist and opponent visible and table surface clear for dynamic cards. |
| IMG-12 | Mage | Card icons | Distinct attack/heal/defend/parry card symbols, aged-paper borders, idle/selected/used states, no baked digits or letters; legible even in monochrome. |
| IMG-13 | Merchant | Rhythm stage | Character-sized original shop music battle stage, central speakers, two actor positions, small background dancers, optional disco ball and colored pools without obstructing note lanes. |
| IMG-14 | Merchant | Microphone VFX | Two original microphone sprites, colliding at the beat, pixel starburst, sound-wave shards, falling sparks and disco-light ignition in separate stable frames. |
| IMG-15 | Craft | Soup | Mushroom gather/chop/ingredient drop/filled bowl/drinking prop family, separate source pieces, consistent warm food colors and dark outline. |
| IMG-16 | Inventory | Item icons | Family of equipment silhouettes: melee, ranged, spells, shields, potion, coins and keys; consistent target UI cell size and bright pixel focal highlight. |
| IMG-17 | Dungeon boss | Gate | Monolithic chained bone-and-stone entrance, closed/rumbling/unlocking/open, ancient rock detail but clean interaction route. |
| IMG-18 | Polterghast | Spectral projectiles | Original ghost hooks, chain arcs, bright-centered ectoplasm, stage-transition ghost aura and pixel explosions; hitbox-meaningful silhouettes. |
| IMG-19 | Minecart | Cart sprites | Side-on small iron-wood minecart, wheels, bounce, crash, debris and safe respawn poses; separate track dust. |
| IMG-20 | Elevator | Door layers | Straight-on worn industrial double doors, metal rails, red lights, dust; two independently animatable panels, no fake full-screen flat cut. |
| IMG-21 | Painter | Tavern | Warm mountain tavern with paint-covered workbench, easel, windows, painter seat and two dramatically different mountains depicted in paintings; keep walkable floor. |
| IMG-22 | Village | Snail | Comically overpowered mechanical fantasy snail with passenger seat and expressive face, idle/board/accelerate/stop frames, separate motion effects. |
| IMG-23 | Exo | Arena collapse | Mechanical arena floor, luminous circuit panels, damaged reactor parts, safe readable boundary fragments and debris layers against toxic green atmosphere. |
| IMG-24 | Victory | Overlay | Restrained boss-vanquish particles: dissolving magic, broken links, smoke, embers, light shafts; transparent layers that never conceal character and combat status. |

**Production checklist:** check current sprites -> confirm legal candidate -> determine actual size and pivot -> create coherent style seed -> generate -> human clean pixels/alpha -> in-game screenshot -> 1×/2× check -> approve -> record manifest. Prompt alone never satisfies an asset task.
