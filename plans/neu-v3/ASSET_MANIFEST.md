# Asset production and provenance work queue

`assets/manifest.v3.json` contains initial folder-level candidates, not an assertion of permission. Inspect `img/act4/sheets.json` or source sprite files to fill dimensions, frames, pivots and style. Track each *specific* file in the final manifest.

Priority: current original/cleared art -> existing project art cleanup -> explicitly licensed source -> harmonized derivative with permission -> custom GPT-Image -> hand-drawn. An external image can be used as a composition reference but not automatically shipped.

**Known review queues** (seen in repository tree): `img/act4/calamity/`, `img/act4/terraria/`, `img/act4/deltarune/`, `img/act4/undertale/`, `img/act4/tiles/`, `img/act4/vfx/`, `audio/act4/`. Distinguish code-rendered game art from image-backed sheets.

**Candidate external sources for rights evaluation**, not blanket approval:
- https://kenney.nl/assets/pixel-pack
- https://ansimuz.itch.io/gothicvania-town
- https://pixelfrog-assets.itch.io/pixel-adventure-1
- https://opengameart.org/
- https://itch.io/game-assets
- https://github.com/CalamityTeam/CalamityModPublic (reference only until asset usage permission documented)
- https://github.com/InfernumTeam/InfernumMode (reference only until asset usage permission documented)

Generated assets remain blocked until actual rendered output, alpha/palette cleanup, code integration, gameplay screenshot and owner approval. The V3 image prompts in `IMAGE_PROMPTS.md` are **not** generated art.
