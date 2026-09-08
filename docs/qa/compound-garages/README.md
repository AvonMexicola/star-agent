# SA-GARAGE-001 — compound garage checkpoint

Status: implementation and CPU checks complete; browser acceptance and local
integration pending. Owner: Codex compound garages. Branch `feat/compound-garages`,
base `23ca619`, runtime `96d8bbb`. Private preview5674 / memory API8674; no public
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

- `npm test`:155 test files pass, including existing carrier/rover, settlement,
  floodlight and new garage invariants. This Node invocation reports file-level
  counts; it is not represented as155 individual assertions.
- Six explicit garage tests pass, including driving out to terrain and reversing
  back into all four default-seed garages; wall/closed-door/cargo rejection;
  double-precision contact at25 Gm; unsafe retrieval policy without state mutation.
- `npm run build`: passes. The final sandbox invocation first failed because the
  symlinked Vite cache was read-only; approved normal build then passed7.29s.
  The existing large-chunk warning remains, with no dependency change.
- `npm run check:repo`: passes. `npm run plan:checks -- --base
  origin/dev/all-features` completes; its482-path plan includes earlier local
  commits absent from the remote base. Helpers do not certify gameplay.
- Browser controller/keyboard/native390 journey and four world image comparisons
  are prepared in `scripts/compound-garages.spec.js`, awaiting the shared GPU slot.

Raw CPU logs remain ignored under `test-results/garage-cpu` in the owner worktree.
The first combined focused run exposed a mast/header overlap; moving that one mast
resolved the unchanged geometry test. Earlier wheel probes caught floor contacts
being classified as walls and rocky ramp toes; the support sweep and surveyed flat
spans resolved these, with both drive directions checked. Original probe outputs
and failing focused log were retained, not described as successful attempts.

## Limits and next action

No browser result, independent visual score, physical-controller test or FPS
acceptance is claimed yet. Existing nondefault seeds still generate four sites;
the detailed driveway traversal evidence is for seed7291. Session-only pose and
charge behavior is documented in the [player route](../../compound-garages.md).

Run the one-worker focused browser command through the owner actual-executable
and argument guard after the earlier Transport05 job. Use short disk-backed
`.browser-cache/g` and unique disk-backed evidence; tmpfs is quota-constrained.
Inspect the final images and console diagnostics, fix observed failures, then
record exact candidate/QA heads and integrate the checked development checkpoint
while preserving the shared append-only journal. Shared local preview5178/API8087
currently remains on checked23ca619; no requested garage runtime is served there yet.
