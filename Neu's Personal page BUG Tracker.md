### Neu's Personal page BUG Tracker

> **STATUS 2026-08-24** — the 2026-08-22 status block above this line was
> wrong: it declared bugs closed on the strength of suites that were 20-44%
> regex-on-source-text (asserting a string exists in a `.js` file, not that
> the game behaves), and on sprites that were wiki/rip-site rips with
> pixel-measured, sometimes-guessed frame geometry. This entry replaces it
> with what is actually verified — root cause, fix, and the test that now
> fails without it — after a full source-accurate rebuild against
> CalamityModPublic (the mod's own repo, commit `1a8cebd`, cloned to
> `_sources/calamity-src/`, never shipped). Suites: `fixes7` 64/64, `fixes8`
> 107/107, `fixes13` 80/80, `fixes17` 331/331, `fixes18` 131/131 — all
> converted off regex-on-source assertions onto behavioral ones.
>
> - **Worm is only a head, hearts inside it require taking damage** → root
>   cause: hearts were pinned to body segments on a worm that deals contact
>   damage while charging, so reaching a heart was structurally a trade.
>   Fixed per the mod source (`SepulcherHead.cs`/`BrimstoneHeart.cs`, both
>   unreadable before Phase 0): 10 static hearts anchored in the arena's
>   upper corners, the worm's own contact damage removed entirely
>   (`NPC.damage = 0` in source), and its charge/chase now targets Calamitas,
>   not the player.
> - **Tail floats detached from the body** → it was drawing at the oldest
>   sample of a 260-entry trail while the body only spans ~6 segments; fixed
>   to draw one segment-spacing past the last real body segment.
> - **Calamitas has an empty attack (hellblast fires nothing)** → the
>   closure handed to the projectile scheduler was never invoked — it
>   returned its own handler instead of calling it, so `setTimeout` executed
>   nothing. One of her 20 cycle steps (`'h'`, 4/20 = 20% of the fight) was
>   silently idle since it was written. Fixed; also fixed the charge count
>   drifting to the wrong pattern after cycle 1 (indexed absolute step
>   number instead of position-in-cycle).
> - **Dash/melee doesn't work** → the charge dash *is* her only melee per
>   source; the unreachable `dive()` path (never in `CYCLE`, contradicted the
>   header comment that already said it was removed) is now deleted rather
>   than half-present. The telegraph before a dash now plays its own
>   animation band instead of the idle pose.
> - **Homing attacks / the worm don't rotate toward travel direction** →
>   both derived rotation from live velocity, which is zero at spawn and
>   during any pause; both now track an explicit `rot` updated only from
>   real motion.
> - **You can stand still in the dart wall and never be hit** → the spread
>   was a fixed angle, so gaps between darts widen with distance and become
>   walkable past ~250px; spread is now sized to stay within hit range at
>   any distance the fight actually happens at.
> - **Hitboxes are unfair / some don't even work** → radii were hand-picked
>   constants disconnected from the drawn sprite size (off by 0.36×-2.2× in
>   both directions). Radii now derive from the real Terraria
>   `Projectile.width/height` cited in each `.cs`, scaled to the drawn cell.
> - **Brother attack sprites are broken** → root cause: the brothers'
>   *bodies* were being drawn from their own *projectile* art
>   (`SupremeCataclysmFist.png` / `SupremeCatastropheSlashAlt.png`) because
>   their real NPC sprites (`SupremeCataclysm.png` / `SupremeCatastrophe.png`)
>   had never been added to any manifest, despite existing in the mod repo.
>   Fixed; both now draw their own body + glow art.
> - **Dialog face shows sans instead of hers** → still fixed, now sourced
>   from the boss's real `HoodlessHeadIcon.png`/`HoodedHeadIcon.png` instead
>   of renamed copies.
> - **Dialogs reset on every `e` press** → confirmed: the open-tbox guard
>   only covered the `npc` branch. Added the same guard to `sign` (the
>   concretely-reported case — the four V3 hint signs). Left run-hook
>   entities (puzzle stones, the witch, the merchant) unguarded on purpose:
>   an earlier attempt hoisted the guard to the top of `fire()` and broke the
>   riddle-stone puzzle, because a left-open room-intro dialogue kept
>   `tboxOpen()` true and silently blocked their own `.run` interaction
>   logic.
> - **Enter glitches into the 20s minigame on death / ESC inconsistency** →
>   three overlays (`quiz`, `dark`, `deck`) never claimed the shared
>   `activeMinigame` input lock at all, so the room's own keydown handler
>   stayed live underneath them; scal's `close()` also cleared the lock
>   unconditionally, capable of stealing it from whichever overlay opened
>   next. All four now claim/release it correctly.
> - **Sprites wrong vs the wiki** → not fixed by comparing against the wiki
>   (the wiki was never a source of truth); fixed by re-sourcing every
>   Calamity sprite directly from CalamityModPublic under its real filename,
>   with the `.cs` that declares its frame count cited per manifest entry.
>   Deleted the pixel/alpha-threshold measuring apparatus this replaces.
>   Also caught: the boss's own head-icon sheet was one row short of its
>   real frame count, because integer division of `texture.Height /
>   frameCount` in the mod's own `FindFrame` truncates rather than divides
>   exactly — a previous fix had padded the sheet instead of matching that
>   truncation.
> - **First pattern impossible** → rebalanced (see dart-wall entry above);
>   still owed a phone-viewport playtest, not just jsdom.
>
> **Genuinely still open, and why:**
> - Undertale, Deltarune and Terraria sprites (`recall`, `axe`, `mushroom`,
>   `slot`, `tenna`, `firedoor`, `armchair`, `corridor`, etc.) are still
>   rip-site sourced. Re-gathering them the same way as Calamity requires a
>   local game install to unpack (`TExtract`/`UndertaleModTool`) — this
>   machine has neither, so this is blocked on you, not skipped.
> - "After breaking the hearts calamitas just does nothing" and general
>   post-hearts phase-2 feel are unverified beyond jsdom's behavioral
>   assertions — owed a real playthrough.
> - Brothers-killability and hitbox feel generally are tuned to the source
>   numbers but not yet felt out by hand.
>
> **Unrelated, pre-existing, confirmed NOT caused by this pass** (verified by
> `git stash`-ing this session's changes and re-running against the clean
> baseline): `fixes12.mjs` — "no unexpected switches (6)" — and `fixes16.mjs`
> — "music.js is under 24 KB" (it's 24.3 KB; `js/core/music.js` was already
> modified-but-uncommitted before this session started). Neither touches the
> Calamitas fight; left alone.
>
> From Iteration V3, still holding from the prior pass: puzzle signs,
> wall-skip prevention, rage(Z)/TP(X) bars now sourced from
> `UI/Rippers/RageBar.png`/`AdrenalineBar.png` rather than renamed copies,
> dev F8 fight entry, merchant shop UI (`js/act4/shop.js`), TV-sword throw
> and axe→mushroom→heal chain as rooms/craft content.

the supreme calamitas when in the minigame form doesent have its sprite

while in minigame the dialog appears as sans



make the dialogs not reset when interacting with the same object and pressing e



the worm attack of supreme calamitas is broken and dosent work, literal free attack the worm just stands still

the supreme callamitas homing attacks dont have a sprite that rotates at where the player was when they are launched

some hitboxes are unfair and others dont even work



remove the "press esc" to leave on all minigames, you can only leave with a confirmation afrer pressing esc on the top right in SOME not all , decide witch are exitable

improve all the animations of supreme calamitas witch

the dash attack dosent work

supreme calamitas dosent melee you and the melee attack sprites arent used cuz she dosent even melee, fix



sometimes if you press enter it gliches out and puts you into the "20s" minigame when dying

the brother attacks sprites are broken and the sequence dosent end they just spam projectiles until you die + they are unkillable



When you talk to supreme calamitas the text box displays sans icon instead of hers.



Some attacks have impossible patters like the first one

you can fit between the hitboxes of two bullets so you can just stand still and nothing will ever hit you

the flames that explode dont follow you and stand still until calamitas finishes its melee then they just explode on the spot



the worm attack its only a head, it dosent have its body or tail

and the hearts are inside the head so you cant break them without taking damage

the worm is only a head and only makes the circle explosion attack, fix,

it follows you very slowly



after breaking the hearts calamitas just does nothing



alot of sprites of calamitas are just wrong, search the calamity wiki to detect witch attack has each sprite and apply





Iteration V3

the worm only displays one body segment, head and tail.
The worm dosent spawn any hearts 
Supreme calamitas first attack is undodgeable

The puzzle blocks are too hard, dont make sense and skipeable, you have to add a hint in form of a sign in each room
You can skip the rooms just pressing e in the right wall, fix.

The rage and TP bars must be at the left of the combat box, with the sprites of the corresponding game and must work, rage must be activated with Z and the shield of TP with X add the sprites and animations of both of them based on the code of the games, search in github for calamity 

To kill the worm you have to get hit in order to hit him fix
Calamitas has a empty attack

you cant hit the television with the sword cuz its broken from the start. I suggest a fix whould be trowing the broken sword at it
The axe near the merchant should be used to cut the mushrooms and use them in fights to heal
Add a dev option command to run the calamitas fight directly
add a lot more decoration
Add an actual menu interface for the merchant with Graphics etc similar to undertale, MUST BE A GOOD UI with selectable option, price, dialogs etc
Add more attacks to supreme witch calamitas

A lot of the calamitas fight is wrong, mainly the sprites, get the ones form the official calamity repo and apply them, shielded etc based on the code of the BOSS not the NPC!
