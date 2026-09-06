# Character EVA

A stationary Nomad can now be left in space. Brake below **2 m/s**, with more
than **120 m** ground clearance, then press **F / Xbox X** to stand. Walk aft,
open the hatch with F / X, and continue down the ramp. Leaving its edge enables
suit thrusters without moving the character to the planet floor.

The ship holds its world position and orientation while its pilot is outside.
This first implementation models a stationary, assisted ship; it does not simulate
an unattended ship orbiting away from the player.

| Action | Keyboard | Xbox |
| --- | --- | --- |
| Forward/back and strafe | WASD | Left stick |
| Look | Mouse / arrows | Right stick |
| Rise / descend in suit-local frame | Space / C | A / B |
| Roll | Q / E | LB / RB |
| Boost | Shift | Left stick click |
| Brake suit drift | Hold X | Hold LT |
| Mine, when equipped and in range | Hold T / captured left mouse | Hold RT |
| Interact with ship | F | X |
| Enable suit thrusters while outside | G | Y |

Release thrust to coast. Normal acceleration is 3.5 m/s² with a 12 m/s cap;
boost gives 7 m/s² and 24 m/s. Brake is exponential damping and overrides thrust.
Rotation is direct suit control: yaw, pitch and roll use the suit's local frame,
with no planetary upright correction during EVA. Positions and integration remain
JavaScript doubles. This prototype has unlimited suit propellant, no oxygen clock,
and gravity compensation; it is not a ballistic orbital-flight simulation.

To return, brake, align with the **open rear ramp**, and approach below **4 m/s**
at its deck height. Boots attach locally (within 45 cm of the deck eye height),
and walking resumes. Walk through the cabin to the chair and press F / X to resume
flight. Pressing interact beside the ship never teleports the character aboard.
The ship hull uses finite swept capsule collision, including cabin roof and floor;
its collision proxies are approximate and do not represent every visual hull detail.

On contact with planetary terrain, the character returns to walking on the shared
terrain function. G / Y can enable the suit again. Disabling a suit while high
above ground gives a return hint instead of dropping or teleporting the player.
Station wall collision is retained; EVA does not yet attach boots to station decks.

`navigation.evaState` exposes active, spaceParked, braking, shipDistance and speed.
Mining and nearby asteroid collision use the shared obstacle adapter's optional
`constrainEVA(previous, proposed)` method. Rendering continues to use the parked
ship's existing world position minus the current camera origin.

Verification: `node --test --test-isolation=none tests/eva.test.js tests/navigation.test.js`
covers frame rates, all thrust axes, coasting, boost cap, brakes, finite ship hulls,
closed/open hatch collision, ramp attachment, physical space exit/re-entry, and
existing lunar/terrestrial navigation. `npm run test:browser -- -c scripts/eva.config.js`
runs the physical keyboard journey on a production build, on isolated port 4203,
and records its browser/renderer and screenshot in `/tmp/star-agent-eva-evidence`.
The screenshot changes only camera orientation to show the parked ship; the
boarding journey does not reset or teleport the player position.
