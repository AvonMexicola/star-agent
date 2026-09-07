# Kestrel shopkeeper asset production record

2026-09-07. Asset authoring and CPU studio evidence; runtime integration and browser review are separate gates owned by the integration reviewer. This record preserves the supplied male mechanic's appearance and four supplied idle clips, with resting-arm rotation corrections requested by the user after the first export.

## Source and scope

The user supplied `Meshy_AI_Cybertech_Mechanic_biped.zip`. The exact 49,087,379-byte archive is retained at `assets/characters/kestrel-shopkeeper/source/source-animation-pack.zip`, SHA256 `549dc3627433c39238861af916d2cda52f44e92a0367f7ab5c69a7e5d33adc78`. `source/archive-manifest.json` records all six original entry sizes and hashes. Four idle GLBs are extracted unchanged; walking and running remain inside the source archive and are not included in the runtime asset.

The source has 31,252 triangles, 20,865 vertices, one material, one skin and 24 joints. It depicts a grey-haired, bearded mechanic with a cyan eyepiece, teal and orange workwear, harness, tools, gloves and heavy boots. Source-oblique and source-face show the original material at normalized scale. Existing cheek facets and painted creases are inherited source details; no face, outfit or skeletal proportions were redesigned.

| Retained clip | Duration |
| --- | ---: |
| idle-02 | 2.366666555 s |
| idle-03 | 5.366666794 s |
| idle-11 | 1.933333278 s |
| idle-12 | 6.033333302 s |

## Derived asset and preservation

`public/models/characters/kestrel-shopkeeper.glb` is 1,579,416 bytes, SHA256 `8f5052adf0b6d32c26e41d3cf379cb595b18b064f5af2dc6a68a7a2ace579537`: 19,699 triangles, 14,894 exported vertices, one material, one skin and 24 joints. Its 1024-pixel WebP uses the supplied albedo. False full-albedo emission, default metalness and overbright specular extension were removed; the mixed workwear uses metallic 0, emission 0 and roughness 0.72. No separate emissive eyepiece was invented.

The standalone exporter originated from the female exporter snapshot SHA256 `17f91305242256a044fe91fe471c54388492cc97e6fdb68aa394e7120602181f`; it now owns its own constants, reduction protection, validation and output paths. The other agent's exporter was not modified.

A first reduction was rejected because merging joint boundaries produced a vertex that would lose 15% of its skin influence when limited to four joints. The final reduction protects the head/hands and edges spanning more than four substantial source influences. Its 5,193 protected source vertices have zero measured nearest-surface displacement in the rest mesh. Maximum discarded influence is now 0.3432%, below the explicit 1% authoring gate. Maximum rest-surface deviation is approximately 5.86 mm after normalization; this is a nearest-surface measurement, not a point correspondence guarantee.

The original node transforms, skin and inverse-bind buffer are preserved. Each clip retains 66 byte-identical original channels. Six shoulder, upper-arm and forearm rotation channels are intentionally retargeted; `source-preservation.json` records separate source/runtime hashes and labels each changed track. Hand, torso, head and lower-body channels remain unchanged. A single outer node normalizes to metres, +Y up and -Z front. Its scale is 1.1277067422, giving an initial crown-to-sole height of 1.8 m. Added 30 Hz wrapper translations alter only Y for sole contact; wrapper X/Z remain constant. Original bounded horizontal weight shifts remain. No walking/running or travelling wrapper motion is introduced.

## Measured animation contract

All four actual exported clips were reimported into Blender and evaluated at 60 Hz: 947 poses total. Worst sole deviation was -0.1268/+0.1331 mm. Loop endpoint maximum vertex distances were 0.0197 mm, 0.0028 mm, 1.5580 mm and 0.2549 mm respectively; small endpoint differences remain and are not advertised as mathematically exact loops.

Full animation bounds in runtime metres are min `[-0.967709, -0.000127, -0.659240]`, max `[0.752107, 2.217320, 0.915981]`. Envelope W/H/D is 1.719815 / 2.217447 / 1.575222 m. The overhead stretch in idle-03 explains the height above the nominal 1.8 m crown. Placement must use these animated bounds, not just phase-zero dimensions.

Four 0.65-second adjacent idle crossfades were additionally sampled at 40 phases each using Blender transform blending. Worst contact was -3.534 mm. This is an authoring approximation; the actual Three.js animator is a separate integration check. The integration agent independently checked the intermediate shoulder-corrected `599a72…` candidate with the actual Three.js loader and production animator. It passed grounding with a 0.218 m counter gap. Initial left/right upper-arm measurements are approximately 9.6°/5.6° outward, 7.7°/7.4° forward, and 12.6°/13.4° elbow bend. Resting portions of idle-11/12 also measure approximately 6–10° outward and 8–11° forward. The final `8f5052…` artifact subsequently passed the actual Three.js production animator across 501 cycle poses, including resting-pose guards, with unchanged grounding and a 0.23313 m counter gap. These numerical results do not constitute a browser motion review.

## User-directed resting-arm correction

The first export preserved the supplied animation exactly, but the user correctly identified retracted shoulders and arms held backward/outward. Independent Three.js measurement confirmed approximately 35–44° outward and 16–35° backward upper arms. Its `cb623820…` hash and byte-identical rebuild receipt are historical, not the accepted final pose.

The correction is joint animation authoring, not a rigid mesh rotation or changed inverse-bind pose. Blender mathutils evaluates the original glTF hierarchy and swings each clavicle, upper-arm and forearm direction toward relaxed chest-relative targets, preserving the source twist. Clavicles move slightly down/forward; upper arms are nearly vertical, elbows gently bend forward, and wrists hang near the thighs. It writes six corrected rotation channels at 30 Hz. The correction smoothly fades as the original wrist rises from 0.28 m below its shoulder to 0.08 m below, so raised gestures such as idle-03 retain their intended movement. `arm-correction.json` records targets, changed nodes and per-clip weights.

A follow-up corrects resting palm orientation through axial forearm rotation, keeping elbow/wrist endpoints fixed. A fixed roll was rejected after full midpoint inspection showed different source pronation in idle-11/12. The final method calibrates each hand’s dorsal direction from the initial relaxed idle-02 pose, then aligns that direction outward in the chest frame at each sample; palms turn toward the thighs. The same gesture weight removes this correction for raised gestures. Original hand channels and static fingers remain unchanged; no finger rig or grasp interaction was added.

The author viewed the first corrected front/back/face studios: hands sit near the thighs and the backward A-pose is removed, with no visible sleeve tearing in these views. Open gloved hands, source face, neck and torso motion remain as supplied. All seven corrected studios have now been refreshed and viewed, including idle-11/12 after the per-frame palm correction. No concrete image blocker was observed; this does not claim perfect palm/finger anatomy. `review-receipt.json` binds every final image to the current GLB. Independent in-game motion review remains a separate gate.

## Rebuild and evidence

Run from the repository worktree with Blender 5.2, NumPy supplied by Blender and ImageMagick available. Every renderer uses Cycles CPU with four threads; no GPU or browser was used by this asset author.

```sh
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_kestrel_shopkeeper.py -- --skip-renders
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_kestrel_shopkeeper.py -- --render-only
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python assets/characters/kestrel-shopkeeper/check-reduction.py
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python assets/characters/kestrel-shopkeeper/render-source.py
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python assets/characters/kestrel-shopkeeper/render-pose-baseline.py
```

Without `--skip-renders`, the exporter builds, validates, saves the editable `kestrel-shopkeeper.blend`, and renders the final views. `--render-only` verifies the existing manifest hash before reading the exported GLB. Source and derived combined GLBs are local reproducible intermediates excluded from Git; the exact archive is retained once. The exporter verifies archive/entry hashes and extracts the four source idles when missing. Blender backup saves are disabled. The build emitted nonfatal installed extension registration messages and a denied user-cache thumbnail write; the saved Blend and GLB completed successfully.

The `review/` directory contains source-oblique/source-face, final front-oblique/back-oblique/face-detail, all four idle midpoints, and a controlled `before-resting-front-oblique.webp` image of the original `cb6238…` runtime pose using the same matte material, lights and camera as the final front view. These are 800×900, 16-sample CPU studio images, stamped NOT GAME. Before/after lights and camera framing are comparable, but the source floor material differs and raw source material intentionally retains its defects; these raw-source views are inspection evidence, not a pixel-identical lighting benchmark. The additional before-resting/front-oblique pair controls studio setup and material. Its helper checks the historical GLB SHA and defaults to the committed `history/original-resting/kestrel-shopkeeper.glb` and matching historical manifest. That exact optimized baseline remains available after local test-results cleanup; an alternate retained `cb6238…` GLB can also be passed after `--`.

A separate source-to-derived comparison helper evaluates five phases of each clip, with the same intentional arm corrections applied to both source and reduced geometry. This separates reduction error from the requested animation change and enforces a 1 cm nearest-surface gate. The final corrected-motion result is 5.541 mm maximum and 1.481 mm worst p95 across 20 poses. This is a same-corrected-pose comparison on both source and reduced geometry. A second complete corrected build in private scratch reproduced the exact final GLB bytes and hash; see `rebuild-receipt.json`. The first private attempt stopped on a /tmp disk quota while writing a duplicate albedo. After removing only owned failed scratch, a retry discarded intermediates after use and completed successfully. The completed verification artifact now resides in ignored project-drive `test-results/kestrel-rebuild`; no published asset, Blend or manifest was overwritten.

The original candidate reproduced byte-for-byte twice; `rebuild-receipt-original.json` preserves that historical fact. It does not certify the newer arm correction. No browser or GPU work was performed by the asset author.
