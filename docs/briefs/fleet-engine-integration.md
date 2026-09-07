# Fleet propulsion presentation

Cees requests engine particles, sound and the existing music connected to the
playable Atlas, Kestrel and Nomad, then integrated in the local development build.

The existing effects adapter assumes two old Nomad exhausts, omits Kestrel and
derives demand partly from speed/keyboard input. Development starts skip the only
automatic audio gesture hook. Legacy engine hum also follows speed, and map/focus
pauses suspend only part of the mixer.

Use one sample of actual simulation acceleration, hull pose, power and travel
state for authored engine emission, particles and sound. Resolve exhaust at the
current playable assets' real sockets; retain Kestrel's own core/cone geometry.
Keep the moving-barrel flash/laser and inherited projectile velocity fixes intact.
The 64 m Atlas Mark II remains a separate studio asset.

Audio must begin through a browser-accepted user gesture, retry temporary autoplay
denial and preserve the player's explicit mute choice. Nomad is the middle voice,
Kestrel a faster turbine, Atlas a deeper/slower engine. Retain the locally hosted
score and all existing gameplay effects. Power-off suppresses propulsion;
coasting suppresses thrust without silencing the score. Walking in a powered
moving cabin remains a valid engine state. Pause, focus loss and graphics failure
must silence the full mixer and return without replaying held controls.

The effects and audio agents own their isolated modules/tests. The integration
steward owns the narrow main hooks, combined browser fixture, package test list,
documentation and serialized local delivery. No new ship assets, dependencies,
movement model, network protocol, SQL or public deployment is part of this work.

Validation covers pure propulsion/sound invariants, existing weapons/mining
regressions, the production build and actual rendered controller flights on all
three hulls. Use native keyboard/touch activation for browser audio policy;
record injected controllers separately from physical devices. Capture before and
after exhaust views and measure the real post-master audio signal plus decoded
music playback. Inspect shader/console errors, mute/menu/power/cabin transitions
and a phone sound control. A labeled local checkpoint does not establish final
listening, continuous-motion art or hardware performance acceptance.
