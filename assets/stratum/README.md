# Stratum M-05 asset checkpoint

Original Meridian extraction craft, built from the current medium-ship brief.
This is an authored geometry/material/rig candidate. It is **not yet a playable
flight/mining ship or an independently accepted finished asset**.

The canonical physical layout is `layout.json`. Units are local metres, +Y up,
−Z bow. The closed-flight allocation is 18×13×5.6m; `measurements.json` records
actual geometry bounds separately. The cabin has a 1.35m deck, a continuous 1.1m
centre aisle, two compact berths, reserved empty freight banks and modeled ore/
supplies access faces. The 384kg ore, 32SBU freight and 240kg supplies entries are
integration allocations; this asset does not grant inventory capacity or ore.

`stratum.blend` retains separate editable fittings, bevel modifiers, lettering
and relative texture paths. `blender/build_stratum.py` rebuilds the source and
`public/models/stratum.glb` without a render, account or paid service. The helper
`blender/stratum_geometry.py` follows the existing repository's coordinate and
primitive conventions; the actual hull and assemblies are authored for this
ship. No complete existing hull or competitor asset is copied.

Build with Blender 5.2 and ImageMagick available:

```sh
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio --python-exit-code 1 --python blender/build_stratum.py
node scripts/stratum-measure.mjs
node --test tests/stratum.test.js
node node_modules/vite/bin/vite.js build --config scripts/stratum-vite.config.js
```

The PNG finish sources and lossless 1024² WebP runtime maps are in `textures/`.
`textures/provenance.json` records the original deterministic recipe and hashes.
Basecolor contains bounded reflectance grain, the tangent normal is generated
independently from surface slopes, and ORM has no baked AO (R=1). Roughness and
metalness retain material-specific factors. No light or shadow is painted into
the maps. The GLB uses the standard derivative normal-map path without stored
tangents to stay within 4MB. A real renderer check remains required.

## Adapter contract

`createStratum()` in `src/stratum.js` returns a Three Group immediately. Its
`readyPromise` resolves the complete validated systems adapter, or null on a
handled failure/disposed load. `userData.assetStatus` is loading/ready/error/
disposed. Failed or incomplete assets expose no partial ready hull. The loader
owns its geometry/material resources; separate loader instances own separate
resources. This first checkpoint does not add a global asset cache or a gameplay
fallback. Root's fleet selector must wait for readiness before offering boarding.

- `applyPose({gearProgress,rampProgress,aim:[{yaw,pitch},{yaw,pitch}]})` consumes exact normalized progress. It does not start an alternate flight gear clock. Studio sequencing is a separate inspection-only helper.
- `muzzle(index,{local:true})` returns `{position,direction,name,index,type}` from the current named muzzle. Positive pitch raises the head; yaw follows Three's right-handed +Y rotation (positive yaw turns the −Z bore toward−X). Local results stay ship-local; `{local:false}` uses the current full object transform in JS doubles.
- `nozzle(index,{local:true})` returns the actual aft position/+Z direction and radius. `Nozzle_Port` and `Nozzle_Starboard` are physical mouths, not flame meshes.
- `getDisplays()` returns the four separate `MFD_1..4` mesh surfaces. Root can install the existing live `createShipMFDs` wrapper. Studio canvases explicitly show inspection data, never invented flight/ore state.
- `snapshot()` exposes readiness, normalized mechanism state, aim, ramp readiness and access secured state. `dispose()` also handles a late asset response without reappearance.

`src/stratum-flight-parts.js` exposes measured conservative pressure-body, drive,
individual axle, gear, boom and closed-cassette boxes. Gear/boom parts include
their full allowed motion and a 2cm interpolation guard. Only individual gear
volumes reach Y0; no full-width zero-height box is invented. The open ramp is
deliberately outside this flight contract and requires a secured-flight gate.

## Physical ramp

The rear hatch is 1.9m wide with a 2.2m clear portal. It stores three distinct
plates separated by 13cm, including underside guide clearance. Motion first
rotates the nested cassette (0–40%), then extends plates below deck level
(40–90%), then raises them on short cams (90–100%). Closing reverses the order.
The deployed 5.2m run meets the 1.35m deck at 14.55°. Small deck rises are 6/12mm,
with 4mm longitudinal seams; the end plate tapers at ground contact. Only full
deployment authorizes walking. Root owns actual navigation/interlocks.

## Studio and remaining gates

Build the independent studio using the command above, then serve with:

```sh
node node_modules/vite/bin/vite.js preview --config scripts/stratum-vite.config.js
```

Reserved page: `http://127.0.0.1:5580/public/dev/stratum.html`. The production
build is in `dist/stratum/`; do not commit it. Keyboard, touch buttons and standard
gamepad focus/activation are authored, with release-to-rearm after blur. They
have not yet been exercised in a browser in this checkpoint.

After acquiring the shared GPU queue, `scripts/stratum-studio.config.js` drives
actual view/mechanism controls and records 1440×900/390×844 images/video and backend.
No browser was launched by the builder for this checkpoint. Independent silhouette
review (target 4.5), final native PBR/motion review, complete flight/boarding/mining
integration, persistent ledgers, server registration and actual three-input-mode
gameplay journeys remain pending and root-owned where the brief assigns them.
