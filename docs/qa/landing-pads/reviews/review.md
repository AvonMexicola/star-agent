# Independent landing-pad review — 2026-09-07

Reviewer: /root/pad_review, separate agent session, no application/source edits. Candidate: uncommitted working tree based on 05f83d14a541afbe2711510b4a9ab799857d12ab. Parent confirms source unchanged during captures.

Own native capture run: `TMPDIR=/home/cees/.cache/star-agent-browser-tmp node /home/cees/.cache/star-agent-pad-review/review.mjs`; exit 0. Chromium 151.0.7922.173, ANGLE AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2, 1440x900. Existing isolated Vite service localhost:5557; one browser, closed after run. No page errors, console errors or warnings. See diagnostics.json.

Read-only scope: working diff from HEAD, new pad-kit.js/pad-markings.js/unit tests, builder and loader integration. Own S/L baseline, grazing, three moving-camera snapshots per size, corresponding video and same-camera marking receiveShadow toggles. Additional supplied S night/off, M daytime and actual on-foot gameplay screenshot inspected. Full controller journey and unit suite results are parent-reported, not independently rerun.

## Findings

1. P2 visual artifact, src/build/visuals.js:67: own baseline reproduces dark peppering across the painted H and thin deck streaks on L. The grazing S view makes peppering clearer. Disabling receiveShadow on the marking mesh at the SAME camera leaves these artifacts visible, so a receive-shadow acne explanation alone is ruled out. White paint was generated as solid fills, and no intentional wear is drawn over the H. The marking plane is 5 mm above the top and very close to buried expansion joints/armour. Depth interference is a plausible cause, not yet a fully isolated diagnosis. Test depth separation or apply paint to the underlying top geometry; avoid accepting a polygon-offset change without checking its behavior with logarithmic gl_FragDepth. Parent-supplied actual on-foot capture has a clean H, so this is demonstrated in the native studio renderer and is not proven at that gameplay pose.

2. P3 lighting polish: powered night side lenses are distinctly dimmer than the bright corner pools; the ramps are barely visible. Power/off state remains truthful. No claim that every lens requires a separate dynamic light; preserve the shared four-light budget.

The fixed 0.6 m ramp drop versus the pad's 8 m terrain clearance is explicitly documented in docs/base-building.md and the pipeline. Reclassified from an initial potential P2 to a known access limitation: edge approaches do not promise terrain connection for elevated pads. No new unsafe transaction finding was established.

## Scoped visual scores

Silhouette and scale 4: S/L dimensions and human reference read clearly, entrances are distinct.
Materials and detail 4: purposeful paint/deck/ramp separation and concrete side detail; unresolved peppering limits finish confidence.
Lighting and integration 3: coherent daytime rendering and truthful switching, dim night approaches.
Cohesion 5: white/dark/mint palette and manufacturing vocabulary closely follow the existing kit.
Information and physical function 4: H, white boundaries, approach gaps and dimensions communicate intended surface; elevated access remains documented.
Motion 3: bounded 2.1-second camera movement per size and three resulting frames preserve overall geometry, but fine surface interference remains unresolved. No long-range LOD or mechanism acceptance.

Average 3.83, minimum 3. Final visual acceptance requested changes / incomplete until the surface artifact is resolved or explicitly scoped out by product authority. Development checkpoint remains possible with accurate limitations. No deployment authority granted.

Measured native studio counts: S 25 draws/6,400 triangles; L 25 draws/11,944 triangles; each 13 geometries/4 textures. These are scene counts including ramps, ground and reference figure, not isolated asset budgets or FPS acceptance. No physical controller, touch journey, long traversal, memory-growth or hardware frame-time validation performed.

Reviewed GLB hashes (SHA-256):
- S 91db3035c9765ca6a71f69c2c3b82c9ae4bc7b63753916feeee72b057cdf03fd
- M 8e9bca205f8612e60642d2060d50414fdb8c48a2d9e0e1a8def74e26b35a0275
- L c768045bf73c6139e33ba101818d49896413c3ccba1dd1d1cb5b488879572afe

## Follow-up depth isolation

Parent authorized one additional bounded native experiment. `depth.mjs` exited 0; browser closed; no application files changed. Same S baseline camera and five corresponding depth-*.png captures:

- baseline reproduces peppering.
- polygonOffset enabled, factor -1 / units -2, material recompiled: peppering remains.
- original polygon offset disabled, marking y=.03: H is clean, but all recessed lens hardware is hidden underneath the lifted opaque surface, leaving source-less light pools.
- marking y=.008: H remains peppered and bezel visibility is reduced.
- marking y=.005, underlying GLB meshes hidden: H is clean.

This establishes interference with underlying geometry rather than paint texture or receiveShadow as the cause. Final acceptance remains held. Recommended correction: paint the actual slab top with appropriate top UV/material assignment, or remove the hidden overlapping slab top only for the marked state while preserving sides/bevels and the undesignated plain deck. A lift-only fix must also preserve visible light hardware and be checked at grazing angle; .03 by itself fails that requirement. Runtime depthTest must remain enabled.
