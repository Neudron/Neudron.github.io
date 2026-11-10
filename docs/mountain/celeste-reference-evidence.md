# Mountain — Celeste reference evidence (in-progress, 2026-11-10)

## Provenance, scope and the research gate

This file is a machine-compiled **evidence inventory**, not a completed 20-room expert level-design review. We inspected actual publicly available mod code, editor declarations and metadata for twenty distinct original Celeste rooms. We have **not** obtained Strawberry Jam, Spring Collab, Glyph, Into the Jungle or Monika's D-Sides map binaries; their precise obstacle geometries and valid input routes are unknown. The mandatory **research completion gate remains OPEN**. In particular this report does not authorize mass production of sixty rooms.

Source for the 20-room inventory: [Berry Camp's `data/celeste.json`](https://github.com/berrycamp/berrycamp.github.io/blob/dev/data/celeste.json), extracted by Berry Camp from original Celeste map metadata. Their [viewer](https://berrycamp.github.io/celeste) provides room previews; links are references, not asset redistribution. Original game's map binaries and previews are **not** incorporated in this repository. The dataset proves identifiers, dimensions, default spawns, grouped checkpoint indices, and some special collectible metadata; it does not include the full per-tile collision layer. 

For every entry below: primary mechanic = **room title is only a label**, not a confirmed inventory of mechanics; secondary mechanic, exact solid/spike/refill/moving-block placement, route inputs, dash/stamina budget, visual sightline, completion time, frame timing, death-reset details, shortcuts, and engagement quality = **unverified** until the actual map binary, clear rendered preview, and/or successful game recording are analyzed. The listed *checkpointNo* is chapter grouping metadata, not proof of an individual trigger placement. Dimensions and spawn coordinates are measured in original game pixels, not estimated.

## Reference-room evidence ledger (20 distinct rooms)

### 01. CITY A — `1` (“Begin”)

- **Source:** original Celeste / city A-side, [room viewer](https://berrycamp.github.io/celeste/city/a/1), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/a/1.png); `data/celeste.json` record `chapters[city].sides[a].rooms[1]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×184 px; starting point (19, 144) px; 1 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Begin”; confirmed metadata-only special object categories golden; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1A fundamentals: space, spring, zip, fall, route choices. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: mountain foot / broken cliffs.

### 02. CITY A — `2` (“Berry and spring”)

- **Source:** original Celeste / city A-side, [room viewer](https://berrycamp.github.io/celeste/city/a/2), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/a/2.png); `data/celeste.json` record `chapters[city].sides[a].rooms[2]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×184 px; starting point (24, 160) px; 1 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Berry and spring”; confirmed metadata-only special object categories berry; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1A fundamentals: space, spring, zip, fall, route choices. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: mountain foot / broken cliffs.

### 03. CITY A — `3` (“Floating platforms”)

- **Source:** original Celeste / city A-side, [room viewer](https://berrycamp.github.io/celeste/city/a/3), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/a/3.png); `data/celeste.json` record `chapters[city].sides[a].rooms[3]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×184 px; starting point (32, 168) px; 1 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Floating platforms”; confirmed metadata-only special object categories berry; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1A fundamentals: space, spring, zip, fall, route choices. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: mountain foot / broken cliffs.

### 04. CITY A — `4` (“Zipper intro”)

- **Source:** original Celeste / city A-side, [room viewer](https://berrycamp.github.io/celeste/city/a/4), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/a/4.png); `data/celeste.json` record `chapters[city].sides[a].rooms[4]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×184 px; starting point (40, 160) px; 1 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Zipper intro”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1A fundamentals: space, spring, zip, fall, route choices. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: mountain foot / broken cliffs.

### 05. CITY A — `5` (“Zipper and top-left berry”)

- **Source:** original Celeste / city A-side, [room viewer](https://berrycamp.github.io/celeste/city/a/5), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/a/5.png); `data/celeste.json` record `chapters[city].sides[a].rooms[5]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×288 px; starting point (32, 272) px; 2 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Zipper and top-left berry”; confirmed metadata-only special object categories berry; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1A fundamentals: space, spring, zip, fall, route choices. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: mountain foot / broken cliffs.

### 06. CITY A — `6` (“Dashless is hard”)

- **Source:** original Celeste / city A-side, [room viewer](https://berrycamp.github.io/celeste/city/a/6), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/a/6.png); `data/celeste.json` record `chapters[city].sides[a].rooms[6]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×184 px; starting point (16, 168) px; 3 published spawn location(s); checkpoint group index 1.
- **Mechanics:** title implies “Dashless is hard”; confirmed metadata-only special object categories berry; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1A fundamentals: space, spring, zip, fall, route choices. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: mountain foot / broken cliffs.

### 07. CITY A — `7` (“Falling ice”)

- **Source:** original Celeste / city A-side, [room viewer](https://berrycamp.github.io/celeste/city/a/7), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/a/7.png); `data/celeste.json` record `chapters[city].sides[a].rooms[7]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×216 px; starting point (64, 192) px; 1 published spawn location(s); checkpoint group index 1.
- **Mechanics:** title implies “Falling ice”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1A fundamentals: space, spring, zip, fall, route choices. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: mountain foot / broken cliffs.

### 08. CITY A — `8` (“Junction”)

- **Source:** original Celeste / city A-side, [room viewer](https://berrycamp.github.io/celeste/city/a/8), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/a/8.png); `data/celeste.json` record `chapters[city].sides[a].rooms[8]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×184 px; starting point (24, 152) px; 4 published spawn location(s); checkpoint group index 1.
- **Mechanics:** title implies “Junction”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1A fundamentals: space, spring, zip, fall, route choices. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: mountain foot / broken cliffs.

### 09. CITY B — `00` (“Start”)

- **Source:** original Celeste / city B-side, [room viewer](https://berrycamp.github.io/celeste/city/b/00), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/b/00.png); `data/celeste.json` record `chapters[city].sides[b].rooms[00]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** B-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×184 px; starting point (8, 144) px; 1 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Start”; confirmed metadata-only special object categories golden; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1B: momentum and climbing in short challenges. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: above the clouds / blizzard.

### 10. CITY B — `01` (“Dual zippers”)

- **Source:** original Celeste / city B-side, [room viewer](https://berrycamp.github.io/celeste/city/b/01), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/b/01.png); `data/celeste.json` record `chapters[city].sides[b].rooms[01]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** B-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×184 px; starting point (40, 168) px; 1 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Dual zippers”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1B: momentum and climbing in short challenges. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: above the clouds / blizzard.

### 11. CITY B — `02` (“Over and under”)

- **Source:** original Celeste / city B-side, [room viewer](https://berrycamp.github.io/celeste/city/b/02), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/b/02.png); `data/celeste.json` record `chapters[city].sides[b].rooms[02]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** B-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 344×184 px; starting point (24, 160) px; 1 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Over and under”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1B: momentum and climbing in short challenges. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: above the clouds / blizzard.

### 12. CITY B — `03` (“Stamina jumps”)

- **Source:** original Celeste / city B-side, [room viewer](https://berrycamp.github.io/celeste/city/b/03), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/b/03.png); `data/celeste.json` record `chapters[city].sides[b].rooms[03]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** B-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 440×280 px; starting point (24, 264) px; 2 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Stamina jumps”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1B: momentum and climbing in short challenges. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: above the clouds / blizzard.

### 13. CITY B — `04` (“Contraption”)

- **Source:** original Celeste / city B-side, [room viewer](https://berrycamp.github.io/celeste/city/b/04), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/b/04.png); `data/celeste.json` record `chapters[city].sides[b].rooms[04]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** B-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 344×192 px; starting point (8, 160) px; 1 published spawn location(s); checkpoint group index 1.
- **Mechanics:** title implies “Contraption”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1B: momentum and climbing in short challenges. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: above the clouds / blizzard.

### 14. CITY B — `05` (“Zip over and up”)

- **Source:** original Celeste / city B-side, [room viewer](https://berrycamp.github.io/celeste/city/b/05), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/city/b/05.png); `data/celeste.json` record `chapters[city].sides[b].rooms[05]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** B-side / chapter city; no quantified difficulty measurement.
- **Measured layout bounding box:** 392×184 px; starting point (24, 168) px; 1 published spawn location(s); checkpoint group index 1.
- **Mechanics:** title implies “Zip over and up”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 1B: momentum and climbing in short challenges. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: above the clouds / blizzard.

### 15. SUMMIT A — `a-00` (“Start”)

- **Source:** original Celeste / summit A-side, [room viewer](https://berrycamp.github.io/celeste/summit/a/a-00), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/summit/a/a-00.png); `data/celeste.json` record `chapters[summit].sides[a].rooms[a-00]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter summit; no quantified difficulty measurement.
- **Measured layout bounding box:** 688×184 px; starting point (160, 168) px; 3 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Start”; confirmed metadata-only special object categories golden; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 7A: long ascent framing, crystal and wall-spring vocabulary. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: final climb.

### 16. SUMMIT A — `a-01` (“Spinners and crystals”)

- **Source:** original Celeste / summit A-side, [room viewer](https://berrycamp.github.io/celeste/summit/a/a-01), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/summit/a/a-01.png); `data/celeste.json` record `chapters[summit].sides[a].rooms[a-01]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter summit; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×264 px; starting point (8, 224) px; 2 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Spinners and crystals”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 7A: long ascent framing, crystal and wall-spring vocabulary. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: final climb.

### 17. SUMMIT A — `a-02` (“Wall springs”)

- **Source:** original Celeste / summit A-side, [room viewer](https://berrycamp.github.io/celeste/summit/a/a-02), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/summit/a/a-02.png); `data/celeste.json` record `chapters[summit].sides[a].rooms[a-02]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** A-side / chapter summit; no quantified difficulty measurement.
- **Measured layout bounding box:** 360×264 px; starting point (8, 232) px; 2 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Wall springs”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 7A: long ascent framing, crystal and wall-spring vocabulary. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: final climb.

### 18. SUMMIT B — `a-00` (“Crystal dashing”)

- **Source:** original Celeste / summit B-side, [room viewer](https://berrycamp.github.io/celeste/summit/b/a-00), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/summit/b/a-00.png); `data/celeste.json` record `chapters[summit].sides[b].rooms[a-00]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** B-side / chapter summit; no quantified difficulty measurement.
- **Measured layout bounding box:** 704×184 px; starting point (160, 168) px; 3 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Crystal dashing”; confirmed metadata-only special object categories golden; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 7B: endurance and tall-room framing. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: summit.

### 19. SUMMIT B — `a-01` (“Wall springs”)

- **Source:** original Celeste / summit B-side, [room viewer](https://berrycamp.github.io/celeste/summit/b/a-01), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/summit/b/a-01.png); `data/celeste.json` record `chapters[summit].sides[b].rooms[a-01]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** B-side / chapter summit; no quantified difficulty measurement.
- **Measured layout bounding box:** 448×384 px; starting point (8, 344) px; 2 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Wall springs”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 7B: endurance and tall-room framing. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: summit.

### 20. SUMMIT B — `a-03` (“Orb room”)

- **Source:** original Celeste / summit B-side, [room viewer](https://berrycamp.github.io/celeste/summit/b/a-03), [published room preview](https://github.com/berrycamp/berrycamp.github.io/blob/dev/public/img/celeste/previews/summit/b/a-03.png); `data/celeste.json` record `chapters[summit].sides[b].rooms[a-03]` (logical path, not a literal JSON property chain).
- **Difficulty classification:** B-side / chapter summit; no quantified difficulty measurement.
- **Measured layout bounding box:** 320×1304 px; starting point (8, 1280) px; 1 published spawn location(s); checkpoint group index 0.
- **Mechanics:** title implies “Orb room”; confirmed metadata-only special object categories none; actual platforms, spikes, refill counts and controls **unknown**.
- **Movement & management:** mandatory jumps/dashes/climbs, dash conservation, stamina, momentum, exact timing, alternate routes and successful traversal duration **unknown**; do not invent timings.
- **Sightline, geometry specifics and reset:** inspect preview and full `.bin` before concluding; checkpoint trigger location and respawn behavior **unknown**.
- **Design interpretation:** candidate for 7B: endurance and tall-room framing. This is a *hypothesis for comparison*, not a confirmed 1:1 mechanical recreation. Proposed original chapter location: summit.

## Source-based code findings (verified against actual files)

| Source | Implementation detail observed in code | Use/guardrail |
| --- | --- | --- |
| [Celeste Player.cs](https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs) | Base values include `MaxRun=90`, `RunAccel=1000`, `Gravity=900`, `MaxFall=160`, with input grace and state machines | Current Neudron controller doubles these velocities for its 16 px tiles versus Celeste's 8 px; compare individually before changing any constant |
| [SJ DashZipMover.cs](https://github.com/StrawberryJam2021/StrawberryJam2021/blob/main/Entities/DashZipMover.cs) | `OnDashCollide = OnDashed`; first collision triggers zip and returns `Rebound`, subsequent collision uses normal collision | Trigger-on-dash and explicit state reset; do not confuse with current proximity-triggered `zip` |
| [SJ MomentumBlock.cs](https://github.com/StrawberryJam2021/StrawberryJam2021/blob/main/Entities/MomentumBlock.cs) | Player lift boost is clamped; source declares max speed and axis-specific caps | Never apply limitless platform impulse; inspect actual code and tuning before port |
| [SJ ResettingRefill.cs](https://github.com/StrawberryJam2021/StrawberryJam2021/blob/main/Entities/ResettingRefill.cs) | Subclasses `Refill`, tracks dash/jump variants and uses the standard refill collider lifecycle | Keep refill availability and cooldown deterministic; do not pull ExtendedVariants into browser |
| [SJ Ahorn dashZipMover.jl](https://github.com/StrawberryJam2021/StrawberryJam2021/blob/main/Ahorn/entities/dashZipMover.jl) | Node count is exactly one, block is resizable, default target is offset right | Explicit endpoints and direction visibility in authoring schema |
| [Spring MultiNodeMovingPlatform.cs](https://github.com/EverestAPI/SpringCollab2020/blob/master/Entities/MultiNodeMovingPlatform.cs) | BackAndForth, no-pause, Loop, no-pause Loop and TeleportBack modes; configurable moveTime, pauseTime and easing | Author routes with predictable cycles and discrete nodes |
| [Spring SafeRespawnCrumble.cs](https://github.com/EverestAPI/SpringCollab2020/blob/master/Entities/SafeRespawnCrumble.cs) | Respawn path selectively reactivates nearby crumbles under the player | Explicit respawn-sensitive reset; avoid instant platform deletion under spawn |
| [Spring SmoothCameraOffsetTrigger.cs](https://github.com/EverestAPI/SpringCollab2020/blob/master/Triggers/SmoothCameraOffsetTrigger.cs) | Camera offset lerps according to player position in a trigger region | Camera configuration belongs to room data and must not hide upcoming landing |
| [Communal ConnectedZipMover.cs](https://github.com/CommunalHelper/CommunalHelper/blob/dev/src/Entities/ConnectedBlocks/ConnectedZipMover.cs) | ConnectedSolid path renderer handles multiple path segments and collision state | Keep collision geometry and visual path synchronized |
| [Communal ShieldedRefill.cs](https://github.com/CommunalHelper/CommunalHelper/blob/dev/src/Entities/Misc/ShieldedRefill.cs) | Dedicated `respawnTimer`, explicit player collision/bounce handling | Shielded interactions need distinct player feedback and collision, not a recolored crystal |
| [Maddie OneWayCameraTrigger.cs](https://github.com/maddie480/MaddieHelpingHand/blob/master/Triggers/OneWayCameraTrigger.cs) | `OnStay` accumulates camera min/max bounds and updates associated barriers | Introduce camera restrictions only where needed, with separate physics boundaries |
| [Maddie CustomSummitCheckpoint.cs](https://github.com/maddie480/MaddieHelpingHand/blob/master/Entities/CustomSummitCheckpoint.cs) | Summit checkpoint numbered IDs avoid collisions with vanilla IDs and support group triggering | Use distinct per-chapter flag IDs and persistent state |

## Actual playable-mod evidence available, but not yet decoded

- [Strawberry Jam All-Red-Berries TAS repository](https://github.com/psyGamer/StrawberryJamARB-TAS) contains per-map `.tas` input files by Beginner, Intermediate, Advanced, Expert and Grandmaster lobby. These are **input traces**, not room geometry, and have not been executed against this project.
- [Strawberry Jam code repository](https://github.com/StrawberryJam2021/StrawberryJam2021) has custom entity code but no playable `.bin` map layouts in its Git tree.
- [Spring Collab 2020 code repository](https://github.com/EverestAPI/SpringCollab2020) also has entity code but no playable `.bin` files in its Git tree.
- [Cairn](https://github.com/Aqu1tain/cairn), [Lönn](https://github.com/CelestialCartographers/Loenn), and [Maple](https://github.com/CelestialCartographers/Maple) can decode or inspect legitimately acquired map binaries. Need map redistribution permission before committing source map data, not merely availability for private inspection.
- [Celeste Next Gym training fixtures](https://github.com/std-microblock/celeste-next-gym/blob/master/mods/CelesteGymTraining/Build/generated.fixture.json) expose three original training rooms (hyper-route, hyper-spikes, hyper-bubble) with real rectangle geometry. They are test fixtures, **not** Strawberry Jam maps.

## Design-to-mountain candidate matrix (not approved for mass production)

| Pattern to investigate | Reference rooms | Proposed stage | Required follow-up |
| --- | --- | --- | --- |
| First movement success has generous recoverable landings | City 1A `1`, `2` | 1, foot | Inspect per-tile preview and test starter input traces |
| Zipper first shown, then combined | City 1A `4`, `5`; 1B `01` | 2, cliffs | Inspect exact zip endpoint and impulse |
| Short fall and safety reset | City 1A `7`; Spring SafeRespawnCrumble | 3–4 | Inspect placement and model respawn deterministically |
| Stamina as a routing constraint | City 1B `03`; Player.cs | 5–6 | Record and play exact climb sequence |
| Crystal and spring rhythm | Summit 7A `a-01`, `a-02`; 7B `a-00`, `a-01` | 7 | Verify refill and wall spring endpoints |
| Tall precision sequence with clear camera | Summit 7B `a-03` (320×1304 px) | 8 | Examine tile geometry, camera lookahead, death recovery |

## Research completion gate — status: NOT PASSED

- [x] Inspected original Player.cs and source implementations from SJ, Spring, Communal and Helping Hand.
- [x] Collected independently identifiable public metadata for twenty vanilla reference rooms with concrete dimensions/spawns and verifiable page links.
- [ ] Obtained and decoded allowed full map geometry for at least twenty representative rooms, including actual mods where accessible.
- [ ] Documented tile-level structures, refill locations, input routes, hazards, timings, checkpoints and successful traversals from real evidence.
- [ ] Examined/played Glyph, Into the Jungle and Monika's D-Sides with verified evidence.
- [ ] Selected and playtested the final principle-to-original-room matrix.

**No timing, playability, difficulty-equivalence or full-mod-map claims are established here.**
