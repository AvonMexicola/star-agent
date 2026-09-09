# Burrow Sentry verification

Status: implemented and author-validated on **6334b98**, protocol **10**.
Parent locally integrated `bdf053c` with checked Recovery `2b28036` and refreshed
the managed 5178/API8087 pair at 01:32 UTC, preserving its existing database.
See [the delivery receipt](local-integration.json). The completed browser gameplay evidence is attempt 12: **two tests
passed; the multiplayer test completed all gameplay assertions but retained an
exit-1 deferred sampling assertion**. Its timestamp-aware reanalysis passes,
as explained below. The original run is not relabeled green.

This candidate preserves checked Transport, Garage, Handheld, Pirate/Faction and
rotating-world source through **1da9b0e**, plus parent **e9ea4ab**. Protocol 10
retains rotation 9 and adds Sentry state; browser and API require a paired
refresh. Normal mining Burrow stays separate. Parent owns PR106, composition
with any later checked features, final integration and its independent source
review. No public deployment is part of this offer.

See [controls](../../burrow-sentry.md),
[authority](../../decisions/sentry-authority.md),
[asset provenance](../../../assets/burrow-sentry/README.md),
[failure ledger](failures.md), [handoff](handoff.md) and
[parent review](parent-review.md).

## Source and asset verification

CPU coverage includes both physical seat routes, actual GLB muzzle transforms,
gunner priority and pilot exclusivity, real neutral input after handover,
disconnect and orphan cleanup, hull destruction and seat release, fixed damage,
all-crew friendship with pending membership, hub admission, rover/walker
collision without owner-ship damage, Atlas ramp/deck/lift inheritance and safe
Gannet ceiling rejection. Canonical rover drive/support remain shared.

Frame tags cover rover/beam roots and carried poses; foreign suits/hulls are
converted before ray tests. Rider eye/feet/body poses use the real Navigation
chart and existing placement revision. A shared registry retains one carrier
guard across repeated deployment.

- Parent exact **6334b98**: **1,256 normal cases / 164 files** pass in 62.895 s;
  **226 multiplayer cases** pass in 63.211 s, with two existing opt-in skips.
  Repository checks pass 336 paths and the suggested plan runs.
- Carrier 08: **7/7** pass, including real enclosing Navigation updates across
  all four body boundaries, Atlas-relative placement, foreign-chart collision
  and 30 environment recreations retaining one guard.
- Hit 07: **6/6 actual-room** suit/parked-ship/rover boundary cases pass in 4.941 s.
  The two earlier below-hull fixture failures remain in the ledger.
- Access continuity 14: **2/2** actual-room pilot/gunner cases pass in 2.103 s;
  every 30 Hz step, published poses, delayed-render samples and a deliberately
  invalid short-time jump are checked. This QA-only change leaves runtime 6334
  and the parent’s broad suite result unchanged.
- Attempt 12 guarded build: **PASS 4.21 s**, actual `main-C7yzYpq9`, both
  `VITE_DEV_TOOLS=1` and `VITE_MULTIPLAYER_ENTRY=1`. Its receipt hashes source and
  every JS/CSS bundle. Only the inherited large-chunk warning remains. The older
  unflagged build12/main-CgxwxzD0 was not the accepted browser bundle.

The unchanged GLB is **2,469,344 bytes**, **25,998 triangles**, 46 mesh primitives,
nine materials and four textures. SHA-256:
`db8b8d07afd7ad8507b746eefc077553f6996e6189cf623d2dbe60ca7ac48387`.
Blender source, procedural PBR maps and reproducible export are tracked.

## Actual browser journeys

Attempt **2026-09-09T01-09-55.235Z** ran frozen QA head **d051d9b** / game
**6334b98**, one Chromium worker, no automatic retry, private preview **5678** and
memory API **8678**. Its original source hashes are unchanged and owned-process
cleanup has no survivors. It released at 01:18:17 UTC.

| Route | Actual result |
| --- | --- |
| Solo standard Gamepad | PASS, 1.5 minutes: physical pilot/rear gunner boarding, forward/reverse, aim/fire, Backpack and return to walking. Maximum sampled steps 0.085 m / 0.042585 m; final rover empty after 12 bursts. |
| Held-input transitions | PASS within solo: dialog open/return, disconnect, replacement/unsupported controller and actual trusted browser blur/focus. No held input rearmed firing. |
| Keyboard and native portrait touch | PASS, 1.6 minutes: entry, aim/fire and exit. At 390×844 all six enabled on-foot buttons are actual hit targets, panel/control bounds are disjoint, and native touch walks after exit. |
| Two actual accounts | Every gameplay assertion completed in 5.0 minutes: controller deployment, physical station/EVA meeting, both seats, concurrent pilot drive/gunner fire, gunner exit, held/neutral fallback, controller and panel server inventory, physical pilot exit. Both clients remain connected and unseated. The deferred raw sampling assertion failed; reviewed analysis below resolves that evidence criterion. |

During concurrent operation the pilot recorded **0.857 m/s** and **0.506 m** of
travel with the gunner’s server ID owning the turret. Pilot fallback reached
19 bursts only after neutral input. Both View and the additional pointer panel
Backpack check opened actual server inventory and returned without disconnect.
No pose writes or vehicle authority calls were used by browser steering.
Account text uses native input; gameplay uses injected standard Gamepad.
The panel pointer click is additional to the controller inventory route.
Both online pages reported focused/visible, so no online focus emulation was
needed. Solo uses a separate genuine native focus-loss test.

Chromium **151.0.7922.173**, **ANGLE / AMD Radeon 860M / OpenGL ES 3.2** rendered
all routes. Solo/keyboard are 1440×900; native phone is 390×844. Online viewport
is 1280×800 with a recorded 1024×640 drawing buffer. Errors and warnings are
empty throughout. Solo/native have no failed requests; online has two aborted
music requests and a Vite WebSocket reset during context cleanup. There was no
socket-limit rejection, shader error or context loss. No FPS or physical-device
claim is made.

## Retained sampling failure and reanalysis

The raw online gunner metric saw **0.7282097 m** between render samples separated
by **668.5 ms** and failed its fixed 0.6 m cap. That same received pose had first
appeared at **234185.3 ms** and remained unchanged until **235161.5 ms**: actual
pose age **976.2 ms**. Both endpoint positions equal the authoritative peer.
A per-render distance cap cannot distinguish this catch-up from a simulation
jump. The original runner remains exit 1, with every later gameplay assertion
saved before the deferred failure.

The checked QA helper uses **0.85 m/s × (elapsed since the previous distinct
pose’s first observation + one 1/15 s snapshot interval) + 4 mm**. Unchanged-pose
door-phase changes reset waiting time. Pre-admission walker prediction is not
mistaken for seated authority. Both original online traces pass this bound;
the gunner’s 0.7282097 m fits a **0.8904367 m** limit over its actual pose age.
Actual-room tests pass normal and delayed-render traces for both seats, while
rejecting the same displacement in 20 ms. No route speed or game code changed. Final owner repository checks pass 346
paths, the suggested plan runs, and syntax/diff checks pass.

Exact checker SHA-256:
`6a96748b74ad80a134fae83c07f30bc0a6b1b79a817e167b43d1789d61e3d308`.
Raw reanalysis is `assets/burrow-sentry/.staging/access-reanalysis12-02.json`;
its ignored `reanalyze12.mjs` reproduces it from unchanged attempt-12 JSON.
Original input SHA-256 values are
`61d8ec5c82e14240211ce8d0e844fa22db1656f7dfe193e73fa524c7f56d5a2d` (pilot) and
`9ae77df319d92053b8a911aa6724be23fdc72d619673edc050c3c719f2fad7d6` (gunner).
The parent independently replayed the exact checker and both input hashes,
confirmed short-time jumps fail, and accepted this corrected analysis. The
failed initial checker and all historical attempts remain retained.

Attempt09’s earlier gunner `Too many messages.` cause remains **unresolved**.
Attempt12 did not reproduce it: passive fixed-second buckets peak at 23/24
messages. The actual-system CPU probes also did not reproduce it. Neither result
retroactively establishes09’s cause or justifies changing the server’s limits.

## Curated original captures

These PNGs are unchanged copies from attempt12, not edited concept images:

- [Solo twin barrel beams](solo-twin-beams.png) and [solo gunner sight](solo-gunner-sight.png).
- [Two crew driving and firing](two-crew-barrel-beams.png) and [online gunner sight](gunner-sight.png).
- [Connected server inventory](server-inventory.png).
- [Native portrait controls](native-phone.png) and [walking controls after exit](native-phone-on-foot.png).

The images establish the compiled asset, barrel origins and clear gunner view.
Physical controller/phone hardware, independent scored art review and performance
acceptance remain separate. Other limits are session-only fleet state, no
pressure simulation/hand IK, safe Gannet rejection, no general construction or
garage deployment, pending Pirate enemy adapter, and inherited authoritative
ship-gun/complete ship-versus-rover ram limitations.

Run future QA through `node scripts/sentry/run-browser.mjs`, with `SENTRY_JOURNAL`
pointing to the live shared journal and a short disk-backed `SENTRY_TMPDIR`.
The command owns its flagged build, executable/argument GPU guard, frozen hashes
and uniquely owned private-service cleanup. It never reuses an existing server
or authorizes stopping a process merely because it holds a port.
