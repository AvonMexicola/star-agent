# Fleet engine and soundtrack integration

7 September 2026. SA-FX-001, `feat/fleet-engine-integration`.
Browser acceptance and local delivery are in progress; this file does not yet
claim that the new effects are served by shared development.

## Source and behavior

The effects lane `bcd46d1` and audio lane `9690fe3`, including activation follow-up
`5e0cf4b`, are combined with the latest checked development performance delivery
`8552d44`. Runtime candidate `419849f` builds as `main-B1sJUbin.js`. Subsequent
journal and browser-selector commits do not change that runtime.

One sample of actual ship acceleration, pose, power and travel state drives the
visible engines and sound. Nomad and the current 30 m Atlas use their measured
twin nozzles; Kestrel uses its authored sockets and afterburner cones. Reverse
and lateral maneuvering produce engine load without igniting aft exhaust.
Coasting retains idle cores and music; power-off stops the ship's propulsion.
Powered Nomad/Atlas cabins retain a quieter engine bed while the pilot is unseated.
The 64 m Atlas Mark II remains a studio asset; remote-ship spatial propulsion and
new RCS nozzle geometry are outside this slice.

The three engine voices have different pitch and spool response. The six bundled
score tracks remain local assets. Ordinary input can enable sound when the
opening scene is skipped; temporary browser activation denial can be retried.
Explicit Sound-off remains off across later movement and menu transitions.
Menus, focus loss, transit and stopped graphics gate the whole mixer. Sound
controls reflect the desired state immediately and remain usable if a browser
resume promise stays pending.

The moving weapon-barrel fixes remain in the candidate and shared baseline:
`6f8b195` anchors rifle flashes to the live muzzle, lasers follow the moving
source, and projectiles inherit their emitter's velocity. Engine particle
retirement does not clear weapon or mining effects.

## CPU and build evidence

- The initial combined source `16af2b3` passed 894 tests in 51.02 seconds.
- After the activation correction and performance reconciliation, `419849f`
  passes the complete normal package test list: **902 tests**, zero failures or
  skips, 51.05 seconds, with Node test concurrency limited to two.
- The affected audio/effects/navigation/character/support selection separately
  passes **87 tests**, zero skipped, 35.74 seconds.
- Development-enabled production build passes in 5.90 seconds. Vite's existing
  large-chunk advisory remains. Repository and whitespace checks pass.
- An independent read-only integration review found no blocking lifecycle bug;
  its six audio/effects/support suites pass **45 tests**, zero skipped.

The [effects owner record](fleet-engine-effects.md) contains measured GLB/socket
checks and large-coordinate/moving-muzzle regressions. The [audio owner record](fleet-engine-audio.md)
contains voice, PCM, interruption, mute and blocked-media tests, including the
reproduced pending-resume bug and its passing regression.

## Browser protocol and retained failures

The before build is the reviewed wildlife baseline (`139946d`, runtime matching
`20e9f1b`, `main-DOLopA0u.js`). The after build also preserves the intervening
performance changes. Both use the same orbit start, seed, epoch, three hulls,
1440 × 900 viewport, DPR 1 and normal native Chromium graphics. The comparison
assesses actual nozzle presentation; it is not a pixel-identity or FPS benchmark.

`scripts/fleet-engine.spec.js` flies each hull with an injected standard Gamepad,
accelerates and boosts, drifts with flight assist off, reverses, leaves/re-enters
the walkable cabins, toggles ship power and exercises Settings Sound with held
input across menu return. Native keyboard/touch supplies browser user activation;
the Nomad first attempts controller activation, then uses native touch. An
analyser observes the real post-master output without changing its destination,
mocking audio decoding or relaxing autoplay policy. Music time/paused/error state
and audible/silent sample levels are checked. The phone sound control is exercised
at 390 × 844. These are not physical-controller or headphone listening tests.

The initial before invocation reached the game and failed when the fixture tried
to tap the hidden legacy camera toolbar. The image and UI state were inspected;
the test now taps the visible game viewport and uses the actual camera key. No
runtime, graphics option or gameplay assertion changed for that selector fix.
The failed screenshot/state/log remain in the owner's private test cache.

Actual browser results, inspected images and shared delivery receipt follow once
the bounded before/after window completes.
