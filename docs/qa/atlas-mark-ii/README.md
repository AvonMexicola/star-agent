# Atlas Mark II authoring candidate

This is an original ship asset and dedicated inspection/walking scene. It is not installed into the live fleet and is not certified as Star Citizen production quality. The source remains a review candidate; graphics approval and flight integration are separate work.

## What is built

- Packed editable Blender scene and reproducible Python mesh/material pipeline.
- 64 × 36 × 16 m nominal unarmed envelope; measured mesh approximately 61.79 m long, 35.71 m wide and 14.62 m high.
- Through cargo hold, two folding loading ramps, crew elevator with sliding landing gates, upper bridge, six bunks, galley and hygiene space.
- Two generated albedo sources plus independently authored normal/ORM textures, including upholstery weave. Exact source prompts and hashes are in `assets/atlas-mark-ii/textures/provenance.json` and `derivatives.json`.
- Three authored S3 interfaces; a shared S1/S3 attachment standard with provisional future weapon envelopes. No weapons installed.
- Dedicated walker with 39 fixed furniture/bulkhead AABBs, ramp boundaries, permanent lift rails, empty-shaft barriers and gate-before-lift interlocks.

## Measured asset budgets

| Asset | Triangles | Mesh batches | Embedded GLB bytes |
|---|---:|---:|---:|
| Full authoring detail | 398,608 | 154 | 36,736,924 |
| Distance candidate 1 | 128,387 | 154 | 13,325,672 |
| Distance candidate 2 | 40,625 | 154 | 3,974,200 |

The hero has 13 materials and 10 textures. The full-detail material maps are 1024 px; distance candidates use 512 / 256 px derivatives. Geometry, UVs and hashes are recorded by `assets/atlas-mark-ii/manifest.json`. The studio loads the hero only. Distance switching, attachment clearance in gameplay and LOD interior quality are not approved by these measurements.

The hero exceeds the repository's older 60k-triangle / 4 MB ship budget. This is explicitly a high-detail authoring candidate, not a budget waiver or a production-optimized replacement.

## Validation environment

Blender 5.2.0 LTS, Node v26.7.0, Chromium 151.0.7922.173 on Linux. Final screenshots use AMD Radeon 860M through ANGLE OpenGL ES 3.2, 1440 × 900, device pixel ratio 1. Earlier retained first-pass evidence used ANGLE Vulkan SwiftShader. `render-environment.json` records the actual renderer and loaded asset statistics. No laptop-GPU FPS claim is made.

The final exported asset passes all 180 unit tests, including actual GLB metre scale, named moving pivots, closed transforms, lift safety-bar geometry, mount world transforms and flange geometry, tapered bridge floor/cheeks, seven bounded pressure-interface rays, material factor preservation and nonconstant exported contact shading. The production Vite build passes. The hardware production browser suite passes 4/4 with zero captured page or console errors. The main production app also boots into flight with its ship asset ready and no captured errors.

The `final-*.png` set contains actual production-browser renders. The first-pass images and Opus review are retained separately to make the review history inspectable. Still images cannot establish motion quality.

The four hardware browser cases completed in 1.6 minutes: physical aft ramp → cargo → crew lift → bridge → crew room → galley aisle → hygiene basin approach at 480 × 300; seven presets and mount overlay at 1440 × 900; phone at 390 × 844; injected controller at 720 × 450. No physical Xbox hardware test is claimed. The functional suite used hero `81ccc96f…`; afterward only the steel mess-leaf edge was inset 25 mm to eliminate its coplanar overlap with the dark nosing. The assembly boundary and collider stayed fixed. Export tests and a focused galley render were repeated for that correction.

Reproduce the hardware suite on a suitable Linux host:

```sh
ATLAS_HARDWARE=1 npm run test:browser -- -c scripts/atlas-mark-ii.config.js
```

Without that opt-in the configuration uses SwiftShader. Earlier software runs exceeded their whole-journey wall budget and are retained as failures, not passes. Static shadow maps now regenerate on model load and moving ramp/lift/gate frames, including the final settled frame; camera-only movement reuses them. No FPS or frame-budget claim is inferred from test duration.

## Material export regression

The Blender contact bake uses 12 deterministic hemisphere rays within 1.15 m and isolates independently moving parts. Tests caught an exporter fallback that produced constant white vertex colours and omitted authored material factors. The exporter now names `ContactAO` explicitly and exports the original PBR base input while glTF applies COLOR_0. Raw opaque vertex values range from approximately 0.57758 to 1.0; dark/petrol/rubber/warning base factors are independently checked. The editable Blender shader retains the contact multiply.

## Shallow-angle shadow regression

A three-way hardware comparison isolated broad armour-panel striping to shadow acne: disabling shadow reception removed it, while disabling normal maps retained it. `shadow-acne-before.png` records the defect. The directional key now uses bias −0.0005 and normal bias 0.06 m for its 92 m orthographic span. The final seven-view production test passed again with shadows enabled, zero browser errors and visibly clean armour in `final-mounts.png`; exterior contact shadows remain visible. This correction changes neither the asset nor the collider layout.

## Integration still required

New fleet/layout registration, boarding and hull collision dimensions, power/cabin movement behavior, a physical hangar fit, live MFD state, usable cargo, controller gameplay journey, hardware graphics budgeting, automatic LODs and independent visual approval. The authored MFD patterns are inspection graphics, not live telemetry. The closed exterior service hatch is visual detail, not a functioning extra airlock.
