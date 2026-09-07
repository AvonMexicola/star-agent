# Creature production pipeline

Use this alongside the [asset production standard](../asset-production-standard.md).
The Pyrebear/Suloher integration and deer gait repair are the worked examples;
read their current QA status before reusing a claimed result. A source checkpoint
is distinct from complete visual/controller acceptance or deployment.

1. Preserve the exact supplied GLB and its hash, bytes, texture, mesh/triangle
   counts, skin/joint names and animation channels. Open the real source in
   Blender; do not diagnose a rig from its filename or a still alone.
2. Inspect rest anatomy, posed skin, skeleton placement, weights, bind matrices,
   limb lengths, stance/swing and foot contact over the complete clip. Separate
   bad bone placement from inappropriate animation. The deer kept its coherent
   skin and bind skeleton and received a new gait; it did not need speculative
   bone relocation or new weights.
3. Fit actual anatomical landmarks in metres. Do not size a deer by its antlers,
   a dog by a curled tail, or any rig by a non-rendering bone-display helper.
   Normalize glTF Y-up, feet at the reference floor and front toward -Z.
4. Correct imported material semantics after inspecting the actual GLB. These
   supplied sources reused albedo as full emission and had metallic/specular
   defaults. Their runtime materials use scene lighting and matte dielectric
   response. Retain authored albedo/UV detail, embed1024px WebP and keep each
   character below20k triangles/2MB where the asset standard applies.
5. Author real joint animation in Blender. An in-place walk's stance hooves must
   travel backward at the intended gaitSpeed; frozen local feet slide when the
   actor moves. Store cycle duration, stride and matched speed. Use bone-local
   deformation, measured contact, restrained torso/head movement and independent
   skeleton instances. Preserve existing good tracks when adding a death clip.
6. A death clip plays once and holds its final pose. Numerical minimum-vertex
   grounding is insufficient: a plated shoulder can hold the entire belly above
   the floor. Inspect broad body contact, relaxed asymmetry and passive head/tail
   posture from front, side and mid-fall. Record intersections and tolerances;
   authored collapses are not ragdolls. Reject visibly braced/hovering poses.
7. Reimport the actual exported GLB in Blender. Compare source/runtime skin and
   bind buffers, clip start, limb lengths, key counts and dense phase samples.
   Keep exact hashes, editable.blend, repeatable scripts, motion receipts and
   representative before/after evidence. Disable.blend1 authoring backups.
8. Runtime actors share geometry/materials but clone skeletons and mixers.
   Dispose each clone's skeleton textures when unloading. Match animation rate
   to measured gaitSpeed, subtract world origin in JavaScript doubles before GPU
   transforms, use the scene's depth/material conventions and bound population.
9. Spawn and locomotion checks serve different purposes. The hostile example
   uses broad2m/5m canonical-terrain spawn clearance, then body-sized footing
   (.5/.95m dog; .75/1.6m bear) while moving. Both retain the same terrain,
   biome/slope rules and swept structure/hull obstruction. The wide spawn margin
   originally stopped a dog5.7m short of a player despite safe local ground.
10. Connect real gameplay transactions. Existing ammo must authorize a shot
    before damage, and both eye and muzzle rays must respect nearer obstacles.
    Pause/focus/online gates belong to the existing input/authority model.
    Use the real health/inventory store; do not silently revive or discard cargo.
11. Test a complete physical controller journey, including entry, interactions,
    aiming/action, outcome and return to play. Separately inspect keyboard/touch,
    responsive UI, continuous animation and actual game lighting. A debug camera
    or studio is useful evidence, but does not prove physical controller travel.
12. Record failures and corrections, exact final source/asset identity, browser,
    backend/resolution, scoped independent scores and unverified limits. Publish
    a coherent branch checkpoint for the integration steward. Keep local merge,
    public PR/release and deployment status separate; preserve unrelated work.

The reusable studio fixture is `scripts/fixtures/creature-rig.html`; its browser
check is `scripts/creature-rig.spec.js`. Hostile gameplay and actual-terrain motion
checks are `scripts/fauna.spec.js` and `scripts/fauna-art.spec.js`. Test videos,
traces and raw screenshots go in ignored test-results, never the source commit.
