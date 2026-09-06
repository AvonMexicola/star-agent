# Main integration candidate — 2026-09-06

Cees requested consolidation of the separate feature branches into `main`. The
existing accepted/default branch is `feat/visual-fidelity` at `85aa836`; there was
no `main`. Integration is isolated from the dirty shared controller/station/gear
checkout in `/tmp/star-agent-main-integration`.

## Scope

The candidate includes furnished station/concourse/shops; Nomad and live Atlas;
ship power and moving cabins; Atlas Mark II inspection studio; mining, personal
equipment and containers; Selene geology/rings/stones; Aeon biome materials, mixed
trees, meadows, seeded forest streaming and terrain morphs; Pyre; system map and
travel; ship energy effects, crashes, reentry and external camera.

Old controller and station-hull snapshots are reconciled with their newer
implementations. The original container/controller/EVA commits are patch-equivalent
to commits already present in the expedition stack. Their history is recorded
without restoring outdated files. No feature branch is deleted.

## Integration changes

- Station commerce, mining and equipment commit through one browser save ledger.
  Purchases and transfers preserve credits, shop stock, cargo, cuts and loadout.
  Failed or stale-session saves block mutation; legacy manifests remain untouched.
- J is relativistic travel; T fires ship weapons. Personal quick items use 5–8,
  keeping 4 for external camera. Shared controller dialogs expose ship power,
  weapons, equipment, destinations and help. Station shops use the same router.
- Terrain morphs retain the current surface textures and nonperiodic ocean shader.
  Parent triangle reconstruction respects both 16- and 32-cell grids, including
  the transitions at levels 4 and 14. Parents and skirts remain during streaming.
- Forest publication/fades retain all three newer tree variants and meadows.
- Hard impacts apply to unattended cabins and airless bodies. Unsafe impacts no
  longer become soft landings just because the previous branch test expected one.

## Explicit limitations

Atlas Mark II is still `/dev/atlas-mark-ii.html`, not the live fleet replacement.
Its hero asset exceeds the published runtime ship budget. Station cargo weapons
remain cargo; they are distinct from the functional personal loadout weapons.
The old landing-gear solver is retained as source and tests, not wired into flight.
Uncommitted shared station hull and gear edits are excluded. Local browser saves
are not multiplayer/server persistence. Injected Gamepad tests are not physical
Xbox acceptance. Consolidation is not a claim of finished Star Citizen fidelity.

## Verification and publication

Runtime frozen at `0ab1854`; `a20ca1e` adds only Pyre reconciliation docs,
two passing recovered invariant tests, and the old branch history. The diff in
`src/`, `public/`, `index.html`, `package.json` and `vite.config.js` is empty.

| Check | Actual result |
|---|---|
| Full unit suite after Pyre reconciliation | **447 passed, 0 failed** |
| Production build | **Passed**; existing shared-loader chunk >500 kB advisory |
| Core browser suite | **15 passed** (5.4 min) |
| Atlas studio + equipment browser suite | **7 passed** (2.9 min) |
| Independent Opus functional review | Findings fixed; **functionally mergeable**, with final extra-suite condition now satisfied |
| Visual/performance acceptance | **Pending PM-owned Opus review**; no score or budget acceptance claimed |

Browser: Chromium 151.0.7922.173, AMD Radeon 860M via ANGLE OpenGL ES 3.2.
Core desktop/UI captures use 1440×900 and phone captures 390×844; Pyre's own
capture fixture uses 960×600. Streaming tests temporarily reduce render scale;
curated detail captures use 1.0 where the spec states it. These are correctness
checks, not a controlled FPS benchmark or physical Xbox test. Browser error
assertions passed; power checks also explicitly collected zero warnings.

Failure history and independent findings are preserved in
[the initial functional review](functional-review-initial.md) and
[the follow-up](functional-review-followup.md). Earlier failures exposed duplicate
shop controller polling, overlapping three-world map touch targets, missing
controller Menu-close routing and unreachable crash recovery; all are corrected.
Two initial test harness failures were caused by missing touch context and
reloading conflicted source during integration; final runs used a frozen runtime.

Build output totals approximately 105 MiB. Atlas Mark II studio models account
for about 54 MiB (36.28 hero, 13.26 LOD1, 4.02 LOD2); props account for about
15 MiB. The two terrain maps add 8.29 MiB. Vite copies public inspection assets,
so this output size is not the initial game's network download. Atlas asset
budget acceptance remains outstanding; no silent deletion of authoring assets.

[Hangar](hangar.png) · [Cockpit](cockpit.png) · [Forest](forest.png) ·
[Shore](shore.png) · [Map desktop](map-desktop.png) · [Map phone](map-phone.png) ·
[Shop desktop](shop-desktop.png) · [Shop phone](shop-phone.png) ·
[Atlas pilot MFDs](atlas-mfds.png) · [Equipment phone](equipment-phone.png).
These are integration test captures, not substitutes for the PM's independent
fixed-viewpoint visual tour and baseline comparison.

Original Pyre history is accounted for in [the reconciliation record](pyre-reconciliation.md).
The newly published Sun encounter PR35 is explicitly reserved for PM's next
rebase after PR34, as recorded in the shared handoff.

Run the production preview on port 5280, then:

```sh
npm test
npm run build
npm run preview -- --port 5280 --strictPort
# in another terminal:
npm run test:browser -- -c scripts/main-integration.config.js
npm run test:browser -- -c scripts/main-integration-extra.config.js
node scripts/integration-tour.mjs
```

The tour writes to `/tmp/star-agent-main-tour`; override `INTEGRATION_URL` or
`INTEGRATION_EVIDENCE` as needed. It records browser/GPU, viewport, draw calls,
triangles and RAF intervals. RAF intervals include display refresh and are not
GPU execution times. Main merge and the independent visual QUALITY.md gate are pending.
`staragent.site` currently serves another build; this candidate is not deployed.
