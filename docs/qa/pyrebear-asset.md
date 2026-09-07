# Pyrebear and Suloher dog: animated creature intake

Development candidates for the user's Pyre bear and Miasma predator request.
This record covers source retention, normalization, skin/clip preservation and
Blender studio inspection. Runtime combat, biome spawning, controller support,
actual game captures, performance and independent acceptance belong to the
integration record; they are not established by these studio renders.

## Sources and ownership

Cees supplied two Meshy Walking_withSkin GLBs through Downloads. No new Meshy
job, image generation, API access or credit spending was performed for intake.
The supplied walking clips and authored albedo are retained. Generation prompts
and model settings were not supplied and are not reconstructed as facts.

| Creature | Exact retained source SHA-256 |
| --- | --- |
| Pyrebear | `b6125970f013a62ee02b294308ff4dbf4de6c0e28915efc7d1e18ab0e31d9dd8` |
| Suloher dog | `ef480bbc3142bc9dbb7b620ecfc4bf109a81f56d1dcfb99edabf22ea4592cc0d` |

Source GLBs live in `assets/creatures/<id>/source/<id>-walking.glb`.
Each pack also retains the embedded original PNG, derived runtime WebP,
normalized editable Blender rig, measured intake and sampled deformation data.
Generated `.blend1` backups are disabled. The first bear backup was moved to
`/tmp/pyrebear-authoring-first.blend1`, outside the contribution.

## Rebuild and runtime contract

Run from the repository with existing Blender and ImageMagick:

```bash
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 \
  --python blender/finish_pyrebear.py -- --species pyrebear
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 \
  --python blender/finish_pyrebear.py -- --species suloher-dog
```

`--skip-renders` performs intake and deformation validation without studio work.
`--shoulder-height` overrides the species default; the approved defaults are
1.65 m for the bear and 0.85 m for the dog. The measurement is phase-zero dorsal
skin near the chest joint, relative to the grounded skin minimum. A chest-joint
height would underestimate these quadrupeds' visible shoulders. The dog's long
curved tail and armor plates rise above its withers.

The runtime GLBs are glTF Y-up, metres, facing **-Z**, with a base-centre wrapper.
The skin, inverse bind matrices, bone names and all 81 source joint walk channels
are preserved. The walk is one second and already horizontally in-place.
Use the manifest's `gaitSpeed` to relate travel speed to clip time scale.
Use a skeleton-aware clone per creature while sharing geometry/material/maps.

Each GLB provides **walk** and **death**. Death is a Blender-authored one-shot
(1.8 s bear / 1.2 s dog); play once and clamp/hold its last pose. Its keyed hips,
chest, head, proximal/distal limbs and tail change the actual skin. The creature
surrenders balance, folds its limbs beside the body and settles onto belly/flank support. No attack or idle clip is
claimed. A brief runtime crossfade can accommodate whichever walk phase was
active when the lethal hit arrived.

## Conservative export and material correction

The Blender script imports and measures the real deformed skin. Its GLB writer
then adds a non-animated normalization parent and appends the new motion data.
Every original non-image buffer view is retained byte-for-byte and checked by
SHA-256: mesh positions/normals/UVs, weights, joint indices, inverse binds and walk
samples. Original mesh/skin/accessor definitions and the original walk channels
and samplers are also compared exactly. No decimation, skin flattening, weight
repainting, UV unwrap or remeshing is used.

The shared helper `blender/creature_motion.py` converts evaluated Blender pose
matrices through the imported rest-bone correction into the original glTF node
conventions. This preserves the original walk rather than replacing the whole
rig with a less traceable export. New death samples are actual authored joint
poses, not a runtime whole-mesh roll. Reimporting the resulting GLB and sampling
its deformed skin validates the conversion.

Both sources used their full albedo as an emissive texture, omitted metalness
(which defaults to metallic in glTF), and supplied a specular-color factor of 2.
The source inspections looked self-lit and washed out. Root approved removing
that emission, setting metalness 0 and roughness 0.85, and removing the unusual
specular/IOR overrides. The original albedo/UV artwork stays intact; the only
image processing is a 1024-pixel maximum-edge WebP encode at quality 88.
No normal/roughness maps are invented or claimed. Runtime albedo is embedded and
served locally through `EXT_texture_webp`; there is no hosted dependency.

## Failed probes and corrections

- The first Blender bounds probe included the importer's Icosphere bone-display
  helper, making a nearly invisible creature against a giant inspection frame.
  The source GLB itself contains one mesh. Bounds now use only the actual
  armature-deformed mesh, and the helper is excluded from renders/export.
- The source walk's lowest evaluated skin height changes across phases. A single
  static base left the normalized bear floating by up to roughly 0.15 m.
  A new wrapper translation track cancels the sampled vertical clearance while
  preserving all source joint motion and horizontal in-place behavior. This is
  an explicit grounding correction, not original source root motion.
- Independent review rejected both initial side/back falls: the bear balanced on
  a narrow projecting plate with its rear suspended, and both creatures held
  their feet upward. Rejected stills remain under `review/rejected-side-fall/`.
  These were replaced by a 12-degree leaning forward kneel, broad belly/flank
  support, individually folded limb chains and a low head. The reviewer scored
  both corrected final still poses 4/5. Final exported mid-fall and side
  stills also passed its bounded review: connected limbs, progressive lowering
  and no new gross inversion or plate-balanced support. This does not establish
  continuous motion, game rendering or terrain contact.
- The dog's open lower jaw initially intersected the floor by 17.6 cm after its
  belly settled. A local head contact adjustment relieves the compressed neck
  without floating the body. Its tail is separately lowered and relaxed.
- The bear's first approved-looking kneel concealed 6.2 cm of mixed pelvis skin
  below the floor. Splitting final settling into a 2 cm pelvis movement and a
  separate 4 cm chest movement retains broad support and limits that defect.
- Partially applying inverse kinematics let feet penetrate during the transition.
  The corrected solver reaches each interpolated foot target while smoothly
  changing the bend pole, retaining connected joint lengths and the final pose.
- A 61-key ground curve was exact at its keys but a denser check found about
  1 cm of sole penetration between them. The wrapper correction now uses
  241 keys and is checked at 481 phases; the original joint keys are unchanged.
- A straight outward drape of the upper limbs could push the body upward under
  the ground constraint. That trial was removed; it is not in the final helper.
- Blender 5.2 emits duplicate add-on registration messages during the second
  factory-settings reset and a `World.use_nodes` deprecation warning. These are
  recorded tool warnings; successful runtime reimport and source/buffer checks
  are reported separately. `ALSOFT_DRIVERS=null` prevents this machine's known
  audio shutdown hang for these process-local invocations.

## Evidence and limits

Each pack's `review/` directory contains front, side, four walk-phase, mid-fall,
final-corpse and corpse-side WebPs stamped **BLENDER STUDIO / NOT GAME EVIDENCE**.
The final studio uses Blender 5.2 / Cycles CPU, four threads, 12 samples with
denoising, AgX, neutral broad area lighting and an actual ground plane at 800×600.
The reimported runtime GLB supplies these captures, not the editable source scene.

`intake.json` and the public manifest report source/runtime identity, exact bytes,
triangle/joint counts, dimensions, collision half-extents, walk travel-speed
estimate, death duration/envelope and reimport comparison error. The full walk is sampled at 241 phases and death at 61; denser 481-phase
walk and 121-phase death ground checks are reported too. Sampling does not prove every continuous instant or terrain
contact on arbitrary slopes. The runtime owns body-local terrain placement and
must not derive its floor from these studio fixtures.

## Final measured candidate receipt

| Creature | Runtime bytes / triangles | Width × height × length (m) | Walk speed / death duration | Runtime SHA-256 |
| --- | --- | --- | --- | --- |
| pyrebear | 1,044,532 / 14,331 | 2.176 × 1.835 × 3.211 | 1.5 m/s / 1.8 s | `30afc5a9459538fbab2954a38369f42df25ecfde032d7b819f60bf1e1f8639e6` |
| suloher-dog | 1,101,672 / 14,806 | 1.060 × 1.094 × 1.882 | 1.0 m/s / 1.2 s | `413335683e7f35484637622a4ae203613014f328f46dc7f32eda9071c5ef0f87` |

Both emitted GLBs reimport successfully with one material, 27 joints and 82
unique node/property channels in each clip. The actual original joint buffers
remain identical; new channels are explicitly additive. Reimported walk bounds
agree with the normalized, grounded source within 0.000001 m; death bounds agree
with the Blender-authored poses within 0.000009 m.

- **pyrebear:** 481-phase walk sole clearance ranges -0.817 to 3.907 mm. The 121-phase death minimum is -25.647 mm.
- **suloher-dog:** 481-phase walk sole clearance ranges -0.978 to 3.314 mm. The 121-phase death minimum is -12.599 mm.

The sub-millimetre walk penetration and up-to-four-millimetre positive clearance
are measured interpolation residuals, not claimed perfect continuous contact.
Death deliberately tolerates slight local intersections to keep broad body
support: up to 25.7 mm on the bear's lower-side forelimb and approximately 21.8 mm
under mixed pelvis skin, and 12.6 mm at the dog's jaw/tail contact. These include
skin, not only hard armor tips; they are not zero-penetration claims. The builder
rejects any sampled death intersection deeper than 30 mm. This tolerance does
not establish a physically simulated ragdoll or slopes/obstacles behavior.

## Final motion sampling

`blender/validate_creature_motion.py` samples the actual emitted GLBs at 121
phases and writes each pack's `motion-validation.json`. Run it with the same
headless Blender flags as intake. Limb joint-to-joint distances vary by less
than 0.01 mm; walk-zero to death-zero skin displacement is at most 0.011 mm.
Largest adjacent sampled vertex movement is 42.8 mm per 15 ms for the bear and
74.5 mm per 10 ms for the dog. These are recorded bounds on the sampled motion,
not a claim of physically simulated motion or a full animation playthrough.
