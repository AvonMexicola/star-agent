# Kestrel game flight and Meridian identity

Integration of the reviewed Kestrel asset into the production game, 7 September
2026. The branch includes flight-options PR #38 and asset PR #40, with integration
PR #34 underneath. Its merge target is `main`; these dependencies must be reviewed
together or merged first. No main merge or production deployment is implied.

## Scope

- Shared Meridian Shipworks vector emblem, transparent decal raster, identity
  metadata, fleet lockup and Kestrel studio/flight branding.
- Kestrel fleet selection and `/?ship=kestrel&intro=0` temporary station start.
- Reviewed pilot eye and collision dimensions, continuous port-ladder access,
  launch interlocks, shared gear clock, interceptor handling and four live MFDs.
- Authored engine effects; four empty S2 mounts with ship firing disabled.
- Zero ship cargo capacity, model-load rollback/retry and normal-save isolation.

The original GLB is unchanged: 2,331,576 bytes, SHA-256
`c48ed4e94b823f1f585e5d389ba8c88776731034025a7620162c8c3a5eb13b8a`.
The asset's independent visual gate remains recorded under `../kestrel/`.
That studio result does not itself certify game integration.

## Source and geometry verification

`npm test` passed all 68 configured files (27.24 s). The production build passed.
Focused checks cover continuous boarding at 20/60/120 Hz and billion-metre world
positions, launch/gear interlocks, remote and airborne interaction rejection,
fighter walking/EVA collision, exact station-floor lift clearance, fleet
persistence and zero-capacity supply/mineral inventory.

Independent CPU review passed six integration cases using the actual fleet
selection callback and GLB adapter. It checked load failure/retry, asynchronous
cargo and departure guards, actual MFD state, rig sampling, empty mounts and
power-off behavior. See `integration-review.md` and `integration-audit.json`.

The independent access audit checked original GLB triangles against the actual
climb route and gear poses. Its camera sphere clears the canopy and ladder;
the standing ground approach moves away before the ladder unfolds. See
`access-review.md` for the measurements and the limits of this controlled-eye
route. No articulated climbing body is certified.

The initial conservative gear margin extended 19 mm below the station floor,
which made the real station collision sweep reject takeoff. The independent
continuous rig proof justifies a tighter floor bound of zero while preserving
all other padded axes. The regression calls the actual station sweep for every
fighter collision part. See `gear-floor-review.md` and `gear-floor-audit.json`.

Review also caught an inherited ship-visibility condition in unlocked flight;
Kestrel now remains visible. All four MFDs fit the current cockpit framing.
The misleading power-off seat-exit and EVA rear-ramp hints were corrected for
the single-seat fighter after the source report was written.

## Production browser verification

The full production journey passed **1/1 in 1.8 minutes**, using Chromium 151,
AMD Radeon 860M through ANGLE/OpenGL ES 3.2, 1440 × 900, DPR 1. It recorded zero
console errors, warnings or page errors. See `browser-evidence.json`.

The check starts with a real-storage sentinel, enters the temporary Kestrel
session, opens the Meridian fleet selector, exits through the physical ladder,
returns to the cockpit, checks launch interlocks, lifts from the pad, retracts
gear and flies beyond the hangar. It also checks inertial coasting, rejects an
in-flight cockpit exit, lands on Selene with deployed gear and uses the ladder
again on the surface. The real-storage sentinel is unchanged and the real fleet
save key remains absent.

The surface approach uses the existing explicit quick-transit fixture. The
subsequent assisted descent, touchdown and surface exit use actual game input;
this is not evidence of an uninterrupted station-to-moon voyage.

Curated captures were inspected for actual rendering and readable framing:

- [Flight start](00-flight-card.png) and [four live MFDs](01-cockpit.png).
- [Meridian fleet selector](02-meridian-fleet.png).
- [Station ladder endpoint](03-port-ladder.png).
- [Flight outside the hangar](04-exterior-flight.png).
- [Surface ladder endpoint after touchdown](06-surface-ladder.png).

Earlier failing runs found a hidden start button, a test's modal-close timing
race and the floor-bound defect described above. Those failures were corrected
before the successful journey. The first touchdown screenshot caught the HUD
before repaint and is omitted; the harness now waits for its landed label.
These are root's captures; the independent reviewer inspected inherited cockpit,
fleet and station-ladder images, and performed the separate CPU audits above.

## Limits

The access sequence controls a first-person eye trajectory and hides the avatar;
there is no articulated climbing animation or free-walking fighter cabin.
Collision uses conservative slabs, not triangle-exact flight physics. Suspension
forces, installed weapons, fuel use and heat damage are outside this change.
No physical-controller or hardware FPS claim is made. The game's Atlas remains
the existing 30 m freighter; the 64 m Mark II is still a separate studio asset.
