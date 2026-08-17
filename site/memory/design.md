# Design style

## The tone rule

**Black goth-cute, 6/10 toward cute.** The split is the whole system:

- **Goth lives in the colour and the material.** Near-black page, bone text,
  one lilac accent, refractive glass, hard pixel edges.
- **Cute lives in the motion and the silhouette.** Easing that overshoots,
  things that bob, a cat that pops out of a totem, a dog that fidgets.

**Nothing decorative is allowed to carry the cute.** No bows, no hearts as
ornament, no charms, no sparkle-for-its-own-sake. If something reads as cute it
must be because of how it *moves* or what *shape* it is, not because a cute
object was placed on it. Rounded corners, generous air, and bouncy easing do
all of that work.

## Colour

```
--void  #08080B   page
--ink   #14141C   raised surfaces
--crypt #22222E   decorative hairlines
--bone  #EDE7DE   text
--ghost #8A8598   dim text
--lilac #B892FF   accent
--blood #8C2F4A   danger
--edge  #5C5C70   interactive control borders (3.07:1 on void)
```

Semantic tokens (`--page --text --dim --rule --edge --accent`) are what rules
actually reference. `body.is-lit-mode` swaps them for the light theme.

**The accent must change between themes.** `--lilac` is 2.06:1 on the light
page — unreadable. Light mode uses `#5E33BE` (6.56:1). The hue survives, the
lightness does not. Never reference `--lilac` directly for text.

Accessibility floor is **WCAG AA in both themes**. Every text/background pair
was measured, not eyeballed.

### Extra palettes

The bullet room and the console home screen have their own colour sets on
purpose — they are separate devices, not the page.

- Room: `bone #EDE7DE`, `lilac #B892FF`, `blood #C2405F`, `soul #E23B55`,
  electric `#4FC3F7`.
- Deck: consumer-electronics blue on `#0B0E14`. This is the **one** place the
  goth restraint is deliberately dropped — the gag only lands if the interface
  looks like a real product.

## Type

The real Undertale faces, **self-hosted** in `fonts/webfonts/` (Carter Sande's
kit, used unmodified, as its author asks). Google Fonts supplies pixel
fallbacks only.

```
--font          Determination Mono      body + interface
--font-display  Determination Sans      display
--font-talk     Undertale Sans          the dialogue box (comic sans lineage)
--font-quest    Undertale Papyrus       the objectives panel only
```

Papyrus is scoped to the objectives panel and nowhere else: a task list is not
the site's voice, it is an overlay on top of it, and its own face stops it
reading as page content.

**Sizes are multiples of 16.** See rule 4 in CLAUDE.md. This is the font
author's own guidance, not a preference.

`-webkit-font-smoothing: none` globally to keep pixels hard. The two
exceptions both smooth deliberately: the boot screen (Cormorant Garamond
italic, a serif that wants smoothing) and the dialogue box.

## Motion

- `--bounce: cubic-bezier(.34, 1.36, .64, 1)` — the overshoot that carries the
  cute half of the tone.
- **Ease-out entering, ease-in leaving.** Things arrive fast and settle; they
  leave by accelerating away.
- **Anticipation and follow-through on anything with weight.** The sword swing
  winds back before it swings and overshoots before it settles.
- **Walk cycles advance on distance travelled, not on a timer.** A time-driven
  cycle keeps stepping when you stop and slides when you change speed.
- Every animation respects `prefers-reduced-motion`.

## Pixel rendering

- `image-rendering: pixelated` on every sprite.
- Canvas: `ctx.imageSmoothingEnabled = false`, integer `fillRect` only.
- No anti-aliased circles anywhere — a smooth circle looks like it came from a
  different website. Gradients are stepped, not continuous (see the torch in
  `dark.js`: five discrete rings, not a soft vignette).
