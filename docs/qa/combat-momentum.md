# Combat momentum and moving muzzles

2026-09-07 · SA-FLIGHT-001 · author verification; independent review pending.

## Scope and behavior

All flyable hulls use ship-local finite thrust/RCS authority. Default fly-by-wire
corrects drift and brakes on release; unlocked mode retains translational momentum
and rotational input. Hover/aerodynamic compensation remains an intentional assist
reserve. Full braking provides1.5× correction authority. Speed regime changes
cannot clamp away existing velocity. Explicit transit and physical contacts retain
their existing semantics; landing assist refuses speeds above10 m/s.

Combat/cruise selection is independent of assist. Combat limits are220/180/120 m/s
for Kestrel/Nomad/Atlas. Firing requires combat mode, actual speed within the cap,
no boost, no automation and fully retracted gear. The fitted gun pipeline, sizes,
local flashes and unavailable-kit interlock are preserved.

Laser pulses refresh their source from the current actual barrel for their brief
visible lifetime. Their original hit point and one-shot damage remain unchanged.
Pulses render at least once after a slow frame. Ballistic effects and combat shots
inherit the shooter’s velocity; lead and wall queries use the same trajectory.
All GPU positions remain camera-relative.

## Quantitative checks

Full nose-axis brake from100 m/s in vacuum,120Hz integration, ending below1 m/s:

| Hull | Distance | Time |
| --- | ---: | ---: |
| Kestrel |58.3 m|1.475 s|
| Nomad |96.7 m|2.400 s|
| Atlas |251.0 m|7.367 s|

These are controlled physics measurements, not frame-time or flight-skill claims.
The navigation regression pitches every hull down at100 m/s: an early brake avoids
the floor, a25m late brake crashes, and landing assist cannot erase the dive.
Tests also cover90° drift,180° unlocked reversal,30/60/120Hz convergence, inherited
projectile sweeps/tails and server-owned mode snapshots plus sustained braking.

## Validation log

- Initial source8811e6b:676 units passed;87 multiplayer passed, one PostgreSQL
  integration fixture skipped without its database setting; production build passed.
  Five Chromium browser journeys passed on the pre-fitted-gun base.
- Fitted-gun/RT/menu merge7b64320:694 units and production build passed.
- Landmark integrationf1efc01 plus additional regressions:702 unit tests passed;
  89 multiplayer passed, one database fixture skipped. No schema/data migration.
- Latest integrated browser verification is pending; final evidence is added below.

Initial browser attempts failed before useful gameplay verification: restricted
/tmp capacity caused resource/page/WebGL failures, and an overlong alternative
TMPDIR caused a Chromium Unix socket-path startup abort. A short on-disk TMPDIR
and approved host execution succeeded with the same ANGLE gl backend. No app
change or browser flag was used to mask those startup failures. The first route
fixture also used an obsolete rifle menu entry; the real D-pad equipment route
replaced it. Current fixtures use RT fire, LT braking and the real tabbed menu.
A server regression initially omitted the input envelope, then let its input lease
expire; the final fixture supplies sustained sequenced brake intent like a client.

Raw evidence/logs remain in /tmp/star-agent-momentum-evidence and
/tmp/momentum-integrated-{unit,online,browser,build}.log. Curated captures follow.
Physical controller hardware, independent visual acceptance and FPS targets have
not been verified. Online ship combat and persistent patrols remain out of scope.
