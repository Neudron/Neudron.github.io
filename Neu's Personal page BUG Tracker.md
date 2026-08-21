### Neu's Personal page BUG Tracker

> **STATUS 2026-08-22** — everything above the V3 line is closed by the
> boss-scal rebuild + suites (`fixes8` 104, `fixes18` 100, `fixes13` 79);
> details in `memory/uat-w5.md` and `memory/pending.md` §5.2/5.4. Cluster map:
>
> - **Worm is a head / no hearts / follows slowly / free attack** → rebuilt:
>   full body+tail via `sepulBody(Alt)`/`sepulTail`, six hearts ride the body,
>   constant pursuit, charges with a 0.35s telegraph, contact damage only
>   while dashing.
> - **Dialog face shows sans instead of hers** → `FACE` map gained
>   `scal`/`scalHood`; unknown speakers no longer keep the previous face.
> - **Homing attacks don't rotate toward the player** → projectiles rotate to
>   their travel direction continuously (superset of launch-time aim).
> - **Flames explode on the spot** → fireblast now homes before its pause,
>   then bursts.
> - **Dash/melee don't work** → CYCLE drives dives (steps 5, 13) and charges
>   (4, 9, 16, 18, 20); contact damage during telegraph/dash covers melee.
> - **Brothers spam and are unkillable** → volley caps + enrage numbers
>   tuned; sequence ends in phase 2.
> - **ESC policy inconsistency** → decided: fights confirm (bullet, scal,
>   polt, quiz, rhythm), rooms/menus stay direct (craft, dark, deck). See
>   `memory/decisions.md`.
> - **Enter glitch into the 20s minigame on death** → Enter guards +
>   `activeMinigame` checks landed in bullet/scal/engine.
> - **Sprites wrong vs the Calamity wiki** → all sheets re-measured against
>   `SupremeCalamitas.cs` (21 rows × 2 cols, real animation bands); 18/18 PNGs
>   match their definitions.
> - **First pattern impossible / safe spots between bullets** → rebalanced;
>   final judgement needs the playthrough (below).
>
> **Still owed — verify by playing it:** post-hearts phase start, brothers
> killability feel, first-pattern fairness on a phone, hitbox feel generally.
> From Iteration V3, also done: puzzle signs, wall-skip prevention, rage(Z)/
> TP(X) bars with real game sprites, dev F8 fight entry, merchant shop UI
> (`js/act4/shop.js`, selectable rows/prices/quips), extra SC attacks, official
> repo sprites incl. shield states. TV-sword throw and axe→mushroom→heal chain
> shipped as rooms/craft content — feel-check them in the same playthrough.

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
