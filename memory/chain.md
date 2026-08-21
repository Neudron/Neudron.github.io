# The chain

Everything past the contact section, in the order it can actually be done.
The objectives panel (Tab, or the tab on the left edge) mirrors this list.

## The 16 steps

| # | id | shown as | how |
|---|---|---|---|
| 1 | `sans` | find someone at the end of the page | scroll to contact |
| 2 | `break` | break the sword | click him, fetch the sword from the top, swing 9× |
| 3 | `door` | open the door in the cube | throw the Broken hero key at the cube |
| 4 | `survive` | last twenty seconds | the bullet room, via "inside" → step in |
| 5 | `dog` | feed the dog | give him "dog food?" |
| 6 | `hammer` | get whatever the dog is chewing | pet the dog 5× |
| 7 | `smash` | break the cosmolight | hit the jammed switch with the hammer |
| 8 | `greydoor` | find the door in the dark | walk to it in the blackout |
| 9 | `answers` | hear all four answers (×4) | press E at the grey door |
| 10 | `clicker` | recover the clicker | step through |
| 11 | `fixed` | put the light back | walk onto the cosmolight, press E |
| 12 | `sleep` | let them rest | happens off screen after the repair |
| 13 | `console` | notice what turned up | return to them a second time |
| 14 | `charge` | charge it the hard way (×2) | carry the console into the room, stand still in the blue beam |
| 15 | `docked` | dock it | click the television at 100% |
| 16 | `deck` | see what it plays | the home screen boots |

`quest.replay(['greydoor','answers','clicker','fixed'])` un-ticks the
repeatable middle so the hammer loop can be run again honestly. `reset()`
wipes everything; `replay()` clears only steps that genuinely became undone.

## The mechanics that matter

**One control, four meanings.** The Cosmolight is the oldest interaction on
the site. `NEU.switchHook()` gives `sans.js` first refusal on every click, in
precedence order: smashed → jammed-and-you-have-a-hammer → jammed → fall
through to the normal light toggle.

**The chain makes you break something that works.** Taking the Cosmolight away
is the only way the blackout means anything. The switch jams at the exact
moment the dog hands over the hammer — being given a tool and then finding
something broken is far better motivation than being given a tool and told to
go vandalise a working one.

**The sleep must happen off screen.** Fitting the clicker only *arms* it, then
scrolls the page to the top so he leaves the viewport; the swap fires from
`hideSans()`. Two backstops (1.2s and 6s) cover a viewport that cannot
scroll — a queued sleep that never fires is a dead end.

**The blue blaster is inverted.** Every other thing in the room punishes
standing still; the electric one hurts you if you move and charges the console
if you do not. The correct play is the one the last twenty seconds trained out
of you. It only charges a console you are actually carrying.

**The deck replaced a boss fight.** The fight's joke was that FIGHT connects
and his HP never moves. One punchline, hearable once. A library you can browse
is a joke with six.

## The console home screen

Six titles. Two run, four fail — and each fails *differently*, because a row
of tiles that all say "coming soon" is one joke told four times.

| title | |
|---|---|
| twenty seconds | launches the bullet room |
| the dark | launches the blackout |
| skeleton simulator | update required, the update server is asleep |
| wax tycoon | missing executable: wax.exe |
| dog 2 | not compatible with this device |
| neu.ac | already running |

The battery in the status bar is the **real** charge from the room. A fake
100% would throw away the only stat the player earned.

## The voices

`say(lines, who)` — `who` is a string or an array parallel to `lines`.

| voice | sound | portrait |
|---|---|---|
| `sans` | `audio/txtsans.wav`, the real sample | Sans_sprite.webp |
| `narr` | high square tick, 22ms | **none** — narration is not a person |
| `dog` | triangle 220→150Hz, 75ms | dog.svg |
| `tv` | thin sawtooth 330→300Hz | tv.svg |

The sample is reserved for lines he actually says. His portrait used to sit in
the corner of every box on the page — including the dog's and the
television's — which did more to make everything sound like him than the audio
did.

## Shortcuts

Dev console: **Ctrl + Shift + `**

```
sans / key   skip the sword errand
door         open the room
game         start the bullet hell
food · dog   grant dog food · summon him
dark · warp  open the blackout · stand at the grey door
sw           stand on the cosmolight in walk mode
sleep · con  skip to the sleeping scene · make the console appear
take         pocket the console, fully charged
chg          fill the charge to 100%
deck         open the console menu
reset        reload
```

In-game: type **69420** while dodging to clear a run. Flip the Cosmolight off
and on to reset the room for another go.
