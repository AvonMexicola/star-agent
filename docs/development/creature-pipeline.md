# Creature production pipeline

Use this alongside the [asset production standard](../asset-production-standard.md).
The Pyrebear/Suloher encounters, deer gait repair and Aeon wildlife intake are the worked examples;
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

## Further evidence from the Aeon intake

The Tideback shell looked closed under the source's bright emission. Neutral
materials exposed a true crown opening. Boundary-edge inspection isolated38rim
vertices; a small inner membrane can repair that opening without flattening the
raised armour or replacing the original primitive. Retain the source and record
added topology, UV/material choice, skin weights, draw calls and all-clip checks.
Source preservation is not a reason to keep a demonstrated visual defect.

A generic mammalian death template is not universal. Tideback shell vertices had
up to22% weight on a proximal leg; rotating that joint peeled the crown. Holding
proximal supports and folding distal segments preserved the shell. The Mallow
barrel belly also depended on proximal legs. Its first torso-only support probe
lowered the body too far. Probe the actual weighted underside, not chosen bone
names alone. A distal IK branch flip then required an exact two-segment solve
with a continuously transported bend direction; per-step skin displacement
caught the defect before publication.

When a creature appears buried in game, compare its deformed vertices against
the canonical world before changing its anchor. Pyrebear's rejected screenshot
showed severe burial while Pyre still had63pending patches and28morphs. Actual
CPU-skinned vertices at the saved world pose penetrated canonical terrain by at
most19.7mm, within the declared30mm authoring tolerance. The coarse rendering
was the leading explanation. Pause the staged encounter while its terrain
settles and retain both failed and corrected evidence; never invent a second
floor or raise the animal blindly to disguise streaming terrain.

Browser fixtures must observe real transactions at the time they occur. A
Suloher bandage test sampled health after another bite and falsely failed;
observing the healing/bleeding-clear state during the action fixed the race.
The art fixture also sent a weapon key before the tool became active, leaving
the mining cutter selected. Wait for readiness and assert the equipped weapon
before actual ammo-authorized firing. These are fixture corrections, not excuses
to replace the physical controller journey with debug actions.

The Aeon physical-route fixture exposed another useful test error: after leaving
the rear ramp, steering straight toward a creature behind the ship drove the
player into the hull. Preserve the failed route, then derive controller-driven
waypoints outside the measured flight bounds before approaching the animal.
Do not weaken collision or teleport the player to make an encounter test pass.
The corrected Tideback route passed with the exact same runtime and asset hashes.

For the Aeon additions, run `scripts/aeon-rig.spec.js` through the creature-rig
config and `scripts/aeon-fauna.spec.js` through the Aeon-fauna config. Keep new
receipt directories distinct from earlier failures. A shared GPU queue should
name its owner and bounded job, record actual completion, and transfer the next
reserved slot promptly; authoring, unit checks and documentation can continue
while another browser owns that slot.

An injured grazer then exposed a real runtime constraint: direct retreat reached
the canonical slope ceiling after 0.451 m. Replaying the saved player/animal
pose against the real sampler proved the stop occurred before collision. Keep
the terrain limit; add a bounded search for legal neighboring steps and test
both that exact failure and fully obstructed movement. Record that local
steering can require a wider turn and is not a global pathfinding guarantee.
