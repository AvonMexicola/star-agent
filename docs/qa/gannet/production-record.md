# Gannet T-06 production checkpoint

SA-SHIP-002, authored on `feat/meridian-gannet` from `4e34432067f1d09976c16071910895916e42477e`. The builder owns only new Gannet paths; root owns common flight, navigation, fleet, cargo, rover carrier and server integration. The accepted medium brief widens the rover bay to **5.8 m net clear**. The 24 × 16 × 7.2 m conservative envelope remains fixed.

Current scope is complete authored geometry, procedural PBR, editable Blender source, named rig/layout and an isolated loader/studio. It is not yet a validated playable transport. Independent silhouette, material, motion and in-game acceptance remain pending. The studio cannot establish shader correctness until it has actually run in Chromium, and a capacity label does not establish an inventory implementation.

The corrected geometry09 candidate contains the hollow cabin, pilot/passenger seats, two berths, storage fittings, four real MFD surfaces, front/aft call panels, elevator, retracting hatch, telescoping gear, nozzle anchors and freight banks. It has **39,966 triangles, 33 mesh primitives, four embedded WebP images and 2,422,200 bytes**. GLB SHA256: `67f650cee7a6af5f47b35fb597ffbb02f7fd3be9fef08e08146a5aa512597e52`. Source and other measured identities are in `assets/gannet/manifest.json`; runtime budget checks enforce 60k triangles, 4 MB and maps at most 1024². The approved Meridian emblem accompanies three original deterministic PBR maps. No external generated geometry, paint job, network request or paid service was used.

## CPU validation

The twelve focused cases inspect the actual exported GLB and separately load the actual Burrow door mesh. They cover:

- Hatch/elevator ordering, securing, power and newly introduced obstruction guards.
- Named hierarchy, exact eyes/nozzles/control anchors, four physical screens and measured budgets.
- Complete closed assembly containment at 21 landing gear positions.
- The full 5.8 × 6.5 × 3.2 m open bay and both complete 64 SBU freight volumes.
- 113 short rays through the actual roof transition, bay ceiling and fixed hatch-cassette skins; moving leaves are excluded from this enclosure check.
- All six actual hatch leaves at 101 movement positions against fixed triangles and one another, with a measured minimum open-leaf/cap clearance of 25.82 mm.
- Burrow's conservative complete steering/suspension envelope and actual door geometry at 15 elevator heights and 17 door angles.
- Conservative full-player volumes along the cabin/side approach and every physical Burrow boarding waypoint.
- Ray hits on the actual authored cabin, vestibule and elevator floor triangles.
- Nine forward rays from the canonical pilot eye across yaw −8°/0°/+8° and pitch −5°/0°/+10°: every ray crosses retained pressure glass without an opaque obstruction.
- 36 first-visible-hit rays to actual display faces, including the centres and near-edge regions of all four screens, using the GLB's authored material-side settings.
- Actual backing/shelf intersections, the fitted shelf/hull mounting face, and clearance between the complete shelf volume and pressure-glass triangles.

Geometry04 passed all seven direct `node:test` cases in 0.827 s. Geometry05, adding actual call panels, passed the `node --test` file invocation in 1.385 s; that runner reported one passed file rather than individual case counts. Geometry06 passed the original seven cases in 0.998 s and reproduced the exact geometry05 runtime SHA. A subsequent enclosure/self-clearance audit expanded the checks and exposed real roof/cassette gaps, a cassette-cap collision and a raised deck-marker collision in that frozen candidate: **7/9 passed, 2 failed**. Geometry07 adds fitted pressure skins, extends the roof into the cassette, raises its cap and makes the markers flush. **All nine direct cases pass in 1.663 s, zero failures/skips.** Layout, control/park transforms and loader/systems APIs are unchanged.

Geometry08 applies Cees's explicit clear-forward-view rule by removing only the central windscreen mullion. The new pilot-ray case first fails on Geometry07 at all three centre pitches (9/10 cases pass), then **all ten cases pass on Geometry08 in 1.271 s, zero failures/skips**. The glass material and all its geometry/accessor bytes are identical to Geometry07. The sole removed collision part is `Central windscreen mullion`; all 325 retained parts are unchanged. No side frame, seal, pressure pane, layout or API was altered.

Geometry09 fixes the separately reproduced display obstruction: deterministic face winding puts each bezel's solid backing behind its screen, and the support shelf moves 0.19 m toward the nose behind the display faces. The expanded test first failed on Geometry08 at 24/36 sampled face points. Correcting the bezels alone left 12 lower-face points blocked by the shelf; that intermediate asset and failure are preserved. **The final twelve cases pass in 3.544 s, zero failures/skips.** All 36 display points are first visible from the canonical pilot eye. Actual triangle crossings measure at least 11.74 mm of backing/shelf overlap at every mount and a 0.024 mm fitted shelf/hull gap; the shelf plus a 1 mm packing margin clears all glass triangles. Screen/frame/control placements remain unchanged. The only changed collision parts are the inner two bezel backings and support shelf; all 32 other mesh primitives, node/rig transforms, material definitions, embedded image bytes, layout and complete flight bounds match Geometry08.

All four source images are embedded in the portable Blender file. Maximum measured position packing error is 0.000308 m; UVs and indices are retained by packing. Source syntax checks pass. The isolated studio production build passed in 0.979 s on the earlier geometry checkpoint; its source is unchanged by this correction. Vite retains its large-chunk advisory for the 698 kB bundled Three.js studio; no warning threshold was weakened. Failed geometry candidates and their actual assertion details are retained in the iteration record.

The referenced Burrow is final candidate10, SHA256 `88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`, 21,570 triangles. Tests use its current authored layout rather than guessing its door path from the body dimensions. The shape-level carrier + rover subtotal is about 61.6k triangles before freight, lights, UI and the wider world; this is not a full scene measurement or FPS claim.

## Evidence limits and next gate

All current validation is CPU-only. Most geometry checks deliberately strip materials/textures; the display visibility check retains actual material-side/opacity settings while substituting empty texture objects for image decoding. WebP decode, shader compilation, actual appearance, motion and cockpit/phone composition still require Chromium. Root coordinates the one shared GPU lane before any 5581 browser launch. The visible shared game previews and other owners' files/services are preserved. The corrected CPU display sightlines do not establish native MFD readability or visual acceptance.

After the studio silhouette gate, root must validate physical keyboard/controller/touch selection, boarding, loading, side-door access, securing, continuous flight/carry, landing and unloading, with full freight present. Ground contact beneath the lowered 0.16 m elevator plate, live MFD/inventory state, loaded chase-camera clearance, station fit and online authority remain explicit integration checks. No score, approval, public merge, deployment or hardware performance result is claimed here.

The complete local failure/build/test archive is `/tmp/star-agent-gannet-evidence`; it is not committed. The source tree and portable harness retain the reproduction route. Later selected real-render images belong here; no synthetic views substitute for them.
