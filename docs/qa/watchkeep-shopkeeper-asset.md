# Watchkeep shopkeeper asset intake and export

Prepared from the user-supplied Crimson Outrider biped archive as a stationary female small-arms merchant. The final runtime has one shared mesh, material and 24-joint skin with four independently named idle clips. Running, walking and falling-down remain source-only. No paid generation was used.

## Frozen runtime

- File: `public/models/characters/watchkeep-shopkeeper.glb`
- SHA-256: `808768844ffdc754d04d5017d2a03908f0055ff5e74544624189e12712580914`
- Bytes: 1,898,288; triangles: 19,700; split vertices: 15,357.
- One embedded 1024×1024 WebP, one non-emissive material, four animations, one skin/24 joints.
- glTF metres, Y up, facing −Z. Canonical Idle-15 initial head/hair crown is 1.72 m above boot soles; other poses naturally vary in height.
- Whole-idle bounds: X -0.506516 to 0.551796; Y -0.000011 to 1.739741; Z -0.304151 to 0.301496 m. Envelope width 1.0583, height 1.7398, depth 0.6056 m, including the gesturing hands.

| Clip | Full duration | Original channels | Actual reimport samples | Loop maximum skin endpoint difference |
| --- | ---: | ---: | ---: | ---: |
| idle-04 | 14.000000 s | 66 unchanged +6 corrected | 841 | 0.037 mm |
| idle-06 | 7.433333 s | 66 unchanged +6 corrected | 448 | 0.197 mm |
| idle-07 | 8.800000 s | 66 unchanged +6 corrected | 530 | 0.620 mm |
| idle-15 | 7.033333 s | 66 unchanged +6 corrected | 423 | 0.113 mm |

All source time arrays begin at 1/30 second. Full GLB duration, including that initial held pose, is retained; the exporter does not silently shorten each clip by one frame.

## Source and processing

The exact 57,025,870-byte source archive is retained once at `assets/characters/watchkeep-shopkeeper/source/source-animation-pack.zip`, SHA-256 `d35196badb125d4b74080cf42271cb119c5e0747a80c0c29a35036b5c9f64b1b`. Its seven GLBs share byte-identical geometry and albedo. The four idle files also have identical nodes, skin definitions and inverse-bind matrices. The input has 31,170 triangles and 21,329 vertices, above the 20k runtime target.

Blender's protected collapse pass reduces the body to 19,700 triangles. All 5,294 selected head/hand source vertices have zero measured rest-surface displacement. Body rest-surface error after scaling is at most 7.622 mm, with 95th percentile 1.243 mm. Before the intentional arm correction, a separate comparison of original and serialized reduced deformed surfaces at five phases of all four idles finds a maximum 7.737 mm source-to-derived surface distance. This is a bounded surface comparison, not a claim of unchanged body topology or zero skinning error. UV islands and corner normals are carried through reduction. At most 3.746% interpolated fifth-and-later joint weight is discarded when restoring four influences per vertex; the four retained weights are normalized. The original 24 joints and inverse-bind buffer remain intact.

The imported material incorrectly uses the complete albedo as emission, omits metallicFactor (therefore defaults to metal 1), and supplies specularColorFactor 2. The runtime removes those overrides, sets emission 0 and metal 0, and uses roughness 0.72 for the mixed cloth/leather/protective vest. The original burgundy/ochre albedo and UV layout remain, resized to 1024 and encoded WebP quality 88. No texture was regenerated, painted over or relabeled as original. The protected face is still the source stylized face; there are no new facial-expression, finger or lip-sync bones.

Each idle keeps 66 of 72 original channels byte-identical. The six Shoulder/Arm/ForeArm rotation channels are intentionally corrected at 30 Hz following the user’s resting-posture feedback; their source and runtime hashes are separately recorded. Exact per-track hashes and inverse-bind comparison are in `source-preservation.json`. The only added node is a rigid normalization wrapper; its translation is the only added animation channel in each clip, correcting the sub-centimetre sole-height noise. Arm corrections replace six existing rotation-channel samplers and preserve all local translation/scale channels, all 24 joints and the original inverse-bind matrices. Authored Hips sway is retained because the idles have essentially zero net traveling drift; pinning that sway would introduce foot sliding.

## Grounding and transition validation

The final GLB was reimported and its actual deformed skin evaluated at 60 Hz: 2242 samples across four clips. Sole extrema are -0.0110 to 0.0033 mm relative to floor. The roughly 30 Hz vertical wrapper correction is verified at twice its sampling rate. This is the whole-skin minimum; raised heels and natural opposite-foot motion remain authored, rather than forcing both complete soles flat.

The intended ordered transitions 04→06→07→15→04 were additionally sampled at 40 phases each with 0.65-second local-TRS interpolation and quaternion slerp. The worst floor intersection is 5.58 mm during 04→06; the other transitions remain within 1.11 mm. This small blend contact error is recorded, not described as zero penetration. Transition bounds fit inside the reported idle horizontal/head envelope. Continuous Three.js playback, action scheduling, counter clearance and rendered shadow contact are integration checks, not established by Blender snapshots.

## Evidence and reproduction

`assets/characters/watchkeep-shopkeeper/README.md` gives the complete reproduction commands. The editable `.blend` contains all four actions and the final optimized skinned mesh with packed texture. `review/receipt.json` binds seven neutral studio stills to the exact runtime hash. Source-inspection images are separately labeled and were rendered before material correction; differences in source lighting and view mean they are not a controlled lighting comparison. The stills cover front/back, face detail, and one representative middle pose from every clip. They use Blender 5.2 Cycles CPU, four threads,16 samples,800×900; no GPU/browser capture or FPS claim is made here.

The source archive, per-entry intake, original-motion inspection, optimization report,20-phase pre-retarget posed reduction comparison, arm-correction receipt, per-channel source/runtime hashes, full final deformation samples, crossfade samples and runtime manifest form the asset ledger. Logs, extracted duplicate GLBs, temporary derivations, Python caches and Blender backup files are excluded from the release. Browser verification and independent visual review are tracked by the integration owner; this document does not assert those passed.

## Historical independent review and loader cross-check (6360429f candidate)

For the previous 6360429f candidate, Astra inspected all seven stills against the source reference: identity/silhouette 4/5, with face, auburn hair, goggles, vest/holster and proportions retained; no gross skin tearing or collapsed limb was demonstrated. Material finish scored 3/5 because one uniformly matte material reduces separation between goggles, armor and cloth. Tiny dark marks on the vest were not established as mesh openings from the available images. These limits remain visible and are not converted into a claim of full visual acceptance.

The integration owner independently loaded that historical GLB through Three.js GLTFLoader and the actual merchant animator for 1,149 sampled poses over 38.2667 seconds, including all four transitions. Reported sole range was−5.560 mm to+.123 mm, agreeing with the Blender blend analysis, and minimum measured counter clearance was .50698 m. This is a CPU runtime/binding cross-check; browser rendering, player journey and performance remain separate integration evidence.


## User-requested articulated resting-arm correction

The user identified that the supplied idles held the arms backward and outward, with retracted shoulders. World-joint inspection confirmed wrists 10–17 cm behind the upper-arm roots. The previous 6360429f runtime, exporter snapshot, manifest and seven reviewed studio images are retained under `assets/characters/watchkeep-shopkeeper/history/6360429f-original-arm-posture/` as historical evidence, not relabeled as the corrected asset.

The Blender exporter now computes articulated glTF joint rotations using forward kinematics and shortest-swing alignment in the chest frame. Resting clavicles settle down/forward; upper arms hang near the torso; forearms retain a mild bend and forward angle. A 60° rest-only axial forearm roll reduces the supplied pronation while leaving elbow/wrist positions unchanged. Residual glove asymmetry remains; the stills do not establish that both palms face the thighs in every pose. It changes rotation tracks rather than rotating the mesh as a rigid object or altering bind matrices. The correction fades smoothly as a wrist rises from .28 m below its shoulder to .08 m below, preserving the expressive raised-hand portions ofIdle 15. It does not create finger articulation; the supplied hand mesh remains.

`arm-correction.json` records the chest-space target directions, axial roll, clip sample counts and correction-strength ranges. `source-preservation.json` distinguishes every corrected rotation from every unchanged source channel. The actual revised runtime is reimported for the full 60 Hz deformation and 40-phase transition checks. The current material and geometry match the preceding candidate; this correction addresses posture, not the previously recorded uniform-material limitation. Current final still review and actual-loader angular comparisons are reported by the integration owner after the exact-hash evidence refresh.


Final 808768 review: Astra inspected all seven refreshed stills and confirmed scoped shoulder/arm readability 4/5, preserved expressiveIdle 15, and no gross cuff/vest tearing or collapsed articulation at the sampled midpoints. Residual glove asymmetry was nonblocking; actual hand/holster clearance remains a game integration check. The integration owner independently sampled 1,149 actual Three.js loader/animator poses with the same corrected hash: initial upper arms 6–15.5° outward and 0.85–13.3° forward (formerly about 30° backward), elbows 9.8–14.1°, grounding unchanged, measured counter gap .5769 m. This is an actual-runtime CPU comparison, not a browser-rendering claim.
