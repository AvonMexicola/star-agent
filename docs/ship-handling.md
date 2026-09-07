# Ship handling

The hull changes acceleration, steering and the time needed to settle after
releasing thrust. Nomad retains the existing baseline. Atlas turns more slowly,
builds steering rate over a short interval and takes longer to stop under normal
flight assist. Kestrel has stronger thrusters and quicker steering.

| Setting | Kestrel | Nomad | Atlas |
| --- | ---: | ---: | ---: |
| Atmospheric cruise | 262.5 m/s | 250 m/s | 237.5 m/s |
| Atmospheric boost | 420 m/s | 400 m/s | 380 m/s |
| Space cruise | 3,150 m/s | 3,000 m/s | 2,850 m/s |
| Space boost | 9,450 m/s | 9,000 m/s | 8,550 m/s |
| Assisted full-stick yaw/pitch | 75.5°/s | 48.7°/s | 20.5°/s |
| Assisted full-input roll | 71.0°/s | 45.8°/s | 19.3°/s |
| Time to reach 90% of an assisted speed command | 0.42 s | 0.66 s | 2.71 s |
| Inertial forward acceleration | 58 m/s² | 35 m/s² | 14 m/s² |
| Inertial lateral/vertical acceleration | 30 m/s² | 18 m/s² | 7 m/s² |

The assisted speed times also describe shedding90% of speed when releasing
thrust in open space. They are gameplay response settings, not physical ship-mass
estimates. Atlas steering has a0.22-second time constant; it settles briefly after
release. Mouse input is distributed across physics substeps so low rendering
frame rates do not reduce the requested turn. Walking and EVA look stay unchanged.

Keyboard and standard controller use the same ship tuning. Emergency X / held
controller B braking retains its existing immediate stop. Normal assist release
is the route that demonstrates the Atlas's longer stopping distance. In inertial
mode, releasing input preserves momentum; turning and thrust authority still
vary by hull. Unpowered coasting remains governed by existing gravity/aerodynamics.

Deployed or retracting landing gear limits powered flight to **35m/s**, including
boost and inertial thrust. Automatic surface descent uses the same ceiling.
**G** or **LB+RB + D-pad down** retracts gear in1.8seconds; the departure prompt
shows the current binding and clears when stowed. Keep thrust held to accelerate
after retraction. Near the hangar, the station safety limit may remain tighter.
Both relativistic drive modes require fully stowed gear. Orbital entry starts
stowed; boarding/launch starts with gear down. Ordinary spaceflight uses dust;
the tunnel appears only while the relativistic drive is engaged.
[Departure validation](qa/gear-departure/record.md).

Ground clearance, station and debris safety caps remain authoritative. Ordinary
flight crosses the atmosphere continuously; all ships retain the same travel
spool and0.9c drive limit. Boost and throttle cannot bypass those safety caps.

Nomad and Atlas are playable through their existing Fleet selection. **Kestrel's
handling profile is prepared and tested, but its ship asset remains on the separate
PR40 inspection branch and is not selectable in this build.** This change does
not claim to integrate the fighter asset. Unknown future hulls fall back to Nomad.

Tuning lives in `src/ship-handling.js`, selected from Navigation's active ship ID
for manual/cabin flight and the shared speed policy. [Validation](qa/ship-handling/record.md).
