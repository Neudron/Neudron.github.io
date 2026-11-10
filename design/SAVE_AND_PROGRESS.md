# Save and progression invariants

Verified: `js/core/save.js` uses `KEY = 'neu.save.v1'`, schema `VERSION = 3`; normalisation and v1->v2->v3 migration are present. Do **not** replace or reset the key casually.

Persist stable room/checkpoint, story flags, puzzle completions, inventory counts, equipment, boss outcomes and portal unlocks. Keep transient animation time, input lock, temporary projectile particles and encounter substate out of durable saves unless explicitly resume-safe.

On scene handoff, write a spawn-safe destination after the player lands, not while their character is being pulled through geometry. On one-use item reward, update persistence once and test repeated interaction/reload. Old save fixtures v1/v2/v3 and future versions must be tested before a schema bump. Corrupt saves retain quarantine semantics.

The dungeon's designed death/reset and one-save challenge are separate rules; do not normalize them into ordinary free checkpointing. Never repair progression with blanket flag grants.
