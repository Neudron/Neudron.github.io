# Work order V3-100 — nonvisual seam and world graph

**Base:** refresh from latest integrated baseline after V3-000/V3-004. **Owner:** Sonnet 5.5 (nonvisual). **Allowed:** new `js/core/world-graph.js`, `scripts/check-world.mjs`, isolated local tests and `plans/neu-v3/WORLD_GRAPH.md`. **Forbidden:** `engine.js`, `engine-look.js`, `rooms-a.js`, any visual code or persistent schema bump. **Depends:** audited complete graph.

Implement a small ES5 `window.NEU.worldGraph` exposing `get(id)`, `resolveExit(sourceId,exit,save)`, `isSeamEligible(source,target,gate)`, `validate(rooms)` and a feature-disabled default. Verify that A1 right->A2 west and A2 right->A3 west and reverse routes are valid only after exact geometry and water loop review. Dynamic e6_room redirect is NOT static and must resolve at runtime. For each open edge check the named target spawn, gate flags and back route; explicitly label one-way/cinematic edges. Fail safely to legacy transition if malformed.

Test missing target, missing spawn, locked gate, story redirect, old save, no input mutation and no unintentional console bypass. **Done:** nonvisual graph tests pass without modifying renderer. **Rollback:** remove new module and script tag after integration, legacy go remains.
