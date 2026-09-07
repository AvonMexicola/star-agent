# Kestrel flight and Meridian Shipworks

The Kestrel joins the fleet as Meridian Shipworks' single-pilot interceptor.
Nomad and Atlas share the same manufacturer and vector emblem, centralized in
`assets/brands/meridian-shipworks/` and `src/ship-manufacturers.js`.

Open `/?ship=kestrel&intro=0` to start seated in the station hangar. This is a
fresh temporary practice session: reload resets it, and normal browser saves
are neither read nor written. The studio's **Fly Kestrel** link opens this route.

| Control | Action |
|---|---|
| B / controller Y | Launch or assisted landing |
| W/S, A/D, Space/C | Forward/reverse, strafe, ascend/descend |
| Mouse / arrows / right stick | Steer |
| G / controller LB+RB + D-pad down | Landing gear |
| 4 / controller camera shortcut | Cockpit/exterior camera |
| V / controller R3 | Assisted/inertial flight |
| X / controller B | Brake |
| F / controller X | Use port ladder when landed; board from its foot |
| U / command menu Fleet | Select a ship while seated at Aeon Orbital |

In a regular session Kestrel is available without the Atlas milestone. Unload
all ship supplies and minerals before selecting it: Kestrel has no cargo hold.
The pilot retains their backpack. Selection changes the model, pilot eye,
collision dimensions and handling together. An unsuccessful model load keeps
the current ship selected and allows a retry.

The original canopy and segmented ladder animations drive a continuous boarding
trajectory. Access opens before the pilot moves; a crouched sill transfer clears
the raised canopy, and a higher step clears the top ladder knuckle. A pilot
approaching a closed ladder first walks outward beyond its unfolding sweep.
Boarding ends with the ladder stowing before the canopy closes. Launch and gear
commands wait for both to be secured. F in flight retains the pilot in the
single-seat cockpit. There is no walkable fighter cabin or in-flight exit.

The shared navigation gear clock samples the authored rig at normalized progress
over 1.8 seconds. Four actual cockpit screens display live flight, navigation,
canopy/ladder/gear and vessel data. Authored engine cores/cones follow commanded
acceleration. The four S2 mounts remain empty; ship firing and the generic
Nomad exhaust emitter are disabled for Kestrel.

Collision uses the reviewed GLB's exact static slabs and conservative continuous
gear envelopes. Ground walking uses finer 0.25 m slabs and parked gear bounds.
Terrain and station support still come from the existing navigation functions;
the fighter never inherits Nomad's cabin floor or rear ramp.

Limitations: boarding uses a controlled first-person eye trajectory,
without an articulated climbing avatar. The third-person avatar is hidden during
that sequence. Collision is conservative rather than triangle-exact physics.
Gear suspension, fitted weapons, fuel consumption and heat damage are not added.
The flight tuning is the existing interceptor profile, not a mass simulation.

Reproduce checks with `npm test`, `npm run build`, and a production preview on
port 5294 followed by `npm run test:browser -- -c scripts/kestrel-flight.config.js`.
Browser evidence goes to `/tmp/star-agent-kestrel-flight-browser/`.
