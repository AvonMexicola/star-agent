# Fleet, station and development content integration

8 September 2026. SA-FX-001, `feat/fleet-engine-integration`.
Shared local development is delivered at `c99736f` (runtime `5f63893`). Cees has
now explicitly authorized main/public and multiplayer release; those separate
release owners are verifying their targets. Local delivery is established below.

## Source and behavior

The checked combined base is `c9416b0`, development production bundle
`main-JWM151cB.js`. Current follow-up `c732034` contains the rover Menu fix
`cfe69b7` and clear-windscreen asset `d2f7eb0`; its bundle is `main-JvwuKyx2.js`. It preserves the shared tractor/tool-art checkpoint `40a0fb4`
and performance `8552d44`, then combines:

| Content | Checked input and resulting behavior |
| --- | --- |
| Fleet propulsion | Effects `bcd46d1`, audio `9690fe3`, activation retry `5e0cf4b`; actual thrust, power and travel state drive each hull's own nozzles and engine voice |
| Playable Atlas | `8cd5c0e`, collision follow-up `f3312c`; real 64 × 36 × 16 m asset, two loading ramps, one crew lift, six landing assemblies, four MFDs and three S3 mounts |
| Station | Authored exterior `9d0728f` by default; full-size bays share the actual client/server geometry and preserve human-scale terminals and lifts |
| Community hub | `b622dec` through semantic union `2936f42`; physical passenger transfer, finite markets, hands-free access restrictions and station defense |
| Burrow | Surface/carrier `3ca94b7` and clear-windscreen candidate 11 `d2f7eb0`; ready-on-ground Selene start, four canonical terrain contacts, actual Atlas aft ramp and occupancy guards |
| Building | Roof/ceiling-light/base-power `05f83d1`; additive account-scoped solo base saves, powered lights and safe removal |
| Shopkeepers | Final female/male idle correction `3624efd`; actual shop-frame actors and existing purchases |
| Handheld art | Preserved `a50c060`/`40a0fb4`; all four tools' authored PBR models, grip and moving-muzzle calibration |

Protocol **5** retains recipient-private snapshots, tractor leases and loose-cargo
persistence alongside finite markets and the real Atlas mechanism object. The
same saved `atlas` ID and 512 SBU cell addresses remain; grid origins move onto
the real 2.6 m cargo deck. Migration 003 adds solo base sites alongside existing
001, 002 and 004; it does not reset accounts or inventories. Normal solo entry
and authenticated multiplayer join retain the shoulder camera; multiplayer
presentation reads the assigned server pose and doors without respawning them.
Explicit developer starts skip the opening as before.

One sample of actual ship acceleration, pose, power and travel state drives the
visible engines and sound. Nomad and the playable 64 m Atlas use their measured
twin nozzles; Kestrel uses its authored sockets and afterburner cones. Reverse
and lateral maneuvering produce engine load without igniting aft exhaust.
Coasting retains idle cores and music; power-off stops the ship's propulsion.
Powered Nomad/Atlas cabins retain a quieter engine bed while the pilot is unseated.
The studio and legacy preview alias use the same current Atlas as gameplay.
Remote-ship spatial propulsion and new RCS nozzle geometry remain outside this slice.

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

## Combined CPU and build evidence

- `c9416b0` passes **193 multiplayer/database tests**, zero skipped, in 22.44 s,
  using disposable PostgreSQL. This includes account/social races, cargo/market
  restart and replay, base-site migration/save isolation, and local service restart.
- Development-enabled production build passes in 8.26 s; known large-chunk
  advisory remains. Repository checks pass for 433 changed paths.
- The first complete current normal list found **991 passes / 4 failures / 0
  skips**, 55.59 s. Four old fixtures still assumed the retired Atlas dimensions,
  cargo lift and unscaled bays. Their corrections and final results follow below;
  that run is explicitly not a combined pass. The corrected actual geometry
  fixtures were consumed at `a119b58`: the complete normal list then passed
  **995/995**, zero skipped, in 51.92 s. All forty Nomad/Atlas tilted-berth
  departure/return journeys retain complete hulls and closed-door rejection.
- The later rover Menu fix passes 23 affected controller/rover checks. The
  windscreen-only asset update passes 35 physics/storage/surface/carrier checks
  in 2.89 s; its build passes in 5.42 s. No broad performance claim is made.
- The HUB union's independently bounded group passed 243 checks and the final
  physical opening route passed six; actual enlarged-bay/Bastion placement has
  positive assembly clearance. This is not a clear-firing-arc certificate.

See [the real Atlas station/cargo checks](atlas-playable/station-cargo-tests.md)
and [the semantic community union](community-hub/fleet-union.md) for exact geometry,
transaction, privacy and held-input checks.

## Historical smaller-scope CPU evidence

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

The complete before capture passed all three hulls in 2.8 minutes on Chromium
151 / AMD 860M ANGLE OpenGL, with no page/console errors. The first combined after
case reached actual forward/boost/coast, compiled/rendered engine shaders and
real audible decoded music, then timed out trying to reseat immediately from
Nomad's standing position. The runtime correctly required approaching the chair.
The fixture now walks back using the stick in the actual cabin frame before
interacting; no navigation or interaction distance was changed. This failed run
and images are retained under the owner's private `first-after-seat-fixture`
cache. Nomad passes the complete corrected invocation 02 (1.2 min). Atlas and Kestrel
pass invocation 03 (1.4 and 1.0 min; 2.5 min total). The latter fixture correction
stops the cabin return walk at the actual seat interaction, then releases the
stick before opening a menu; previously Atlas's chair collider correctly stopped
a walk aimed too near the chair centre, leaving the test stick held. These two
failed fixtures did not require changing seat or collision rules.

All three final hull cases capture **zero page/console errors**, actual local
music playback with no failed tracks, power-off propulsion suppression, boost,
coast and reverse behavior, cabin audio, mute persistence and held-menu recovery.
The actual post-master forward RMS is Nomad 0.04954, Atlas 0.04786 and Kestrel
0.04730; paused-menu output is 0 for all three. This proves an audible signal,
not headphone listening or mix approval. Native Chromium 151.0.7922.173 used
ANGLE / AMD Radeon 860M / OpenGL ES 3.2 at 1440 × 900 DPR 1, with a 390 × 844
phone sound panel. Another user tab may remain active, so these are not FPS
benchmarks. Final captures are in `test-results/fleet-engine-captures/after-02`
(Nomad) and `after-03` (Atlas/Kestrel).

The first physical development run stopped when the fixture awaited old-page
animation frames across the real launcher navigation. The corrected run reached
Selene, mined actual ore, drove, opened bins, and physically exited/reboarded.
It then exposed an actual Menu dispatch bug: the occupied rover returned before
the shared command handler. `cfe69b7` handles Menu before that early return; the
fixture now asserts the dialog opens before checking held-trigger suppression.
The previous run is a retained failure, not a complete route pass. Candidate 11
removes only the 44 centre-strut triangles and preserves the remaining geometry,
glass, materials and mechanism transforms. The first ground capture supplies its
before view. Final corrected route, images and shared delivery results follow.

## Development limits

This integrates checked development assets; final station/Atlas materials,
whole-scene performance, headphone listening and physical-controller acceptance
remain open. Kestrel's ladder clips exist but are not yet connected to physical
boarding. Burrow and build sites remain offline/solo features; base cloud saves
are account-scoped, not authoritative shared multiplayer construction. Bastion
mount placement passes, while ten of twelve diagnostic muzzle rays encounter
station geometry; broad clear firing arcs are not certified. Public deployment is tracked separately from this local checkpoint; Cees later
explicitly authorized main/solo and multiplayer promotion, as recorded below.


## Final combined journeys and local delivery, 8 September

Runtime `2c11644` includes the checked ground-ramp union `81f0a8f` and passes
**1,016/1,016 normal tests**, zero skips, in 34.66 seconds. Development build
`main-a5nF2Oar.js` passes. The later narrow meadow preset `3bbd611`, integrated
at `5f63893`, passes 35 owner and 16 parent focused checks; its development build
is `main-Bhw5jbcj.js` (5.14 seconds). The ramp integration also independently
passes 136 physical and 51 server checks plus the 300-frame authoritative snapshot
probe. These do not replace the separately scoped 193-test SQL receipt above.

Final development invocation 03 passes both complete controller journeys in
5.5 minutes: Burrow in 2.1 minutes and Atlas in 3.3 minutes. Burrow now opens Menu
while occupied and correctly suppresses held cutting input after return. Atlas
physically crosses both decks, uses the crew lift and forward ramp, operates its
exterior panel, reboards/reseats, and departs the actual enlarged bay with its
full hull. Both report zero page/console errors. Captures are retained under
`test-results/fleet-development-captures-03`; the first pilot image was taken
while the preloader faded and is not a final cockpit art view. The departure
image shows all four active displays. Final ground/ramp/departure images were inspected.

The first normal-entry fixture reached registration/join but tried to close a
hidden legacy account button. That failed receipt remains retained. Corrected
invocation 02 uses the visible Resume button and passes in **48.9 seconds**:
normal solo shoulder dolly/doors, real disposable account registration and join,
server-owned multiplayer shoulder presentation, and physical control handover.
Both final opening images were inspected. The test uses isolated memory API8106,
not production or shared accounts. Chromium/backend/resolution match the earlier
1440x900 record. All final errors arrays are empty.

Cees explicitly reported that his hands-on loading and Atlas flight worked and
that he made a video. The checked meadow launcher reproduces that setup with
Atlas, Burrow beside it and seed7291. His manual test substitutes for the separate
terrain-ramp browser run. Additional duplicate HUB/roof/tractor union tours were
not run before the urgent release request; existing owner evidence remains tied
to its exact sources. No new physical-device, whole-scene FPS or final art score
is inferred from this release authorization.

The local preview was gracefully stopped and resumed as one client/API pair,
with its own regenerated Prisma client. Its transient systemd unit disappeared
on stop, so it was recreated with the same runner, working directory and shutdown
settings. API8087 is healthy, frontend5178 serves protocol5 and the named meadow
modules, and eight served Atlas/Burrow/tool/shopkeeper GLBs match their exact
repository SHA256 hashes. PostgreSQL cluster inode947632 is unchanged; every
pre-existing table retained its row count. Only missing migration003 was applied,
leaving migration versions1/2/3/4. No credentials or database rows were exported.

GitHub rejected the initial direct development push because the branch requires
a PR and `verify`. The proper development PR is
[PR83](https://github.com/AvonMexicola/star-agent/pull/83); no protection was changed.
Public/main and multiplayer release identities are recorded by their deployment
owners and must not be inferred from a successful local merge.


Curated, inspected integration captures:

- [Actual Atlas boost](fleet-engine-integration/atlas-boost.png), engine comparison runtime c9416b0.
- [Ground Burrow mining with the clear windscreen](fleet-engine-integration/burrow-mining.png), runtime2c11644.
- [Authenticated shoulder opening](fleet-engine-integration/multiplayer-opening.png), normal-entry runtime2c11644.

The local service is running at http://127.0.0.1:5178/ with API8087. On 8 September,
HTTPS `play.staragent.site/release.json` independently reported solo source1475eb1;
its release owner is finishing the separately requested homepage film replacement.
This observation establishes the served release identifier, not its final subsequent
media commit. Public multiplayer is updated by its own deployment owner with an
isolated restore/migration check and a paired static/API switch.
