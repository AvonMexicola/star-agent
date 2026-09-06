# Mining particle integration

The expedition tool now uses the particle system from `feat/particle-effects`
commit `a81b75e` (PR27): a mint plasma beam, contact sparks and dust, a local
impact light, mineral-colored fragments that curve back to the cutter, and HDR
bloom. The modules are reused from that committed version; the effects worktree's
ongoing weapon and flight changes are independent.

Use Xbox **RT**, keyboard **T**, captured left mouse, or hold the on-screen mining
button. **D-pad right** equips/holsters, **View** opens the backpack. The controller
command menu's Controls and help page offers Energy glow and Reduced particle
motion; select with D-pad and toggle with A. Reduced motion also honors the OS
preference on startup. These presentation settings currently last for the session.

## Gameplay contract

- Equipment retains ownership of heat, calibrated muzzle position, range and
  requests to cut. Its old VFX group is hidden when the shared director is present.
- Beam endpoints use the actual muzzle and validated camera/muzzle rock hit.
  A miss produces a beam without contact sparks or mineral collection.
- `MineableRock.onExtract` runs only after inventory/save acceptance and geometry
  and collider publication. Replayed, empty or rejected jobs award no new bursts.
  Contact position and normal are captured before the asynchronous worker request.
- `MiningField` forwards successful cuts from Crescent, named provincial outcrops,
  regional biome deposits and promoted small ring asteroids, including streamed
  rocks. The visual callback never changes inventory or saves.
- The integration uses one shared `EnergyEffects` instance with a fixed 1,024
  particle pool. World coordinates remain doubles until camera-relative upload;
  shaders test logarithmic depth and preserve scene alpha. Ore flies toward the
  moving tool muzzle. The director's flight/weapon inputs are not enabled here.
- Releasing or holstering stops the beam; short-lived debris expires. Menus, focus
  loss and quick transit clear effects. The shared controller router still requires
  neutral input after interruptions. A committed cut already in flight may finish;
  that is the same saved transaction and never an extra visual reward.
- Bloom has three reduced-resolution levels and an explicit off switch. One
  nonshadowed contact light is used. No physical particle collision is simulated.

## Review and integration

This is part of expedition PR24 and its preview at http://127.0.0.1:5213/.
When integrating PR27, retain a single director and a single atmosphere bloom pass.
Preserve the regional rock callbacks added here and the current recovery beacon.
Do not replace current equipment assets or navigation with an older branch snapshot.

Validation and screenshots are recorded in `docs/qa/expedition/mining-particles/`.
