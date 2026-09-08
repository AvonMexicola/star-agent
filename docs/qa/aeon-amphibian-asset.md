# Tideback / Aeon amphibian asset record

Development candidate for the user-supplied amphibious creature on Aeon beaches.
Runtime label: **Tideback**, asset id `aeon-amphibian`. This record establishes
source preservation, Blender authoring, export budgets and sampled deformation.
Habitat, temperament, gameplay, controller journeys and game-renderer acceptance
belong to the integration owner. No swimming animation or aquatic locomotion is
claimed from the source appearance.

## Source and anatomical fit

Exact source: `assets/creatures/aeon-amphibian/source/aeon-amphibian-walking.glb`,
8,138,996 bytes, SHA-256
`a5954d75022d8f764bfa7da404dd69757428012c2258c4265ea392f0f800fd84`.
The user supplied this GLB through Downloads; no new generation, hosted request
or credit spending occurred. Generation prompts/settings were not supplied.

Actual inspection found a broad teal plated shell, compact underside, four
jointed paddle/claw feet and small eye stalks. The generic quadruped rig has
27 joints and one 1s/81-channel forward walk. The source uses one material,
one embedded PNG and14,204 triangles. The source anatomy does not determine
hostility; that is a separate gameplay decision.

Root approved **0.80m phase-zero shell-crown height**, not shoulder height. The
full grounded walk envelope is1.065m wide ×0.842m high ×1.312m long. Feet-envelope
collision half-extents are0.532638m ×0.656133m. Coordinates are glTF Y-up, metres,
facing -Z, base-centred. A373.300856 uniform wrapper normalizes the tiny supplied
scene. Its translation is[0.115307689,0.007988278,0.086708497] and yaw is180°.
Source transforms, exact wrapper and sampled envelopes remain in the manifest.

## Preserved data and corrections

All original mesh position/normal/UV/joint/weight/index buffers, inverse binds
and81 source walk channels remain byte-identical. Original primitive, accessors
and skin definitions are retained; explicit additions are described below.
A 241-key wrapper translation grounds the supplied walk. Horizontal source root
span is negligible; the vertical wrapper track is an authored grounding correction.
Recommended motion is0.7m/s at the native1s clip (measured planted-foot estimate
0.734m/s). The runtime owns matching mixer rate to actual travel speed.

The source albedo was also full-strength emission, metalness was omitted
(glTF default1), and specular-color factor was2. These were corrected to
non-emissive metal0/roughness0.85. The existing albedo/UVs remain; the exact PNG
is retained and converted to1024²WebP at quality88. No maps or anatomy were
invented. This is matte material cleanup, not a physical wet-skin simulation.

`death` is a1.6s Blender-authored one-shot with a held final pose. The shell,
head, tail and proximal limb joints keep their mutual source pose; only the
lower two segments of each limb fold as the body settles with a late14° lean and asymmetric relaxed front paddles.
Both clips have82 node/property channels, including wrapper translation.

## Failed probes and local shell repair

1. The mammalian collapse template independently lowered chest/head and bent
   proximal limbs. It opened shell seams and penetrated mixed chest/leg skin
   by84mm. Rejected views are retained under `source/rejected-*.png`.
2. Freezing chest/head reduced the problem but did not preserve the shell:
   crown vertices carried up to22% proximal backleg weight, causing49mm of
   relative plate movement. Distal-only leg folding fixes that source-rig coupling
   without editing source weights. Delaying body settling until the limbs fold
   also removes a45mm intermediate lower-leg penetration.
3. Independent comparison then found a remaining black crown wedge in the
   **original normalized walk**, not newly introduced by the revised death.
   Source inspection's emission/camera had obscured this inherited defect.
   Position-welded topology inspection found124 boundary edges, zero non-manifold
   edges and one 38-vertex upper-shell opening approximately0.328×0.179m.
4. Root authorized a localized underside membrane. The builder authors a39-vertex,
   38-triangle inset backing beneath that exact boundary, with3% rim overlap and
   an inset centre. It copies rim skin weights, averages the centre's four strongest
   influences and reuses an existing teal crown texel/material. Raised shell plates,
   original geometry, original maps and source walking motion remain unchanged.
   This adds one primitive, no material or joint. Source indices/design dimensions
   are recorded in `localizedRepair`; `source/topology-inspection.json` records
   the inspected opening. Earlier rejected, unbacked prototypes are retained. The final44c2 same-pose
   unbacked studio files were overwritten during refresh; they are not retained
   as a paired before/after receipt. Three mistakenly late-copied, mislabeled
   duplicates were detected by independent hash comparison and removed.

## Rebuild and evidence

```bash
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 \
  --python blender/finish_aeon_amphibian.py -- --shell-height .8
```

`--skip-renders` runs numerical/export validation only. The new builder imports
existing exporter utilities in its own process and authors its species-specific
pose/backing locally. It does not edit shared helpers or rebuild other species.
The editable `.blend` is saved from the actual reimported final GLB, with both
clips and the membrane; save-version backups are disabled.

The final studio uses Blender 5.2 Cycles CPU, four threads,12 samples/denoising,
AgX, seed7291,800×600, neutral broad area lights and a floor. Nine labeled WebPs
cover front/side, four walk phases, mid-fall and two final-pose views. These are
**Blender studio evidence, not the game renderer**. Original source inspection
and failed candidates remain distinct.

The builder reimports its emitted GLB and checks241 walk phases,481 dense walk
phases,61 authored/reimported death poses and121 dense death phases. Ground
residuals: walk-0.184 to+0.458mm; death minimum-22.909mm during transition,
final-19.581mm. These small local skin contacts are measured intersections,
not zero-penetration claims. The30mm sampled tolerance does not establish terrain
or continuous physical contact. A 482-vertex upper-shell check reports≤1.60µm
relative motion; limb-length drift≤14.2µm; walk0/death0 skin difference≤9.9µm;
maximum adjacent skin motion21.01mm per13.33ms. Exact data are in
`motion-validation.json` and `deformation-samples.json`.

Blender emitted inherited duplicate add-on registration/missing optional`cattrs`
messages and a World.use_nodes deprecation warning. Its thumbnail write to the
restricted user cache also warned. These did not prevent runtime export,
reimport, editable save or studio output. Process exit/check results are recorded
separately; no personal configuration was changed.

## Current receipt and acceptance

Runtime `public/models/creatures/aeon-amphibian.glb`: **1,119,644bytes /14,242triangles /2draw primitives /1material /27joints**. Embedded1024²WebP.
SHA-256 `ba95f093ffa9703670456457ce299d0865051503b137eb15ebd5de3cd619de9e`.

Source/buffer/rig/deformation checks: passed. Independent Astra review of exact
`b5c84bb…` personally inspected seven exported views and passed the localized
shell repair at4/5: pale inner backing replaces the black wedge, ridge/plate
silhouette remains, and no conspicuous protrusion/reopened gap appears in the
four walk phases or mid/final/side death views. This is a scoped repair pass.
The former resting-like b5c84bb corpse scored3/5. One focused follow-up preserved
that reviewed version under `review/previous-resting-pose/` with its image hashes,
then added a late14° rigid-shell lean, one outward-rolled front paddle and an
opposite tucked limb. Foot goals compensate for their changed orientation.

Astra verified final`ba95f093…` and personally inspected mid/final/side views:
scoped physical readability improved to4/5, with sideways relaxed paddles and a
slumped asymmetric body. The crown backing/raised seams remained sound. The
unchanged source eyes/head still look alert, but no blocking final-pose ambiguity
remained in these stills. This is not an independent continuous-motion, game or
full six-criterion acceptance.
Game, controller, habitat and performance acceptance: integration-owned, not
established by these studio checks. No merge or deployment is claimed here.
