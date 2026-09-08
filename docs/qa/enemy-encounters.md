# SA-COMBAT-001 — Regional encounter verification

Status: validated development checkpoint; local integration in progress.
Independent acceptance and physical-device testing remain pending. No deployment.

Branch `feat/enemy-encounters`, original base `c766544`. Final browser-tested
runtime/fixture `510e25a`. Checked station, base-commerce and settlement changes
through local development `32966e3` subsequently merge without conflict. Existing
Nomad 02 / Kestrel hulls, textures and fitted guns are reused unchanged. No new
server, save, generator, asset or controller-binding contract. Owned QA port: 5398.

## Implemented scope

Fifteen named local sorties across Aeon, Selene, Pyre, Miasma and Selene's belt.
Easy / Standard / Hard change NPC integrity, turning, speed and firing cadence.
Advertised rosters contain one, two or five enemies; Hard has two waves with a
10-second warning. Dispatch is explicitly accepted through Contracts, stays above
the current canonical surface or above the belt plane, and never moves the pilot.
Single-use report filing freezes finish state; twelve recent session records are
retained, with three shown. Native controller scrolling reaches the report panel.

## Validation

- Original full unit suite: **1,119 individual cases pass**, zero skips, 92.96s.
  This inserts `--test-isolation=none` immediately after `node --test` in the exact
  package script. Log `/tmp/enemy-encounters-final-unit.log`.
- Final focused simulation cases: **18 pass**. Combined station/input/combat
  subset: **42 pass** after taking station `76aa45e`. Logs
  `/tmp/enemy-encounters-focused-final.log` and
  `/tmp/enemy-encounters-combined-focused.log`.
- Final combined station/base/settlement source `b8dde01`: **1,133 individual
  unit cases pass**, zero skips (84.60s), development build passes (4.00s).
  Logs `/tmp/enemy-encounters-union-unit.log` and
  `/tmp/enemy-encounters-union-build.log`.
- `VITE_DEV_TOOLS=1 npm run build`: browser-tested build passes (7.66s).
  Existing Vite large-chunk advisory remains.
- Repository checks pass. The plan against `origin/dev/all-features` includes
  other locally integrated feature ancestry; encounter-owned paths are recorded
  in the task registry and do not change their source contracts.
- Browser command:
  `npm run test:browser -- -c scripts/enemy-encounters.config.js --output=/tmp/star-agent-encounters-attempt05 --max-failures=1`.
  Run05 began 2026-09-08 11:40 UTC. **6/6 pass in 13.1 minutes**, runner exit 0.
  One worker, no retries. Log `/tmp/enemy-encounters-attempt05.log`.
- Final combined source `ad11386`, including settlement delivery metadata:
  keyboard/native-touch regression **1/1 passes in 44.7s**, case 41.2s,
  with zero collected page or console errors. Command adds
  `-g 'keyboard and native touch' --output=/tmp/star-agent-encounters-union-ui06`
  to the same configuration. Log `/tmp/enemy-encounters-union-ui06.log`.

| Actual route | Result | Case time |
|---|---|---|
| Aeon Standard · outer perimeter patrol | 2 kills, 1 wave, filed report | 2.5 min |
| Pyre Easy · ash runner | 1 kill, filed report | 2.0 min |
| Miasma Hard · toxic cordon | 5 kills, 2 waves, reinforcement warning, report | 2.9 min |
| Selene Easy · lunar picket | Continuous ascent from 180 m to orbital beacon, kill/report | 3.6 min |
| Asteroid belt Standard · belt interdiction | Physical approach above rock plane, 2 kills/report | 1.4 min |
| Keyboard / native touch | Difficulty, accept, abandon and return at phone width | 41.3 s |

All five controller routes use the supported Kestrel launcher, real menu paging,
sticks for movement/aim and RT for the selected solar lance. Debug state is read
for steering feedback; no pose, travel, interaction, damage or inventory methods
are used to skip the journey. The only unrelated response fixture is signed-out
`/api/auth/session`. Nomad/Atlas sized-gun and simulation support is covered by the
unit suite and earlier combat records, not five new full ship-specific journeys.

Every controller case checks report totals, right-stick report scrolling at
390×844, held RT over modal return and native tab focus loss, disconnect,
replacement and unsupported mappings. Focus emulation is disabled for both tabs
and actual document/application focus is asserted. Five controller receipts have
**zero page errors, console errors or warnings**. The separate keyboard/native-
touch case in run05 collects page errors and has none; it does not collect console
output. The final combined run06 also collects console errors and passes with none.

Chromium **151.0.7922.173**, ANGLE / **AMD Radeon 860M Graphics**, OpenGL ES 3.2,
1440×900 desktop and 390×844 phone, device scale 1, seed 7291. Injected standard
Gamepad and native CDP touch are browser inputs, not physical controller hardware.
Videos are 960×600; PNGs retain the original viewport. These are functional and
builder visual checks, not hardware FPS or independent art acceptance.

## Original failures and fixes

1. First sandbox build failed EROFS writing Vite's temporary config through the
   installed node_modules symlink. The same command passed with approved execution.
2. Source review found post-completion shots, repair or ship changes could drift
   report values. Results now freeze on the final kill; regression coverage passes.
   Failed-sortie recovery also clears pending reinforcement state and targets.
3. UI01 and attempt02 were deliberately interrupted during loading (exit 130)
   after overlapping GPU reservations were discovered. They are not passes.
   No application fix masked these coordination failures. Original traces/screens
   remain under `/tmp/star-agent-encounter-results-ui01` and
   `/tmp/star-agent-encounters-attempt02`.
4. Attempt03 loaded the game but its fixture searched only the first Ship page.
   The captured focus was on the real next-page button; the corrected controller
   fixture activates that button to reach the weapon control. Full case failed.
5. Attempt04 completed the real Aeon fight/report/return, then failed a held-fire
   assertion (13→14 shots). Playwright was still emulating focus. The corrected
   fixture disables focus emulation, proves native blur/return, and passes. The
   application input gate was unchanged. Original attempt03/04 evidence remains.
6. Builder UI inspection added visibly disabled actions and routed right-stick
   scrolling to the actual inner contract panel. Run05 proves report access.

## Retained evidence

- [Desktop dispatch](enemy-encounters/aeon-contract.png)
- [Hard reinforcement warning](enemy-encounters/miasma-reinforcements.png)
- [Asteroid-belt engagement](enemy-encounters/belt-engagement.png)
- [Phone report after controller scrolling](enemy-encounters/phone-report.png)
- [Five original controller receipts](enemy-encounters/controller-receipts.json)

Complete original per-case briefs, combat states, reports, phone images and
videos remain in `/tmp/star-agent-encounters-attempt05`. Curated images above are
unchanged copies; no generated or edited images are presented as game evidence.

## Limits and next owner

Offline and session-only: no credits, loot, persistence or multiplayer NPC
authority. Existing spherical hits and weapon/asteroid occlusion remain; there is
no NPC asteroid avoidance or ship-to-ship collision. The automated Kestrel/lance
pilot won these routes with full hull, so these passes establish reachability and
state/input correctness, not human difficulty tuning. Cees can playtest each tier
and request balance changes; independent gameplay/visual review remains pending.
