# Pyre — the hot inner planet

Pyre is the third world: 1 200 km radius, 10 M km from the star (Aeon is at 25 M km), tidally locked, wrapped in a
thin dusty CO₂ atmosphere. One face bakes at 400 °C; the other is night, lit only by lava fields glowing through cracked
basalt. From Aeon it is a bright evening/morning star near the sun. No water, no vegetation.

## Playing it

- **Pyre** destination button (08) or the help menu: quick transit to **60 km above the dusk terminator**, looking
  40° from north toward the night side — day side to the right, lava fields ahead-left. Shift-click sets a course.
- **System map (M)**: select Pyre and engage the drive (0.9 c, 15–35 M km depending on where Pyre is in its orbit; a
  route through the star's 250 000 km exclusion is refused, wait or go around).
- Thin air: `L` lands, `F` stands, walk out of the ramp as on Selene. Gravity 7.6 m/s². The HUD shows
  **HULL TEMP** whenever `heat` > .3 (amber), pulsing red above .75. Damage is Phase 4.
- Debug hooks (`?debug`): `window.starAgent.state.pyre` (position, altitude, LOD, pending, mapsReady, region),
  `state.heat`, `starAgent.pyreSites` (landing, volcanoes, lava fields with a hot spot each),
  `navigation.transitPyre(altitude, direction)`. `?epoch=<ms>` pins the orbital phase for reproducible captures.

## Files

| file | role |
|---|---|
| `src/pyre-world.js` | constants, epoch-frozen orbit and body frame, the canonical sampler `pyreSurface`, landmarks, `pyreRegion`, `pyreHeat`, `constrainPyreStep`, `bakePyreMaps` |
| `src/pyre-terrain.js` | `generatePyrePatch` (halo normals, double-precision centre) and `PyreTerrain` (worker quadtree, prewarm, altitude-gated `ready`) |
| `src/pyre.worker.js` | patch + identity-map jobs; receives the page epoch with every message |
| `src/pyre.js` | `Pyre`: crust material (cracks, plates, emissive lava, roughness, derivative normals), mesh range |
| `src/celestial.js` | `PYRE` descriptor (`height`, `water:false`, `atmosphere`), `BODIES`, `bodyAt` domains |
| `src/atmosphere.js` | atmosphere slot 1 = Pyre; `setPoint` paints Pyre/Aeon as points from afar; star disc radius by distance |
| `src/navigation.js` | `transitPyre`, per-body air, swept contact, terrain-normal touchdown, no shoreline guard |
| `src/lighting.js` | `PYRE_LIGHTING` ambient profile |
| `tests/pyre.test.js`, `scripts/pyre.spec.js` + `pyre.config.js` (port 4186) | numerical and browser regression |

## Parameters (all in `src/pyre-world.js` unless noted)

**Orbit / frame.** `PYRE_ORBIT_RADIUS 1e10`, period from Kepler with `AEON_YEAR_SECONDS = 120 d` → 30.36 d. Position is
`pyreOrbitPosition(PYRE_EPOCH)` with `PYRE_EPOCH = Date.now()` (or `?epoch=`) at page load and never moves during a
session (navigation is Aeon-centred; a moving body would slide under a landed ship). Body frame: +Z toward the star,
+Y the ecliptic normal, +X leading. `pyreLatLon(lat, lon)`: lon 0 = sub-stellar, −90 = dusk terminator.
`PYRE_LANDING_BODY_DIRECTION = (13.5°, −85°)`; `PYRE_ARRIVAL_ALTITUDE 60 000`.

**Sampler** (`pyreSurfaceBody`, own seed `0x50595245`, quintic value noise, rotated fbm/ridged like terrain-v2):

| term | frequency / cell | amplitude |
|---|---|---|
| broad highland/plains `fbm(3.3, 4)` | 364 km | ±1300 m, `highland = smooth(−.02,.16)` |
| highland ridges `ridged(41, 4)` | 29 km | +900 m × highland |
| hills `fbm(700, 4)`, mid `fbm(5000, 3)` | 1.7 km / 240 m | ±45–175 m, ±17–47 m |
| wrinkle ridges `ridged(900, 3)` on plains | 1.3 km | +26 m |
| rilles `1−|noise(260)|` crest lines | 4.6 km | −55 m channels |
| fault scarps: iso-line of `noise(14)` × mask `noise(7.3)` | 86 km | 140 m step |
| shield volcanoes (7: 4 N, 3 S; 20–60 km base; 2.4–6.4 km high) | `VOLCANOES` | profile `s²(3−2s)`, lobes by angle, caldera −.13 H, rim +.035 H, radial channels, gullies `ridged(1800)` |
| craters (56, Selene formula) | radius .0028 + r²·.032 rad | depth `radius·R·.07`, bowl `smooth(.15,.94)`, rim `.36·exp(−((r−.98)/.12)²)` |
| lava fields (6, 70–260 km) | `LAVA_FIELDS` | activity = field × max(rivers `ridged(760)`, lakes `fbm(230)`·.85, .16); `glow` = smooth field heat |
| metre relief `fbm(40000, 3)`, `fbm(150000, 2)` | 30 m / 8 m | ±1.5 m, ±.35 m × (1 + 1.6 fresh + .6 highland) |
| tumuli (60 m lattice, 45 % occupancy) | 7–22 m | up to 4 m blisters on active ground |

Palette (linear): basalt `.082,.076,.07` (×0.8–1.2), highland regolith `.16,.135,.112`, ochre oxidation
`.28,.12,.048` (mask `noise(23)`, plains only), fresh glass `.032,.03,.032`, sulphur `.56,.43,.09` (vent proximity ×
`noise(1500)` patches). Lava `#ff5a1f` ≈ linear `(1, .21, .035)`.

**Material** (`src/pyre.js`): crack texture 256² (10 Voronoi cells per 16 m tile) sampled triplanar at 16 m (warped
by 2.5 m), 64 m and 256 m. Emissive = lava × strength × (cracks·hot·near + fissures·mid + broad glow·far + lakes +
ember), strength `mix(.7, 3.2, night)` with `night = 1 − smoothstep(−.06,.22, bodyZ)`. Roughness .92 → .42 on
fresh flows, .25 on lakes, .72 sulphur. Derivative normal from crack relief (.06 × detail fade to 2.6 km). Detail
fades 150–2600 m, plate mottling to 40 km, the 1024×512 identity map (glow, fresh, sulphur, oxide) from 60 km out.

**Atmosphere** (`PYRE_ATMOSPHERE`): height 45 km, plane height 12 km, surface density .09 kg/m³, Rayleigh scale
height 6 km / Mie 2 km, `betaR (2.0, 3.4, 6.4)e-6`, `betaM (6.5, 4.4, 2.4)e-6` (ochre dust), g .70, gain 11.
Aeon's slot keeps the original constants (`AEON_ATMOSPHERE`). Slots are skipped beyond 400 body radii.

**Lighting** (`PYRE_LIGHTING`): hemisphere sky `0xa8704c`, ground `0x3a1a10`, ambient `.15 + .3·daylight·e^(−alt/40 km)`,
environment .06. Sun stays 3.4 (physically 6× Aeon's irradiance; ACES would clip).

**Streaming** (`PyreTerrain`): 3 workers, split at `2.3 × patch width`, min level 3 within 12 R, in-flight budget
64 below 5 km / 32 below 100 km / 16 above, `prewarm(direction, 9)` during the transit, `ready` = no pending jobs and
`maxLevel ≥ 12` below 2 km (7 below 100 km, else 3). Eviction above 1100 nodes after 8 s; siblings stamped.

**Heat** (`pyreHeat`): `low = 1 − smooth(25 km, 160 km, altitude)`; `heat = low·(.12 + .88·smooth(−.12,.45, up·sun))
+ .45·activity·(1 − smooth(20, 400, altitude))`, smoothed at 0.7 s in `main.js`.

## Tuning

- Lava too bright/dim: `pyStrength` (night 3.2, day .7) in `pyre.js`; coverage: the `pyHot` gate `smoothstep(.45,.78,…)`.
- Glow from orbit: `glow` in the sampler (lakes weight .78) and `pyFarGlow` (.6).
- Haze: `betaM`/`mieScaleHeight`; a 2× increase blows out the day-side limb.
- Relief at walking scale: the two `fbm(40000/150000)` bands and `pyRelief` (.06).
- Landmarks: edit `VOLCANOES`/`LAVA_FIELDS` (lat, lon, radius km); keep the landing site inside a field's reach and on
  the terminator (`|body z| < .08` is asserted by `tests/pyre.test.js`).
- More patches per frame on a real GPU: `budget` in `PyreTerrain.select`.

## Known limits

Epoch-frozen orbit (no in-session motion); no clouds/dust storms; no volcanic plumes or particle effects; heat has no
gameplay effect yet; no scattered props; the crust texture is procedural and repeats every 256 m at 16 m tiles;
SwiftShader captures prove rendering, not frame rate.
