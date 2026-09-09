# ADR SA-WORLD-004 — rotating body charts

Status: implemented development proposal; affected-domain independent review pending.
Date: 2026-09-09. Builder: Codex. Product request: Cees, spinning planets.
Related [brief](../briefs/planet-rotation.md), [player guide](../planet-rotation.md).

## Context and evidence

Terrain generation, mining cells, building anchors, surface vehicles and authored
sites already share canonical double-precision positions. Rotating only the
visible planet would separate collision and settlements from their ground.
Changing saved terrain coordinates every frame would introduce drift and require
unnecessary save migrations. Body centres remain at their established positions.

The implementation retains canonical body-fixed charts around each world and an
inertial chart in deep space. Existing eight-radius gravity domains overlap at
Pyre/Miasma; the new three-radius rotation domains are independently proven
disjoint. Gravity ownership and the canonical terrain functions are unchanged.

## Decision and consequences

All four landable worlds rotate about global Y once per 3,600 real seconds, from
UTC epoch 2026-09-08. There is no centre translation, axial tilt, orbital evolution
or N-body solver. Terrain anchors are still `body.center + bodyLocalMetres`.
Inside a rotation domain, Navigation uses that chart. Outside all domains it uses
inertial metres. Frame conversion preserves physical position, attitude and
velocity, including omega cross radius. Inertial flight includes Coriolis and
centrifugal acceleration; assisted flight, parked hulls and the existing stabilized
suit controls follow their local frame. The station co-rotates with Aeon.

The observer's chart is also the render basis. A foreign terrain renderer receives
its own double-precision camera origin; only already-local geometry is rotated
into the observer frame. Foreign gameplay roots are transformed for drawing and
restored before gameplay queries. Explicit frame tags handle camera/hull roots
straddling a domain boundary. Planet normals, water, ring ice, lava, cloud sampling,
star field and sunlight use matching frames. Log depth, terrain fallback and skirts
are retained. The terrain generator never reads the clock.

Targeted drive endpoints lead the destination through the full analytic duration.
A charged lock has zero remaining spool time. Planet occlusion is checked against
the led endpoint: some departure phases require flying around a limb. Existing
straight drive routes and stationary obstacle snapshots remain in use; this is
not a general moving-obstacle trajectory solver.

## Adoption and compatibility

Protocol 9 publishes server planetary time and each peer's chart. Clients share
the phase and snap reconciliation/interpolation when charts change. Immediate
hitscan compares targets in the shooter's chart; swept rams use inertial motion
history and return impact points to canonical protection coordinates.

Seed, terrain generators, building/mining saves and SQL schemas remain unchanged.
The phase is derived from an epoch, so offline reloads retain the day; joining a
server adopts its clock. Reload both client and API together for protocol 9.
Rollback requires the corresponding paired client/server build, not a database
migration. No runtime dependency or new input binding is introduced.

Local integration is a labelled development checkpoint under Cees's standing
request. The [QA record](../qa/planet-rotation/README.md) distinguishes measured
checks from pending independent review, hardware and release acceptance.
