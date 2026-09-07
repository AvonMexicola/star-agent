# Aeon fauna — browser verification ledger

Reviewer/operator: GPT-6 Astra. **Verification completed:** both new-species viewer cases, Tideback physical encounter, corrected Mallow physical encounter and the settled/flashlight bear recapture have passing receipts. Failed trials remain recorded below. This is bounded functional/appearance verification, not full art-motion, hardware-controller or performance acceptance.

## Frozen targets

The root released these targets for verification on2026-09-07; coherent source/assets checkpoint is `c8162f951f4b97843672a2dd0331eca95f8f5e6d`, with no runtime change from the frozen build. I independently checked all three hashes in `test-results/aeon-fauna-build` before browser execution:

| Target | Identity |
| --- | --- |
| Aeon production preview | `http://127.0.0.1:5517`, root-owned frozen output `test-results/aeon-fauna-build` |
| Main bundle | `main-582ZOfRE.js`, SHA256 `eedcaeeb614300e736eef4105f2ef7f07f78784ba4cf8fdaab202db6c8da7f31` |
| Tideback | `ba95f093ffa9703670456457ce299d0865051503b137eb15ebd5de3cd619de9e` |
| Mallow grazer | `78598117a9a47bbc0eebedd708a8248a1a1e4a61b5923e9bb6e7640a16f41bb9` |
| Neutral Three.js rig viewer | Existing5515 dev viewer, final source assets above |
| Pyrebear settled-terrain recapture | Existing frozen5516 preview; bear30afc5a9459538fbab2954a38369f42df25ecfde032d7b819f60bf1e1f8639e6 |

The test operator owns only QA fixtures and this record. Runtime, asset export, server promotion and build mutations are root-owned. No shared5178/API/database changes are authorized by this verification.

## Scope and reproduction

Run sequentially after acquiring the shared browser/GPU lane:

```sh
npm run test:browser -- -c scripts/creature-rig.config.js -g 'Tideback|Mallow'
npm run test:browser -- -c scripts/aeon-fauna.config.js
npm run test:browser -- -c scripts/fauna-art.config.js -g 'pyrebear:'
```

Use unique `AEON_FAUNA_OUT` / `FAUNA_ART_OUT` directories under ignored project `test-results` to retain failed receipts. Configured Playwright temporary files use the project drive rather than the quota-limited system `/tmp`.

The Aeon tests inject a standard Gamepad and use physical landing, cabin/ramp traversal, walking and aiming inputs. They do not establish physical controller hardware testing. The bear art fixture deliberately positions/follows the camera; it is separate from the physical controller journey. Its prior successful script produced a visually rejected corpse capture while terrain was unsettled. That receipt must remain retained: a functional kill pass is not visual acceptance.

CPU fixture review: syntax checks passed for the three affected specs. Added separate evidence directory overrides, species-specific failure state receipts, and explicit backend plus settled-terrain metadata for the art capture. Existing application behavior was not changed.

## Queue record

At18:36UTC the frozen identity was ready, but power's reserved first browser window was active as hostPID3186871. The latest steward note then placed social's remaining two cases after power. No fauna browser was launched during these prior claims. Exact acquisition/release and completed results will be appended when execution occurs.


## First execution results

Acquired18:55:45UTC after checking WORLD's completed final.log (1pass1.8m) and an idle host process inventory, with root authorization to proceed without waiting for missing operator paperwork. This is observed completion, not a claim that the world operator posted a release. No concurrent Playwright job was present. Shared HANDOFF records the acquisition.

The two `aeon-rig.spec.js` viewer cases **passed in12.9s** (Tideback7.1s, Mallow5.1s). Actual receipt browser: Chromium151.0.7922.173; backend ANGLE AMD Radeon860M / OpenGL ES3.2. Both JSONs contain `errors: []` and match the exact final asset hashes above. They load walk/death clips, play, verify final death time holds and capture desktop1280×800 plus mobile390×844. These are neutral Three.js viewer checks, not planetary encounters or FPS benchmarks. I personally inspected both final corpse desktop/mobile screenshots; the crown repair and relaxed Tideback limbs remain visible, and Mallow retains its broad body and lowered head. No gross skin tear is visible in these stills.

Raw evidence: `test-results/aeon-fauna-evidence/final-c8162/*-studio-{walk,death,mobile}.png` and `*-studio.json`; Playwright videos/results remain in `test-results/aeon-rig-final-c8162`. They do not overwrite the earlier deer artifacts. Videos exist but have not yet been independently watched as continuous motion.


## First controller trial — physical route failure retained

The first Tideback controller case failed after3.2minutes at the90-second approach limit; Mallow did not run because the job stopped after one failure. Saved player position was ship-local[-1.5656,1.8594,4.2598], just outside the rear hull boundary z4.28, while the animal lay ship-local approximately[-22.722,2.667,-138.762]. No shots/hits/bites occurred. The screenshot shows the player still at the ship/ramp, not an animal AI failure. Direct travel from rear ramp z13 toward the animal beyond the nose intersects the parked hull.

The fixture now derives a side waypoint from actual `layout.flightBounds` plus2m clearance, then walks physically beyond the nose before calling the existing approach helper. Both waypoints use controller axes, without teleport or collision/runtime changes. First failure screenshot/video/trace are retained in `test-results/aeon-controller-final-c8162`; state JSON remains in `test-results/aeon-fauna-evidence/final-c8162`. Retry artifacts use distinct `route2-c8162` directories.


## Physical Tideback pass and Mallow retreat failure

With the physical hull detour, Tideback **passed in2.8minutes**. The actual shore route remained calm before a rifle hit, then provoked retaliation, received one bite, killed the animal with four ammo-authorized hits, held its corpse and verified held-trigger/menu neutral-input safety. Receipt: count1, hits4, shots4, bites1, kills1, errors[]. Player remained on foot outside the ship. I inspected the peaceful and defeated actual-shore images: water/sand habitat is visible, the shell/material is recognizable, and the close corpse view retains the crown backing. That close image crops the lower body, so it does not independently establish full corpse contact or motion.

Hardware receipt: Chromium151.0.7922.173, AMD Radeon860M ANGLE GLES3.2,1280×800 viewport, automatic renderScale.8 and1024×640 drawing buffer. These are functional/appearance checks, not1440×900 scale1 performance measurements. Input is injected Gamepad, not physical hardware. Evidence is under `test-results/aeon-fauna-evidence/route2-c8162`; corresponding trace/video output is `test-results/aeon-controller-route2-c8162`.

Mallow reached the animal and landed one real rifle hit (360→330HP), retained provoked=false, inflicted zero bites and left player health100. Its case failed after2.8minutes because retreat displacement was0.450947m rather than the required>0.5m. Final state was flee/speed0. An isolated CPU replay of the recorded pose proved the next canonical footing returned null before canMove was called; all sampled points remained GRASSLAND, but the combined footprint slope crossed the existing12° limit. This is distinct from the earlier parked-hull fixture error. Failure screenshot, state, video and trace remain in the route2 directories. Root is preparing bounded alternate-direction flee steering while retaining terrain/obstacle guards and the same distance assertion. No successful Mallow encounter is claimed at this point.


## Updated grazer build and settled bear receipts

Root froze a bounded alternate-direction flee correction as commit `95c8056`: bundle `main-BExzhz0l.js`, independently checked SHA256 `63f37b482fce33dba24de21b777b1778cfb09689adc767d810f475b17014715f`. Assets remain unchanged. It tries a bounded set of headings while preserving existing canonical-footing and swept-obstacle gates; the >0.5m browser assertion remains unchanged. The grazer-only repeat uses separate `flee-fix-63f37b` evidence. The previously passing Tideback case is not rerun because this correction is confined to non-retaliating flee behavior.

The first bear recapture attempt failed before loading in3.3s because5516 refused the connection. This is an unavailable-preview failure, not an art failure; its trace is retained in `test-results/fauna-art-settled-c8162`. Root restored the exact old preview without rebuilding. The subsequent bear-only test **passed in1.3minutes**, writing `test-results/fauna-evidence/settled2-c8162` and `test-results/fauna-art-settled2-c8162`. Before/final terrain receipts both show Pyre ready=true,LOD17,pending0,morphing0,errors[]. Final1280×800 render buffer is scale1 on the same AMD860M backend.

I personally inspected that settled final frame. It is substantially darker under the converged terrain shadow, preventing confident ground-contact judgment. No visual pass is inferred from the script result or the absence of the old obviously clipped silhouette. The dark receipt is preserved. Root authorized one further bounded recapture with the actual player flashlight (L), without changing gamma, materials, asset offsets or terrain.


## Completed result and release

| Final check | Result | Runtime identity and scope |
| --- | --- | --- |
| Tideback + Mallow neutral Three viewers | 2passed,12.9s | Final ba95f093 /78598117 assets; walk/death playback, hold and desktop/mobile rendering |
| Tideback physical controller encounter | Passed,2.8m | c8162f9 /main-582ZOfRE; calm→provoked hit/bite→kill/hold; physical hull detour; menu input safety |
| Mallow physical controller encounter | Passed,2.6m (job2.7m) | 95c8056 /main-BExzhz0l; calm→hit→retreat beyond unchanged0.5m assertion; no retaliation; menu input safety |
| Pyrebear settled terrain with player flashlight | Passed,1.4m | Existing old5516 build, bear30afc5a9; L key enables actual suit light, readyLOD17 before/final, zero pending/morphing |

The final Mallow receipt records one shot/hit, animal330HP, provoked=false, player100HP, zero bites, four active fauna and errors[]. Player remains on foot outside the ship. I personally viewed the actual grassland peaceful/retreat images: broad animal silhouette, hide markings and grassy habitat remain readable. Grass obscures parts of the feet; these images do not certify detailed hoof contact. Final1280×800 viewport uses automatic scale.8 /1024×640 drawing buffer on Chromium151/AMD860M ANGLE GLES3.2. The test confirms a >0.5m retreat after injury without relaxing the assertion. It does not claim a Mallow death/kill encounter; its death animation was checked in the neutral viewer.

The final bear test uses the real L-key flashlight and asserts `navigation.flashlightOn===true`. Its JSON records flashlightOn=true, errors[], and both pre-action/final terrain ready=true,LOD17,pending0,morphing0. The final1280×800 buffer is scale1. I personally viewed `settled-flashlight/pyrebear-motion-3.2.png`: the complete lowered head and forelimbs are visible above the terrain, unlike the original broadly buried corpse. This resolves the severe burial finding for the settled, flashlight-lit frame. Nearby dark terrain and a brightly lit weapon remain in the capture; this is not universal night-scene lighting approval. Sparse screenshots and the existence of recorded video do not establish continuous animation quality.

All owned Playwright jobs had exited at **19:22:11UTC**; an escalated host process check found no active Playwright job. Shared HANDOFF records GPU release. No further browser work was run. No shared service, asset or runtime mutation was made by this QA operator. Runtime flee steering was fixed and frozen separately by root. Root-reported baseline full101 unit files passed atc8162; the95c8056 follow-up has its focused simulation/source checks. Root subsequently ran final host `npm test` after95c8056: **748individual cases across101files passed**, zero failures/skips,36.707s. This is explicitly root-run; the sandbox runner's earlier101 count described file wrappers, not the individual case total.

Remaining scope limits: injected Gamepad rather than a physical device; mobile rendering rather than a complete native-touch animal encounter; sampled visual judgment rather than independently watched continuous video; no cold/warm/traversal GPU/CPU budget benchmark; no broader-world acceptance. Source, geometry and gameplay improvements should remain labeled with those limits.
