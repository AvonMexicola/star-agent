# Surface tool, asteroid targeting and space controls

Cees reported that the laser did not equip on the moon, ring rocks did not mine,
and horizontal right-stick input failed to yaw in the ring. These exposed gaps
in the original successful tutorial routes.

The surface tool was hidden beyond 90 metres from a deposit. It now equips while
exploring independently of resource proximity. The browser regression places the
player outside that radius on Selene and uses actual Xbox equip/RT input; a visible
beam renders, and firing into empty space changes neither cuts nor backpack mass.

Assisted space yaw used lunar radial up, turning horizontal input into pitch/roll
at arbitrary ring attitudes. Yaw, pitch and vertical thrust now use the ship frame;
space travel does not automatically rotate the ship to follow lunar radial up.
Holding B previously returned before steering. It now cancels drift/thrust/angular
momentum while allowing manual yaw/pitch/roll, including in inertial mode. Walking
and atmospheric gravity-relative movement remain separate.

Asteroid mining prepared only two nearest rocks, so an aimed third rock was ignored.
An oversized sphere could also occlude a visible gap around an irregular asteroid.
Camera aim now prioritizes preparation; precise rendered triangles determine
occlusion and nearby collision. Muzzle queries cannot change camera selection.
Two live worker slots remain bounded, and pending work is not cancelled. The HUD
explains preparation, range, saved-deposit capacity and large static asteroids
whose hand mining is unavailable. Large-asteroid excavation is not implemented.

Validation:

- All 22 files in `npm test` pass, including seven space-steering regressions and
  four asteroid-targeting regressions. The latter exercises all six shape families,
  real occlusion, false-sphere gaps, pending workers, range and save limits.
- Five distinct production browser checks pass across the follow-up runs: complete
  Crescent controller mining, remote Selene equip/fire, ring yaw in both directions
  with and without held brake/thrust, physical EVA asteroid mining, and an aimed
  third rock plus large-asteroid feedback.
- The aimed-rock browser fixture uses synthetic placement with actual generated
  meshes, collision, worker preparation, RT carving and backpack collection. It
  injects no hit, cut or reward. The pole-facing yaw and remote surface positions
  are explicit regression setup; inputs use the real standard Gamepad route.

Chromium 151 / SwiftShader software rendering. Screenshots and JSON record the
actual results; no physical Xbox button sequence or hardware FPS approval is claimed.

[Remote Selene tool](remote-selene-beam.png) · [Aimed rock mining](aimed-rock-mining.png)
· [Large asteroid feedback](large-asteroid-feedback.png)
