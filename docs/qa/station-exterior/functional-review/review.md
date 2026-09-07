# Station exterior: independent functional review

**Result: PASS for the bounded CPU functional gate on the final geometry checkpoint.** The initial candidate was rejected for two concrete defects. Both are corrected and independently rechecked below. This is not an art, browser, controller-journey, shader, or frame-performance approval.

Reviewer: independent Astra/Codex agent `/root/nomad_cutter`, 2026-09-07. Root owns the station implementation. The reviewer did not edit station source/assets, use a browser/GPU, change Nomad PR46, or merge anything. Source was read from the isolated `feat/station-exterior` worktree based on `8576e994b8e03d8987ac487fd72e609062bbae04`.

## Reviewed identity

| Export | SHA-256 | Bytes | Assembled triangles | Mesh primitives |
| --- | --- | ---: | ---: | ---: |
| Rejected initial hero | `079f7262e992ffaadd56c4ad16c201b69bb23f0664cf19ff2e692312444334a8` | 3,697,952 | 96,660 | 22 |
| Corrected intermediate hero | `75de315329c3f634db38fab80dbe60ccc7f93cf1fa04d7f9784d86c63600f14c` | 3,700,520 | 96,704 | 22 |
| Final hero | `5b39b183030d529a710de0b2dad308a36a8e597b067d3061d82f01bb721b76e6` | 2,600,828 | 96,704 | 22 |
| Final distant render variant | `ec98e225e57bbadb18c4c4567614bab2c5a23694e16effeeba99a4ce0b5ffdcb` | 1,206,036 | 54,944 | 22 |

The final two-level payload totals **3,806,864 bytes**. Its lower level reduces triangles; the mesh draw count remains 22. These are CPU geometry/visible-traversal counts, not a measured whole-scene GPU cost.

The final integration probes recorded stable before/after hashes:

- `src/station-exterior.js`: `1b046eca240c9eb9f578baf7cb1bc201f54341dfef261f1413bd6bf38a9450ad`
- `src/station-complex.js`: `5ec628d677fde906eeea964ccda71fd49915aef9cf82ee2ba9d8c25290919db7`
- `src/station-collision.js`: `7113833f80c76e6c0a3fab1af134fb90a417e8d850a895b8ab244a371691a978`
- `src/station-finish-materials.js`: `b884d30727758aeb8cd1072870630337a6a0d322dc21540ce2fff703ed8af717`

## Closed finding F1 — new supports entered the occupied concourse (P2)

The initial builder placed the side supports at `(±24,-16,0)` with dimensions `(5,24,46)`, and the braces terminated at `(±24,-10,0)`. Eight actual triangles in `FixedStructure_ExteriorSteel_Geometry` intersected the hub interior `X[-22,22], Y[-8,1.5], Z[-19,19]`. The affected initial triangle indices were 13280, 13281, 13302, 13303, 13362, 13363, 13382 and 13383. All twenty bay interiors were clear.

A ray from `(20,-6.25,4)` along +X hit new opaque steel at `X=21.50144198`, before the existing transparent glazing at `X=21.94000053`. The support intruded about 0.499 m into the declared room. The existing walking sweep still stopped the player's centre at `X=21.31000076`; adding the 0.25 m capsule extent overlapped the new steel by about 0.05856 m. The defect therefore blocked a window and disagreed with the established walking collision. The old vertex-only room test missed it because the crossing faces' corners lay outside the room's Z limits.

Root corrected `blender/build_station_exterior.py:215`: supports now centre at `(±26,-20.5,0)`, braces end at `(±26,-12,0)`, and a shallow cradle lies below the occupied floor. Root also replaced the vertex-only test with triangle/Box3 SAT coverage.

**Independent closure:** both intermediate 75de and final 5b39 exports have zero physical fixed-triangle intersections with all 21 occupied volumes. The final hub ray no longer hits the new structure; the original glazing and walking result are unchanged. The distant export independently also clears all 21 volumes. The final check uses actual decoded, transformed GLB triangles and an interior epsilon of 0.0001 m.

## Closed finding F2 — empty named assemblies erased the legacy fallback (P2)

The initial loader accepted a parseable scene containing empty groups named `FixedStructure`, `RingTemplate` and `HubShellDetail`. `StationComplex` then reported `ready=true` and `exteriorStatus='geometry-review'`, with **zero exterior meshes and empty fixed/ring BVHs**, after removing the complete legacy exterior.

Root added nonempty mesh and finite assembly-bound validation in `src/station-exterior.js:29`. Replacement is constructed and its collision built before the legacy group is removed in `src/station-complex.js:102`.

**Independent closure:** the same empty-named scene now reports `ready=true`, `exteriorStatus='legacy'`, an explicit empty/incomplete-assembly error, **93 legacy exterior meshes**, and nonempty fixed/ring BVHs. A malformed distant variant preserves a valid authored hero and its physics instead of replacing it with an empty LOD.

## Other independent functional evidence

- **Room and approach clearance:** the fixed physical triangles clear the hub and every berth. Sixty swept approach probes cover all twenty bays at centre and ±8 m lateral offsets, using a 36 m wide, 18 m tall, 66 m long envelope. All are clear of the new fixed structure. Those approaches deliberately stop before entering the original bay; supplied station tests separately cover departures and the retained walking aisles.
- **Moving joints:** actual triangle/triangle SAT found zero intersections between the final fixed structure and either rotating ring at 24 angles, every 15 degrees through a revolution, with opposite rotation signs: 48 ring poses. The hollow rotor, central fixed torque tube and outboard support arrangement therefore pass these sampled positions. This is a representative-angle check, not a continuous swept proof.
- **Ring identity:** all seven RingTemplate meshes in the final hero exactly match the rejected hero's position, normal and colour buffers, index buffers, decode matrices and material names. Grain UV storage is the intentional exception. The final geometry was nevertheless rerun through the complete 48-pose probe.
- **Render/BVH transforms:** the final hero passed 30 ring poses across the opening frame, a tilted station frame and a distant camera origin `(25e9,5e8,-7e9)`. Actual mesh vertices, mapped through their rendered matrices back into canonical ring collision space, agreed with the production triangle-bound BVH. Maximum bounds-component roundtrip error was **0.000004051703 m**, against a 0.00005 m tolerance. This measures JavaScript-double transform agreement; it does not measure packing error or GPU precision. The manifest separately reports maximum position quantization error of about 0.03847 m.
- **Sharing:** the twenty bays retain one shared collision tree. Both hero rings share geometry/materials, with independent transforms; the two LOD rings also share their geometry. Ring collision currently builds two equivalent trees rather than sharing one. That is a possible memory improvement, not a functional failure.
- **LOD integration:** eleven distance transitions tested the exact 4200/3800 m hysteresis boundaries, return from the 600 km render horizon, and transition through the 140 m concourse-shell handoff. The rendered ring matrices match their hero counterparts. All three collision-tree references remain unchanged, and identical core/ring sweeps return identical world hit points across switches and rebases. Physics contains exactly the hero's **40,284 fixed + 26,160 + 26,160 ring triangle bounds**, with no distant geometry added. Raw exported grain UVs are absent as intended; the runtime reconstructs finite UVs for all hero/LOD meshes.
- **Readiness and fallback:** stubbed optional-loader failures exercised failed hero, failed distant variant, delayed hero followed by distant-load failure, and empty named distant assemblies. Every completed fallback retains twenty bays and nonempty physics. During a delayed optional load, readiness stays false and the legacy exterior remains installed; it becomes ready after the chosen exterior and physics are installed. No network request was made by these probes.

## Reproducible checks and evidence

All checks ran CPU-only with Node **v26.7.0**. The final named suite passed **22/22** tests, zero failures/skips, in 8.292 s:

```sh
node --test --test-isolation=none tests/station-exterior.test.js tests/station-complex.test.js tests/station-floor.test.js tests/station-opening-complex.test.js
```

The reviewer also ran `probe.mjs`, `transforms.mjs` and `final-integration.mjs` against frozen final exports. The scripts and raw records are retained locally in `/tmp/star-agent-station-exterior-functional/`, together with source/export hashes and initial/final snapshots. `probe-rejected.json` preserves the rejected room/fallback evidence; `probe-first.json` preserves its complete initial rotation scan. `probe-corrected-75de.json`, `probe-final.json`, `transforms.json` and `final-integration.json` preserve the successful reruns. Raw generated reports and duplicate exports are local evidence, not requested repository additions.

Two reviewer-harness failures were corrected without production changes: sorting rounded bounds after a distant-origin roundtrip mismatched near-boundary primitives, so the transform probe now validates canonical matching once and preserves primitive order; and an initial LOD assertion incorrectly assumed 20 rather than 22 mesh draws. The original scripts are retained as `transforms-first.mjs` and `final-integration-first.mjs`.

The result covers the current exterior collision, room clearance, sharing, detail switching and fallback contracts. It does not replace the independent visual review, real Chromium rendering/shader checks, keyboard/touch/controller journeys, final material workflow or performance gate owned by the production lane. No browser, GPU, FPS or art-quality result is claimed here.
