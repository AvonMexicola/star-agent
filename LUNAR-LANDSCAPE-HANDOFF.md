# Lunar landscape upgrade — Fable/Claude handoff

Cees requested a Cellin-inspired moon with more interesting slopes/craters,
sunlight-reflecting ice particles and majestic asteroid rings.

Review: [PR #15](https://github.com/AvonMexicola/star-agent/pull/15).
Branch: `feat/lunar-landscape`, based on merged `feat/visual-fidelity` f028a43.
Isolated worktree: `/tmp/star-agent-lunar-landscape`.
Local production preview: http://127.0.0.1:5178/ . Select Selene, L lands, F stands,
walk aft/open the hatch and explore. Keyboard/controller boarding remains physical.
The preview is the user service `star-agent-lunar-landscape.service`.

## Delivered

- Generator v3: stronger global relief, deeper crater bowls/rims/ejecta, 36 local
  basins, broken peaks and basalt outcrops in the canonical walking heightfield.
- A level 35 m landing shelf on a crater rim, blending into the terrain by 150 m.
- Cool regolith/frost material with small-scale relief and height-dependent bands.
- Four tilted ring bands with gaps, distance-filtered striations and lunar shadow.
- 1,800 instanced, irregular asteroids with surface variation and lunar shadow;
  broad dust fades near the observer so a close approach resolves into rocks.
- Deterministic lofted ice cells, subtle drift and sunlight glints, reusable GPU
  attributes and no wind/atmospheric drag.
- Faster patch sampling through a shared halo for normals, plus deeper skirts for
  steep terrain. Rendering/contact still share the authoritative surface function.
- Updated player docs and durable planet pipeline memory.

## Merge boundaries

Owned runtime files: `moon-world.js`, `moon-terrain.js`, `moon.js`, new
`moon-rings.js`, new `moon-ice.js`. The two `main.js` hooks supply elapsed time/
inside-ship state to Moon and expose effect diagnostics. `atmosphere.js` has the
small transparent-HDR composite fix required to retain rings/ice over stars.
Logarithmic depth reconstruction is unchanged. Preserve these changes when merging
travel or camera work; don't copy isolated main.js wholesale over other lanes.

The lunar generator's upper terrain bound is now 16,000 m. The separate system
travel contribution already uses a 20,000 m lunar exclusion margin, which still
covers this bound. Asteroids are scenery, not collision/drive hazards or new map
bodies. The lunar position/radius and navigation domain remain fixed.

Navigation implementation is not modified here. `tests/navigation.test.js` adds a
walk from the shelf into the sloping crater. Keep the separate crash contribution's
lunar surface-normal impact check when that branch is merged; this branch inherits
the already-merged moon behavior. Existing camera/equipment/travel lanes are separate.

Shared checkout: coordination notices only; no runtime source replacements.
Implementation and evidence are committed on the isolated topic branch. Review,
merge and deployment remain with the manager, following the established queue.

## Validation and limits

All 75 unit cases pass; production build passes. Both dedicated production browser
cases pass: the full land/walk/jump/reboard/launch journey, and the orbital/surface/
asteroid/Aeon render tour. The visual case was rerun after close-range refinement.
No page/console errors. Numerical checks cover slopes >20°, terrain range/bounds,
crater depth, landing shelf, polar/seam continuity, ring gaps, body clearance,
asteroid precision, particle persistence and resource cleanup.

Evidence: `/tmp/star-agent-lunar-landscape-evidence`; curated screenshots under
`docs/selene-rings.png`, `docs/selene-crater-country.png`, `docs/selene-asteroid.png`.
Chromium 151.0.7922.173, ANGLE/Vulkan SwiftShader, 1280×800; gameplay render scale .55,
visual tour .8. No hardware FPS claim. The first visual iterations exposed speckled
transparency and overly detailed distant normals; the delivered version corrects
those and avoids replacing ice buffers when cells change.

Known limits: synchronous/discrete lunar LOD, soft geometry cache with retained node
metadata, decorative asteroid belt, artistic ice drift (no thermodynamic simulation),
no mining/asteroid impacts, no ring shadow cast onto the lunar ground, and no orbit
simulation. The terrain is a heightfield, so it has no overhangs or caves.

See `docs/selene-landscape.md` and the v3 section of `PLANET-PIPELINE-MEMORY.md`.
