# UAT — W5: Supreme Calamitas fight + minigame bugs (2026-08-18)

Machine-verified: **1440 checks, 15 suites, all green** (2026-08-19), incl.
fixes8 §6b full win path through synthesized keys and fixes18 §4–§17 (fight
flow, ESC confirm, contact damage, brothers, dialog resume). Real-browser UAT
through a headless Chrome driven over CDP (native input; the engine ignores
synthetic arrow events — only `r`/`e`/`Escape`-style keys dispatch). Screenshot
evidence in `%TEMP%\opencode\uat-*.png`.

| # | Test | Result | Date | Notes |
|---|------|--------|------|-------|
| 1 | Contact damage: soul takes 1 HP per touch, only while SC telegraphs or dashes — not during recovery, laugh, or idle | ✅ | 2026-08-19 | fixes18 §8: `hitPlayer`, radius 34, guarded by `(chargeTelegraph > 0 \|\| chargeT > 0)` / `sep.chargeT > 0`; no idle contact. fixes8 §6b drives the whole win path live |
| 2 | Sepulcher: six hearts orbit the worm; a soul touch shatters exactly one | ✅ | 2026-08-19 | fixes8 §6b: all six shatter by strike within 18px; fixes18 §4 asserts `hearts === 6`; browser probe: `hearts:6` mid-fight |
| 3 | Win path: hearts → 3 walls → brothers (bob, side swap, enrage) → laugh → phase 2; the cycle continues without reset | ✅ | 2026-08-19 | fixes8 §6b (full fight through synthesized keys); fixes18 §11 (volley caps, pause, side swap, enrage, phase 2) |
| 4 | Soul has five HP (five dots), heart refills one | ✅ | 2026-08-19 | browser probe after `scal.open()`: `soulHP:5`; fixes8 §6b verifies heart pickup heals exactly one |
| 5 | ConfirmExit: ESC closes the dialog and does not re-open | ✅ | 2026-08-19 | fixes18 §5/§6; **real browser**: ESC raises `#confirmExit`, Escape declines (fight keeps running), ESC again then Enter accepts → `close()` → engine lands in `b8_arena`, wrapper hidden |
| 6 | Dialog resume: resumes mid-line where left off, with a short closing line at the end | ✅ | 2026-08-19 | fixes18 §15: progress keyed per room+entity, resumed talks start at the abandoned line, fully-read talks replay whole; `E`-during-talk is a no-op |

Also UAT'd in the real browser (2026-08-19): **b2** riddle stones solve
cleanly, **b4** ice ring solved (all three plates armed by slide deaths; the
soul holds `x:176.1` on the north plate with zero creep — previously crept to
234.66), **b5** mirror turn + R plate, **b6** torch → socket. Fixing the b4
drive uncovered a real design bug: the west slide was physically blocked by
the lower centre pillar (the 8px hitbox straddles two rows, so a solid tile
one row above the path freezes the slide forever) — pillar removed in
`rooms-a.js`, room now solvable.

Entry: `site/js/act4/boss-scal.js` — fight at the calami... no, the Sepulcher,
end of Act IV chain.