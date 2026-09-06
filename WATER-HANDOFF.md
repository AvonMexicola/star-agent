# Ocean distance fidelity

Cees reports severe repeating water detail when flying higher. Work is isolated
in /tmp/star-agent-water-work, feat/ocean-distance-fidelity, based on integration
3f7d470. Manager owns merge/deployment. Opening PR #12 and travel #11 remain
separate branches; this change is limited to ocean rendering and its tests.

The live water material previously reused the terrain detail texture at exact
64/16/4 metre periods. It faded slope detail by camera range without transferring
that missing wave variance into the specular lobe. The replacement uses five
procedural spatial scales with integer cell hashes, smooth height gradients and
CPU-split camera origin anchors. Surface waves stay fixed in world space while
advection changes them over time. There is no texture tile or patch-specific phase.

Pixel derivatives filter waves by their projected footprint, including grazing
views and reduced render scale. Unresolved slope energy broadens the microfacet
sun reflection. A filtered 6.1 km field varies wind roughness; it does not displace
the surface or add periodic giant swells. Shore depth still comes from the terrain
worker; foam, polar ice, sea level, terrain skirts and collision remain consistent.

Files: water.js, water-field.js, minimal water-only planet.js wiring, package.json
test inclusion, tests/water-field.test.js and scripts/water.config.js/spec.js.
No new dependency or asset download. The unused ocean.js prototype is untouched.

## Validation and evidence

78 unit cases and the production build pass. The baseline ocean tour passes;
the final shader's complete altitude/horizon tour passes without console or page
errors. The initial browser run caught a GLSL reserved identifier that the build
could not detect; it was corrected before these final passes. A fixture initially
asserted AGL as sea-level altitude over distant land; it now checks world radius.
Sol reviewed uniform compatibility, unsigned hashing and origin continuity; fixes
also filter macro wind, safely normalize the night-side half vector, and match
CPU rotation coefficients to the exact Float32 matrix uploaded to the GPU.

Curated matching 2 km and 20 km screenshots are committed under docs/images;
docs/water-fidelity.md displays them. Six baseline views and seven final views
include native resolution; wave phases differ. No visible texture-grid repetition
or patch-phase seams were observed in the inspected views.
The dedicated tour captures matching views at 40/300/2,000/20,000/100,000 metres
above sea level, the grazing horizon and a sampled zero-height shoreline. Internal
resolution is native 1440x900. The baseline is the unmodified integration build
at /tmp/star-agent-water-before; WATER_BASELINE=1 selects it. The normal command
builds the current shader: npm run test:browser -- -c scripts/water.config.js.
Screenshots are written to /tmp/star-agent-water-before-*.png and -after-*.png.
Camera placement is a diagnostic test fixture, not a gameplay shortcut.

This remains optical wave shading on the shared sea-level mesh. It does not add
wave geometry, buoyancy, underwater rendering, reflected ships, reflected terrain
or simulated breaking surf. No hardware FPS target has been measured here.

The separate final shallow-shoreline case also passes with no browser errors;
its screenshot was inspected for shared land/sea boundaries and depth colour.
The altitude/horizon and shoreline cases passed in separate invocations. Local
production preview is running at http://localhost:5179/ (HTTP 200 verified).
The preview retains normal orbital boot and flight controls; opening is separately
available at http://localhost:5178/ until manager integration.
