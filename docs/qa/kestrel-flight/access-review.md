# Independent Kestrel access and collision audit

CPU review of `/tmp/star-agent-kestrel-flight`, 7 September 2026. Re-run with `node docs/qa/kestrel-flight/access-audit.mjs`; detailed output is `access-audit.json`. No source, geometry, texture or animation changes were made by the reviewer. No browser or GPU result is claimed here.

Asset SHA-256: `c48ed4e94b823f1f585e5d389ba8c88776731034025a7620162c8c3a5eb13b8a`. Actual access source SHA-256: `a977be804ed4c46025b553d9b345f359be0b7fc4d21503a2cf98ab1ef1f664a8`. All coordinates below are metres in game axes: +Y up, −Z forward. The asset origin is its deployed gear contact plane.

## Result and scope

The current `KestrelAccess` route clears a 0.12 m camera sphere. Every fully open linear route segment was sampled at no more than 0.01 m spacing, and the minimum distance also exceeds the sphere radius plus half the sample interval. That supplies an in-between-sample clearance bound for those static linear segments. The smallest triangle distance is 0.24265 m, beside the open canopy at eye `[-0.62, 3.55, -1.75]`; the sphere has approximately 0.123 m spare radius clearance.

The real exported class, with its actual `interact()` and `update()` implementation, was also simulated in both directions at 120 Hz against contemporaneous GLB animation poses. Inbound completed in 17.958 s; outbound in 11.708 s. Both had zero sampled sphere intersections and maximum eye displacement 0.0075 m per update, consistent with the authored 0.9 m/s movement. This uses an identity ship transform and flat authored station ground; it is not an end-to-end Navigation, keyboard, touch or controller test.

A separate ground-only standing capsule uses radius 0.25 m, total height 1.87 m, feet at eyeY − 1.75 m. Exact triangle-to-axis distance checks clear the closed-mechanism route from x −2.45 to −3.1, the wait at −3.1 during staged deployment, and the fully deployed return approach to −2.45. In each test no surface was within 0.5 m of the capsule axis, leaving at least 0.25 m radius clearance at samples. Ground approach samples are 0.01 m apart, giving at least 0.245 m spare clearance between samples. Mechanisms were sampled every 0.01 s; these dynamic capsule checks are sampled evidence, not a continuous-time proof.

The earlier waiting point at x −2.45 is unsafe while the ladder unfolds: the lower ladder crosses the standing capsule axis at deployment time 4.27 s, and a separate head test found 0.089 m sphere penetration. The current source resolves this by walking continuously to x −3.1 before either mechanism starts. The actual simulation confirms canopy and ladder progress remain zero until that staging position is reached. The failing old-position diagnostics are intentionally retained in the JSON.

No articulated pilot body, hand contact, climbing animation or seated human capsule is certified. A full standing capsule cannot simply be applied throughout the crouched cockpit route. The JSON's older `cameraPath` centre-line experiment is exploratory evidence only; `accessRuntimeAudit` is the current-source result.

## Physical access geometry

| Feature | Actual location / extent |
| --- | --- |
| Pilot eye | `[0, 2.49000001, -1.89999998]` |
| Port ladder axis | x −1.74; centre z −1.75; rungs span z −1.97 to −1.53 |
| Lowest / highest tread top | y 0.0894 / 2.2110 |
| Intermediate tread tops | y 0.3624, 0.6510, 0.8694, 1.1424, 1.4310, 1.6494, 1.9224 |
| Ladder foot contacts | x near −1.74, z −1.97 and −1.53, y 0 |
| Upper hinge knuckle top | y 2.411385 |
| Five bridge tread centres | x −1.67, −1.49, −1.31, −1.13, −0.95; z −1.75 |
| Bridge tread top / width | y 2.292500; z width 0.43 |
| Fixed sill step | x −0.93 to −0.57, z −1.98 to −1.52; top y 2.195 |
| Inner port liner / console tops | y 1.965 / 1.82 |
| Seat cushion top at pilot station | y 1.675 |

The bridge drops approximately 9.75 cm to the fixed sill. The upper knuckle is higher than the bridge, so the current eye route rises to y 4.18 across x −2.08 to −1.65 before stepping onto the bridge. The ladder's inner rail width is narrower than a 0.5 m standing capsule; the climb centre correctly stays outboard at x −2.08.

Open canopy port seal geometry at x −0.55, z −1.75 occupies approximately y 3.999–4.067. The current eye lowers to y 3.65 at x −0.95 and y 3.55 at x −0.62 before entering. The earlier eye-height-4.05 crossover was obstructed. The `Seat` marker survives as an empty frame, but its visible geometry was batched into `Cockpit__PBR`; an empty-node bounding box must not be treated as the physical seat bounds.

## Collision envelopes

Closed canopy and stowed ladder, with deployed gear: min `[-4.5, 0, -6.751048088]`, max `[4.5, 3.198826790, 6.75]`. With gear stowed the minimum y rises to 0.893000007. The nose extends about 1.05 mm beyond the nominal 13.5 m body length because of exported geometry.

The JSON supplies six longitudinal static flight slabs derived by clipping actual world-space triangles, plus three conservative gear motion boxes in `proposedFlightParts`. Their z divisions are −6.76, −4, −2.5, 0, 2.8, 5.5 and 6.76. These preserve the narrow nose and empty region beneath the raised fuselage instead of using a Nomad cabin-sized solid box.

`walkingStaticSlabs` contains 55 quarter-metre longitudinal slabs excluding canopy, ladder and gear. `parkedGear` contains the three deployed gear bounds separately. Parent has copied these into the integration layout with outward millimetre rounding. The main and nose gear differ longitudinally:

| Gear | Deployed bounds: min → max |
| --- | --- |
| Nose | `[-0.230, 0, -4.476536]` → `[0.230, 1.700098, -3.530]` |
| Port main | `[-1.680, 0, 3.013464]` → `[-1.220, 1.700098, 3.960001]` |
| Starboard main | `[1.220, 0, 3.013464]` → `[1.680, 1.700098, 3.960001]` |

Gear animation bounds use 1,201 exact sampled poses, then a conservative ancestor-track speed bound times half the sample interval to cover continuous motion between samples. The resulting added margin is approximately 18 mm; raw sampled extrema remain separately available. This assumes the current rigid rig and exported GearDown action. Future independent oleo compression or other gear deformation requires a new bound.

All skin boxes are conservative AABBs and can block empty space within their individual slab. Afterburner emission geometry is excluded. The access corridor is a prescribed climb/crouch/seat route, not a free-walking cabin or EVA hatch. Actual terrain slope, station constraints, save isolation and all input paths remain subjects for the separate integration review.


## Station launch correction

The initial generic continuous-motion margin extended the gear boxes 19 mm
below the deck and made the station sweep reject lift at time zero. The
independent `gear-floor-audit.mjs` proves the rigid rig remains above its contact
plane, using analytic vertex/angle bounds plus 3,601 encoded quaternion subposes
per gear. `gear-floor-audit.json` records those bounds and the failing/passing
station sweeps. Runtime now uses minY 0 for all three gear envelopes and the
overall bounds; padded x/z and maxY remain unchanged. Camera-route source and
poses are unchanged by this single envelope correction.
