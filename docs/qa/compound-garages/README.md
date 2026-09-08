# SA-GARAGE-001 — compound garage checkpoint

Status: implementation and CPU checks complete; browser acceptance and local
integration pending. Owner: Codex compound garages. Branch `feat/compound-garages`,
base `23ca619`, combined runtime `2e686db` including checked Transport `f294a98`.
Private preview5674 / memory API8674; no public
release or shared service change. A final receipt will replace this pending status.

## Scope and asset provenance

Four existing settlement right-hand buildings become 16 × 16 × 6 m garages. Two
open kit hangar doors provide a drive-through bay, a separate console requests
Burrow and kit foundations/ramps provide an 8 m driveway. The rover, doors, floors,
roof, work fittings and floodlights retain their existing source/GLB provenance.
There is no new manufactured mesh, texture dependency, schema or protocol.

The existing rover gains canonical construction support and conservative body
sweeps. Its four-wheel solver owns grounding and step/slope limits. Carrier support
remains first priority. A checked async `deployAt` adapter validates terminal reach,
vehicle occupancy/motion/carriage, bay solids, ship clearance and the physical port
boarding route before moving the same unoccupied instance. The pilot is never
placed in its seat by a garage request. Ore and charge are not reset.

The large pad, trader, warehouse, settlement IDs and origins are preserved. The
right middle floodlight moves from x22.5 to x22 to clear the taller door header.
Existing mast support and four supported ship landing envelopes pass unchanged
acceptance assertions. Authored flat spans over Aeon and Miasma rocky approaches
precede the descending ramps. Terrain comes from the original canonical functions.

## Validation to date

- Registered `npm test` suite:156 test files pass on `2e686db` with two workers
  (53.58s), including checked transport and existing carrier/rover, settlement,
  floodlight and new garage invariants. This Node invocation reports file-level
  counts; it is not represented as156 individual assertions.
- Seven explicit garage tests pass, including driving out to terrain and reversing
  back into all four default-seed garages; wall/closed-door/cargo rejection;
  double-precision contact at25 Gm; unsafe retrieval policy without state mutation;
  physical cabin entry checked in each destination's orientation.
- `npm run build`: passes. The final sandbox invocation first failed because the
  symlinked Vite cache was read-only; approved normal build then passed7.29s.
  The existing large-chunk warning remains, with no dependency change.
- `npm run check:repo`: passes. `npm run plan:checks -- --base
  origin/dev/all-features` completes; its current57-path plan includes the checked
  transport dependency. Helpers do not certify gameplay.
- Browser controller/keyboard/native390 journey and four world image comparisons
  are prepared in `scripts/compound-garages.spec.js`. Attempt02 reached actual
  controller landing, ship exit, console interaction and Burrow deployment, with
  zero application errors/warnings; the complete journey is still pending.

Raw CPU logs remain ignored under `test-results/garage-cpu` in the owner worktree.
The first combined focused run exposed a mast/header overlap; moving that one mast
resolved the unchanged geometry test. Earlier wheel probes caught floor contacts
being classified as walls and rocky ramp toes; the support sweep and surveyed flat
spans resolved these, with both drive directions checked. Original probe outputs
and failing focused log were retained, not described as successful attempts.

Browser01 reached Chromium but failed before landing: the fixture pressed the two
bumper modifiers on separate frames, rolling Nomad18.339degrees. Its wing correctly
met the pad before touchdown. Both buttons now change in one standard Gamepad
sample; no navigation pose or application landing change. Browser02 then landed,
walked out and deployed Burrow successfully. Its next waypoint crossed the solid
console and stopped at claim-local x25.018,z-2.049. The fixture now walks around
the desk on both outbound and return routes. The original images, state, video
and error contexts remain in `test-results/garage-01` and `garage-02`.

Playwright cleaned the first attempt's output directory and unlinked the open
runner log. Later runs use nested `runner-artifacts` to retain the outer log and
diagnostics. A temporary host quota issue was resolved by archiving this owner's
completed floodlight evidence onto disk, with symlinks preserving its old paths;
no evidence was deleted. Normal and previously approved commands now work without
new permission requests. Combined transport integration retained its multiplayer
settlements; the garage interaction remains explicitly solo.

## Limits and next action

No complete browser acceptance, independent visual score, physical-controller
test or FPS acceptance is claimed yet. Existing nondefault seeds still generate four sites;
the detailed driveway traversal evidence is for seed7291. Session-only pose and
charge behavior is documented in the [player route](../../compound-garages.md).

Run the one-worker focused browser command through the owner actual-executable
and argument guard after earlier ready owners release the GPU. Use short disk-backed
`.browser-cache/g` and unique disk-backed evidence; tmpfs is quota-constrained.
Inspect the final images and console diagnostics, fix observed failures, then
record exact candidate/QA heads and integrate the checked development checkpoint
while preserving the shared append-only journal. Shared local preview5178/API8087
currently includes checked Transport `f294a98`; no requested garage runtime is served there yet.
