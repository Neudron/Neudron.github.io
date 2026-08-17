# Act IV — asset shopping list

**Why you and not me:** `web_fetch` reads pages, it does not save binaries —
confirmed by fetching `Ashes_of_Annihilation.png` and getting the URL back as
plain text. Routing around it with PowerShell or curl is off-limits to me.
So: you fetch, I wire.

Drop everything into **`img/act4/`** and **`audio/act4/`**, keeping the
filenames in the last column. Nothing is blocked on this — I build against
placeholders sized to match — but the real files make it look right.

---

## Images

### Supreme Witch, Calamitas — calamitymod.wiki.gg

| Page / file | Save as |
|---|---|
| `Supreme_Witch,_Calamitas_(Phase_1).png` | `swc-p1.png` |
| `Supreme_Witch,_Calamitas_Hooded_(Phase_1).png` | `swc-p1-hood.png` |
| `Supreme_Witch,_Calamitas_(Phase_2).png` | `swc-p2.png` |
| `Supreme_Witch,_Calamitas_Hooded_(Phase_2).png` | `swc-p2-hood.png` |
| `Brimstone_Dart.gif` | `brim-dart.gif` |
| `Brimstone_Fireblast.gif` | `brim-fireblast.gif` |
| `Brimstone_Gigablast.gif` | `brim-giga.gif` |
| `Brimstone_Hellblast2.gif` | `brim-hellblast.gif` |
| `Cataclysm_Fist.gif` + `Cataclysm_Fist_Alt.gif` | `cataclysm-fist.gif`, `cataclysm-fist2.gif` |
| `Catastrophe_Top_Slash.gif` + `Catastrophe_Bottom_Slash.gif` | `catastrophe-top.gif`, `catastrophe-bot.gif` |
| `Ashes_of_Annihilation.png` | `ashes.png` |
| Sepulcher + Brimstone Heart sprites | `sepulcher.png`, `brim-heart.png` |

### Polterghast — calamitymod.wiki.gg

| Page / file | Save as |
|---|---|
| Polterghast body, all 3 phases | `polter-p1.png`, `polter-p2.png`, `polter-p3.png` |
| Hook / chain sprites | `polter-hook.png`, `polter-chain.png` |
| `Phantom_Shot.png`, `Phantom_Blast.png` | `phantom-shot.png`, `phantom-blast.png` |
| `Potent_Phantom_Shot.png`, `Potent_Phantom_Blast.png` | `potent-shot.png`, `potent-blast.png` |
| `Phantom_Orb.png` | `phantom-orb.png` |

### Terraria — terraria.wiki.gg

| Page / file | Save as |
|---|---|
| `Recall_Potion.png` | `recall-potion.png` |
| Any axe item sprite you like | `axe.png` |
| Mushroom item sprite | `mushroom.png` |
| Crafting-grid slot frame (or I'll draw it) | `slot.png` |

### Deltarune — deltarune.wiki

| Page / file | Save as |
|---|---|
| Tenna, idle + at least one gesture | `tenna-idle.png`, `tenna-point.png` |
| Card Kingdom dark-tree / forest tiles, any usable strip | `trees-*.png` |

### Undertale — undertale.wiki

| Page / file | Save as |
|---|---|
| The fire door from Papyrus and Sans's house | `firedoor.png` |
| Toriel's armchair | `armchair.png` |
| A New Home corridor tile / wall strip | `newhome-*.png` |

---

## Audio

All from the Calamitas page's Sounds section (`.ogg`, direct links on
the page):

| Sound | Save as |
|---|---|
| Brimstone Hellblast Cast | `hellblast.ogg` |
| Brimstone Fireblast Cast | `fireblast.ogg` |
| Brimstone Fireblast Impact | `fireblast-hit.ogg` |
| Brimstone Gigablast Cast | `giga.ogg` |
| Brimstone Gigablast Impact | `giga-hit.ogg` |
| Whispering Maelstrom Spawn | `maelstrom.ogg` |

Everything else — the merchant, the vending machine, the crafting click, the
portal, the rap battle — I synthesise in Web Audio, same as the existing
whoosh/snap/locked/tick.

---

## Prompt for Claude in Chrome

Paste this into a Chrome session with the extension connected:

> Download image and audio assets from three game wikis into my Downloads
> folder, into a subfolder called `neu-act4`.
>
> **From https://calamitymod.wiki.gg/wiki/Supreme_Witch,_Calamitas** — open
> each image on the page at full resolution (click through to the File: page
> and take the original, not the thumbnail) and save: both Phase 1 sprites
> (hooded and unhooded), both Phase 2 sprites, Brimstone Dart, Brimstone
> Fireblast, Brimstone Gigablast, Brimstone Hellblast2, both Cataclysm Fist
> sprites, both Catastrophe Slash sprites, Ashes of Annihilation, Sepulcher,
> Brimstone Heart. Then from the Sounds section of the same page, save the
> six .ogg files: Brimstone Hellblast Cast, Brimstone Fireblast Cast,
> Brimstone Fireblast Impact, Brimstone Gigablast Cast, Brimstone Gigablast
> Impact, Whispering Maelstrom Spawn.
>
> **From https://calamitymod.wiki.gg/wiki/Polterghast** — save the
> Polterghast sprites for all three phases, the hook and chain sprites, and
> the projectile sprites: Phantom Shot, Phantom Blast, Potent Phantom Shot,
> Potent Phantom Blast, Phantom Orb.
>
> **From https://terraria.wiki.gg/wiki/Recall_Potion** — save the Recall
> Potion item sprite.
>
> **From https://deltarune.wiki/w/Tenna** — save the Tenna sprites.
>
> Keep the original filenames. Tell me which ones you couldn't find rather
> than substituting something similar.

Then move the folder's contents into `Documents\neu\site\img\act4\` and
`audio\act4\` and tell me — I'll rename them to the table above and wire
them up.
