# Our star

`src/sun.js` turns the light source into a place. From Aeon the star is still the painted disk in the
atmosphere pass; fly toward it and a real 240 000 km sphere with a corona, prominences and hull heating
takes over. Nothing flies closer than three radii.

## Numbers (world.js / sun.js)

| Constant | Value | Meaning |
|---|---|---|
| `SUN_RADIUS` | 240 000 km | photosphere radius (was an implicit 120 000 km) |
| `SUN_DISTANCE` | 25 M km | Aeon → star |
| `SUN_ANGULAR_RADIUS` | asin(R/D) = 0.0096 rad | disk from Aeon, ~1.1° across — twice the previous 0.0048 |
| `SUN_STANDOFF` | R / sin 17.5° = 798 122 km | arrival: the disk fills 35° (`SUN_STANDOFF_ANGLE`); limb rays are tangents, so sin, not tan |
| `SUN_EXCLUSION` | 3 R = 720 000 km | drive refuses, manual flight clamps (`constrainSunStep`) |
| `SUN_HEAT_RANGE` | 5 M km | `sunHeat(d)` = 0 here, inverse-square to 1 at the exclusion sphere; 0.81 at the standoff |
| `SUN_SPHERE_RANGE` | 3 M km | the sphere/corona render inside this |
| `SUN_DISK_FADE` | 2–3 M km | the atmosphere-pass disk fades out here (`sunDiskWeight`) |
| `SUN_ROTATION_PERIOD` | 600 s | one turn; a ~25-day period compressed so spots drift within a session |
| `SUN_AXIS` | ⟂ Aeon line of sight, nearest +Y | spots drift left → right from the standoff |

## Rendering (3 draw calls, all in the main scene before the atmosphere pass)

1. **Photosphere** — `SphereGeometry(SUN_RADIUS,128,64)`, depth-writing `ShaderMaterial`.
   Granulation: two cellular (F2−F1) octaves under a slow fbm domain warp (`granuleScale` 60 → cells ~4 000 km
   with a 1 500 km fine octave; real 1 000 km granules would be sub-pixel from the standoff). Limb darkening
   `1 − u·(1−μ)^0.8`, `u = (.56,.76,.92)` so the limb goes orange-red. Sunspots: round cells inside
   low-frequency groups, confined to two latitude bands, rotating with the mesh. Faculae brighten near the limb.
   Flares: three sites with `flareCurve` (1.8 s rise, 14 s decay, 75–119 s periods). Chromosphere tint at μ→0.
   Output is linear HDR; ACES in the atmosphere pass clips above ~4, so the disk sits near 1–1.5 (hue and
   granulation survive) and faculae/flares reach 5–30 (white). Far away `brightness` lifts to ×12 so the
   hand-off from the painted white disk does not pop.
2. **Corona billboard** — a camera-facing plane through the centre, `CORONA_EXTENT` 3.2 R, additive, no depth
   write. The sphere occludes it inside the silhouette; `rimRadius = d/√(d²−R²)` is where the silhouette lands
   on the plane. Falloff `k^-3.5` × (broad fbm streamers + fine rays), pearly white → blue tint outward, faded
   by `coronaStrength` as you approach. Chromosphere rim (pink ring + spicule fringe) at `rimRadius`.
   Prominences: `PROMINENCE_COUNT` = 8 half-ellipse ribbons anchored on the limb, animated plasma noise;
   `prominenceState` cycles alpha and height (two loops lift to 3× and detach over their 110–300 s cycle).
3. **Glare quad** — full-screen additive: core bloom + `r^-2` halo + anamorphic streak + 3 ghost discs on the
   line through the frame centre. Intensity ∝ `sunVisibility` (fraction of the disk not behind Aeon/Selene;
   `sun.occluders` is an array other bodies can push to) × `0.6·clamp(0.02/angular, .12, 1)` (a big disk
   lights the frame by itself) × (1 − 0.35·atmosphereFraction) × in-frame fade.

`atmosphere.js` was changed in three places: `sunDisk` scales its painted disk; space pixels add the scene's
HDR colour on top of the stars (so additive, depth-less light survives the pass and gets tone-mapped); and a
`heat` uniform drives a screen-space shimmer (value-noise UV displacement, ≤ 0.6 % of the frame) plus a faint
warm tint. `atmosphere.setSun({disk, heat})` is called from `main.js` every frame.

## Hand-off between the painted disk and the sphere

- ≥ 3 M km: sphere hidden, atmosphere disk at full weight (Aeon, Selene, the station).
- 3 M → 2 M km: sphere visible at ×12 brightness inside the painted disk; the painted disk (only its 4 % soft
  rim is ever visible outside the sphere) fades 1 → 0.
- ≤ 1.5 M km: sphere at ×1, corona/prominences/chromosphere fully in charge.

## Travel and safety

- `celestial.STAR` (not a navigation domain — `bodyAt` never returns it), `TRAVEL_TARGETS` entry `star`
  (exclusion 3 R, arrival `SUN_STANDOFF`), `system-map` button, quick-transit destination 08,
  `nav.transitStar()`. `planTravel` refuses routes through the star's exclusion sphere.
- Manual flight: `constrainSunStep` in the navigation swept loop clamps to 3 R and toasts
  "HULL TEMPERATURE CRITICAL". HUD: `#flight-state` shows `HULL TEMPERATURE HIGH/CRITICAL · n%` (amber) from
  heat 0.5, `#altitude-reference` reads FROM OUR STAR inside 5 M km, biome reads OUR STAR · CORONA.
- `window.starAgent.state.sunHeat` (0..1) and `state.sun.{distance, angularRadius, visibility, sphereVisible,
  glareVisible, diskWeight}` are exposed; `starAgent.sunApproach(radii)` (debug only) places you at n radii.

## Tuning

- Colour/exposure: `vec3(1.35,.60,.15)` base in the photosphere shader; `brightness` uniform.
- Granule size: `granuleScale` uniform (cells ≈ R·2π/scale... 60 → ~4 000 km).
- Corona reach/brightness: `CORONA_EXTENT`, the `pow(k,-3.5)` exponent and the `1.5` multiplier.
- Prominence look: the `2.8` multiplier, `PROMINENCES` heights (.05–.19 R).
- Glare: `0.6·clamp(0.02/angular, .12, 1)`; ghost sizes `S[]`, positions `K[]`.
- Heat haze: amplitude `.006/.002` and `smoothstep(.55,1,heat)` in `atmosphere.js`.

Tests: `tests/sun.test.js` (angles, standoff, registry, exclusion clamp, heat curve, hand-off, rotation/flares,
occlusion) and `scripts/sun.spec.js` (`npx playwright test -c scripts/sun.config.js`: map registration, quick
transit, standoff HUD, exclusion clamp, draw calls, zero console errors).
