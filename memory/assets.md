# Assets

**Use what is here. Do not generate replacements.** New art only when asked,
and then in pixel art matching the existing set.

## Sprites — `img/`

| File | What | Origin |
|---|---|---|
| `Sans_sprite.webp` | him | Undertale, user-supplied |
| `totem.webp` | the totem, 60 frames / 1830ms, self-spinning | Minecraft, user-supplied |
| `cat.gif` | pops out of the totem | user-supplied |
| `sword.svg` | 12×30 pixel-art sword | made here, on request |
| `sword-blade.svg` `sword-key.svg` | the two halves after the break | made here |
| `annoying-dog.gif` | the Annoying Dog (Toby) | Undertale, undertale.wiki.gg — **replaced `dog.svg` 2026-08-20**. Real 2-frame sprite, 44x38, from `spr_tobdogl`. The CSS `dogIdle` animation stays — the GIF self-animates but the `scaleY` bounce adds life on top |
| `hammer.svg` `clicker.svg` `hand.svg` `blanket.svg` `switch2.svg` `tv.svg` | original props | redrawn 2026-08-17 from `_scripts/make-sprites.mjs`. These six are NOT from any game — they are original items in the story (the console dock, the cosmolight, the petting hand, the blanket) |

**On the seven "placeholders".** All done as of 2026-08-17, and every one
was checked by rendering it at 8x onto a checkerboard and *looking at it*
(`node /tmp/svgsheet.mjs`-style raster; the reusable version for sheets is
`_scripts/contact-sheet.mjs`). Reading the grid in a text editor is not the
same as seeing the sprite, and twice here it disagreed.

What each one got:

- **`switch2`** — read as a featureless rounded rectangle; nothing in it said
  "switch". Now a raised rocker, lit on top and shaded underneath, so it
  reads as sticking out of the plate rather than printed on it.
- **`tv`** — was a plain box on two legs. First redraw made the cabinet
  darker than the screen, which is backwards; corrected to a lighter bezel
  around a dark screen, with a dial and one glint pixel. One lighter pixel in
  a corner is what makes a dark rectangle read as glass instead of a hole.
- **`hammer`** — exact same silhouette, plus the highlight-over-midtone
  treatment the sword's blade already uses.
- **`dog`** — redrawn as Toby in profile: pointed ear, eye, dark muzzle, a
  front leg, a haunch, a raised tail. He renders at 104×91 (6.5x) in the
  scene and 22×19 in the chip tray, so the features have to survive both.
  **He deliberately has no expression** — his one line is about not looking
  back because he is a dog, and a dog that emotes undercuts it.
- **`clicker`** — the story only commits to "a small plastic thing" that
  clicks on and off, so it is drawn as the two things that description does
  commit to: a body you hold and a button you press. The button is the lilac,
  the only bright thing on it, so at 22px the button is what you see.
- **`hand`** — **kept its original silhouette on purpose.** It was redrawn as
  a palm with three fingers hanging down and that version read as a *stool*.
  The old shape was better; only the missing shading stayed.
- **`blanket`** — 18×5 is too shallow for anything but a pattern, and a
  checkered blanket already read as one. The only change: the dark checks
  along the bottom row go darker still, so it reads as lit from above and
  falling away rather than as a flat swatch.

**One colour was added to the palette: `#BFA98C`, a warm skin shadow.** The
palette had exactly one mid-tone, `#9C97B2`, and it is a cool grey — on skin
it reads as dirt, not shade, which is why the hand had been left flat. This
is `#E8DCC8` taken down about a quarter in luminance with the hue held warm.
It is used by `hand.svg` and nothing else. To revert: drop the `'S'` entry
from the palette in `make-sprites.mjs` and swap every `S` back to `s` in the
`hand` grid.

Editing any of the seven is now a grid in `_scripts/make-sprites.mjs` rather
than four hundred hand-written `<rect>` elements. The script refuses to
change a `viewBox`, because call sites size these in CSS assuming the current
aspect ratio.

The totem webp already spins itself, so the pop uses `totemRise` (drift, no
rotation) rather than the cat's `totemPop`. Two spins fighting each other
looked like a glitch.

Restarting an animated webp from frame one requires re-setting `src` with a
cache-buster. Without it the browser reuses the decoded image and the second
pop starts wherever the first left off.

## Audio — `audio/`

| File | What | Notes |
|---|---|---|
| `totem.ogg` | `item.totem.use` | Mojang's recording, user-downloaded. Played at **40%** — it is mastered loud because it is a "you nearly died" cue, not a UI blip. Only ever fires from `popTotem()`. |
| `txtsans.wav` | `snd_txtsans` | His text blip. Pool of **four copies of this one file**. |
| `txtsans2.wav` | `snd_txtsans2` | **Unused, deliberately.** Alternating the two read as a flam on every character, not as variation. |

Everything else is synthesised in Web Audio: the totem fallback (major triad
sweeping a fifth, staggered sparkle an octave and a half up), whoosh, snap,
locked (bandpass noise ×2), tick, and the three non-Sans dialogue voices.

## Fonts — `fonts/webfonts/`

Carter Sande's Undertale webfont kit, **self-hosted** (31 files) exactly as
its author asks. The kit's own `stylesheet.css` is linked unmodified, so the
`@font-face` rules live with the files and there is nothing to keep in sync.

Faces used: Determination Mono, Determination Sans, Undertale Sans, Undertale
Papyrus. Pixelify Sans (Google) is the fallback until the kit is installed —
also a pixel face, so nothing looks broken if the files are missing.

Cormorant Garamond italic + VT323 (Google) are for the boot screen only.

## Act IV — `img/act4/`

**Calamity sprites are verified against upstream, not assumed.** Every file
in `img/act4/calamity/` was re-checked 2026-08-22 against verbatim downloads
of `github.com/CalamityTeam/CalamityModPublic` @ `1.4.4`:

- **37 of 40 pixel-faithful** — 36 byte-exact against their upstream texture,
  `BrimstoneHeart.png` identical after transparent-border trim. Verifier:
  `_scripts/verify-sprites.mjs` (own PNG decoder, trim-normalised sub-region
  match). Re-fetch sources with `_scripts/fetch-sprite-sources.ps1`; the
  downloads land in gitignored `_sources/calamity/`.
- **The three TP files are not upstream.** `tp-bar.png` is a recolor of
  upstream `RageBar.png` (identical alpha mask). `tp-bar-border.png`
  (10 frames of 104×48) and `tp-full-anim.png` (10 frames of 172×70) are
  Polterghast-styled originals from the wiki — no GitHub counterpart.
- Tenna (`deltarune/`), the six zone tiles (`tiles/`, scored out of Deltarune
  atlases), the Terraria items (`terraria/`) and the Undertale props
  (`undertale/`) come from game wikis or were drawn here; see
  `assets-wanted.md` for the shopping list they came from.

## Licensing note

Undertale and Minecraft assets are Toby Fox's and Mojang's respectively. This
is a personal fan page; the assets are not redistributed as a library and the
audio README records where each came from.
