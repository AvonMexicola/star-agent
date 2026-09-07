# Independent station LOD follow-up

7 September 2026, 10:48 UTC. Reviewer: `/root/kestrel_reviewer`.

**Scoped result: the distant geometry does not materially harm silhouette in these two overview views.** Both complete rings, their six spoke directions, concentric hub silhouettes and the connecting port structure retain the earlier checkpoint's readability. Small edge details are less pronounced at this distance; no conspicuous missing mass or broken rim appears in either image. This closes the sampled distant-view triangle concern while preserving the original review's limitations.

The production 5400 capture used the same isolated dev session, exact camera poses, 52° FOV and hidden-ship checks as my valid earlier comparison. It verified the served bytes before rendering:

- Hero: `5b39b183030d529a710de0b2dad308a36a8e597b067d3061d82f01bb721b76e6`, 2,600,828 bytes.
- Distant: `ec98e225e57bbadb18c4c4567614bab2c5a23694e16effeeba99a4ce0b5ffdcb`, 1,206,036 bytes.

Chromium 151.0.7922.173; ANGLE / AMD Radeon 860M / radeonsi krackan1 ACO / OpenGL ES 3.2; 1440×900 drawing buffer, render scale 1. The one browser case passed in 53.4 seconds (56.6 seconds including runner startup), with zero browser warnings, console errors or page errors. The terminal emitted only the usual runner colour-environment notice. One approved outside-sandbox launch was used. No CPU suite ran.

| Own image | Eye → target, complex-local metres | Actual scene draws | Actual scene triangles |
|---|---|---:|---:|
|[Quarter overview](overview-quarter.png)|[−4484,2484.3,−4956] → [0,−35,0]|126|319,806|
|[Ring-face overview](overview-ring-face.png)|[−5600,1100,−1800] → [0,−35,0]|163|393,406|

Both sampled frames meet the 300-draw/400k orbit count limits. The ring-face snapshot has only 6,594 triangles of headroom. These are whole-frame counters, including the world and render passes. World LOD/streaming can alter the totals, so the quarter's entire reduction from the earlier 439,858-triangle image must not be attributed solely to the new exterior. This is **not an FPS or frame-time result**, nor an all-angle performance certificate.

The [raw evidence](evidence.json) records `exteriorDetail:lod1`, a visible LOD group, hidden hero fixed/ring assemblies, and actual `onBeforeRender` calls from LOD meshes: 506 and792 respectively, with zero hero calls after each camera placement. Those callback totals only prove rendered geometry ownership; they are not per-frame draw counts. Both cameras matched their requested coordinates within 0.1 mm, stayed in first-person walk mode, and had `shipVisible:false`. All eight conservative station-envelope corners fit within 90% of the viewport. I opened and inspected both saved PNGs.

Comparison is against my earlier independently captured authored checkpoint (`079f7262…444334a8`), not a new paired render of the latest hero. This bounded follow-up did not cross the LOD threshold, inspect near details, or review collision and motion transitions.

**Original scores and material gate remain unchanged:** silhouette 4.0, materials/detail 2.8, lighting 3.5, cohesion 4.0; function and motion pending; no complete rubric average. The original centre-mass, bearing-surface, rim-pattern and finishing recommendations remain applicable. Final textures and final art approval are still pending. Production sources and prior review evidence were untouched. GPU released after capture.
