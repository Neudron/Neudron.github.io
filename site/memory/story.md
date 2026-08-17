# neu — the whole thing, start to finish

Every beat of the game in order, what you actually do, and why each piece is
built the way it is. Spoilers throughout — this is the design bible, not a
walkthrough for players.

**Roughly three hours.** Four acts. It starts as a personal website and never
formally stops being one.

---

## The premise

There is no premise. That is the premise.

You arrive at a portfolio site for someone called neu. Black, pixel-art, a
rotating glass cube in the hero, three sections and a contact form. Nothing
announces itself as a game. There is no title screen, no "play", no tutorial.

The first act is a joke about a website. The second is about breaking one. By
the fourth you are three hours deep in a forest fighting a witch, and the route
there was continuous — you never crossed a line marked *game starts here*,
because there isn't one.

**The through-line:** every act ends by giving an old object a new verb. A
sword becomes a key. A light switch becomes a wall. A television becomes a
door. Nothing new is introduced at the end of an act; something you already
had starts doing something else.

---

# ACT I — the sword

## Finding him

You scroll. Boot screen, hero, about, work. At the bottom, in the contact
section, a small skeleton is standing in the corner.

He is only there while that section is on screen. Scroll up and he leaves;
come back and he returns. That behaviour is load-bearing and it is the first
thing the game teaches you: **this page has state.**

## The errand

Click him. He greets you and a 3D sword materialises in his hand, winds up,
and is thrown — on a solved ballistic arc, not a tween — to the very top of the
page.

So you scroll all the way up, which is a real trip, and take it. A one-time
"up there" indicator points at it the first time it leaves the fold; after that
you know where the sword lives and the badge never returns.

Carry it back down. He is gone — because you scrolled away — and returns when
you reach the bottom again.

## Nine swings

Swing at him. He does not take damage. He has a line for every swing, and a
Minecraft totem of undying pops over his head each time with the real
`item.totem.use` sound at 40%.

Nine swings. Then he runs out of things to say, takes the sword, and snaps it
in half. The blade goes somewhere. The handle lands on the floor to his left
and stays there, under gravity, as a physical object.

It is called the **Broken hero key**.

## The door

The key is not an inventory entry — it is a thing with weight that you pick up
and throw. Throw it at the glass cube in the hero and it opens a door in the
cube's right face.

That door opens a side panel: **inside**.

> **Why it works:** the sword is established as a *toy* — it does nothing, he
> just has jokes about it. Nine swings of nothing is the setup. The break is
> the payoff, and the object survives its own uselessness by becoming a key.

---

# ACT II — the dark

## Twenty seconds

Inside is a full-screen bullet hell. Touhou by way of Undertale: you are a red
soul in a bounded arena, shift to focus (slower, true hitbox drawn), three
hits and you are out.

Survive twenty seconds. Six emitters on drifting cadences — rings, aimed
shots, a spiral, walls, and gaster blasters.

Win and you get **dog food?**

- Type **69420** while dodging to clear a run instantly.
- Flip the Cosmolight off and on to reset it for another go.

## The dog

Feed him the dog food and a dog appears at the bottom of the page. He is
called toby, he is not anyone's, and he fidgets.

Pet him. A hand swipes down over wherever the dog actually is — not a fixed
spot, so it reads as petting *that dog* rather than as a cursor. Five pets and
he spits out a **hammer**.

**At that exact moment the Cosmolight jams.**

That timing is the whole design. Being handed a tool and *then* finding
something broken is far better motivation than being handed a tool and told to
go vandalise something that works.

## Breaking the oldest thing on the site

The Cosmolight is the light switch in the top-right corner. It has been there
since the first second — it toggles the site's light mode, and it is the
oldest interaction on the page.

It is jammed. Hit it with the hammer.

The page goes black.

## Inside the wall

You are now a small pixel character in a black field with a stepped torch —
five discrete rings, not a soft vignette, because everything else on this site
has a hard edge.

Two landmarks glow faintly from beyond the torch, in different colours, so you
can tell them apart from across the room.

Walk to the **grey door**. Press E four times:

> the door is warm. that is not how doors work.
> something behind it is counting. it is not counting up.
> it says you are early. it does not say what for.
> the handle turns now. it was always going to.

Step through. There is a small plastic thing on the floor: the
**Inter-Conexion on-and-off wax free clicker**.

## Out the other side

Through the door is not another room. It is **back out onto the real page**,
still driving the character. The overlay goes transparent and click-through
and you are walking on the actual website.

The Cosmolight in the corner gets a pulsing amber bracket. Walk onto it, press
E, and the clicker seats with a click.

> huh. it fits.
> wax free. still not sure what wax was doing in there.
> i'm gonna go lie down. don't wait up.

The page scrolls itself back to the top.

> **Why the scroll:** he must not fall asleep in front of you. The scroll takes
> him off screen, the swap happens where you cannot see it, and coming back
> down finds them already asleep — which reads as time passing rather than as
> a sprite bug.

**The whole loop is replayable.** Break the light again and the dog produces
another hammer, the grey door gives up another clicker, and the objectives
that genuinely became undone are un-ticked.

---

# ACT III — the console

## They sleep

Scroll back down. Sans and toby are asleep under a blanket with Zzz drifting
up. A television sits to their right, unplugged and unwatched.

## What turned up

Leave and come back a *second* time. A **Nintendo Switch 2** is now lying on
the blanket beside them.

> ...
> that wasn't there before.

Pick it up. It goes into the chip tray with your hammer and your clicker. It
is completely dead.

## Charging it the hard way

The television wants it charged. Go back through the cube door into the
bullet-hell room, carrying it.

There is a **blue gaster blaster** in there, and its rule is inverted: every
other thing in that room punishes standing still, and this one hurts you if
you *move* and charges the console if you don't.

The correct play is the one the last twenty seconds trained out of you.

It only charges a console you actually brought. Stand still empty-handed and
it says *"nothing on you to charge"* rather than silently doing nothing.

Two hits at 50% each. The room draws it in the HUD as a small handheld with a
battery in it.

## Docking

Return to the television. At 100% the dock pulses. Click it and the console
physically flies from your hand into the dock, and the TV lights up.

## The deck

What comes on is a **Steam Deck-style home screen.** Status bar with a real
clock and a battery showing the charge *you* earned. A horizontal shelf of
cover art. Arrow keys and Enter.

Seven titles. Two of the originals run, four are jokes that each fail
*differently* — because four tiles all saying "coming soon" is one joke told
four times:

| title | what happens |
|---|---|
| twenty seconds | launches the bullet hell, **endless** — no cap, one life, score is time survived |
| the dark | launches the blackout, **endless** — the torch shrinks the further you walk |
| skeleton simulator | update required. the update server is asleep. |
| wax tycoon | missing executable: wax.exe |
| dog 2 | not compatible with this device. |
| neu.ac | already running. |
| **the woods** | the only tile with a drawn sigil instead of two letters |

> **Why a launcher and not a boss fight:** the original version put an
> Undertale fight here where FIGHT connects and his HP never moves. The joke
> was good and it had exactly one punchline, hearable once. A library is a
> joke you can browse.

---

# ACT IV — the woods

Three hours of game behind a seventh tile. Thirty-one rooms.

## Zone A — the forest

**a1_clearing.** Black trees, cold ground, and someone has lit a path. It only
goes one way. A signpost with run ink says one word: *ahead*.

The path is the tutorial. You are never told to follow it — by the third room
you have learned *lit ground is walkable* and can read a fork at a glance.

**a2_path.** A long walk. A mushroom grows out of nothing. You cannot take it
and the game says why in one line. *That line is a setup two hours long.*

**a3_fork.** Left is swept. Right has not been swept in a long time. Left goes
to the castle; right goes to a room you cannot use yet — and it says so as a
promise rather than as a wall.

## Zone B — the castle

**b1_throne.** A room much too big for one person. A witch in red asks for
help: there is a thing in the back of her castle, small, loud, very rude about
it. The rooms between here and there lock themselves.

Beside her throne is **a second throne**, and the dust on it has been
disturbed recently. Nobody points at it.

> **The lie and its evidence are on screen together.** A reveal whose evidence
> was never shown isn't a twist, it's a surprise — which is worse.

Five puzzle rooms. **Nothing in them is timed.** Fights are where reflexes
live; rooms are where thinking lives, and mixing them makes both worse.

| room | rule |
|---|---|
| **b2_blocks** | Two blocks, two plates, **two pushes** in opposite directions. Teaches: you push *away* from yourself, so stand on the far side. |
| **b3_braziers** | Order matters. A plaque says *third, first, fourth, second* and you can re-read it — hiding it behind one viewing is a memory test, not a puzzle. Wrong press, all four go out and it tells you the order again. |
| **b4_ice** | Polished floor. A pushed block does not stop until something stops it. "Push a block" becomes "aim a block". |
| **b5_two** | **Breaks the rule b2 taught.** Two plates that must both be held, and one block. The answer is the badly-cleaned floor-to-ceiling mirror on the north wall: stand on one plate, and the reflection stands on the other. It is nonsense and the castle knows it's nonsense. |
| **b6_dark** | The torch from Act II, in a room about remembering a shape. A callback, not a reskin. |

Every puzzle resets with **R**, and the first one tells you so.

**b7_altar.** A stone bowl with a ring of ash in it that has been there long
enough to be part of the stone. It wants more. Reachable from the fork *long*
before it is useful — going out of your way early and being told exactly what
something wants is how you build a mental map.

Second mushroom is in here.

**b8_arena.** A door with nothing written on it. A point of no return that
says so, and lets you leave. The save point is right there.

## Zone C — Supreme Witch, Calamitas

She was the small boss.

Her attack cycle is **twenty steps, fixed, and it does not reset when she
changes phase.** That is taken from the game and it is the single most
important thing preserved: a fixed cycle is what makes a wall of projectiles
*learnable* instead of unfair.

```
1  dart bursts      2  hellblast barrage   3  2× gigablast
5  2× gigablast     6  hellblast barrage   7  dart bursts
9  dart bursts     10  hellblast barrage  11  4× gigablast
12 hellblast       14  dart bursts        15  4× gigablast
17 dart bursts     19  dart bursts     (4,8,13,16,18,20 = charges)
```

The **only** randomness in the entire fight is which dart bursts get swapped
for a fireblast or a gigablast.

Three bullet-hell interludes mark the phase boundaries — they're survivable by
standing in the right gap, and they exist so you can feel progress in a fight
whose health bar you're too busy to look at:

- **On spawn** — walls of hellblasts, then the **Sepulcher** with ten Brimstone
  Hearts. Kill the hearts to kill it. She is invincible until it dies, *and the
  bar says "calamitas — shielded"* rather than silently eating your hits.
- **75%** — adds fireblasts from offscreen.
- **50%** — adds gigablasts.
- **Then the brothers.** Cataclysm on the right throwing fists, Catastrophe on
  the left throwing slashes. She is invincible while they live.

Both brothers dead: she laughs. Phase two — a glowing aura, faster attacks,
half the charges, and she **resumes the cycle where it left off**.

Her HP bar *moves*. That contrast only lands because the fight on the
television refused to.

She drops **Ashes of Annihilation**, sits back down, and says: *"the small one
was me. obviously."*

## The fire door

Take the ashes back to b7. The bowl takes them without a sound, which is worse
than a sound. A door opens in the east wall. It is on fire. It does not seem
bothered.

## Zone D — the city

**d1_street.** Weather, and a stall. Ten items on a board:

```
a bent nail — 2g          a working watch, wrong — 11g
half a map — 5g           a sock, dry — 1g
a jar of something — 9g   a smaller stall — 40g
Recall Potion — <<        a promise — free
a chair leg — 3g          an axe — not for sale
```

Nine of them are junk you will never need — a shop where everything is useful
is not a shop, it's a menu. **One name is lit.**

> **The glow is a tutorial.** You learn here, cheaply, that this game points at
> things by lighting them. It gets cashed in five hours later when a single
> cracked pixel is the only way forward.

The axe is on the counter, visibly, and he tells you not to ask about it. A
person refusing you, not a price tag.

**d2_alley** and **d3_square** hold mushrooms three, four and five, plus
graffiti reading NEU that someone crossed out and rewrote, worse.

## Zone E — home

Drink the Recall Potion in the chalk circle. The square folds up like a map.

Three near-identical grey corridors. An empty picture frame with the nail still
in the wall. A vase put back together at least once. A door you don't have a
key for and don't want one.

> **It is the least interesting place in the act, on purpose.** The tempo has
> to drop or the last corridor can't land quietly.

**e4_corridor.** Golden light from nowhere. He's at the far end, not blocking
it.

> so you did all that.
> the witch, the ash, the door, the potion. that's a day.
> listen. the television. the one in the corner of the actual page.
> it's been playing something this whole time and nobody's watching it.
> you've still got that sword up at the top of the page.
> **hit the television with it.** i'm not going to explain that one.

No fight. Just a flag — and an object two acts old gains a new verb.

## Zone F — Tenna

Break the TV with the sword. Something climbs out of it.

**Twenty questions**, four options, four each on Valorant, Isaac, Minecraft,
Terraria and Undertale. Categories never repeat back-to-back; five Terraria
questions in a row reads as one long question.

Four rules keep it from being an exam:

1. **The rank thresholds are on screen before question one.** A rank you can't
   predict is a rank you didn't earn.
2. **The 12-second timer is generous and visible, and running out is just a
   wrong answer** — a timer that eliminates you turns knowledge into reflexes.
3. **The answer is revealed immediately, every time.** Results-at-the-end is an
   exam; instant reveal is a game show, and the difference is entirely pacing.
4. **Nothing is unwinnable and nothing is free.**

Nine ranks, D- to S+. **Cumulative** — holding A opens A and everything under
it. Only your best run ever counts, so a bad re-run can never close a door.

## Zone G — nine doors

A corridor with nine doors, one per rank. The ones you didn't earn are locked,
labelled, and right there — hiding them would make a bad score feel like a bug.

Each room is one joke, one object, one line. A prize room that takes five
minutes is a chore wearing a reward's clothes.

> D- a participation certificate, unsigned — somebody started writing your name and gave up after the first letter
> D  a chair, facing a wall
> C  a vending machine with one button and no slot
> B  a fish tank with no water. the fish appear to be fine
> B+ a poster of a much better room
> A  a piano with three keys. all three are middle c
> A+ a shelf of books, all the same book. it is called THE BOOK
> S  a very small door you cannot fit through. through the keyhole: another, smaller door
> **S+ nothing at all, and a staircase down**

## Zone H — the machine

Down the staircase: a door the size of a house with weather inside it. Not
locked. Never needed to be.

Behind it, one vending machine humming alone in the biggest room in the world.
One item, slot D4: **"Deez Nutz"**.

You have no money. You have never had any money. The game never offers to sell
you anything. The verb is **punching**, six times, and the machine gets more
passive-aggressive each go:

> you hit the vending machine. it does not comment.
> you hit it again. it makes a note of this.
> the bag moves about a centimetre. the machine sighs.
> the machine says something in a language of servos.
> it is very nearly over the edge. so is the machine.
> the bag drops. **the machine turns its light off, pointedly.**

You eat them standing up, in a storm, out of a machine you assaulted.

> they are fine.
> ...
> they are not fine.

## The hallucination

Colours rotate. The geometry stays exactly where it was — moving both at once
is disorienting for no gain.

You need **mushroom soup**. You are certain of this in a way you cannot defend.

Five mushrooms. You know where all five are, because you have walked past every
one of them. And you need something sharp, which you have never had.

> **The same object, three answers.** Sober: *"you have no reason to want it
> and nothing to cut it with."* Tripping, unarmed: *"you want it very badly.
> you have nothing sharp."* Tripping, with the axe: you take it. One entity,
> three responses, depending on the state of the world.

## Zone I — the argument

Go back to the merchant. Third state:

> you again. you look terrible.
> the axe? still not for sale.
> ...but i'll go against you for it. you look like you'd lose.

**A Friday Night Funkin' rap battle.** Call and response — he plays four bars,
you play them back, so you are never sightreading. Three rounds, each faster
and denser. Tug-of-war health bar. Losing restarts the round, not the battle.

> **The one thing that had to be right:** timing comes from
> `AudioContext.currentTime`, never accumulated rAF deltas. rAF drift is
> invisible per frame and ruinous over a minute — a chart that starts in time
> is a quarter-beat late by the second verse, and the player correctly
> concludes the game is broken.

Win: *"that was rude and i respect it."* He hands over the axe.

## Zone J — the pot

Chop all five. Then a **3×3 Minecraft crafting grid**.

The recipe is a **shape**, not a count:

```
. . .
M . M
. M .
```

Three mushrooms in a V — the same shape the pot in the room is drawn as, which
nobody mentions. Wrong arrangements are free (nothing is consumed until you
take the result) and the output slot previews the moment the shape is right.

You drink it standing up. It tastes like a decision.

## Waking up

You come round on the page, next to the two of them. They tell you what you
did — the only time in the whole act anyone summarises anything, and it works
because you were not entirely present for most of it.

> you've been out about four hours. toby sat with you.
> you fought a witch. you took her ashes. you went through a door made of fire.
> you bought a potion off a man who doesn't own a shop.
> you went home. you broke a television. you did a quiz.
> then you punched a vending machine and ate something you found in it.
> **the soup was your idea. i want that on the record.**
> anyway. i'm going to sit down.

Toby gets up and goes. He does not look back, because he is a dog.

He sits down in a chair that was not there a minute ago and turns the console
on. The object you spent an act charging is finally his.

## Zone K — the crack

Go back to the cube panel. In the bottom-right corner there is a crack. Four
pixels. It glows, faintly — which you learned to notice from a shop board hours
ago.

**Three clicks.** One would be a button. A dozen would be a chore. Three is the
number where a person goes *"...did that do something?"* and clicks again:

1. A noise, and nothing else. You are not sure you did that.
2. A worse noise, and it visibly widens. Now you are sure.
3. It opens. It is not a crack. It is a hole, and it is round now.

## Polterghast

Something in the wall has been listening the whole time.

Three phases, four grappling hooks, and a clone — taken from the Calamity
behaviour, not invented:

- **P1** — alternates slow + six Phantom Shots / fast + six Phantom Blasts.
  Periodically **glows red**, lines up diagonally, and charges once.
- **P2** (50%) — the hooks **detach** and fire independently through walls.
  Faster, more contact damage, spreads of seven potent shots, charges twice.
- **P3** (20%) — summons a **clone**. Killing it makes the original angrier.
  Hooks re-chain and slow. Spreads of eight every seven seconds — ten if the
  clone is dead. The clone mirrors him across the arena and charges in tandem.

It **looks** 3D and **plays** flat: depth is a scalar, everything is
depth-sorted, and the camera never rotates. A free 3D camera makes a bullet
pattern unreadable, and a boss you can't read isn't hard, it's arbitrary.

Red always means it's about to move, and the HUD says so.

Beat it and it stops, picks you up by a tooth, considers you, and throws you
back through the hole you came in by.

## The hotdog

You land on the main page.

> you're back. you've got wall in your hair.
> i finished the game while you were in there. it was fine. six out of ten.
> got you a hotdog. it's cold. that's not on me, you were gone a while.
> so that's the site. that's all of it.
> there's nothing else. genuinely. you can stop clicking things now.
> ...
> **you're not going to stop clicking things, are you.**

---

# The systems underneath

**45 objectives**, grouped by act. Only the current act expands; later steps
blur to `???` with one step of look-ahead, so there is always exactly one
legible next thing.

**It saves.** localStorage, versioned, autosaving on every room transition and
objective tick. Deltarune-style save points in each hub. A corrupt file is
quarantined rather than deleted — losing three hours to a JSON parse error with
no explanation would be the worst thing the game could do.

**It has feel.** Screen shake driven by decaying *trauma* (squared, so small
hits barely move and big ones punch), hit-stop on a real clock, squash and
stretch, pooled particles. Five tiers — `tick / small / medium / large / huge`
— so a pickup can never shake harder than a boss death.

**It respects reduced motion.** Shake, flash and squash off entirely; hit-stop
kept at a third length, because it moves nothing and removing it takes the
weight out of every impact for someone who only asked for less motion.

**Four voices.** Sans keeps his real `snd_txtsans` sample and his portrait.
The dog gets a low blip with a downward slide, the television a thin sawtooth,
and narration a high tick and **no portrait** — because narration isn't a
person. His face used to be in the corner of every box on the page, which did
more to make everything sound like him than the audio did.

**Dev console:** `Ctrl + Shift + \`` — `sans` · `door` · `game` · `dog` ·
`dark` · `warp` · `take` · `chg` · `deck` · `sheet` · `save` · `wipe` · `reset`
