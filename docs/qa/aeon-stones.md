# Aeon loose stones

Scope: replace Aeon's pale decorative pebble mesh with seeded, textured, finite
basalt stones that feed the existing construction recipes. Retain the existing
Selene/Pyre deposit identities, planet floor, save schema and raw resource IDs.
Use several silhouettes and sizes, readable stone grain, a planted base and
stable materials on newly cut faces. No new downloaded assets or dependencies.

## Implementation and material provenance

`src/mining/aeon-stones.js` generates bounded spherical cells keyed by planet
seed. Six rock fields contain their dimensions in local metres. Dry land and
slope tests use the canonical terrain; the existing deterministic forest records
exclude trunks from the stone footprint. The former decorative stone layer in
Vegetation is removed.

`LooseStones` batches distant silhouettes and exact voxel meshes nearby. The
45–65 m transition uses complementary dither, with a 220–280 m outer fade.
MiningField retains its three regional worker limit. A prepared rock replaces
its matching near mesh; saved cuts retain their own mesh and collider after
worker eviction, including after reload. Untouched proxies are solid, can be
inspected and cannot award cargo while preparing. CPU doubles are rebased before
writing instance matrices.

The material reuses the repository's ambientCG Rock030 CC0 albedo, OpenGL normal
and roughness maps. See [the original manifest](../../public/materials/outcrops/manifest.json)
for source, licence, sizes and hashes. No new texture payload. Albedo is sRGB;
normal/roughness are linear. Projection repeats every 0.85 m in rock-local space;
the full instance/object frame rotates normal detail correctly. The material
keeps a dark procedural fallback when the shared optional map set is unavailable.

Mine with the existing cutter (3 / controller D-pad right, then hold T / RT).
The tool identifies these as **Basalt stone · concrete feedstock**. Field recipes
consume basalt to make aggregate or binder. Eight kilograms of aggregate and
two of binder make ten kilograms of the existing dry-concrete game material.
Those recipes remain the existing tier-zero gameplay abstraction, not a physical
cement manufacturing model. The shared sixteen-edited-deposit save limit and
inventory capacity apply. Saved edits are never evicted to refill a stone.

## Verification ledger

- Initial feature: all 655 unit tests and the production build passed.
- Four dedicated invariants cover seeded identity, actual forest/ground agreement,
  exact mesh handoff, proxy collision/targeting, worker eviction/reload and finite
  extraction through the complete concrete recipe without mass creation.
- Candidate 02: both production Chromium checks passed in 3.1 minutes, with no
  console/page errors. Actual settled views were captured at 6, 55 and 100 m.
- Candidate 02's controller-only journey used explicit Menu transit, real landing,
  seat/hatch/ramp exit, stick movement/aim, RT extraction of 2.01 kg basalt, native
  recipe actions, backpack and return to play. Menu/focus/disconnect transitions
  suppressed held RT until neutral. No position, resource, loadout, or orientation
  grants were used in that journey. The complete 10 kg concrete conversion is
  verified by the finite-material unit test; the browser journey processed its
  mined basalt into aggregate and binder.
- Visual inspection of that run found one stone enclosing a tree trunk. Placement
  now excludes the actual seeded trunk records. The corrected runtime was merged
  with dev base `7bd4bd5` as `dfc0a3b`; all 661 unit tests and the production build
  pass. Served bundle: `main-DDZBAB0u.js`.

Final corrected checks passed separately: settled 6/55/100 m renders in 1.3 minutes,
and the complete controller journey in 1.7 minutes. The controller physically
recovered **2.098 kg basalt**, processed 1 kg each into aggregate and binder,
verified the exact 0.098 kg remainder, opened the backpack, and returned to play.
The recipe screen also fits 390×844. Both runs recorded zero page/console errors.
The revised controller fixture sweeps in the viewing plane: its earlier local-X
sweep repeatedly aimed through the same exhausted borehole on the differently
rotated stone. That failed check recovered 0.57 kg and is retained; no extraction
rate, quota, saved state or assertion threshold was changed to pass it.

| View | Evidence |
| --- | --- |
| Previous decorative pebbles, same camera | [Before](aeon-stones/before.png) |
| Corrected seeded basalt stone | [After](aeon-stones/after.png) |
| Approach | [55 m view](aeon-stones/approach.png) |
| Physically excavated stone | [Controller mining](aeon-stones/controller-mined.png) |
| Processing actual recovered ingredients | [Recipes](aeon-stones/controller-recipes.png) |
| Recipe screen on a narrow viewport | [390×844](aeon-stones/controller-recipes-phone.png) |

Capture environment: Chromium 151.0.7922.173, AMD Radeon 860M / ANGLE OpenGL ES
3.2, render scale 1. Scene views: 1600×900; controller: 1440×900, DPR 1.
The final approach sample reported 524 draws / 1,748,324 triangles; the controller
sample reported 587 / 1,756,950, including renderer passes. No isolated hardware frame-time budget,
physical gamepad or whole-world art acceptance is claimed. Other agents began
GPU work during parts of the run despite the shared coordination notes; these
counts and correctness checks are not isolated timing measurements.

Failed evidence remains outside the repo in the unique baseline/candidate run
directories. The first baseline retained an open but hidden dev launcher and
captured a frozen scene; it is rejected. Candidate 01's shaders rendered, but the
isolated preview's API proxy returned 500 because port 8084 was stopped. Its
controller fixture then incorrectly assumed the build obstacle adapter exposed
MiningField directly. The corrected tests close the launcher, wait for settled
terrain, use the running 8087 memory API, and derive steering targets from the
same pure descriptor function. No application code was changed to hide those
fixture failures. No Chromium startup crash occurred in these runs.

Run after `npm run build`:

```sh
MULTIPLAYER_SERVER=http://127.0.0.1:8087 npm run test:browser -- -c scripts/aeon-stones.config.js
```

Use a writable home-disk `TMPDIR` when this machine's `/tmp` quota is exhausted.
Set `STONE_QA_OUTPUT` to a unique evidence directory and coordinate the shared
GPU before launching. `STONE_QA_URL` selects an already running preview;
`STONE_QA_BASELINE=1` captures its prior visuals and skips new-stone gameplay.

Independent functional/rubric review remains pending. This record establishes
bounded implementation and observed checks, not production art sign-off.
