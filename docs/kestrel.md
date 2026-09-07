# Kestrel asset and inspection studio

Request 24 delivers a single-seat interceptor and an inspection page at
`/dev/kestrel.html`. This branch is the asset stage. Hangar selection, flight
tuning, physical ladder traversal, suspension forces and combat systems belong
to a subsequent integration PR.

**Ready for Cees's review:** the refined Meshy/Blender candidate passes its
independent visual gate at **4.25/5**, with every criterion at least 4. The current
GLB combines authored material regions, filtered Meshy service detail and Blender
contact AO on the original UVs. Cees retains the final PR gate; the asset has not
entered `public/models/` or been integrated into gameplay.

## Asset contract

The authoritative dimensions and nodes are in
[`assets/kestrel/contract.json`](../assets/kestrel/contract.json). Coordinates are
metres, +Y up, nose −Z, with the origin on the ground-contact plane. The landed
model is 13.5 m long, 9 m wide and 3.2 m high, with 0.9 m belly clearance and a
9,000 kg dry-mass placeholder. Measured export budgets and the GLB hash are in
[`assets/kestrel/manifest.json`](../assets/kestrel/manifest.json).

| Assembly | Contract |
|---|---|
| Canopy | `Canopy`; `CanopyOpen`, 3 seconds |
| Gear | `Gear_Nose`, `Gear_L`, `Gear_R`; `GearDown`, 1.2 seconds |
| Linkage | Lower oleos and ankle joints; compression metadata for later suspension integration |
| Ladder | Swing-out `Ladder` bridge and `Ladder_Upper/Middle/Lower`; `LadderDown`, 1.8 seconds |
| Pilot | `PilotEye` at `[0, 2.49, -1.9]`, seat, stick, throttle and pedals |
| Displays | `MFD_1..4`, 4:3, 512×384 canvas textures; optical `HUD_Glass` |
| Drives | `Nozzle_L/R`, emissive `EngineCores`, initially hidden `AB_L/R` cones |
| Mounts | Four empty fixed S2 sockets: `HP_Nose`, `HP_WingL/R`, `HP_Belly`; bore −Z, normal outward |
| RCS | Twelve `RCS_*` sockets with positions/directions in the contract |

The hard limits include the cockpit: 60,000 triangles, 4,000,000 bytes and 1024²
WebP textures. The `.blend`, HDRI and baking inputs are authoring files; the page
bundles only the runtime GLB.
The current candidate is 36,226 triangles and 2,331,576 bytes, with three 1024²
WebP maps. Its complete authoring/verification record is in
[`docs/qa/kestrel/record.md`](qa/kestrel/record.md).

The [shared fitting standard](weapon-mount-standard.md) defines S1/S2/S3
interfaces. Kestrel's four exported nodes carry size 2, fixed-mount and empty
attachment metadata. Their origins sit on the underside mating plane, with local
+Y pointing outward and −Z forward. Protective covers retain their reviewed
geometry. The rating does not install guns or certify a future weapon's clearance.

## Rebuild

Blender 5.2.0 LTS was used. Run these from the repo root:

```sh
blender -b -t 4 --python-exit-code 1 --python blender/build_fighter.py -- --stage detail --round local --render
blender -b assets/kestrel/kestrel.blend -t 4 --python-exit-code 1 --python blender/export_fighter.py -- --prepare
python3 blender/clean_meshy_upload.py
blender -b -t 2 --python-exit-code 1 --python blender/pack_fighter_textures.py
blender -b /tmp/kestrel-uv.blend -t 4 --python-exit-code 1 --python blender/export_fighter.py -- --export
blender -b assets/kestrel/kestrel.blend --python-exit-code 1 --python blender/check_fighter_clearance.py
```

`build_fighter.py` saves editable geometry before applying modifiers. Primary
forms use lofts and swept profiles; detail uses two-segment bevels, EXACT seam
booleans, reusable hatches/vents, and Geometry Nodes cable/rivet assemblies from
`blender/parts/`. `blender/materials.py` supplies coat variation, cavity grime,
edge wear, roughness and bevel-normal nodes. The prepare step applies geometry,
packs a shared UV atlas and bakes a temporary joined copy, retaining the source
assemblies. It bakes base colour, roughness, metallic, tangent-space normal and
AO, then exports `kestrel-meshy-input.glb` with one mesh and the
existing base-colour atlas. The UV-layout hash is recorded in
`assets/kestrel/texture-layout.json`.

The accepted upload file is `assets/kestrel/kestrel-meshy-clean.glb`.
`clean_meshy_upload.py` excludes 78 triangle fragments with negligible geometric
area or collapsed UV area from the temporary painting shell. Position, normal,
UV and image buffers are byte-for-byte unchanged. This preserves the existing
atlas and does not modify the runtime GLB. Both the original and cleaned files
pass Khronos glTF Validator with zero issues. The original manual upload failed
with only "Texturing failed"; the cleaned upload and subsequent PBR generation
succeeded. The exact remote cause remains unknown. See the QA record for hashes.

The authored shell was uploaded to Meshy's text-to-texture workflow with
**Keep Original Texture and UV** enabled. Meshy 7 generated 2K PBR maps at a
displayed cost of 10 credits. The exact submitted prompt and raw maps are in
`assets/kestrel/textures/meshy-prompt.txt` and `meshy-source/`. After downloading
the resulting GLB, import a new candidate with:

```sh
blender -b -t 2 --python-exit-code 1 --python blender/import_fighter_textures.py -- --source /path/to/downloaded.glb
```

The importer restores Meshy's normalized positions for comparison and rejects
a UV mismatch. All 47,024 returned vertices matched the authored atlas within
1.26e-6 UV units. Geometry and animation stay in Blender's original rig. Generated
maps are reduced to 1024²; normals are renormalized, and glTF's green roughness /
blue metallic channels are separated. Raw 2K JPEG maps and their hashes are kept
for provenance; the runtime contains only the three packed WebP textures.

`pack_fighter_textures.py` accepts `meshy-basecolor.png`, `meshy-normal.png`,
`meshy-roughness.png` and `meshy-metallic.png` in the texture directory. It checks
the UV-layout hash of `/tmp/kestrel-uv.blend`, then rasterizes actual material
assignments with two-texel margins. These regions preserve ceramic, graphite,
rubber, titanium, mint livery and amber/graphite markings. A bounded local-detail
filter removes Meshy's broad shading-like colour streaks. Material-specific
roughness and metalness retain generated service variation; metal also receives
directional brushing. The normal blend preserves authored bevels while adding
attenuated generated detail. Blender contact AO remains in the ORM red channel.
Source hashes, region coverage and finish parameters are recorded in
`textures/provenance.json`. Raw generated maps remain unchanged. The optional
`--raw-meshy` flag reproduces the direct-import treatment reviewed in round 5.
If no generated maps exist, packing explicitly falls back to a procedural
candidate; that fallback does not satisfy the final asset recipe.

Export batches geometry only within a rigid assembly and retains animated
parents, socket transforms, display UVs, glass and independently driven parts.
Tracks with the same mechanism name become one glTF animation clip.
The final export writes the socket metadata and compensates cover-child
transforms when aligning mating frames; geometry, textures and animation buffers
remain unchanged by that socket conversion.

The render HDRI is **Studio Small 09** by Sergej Majboroda, CC0 from
[Poly Haven](https://polyhaven.com/a/studio_small_09). References and attribution
are in [`docs/refs/fighter/`](refs/fighter/README.md).

## Inspection and adapter

Run `npm run dev` and open `/dev/kestrel.html`; this page is also included in the
Vite production build. Views cover exterior, engines, planform, the actual pilot
eye, ground entry and underside. Drag/pinch controls support mouse and touch.
Keys 1–6 select views; C, G and L command canopy, gear and ladder. A standard
controller uses bumpers for views, D-pad for focus, A to activate and the right
stick to orbit. New controllers must return to neutral before commands work.
Physical-controller verification is still outstanding.

`createKestrel({url})` in `src/kestrel.js` returns a Three.js group with
`readyPromise`, `update(dt)`, `command(mechanism, open)`, `setThrottle(value)`,
`getNode(name)`, `snapshot()` and `dispose()`. The caller supplies the exported
GLB URL; the studio resolves it through Vite. The adapter owns visual animation.
Its interlocks require canopy/gear readiness before ladder deployment, ladder
stowage before canopy closure and closed access before gear retraction.
Durations use elapsed time even under slow rendering.
The snapshot also lists hardpoints from the loaded GLB. The studio derives its
“4 × S2 hardpoints” specification from those actual nodes.

The MFD painter accepts optional canvas height/profile arguments; its default
Nomad path is preserved. Kestrel displays label the static inspection state and
actual canopy, ladder and gear progress. Fuel/heat and flight are explicitly
unconnected. Engine glow is an inspection control, without thrust.

## Verification and review

```sh
npm test
npm run build
npm run test:browser -- -c scripts/kestrel.config.js
KESTREL_URL=http://127.0.0.1:5292 npm run test:browser -- -c scripts/kestrel-performance.config.js
```

Node GLTFLoader tests check the actual binary budgets, transforms, dimensions,
animation durations, gear clearance, ladder contact and one-sided screen
visibility from `PilotEye`. Browser tests render the real WebP PBR materials,
tour desktop and phone views, reverse mechanisms and exercise keyboard, injected
controller and touch. Browser warnings/errors fail the tests. Screenshots and
environment metadata go to `/tmp/star-agent-kestrel-browser-evidence`.

The performance configuration requests ANGLE/OpenGL hardware at 1440×900. On
Chromium 151 / AMD Radeon 860M / ANGLE OpenGL ES 3.2, 120 asynchronous GPU queries
per view measured the following on the final textured candidate. CPU values
cover `renderer.render` only. No disjoint events or browser errors occurred.
This is an isolated studio measurement, not a full-game performance claim.

| View | Draws / triangles | GPU median / p95 | CPU render median / p95 |
|---|---:|---:|---:|
| Exterior | 46 / 36,480 | 3.31 / 3.98 ms | 1.50 / 4.20 ms |
| Cockpit | 22 / 26,364 | 5.97 / 7.68 ms | 1.20 / 3.40 ms |

Instrumented RAF intervals had medians 17.0/17.1 ms and p95 values 43.5/56.3 ms
for exterior/cockpit. That variable pacing is not a stable-FPS or complete frame
budget pass; the GPU query measures rendering work, not the whole animation loop.

Independent reports and original captures are retained in
[`docs/qa/kestrel/reviewer/`](qa/kestrel/reviewer/round-2/review.md). Round 1 failed
the silhouette gate at 3.8/5. Rebuilt wing/body and cowl profiles reached 4.5/5 in
round 2 before detail. Round 3 evaluates the first full procedural candidate,
including its side-screen winding defect, and failed at 3.42/5. Round 4's fresh
33-capture review closes the rig/display/engine defects and scores 4.17/5, with
materials still at 3.5. Round 5's 38-capture review scores the direct Meshy import
at 4.00/5, identifying broad albedo streaks and weakened faction markings. The
refined mix passes [round 6](qa/kestrel/reviewer/round-6/review.md) at **4.25/5**:
silhouette 4.5, materials 4.0, lighting 4.0, cohesion 4.0, function 4.5 and motion
4.5. The reviewer inspected 34 fresh captures and independently confirmed
unchanged geometry, UVs, node records and animations. Those reports preserve
the actual candidates assessed. Close cockpit/nozzle detail remains optional
polish. Final acceptance remains Cees's PR gate.

Cees's subsequent S2 mount request has a
[scoped independent follow-up](qa/kestrel/reviewer/s2-followup/review.md).
Fresh desktop/phone checks verify the specification and socket data; a complete
vertex comparison confirms unchanged world geometry throughout sampled animation
poses. The original round-6 visual score and performance measurements keep their
original candidate identity rather than being presented as newly rerun tests.
