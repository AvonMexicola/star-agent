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
heightfield into an excavatable volume. Mineable regional outcrops now spawn across
Selene, in addition to the five named survey outcrops. Land in a copper-rich area
and follow the mining panel's bearing/distance to a nearby copper outcrop. Ice-rich
regions favor ice; basalt regions provide sparser basalt outcrops. At transitional
boundaries, the actual deposit's composition determines its name and yield.

`src/mining/surface-deposits.js` uses deterministic spherical cells approximately
180 m across, with longitude counts shrinking toward the poles. Cells whose copper
or ice fraction reaches 45% always contain an outcrop; other cells use 40% occupancy.
Six shape variants have bases embedded in the canonical terrain normal. An 80 m
exclusion around established survey/Crescent outcrops keeps those approach paths
clear. The mining field streams at most three regional excavation workers within
400 m, alongside at most one existing named provincial worker. It retains a wider
cached descriptor neighborhood to avoid repeating terrain queries every frame.

Named survey routes still land beside their representative rocks. The nearest or
aimed regional rock now supplies the tool panel's target, range and bearing; a
faraway named survey no longer takes precedence over a local deposit.

The mineral classifier uses each outcrop's weights to create discrete warped seams.
The CPU mesher, fragment shader and carve rewards share that classifier. New surface
outcrops and Crescent sample the canonical map; space rocks keep their existing
mixed seams. The shared inventory save commits carved density and mineral collection
together. Five province routes, small ring rocks and Crescent share the same laser
and backpack interface. Regional deposits use the same persistent density and
atomic yield path. Their IDs (`selene-deposit-v1-row-column`) retain the same
position, shape and cuts through streaming/reload. Regional, named and ring deposits
share the current eight additional edited-deposit save slots. Previously edited
rocks remain editable when that limit is reached.

Verified by the five tests in `tests/resource-geology.test.js` and the existing
15 moon tests: wide province cores and orbital sampling, mineral/color agreement,
local landmarks and seam continuity, unchanged historical height fixtures, and
exact use of the canonical colors by generated ground patches. Browser appearance
is reviewed with the integrated expedition build; these numerical tests do not
claim visual approval.

Regional coverage: `tests/regional-deposits.test.js` checks arbitrary copper sites
well away from the named anchors, actual copper-favored carve rewards, polar/seam
identity, collision, bounded pending workers, saved restoration and late results.
A separate quasi-uniform probe found a matching deposit at all 44 sampled locations
with copper fraction at least 70%; the maximum nearest distance was 160.26 m. This
is sampled coverage, not a guarantee for every slope or biome boundary. The
controller journey is `scripts/regional-deposits.spec.js`; its results belong in
the current expedition QA record. Aeon biome deposits remain future work.
