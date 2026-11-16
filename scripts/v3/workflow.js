export const meta = {
  name: 'neu-v3',
  description: 'NEU V3: build, review and gate work on v3/integration. Pause for the primary orchestrator to commit each code change.',
  whenToUse: 'Launch from the v3-integration worktree with args {batch: "B0"|"B1"|...|"B13"}. Optional: only: [ids], swap: {sonnet: "opus"}, forestApproved: true (needed for B5 and later).',
  phases: [
    { title: 'Docs', detail: 'Batch 1 only: plan documents written under scripts/v3/out/' },
    { title: 'Build', detail: 'one builder per work order, test first' },
    { title: 'Review', detail: 'independent SHIP / REJECT on the diff and the shots' },
    { title: 'Integrate', detail: 'full gate, then return to the primary orchestrator or roll back' },
  ],
}

/* ── how to launch ───────────────────────────────────────────────────
   Session cwd must be .claude/worktrees/v3-integration (branch v3/integration).
     Workflow({ scriptPath: 'scripts/v3/workflow.js', args: { batch: 'B0' } })
   Order: B0 lanes -> B1 documents -> B2 -> B3 -> B4, then STOP for the user's
   forest review. B5..B13 refuse to run without args.forestApproved === true.
   args.only = ['B2-01', ...] runs a subset. args.swap = { sonnet: 'opus' }
   remaps a model tier (the Sonnet quota was exhausted until 01:10 on 2026-11-10).
   A code order returns READY_TO_COMMIT and stops. The primary orchestrator commits,
   then resumes with args.only listing the remaining IDs. A failure stops the batch.
   Nothing here commits, pushes, merges or leaves the worktree. */

const RULES = 'scripts/v3/RULES.txt'
const PLAN = 'scripts/v3/out/PLAN.md'
const ORDER = ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13']

const A = args || {}
const batch = A.batch || 'B0'
const swap = A.swap || {}
const M = function (m) { return swap[m] || m }

/* id, batch, title, PLAN locator, builder model, visual?, allowed files, extra {skills, needs, how, noCommit, docOnly} */
function wo(id, b, title, ref, model, visual, files, x) {
  x = x || {}
  return { id: id, batch: b, title: title, ref: ref, model: model, visual: !!visual, files: files || [],
           skills: x.skills || '', needs: x.needs || [], how: x.how || '', noCommit: !!x.noCommit, docOnly: !!x.docOnly }
}
function lane(name, w, title, files, extra) {
  return wo('L-' + name, 'B0', 'Land lane ' + name + ' (' + w + ': ' + title + ')', 'section 2.2 to 2.4', 'sonnet', true, files, {
    how: [
      'This is a LANDING, not new design. The finished work sits uncommitted in ../../../.worktrees/' + name + '/ (read-only for you).',
      'Its spec is ' + w + ' in ../../../.opencode/plans/rework-2026-11-09/plan.md and its row in tracker.md beside it.',
      'For each allowed file: if `cmp -s` says the lane copy equals ours, skip it. A file that does not exist here: copy it.',
      'Otherwise 3-way merge. Base: `timeout 5 git show 99d744e:<path> > scripts/v3/out/lanes/' + name + '/<name>.base` (one plain command; make the folder first).',
      'Copy the lane file to scripts/v3/out/lanes/' + name + '/<name>.lane, then `timeout 5 git merge-file <path> <base> <lane>`; its exit code is the conflict count.',
      'Resolve every conflict by keeping BOTH sides\' features; never drop code that main gained after 99d744e (the W10 commit bbb4331).',
      'Suites: copy from ../../../.worktrees/' + name + '/tests each fixesN.mjs or dbgN.mjs that is missing in tests/ and whose first line does not say placeholder.',
      'A suite present in both and different: merge it the same way; the lane\'s pre-work tests are in ../../../.opencode/log/devin/snap-' + w.split(' ')[0] + '.tar if that file exists, else compare by hand and keep the assertions of both.',
      'Run the lane\'s new suites and every suite its tracker row names. Shoot the scenes it touched.',
      'Defects that PLAN section 2.4 assigns to a later batch are NOT fixed now; list them in your notes.',
      extra || ''
    ].join('\n')
  })
}

const WOS = [
  /* ── B0: land the eight lanes, in this order ── */
  lane('throne', 'W13', 'throne room cast and seat', ['js/act4/rooms-a.js', 'js/act4/look-castle.js', 'js/core/engine.js', 'js/core/engine-look.js']),
  lane('puzzles', 'W15', 'ice mouse puzzle', ['js/act4/rooms-a.js', 'js/act4/look-castle.js'], 'The lane also carries W10 re-syncs of crack.js, dungeon.js, look-dungeon.js, game.css: they equal main, ignore them.'),
  lane('home', 'W18', 'new-home corridor', ['js/act4/rooms-d.js', 'js/act4/look-city.js']),
  lane('combat', 'W19', 'melee swing and charge', ['js/core/plat.js', 'js/core/kit.js', 'js/act4/dgn-foes.js']),
  lane('inv', 'W21', 'C inventory and TP bar', ['js/act4/inventory.js', 'js/core/kit.js', 'js/core/tphud.js', 'index.html', 'scripts/build.mjs', 'css/game.css']),
  lane('cards', 'W22', 'mage interface and Brimstone cast', ['js/act4/mage.js', 'index.html', 'css/game.css']),
  lane('scal', 'W14', 'Calamitas phases and victory', ['js/act4/boss-scal.js', 'js/act4/scal-attacks.js', 'css/game.css']),
  lane('tex', 'W24', 'textures and alpha', ['img/act4/terraria', 'img/act4/calamity'], 'Binary files: copy the changed PNGs with cp (no merge). Also copy img/act4/CREDITS.md; it is git-ignored and is not committed.'),

  /* ── B2: critical fixes ── */
  wo('B2-01', 'B2', 'Console stays closed until Polterghast', 'section 3, item B2-01', 'sonnet', 0, ['js/game/deck.js', 'js/game/sans.js', 'js/core/dev.js'], { skills: 'save-systems' }),
  wo('B2-02', 'B2', 'Sword keeps 3 hits; dead lines and unused data removed', 'section 3, items B2-02 and B2-10', 'sonnet', 0, ['js/game/sans.js', 'js/core/dev.js', 'css/style.css', 'js/act4/rooms-d.js']),
  wo('B2-03', 'B2', 'Bullet room says thirty', 'section 3, item B2-03', 'sonnet', 0, ['index.html', 'js/core/quest.js', 'js/game/deck.js', 'js/game/bullet.js']),
  wo('B2-04', 'B2', 'step in opens after the panel has left', 'section 3, item B2-04', 'sonnet', 0, ['js/game/bullet.js']),
  wo('B2-05', 'B2', 'Bullet room telegraphs and balance', 'section 3, item B2-05', 'opus', 1, ['js/game/bullet.js'], { skills: 'neu-juice, game-feel' }),
  wo('B2-06', 'B2', 'Dog line and leaving animation', 'section 3, item B2-06', 'opus', 1, ['js/game/sans.js', 'js/act4/act4.js']),
  wo('B2-07', 'B2', 'Sleep scene overlap', 'section 3, item B2-07', 'opus', 1, ['css/style.css', 'css/game.css']),
  wo('B2-08', 'B2', 'Hidden star belongs to the background', 'section 3, item B2-08', 'opus', 1, ['js/page/stars.js', 'js/game/sans.js', 'index.html', 'css/style.css']),
  wo('B2-09', 'B2', 'Dialogue never eats an unread line', 'section 3, item B2-09', 'sonnet', 0, ['js/game/sans.js', 'js/core/engine.js'], { skills: 'dialogue-systems' }),

  /* ── B3: engine foundations ── */
  wo('B3-10', 'B3', 'Room aliases and areas', 'section 4, item B3-10', 'sonnet', 0, ['js/core/engine.js'], { skills: 'save-systems' }),
  wo('B3-11', 'B3', 'World graph tool and suite', 'section 4, item B3-11', 'sonnet', 0, ['scripts/worldgraph.mjs'], { skills: 'level-design', how: 'Write the generated graph and its table to scripts/v3/out/design/ (not committed).' }),
  wo('B3-01', 'B3', 'Transition registry and slide', 'section 4, items B3-01, B3-02, B3-12', 'opus', 1, ['js/core/engine-trans.js', 'js/core/engine.js', 'js/core/engine-doors.js', 'index.html', 'scripts/build.mjs'], { skills: 'camera-systems, game-feel', how: 'A new script tag also needs the module lists inside the suites (tests/fixes26.mjs pins script order).' }),
  wo('B3-03', 'B3', 'door, stairs and fall transitions', 'section 4, items B3-03, B3-04, B3-05', 'opus', 1, ['js/core/engine-trans.js', 'js/core/engine-doors.js', 'js/core/engine.js'], { needs: ['B3-01'], skills: 'game-feel, neu-juice' }),
  wo('B3-06', 'B3', 'portal, cine and mode bridge', 'section 4, item B3-06', 'opus', 1, ['js/core/engine-trans.js', 'js/core/kernel.js'], { needs: ['B3-01'] }),
  wo('B3-07', 'B3', 'Camera: deadzone, look-ahead, cinematic targets', 'section 4, item B3-07', 'opus', 1, ['js/core/engine.js'], { skills: 'camera-systems' }),
  wo('B3-08', 'B3', 'Render interpolation', 'section 4, item B3-08', 'opus', 1, ['js/core/engine.js', 'js/core/plat.js'], { skills: 'physics-tuning, performance-optimization' }),
  wo('B3-09', 'B3', 'No black void: scale cap and zone surround', 'section 4, item B3-09', 'opus', 1, ['js/core/engine.js', 'js/core/engine-look.js', 'js/act4/look-woods.js']),

  /* ── B4: forest slice, then the workflow stops ── */
  wo('B4-01', 'B4', 'Forest as one room a_woods', 'section 5', 'opus', 1, ['js/act4/rooms-a.js', 'js/act4/look-woods.js', 'js/core/engine-doors.js'], { needs: ['B3-10', 'B3-01', 'B3-07', 'B3-09'], skills: 'neu-room, level-design, camera-systems' }),
  wo('B4-02', 'B4', 'Forest review package', 'section 5, "Review package"', 'sonnet', 0, [], { needs: ['B4-01'], docOnly: true, how: 'No code. Write scripts/v3/out/review/b4/: the three old rooms shot from the untouched main checkout (`SHOT_PORT=8765 node scripts/v3/shot.mjs ...`), the merged room at three camera positions, a 20 s Playwright recording of clearing -> gate -> clearing with the keys held, frame-time numbers from scripts/perf.mjs, and a rubric table. End with a one-page REVIEW.md the user can read.' }),

  /* ── B5: castle and Calamitas ── */
  wo('B5-01', 'B5', 'Castle transitions', 'section 6.1', 'opus', 1, ['js/core/engine-doors.js', 'js/core/engine-trans.js', 'js/act4/rooms-a.js']),
  wo('B5-02', 'B5', 'The witch opens the door with a spell', 'section 6.2', 'opus', 1, ['js/act4/rooms-a.js', 'js/act4/look-castle.js', 'js/core/engine-doors.js'], { skills: 'neu-room, neu-juice' }),
  wo('B5-03', 'B5', 'Second throne: walk in, sit, stand', 'section 6.3', 'opus', 1, ['js/core/engine.js', 'js/core/engine-look.js', 'js/act4/rooms-a.js']),
  wo('B5-04', 'B5', 'Ice mouse, three stages', 'section 6.4', 'opus', 1, ['js/act4/rooms-a.js', 'js/act4/look-castle.js'], { skills: 'neu-room, puzzle' }),
  wo('B5-05', 'B5', 'Torch puzzle', 'section 6.5', 'opus', 1, ['js/act4/rooms-a.js', 'js/act4/look-castle.js'], { skills: 'neu-room, puzzle' }),
  wo('B5-06', 'B5', 'Solver proofs for b3 and b5', 'section 6.6', 'sonnet', 0, [], { noCommit: true, skills: 'puzzle' }),
  wo('B5-07', 'B5', 'Altar trapdoor and fall', 'section 6.7', 'opus', 1, ['js/act4/rooms-a.js', 'js/act4/look-castle.js', 'js/core/engine-kinds.js', 'js/core/engine-doors.js'], { skills: 'neu-room, neu-juice' }),
  wo('B5-08', 'B5', 'Summoning circle becomes the fight box', 'section 6.8', 'opus', 1, ['js/act4/summon.js', 'js/act4/boss-scal.js']),
  wo('B5-09', 'B5', 'Calamitas reads the equipped gear', 'section 6.9, "Equipment"', 'sonnet', 0, ['js/act4/boss-scal.js']),
  wo('B5-10', 'B5', 'Calamitas fight box clip and one telegraph per attack', 'section 6.9, "Fight box" and "Telegraphs"', 'opus', 1, ['js/act4/boss-scal.js', 'js/act4/scal-attacks.js'], { skills: 'neu-room' }),

  /* ── B6: city, HOME, Tenna, prize hall, vending ── */
  wo('B6-01', 'B6', 'City as one street d_city', 'section 7.1', 'opus', 1, ['js/act4/rooms-d.js', 'js/act4/look-city.js', 'js/core/engine-doors.js'], { skills: 'neu-room, level-design' }),
  wo('B6-02', 'B6', 'HOME: single drink, readable bedrooms, locked-door lines', 'section 7.2', 'opus', 1, ['js/act4/inventory.js', 'js/act4/rooms-d.js', 'js/act4/rooms-e.js', 'js/act4/look-city.js']),
  wo('B6-03', 'B6', 'Recall potion portal', 'section 7.3', 'opus', 1, ['js/act4/act4.js', 'js/core/engine-trans.js', 'js/core/engine-look.js'], { skills: 'neu-juice' }),
  wo('B6-04', 'B6', 'TV to Tenna', 'section 7.4', 'opus', 1, ['js/game/sans.js', 'js/act4/quiz.js', 'css/game.css']),
  wo('B6-05', 'B6', 'Quiz and prize hall pinned by one suite', 'section 7.5', 'sonnet', 0, [], { noCommit: true }),
  wo('B6-06', 'B6', 'Vending: six punches and no dead waits', 'section 7.6', 'opus', 1, ['js/act4/rooms-g.js', 'js/act4/look-prize.js', 'js/core/engine-trans.js'], { skills: 'neu-juice' }),

  /* ── B7: inventory, crafting, rhythm battle ── */
  wo('B7-01', 'B7', 'C menu layout', 'section 8.1', 'opus', 1, ['css/game.css', 'js/act4/inventory.js'], { skills: 'game-ui-ux' }),
  wo('B7-02', 'B7', 'Crafting backdrop', 'section 8.2', 'opus', 1, ['js/act4/craft.js', 'css/game.css']),
  wo('B7-03', 'B7', 'Rhythm: section label, disco ball, restart, bar-aligned breaks', 'section 8.4, first four changes', 'opus', 1, ['js/act4/rhythm.js'], { skills: 'audio-design' }),
  wo('B7-04', 'B7', 'Rhythm to soul and back', 'section 8.4, "rhythm -> soul"', 'opus', 1, ['js/act4/rhythm.js'], { skills: 'neu-juice' }),
  wo('B7-05', 'B7', 'Stage curtain between room and stage', 'section 8.4, "room <-> stage"', 'opus', 1, ['js/act4/rhythm.js', 'js/act4/rooms-d.js']),

  /* ── B8: crack, dungeon, mage, cards, Polterghast ── */
  wo('B8-01', 'B8', 'Crack hand-off and measured performance', 'section 9.1', 'opus', 1, ['js/act4/crack.js', 'js/act4/dungeon.js', 'css/game.css'], { skills: 'performance-optimization', how: 'Profile first (scripts/perf.mjs); change only what the profile shows.' }),
  wo('B8-02', 'B8', 'Tutorial level t0', 'section 9.2, "Tutorial level"', 'opus', 1, ['js/act4/dungeon.js', 'js/act4/look-dungeon.js', 'js/core/plat.js'], { skills: 'platformer, level-design' }),
  wo('B8-03', 'B8', 'Bone door sequence', 'section 9.2, "Bone door"', 'opus', 1, ['js/act4/dungeon.js', 'js/act4/look-dungeon.js', 'js/act4/boss-polt.js']),
  wo('B8-04', 'B8', 'Mage shop frame', 'section 9.3', 'opus', 1, ['css/game.css']),
  wo('B8-05', 'B8', 'Card battle without chance', 'section 9.4', 'opus', 1, ['js/act4/cards.js', 'js/act4/mage.js', 'js/act4/dungeon.js'], { skills: 'card-game, neu-juice' }),
  wo('B8-06', 'B8', 'Polterghast arena and attacks', 'section 9.5', 'opus', 1, ['js/act4/boss-polt.js'], { skills: 'neu-room', how: 'First read scripts/v3/out/verify/polt-attacks.md (Batch 1). The file that defines NEU.poltAtk is also allowed.' }),

  /* ── B9: minecart, elevator, mountain, painter ── */
  wo('B9-01', 'B9', 'Minecart obstacle lead time', 'section 10.1', 'sonnet', 0, ['js/act4/cart.js']),
  wo('B9-02', 'B9', 'Elevator doors open onto the mountain', 'section 10.2', 'opus', 1, ['js/act4/elevator.js', 'js/core/plat.js']),
  wo('B9-03', 'B9', 'Mountain screen change and phone view', 'section 10.3', 'opus', 1, ['js/act4/mountain.js', 'js/core/plat.js'], { skills: 'platformer' }),
  wo('B9-04', 'B9', 'Lightning on leaving the tavern', 'section 10.4', 'opus', 1, ['js/act4/rooms-p.js', 'js/core/engine-trans.js']),

  /* ── B10: Dad, desert, village ── */
  wo('B10-01', 'B10', 'Photograph', 'section 11, "Photograph"', 'sonnet', 0, ['js/act4/photo.js'], { how: 'First read scripts/v3/out/verify/photo.md. If nothing is wrong, report done with no diff.' }),
  wo('B10-02', 'B10', 'Desert landmarks and growing horizon', 'section 11, "Desert"', 'opus', 1, ['js/act4/rooms-s.js', 'js/act4/look-savanna.js'], { skills: 'level-design' }),
  wo('B10-03', 'B10', 'Village as one map s_village', 'section 11, "Village"', 'opus', 1, ['js/act4/rooms-s.js', 'js/act4/look-savanna.js', 'js/act4/snail.js', 'js/act4/chase.js'], { skills: 'neu-room, level-design', how: 'Build from scripts/v3/out/levels/village.md (Batch 1); if it is missing, stop.' }),

  /* ── B11: Draedon and finale ── */
  wo('B11-01', 'B11', 'Wake in the village', 'section 12, "Inconsistency found"', 'sonnet', 0, ['js/act4/boss-draedon.js', 'js/act4/chase.js'], { how: 'First read scripts/v3/out/verify/wake-chase-finale.md.' }),
  wo('B11-02', 'B11', 'Exo hall and fight arenas', 'section 12, "Arenas"', 'opus', 1, ['js/act4/rooms-s.js', 'js/act4/look-exo.js', 'js/act4/boss-exo.js', 'js/act4/boss-draedon.js'], { skills: 'neu-room' }),
  wo('B11-03', 'B11', 'Nuke sequence', 'section 12, "Nuke"', 'opus', 1, ['js/act4/boss-draedon.js'], { how: 'Build from scripts/v3/out/scenes/finale.md (Batch 1); if it is missing, stop.' }),

  /* ── B12, B13 ── */
  wo('B12-01', 'B12', 'Rubric re-score of every scene', 'section 14, Batch 12', 'opus', 1, [], { docOnly: true, how: 'Shoot every room and mode, score with the rubric in RULES.txt, write scripts/v3/out/review/b12/SCORES.md listing each category under 4 with the file to change. No code.' }),
  wo('B13-01', 'B13', 'Complete verification', 'section 14, Batch 13', 'sonnet', 0, [], { docOnly: true, how: 'Run the full gate, tests/playthrough.mjs, phone shots (tests/shot-mobile.mjs), reload at every save point, and check each row of scripts/v3/out/TRACE.csv. Write scripts/v3/out/review/b13/REPORT.md. No code.' })
]

/* ── Batch 1: documents, written under scripts/v3/out/, nothing committed ── */
const DOC_HEAD = 'Read ' + RULES + ' ("WHERE YOU WORK" only) and ' + PLAN + '. You write documents, not game code. Every rule you write is a number, a file or a named function taken from code you read yourself; cite path:line; write UNKNOWN where you could not determine something; never guess. Output only under scripts/v3/out/.\n'
const DOCS1 = [
  { id: 'D-trace', model: 'sonnet', p: 'Write scripts/v3/out/TRACE.csv: one row per requirement bullet of Part 9 of the V3 prompt (/home/neu/Downloads/Pasted text(10).txt) and of the 16-section brief (../../../.opencode/plans/rework-2026-11-09/brief.md) and of ../../../memory/Neu BUG tracker.md. Columns: id, source file:line, requirement, status (UNVERIFIED / BROKEN / PARTIAL / WORKING / NEEDS REDESIGN / IMPLEMENTED / VERIFIED / BLOCKED), evidence path:line, PLAN section, work-order id. Merge duplicates into one row with several sources. Check each status in the code.' },
  { id: 'D-design-a', model: 'opus', p: 'Write scripts/v3/out/design/ART_BIBLE.md, CAMERA_TRANSITIONS.md, GAME_FEEL_POLICY.md, COMBAT_READABILITY.md, LEVEL_DESIGN_POLICY.md, UI_UX_POLICY.md, ANIMATION_STANDARDS.md, VISUAL_REVIEW_RUBRIC.md as PLAN section 13 lists them. Load the skills create-game-assets, camera-systems, game-feel, level-design, game-ui-ux. Rules must be checkable (a pixel size, a duration, a function), like the door example in Part 4.1 of the V3 prompt.' },
  { id: 'D-design-b', model: 'sonnet', p: 'Write scripts/v3/out/design/STORY_CANON.md (rebuilt from the code and ../../../memory/Neu BUG tracker.md; ../../../memory/story.md is stale and must not be edited), SAVE_AND_PROGRESS.md, PERFORMANCE_BUDGETS.md (frame time and memory only, no byte budgets), ACCESSIBILITY.md, AUDIO_POLICY.md, ASSET_POLICY.md. Load the skills save-systems, performance-optimization, audio-design.' },
  { id: 'D-assets', model: 'sonnet', p: 'Write scripts/v3/out/asset-manifest.csv from js/data/sheets.js, img/ and img/act4/CREDITS.md. Columns: asset_id, scene_id, source, license, status, dimensions, frame_count, pivot, palette, alpha, atlas, compression, author, review_status. Mark every sprite taken from Terraria, Calamity, Infernum, Undertale, Deltarune or Minecraft as restricted-existing. Check real alpha and dimensions with python3 PIL, not by name.' },
  { id: 'D-refs', model: 'sonnet', p: 'Write scripts/v3/out/references/BOARD.md: at least 20 distinct visual references (Eastward, Hyper Light Drifter, Deltarune, Undertale, Celeste, Terraria/Calamity/Infernum/Wrath of the Gods, Inscryption, Buckshot Roulette, Unsighted, CrossCode). For each: source URL and creator, the feature worth studying, why it works, how NEU applies it, what must not be copied, the NEU scene ids it serves. Links only; download nothing into the repo. Put no project or user details into any web request.' },
  { id: 'V-polt', model: 'sonnet', p: 'Write scripts/v3/out/verify/polt-attacks.md: find where NEU.poltAtk is defined; list every Polterghast attack with its phase, whether a telegraph is drawn and its lead time, and its projectiles. Capture each attack once with scripts/v3/shot.mjs into scripts/v3/out/shots/polt/.' },
  { id: 'V-photo', model: 'sonnet', p: 'Write scripts/v3/out/verify/photo.md: how js/act4/photo.js opens, what the photograph shows, the crossed-out location and whether its name changes, every flag it sets, and what sets the `photo` flag. One screenshot.' },
  { id: 'V-village', model: 'sonnet', p: 'Write scripts/v3/out/verify/village.md: every entity of s0_sand with its column; for each of s1_gate..s14_station the grid size, which wall (n/s/e/w) each exit is on and where it leads, and its activity rule; whether look-savanna.js draws houses differently from each other. Then propose nothing: facts only.' },
  { id: 'V-exo', model: 'sonnet', p: 'Write scripts/v3/out/verify/exo.md: for Ares, the twins and Thanatos the HP, every attack with telegraph and lead time, and whether the mech is drawn from sprite sheets or from fillRect shapes (quote the draw code); what the fight arena draws.' },
  { id: 'V-finale', model: 'sonnet', p: 'Write scripts/v3/out/verify/wake-chase-finale.md: drive the game with the dev console from the Draedon nuke to the end and log the order of rooms and modes; quote boss-draedon.js wake(), chase.js lockdown()/caught() and finale.js open(); state exactly where the player wakes, where the chase runs, where the finale opens.' },
  { id: 'V-perf', model: 'sonnet', p: 'Write scripts/v3/out/verify/perf.md: frame-time numbers from scripts/perf.mjs for a1_clearing, h2_machine, s0_sand, plat d0, d5, d10, the crack arrival and both boss fights (served from port 8766 after `sh scripts/v3/wo.sh serve`); and the minecart: seconds between an obstacle first being drawn and its impact at top speed, from js/act4/cart.js.' }
]
const DOCS2 = [
  { id: 'D-prompts', model: 'opus', p: 'Write scripts/v3/out/IMAGE_PROMPTS.md: one final GPT-Image prompt for each asset in the table of PLAN section 13 (IMG-04, 05, 06, 07, 08, 12, 16, 17, 18, 23 and the optional IMG-01). Load the skill create-game-assets and use its prompt blocks. Sizes, frame counts and palettes come from js/data/sheets.js, scripts/v3/out/design/ART_BIBLE.md and scripts/v3/out/asset-manifest.csv. Each prompt ends with the inbox path scripts/v3/out/assets/inbox/<IMG-id>/ and the checks the file must pass.' },
  { id: 'D-scenes-early', model: 'opus', p: 'Write scripts/v3/out/scenes/forest.md, castle.md, city-home.md, rhythm.md with the 21 fields of Part 7 of the V3 prompt for every sequence in PLAN sections 5 to 8, and scripts/v3/out/levels/forest.md, castle.md, city.md with the tile grids (the merged-room tables of PLAN sections 5 and 7.1 are binding). Use real coordinates from the room files.' },
  { id: 'D-scenes-late', model: 'opus', p: 'Write scripts/v3/out/scenes/dungeon.md, mountain.md, village.md, finale.md and scripts/v3/out/levels/village.md (the authored single-map layout: draw the grid, place every old room as an area, list every exit) and scripts/v3/out/enemies/ENEMY_BIBLE.md, for PLAN sections 9 to 12. Build on scripts/v3/out/verify/*.md; where a verify file says UNKNOWN, keep it UNKNOWN and say what must be checked.' }
]

const BUILD = { type: 'object', properties: { done: { type: 'boolean' }, files: { type: 'array', items: { type: 'string' } }, suite: { type: 'string' }, pass: { type: 'number' }, shots: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['done', 'notes'] }
const REVIEW = { type: 'object', properties: { verdict: { type: 'string', enum: ['SHIP', 'REJECT'] }, failing: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'failing'] }
const INTEG = { type: 'object', properties: { green: { type: 'boolean' }, committed: { type: 'boolean' }, commit: { type: 'string' }, notes: { type: 'string' } }, required: ['green', 'committed', 'notes'] }
const DOC = { type: 'object', properties: { written: { type: 'array', items: { type: 'string' } }, unknowns: { type: 'array', items: { type: 'string' } } }, required: ['written', 'unknowns'] }

function head(role, w) {
  return 'You are the ' + role + ' for NEU V3 work order ' + w.id + ': ' + w.title + '.\n' +
    'Read ' + RULES + ' and follow its ' + role + ' section exactly. The spec is ' + PLAN + ', ' + w.ref + '.\n' +
    'Allowed files: ' + (w.files.length ? w.files.join(', ') : 'none (tests/ and scripts/v3/out/ only)') + '.\n'
}
function buildPrompt(w, failing) {
  return head('BUILDER', w) +
    'Skills to load: neu-site, neu-verify' + (w.skills ? ', ' + w.skills : '') + '.\n' +
    (w.how ? w.how + '\n' : '') +
    (failing ? 'This is the one repair round. The reviewer rejected the work for:\n- ' + failing.join('\n- ') + '\nFix exactly these; do not run `wo.sh begin` again.\n' : '') +
    'Set done=true only when your suite is green' + (w.visual ? ' and your shots are taken and looked at' : '') + '.'
}
function reviewPrompt(w, b) {
  return head('REVIEWER', w) +
    'See the change with `timeout 5 git status --short` and `timeout 5 git diff` (plain commands), plus the new or changed suites in tests/.\n' +
    'Builder report: files ' + JSON.stringify(b.files || []) + ', suite ' + (b.suite || '?') + ', shots ' + JSON.stringify(b.shots || []) + '.\n' +
    (w.visual ? 'Open every shot with the Read tool and score the rubric.\n' : '') +
    'Edit nothing.'
}
function integPrompt(w) {
  return head('INTEGRATOR', w) +
    'Run the gate. Do not stage or commit; committed=false is required. The primary orchestrator owns commits.\n'
}

/* ── run ── */
if (ORDER.indexOf(batch) < 0) return { error: 'unknown batch ' + batch }
if (ORDER.indexOf(batch) > ORDER.indexOf('B4') && A.forestApproved !== true)
  return { error: 'B5 and later wait for the user\'s forest review; pass forestApproved: true once it is given' }

if (batch === 'B1') {
  phase('Docs')
  const run = function (d) { return function () { return agent(DOC_HEAD + d.p, { label: d.id, phase: 'Docs', model: M(d.model), effort: 'high', schema: DOC }).then(function (r) { return { id: d.id, result: r } }) } }
  const pick = function (list) { return list.filter(function (d) { return !A.only || A.only.indexOf(d.id) >= 0 }) }
  /* barrier on purpose: the second group reads what the first group wrote */
  const one = await parallel(pick(DOCS1).map(run))
  const two = await parallel(pick(DOCS2).map(run))
  return one.concat(two)
}

const list = WOS.filter(function (w) { return w.batch === batch && (!A.only || A.only.indexOf(w.id) >= 0) })
const out = [], failed = {}
for (const w of list) {
  const blockedBy = w.needs.filter(function (n) { return failed[n] })
  if (blockedBy.length) { failed[w.id] = 1; out.push({ id: w.id, status: 'SKIPPED', why: 'needs ' + blockedBy.join(', ') }); log(w.id + ' skipped'); continue }

  let b = await agent(buildPrompt(w), { label: 'build:' + w.id, phase: 'Build', model: M(w.model), effort: 'high', schema: BUILD })
  if (w.docOnly) { out.push({ id: w.id, status: b && b.done ? 'DONE' : 'BLOCKED', notes: b ? b.notes : 'builder ended without a report' }); continue }

  let r = b && b.done ? await agent(reviewPrompt(w, b), { label: 'review:' + w.id, phase: 'Review', model: M(w.visual ? 'opus' : 'sonnet'), effort: w.visual ? 'high' : 'medium', schema: REVIEW }) : null
  if (b && b.done && r && r.verdict === 'REJECT') {
    b = await agent(buildPrompt(w, r.failing), { label: 'repair:' + w.id, phase: 'Build', model: M(w.model), effort: 'high', schema: BUILD })
    r = b && b.done ? await agent(reviewPrompt(w, b), { label: 're-review:' + w.id, phase: 'Review', model: M(w.visual ? 'opus' : 'sonnet'), effort: w.visual ? 'high' : 'medium', schema: REVIEW }) : null
  }
  if (!b || !b.done || !r || r.verdict !== 'SHIP') {
    const rollback = await agent('Run `timeout 20 sh scripts/v3/wo.sh rollback ' + w.id + '` from the worktree root and return its output. Do nothing else.', { label: 'rollback:' + w.id, phase: 'Integrate', model: M('haiku'), effort: 'low' })
    failed[w.id] = 1
    out.push({ id: w.id, status: 'BLOCKED', rollback: rollback, why: !b ? 'builder ended without a report' : !b.done ? b.notes : !r ? 'reviewer ended without a verdict' : r.failing.join('; ') })
    log(w.id + ' blocked; inspect rollback before resuming')
    return out
  }
  const i = await agent(integPrompt(w), { label: 'gate:' + w.id, phase: 'Integrate', model: M('sonnet'), effort: 'medium', schema: INTEG })
  const ok = i && i.green && !i.committed
  if (!ok) failed[w.id] = 1
  out.push({ id: w.id, status: ok ? (w.noCommit ? 'DONE' : 'READY_TO_COMMIT') : 'BLOCKED',
    commitMessage: 'feat(v3): ' + w.id + ' ' + w.title, notes: i ? i.notes : 'integrator ended without a report' })
  log(w.id + (ok ? (w.noCommit ? ' done' : ' ready for the primary orchestrator to commit') : ' blocked at the gate; stop and inspect the checkpoint'))
  if (!ok || !w.noCommit) return out
}
if (batch === 'B4') log('Batch 4 finished. STOP: the user reviews scripts/v3/out/review/b4/REVIEW.md before any later batch.')
return out
