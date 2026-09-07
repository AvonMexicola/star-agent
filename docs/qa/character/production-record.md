# Expedition character production record — 2026-09-07

Status: implementation and source build complete; independent reviews and final
performance acceptance are being collected. Not merged or deployed.

Worktree/branch: `feat/character-fidelity`, based on `feat/flight-options` at
`3e0f3b9a5087f3231cfcf3f193a3cec300cfbf7d` (PR 38). The shared controller checkout
was not modified. This explicit stack retains the camera/equipment integration
that is absent from the older visual-fidelity base named in QUALITY.md.

## Delivered scope

The new suit is 1.85 m tall, 62,177 triangles, 24 body joints, 26 runtime animation
clips, two independent glove morphs, and two 2K WebP PBR maps. Its current GLB is
8,496,328 bytes (SHA-256 `04f849bafe513f8e2a817895307a2751ebed85f76d4ef81cd0ae793ddc5911fa`). The prior male suit was 10,379 triangles, one 1K map and 14 clips.
Source exports, concept, task IDs, build instructions and hashes are in
`assets/character/expedition-v2/`; the runtime manifest includes the final asset.
The user explicitly requested higher geometry/texture fidelity, superseding the
older 20k / 2 MB / 1K character asset limits. Scene budgets remain separately
reported; a larger asset is not an automatic performance approval.

The opening and playable character share one rig. Third-person equipment uses the
same Equipment/inventory/heat/ammo instance as first person, with palm-calibrated
sockets, analytic arm IK, glove closure and an upright barrel. The old overlong
rifle stock was shortened without moving its barrel or grip points. Camera rays
aim at the crosshair and muzzle rays still check obstructions. Mining reach and
distance readouts use the physical player's 8 m reach in either perspective.

Gameplay uses locomotion, jump, equipment aim/fire and a controller-menu Wave.
Injury input is wired and unit-tested; no gameplay damage source exists yet.
Ladder, seat, injury, reload and pickup clips have animation hooks and studio
controls. Physical ladders, new seating interactions, magazine reload mechanics
and damage sources are outside this animation/character slice.

## Checks completed

- Final combined `npm test`: **508 passed**, zero failures, cancellations or skips
  (32.54 s), including the integrated hip correction. The initial concurrent
  run cancelled the moon module with an unresolved-promise report; its isolated
  15 tests passed, followed by full successful reruns.
- Real GLB CPU tests verify all 26 clips, canonical spine order, non-emissive PBR
  material, glove-only morph displacement, closed animation loops, relaxed idle,
  seat/gesture state transitions and no arm stretching. Both palms remain within
  3 mm of their grips across idle/walk/run, -55° to +65° aim, body rotation and
  camera rebasing at astronomical coordinates.
- Production Vite build passes. Its existing large Three/GLTF shared-chunk warning
  is recorded; no build failure is concealed as a clean browser result.
- Production studio browser check passed on Chromium / ANGLE / AMD Radeon 860M,
  at 1440 × 900 and 390 × 844: previous/new suit, locomotion, seating, ladder,
  rest, wave, all three held items from hands/side/back and during running. Zero
  browser errors or warnings. The first run caught a favicon 404; fixed and rerun.
- Controller-only production journey passed: opening → walking → equip/fire
  rifle → first/third-person switching → flashlight → Menu/D-pad/A Wave → return
  to rifle aim → physical hatch/ramp/chair boarding → launch and gear retraction.
  It verifies real ammo consumption, visibility and bone attachment, plus a held
  RT across menu closure/wave without a stale shot. Input was injected W3C standard
  Gamepad data; debug state was read for steering/assertions. No physical Xbox or
  Bluetooth validation is claimed. The first test awaited transient idle after
  waving rather than resumed rifle aim; corrected and rerun.
- Fixed tour captured orbit, coast, forest, highlands, hangar and a physically
  boarded cockpit at 1600 × 900, plus existing map at desktop/phone sizes. This
  uses controlled terrain camera fixtures, not a controller journey. Its record
  reports renderer, position, draws, triangles and RAF cadence. RAF is not GPU time.

## Failed checks and fixes

1. Meshy rig export emitted the color map and dropped ORM: restored the exact
   UV-matched source map and physically lit material.
2. Reversed Meshy spine labels broke upper-body masks: canonicalized the chain.
3. Travel and open loop endpoints: removed navigation-owned travel and closed seams.
4. Raised idle arm: preserved breathing/stance with relaxed arm rotations.
5. Wrist-only rig left open fingers around weapons: authored sparse glove morphs.
6. Legacy offsets, reachable-wrist approximation and long rifle stock: calibrated
   actual palms, solved both arms with bounded reach, and retracted the stock.
7. Render origin updated only after IK: made `setRenderOrigin` immediately visible
   to grip/muzzle queries; the astronomical-origin regression now passes.
8. Third-person range readouts used camera distance: physical reach is now separate
   from the crosshair ray, including inspection/streaming decisions.
9. Duplicate opening/player material allocations: both phases now share one rig.
10. Temporary filesystem quota interrupted a build: relocated only this worktree
    to a persistent project directory and rebuilt successfully.
11. Sandboxed Chromium server/startup failed: reran the authorized checks with
    normal Chromium permissions. The first independent Claude request timed out
    in the sandbox; the network-enabled retry is tracked below.
12. First GPU timer attached to a capability-probe canvas and returned no valid
    samples. The harness now selects the actual game/studio canvas, rejects
    software rendering and disjoint queries, and waits for completed GPU results.
13. Shared `/tmp` quota also interrupted evidence and a later texture build.
    Browser profiles/evidence now use the home cache; the builder uses temporary
    files beside its retained source, removes them in `finally`, and rebuilds.
14. Initial EVA test expected the camera beside an obstructing ramp. The revised
    physical route moves into clear space. It then exposed the actual disabled
    EVA camera button; the shared button/menu/controller route is now enabled.
    The complete exit → third-person fire → first-person → coast/brake → physical
    ramp return/chair journey passed in 54.1 seconds, with zero errors/warnings.
15. Disabled character culling drew the full mesh into distant shadow maps.
    A verified mesh-local animation envelope permits culling. Every vertex of
    26 clips is sampled, with closed gloves and additional equipped IK poses;
    the authored clip radius is at most 1.44 m inside a 1.75 m envelope.
16. The remaining sun depth pass uses a 17,442-triangle index LOD, sharing the
    original skin/morph vertex buffers. Color rendering restores all 62,177
    triangles. Its 1.8 cm clustering cells have a conservative 3.12 cm maximum
    rest-position displacement. The actual GPU check confirms 44,735 fewer
    rendered triangles, without a second visible mesh or material allocation.
17. An independent art review scored the first candidate 3.83/5, identifying
    loose-looking support grips and an ambiguous seated front view. Glove curl
    radius changed from 38 to 31 mm, the fingers close their original spread,
    and grip-centre calibration follows the smaller curl. The rifle is raised
    toward the shoulder/visor. No individual finger bones are claimed.
18. The review's ladder image was captured during the preceding stand-up clip.
    Both capture harnesses now wait for the requested state and a finished
    transition. A targeted sequence records continuous playback plus side views;
    the side view shows the seated thighs correctly. This is an evidence fix,
    not a replacement of the Meshy sitting animation.
19. The separate Cees-requested thigh correction was integrated from source by
    its owner, then retained in the final current-source rebuild. Hip pivots
    move 17 cm to the flexible seam; offline leg retargeting preserves the
    source ankles within 3 mm, with no additional runtime solver or geometry.
    Its scoped review is 4.2/5; see [the retained handoff](../character-leg-rig/README.md).
    That score does not substitute for the complete character recheck.
20. The first independent visual attempt exhausted its turn budget after a
    temporary-storage quota failure. The home-cache retry completed the captures
    and produced the preserved review. A later combined browser process exited
    143 before completing; its orphaned preview held port 5319. Only those two
    test-owned preview processes were stopped before the final retry.

## Independent functional review and disposition

The exact [Claude Opus review](functional-review.md) independently passed 501
tests and the build, checked binary/source hashes and exercised real-rig grip,
gesture and firing behavior. Its initial verdict was ready for visual review,
with specific fixes required before merge. Disposition by original finding:

1. Shifted the shoulder camera and its look target laterally so the reticle clears
   the torso while the whole character remains framed. Physical eye is unchanged.
2. Added the complete controller-only EVA journey described above. This uncovered
   and fixed the disabled HUD camera button, beyond the earlier CPU coverage.
3. Movement cancels full-body hit reactions; repeated health ticks cannot restart
   a playing hit. A real-GLB regression checks both running and repeated damage.
4. Corrected gameplay injury claims here and in the source record.
5. Seed health only from the first explicit gameplay input. Health-free opening
   updates cannot manufacture a hit when loading a saved injury; regression added.
6. Final evidence/HANDOFF are collected below; old `/tmp` paths in the preserved
   report describe the reviewed candidate, not final delivery locations.
7. Recorded the scoped user-authorized asset budget in QUALITY.md and the manifest;
   the props intake page now reads that per-asset budget.
8. Held barrel and fired bolt use the same camera target/range endpoint. The muzzle
   query still prevents shooting/mining through a nearby obstruction.
9. Named legacy required clips replace the index cutoff. The new GLB declares all
   26 required clips in its asset metadata, checked against the actual export.
10. Consumers now use the public `gestureActive` getter.
11. Existing licensed fonts are compressed to WOFF2 (264,848 bytes total, from
    690,268 TTF bytes), served locally with unchanged typefaces/weights. Source,
    licenses and rebuild command are retained. No external startup stylesheet.
12. Tool/HUD activity is explicitly gated by `nav.openingActive`. Opening captures
    now run without changing `nav.enabled`, and assert the tool is hidden.
13. Removed the unreachable `_set` branch. Retaining ~49 MB of Meshy exports is
    intentional under the asset production standard; none is shipped from public/.

The [functional recheck](functional-recheck.md) passed 80 targeted tests and
accepted the seven rechecked fixes and the shadow-index mechanism. Its two
remaining low-severity robustness findings were then fixed: a malformed optional
shadow accessor degrades to full-detail shadows, and malformed/empty required-clip
metadata falls back to the legacy contract. Real-GLB fault injection covers both.

The exact [initial visual review](visual-review-initial.md) is retained. Its
floating first-person weapon observation describes the presentation the user
explicitly requested; first-person arms are outside this change. Back-surface
detail and additional skin-weight polish remain recorded art follow-ups.

## Review and performance

Final GPU measurement and independent Opus visual rubric are being collected.
The final acceptance status below will distinguish any remaining scene budget
overage from a passing execution of the measurement harness.

Latest AMD Radeon 860M / ANGLE OpenGL ES 3.2 measurements, Chromium production
build, 1440 × 900, render scale 1, 90 valid GPU queries after warmup:

| View | Draws including shadow passes | Triangles | GPU median ms | CPU callback median ms |
| --- | ---: | ---: | ---: | ---: |
| Hangar, first person | 551 | 759,336 | 10.81 | 13.20 |
| Hangar, third person rifle | 566 | 882,259 | 10.38 | 16.00 |
| Hangar, third person pistol | 556 | 858,161 | 9.77 | 16.70 |
| Hangar, third person cutter | 561 | 873,737 | 9.90 | 14.80 |
| Studio, new suit | 3 | 62,273 | 0.91 | 0.70 |
| Studio, previous suit | 3 | 10,475 | 0.76 | 0.70 |

All affected hangar draw/triangle counts now meet the 600 / 900k limits. Native
resolution GPU time exceeds the strict 10 ms target in first person (10.81 ms)
and with the third-person rifle (10.38 ms). Before the final glove/hip correction,
the same harness measured 9.31 / 10.10 / 9.85 / 10.01 ms for first person, rifle,
pistol and cutter respectively. Other desktop GPU tasks were active; these are
measured observations, not isolated benchmark approval or proof of a universal
frame rate. The harness passed data validity and zero browser errors/warnings;
that is separate from strict timing acceptance. A controlled laptop performance
gate remains pending. Studio renderer counters exclude the shadow pass; the game
explicitly accumulates its full frame, including shadows and postprocessing.


## Leg deformation correction integrated — 2026-09-07

Cees's jump/crouch report was reproduced: the original hip joints sat inside
the upper thigh armour. The source correction and its regressions are now
applied to this worktree and survive subsequent hand-shape rebuilds. See
[the leg correction record](../character-leg-rig/README.md) and its independent
Opus review (4.2/5, bounded acceptance). It preserves upper-body tracks and
source foot paths; minor hip/knee weighting and full continuous-motion art
acceptance remain. Source handoff commit e3c7494.

This addendum supersedes the original asset size/hip-rig facts above. Latest
observed build is 8,496,328 bytes, SHA-256
04f849bafe513f8e2a817895307a2751ebed85f76d4ef81cd0ae793ddc5911fa.
The prior scene performance observations are historical, not a new final gate.
508 unit tests and production build passed after integration; studio/controller
production recheck passed 2/2. Latest leg/real-character tests pass 10/10 after
the owner's subsequent glove rebuild. Whole-character merge/deploy still follows
the owner's existing acceptance process.
