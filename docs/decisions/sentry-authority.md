# Burrow Sentry authority

The Sentry is a separate session vehicle. The normal mining Burrow keeps its
existing solver, storage and extraction. Both reuse `createRoverPhysics`,
`sampleRoverSupport` and the carrier guards. `src/sentry/simulation.js` owns the
Sentry's deterministic door routes, seats, driver, turret and capacitor. Solo
calls that core locally; `server/sentry.js` calls it for every online rover.

The client submits deploy/board/exit requests and bounded control intent. It does
not submit rover transforms, muzzle origins, hit targets, damage, health, charge
or seat ownership. Protocol **8** adds authoritative Sentry snapshots and a
received-input readiness bit on top of checked Transport protocol 7. Browser and
server must be refreshed together. There is no schema change or stored fleet.

A physical request within 1.25 m reserves one vacant seat. The door opens, the
character moves along measured steps at 0.85 m/s, and the door closes before
controls become available. The gunner reservation immediately removes pilot
fire authority, including during access. The pilot alone drives; a seated gunner
owns aim/fire, otherwise the pilot owns aim/fire. A gunner cannot turn the
pilot's driving view. Both characters use chassis orientation for their bodies.

Every seat and authority transition disarms the driver and turret. Each requires
a *newer received neutral input sequence* before accepting held controls. A
server-generated neutral, stale input, focus loss, busy dialog, unsupported or
replaced controller, reconnect or held fallback cannot arm a new epoch. The
shared controller router still owns Gamepad polling. Input older than 500 ms
brakes and disarms the online rover. Only a stationary rover permits normal exit.

Snapshots carry world-double chassis position/quaternion, speed, distance,
support/collision reason, wheel spin/steer/suspension/support source, both door
and seat phases, turret angles, capacitor/depletion, controller and neutral epoch,
shot/hit sequence, carrier identity, hull health and destruction. Player snapshots
also carry actual seated eye, feet and body orientation. Rendering follows those
values; it does not grant interaction or damage authority.

Both barrel sockets define the authoritative pulse origins. Each barrel deals
18 damage at a 0.20 s interval, to 400 m. The 24 s reserve recharges over 12 s;
depletion requires release. The pressure shell occludes shots aimed through the
rover's own cabin, as well as ordinary incoming handheld rays. The hull has 180 HP.
A validated hit checks every living crew member and the connected owner through
the existing station friendship/security service. Any nonfriend relationship
retains retaliation; one impact debits the hull exactly once. Pending membership
includes all crew, so disconnect/life changes wait for the accepted impact. The
live damage target exposes its real seats and health, rather than mutating a
player or the owner's parked ship as a proxy.

Hull zero immediately stops fire and releases both seats. A connected owner may
request a replacement only after it is empty and access finishes. Disconnecting
an owner retains a crewed rover; an empty orphan is removed immediately or after
the last physical exit closes. The room caps vehicles at ten and one per owner.

Atlas carry uses real wheel support to acquire a carrier-frame anchor. Position,
rotation and lift movement follow that frame in doubles; drive/fire stop in
flight. Physical ramp and full-envelope guards remain active. The taller turret
fails Gannet's ceiling clearance and is deliberately refused. Terrain and
station decks remain canonical; no secondary ground or raised construction
floor is invented.

These changes do not add authoritative ship-gun fire or a ship-versus-Sentry ram
damage solver to the baseline. Pedestrian and rover movement stops at Sentry
hulls; validated handheld and mounted-laser combat is covered. The independent
Pirate target adapter and normal Burrow garage delivery remain separate owners.
