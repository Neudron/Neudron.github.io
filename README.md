# neu

A personal page. One piece of black glass with the mark set inside it, and a
quiet list underneath.

No build step, no bundler, no `node_modules`. Three.js is pinned in the
importmap and served from jsDelivr. Edit a file, refresh the browser.

---

## Run it

Open `index.html` in a browser. That's it.

If your browser blocks ES modules on `file://`, serve the folder:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a repo named **`neudron.github.io`** (the name matters — it's what
   puts the site at the root instead of in a subfolder)
2. Push these files to `main`
3. Settings → Pages → Source: **Deploy from a branch** → `main` → `/ (root)`
4. Live at `https://neudron.github.io/` in about a minute

Because the repo is named `<user>.github.io`, every path in the HTML is
already correct. If you rename the repo to anything else the site moves to
`/reponame/` and the relative paths still work — but the `link` values in
`js/data.js` are absolute, so check those.

---

## Files

```
index.html        four sections + the importmap
img/cat.gif       the reward for a second attempt
audio/            drop vine-boom.mp3 here (optional)
css/style.css     everything visual
js/data.js        your projects — the only file you need to touch regularly
js/main.js        boot, scroll parallax, reveals, lights toggle
js/stars.js       the pixel starfield behind everything
js/scene.js       the glass (ES module)
og.png            social preview card
```

~50 KB of source plus a 68 KB preview image. No fonts of your own, no
build artefacts, nothing to compile.

**If you rename the repo**, update the absolute `og:image` URL in
`index.html` — social scrapers ignore relative paths, so it is the one
path that does not fix itself.

## Changing things

**Projects** — edit `js/data.js`. The array shape is documented in the file.
An empty array is valid; the section hides itself.

**Type** — the actual Undertale fonts. The game's narration, overworld
dialogue and interface are set in **8-Bit Operator JVE** (Jayvee Enaguas).
**Determination Mono** is the faithful recreation of how that text renders
in-game, rebuilt by Haley Wakamatsu from the game's own spritesheet, and
**Determination Sans** is its proportional variant. Both are in use here:

| | |
|---|---|
| `--font` | Determination Mono — body, interface, small text |
| `--font-display` | Determination Sans — boot mark, section headings, contact links |

The font files are not in the repo. Download the webfonts kit from
[gitlab.com/cartr/undertale-fonts](https://gitlab.com/cartr/undertale-fonts)
and drop the whole `webfonts` folder into `site/fonts/`. `index.html` links
that kit's own `stylesheet.css` unmodified, so the `@font-face` rules live
with the kit and there is nothing here to keep in sync. Full instructions in
`fonts/README.txt`.

Until then the page falls back to Pixelify Sans off Google Fonts — also a
pixel face, so nothing looks broken; it just isn't the real thing.

**Every font-size is 16, 32, 48 or 96 px, and that is the font author's own
advice, not a preference:** *"the fonts look best when your font size is a
multiple of 16 pixels."* These faces are drawn on a 16px grid, so at 15px or
17.4px the browser resamples the bitmap and the letterforms turn to mush —
which is how most sites manage to make a pixel font look cheap. There is not
one `clamp()` on type in the stylesheet; display sizes step up through a media
query instead, so they can never land on a fractional pixel.
`-webkit-font-smoothing: none` is set for the same reason.

The kit also ships **Undertale Sans** (Comic Sans) and **Undertale Papyrus**,
which this page does not use. They're there if you want an easter egg.

Two things are still in the old serif and need the font files before they can
be converted: the extruded 3D mark inside the glass (`MARK` in `js/scene.js`,
built from Palatino glyph outlines) and `og.png`. Ask once the kit is in place
and I'll rebuild both from the real letterforms.

**Letterforms of the 3D mark** — `js/scene.js`, line ~26:

```js
const MARK = 'palatino';   // 'palatino' | 'bookman' | 'chancery'
```

All three are inlined as SVG path data. `bookman` is the roundest and reads
warmest; `chancery` is the most ornate.

**If the glass "disappears on a vertical screen", check the CSS before you
touch the camera.** This looked like a framing bug for three rounds and was
not one. `.stars`, `.glass` and `#glassCanvas` must have their fixed-layer
rules in `css/style.css`. Without them both canvases fall back to being
ordinary in-flow replaced elements sized by their `width`/`height`
*attributes* — which three.js sets to `innerWidth × innerHeight`, because
`renderer.setSize(w, h, false)` passes `updateStyle = false` deliberately and
expects the CSS size to come from the stylesheet. Two viewport-tall boxes then
stack in normal flow above `<main>`, so at scroll 0 you are looking at the
starfield and the glass sits a full screen below the fold. On a landscape
window the damage is easy to miss; on a portrait window the object is simply
not on screen at load. The camera math was correct the whole time.

The same block is why dragging works: `main` is `pointer-events: none` with
`.sec` turning it back on, so the hero (which also opts out) lets a drag fall
through to the canvas at `z-index: 1`. Remove the `none` on `main` and main's
own box swallows the drag before it reaches the glass.

**Camera framing** — `fitCamera()` in `js/scene.js` pulls the camera back until
the object's *bounding sphere* clears both axes at the current aspect ratio. A
fixed camera distance works on a wide screen and fails on a tall one: `fov` is
the **vertical** field of view, so as the viewport narrows the horizontal field
shrinks with the aspect. At 1080×1920 the object was covering 90% of the visible
width at rest, and rotating it swung the corners straight off screen. Fitting to
a sphere rather than the box is deliberate — the box's silhouette changes as you
drag it, a sphere's does not.

**The glass** — the material block in `js/scene.js`. Tune in this order,
because each one changes what the previous looks like:

`ior` → `thickness` → `scene.environmentIntensity` → `dispersion`

Use `neu-glass-proof.html` to find values with live sliders, then paste them in.

**The starfield** — the constants at the top of `js/stars.js`. `PIXEL` is the
star size and the grid they snap to; `DENSITY` is stars per square pixel;
`TARGET_FPS` is 16 on purpose. Raising it to 60 makes the twinkle look like a
modern fade and kills the effect — the low frame rate is the aesthetic, not a
performance compromise.

The palette is weighted by repetition: bone appears five times in the array and
blood once, so the sky is mostly ash with rare accents. The original component
this was ported from used a 16-bit rainbow (light red, green, cyan, purple);
against this page that read as confetti.

There are no shooting stars. The component this came from fires one every few
seconds; on a page you read slowly, something darting across the screen keeps
pulling your eye off the text.

The backdrop is a **flat fill that matches `--page` exactly**, not a gradient.
Any region the canvas does not cover falls back to the body colour, so a lit
gradient against a flat fallback shows up as a hard horizontal seam — most
visibly in full-page screenshots, where a `position: fixed` layer is only
painted once at the top. A single flat colour cannot seam against itself. If
you add a glow back, put it on `body` as well so both layers match.

**The canvas is FIXED and viewport-sized.** It therefore covers the page at
every scroll position — the sky runs from the first pixel to the last — and
because nothing moves it with the scroll, the stars hold still while the
content passes over them.

A document-height `position: absolute` layer was tried and reverted. On a body
that already carries `overflow-x: hidden`, making the body `position: relative`
and hanging a page-tall absolute canvas off it changes which element owns the
page's scrolling box. That is subtle, differs between engines, and broke
scrolling outright. **Do not make this layer absolute.** If you need the sky to
be taller than the viewport, put it in its own fixed wrapper rather than
attaching it to the document flow.

The two palettes are index-aligned on purpose: flipping the lights recolours
each star in place rather than rebuilding the field, so the constellation the
visitor was looking at survives the toggle.

**Parallax** — the `DEPTH` map in `js/main.js`. Values are a fraction of the
viewport. Negative moves against the scroll; that opposition is what reads as
depth, so keep some of each in every section.

**The Cosmolight switch** — `js/main.js`, the `lights()` block. It is a wall
switch, and it is broken on the first press: it twitches, makes a dry contact
click, and does not engage. Every press after that works and brings the cat and
the boom with it. To make the gag land only once, move `cat.show()` and
`audio.boom()` behind a flag instead of running them on every toggle.

A returning visitor whose preference was already saved skips the broken press
entirely — the switch has demonstrably worked for them before, so making them
fight it again is just annoying.

**The vine boom** — drop the real mp3 at `audio/vine-boom.mp3` and it is used
automatically; there is nothing to wire up. It is not bundled because it is
somebody else's recording and that is your call to make, not mine. See
`audio/README.txt`.

**The cat leaves like a totem of undying** — and the keyframes are ported from
the game's own item-activation animation rather than eyeballed, because
eyeballing it failed twice.

Minecraft runs a progress value `f` over 40 ticks (2s) through a quintic:

```
poly(f) = 10.25f⁵ − 24.95f⁴ + 25.5f³ − 13.8f² + 4f
```

That is not an ease. It rockets to ≈0.5 by `t=0.25`, sits on a **plateau**
through the entire middle, then rockets to 1.0 at the end. Push it through
`900 · |sin(poly · π)|` and the spin does something no standard easing curve
produces: two and a half turns almost immediately, a held beat facing away,
then two and a half turns back.

**That stall in the middle is the whole character of the animation.** It is
also why a linear or eased spin reads as "funky" — a constant-rate turn is the
one thing this motion never does. The curve was checked numerically before use:
`poly(0) = 0` and `poly(1) = 1` exactly, staying inside `[0,1]` throughout.
The keyframes are that function sampled at 27 points.

The sign is negative, so it turns backwards. `--tx`/`--ty` are the drift
target: the game stores a random per-trigger offset (`floatingItemWidth` /
`floatingItemHeight` on `GameRenderer` — offsets, not dimensions, despite the
names), so no two pops travel the same way. `js/main.js` sets them fresh each
time, biased upward, because an item drifting downward reads as dropped rather
than released.

`perspective: 900px` on the container is required. `rotateY` without it is just
a horizontal squash with no depth cue.

The exit had one more bug worth knowing about. The animation uses `forwards` to
hold its final frame, so the instant its class comes off the image snaps back to
its resting transform — and with only an opacity transition on the container,
that snap-back was visible for ~180ms as a small cat popping back into the
middle of the screen *after* the animation had finished. The container is
hidden with `visibility`, not opacity alone, so the revert never renders.

**The fallback sounds are synthesised** (`audio` in `js/main.js`). The vine
boom fallback is modelled on what the sample actually is — a struck body, not a
tone: a sine dropping 210Hz → 48Hz in 180ms for the punch, a triangle partial
above it for the metallic edge, a lowpassed noise transient as the strike, and a
41Hz tail decaying over two seconds so it lands in a room, all summed through a
`tanh` curve so it saturates instead of staying polite. The broken click is
two short bandpassed noise bursts with *no low end at all*, which is what makes
it read as a contact that clicks without engaging. Master gain is 0.35 on
purpose. Nothing is fetched, nothing is licensed, and it all works offline. If
`AudioContext` is missing everything still functions, silently.

**The cat** — `img/cat.gif`. The file you gave me is a single frame, so it
shows as a still; drop in an animated version at the same path and it will play
(the `?` cache-buster on the src is there to restart it from frame one).

## sans, and the sword

`js/sans.js` (the encounter) and `js/sword.js` (how the sword looks and
turns). The split matters: sans.js owns *position and meaning*, sword.js owns
*appearance and rotation*, and the only thing crossing between them is the
four-method `NEU.sword` interface. That boundary is why the sword could be
swapped from a three.js mesh to a sprite without sans.js changing at all.

The states, in order:

| | |
|---|---|
| `away` | nothing on screen. the default. |
| `here` | sans is in the corner and clickable. |
| `stuck` | the sword is planted at the top of the **document**. |
| `held` | you have it; it tracks the cursor while you scroll back down. |
| `swing` | released over sans. totem pops, he speaks, sword goes home. |

He is hidden until the contact section scrolls into view, and that is the
whole reason the errand works — while you are up at the top fetching the
sword he is genuinely *gone*, so coming back down to him is a return rather
than a scroll past someone who never left. A permanently-fixed corner sprite
would have made "scroll back down to sans" meaningless.

Releasing anywhere that is not sans also sends the sword home, and so does a
successful swing. Every hit therefore costs another round trip, which is what
makes the escalating lines land — by the fifth one he is commenting on the
fact that you keep walking it down there.

**Touch devices get a different contract.** You cannot hold a finger down and
scroll with the same finger, so press-and-hold is physically impossible on a
phone. On a coarse pointer it becomes tap-to-carry: tap to pick up, tap sans
to swing. Same states, different grammar.

**The sword is the only asset drawn here.** `img/sword.svg` is a 12×30 pixel
grid rendered as merged `<rect>` runs with `shape-rendering: crispEdges`, so
it stays hard at any size and costs 6 KB. It pivots at `50% 78%` — the grip,
not the centre — so a swing hinges from the hand rather than spinning about
its own middle.

It was briefly a real three.js mesh and that was the wrong call twice over: a
shaded 3D blade on a page built entirely from 16px bitmap type read as a
foreign object, and it meant standing up a second WebGL renderer for one 90px
prop.

**The totem pop uses `totemRise`, not `totemPop`.** `img/totem.webp` is the
real animated totem — 60 frames, already spinning on its own. Running the
cat's `totemPop` on top of that would be two rotations fighting each other,
which reads as a glitch. `totemRise` keeps the same `poly()` timing and the
same drift and drops the rotation entirely, and its duration is 1.83s to match
the webp exactly, so it plays through one clean revolution and stops.

The source webp was 1024px and 917 KB. It is resampled to 128px with
`NEAREST` — never a smooth filter, which turns voxel edges to porridge at that
size — for 52 KB, 18× smaller, all 60 frames intact.

**Swapping the sprites** — drop a replacement at the same path. `sans` is
`img/Sans_sprite.webp`, the totem is `img/totem.webp`. Both are referenced in
`index.html`; the totem's `src` is set in js with a cache-buster, which is
what restarts an animated webp from frame one. Without it the browser reuses
the decoded image and the second pop starts wherever the first left off.

**He hides whenever the contact section does**, at every state, including
while you are holding the sword. That gating used to be conditional on state
and it was wrong: the moment you picked the sword up the observer stopped
hiding him, so he stayed pinned in the corner for the entire trip up the page
and there was nothing to come back *to*. His dialogue closes with him — a
textbox belonging to someone who is no longer on screen is just litter.

The `hidden` attribute is applied 520ms late, on a timer, so the fade has
somewhere to happen. Set it immediately and `display: none` lands on the first
frame and the transition never renders.

**`[hidden] { display: none !important; }` near the top of the stylesheet is
load-bearing.** The browser's own rule lives in the UA stylesheet, so *any*
author rule that sets display outranks it — `.tbox { display: grid }` did
exactly that, and the dialog was permanently on screen no matter what the js
set. Keep that rule. It fixes the whole class of bug rather than the one case,
and `.pop` and `.sword` were one `display` declaration away from the same
fate.

**The pop has a sound and particles.** `audio/totem.mp3` is used if present,
otherwise `synthTotem()` in `js/sans.js` builds one: a major triad sweeping up
a fifth — the "blessing" shape, which is what makes it read as a save rather
than a hit — with a staggered sparkle an octave and a half above so the top
end shimmers. Nothing fetched, nothing licensed, works offline.

The particles are integer-aligned `fillRect`s, never circles. Half-pixel
coordinates make the browser antialias the edges, and on a page built out of
hard pixels that reads as blur rather than sparks. 26 of them, green and gold,
thrown outward with gravity and drag; the loop stops itself the frame the last
one dies, so nothing runs between bursts.

**His dialogue is Comic Sans**, which is the actual face and not a joke about
one. `--font-talk` tries the Undertale kit's "Undertale Sans" first, then
`Comic Sans MS` (present on Windows and macOS), then **Comic Neue** off Google
Fonts, which is loaded specifically so Linux visitors get a Comic-Sans-alike
rather than a generic cursive fallback. The textbox is also the one place on
the site that turns `-webkit-font-smoothing` back *on* — everything else
suppresses it to keep the bitmap type hard, but a smooth face wants smoothing,
exactly like the boot screen.

## The swing, and why it's built in phases

The first version was one 420ms rotation and it did not read as a swing at
all. Two reasons:

1. **No anticipation.** A strike is legible because of what happens *before*
   it. The eye needs to see the blade drawn back and slowed almost to a stop —
   that pause is what announces a blow, and it's what makes the strike itself
   feel fast. Go straight to the blow and there's nothing for it to be fast
   *relative to*.
2. **No follow-through.** Stopping dead at the end of an arc reads as a bug.
   Real motion overshoots, recoils, and settles.

So it's five phases over 1250ms, and the counterintuitive part is that
**almost all the added time went into the wind-up and the recovery — the
strike itself got faster.** That's the trick: slow the frame, speed the
action.

| phase | ms | rotation | |
|---|---|---|---|
| wind-up | 0–420 | −24° → +46° | decelerating into the pause |
| hold | 420–520 | +46° | the beat |
| strike | 520–660 | +46° → −152° | accelerating, trail on |
| overshoot | 660–700 | → −168° | |
| recover | 700–1250 | → −24° | slow, eased |

`swing()` takes **two** callbacks. `onImpact` fires at 660ms and `onDone` at
1250ms, because the interesting thing happens in the middle of this animation
rather than at the end of it — the totem, the shake and the sound all land on
the blow instead of half a second after it.

The trail is six lagged copies of the sprite read from a ring buffer, not a
drawn arc: a canvas streak needs its own buffer and a clear every frame, while
these are the same 6 KB SVG the browser already decoded, costing one transform
each. They're injected by `sword.js` rather than sitting in the markup,
because they're pure decoration and shouldn't be in the document for anyone
reading it with scripts off.

## The break, and the Broken hero key

When `swings >= LINES.length` — he has literally run out of things to say —
the next impact snaps the sword instead of popping a totem. The blade half
spins away and fades; the hilt drops, wobbles and stays. That contrast is what
makes it read as *kept* rather than lost.

**The hilt is the key**: pommel for the bow, grip for the shaft, guard and the
snapped stub for the bit. That's why the break is drawn just above the guard
rather than through it — a clean cut at the guard would leave a hilt, not a
key.

`img/sword-blade.svg` and `img/sword-key.svg` are sized to reconstruct the
whole sword exactly. The source is 12×30, the blade 12×16, the hilt 12×15, so
at 53.3% and 50% of a square box every piece lands at the same 40% width and
the seam lines up. The one row of overlap is the jag.

Both halves live in the markup rather than being injected at the break, so
there's no decode hitch at the one moment the timing has to be tight.

## The door

`js/scene.js`, added to `root` so it turns with the shell. A 2.15 box has a
half-extent of 1.075, so the door sits at **1.078** — inside that and it
z-fights with the glass, much further out and it visibly detaches when you
turn the cube edge-on. Being outside the shell also means the raycast reaches
it without punching through a transmissive material, so the hit test can check
that one group instead of the scene.

`doorFacesCamera()` gates the click on the door's world normal pointing back
at you. Without it you could open the door through the back of the cube, and
the whole point is that you have to turn the thing around to find it.

A non-drag click either opens the door **or** squashes the cube, never both —
otherwise every attempt at the lock would also boing the thing you're trying
to unlock. Without the key it clicks and refuses; the keyhole brightens once
you're carrying it.

The panel is `#panel` in `index.html`. It's placeholder text; that's the part
still owed.

## The spawn, and the four things wrong with the old one

Checked against the animation rules in the `ui-ux-pro-max` skill. The old
spawn broke four of them, and they compound:

| Rule | What it did | |
|---|---|---|
| `motion-meaning` | appeared at full size out of nothing | no cause |
| `spring-physics` | cubic tween between two points | a thrown object moves on a **parabola** |
| `easing` | one curve start to finish | no anticipation, so no release |
| `continuity` | left the top edge, no trace | **you lost the object** |

`continuity` was the real failure. The others made it feel cheap; that one
made it *confusing* — the sword went somewhere and you had no way to know
where.

**Then a second rebuild, because the first one solved the wrong problem.**
The parabola was correct and it still looked terrible, for a reason no amount
of easing could fix: **you click him at the bottom of a five-viewport page**,
so the flight was ~4000px. The sword crossed the screen in two frames.
Technically a beautiful arc; visually a blink.

The distance *was* the problem. So the animation no longer travels it. The
whole thing now plays out inside the viewport and the journey is implied by
the exit rather than animated:

| phase | ms | |
|---|---|---|
| materialise | 0–300 | scales in from 0.35 at **viewport centre**, ease-out |
| hold | 300–900 | sits still at 1.55× and is looked at |
| wind up | 900–1120 | dips 30px, decelerating |
| launch | 1120–1560 | accelerates straight up and off the top edge |

Then it's simply *placed* at the top of the document, off-screen, where nobody
sees the transition.

Entering is ease-out, leaving is ease-in. The exit uses `k²` for exactly that
reason — an exit that decelerates reads as the object changing its mind.

**The cue fires once.** It's a one-time orientation aid, not a permanent badge;
after the first trip you know where the sword lives. `cueDone` latches it.

## Throwing the key

The key isn't an inventory entry, it's an object with mass. It's tossed out of
his left hand when the sword breaks, falls under gravity (2400 px/s²), bounces
badly — 0.30 restitution, because it's a lump of metal, not a ball — and stays
wherever it stops. Drop it halfway up the page and it stays *there*.

**It falls to the bottom of the PAGE, not the bottom of the viewport.** `ky` is
a document coordinate and the floor is `docH() - 46`, so the key keeps falling
past the fold and comes to rest on the last pixel of the document. Only the
draw step converts to screen space (`ky - scrollY`), which is also why pointer
coordinates get `+ scrollY` on the way in and the door's screen position gets
`+ scrollY` before the hit test. Mixing those two spaces is the easiest way to
break this, so keep the rule: **physics in document space, drawing in screen
space, convert at exactly one boundary each way.**

Clicking the door no longer opens it. You have to carry the key to the hero
and **throw it, hard**: 950 px/s at the moment of contact. `NEU.doorScreenPos()`
in `scene.js` projects the door to page pixels and returns `null` when there's
nothing legitimate to hit — hero scrolled away, or the door facing into the
page — so the throw has to be aimed at a door you can actually see.

Release velocity is measured over the **last ~90ms of pointer travel**, not
from the final frame. Sampling one frame gives wildly noisy speeds and a fast
flick often registers as nearly stationary, because the pointer barely moves
on the last tick before release.

**The hit test is swept, and this was a real bug before it was fixed.** A hard
throw covers more ground in one frame than the door is wide — 6000 px/s at
60fps is 100px per step against a ~70px target — so testing only where the key
*ended up* let good throws tunnel clean through. `segDist()` tests the whole
segment crossed that frame. Without it the mechanic fails silently on exactly
the hardest throws, which are the ones you're most certain you got right.

## The totem sound

The real one, `item.totem.use` (subtitle *"Totem activates"*), is installed at
`audio/totem.ogg` — you supplied it, which was the one part I couldn't do: I
can read web pages but not fetch binary files.

It plays at **volume 0.40**. The source file is mastered loud because in-game
it's a "you nearly died" cue, not UI feedback, and at 1.0 on a web page it's a
jump-scare. The synth fallback was trimmed to match so switching between the
two isn't a step change in level.

Chrome and Firefox play ogg/vorbis natively; Safari doesn't. If you care about
Safari, convert it to `audio/totem.mp3` — `canPlayType` picks between them at
runtime, so both paths already work.

## Fonts and voice — the real ones

Carter Sande's kit is **self-hosted** in `fonts/webfonts/`, exactly as its
author asks. The remote hotlink that used to bridge the gap is gone; nothing
here depends on anyone else's bandwidth. The kit's own `stylesheet.css` is used
unmodified, so the `@font-face` rules live with the files and there's nothing
to keep in sync.

Determination Mono for body and interface, Determination Sans for display, and
Undertale Sans (Comic Sans) for his dialogue.

**His text blip is `snd_txtsans` from the game files**, at `audio/txtsans.wav`
and `txtsans2.wav`. Two variants ship together and the code alternates them —
that's what stops a long line sounding mechanical, and it's what the game
does too.

The pool is **four** `Audio` elements, not one. Characters land 42ms apart and a
single element can only play one instance at a time, so one element would cut
itself off on every character and you'd hear a stutter instead of a voice. The
old square-wave synth is still there as `synthBlip()` behind the sample.

**His lines** — the `GREET` and `LINES` arrays at the top of `js/sans.js`.
They're written for this page rather than quoted, so nothing there is lifted
dialogue. The list holds on its last entry, so a sufficiently determined
visitor gets "..." forever, which is the correct response.

**Colours** — the `:root` block in `css/style.css`. The light mode overrides
sit right below it in `body.is-lit-mode`.

Note the split between `--lilac` and `--accent`. `--lilac` is the decorative
hue; `--accent` is the one that gets used for anything a person has to read.
They are the same colour in dark mode, but on the light page `--lilac` sits at
2.06:1 against the background — invisible — so `--accent` swaps to a darker
violet at 6.56:1. Same story for `--rule` (decorative hairlines) versus
`--edge` (borders on real controls, held above 3:1 in both modes). If you
change the palette, keep those four in their lanes.

---

## Three things that will bite you if you extend this

**One transmissive mesh. Only one.** Every mesh with `transmission > 0` makes
Three.js re-render the whole scene to compute its refracted background. A
second piece of glass costs roughly a third of your frame rate.

**Transmission needs something behind it.** With an empty black background
there is nothing to refract and the glass reads as grey plastic. That is what
the backdrop plane and `scene.environment` are for — don't remove either.

**The starfield is the backdrop.** `scene.js` maps the same canvas `stars.js`
paints onto a plane sized to exactly fill the frustum, so the glass refracts
the real stars and the pixels visibly split and warp as you turn it. Outside
the object's silhouette the WebGL copy lines up 1:1 with the DOM canvas
underneath, which is what makes it read as one continuous sky with a lens in
front of it rather than two stacked layers.

Two settings hold that alignment together, and both look like nitpicks until
you remove one: the backdrop material is `toneMapped: false` (ACES tone
mapping would darken the WebGL copy and make the seam visible as the glass
fades out on scroll), and the texture uses `NearestFilter` on both min and mag
(linear filtering blurs pixel art into mush).

**`SVGLoader.createShapes()` is deprecated.** Every tutorial online still uses
it. Use `shapePath.toShapes(true)`. Also: SVG is Y-down and Three.js is Y-up,
so extruded text normally comes out mirrored — the glyph paths here are
authored in Y-up space to sidestep that. The usual fix, `scale(1, -1, 1)`,
inverts the winding order and turns every face inside out.

---

## Accessibility

- Every text and control colour meets WCAG AA in **both** themes — body and
  small text at 4.5:1 or better, control borders and focus rings at 3:1
- `prefers-reduced-motion` disables parallax, reveals, and the object's spring;
  the starfield paints once and holds still
- The `<h1>` carries "neu" as real text; the canvas is `aria-hidden`
- Skip link first in the tab order, visible focus rings, keyboard-reachable controls
- `<noscript>` hides the boot overlay and unhides the content, so the page
  degrades to a readable document with JS off
- No-WebGL fallback sets the mark in type and the page carries on
- Project titles are DOM text, not painted into a canvas — selectable,
  searchable, and readable by a screen reader

## Performance

- Pixel ratio capped at 2
- The scene stops rendering once the hero scrolls away, and when the tab is hidden
- One rAF loop does all the work. There is exactly one `scroll` listener and it
  only schedules a frame — no layout reads happen in the event itself
- The reveal backstop interval clears itself once nothing is left to reveal
- The starfield repaints one viewport-tall band, never the whole page

## The room, the dog, and the dev console

**`js/bullet.js`** — twenty seconds of danmaku behind the door. Full screen
rather than inside the panel, because a bullet pattern needs room to read as a
*pattern*; cramped into a 420px sidebar the same shots stop being dodgeable and
become luck.

Three conventions are borrowed on purpose and all three are load-bearing:

- **Shift focuses.** You move slower and your true hitbox is drawn. The hitbox
  is 3.2px against a 10px sprite, and you cannot dodge well without being shown
  that — this is the difference between "tight" and "unfair".
- **Invulnerability frames** (1.15s, with the soul flashing). Without them one
  bad frame costs all three HP in a row.
- **Bullets spawn outside the arena** and are culled well beyond it, so nothing
  ever pops into existence on top of you.

Four emitters — ring, aimed spread, spiral, gapped wall — each on its own
cadence and phase so they drift out of sync. Synchronised emitters carve
corridors you can stand in forever. Everything scales off one `ramp()` value
(0 at the start, 1 at 20s) so the difficulty curve stays tunable in one place.
Aimed shots exist specifically to stop you parking in a corner; rings alone are
beatable by standing still.

**The door stays unlocked, and the key bounces off it.** Both of those were
dead ends before: the key was consumed on impact and the door kept no memory
of being opened, so the moment you closed the panel the room was unreachable
forever. A lock you have already opened does not re-lock itself, and a lump of
metal you threw at a door should still be a lump of metal afterwards.

Because the door sits on a face of a cube at the top of the page that you have
to rotate to see — findable once, tedious every time after — an **"inside"
chip** appears in the bottom-left once it's open and stays there. That chip is
the actual answer to "there's no way back in"; the unlocked door is just the
consistent one. Neither is cleared by the Cosmolight reset.

One trap worth knowing about, since it cost a debugging round: the reflect
needs a cooldown or the key is still inside the door's radius next frame and
the panel reopens forever. But `performance.now() - (keyHit.at || 0) < 900`
defaults the timestamp to zero, which makes the cooldown *active for the first
900ms of page life*. By hand you'd never hit that window. Through the dev
console, where you can be holding the key a second after load, it failed every
single time. The guard is `keyHit.at && ...` — only cool down from a hit that
actually happened.

Survive and you get **"dog food?"**. Give it to sans and the dog turns up, and
*his dialogue is the only place the code is revealed*: typing **69420** during
a run clears it instantly. That ordering is the joke — the reward for doing it
the hard way is being told there was an easy way.

**Flipping the Cosmolight resets the dog and the food**, so the whole thing
replays without a reload. A `MutationObserver` on `body.is-lit-mode` does it,
and he says so out loud, which is the only reason it's discoverable.

### The dev console — `Ctrl + Shift + \``

Everything past the contact section is gated behind a nine-swing errand, and
re-walking it to test the room is a minute of scrolling per attempt.

| | |
|---|---|
| `sans` / `key` | skip the entire sword errand, hand over the key |
| `door` | open the room |
| `game` | start the bullet hell |
| `food` | grant "dog food?" |
| `dog` | summon him directly |
| `reset` | reload |

Backquote isn't on any browser or OS shortcut worth colliding with, and
requiring both modifiers means it can't be hit while reading. The handler keys
off `e.code === 'Backquote'` rather than `e.key`, because with Ctrl+Shift held
the reported `key` for that physical key varies by layout and browser.

The dev hooks set end state directly rather than fast-forwarding animations —
the point is to be standing in the room a second from now.

## Act two — the hammer, the dark, the clicker

The chain past the dog, in order. `js/quest.js` tracks all eleven steps and is
the single source of truth: owning progress in one place rather than
scattering booleans across four files means the panel can never disagree with
the game. Toggle it with the tab on the left or **`o`** — which is suppressed
while the bullet hell or the blackout owns the keyboard.

Later steps show as `???` rather than being hidden. Spoiling the whole chain
turns discovery into a checklist; hiding it entirely means nobody knows there
IS a chain. One step of look-ahead is the middle.

**Talk to the dog five times** and he coughs up a hammer. There is exactly one
thing on this page worth hitting with it, and the Cosmolight is the oldest
interaction on the site — taking it away is the only way the blackout means
anything.

`NEU.switchHook` is how one control ends up meaning four things. `main.js`
gives `sans.js` first refusal on every click; returning `true` means "handled,
skip the normal toggle". Carrying the hammer smashes it, carrying nothing
after that gets a refusal, carrying the clicker repairs it.

**The blackout** (`js/dark.js`) is a walkable field with a grey door in it.

- **The torch is stepped, not smooth.** A continuous radial falloff is the
  obvious way to do this and it looks wrong here — every other pixel on the
  site has a hard edge, so a soft vignette reads as a different program. Five
  discrete stops, visible rings.
- **The door glows faintly from beyond the torch.** Without it the space is a
  uniform black field and finding anything is a random walk, which isn't
  exploration, it's waiting. The glow gives a direction, not a map.
- **The debris is seeded, not per-frame random.** Scenery that reshuffles
  every frame is worse than no scenery, because it actively lies about where
  you are.

Four presses of **E** get four answers; the fifth takes you through to the
*Inter-Conexion on-and-off wax free clicker*. Fit it to the broken switch and
the light comes back.

`body.is-blackout` darkens via a **fixed pseudo-element, not a filter on
body** — a filter creates a containing block and dims every descendant,
including the chips and the objectives panel you still need to read.

### Minigame additions

Gaster blasters line up on an edge and fire straight across, which keeps the
beam an axis-aligned rectangle and the collision honest. They **telegraph**:
a flashing lane and a growing skull for 850ms before the beam. That isn't
politeness — an untelegraphed instant beam is unreadable and the death feels
arbitrary. The lane is offset from where you are *now* rather than aimed
exactly, so standing still is punished but the shot stays dodgeable during the
charge, which is the charge's whole job.

The soul is a real 7×7 heart. The hitbox is still 3.2px at its centre — the
sprite is decoration, and focus mode exists to show you the difference.

**Death holds before it breaks.** ~420ms of cracked soul with a split down the
middle, then it shatters. Break it on the frame of the hit and it reads as a
rendering glitch; hold it and it reads as a death. The fragments are the
heart's own cells, thrown outward from where each one sat, so the pieces
visibly belong to the thing that broke.

### Dev console additions

`dark` opens the blackout, `warp` stands you at the grey door — an eight-second
walk from spawn, which is the right length once and the wrong length forty
times.

One trap the tests caught: `devSkip` sets end state directly instead of
replaying `gainKey`, so it has to report the steps `gainKey` would have
reported. Otherwise the tracker permanently disagrees with the game for anyone
who used the console.

---

Built with [three.js](https://threejs.org) r185.
