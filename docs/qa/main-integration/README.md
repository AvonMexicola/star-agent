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

The full unit suite and production build passed before the last focused controller
fixes. Combined browser checks found duplicate shop controller polling and an
outdated two-body map focus expectation; these are being corrected and retested.
Final results, review verdict and screenshots will be recorded here before merge.

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
GPU execution times. Publication and the independent QUALITY.md gate are pending.
`staragent.site` currently serves another build; this candidate is not deployed.
