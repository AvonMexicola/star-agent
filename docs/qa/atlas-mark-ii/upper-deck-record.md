# Atlas upper-deck construction pass

2026-09-06. Bounded continuation of draft PR #30 in
`/tmp/star-agent-atlas-mark-ii`, `feat/atlas-mark-ii`. Root owns this pass;
the shared runtime and other agents' station/equipment work are separate.

## Brief

The crew quarters had a side partition and furniture but no explicit forward
or aft room walls. Flat surfaces and thin bunk dividers left the upper deck
reading as an unfinished residential interior. The player should instead see
an enclosed, manufactured spacecraft compartment from standing eye height,
with structural frames and equipment attached to the pressure envelope.

Keep the approved outer silhouette, nacelles, metre scale, twin ramps, crew lift,
pilot approach and side-door circulation. First complete view: the crew aisle,
including its end wall, bunks, ceiling and wall liners. Extend the same frame
family into the central passage, mess and bridge after that view is coherent.

## Source and construction

`assets/atlas-mark-ii/upper_deck.py` authors original closed extruded profiles in
Blender. No new external asset or generated concept is used. The existing
ivory/graphite/petrol PBR palette and reference provenance remain in the parent
design record. This pass changes mesh construction, not the renderer or light rig.

- Explicit crew fore/aft walls and outboard liner; forward galley closure.
  These mesh dimensions come directly from the runtime collider JSON.
- Continuous chamfered crown webs, metal shoulder seams and attachment feet.
- Enclosed berth backs, shaped end shells, inset service plates, privacy tracks
  and lighting coves for the six bunks. Tracks are visual fittings, not animated curtains.
- Removable ceiling cassettes, wall access panels, captive latches, vents and
  replaceable aisle soles. The aft environmental assembly is visual equipment;
  no life-support simulation is implied.
- Matching fixed collision for room ends, liner, structural feet and aft equipment.
  Ceiling shoulders sit above the standing envelope; doorway and lift openings remain clear.

The parametric builder rebuilds the packed `.blend`, all three exported GLBs and
their measured manifest. Existing contact shading, named moving pivots, material
export factors and metre-scale UVs remain in that pipeline.

## Candidate corrections

The first export (`800276e7…`) rendered successfully on AMD Radeon 860M / ANGLE GL
at 1440 × 900 with no page/console errors. It showed a reversed aft label and a
small vertical gap between frame feet and crown webs. Both were corrected.
`first-upper-deck-crew.png` retains that intermediate evidence;
`before-upper-deck-crew.png` records the original room.

The first unit run had two failures. A ray intended to check the new outboard
liner hit an older removable service panel first; the test now explicitly targets
the crew structural subtree so the old panel cannot conceal an absent liner.
The galley collision envelope also reduced the required 1.60 m capsule-centre
aisle to 1.49 m. Its new access plates were inset and thinned, restoring the
existing minimum clearance rather than lowering the assertion.

The physical browser journey now walks to the last berth, meets the solid aft
wall, and returns through the same doorway before continuing to the galley.
Export tests independently sample the full bunk aisle at three lateral positions
and four body heights, in addition to room-wall rays and runtime collision checks.

A supplementary central-corridor view exposed a pre-existing coplanar junction:
crew and mess door-jamb end faces exactly matched partition end faces. The jambs
now project 20 mm past those ends. Their full physical envelopes are authored;
the resulting side doors retain 0.96 m for capsule-centre travel. An exported
geometry check measures depth separation between the metal jamb and the wall.
The final evidence below includes this correction.

## Final validation

Hero SHA-256: `659b54660075ff1adb759d1c1141dfbc06c8aba6302190766756cec016fc4a1f`.
426,504 triangles, 157 mesh batches, 13 materials, 10 textures and 38,890,964 bytes.
The upper-deck pass adds 27,896 triangles and three batches; exterior mesh bounds
remain unchanged. LOD measurements and complete hashes are in `manifest.json`.

- `npm test`: 181 passed, zero failures.
- `npm run build`: passed; existing large-chunk warning remains.
- `ATLAS_HARDWARE=1 npm run test:browser -- -c scripts/atlas-mark-ii.config.js`:
  all four cases passed in 1.6 minutes, with no captured page/console errors.
  The extended physical journey passed in 1.1 minutes at 480 × 300.
- Final seven inspection views: 1440 × 900, DPR 1. Phone: 390 × 844.
  Injected controller case: 720 × 450. Chromium 151, AMD Radeon 860M,
  ANGLE GL / OpenGL ES 3.2. Timing is suite duration, not a frame-rate measurement.
- Local preview service on port 5250 was active; its served GLB hash matches
  the final hero above.

`final-crew.png`, `final-galley.png` and `final-bridge.png` show the final asset.
`upper-corridor.png` and `crew-forward.png` are additional inspection camera views,
not proof of physical travel; `crew-aft-walk.png` comes from the real input journey.

## Acceptance boundary

Final measurements and validation results are recorded in the parent README and
manifest. This remains the standalone authoring studio, not a new asset installed
in the flying fleet. LOD visual acceptance, the ship budget, gameplay integration
and independent visual review remain pending. No FPS or physical Xbox-controller
claim is made. Keep PR #30 in draft.
