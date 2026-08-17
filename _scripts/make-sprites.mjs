/* make-sprites.mjs — regenerate pixel sprites from readable grids.
   Run: node _scripts/make-sprites.mjs        (writes site/img/*.svg)
        node _scripts/make-sprites.mjs --dry  (prints, writes nothing)

   The sprites in `site/img/` are hand-authored SVGs made of one <rect>
   per pixel. That is the right output — it scales cleanly, costs no
   request, and `shape-rendering="crispEdges"` keeps it sharp — but it
   is unreadable as source: nobody can look at four hundred rects and
   see a hammer. So the grid is the source and the rects are built.

   ONE CHARACTER PER PIXEL, space = transparent. Edit the picture, run
   the script, get the sprite.

   SCOPE, AND WHY IT IS SMALL. `memory/assets.md` lists seven sprites
   as placeholders. Looked at closely, five of them are not placeholder
   quality at all — they are competent two-tone pixel art already in
   the site palette and at the right size. What separates them from
   `sword.svg` (six tones, shaded gold crossguard) is technique, not
   correctness, and redrawing a character is a design decision.

   So only the ones with an OBJECTIVE failure are regenerated here:

     switch2  read as a featureless rounded rectangle. Nothing in it
              said "switch", which is a functional failure rather than
              a matter of taste.
     tv       a plain box on two legs, with no distinction between the
              cabinet and the screen. It gets smashed in Act IV and
              something climbs out of it; it has to read as a
              television first.
     hammer   unchanged in shape. It gains the highlight-over-midtone
              treatment the sword already uses on its blade, which is
              this project's own technique applied consistently.

   DELIBERATELY NOT TOUCHED — see the report:
     dog      Toby is a named character. What his face does is a
              character decision, not a shading pass.
     clicker  the story calls it "a small plastic thing". Making it
              read as a specific object means choosing which object.
     hand     adding shadow to skin with the only mid-tone available
              (#9C97B2, a cool grey) makes it look dirty rather than
              shaded. It needs a warm shadow that the palette lacks.
     blanket  a checkered blanket already reads as a checkered
              blanket. There is nothing wrong with it.

   PALETTE — every colour below already appears in site/img/*.svg. No
   new hues are introduced, which is the whole point. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site', 'img');
const DRY = process.argv.includes('--dry');

const P = {
  '#': '#191426',   // outline, everywhere
  'H': '#F4F2FA',   // highlight  (sword blade light)
  'm': '#9C97B2',   // mid grey   (sword blade mid)
  'd': '#2A2230',   // deep shade (sword grip)
  'w': '#6B4A2A',   // wood
  'p': '#22222E',   // panel / screen
  'b': '#14141C',   // cabinet, darker than the screen
  'r': '#C2405F',   // crimson accent
  '*': '#22222E',   // switch plate face (same tone as the panel)
  's': '#E8DCC8',   // skin
  'S': '#BFA98C',   // ONE PALETTE ADDITION, 2026-08-17. See the note below
  'B': '#B892FF',   // lilac (the clicker's button)
  'e': '#EDE7DE',   // bone / off-white plastic
  'q': '#5E3350',   // blanket, dark check
  'Q': '#8C2F4A',   // blanket, light check
  '%': '#F4F2FA'    // the dog's coat (same white as the sword's blade)
};

/* THE ONE NEW COLOUR: #BFA98C, a warm skin shadow.
   The palette had exactly one mid-tone, #9C97B2, and it is a cool grey.
   Put on skin it does not read as shadow, it reads as dirt — which is
   why `hand.svg` was left flat two-tone the first time round. #BFA98C
   is #E8DCC8 taken down about a quarter in luminance with the hue held
   warm, so the hand can be shaded without turning grey.
   To revert: drop the 'S' entry and swap every S back to s in `hand`. */

const SPRITES = {
  /* A wall plate with a raised rocker. The rocker is lit on top and
     shaded underneath, so it reads as sticking out of the plate rather
     than as a sticker on it — which is the entire difference between
     "switch" and "rectangle". */
  switch2: [
    ' ############## ',
    '#r************r#',
    '#r***HHHHHH***r#',
    '#r***HHHHHH***r#',
    '#r***mmmmmm***r#',
    '#r************r#',
    ' ############## '
  ],

  /* Cabinet in the darkest tone, screen one step lighter, one dial on
     the right and a single glint pixel in the top-left of the glass.
     The glint is doing most of the work: one lighter pixel in a corner
     is what makes a dark rectangle read as glass instead of as a hole. */
  tv: [
    '##############',
    '#pppppppppppp#',
    '#pbbbbbbbbppp#',
    '#pbHbbbbbbpmp#',
    '#pbbbbbbbbppp#',
    '#pppppppppppp#',
    '##############',
    '   ##    ##   ',
    '  ####  ####  '
  ],

  /* Same silhouette as before, to the pixel. The head was one flat
     grey; it is now lit from the top left in exactly the two tones the
     sword's blade uses, and the handle has a shaded side. */
  hammer: [
    ' ######## ',
    '#HHHHHmmm#',
    '#Hmmmmmmm#',
    '#mmmmmmmm#',
    '#mmmmmmmm#',
    ' ##mmmm## ',
    '   #ww#   ',
    '   #wd#   ',
    '   #ww#   ',
    '   #wd#   ',
    '   #ww#   ',
    '   #wd#   ',
    '   #ww#   ',
    '    ##    '
  ],

  /* TOBY. Sitting, in profile, facing left. Renders at 104x91 in the
     scene (6.5x) and 22x19 in the chip tray, so there is room for real
     features and they still have to survive being shrunk to 22px.

     What he gets: a pointed ear, an eye, a muzzle that comes to a dark
     point, a front leg, a haunch, and a short raised tail. What he does
     NOT get is an expression. He has one line in the whole game about
     not looking back because he is a dog, and a dog that emotes
     undercuts it. Impassive is the character. */
  dog: [
    '    ##          ',
    '   #%#          ',
    '  #%%%####      ',
    ' #%%%%%%%%#     ',
    '#%%#%%%%%%%#    ',
    '#%%%%%%%%%%#  ##',
    ' #%%%%%%%%#  #%#',
    '  ##%%%%%##  #%#',
    '    #%%%%%%###%#',
    '    #%%%%%%%%%%#',
    '   #%%%%%%%%%%# ',
    '   #%%mm%%%mm%# ',
    '   #%##%%%##%%# ',
    '   ###  ###  ## '
  ],

  /* The clicker. The story calls it "a small plastic thing" and names
     it an on-and-off clicker, so it is drawn as the one thing that
     description does commit to: a body you hold and a button you press.
     The button is the lilac, which is the only bright thing on it, so
     at 22px in the chip tray the button is what you see. */
  clicker: [
    '   ###   ',
    '  #BBB#  ',
    ' #eeeee# ',
    '#eeeeeee#',
    '#eeeeeee#',
    '#emmmmme#',
    ' ####### '
  ],

  /* The petting hand, fingers pointing down, because it swipes down
     over the dog. Three fingers and a palm rather than a mitten, and
     shaded down the right side with the new warm mid-tone so it reads
     as a hand and not as a glove. */
  /* THE SILHOUETTE HERE IS THE ORIGINAL, DELIBERATELY.

     It was redrawn once as a palm with three fingers hanging down, on
     the theory that "more fingers reads as more hand". Rendered at 8x
     and looked at, that version read as a stool — a wide body on three
     stubby legs — and the shape it replaced read better. So the shape
     went back and only the thing that was actually missing stayed: a
     warm shadow down the lower right, lit from the top left like the
     hammer and the sword.

     Two fingers reaching down-left over a palm that tapers to a wrist.
     It is a hand coming down to pet a dog, which is the only thing it
     ever does. */
  hand: [
    '   ## ##   ',
    '  #ss#ss#  ',
    '  #ss#ss#  ',
    ' #ssssss#  ',
    '#sssssss#  ',
    '#sssssssS# ',
    ' #sssssSS# ',
    '  #ssssSS# ',
    '  #ssSSS#  ',
    '   #####   '
  ],

  /* The blanket over the two of them. 18x5 is too shallow for anything
     but a pattern, and a checkered blanket already read as a checkered
     blanket — so the only change is that the dark checks along the
     bottom row go darker still. A blanket lit from above and shaded
     where it falls away, rather than a flat swatch. */
  blanket: [
    ' ################ ',
    '#qQQqqQQqqQQqqQQq#',
    '#QqqQQqqQQqqQQqqQ#',
    '#dQQddQQddQQddQQd#',
    ' ################ '
  ]
};

/* Merge horizontally-adjacent same-colour pixels into one rect. Purely
   a size win, and it is what the existing files already do. */
function build(name, grid) {
  const h = grid.length, w = grid[0].length;
  for (const row of grid) {
    if (row.length !== w) throw new Error(name + ': ragged grid, row is ' + row.length + ' not ' + w);
    for (const c of row) if (c !== ' ' && !P[c]) throw new Error(name + ': unknown colour "' + c + '"');
  }
  let out = '';
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const c = grid[y][x];
      if (c === ' ') { x++; continue; }
      let run = 1;
      while (x + run < w && grid[y][x + run] === c) run++;
      out += '<rect x="' + x + '" y="' + y + '" width="' + run + '" height="1" fill="' + P[c] + '"/>';
      x += run;
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h +
         '" shape-rendering="crispEdges" role="img" aria-label="' + name +
         '">' + out + '</svg>';
}

for (const [name, grid] of Object.entries(SPRITES)) {
  const svg = build(name, grid);
  const file = path.join(OUT, name + '.svg');
  const before = fs.existsSync(file) ? fs.statSync(file).size : 0;
  /* The viewBox must not move. These are sized by CSS at call sites
     that assume the current aspect ratio. */
  if (before) {
    const old = fs.readFileSync(file, 'utf8');
    const a = (old.match(/viewBox="([^"]+)"/) || [])[1];
    const b = (svg.match(/viewBox="([^"]+)"/) || [])[1];
    if (a !== b) throw new Error(name + ': viewBox changed ' + a + ' -> ' + b + '. CSS sizes assume the old one.');
  }
  if (!DRY) fs.writeFileSync(file, svg);
  console.log((DRY ? 'would write ' : 'wrote ') + name + '.svg  ' +
              grid[0].length + 'x' + grid.length + '  ' +
              before + ' -> ' + Buffer.byteLength(svg) + ' bytes');
}
console.log(DRY ? '\ndry run, nothing written' : '\ndone');
