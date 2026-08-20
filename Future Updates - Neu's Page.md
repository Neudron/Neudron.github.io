### Future Updates - Neu's Page

**All six items delivered and verified 2026-08-19** — every one is covered by
`site/tests/fixes8.mjs` (99 checks, all green; full sweep 1440 checks / 15
suites green).

1. ~~**Add a healing bar that charges over-time similar to the "Rage" feature of Calamity**~~
   ✅ **DONE.** `boss-scal.js`: rage builds `dt/20` while HP is below max; at
   1.0 she heals one heart and says so. Meter drawn under the HP line.
2. ~~**Add a TP feature similar to deltarune that grants you with a stronger attack or a shield**~~
   ✅ **DONE.** Grazing bullets builds tp (0.4/s per graze); full tp + `x` =
   a 2.5s Rover-Drive-style shield ring that eats one hit (blue ring, snap
   sound, burst on break). Meter under the HP line, gold when full.
3. ~~**Make the puzzles harder a lot of them you can just cheese them pressing R**~~
   ✅ **DONE.** `resetPuzzle()` now has a 4s settle timer — R-spam says "the
   room is still settling" instead of silently resetting.
4. ~~**Make the puzzles not be holding e while walking to the right, 4 of them are just that**~~
   ✅ **DONE.** b2 = riddle stones (press the stone the plaque describes,
   wrong presses dim; queue blocks the row, so the answer is approached
   from below). b3 = braziers in a stated order. b4 = a NEW engine
   mechanic, the ice slide — commit to a line of ice, plates lock only
   when a slide dies on them. b5 = a mirror that holds the second plate.
   b6 = carry the torch through the dark and seat it in the socket.
5. ~~**Improve the visuals of the woods with actual sprites from the games that we took inspiration**~~
   ✅ **DONE** (shipped 2026-08-17, item 2.2): all six zones draw real
   16×16 art from the Deltarune atlases, woods included.
6. ~~**Fix a lot of the things being just cubes or using a made-up sprite instead of ones that we have in the img folders**~~
   ✅ **DONE.** Axe, recall and mushroom props now draw their real sprites
   via `sheet`; the `decor` entity type was decided against — no fake art.