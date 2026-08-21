The Undertale fonts go here.
============================

One folder to add, then you are done.

  1. Download the webfonts kit:
        https://gitlab.com/cartr/undertale-fonts
     (the "Download" button, or clone it)

  2. Copy the whole  webfonts  folder into THIS folder, so you end up
     with:

        site/fonts/webfonts/stylesheet.css
        site/fonts/webfonts/  ...the .woff / .woff2 files...

That is the whole job. index.html already links
fonts/webfonts/stylesheet.css, and the kit declares its own @font-face
rules, so there is nothing here to keep in sync by hand.


Which fonts these are
---------------------

Undertale's narration, overworld dialogue and interface are set in
8-Bit Operator JVE, by Jayvee Enaguas.

  Determination Mono   The faithful recreation of how that text
                       actually renders in game, rebuilt by Haley
                       Wakamatsu from the game's own spritesheet.
                       This page uses it for body text and interface.

  Determination Sans   The proportional variant of the same face.
                       This page uses it for display: the boot mark,
                       section headings, the contact links.

The kit also ships two character fonts that this page does NOT use:

  Undertale Sans       Sans's dialogue (the Comic Sans one)
  Undertale Papyrus    Papyrus's dialogue (NYEH HEH HEH)

They are there if you ever want them - say the word and I can put the
bio note in Sans as an easter egg.


Until you add them
------------------

The page falls back to Pixelify Sans off Google Fonts, which is also a
pixel face. Nothing looks broken, it just is not the real thing. The
missing stylesheet 404s harmlessly.


Why every size is a multiple of 16
----------------------------------

Straight from the font author: "the fonts look best when your font
size is a multiple of 16 pixels."

These faces are drawn on a 16px grid. At 15px or 17.4px the browser
resamples the bitmap and the letterforms turn to mush - which is how
most sites manage to make a pixel font look cheap. So every font-size
in style.css is 16, 32, 48 or 96, there is not one clamp() on type
anywhere, and display sizes step up through a media query instead so
they can never land on a fractional pixel.

-webkit-font-smoothing: none is set for the same reason: antialiasing
a bitmap face defeats the point of using one.


Credits
-------

Undertale and its typography: Toby Fox.
8-Bit Operator JVE: Jayvee Enaguas.
Determination Mono / Sans: Haley Wakamatsu.
Webfonts kit: Carter Sande - https://gitlab.com/cartr/undertale-fonts
