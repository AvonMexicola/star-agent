# Gannet T-06 production checkpoint

SA-SHIP-002, authored on `feat/meridian-gannet` from `4e34432067f1d09976c16071910895916e42477e`. The builder owns only new Gannet paths; root owns common flight, navigation, fleet, cargo, rover carrier and server integration. The accepted medium brief widens the rover bay to **5.8 m net clear**. The 24 × 16 × 7.2 m conservative envelope remains fixed.

Current scope is complete authored geometry, procedural PBR, editable Blender source, named rig/layout and an isolated loader/studio. It is not yet a validated playable transport. Independent silhouette, material, motion and in-game acceptance remain pending. The studio cannot establish shader correctness until it has actually run in Chromium, and a capacity label does not establish an inventory implementation.

The frozen geometry06 candidate contains the hollow cabin, pilot/passenger seats, two berths, storage fittings, four real MFD surfaces, front/aft call panels, elevator, retracting hatch, telescoping gear, nozzle anchors and freight banks. It has **39,878 triangles, 33 mesh primitives, four embedded WebP images and 2,417,904 bytes**. GLB SHA256: `90aafdb501abd00062bbbf6b99df1aee5d1e89350e1919bec4708b91e508e483`. Source and other measured identities are in `assets/gannet/manifest.json`; runtime budget checks enforce 60k triangles, 4 MB and maps at most 1024². The approved Meridian emblem accompanies three original deterministic PBR maps. No external generated geometry, paint job, network request or paid service was used.

## CPU validation

The seven focused cases inspect the actual exported GLB and separately load the actual Burrow door mesh. They cover:

- Hatch/elevator ordering, securing, power and newly introduced obstruction guards.
- Named hierarchy, exact eyes/nozzles/control anchors, four physical screens and measured budgets.
- Complete closed assembly containment at 21 landing gear positions.
- The full 5.8 × 6.5 × 3.2 m open bay and both complete 64 SBU freight volumes.
- Burrow's conservative complete steering/suspension envelope and actual door geometry at 15 elevator heights and 17 door angles.
- Conservative full-player volumes along the cabin/side approach and every physical Burrow boarding waypoint.
- Ray hits on the actual authored cabin, vestibule and elevator floor triangles.

Geometry04 passed all seven direct `node:test` cases in 0.827 s. Geometry05, adding actual call panels, passed the `node --test` file invocation in 1.385 s; that runner reported one passed file rather than individual case counts. **Geometry06 passes all seven cases in 0.998 s, zero failures/skips.** Its clean rebuild produces the exact same runtime GLB SHA as geometry05. All four source images are embedded in the portable Blender file. Maximum measured position packing error is 0.000308 m; UVs and indices are retained. Source syntax checks pass, and the isolated studio production build passes in 0.979 s. Vite retains its large-chunk advisory for the 698 kB bundled Three.js studio; no warning threshold was weakened. Failed geometry candidates and their actual assertion details are retained in the iteration record.

The referenced Burrow is final candidate10, SHA256 `88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`, 21,570 triangles. Tests use its current authored layout rather than guessing its door path from the body dimensions. The shape-level carrier + rover subtotal is about 61.4k triangles before freight, lights, UI and the wider world; this is not a full scene measurement or FPS claim.

## Evidence limits and next gate

All current validation is CPU-only. The test geometry loader deliberately strips materials/textures for geometric inspection; WebP decode, shader compilation, actual appearance, motion and cockpit/phone composition still require Chromium. Root coordinates the one shared GPU lane before any 5581 browser launch. The visible shared game previews and other owners' files/services are preserved.

After the studio silhouette gate, root must validate physical keyboard/controller/touch selection, boarding, loading, side-door access, securing, continuous flight/carry, landing and unloading, with full freight present. Ground contact beneath the lowered 0.16 m elevator plate, live MFD/inventory state, loaded chase-camera clearance, station fit and online authority remain explicit integration checks. No score, approval, public merge, deployment or hardware performance result is claimed here.

The complete local failure/build/test archive is `/tmp/star-agent-gannet-evidence`; it is not committed. The source tree and portable harness retain the reproduction route. Later selected real-render images belong here; no synthetic views substitute for them.
