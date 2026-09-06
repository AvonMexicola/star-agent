# Selene resource geology

Selene's surface color now communicates mineral composition from orbit down to
walking distance. Rust-red terrain marks copper-rich geology, blue-white terrain
marks ice-rich geology, and dark slate marks basalt. These are weighted mineral
fields, so transitions blend and trace minerals remain present.

The broad Frostwall Ice Province and Copper Ejecta Province extend across roughly
145–150 km radii near the familiar landing hemisphere. North Glass Fields, Far
Copper Basins and South Ice Fields provide additional visible targets around the
moon. Their broad cores are sampled across multiple vertices even on the coarse
orbital fallback mesh. Province edges follow deterministic spherical contours;
there is no separate orbital texture whose features disappear at ground level.

The existing Glass Rift, Frostwall, Copper Ejecta and Obsidian Crown retain their
local identities. Their geological masks override the broad fields near the
landing district. Crater geometry, mountain heights, collision terrain and the
level landing shelf are unchanged.

`moonResources(x, y, z)` accepts a normalized lunar direction and returns:

- `weights`: normalized fractions in `[basalt, copper, ice]` order.
- `dominant`: `basalt`, `copper` or `ice`.
- `province`: the regional label.

`moonSurface(...).resources` exposes the same classification and `.resource` the
dominant mineral. Its RGB color blends `MOON_RESOURCE_PALETTE` using those exact
fractions, with the existing fine grain and crater ejecta detail. Ice fraction
also affects surface frost roughness. `RESOURCE_PROVINCES` exports stable `id`,
`name`, normalized `direction`, `resource` and radius in metres for scanners,
survey routes and resource-biased deposits. `MOON_RESOURCE_VERSION` is 1; geometry
remains at the existing terrain generator version.

The API identifies the local material profile; it does not turn the entire
heightfield into an excavatable volume. The expedition now streams one representative
outcrop at each province center, with at most one live provincial worker. Named
survey routes in the shared command menu place the ship beside the outcrop.

The mineral classifier uses each outcrop's weights to create discrete warped seams.
The CPU mesher, fragment shader and carve rewards share that classifier. New surface
outcrops and Crescent sample the canonical map; space rocks keep their existing
mixed seams. The shared inventory save commits carved density and mineral collection
together. Five province routes, small ring rocks and Crescent share the same laser
and backpack interface.

Verified by the five tests in `tests/resource-geology.test.js` and the existing
15 moon tests: wide province cores and orbital sampling, mineral/color agreement,
local landmarks and seam continuity, unchanged historical height fixtures, and
exact use of the canonical colors by generated ground patches. Browser appearance
is reviewed with the integrated expedition build; these numerical tests do not
claim visual approval.
