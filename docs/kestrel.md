# Kestrel asset and inspection studio

Request 24 delivers a single-seat interceptor and an inspection page at
`/dev/kestrel.html`. This branch is the asset stage. Hangar selection, flight
tuning, physical ladder traversal, suspension forces and combat systems belong
to a subsequent integration PR.

**Work in progress:** the required Meshy text-to-texture pass and final visual
gate are pending. The current GLB uses baked Blender procedural materials.
Nothing has entered `public/models/` or been declared ready to merge.
The latest independent review scores 4.17/5, with materials at 3.5; the brief
requires at least 4.2 overall and no criterion below 4.

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
| Mounts | `HP_Nose`, `HP_WingL/R`, `HP_Belly`, all facing −Z |
| RCS | Twelve `RCS_*` sockets with positions/directions in the contract |

The hard limits include the cockpit: 60,000 triangles, 4,000,000 bytes and 1024²
WebP textures. The `.blend`, HDRI and baking inputs are authoring files; the page
bundles only the runtime GLB.
The current candidate is 36,226 triangles and 2,305,008 bytes, with three 1024²
WebP maps. Its complete authoring/verification record is in
[`docs/qa/kestrel/record.md`](qa/kestrel/record.md).

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

The current upload retry file is `assets/kestrel/kestrel-meshy-clean.glb`.
`clean_meshy_upload.py` excludes 78 triangle fragments with negligible geometric
area or collapsed UV area from the temporary painting shell. Position, normal,
UV and image buffers are byte-for-byte unchanged. This preserves the existing
atlas and does not modify the runtime GLB. Both the original and cleaned files
pass Khronos glTF Validator with zero issues. Meshy reported only "Texturing
failed" after the manual upload; whether this cleanup resolves that failure is
still unverified. See the QA record for limits and hashes.

The remaining texture step uploads that authored mesh to Meshy's text-to-texture
workflow with **Keep Original Texture and UV** enabled, then validates/imports
its PBR maps. Art direction: white armour, dark polymer, brushed metal, restrained
mint markings, serials and plausible service wear. Preserve geometry and UVs.
`pack_fighter_textures.py` accepts `meshy-basecolor.png`, `meshy-normal.png`,
`meshy-roughness.png` and `meshy-metallic.png` in the texture directory. It keeps
Blender contact AO, packs AO/roughness/metallic into RGB, and records source hashes
in `textures/provenance.json`. Missing maps explicitly fall back to procedural
candidates; that fallback does not satisfy the final asset recipe.

Export batches geometry only within a rigid assembly and retains animated
parents, socket transforms, display UVs, glass and independently driven parts.
Tracks with the same mechanism name become one glTF animation clip.

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
per view measured the following. CPU values cover `renderer.render` only. RAF
intervals were about 16.7 ms and are not GPU time. This is an isolated studio
measurement, not a full-game performance claim.

| View | Draws / triangles | GPU median / p95 | CPU render median / p95 |
|---|---:|---:|---:|
| Exterior | 46 / 36,480 | 1.84 / 2.21 ms | 0.80 / 1.50 ms |
| Cockpit | 22 / 26,364 | 3.19 / 3.96 ms | 0.70 / 1.20 ms |

Independent reports and original captures are retained in
[`docs/qa/kestrel/reviewer/`](qa/kestrel/reviewer/round-2/review.md). Round 1 failed
the silhouette gate at 3.8/5. Rebuilt wing/body and cowl profiles reached 4.5/5 in
round 2 before detail. Round 3 evaluates the first full procedural candidate,
including its side-screen winding defect, and failed at 3.42/5. Round 4's fresh
33-capture review closes the rig/display/engine defects and scores 4.17/5, with
materials still at 3.5. Those reports preserve the actual candidates assessed.
Final acceptance requires the Meshy pass, a fresh score of at least 4.2 with
every criterion at least 4, and Cees's PR gate.
