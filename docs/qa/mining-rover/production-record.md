# Meridian Burrow M-04 production record

Candidate 10 has completed recorded controller, keyboard and native touch
journeys at the checkpoints below. Independent review gives the isolated native
asset **4.04/5** and keyboard motion **3.8/5**; the explicitly mixed-evidence
six-criterion mean is **4.00/5**. These are scoped results, not product or release
approval. Cees gates draft [PR #66](https://github.com/AvonMexicola/star-agent/pull/66).

The final [desktop footer review](review-footer-10.md) closes the instrument
clipping finding: the full status line is visible above its bezel after physical
boarding. The cargo-ceiling chase-camera contraction and whole-scene
triangle-budget caveat remain recorded limitations.

## Player result

Burrow is an enclosed four-wheel mining rover carried by the current flyable
30 m Atlas. Choose **Atlas + Burrow / Selene** in the development launcher, or use
`/?dev=1&intro=0&ship=atlas&start=moon&rover=1` on a development-enabled build.
Leave Atlas's pilot seat, walk aft along the starboard aisle, and approach the
rover's port door. Board, lower the lift, drive onto the terrain and aim at an
existing mineral deposit. Collected ore enters the persistent 96 kg rover bin.

| Action | Keyboard | Standard controller | Touch |
| --- | --- | --- | --- |
| Board / exit | F | X | Cabin |
| Drive / steer | W/S, A/D | Left stick | Drive pad |
| Aim cutters | Arrow keys | Right stick | Aim pad |
| Sustain both beams | T | RT | Mine |
| Brake | X | LT | Brake |
| Atlas lift | G | Y | Lift |
| Ore bins | I | View | Cargo |

Both cutters use the actual named emitter tips and independently ray-test the
existing world. Ore and cuts use the existing atomic rock/inventory transaction;
obstruction, full storage or a failed save cannot grant unsaved ore. Continuous
charge lasts 120 seconds and recharges in 30 seconds. Those durations are
simulated-time unit checks, not two-minute browser holds.

## Frozen asset and runtime identities

Metres, +Y up, −Z forward. World poses remain JavaScript doubles; rendered geometry
is relative to the camera. [layout.json](../../../assets/mining-rover/layout.json)
owns dimensions and mechanism anchors.

| Measurement | Export / runtime contract |
| --- | --- |
| Closed, straight wheels | 4.65 m long × 3.02 m wide including fixed steps × 2.50 m high |
| Steering sweep | 3.232 m conservative width; ±0.52 rad front steering |
| Wheels | Four; 0.52 m radius; 2.16 m track; 2.70 m wheelbase; ±0.22 m suspension |
| Atlas main lift | 8 × 10 m; floor Y 0–4 m; cargo ceiling Y 9.2 m |
| Initial parking | Atlas local [−1.6, 4, 5], facing aft to unload forward |
| Candidate 10 | 21,570 triangles; 2,177,260 bytes; four embedded textures |
| GLB SHA-256 | `88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f` |
| Layout SHA-256 | `2d3912564b0cd16d212ae47fa528d475cc93a2941dcbdce10cbbad3b1e231a38` |
| Final bounded PR runtime | `e7e297bfaa26b97d25c3078c443d35083eabaffc` |
| Matching implementation checkpoint | `64420998146b45871e441fbfff0c5c2bfe660b2d` |

The strict [09→10 delta](review-candidate-10-delta.md) finds all 21,570 world and
per-node local triangles, UV/corner attributes except normals, hierarchy,
mechanisms and layout identical. Only rod/cap normals and the ORM image change.
The previous finite clearance probes therefore remain applicable to the same
asset geometry: 762 sampled closed-cabin side rays, wheel/link poses, cutter rays,
lamp attachments and boarding-eye clearance. This does not prove global
watertightness or a continuous full-body sweep.

Pressure/life support, seated driving hand IK and multiplayer rover authority
remain outside scope. Ore persists; rover position and charge reset with the
development session. No rover save version, database schema or multiplayer
protocol change is part of this feature.

## Recorded input journeys

| Input / archive | Identified checkpoint | Completed scope | Runner result |
| --- | --- | --- | --- |
| Injected Gamepad, `full-03` | Candidate 09 | Atlas pilot exit → physical boarding → lift/unload → mine → ore transfer → reload → Atlas pilot → launch and flight carry | PASS, 2.5 min |
| Playwright keyboard, `input-02/keyboard` | Candidate 10, bounded `84860a6` / implementation `f92a3a2` | Physical boarding, terrain drive, mining/save, cargo and native focus gates, lift return and Atlas pilot | PASS, 2.9 min |
| Native Chromium touchscreen, `input-04/touch` | Candidate 10, final bounded `e7e297b` | Native drive/aim/actions, mining/save, held-contact cargo and focus gates, reload and Atlas pilot | PASS, 4.9 min |

The keyboard and touch endpoints are landed. Flight carriage is established by
the separate complete controller journey, which keeps the rover within 0.02 m
of its parked local pose. Its modal/focus/disconnect/replacement/unsupported-map
checks require fresh input before cutting resumes.

Keyboard and touch records each contain all seven route milestones, stable
before/after source hashes, an unoccupied/stopped rover aboard Atlas with its
door closed, and empty page-error, console-warning and failed-request arrays.
The controller record also has zero page/console errors or warnings. The touch
cargo gate retains the same captured mining pointer through open/close; the
native focus test records trusted blur/focus. Document visibility remained
`visible`, so this is focus-loss evidence, not a hidden-page transition.

| Endpoint | Cut time | Remaining stored ore |
| --- | ---: | ---: |
| Controller, after tested ore transfer | 11.4163 s | 0.693861 kg |
| Keyboard | 11.5494 s | 1.686878 kg |
| Touch | 6.8663 s | 1.178567 kg |

All use seed 7291 and Chromium 151.0.7922.173 on AMD Radeon 860M through ANGLE /
radeonsi krackan1 ACO / OpenGL ES 3.2, DPR 1. Controller and keyboard viewports
are 1440×900 with a 1152×720 render buffer at scale 0.8. Touch is 390×844 with
351×759 at scale 0.9. These are automated inputs on real browser controls;
physical controller, physical phone and human listening tests are not claimed.

The bounded PR suite passed **697/697 units at 84860a6**. The final e7e297b
production build passed in **4.49 s**, retaining the inherited large-chunk
warning. Earlier implementation-tree totals of 711/714 are historical checks on
a different integration surface, not the final bounded PR count.

Hosted [run 34155938323](https://github.com/AvonMexicola/star-agent/actions/runs/34155938323)
at PR head `1c5a7fc` passed source and multiplayer checks, but its browser smoke
failed after loading the game: it expected the legacy Ship dialog
`#controller-menu` when Menu now opens Contracts. The fixture adopts the reviewed
`4a6f7f0` assertion for one open Contracts screen and one visible, focused router
selection. Dialog closure, held-stick suppression, unchanged position and neutral
rearming remain checked. This branch still has the flat five-target map, so its
existing target-selection loop is retained. Syntax, repository and whitespace
checks passed locally for this test-only correction. Runtime and candidate 10
assets are unchanged.

The correction at `a3328179c1309e3bc61049569d180398ef6f4d3f` then passed hosted
[run 34158011227](https://github.com/AvonMexicola/star-agent/actions/runs/34158011227).
All five required jobs passed: browser **7 min 12 s**, multiplayer **1 min 24 s**,
source **3 min 9 s**, plan **26 s**, and verify **3 s**. The feature integrator confirmed
PR #66's passing checks on 2026-09-07 at 20:16 UTC. No local browser rerun was
performed for this correction; the hosted smoke result adds functional CI
evidence, not hardware performance or product approval.

## Independent review and remaining limits

The exact [native review](review-visual-10.md), [keyboard/motion review](review-game-10.md)
[final phone follow-up](review-touch-10.md) and [desktop footer closure](review-footer-10.md)
are archived unchanged.
The asset reviewer inspected producer-run captures and recorded motion; this is
independent evidence review, not a second operation of the browser journey.
The earlier runtime review closed seven findings, excluding physics/mining
modules that the same reviewer authored from its claimed independent scope.

Native scores are silhouette 3.8, materials 4.0, native lighting 4.1, cohesion 4.2,
and represented physical function 4.1: mean 4.04. Keyboard motion adds 3.8,
giving `(20.2 + 3.8) / 6 = 4.00`, with no assessed item below 3. Native fixture
lighting is not a whole-game or all-platform lighting verdict.

- The old [settled keyboard cockpit](candidate-10/keyboard-cockpit-footer-before.png)
  retains the partly buried MFD footer. Runtime e7e297b raises its baseline; the
  [final desktop cockpit](candidate-10/desktop-cockpit-footer.png) closes the finding.
  A single physical boarding/capture passed with no errors or warnings. The old
  phone image still records how its panel obscures the physical instrument.
- During lift ascent, the chase camera contracts abruptly under the cargo ceiling
  (keyboard video PTS 147.8–148.52 s). It retains the rover and deck attachment;
  the visible contraction is the reason motion remains 3.8.
- The keyboard Atlas-pilot endpoint records 470 draws / **1,155,054 triangles**,
  above QUALITY.md's nominal 900k cockpit target. Touch records 375 / 983,046;
  controller flight records 335 / 885,874. These include the surrounding scene,
  are not rover-only costs, and do not establish sustained frame time or FPS.
  Shared GPU use and the frozen user preview prevent a hardware performance claim.
- Candidate 10 is within the rover brief's 30k-triangle / 4 MB asset limits.
  The static phone fixture shows containment rather than fine material quality.
  The actual phone inventory and controls pass their recorded composition scope.

## Curated evidence and reproduction

The [evidence index](candidate-10/README.md) identifies six new, byte-identical PNG
copies and the original local archives. Videos, contact sheets and raw journey
JSON remain outside the repository. Earlier controller captures remain:
[twin cutters](04-twin-cutters.png), [ore transfer](05-ore-bins.png),
[lift return](06-reloaded-atlas.png), and [flight carry](07-carried-in-flight.png).
The old ore capture's “Nomad cargo” label is historical; the final
[phone inventory](candidate-10/touch-ore-bin-dialog.png) shows “Atlas cargo”.
[Iteration history](iteration-history.md) preserves failed runs and controls.

For a fresh owned QA checkout, see the [asset README](../../../assets/mining-rover/README.md)
and [portable review fixture](../../../scripts/rover-review/README.md). Allocate
the browser/GPU window before running. The existing **5417 user preview stays
frozen**; **5419 is the separate final candidate**. Do not rebuild the user's
5417 session while reproducing checks.

```sh
# Run against the allocated candidate preview; no build/service restart implied.
TMPDIR=/path/short ROVER_URL=http://127.0.0.1:5419 ROVER_OUTPUT=/path/qa/controller npm run test:browser -- -c scripts/mining-rover.config.js
TMPDIR=/path/short ROVER_URL=http://127.0.0.1:5419 ROVER_INPUT_OUTPUT=/path/qa/inputs ROVER_INPUT_RETURN=1 npm run test:browser -- -c scripts/mining-rover-inputs.config.js
```

`ROVER_SMOKE=1` stops after unloading and cannot establish mining or return.
Full keyboard/touch routes require `ROVER_INPUT_RETURN=1`.

## Delivery boundary

Implementation remains on `feat/meridian-mining-rover`, based on `4d38827`.
The bounded `review/meridian-burrow` PR is stacked on gameplay-menu PR #60 and
excludes unrelated fitted ship-weapon/account integrations. PR #66 remains draft
and Cees-gated; the final runtime/docs follow-through still awaits the steward's
push and combined integration. No public merge or deployment is claimed.
