# SA-GARAGE-001 — compound garage checkpoint

Status: gameplay/browser checks complete; ready for a labeled local development
checkpoint. Local integration receipt pending. Owner: Codex compound garages. Branch `feat/compound-garages`,
base `23ca619`, combined runtime `2e686db` including checked Transport `f294a98`.
Private preview5674 / memory API8674; no public
release or shared service change. Final independent art, hardware and performance
acceptance remain pending.

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
- `npm run test:browser -- -c scripts/compound-garages.config.js`: **5/5 pass**,
  7.4min, on frozen `9b6a7de` (runtime `2e686db`). The 2.7min injected standard
  Gamepad journey lands Nomad, physically walks out, reaches the console, deploys
  Burrow, boards via its door/steps, drives all wheels onto terrain, opens its ore
  bins, exits and walks back. Keyboard entry and native390 touch retrieve it again.
  Actual empty-bin mass0 and partially used charge are unchanged by retrieval;
  this browser case does not claim nonzero cargo transfer. Held-trigger checks
  cover dialog close, real focus changes and device disconnect/reconnect.
- All four fixed-time/seed world views render with zero page/console errors or
  warnings. The production build in that focused run passed. Runtime/source stayed
  clean and at the same SHA throughout. [Validation identity and metrics](validation.json).

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

Additional freight compatibility checks: `tests/cargo-tractor.test.js` and
`tests/server-station-market.test.js` passed. The full server-transport file then
aborted in Node26.7.0 `InternalCallbackScope::Close` (SIGABRT, host PID1799927,
2026-09-08T20:25:11UTC), coincident with creation of its isolated SQL fixture.
Coredump metadata shows the runtime assertion; the root cause remains unresolved.
No OOM entry was found and no fixture PostgreSQL process remained. No alternate
Node binary was installed. The relevant in-memory case passed separately with
`--test-name-pattern='^server binds contract'`, actual new garage layouts and
disk-backed TMPDIR (2.05s). That result does not relabel the SQL attempt as passed.
The checked freight dependency retains its owner's prior passing SQL evidence.
No application or system configuration was changed to hide this failure.

## Images and remaining acceptance

The author inspected all four actual compound views and the desktop/phone journey
images. [Aeon](aeon-compound.png) and [Selene](selene-compound.png) show the clear
drive-through openings, workshop fittings and supported ramps. Their same-camera
[before](../outdoor-floodlights/aeon-approach.png)/[after](aeon-approach.png) keeps
the large pad and other buildings fixed. [Pyre](pyre-compound.png) and
[Miasma](miasma-compound.png) retain the existing night exposure; the outer garage
faces and long driveway are dark at the distant art camera. Better night approach
lighting remains a presentation follow-up, not an accepted art result.

The [desktop console](garage-deployed.png), [phone console](garage-phone.png),
[physical cabin](garage-cockpit.png) and [terrain exit](driveway-exit.png) record
the real journey. This is author inspection, not an independent rubric score.

Chromium151.0.7922.173 used ANGLE AMD Radeon860M/OpenGL ES3.2,1440×900 and390×844,
seed7291 and epoch1788876000000. Same-camera draw calls before→after are
Aeon2713→3076, Selene2345→2591, and Miasma2841→3104; full values for every world
are in the JSON. Existing scenes already exceed the budget and the additional
kit adds draws. The isolated FPS snapshots are observations under shared-machine
load, not a controlled benchmark or performance acceptance. No physical controller
or formal independent visual review is claimed.

Existing nondefault seeds still generate four sites; detailed driveway traversal
uses seed7291. Session-only pose and charge behavior is in the
[player route](../../compound-garages.md). The focused runner and private API are
closed; raw logs, state and retained failed videos remain in the owner worktree.
Next: serialize the source-only local FF over checked Transport `f294a98`, preserve
the dirty journal byte-for-byte and record served-source/API checks. No garage
runtime is yet claimed as served by the shared5178 preview.
