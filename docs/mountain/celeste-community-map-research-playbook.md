# Celeste community-map research: agent playbook

**Status:** Research workflow, not proof of any new room's quality or playability. The 60-room mountain research gate in [celeste-reference-evidence.md](./celeste-reference-evidence.md) remains OPEN until real mod room geometries, route evidence and playtests have been analyzed. This document does not import Celeste content into the game.

## Goal

Give an AI agent **real map geometry + visual room previews + input recordings + player observations** and ask it to infer reusable design principles, not to trace/copy rooms. One map image or one TAS recording is not enough to claim a challenge is enjoyable, fair or beatable.

Current project files: [mountain.js](../../js/act4/mountain.js) defines eight story rooms (m0..m7) and three research prototypes (mtest_easy, mtest_medium, mtest_hard); [geometry-fixture-inspection.md](./geometry-fixture-inspection.md) and [celeste-reference-evidence.md](./celeste-reference-evidence.md) contain partial earlier research. Our platforming is a 16 px tile-grid ES5 JavaScript implementation. Celeste uses 8 px tiles. Distances, momentum, timings and difficulty must be recalibrated to our *actual* player physics; a factor-of-two spatial conversion alone cannot prove parity.

## Source packs: obtain actual maps

| Source | Maps and training value | Where to obtain |
| --- | --- | --- |
| **Strawberry Jam Collab** (released 2023; source repo named 2021) | Beginner, Intermediate, Advanced, Expert, Grandmaster; many room styles and skill progression | [Playable maps archive](https://gamebanana.com/mods/424541); [mechanics/plugin source](https://github.com/StrawberryJam2021/StrawberryJam2021); [TAS route scripts](https://github.com/VampireFlower/StrawberryJamTAS) |
| **Spring Collab 2020** | Multi-author map comparisons and ascending lobbies | [Playable maps archive](https://gamebanana.com/maps/211745); [mechanics/plugin source](https://github.com/EverestAPI/SpringCollab2020); [room/exit randomizer routing descriptions](https://github.com/bigkahuna443/sc2020-randomizer) |
| **Glyph** | Complex but cohesive spatial motifs and transitions | [Map pack](https://gamebanana.com/mods/150453) |
| **Into the Jungle** | Beginner-friendly campaign-scale pacing | [Curated collection containing campaign](https://gamebanana.com/collections/98654) |
| **Monika's D-Sides** | High-difficulty remixes of familiar mechanics; stretch references only | [Creator page](https://monika523.carrd.co/) |

Important: **The GitHub code repositories above do not themselves guarantee inclusion of playable level .bin files**. For actual solid/spike/collectible placement, download the *map pack* archives from their authors and inspect the bundled **Maps/**/*.bin** files. A plugin repository's entity definition only describes what a mechanic can do, not where the mapper placed it. Do not confuse a mod's source/plugin code with its level geometry. Do not commit or redistribute third-party level .bin files, screenshots, sprites, music or raw extracted map JSON into this public repo without the necessary rights. Maintain sources in a separate local folder.

## Verified sample TASs (paired with same-name Strawberry Jam .bin)

These are actual publicly visible tool-assisted inputs, suitable for matching to map geometry once the archive is obtained:

| Skill tier | Map | TAS evidence | Start of practical study |
| --- | --- | --- | --- |
| Beginner | Forest Path | [forest_path.tas](https://github.com/VampireFlower/StrawberryJamTAS/blob/main/1_Beginner/forest_path.tas) | lvl_a-01 / lvl_a-02 |
| Beginner | Collapsing Skyline | [collapsing_skyline.tas](https://github.com/VampireFlower/StrawberryJamTAS/blob/main/1_Beginner/collapsing_skyline.tas) | lvl_a-01 |
| Intermediate | Vertigo | [vertigo.tas](https://github.com/VampireFlower/StrawberryJamTAS/blob/main/2_Intermediate/vertigo.tas) | lvl_Evilleafy-00 |
| Advanced | Forest Rush | [forest_rush.tas](https://github.com/VampireFlower/StrawberryJamTAS/blob/main/3_Advanced/forest_rush.tas) | lvl_a00 |

For example, Forest Path's section labeled lvl_a-01 starts with a one-frame left+jump command followed by a 14-frame right+down+dash command. CelesteTAS uses **frames,buttons** notation: R/L/U/D are directions; J is jump; X is dash; G is grab; other tokens must be interpreted using the official [CelesteTAS input-file reference](https://github-wiki-see.page/m/EverestAPI/CelesteTAS-EverestInterop/wiki/Input-File). These are optimized TAS routes, *not* proof of the intended route, human difficulty or quality. Pair them with a video / real game test.

Other valuable tools:
- [Lönn](https://github.com/CelestialCartographers/Loenn): inspect exact rooms visually; supports Celeste-format maps.
- [loenn-mcp](https://github.com/Magedeline/loenn-mcp): agent-addressable .bin parser, room query, JSON export, HTML preview and approximate difficulty analysis.
- [ScreenshotTool](https://github.com/d-002/ScreenshotTool): scan full rooms/chapters; use screenshots for sightlines and art-to-collision contrast.
- [CelesteTAS](https://github.com/EverestAPI/CelesteTAS-EverestInterop): verify frame-level routes and challenge timing in an actual running Celeste game.
- [Berry Camp vanilla room viewer](https://berrycamp.github.io/celeste): useful visual baseline but not a substitute for mod .bin geometry.

## Linux/Claude Code acquisition and inspection

Run locally on the author's Arch machine, NOT against GitHub. This keeps copyrighted reference content outside the repository and avoids touching deployable game code.

~~~bash
sudo pacman -S --needed git unzip python uv
mkdir -p "$HOME/celeste-study"/{mods,tas,routes,notes}
git clone --depth 1 https://github.com/VampireFlower/StrawberryJamTAS.git "$HOME/celeste-study/tas/StrawberryJam"
git clone --depth 1 https://github.com/bigkahuna443/sc2020-randomizer.git "$HOME/celeste-study/routes/SpringCollab2020"
uv tool install --from 'git+https://github.com/Magedeline/loenn-mcp.git' loenn-mcp
claude mcp add --scope user --env LOENN_MCP_WORKSPACE="$HOME/celeste-study" --transport stdio celeste-maps -- "$HOME/.local/bin/loenn-mcp"
claude mcp get celeste-maps
~~~

**Manual map download:** Download the Strawberry Jam/Spring Collab *map pack* zip(s) from the above author pages and extract them to "$HOME/celeste-study/mods/StrawberryJam" and "$HOME/celeste-study/mods/SpringCollab2020", respectively. Check whether the extracted ZIP has an additional top-level folder. Do not confuse these downloads with separately published audio files or helper-only code packages.

~~~bash
# Example, after downloading an archive; replace the actual local filename:
unzip -q "$HOME/Downloads/StrawberryJam.zip" -d "$HOME/celeste-study/mods/StrawberryJam"
find "$HOME/celeste-study/mods" -type f -name '*.bin' | head -30
# Choose an actual path from the find output:
pcgscene scan "/actual/path/from/find.bin" --json > "$HOME/celeste-study/notes/map-scan.json"
pcgscene score "/actual/path/from/find.bin" --room "lvl_a-01" --json > "$HOME/celeste-study/notes/room-score.json"
~~~

Tool command syntax and features should be checked against the currently installed loenn-mcp README; the utility has changed versions. **No local install or zip extraction was run by the author of this guide.** The repository's existing public 20-room inventory is incomplete, and not equivalent to inspecting these downloaded mods.

## Required per-room research process

1. **Provenance** — source page, package, archive version/hash, original mapper, map filename and room identifier, helper/entity dependencies.
2. **Geometry** — read exact foreground/background solid tiles, spike sides, kill zones, one-way platforms, ledges, gaps, refill/spring/booster locations, entity positions and nodes, spawn, exits and checkpoint/resets; report grid units. Use loenn-mcp: list_maps, read_map_overview, read_room, get_room_tiles, search_entities, analyze_room_connectivity, render_map_html. Use Lönn/screenshots to inspect spatial composition.
3. **Candidate route** — draw a line over the screenshot from spawn to exit; break into decision segments with each required jump, dash, wall contact, bounce, moving-platform transfer and resource refill. Treat a TAS route as one demonstrated candidate, not the only way through. Match TAS room headings with level IDs. Determine necessary versus optional input sequences.
4. **Difficulty evidence** — measure or experimentally estimate gap widths, expected landing footprints, available resource inventory, timing windows, moving hazard cycles, simultaneous input complexity and penalty for failure. Use 1-frame timing perturbation tests or replay variations where possible. A heuristic danger score alone does **not** establish actual difficulty.
5. **Fun and fairness hypothesis** — identify goal visibility, immediately readable hazards, opportunities to choose/adjust, a single clear learning point, rhythm/release, surprising but understandable interactions, feedback and quick resets. Distinguish observation from inference; validate through a video and human playtest. Fun cannot be inferred from static geometry alone.
6. **Original Neudron adaptation** — describe the abstract lesson (e.g. safe spring introduction followed by spring→dash→refill chaining), then invent a new silhouette, topology, placement, sequencing, and presentation that use Neudron's own 16 px physics and dash/melee bounce. Avoid copying the room or its distinctive visual composition.
7. **Verification** — deterministic playable replay in NEU's real controller, failed-edge-case tests, a captured room image, human playtest or clearly marked absence thereof. Log success, deaths, reset duration, target completion time, confusing areas, and status. Never claim a level has been playtested based on parser output or a TAS alone.

## Standard report shape

Use one JSON record per source room and keep it in *local notes* until clearance is established:

~~~json
{
  "source": {"mod": "", "map_file": "", "room_id": "", "url": "", "archive_sha256": "", "author": ""},
  "measured": {"room_px": [0, 0], "tile_px": 8, "spawn_px": [0, 0], "exits": [], "solids": [], "hazards": [], "entities": [], "checkpoints": []},
  "route_evidence": {"tas_url": "", "segment_inputs": [], "movement_chain": [], "dash_budget": null, "frame_window_tested": false},
  "design_review": {
    "teaches": "", "tests": "", "twist": "", "rest": "",
    "hardness": {"precision": null, "input_complexity": null, "timing": null, "resource_management": null, "failure_cost": null},
    "fun_hypotheses": [], "human_playtest": "not performed", "unknowns": []
  },
  "neudron_translation": {"original_room_proposal": "", "distinct_from_reference": [], "controller_replay": null},
  "status": "UNVERIFIED"
}
~~~

Score difficulty axes individually on an **explicit 0–5 rubric** with the evidence attached (0: absent; 5: extreme/verified narrow tolerance). Never turn these into a fabricated objective "fun score".

## Research gate before enlarging mountain

- Inspect **at least 20 distinct actual community-mod rooms** from **at least 3 independently authored maps**, spread across beginner/intermediate/advanced; add selected harder stretch examples separately.
- Every room needs original source ID and geometry, a visual map/screenshot, a candidate movement route, difficulty reasoning, and a directly stated evidence/unknowns split.
- Build 3 **original** Neudron proof-of-concept rooms: teach, combine, mastery. Pass deterministic controller replay for all 3. Have humans test difficulty/pacing before planning the full chapter.
- Do not run mass room generation or assert the old research gate is complete on the basis of this playbook or metadata alone.

## Agent handoff / task

Read the two existing docs/mountain research files, this playbook, AGENTS.md and js/act4/mountain.js. Download actual authorized Strawberry Jam and Spring Collab map archives *locally*, parse their room .bin files, visually inspect and pair the layouts with exact TAS or player routes where available. Produce at least 20 source-grounded room analyses in local notes first. Do **not** edit game code during research, do not copy community maps/assets into the public repo, do not treat TAS times as human timings, and do not declare the research gate closed until source IDs, geometry, visual evidence, candidate paths and verified test outcomes are present. Only then propose original rooms with source attribution and real-controller validation.
