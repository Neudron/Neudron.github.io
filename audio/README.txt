The vine boom goes here.
========================

  audio/vine-boom.mp3

Drop the file in with exactly that name and the site will use it. There
is nothing to wire up - main.js looks for it on load and falls back to
a synthesised boom if it is missing.

Why it is not already here
--------------------------

The vine boom is somebody else's recording. I am not going to bundle a
copy of it into your repo without you choosing to, so the site ships
with a synthesised stand-in instead and uses the real thing the moment
you provide it.

If you do add it, be aware it is not public domain. Fine for a personal
page; think twice before putting it on anything commercial.

The synthesised fallback
------------------------

Modelled on what the sample actually is - a struck body, not a tone:

  - a sine dropping 210Hz -> 48Hz in 180ms, carrying the punch
  - a triangle partial above it for the metallic edge
  - a lowpassed noise transient: the strike itself
  - a 41Hz tail decaying over ~2s, so it lands in a room

all summed through a tanh curve so it saturates instead of staying
polite. Master gain is 0.35 and the sample plays at 0.55, both
deliberately short of loud.


totem.ogg  (the totem of undying)
---------------------------------
The real sound is item.totem.use, closed caption "Totem activates",
volume 1.0, pitch 1.0. The wiki serves it here:

  https://minecraft.wiki/images/Totem_of_Undying.ogg

Download it and save it as:

  site/audio/totem.ogg

That is all. It is picked up automatically, nothing to wire up.

It is not bundled for two reasons. It is Mojang's recording, which
makes shipping it your call and not mine; and the assistant that built
this can read web pages but cannot fetch binary files, so it could
confirm what the sound is from the wiki but not go and get it.

Chrome and Firefox play ogg/vorbis natively. Safari does not — if you
care about Safari, convert it and drop it at audio/totem.mp3 instead.
js/sans.js picks between the two at runtime with canPlayType(), so
whichever one is present gets used.

Until either file exists, synthTotem() in js/sans.js stands in: a major
triad sweeping up a fifth with a staggered sparkle above it. The rising
triad is deliberate — it is what makes the sound read as a save rather
than a hit.
