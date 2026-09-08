# Burrow Sentry parent review

Status: private integration review in progress; full browser acceptance and local
delivery remain pending. Cees retains product and release acceptance. This record
does not claim an independent visual score or physical-controller testing.

The parent integration agent reviewed the delegated Sentry implementation, its
authority and collision contracts, and the actual first browser captures. The
parent authored only merge composition and delivery work. The Sentry owner retains
the asset, simulation, input adapters and feature acceptance fixtures.

## Source and composition

Runtime `6af7e3989586151e4f4af5c70f789717332f4650` combines checked compound
`c7b09ab` with Sentry `6c1510d` / runtime `e983681`. Metadata `22007db` also retains
the checked shared `cc1e749` delivery receipt. Only two conflicts needed resolution:
the diagnostics object keeps Sentry, garage and pirate state; the test inventory
keeps all 161 unique existing files. Garage interactions precede the pirate wrapper,
and the shared vehicle router preserves both Sentry and the normal mining Burrow.
Sentry server and model bytes match the separately checked source exactly.

The private combined branch subsequently fast-forwarded through `f6847ba`
(physical carrier cargo access) and `fd43bd0` (bounded input suspension). These
changes retain the checked combined ancestry and the same server/model bytes.
Fixture-only source `6611963` retains that application runtime and includes the
recorded modal boundary, native focus cleanup and velocity-aware EVA driver.

The authored GLB is `public/models/burrow-sentry.glb`, SHA-256
`db8b8d07afd7ad8507b746eefc077553f6996e6189cf623d2dbe60ca7ac48387`:
2,469,344 bytes and 25,998 triangles. Editable source and reproducible export remain
in [the asset production record](../../../assets/burrow-sentry/README.md).

## Findings

- Vehicle hits now debit the real hull, preserving the owner's parked ship HP.
  All actual crew/owner friendship relationships participate in one damage event;
  a friendly pilot cannot exempt harm to a nonfriend gunner. Delayed membership
  changes, owner-away/disconnected crew, destruction and orphan cleanup are tested.
- The suspected absent security seat reference already existed as a live,
  non-enumerable property. Its clarification and regressions are useful evidence;
  this was not a confirmed missing-state bug.
- Hub deployment uses the shared hands-free rule. Actual moving-room checks cover
  walker and rover collision. Lower suspension-envelope sweep samples no longer
  collide with their own station floor; canonical tyre support remains authoritative.
- Seated local Character visibility and pose were corrected. The first in-game
  exterior capture shows the pilot through the closed cabin. Gunner and complete
  crew captures from browser04 also render correctly; final full acceptance
  remains pending.
- The first firing image exposed a pulse that could expire before its first draw.
  Runtime `e983681` guarantees that confirmed pulses render before aging. Parent
  inspected browser04's exterior and gunner captures: both laser beams visibly
  emerge from their authored barrels, with no central glazing/sight strut.
- The first two browser interruptions were fixture defects: a gameplay-arming
  wait while still in a dialog, and a direct walking path through the rear hull.
  They do not justify weakening held-input gates or hull collision.
- Online pilot boarding reached the seat, but an untimestamped rendered-position
  sample exceeded the fixture's step limit. Timestamped client/server access
  evidence was collected before attributing the discontinuity. The new
  actual-room regression proves continuous access at every 30 Hz server tick
  through the exact final pilot eye. Browser04 passes the unchanged rendered-step
  limit: pilot 0.056667 m across 246 samples, gunner 0.141667 m across 171 samples;
  rendered and authoritative positions agree. The original anomaly remains
  recorded without claiming its unobserved cause.
- The backpack inspection exposed ship cargo access treating a rover cabin as the
  distant parked ship. `f6847ba` reuses the checked ship-occupancy helper, retaining
  actual 50 m access for nearby Nomad/Atlas carriers while refusing distant or
  absent carrier positions. Parent reviewed the fix; room and cargo coverage
  passes 20 cases in 14.515 s, including the new access-continuity regression.
- Browser04 reached the real two-player station/EVA approach, both seats,
  simultaneous drive/gunner fire, held-trigger suppression during exit and
  neutral pilot fallback. Opening inventory then disconnected the pilot with
  `Too many messages.` The visible local backpack was a fallback after that
  disconnect, not the requested server inventory. Parent traced repeated
  Sentry suspension calls to immediate neutral network sends every frame;
  `fd43bd0` now sends the immediate stop once per suspension boundary and leaves
  the ordinary 20 Hz client clock running. Parent reviewed both the adapter and
  its real-client regression: five seconds of 240 Hz blocked step/render calls
  remain at the normal message rate with Sentry occupied or inactive; synthetic
  neutral never arms a fresh vehicle-control epoch. All 33 focused input/Sentry
  cases pass in 0.771 s. Server limits are unchanged. The final browser still
  requires server inventory and connected state across its full open/close/exit
  journey; offline fallback cannot satisfy that check.
- Browser05 reached solo pilot boarding, drive/reverse, barrel fire, held modal
  suppression and controller disconnect. The focus helper then detached its
  probe session after closing the target tab, overriding its return with a
  cleanup error. `da45e39` corrects that test-only ordering and writes the focus
  report before cleanup. The application source is byte-identical to `fd43bd0`;
  remaining browser journeys still need completion.
- Browser06 compared a shot count sampled while RT was firing against a later
  open dialog. The original extra burst's timing was not recorded. `3233c91`
  observes the actual dialog `open` mutation, retains both timestamps/counts,
  and requires no further firing during the modal or after a held-trigger exit.
  This corrects the measurement boundary without changing game input behavior.
- Browser07 retained both online connections but its position-only EVA test
  driver circled the first exterior waypoint, never closer than 9.564 m.
  The fixture now observes local velocity and uses bounded standard-pad thrust
  plus deliberate braking. Parent probed the exact exported helper against the
  real EVA integrator and stick transform: 40/40 cases at 8/10/20/60 Hz input,
  with 0/100 ms observation lag, finish within 0.305 m and below 0.03 m/s.
  The longest 205 m leg takes 69.75 s. This is a fixture steering diagnostic,
  not browser or collision acceptance; no application movement, collision,
  authority or timeout rule was changed. The real route remains required.

## Checks performed by the parent

The first private combined source passed all **1,224 unit cases** across **161
registered files** in **48.960 s**. After the cargo and suspension changes, the
same full inventory on `fd43bd0` passes **1,227 cases**, no failures or skips, in
**70.819 s**, using two workers and a disk-backed temporary directory.
The final production build passes in **13.95 s**; its existing bundle-size
advisory is retained. Repository checks with explicit `origin/dev/all-features`
base pass for 229 changed paths; the suggested plan ran. These helpers do not
certify gameplay or art.

The full serialized multiplayer suite passes **210 cases**, with **2 existing
opt-in skips**, no failures or cancellations, in **65.093 s**. It used the Sentry
server source retained by this combined candidate and private temporary databases.
The missing ignored Prisma client was generated normally; no schema or shared
database was changed. Original native/setup failures remain in the failure ledger.

Raw parent records are in ignored `test-results/sentry-combined/` in the integration
checkout and `assets/burrow-sentry/.staging/multiplayer05-parent.log` in the feature
checkout. The first combined wrapper failed with sandbox `spawnSync git EPERM`
before running any tests; the named host run is the actual passing suite.
The final sandbox build stopped at Vite's temporary configuration write through
the existing external `node_modules` symlink (`EROFS`, `build02.log`). The bounded
host `build03.log` is the actual final pass; no application or dependency change
was made to hide that environment failure.

The inspected first browser captures use Chromium 151.0.7922.173, ANGLE OpenGL ES
on AMD Radeon 860M, 1440×900, seed 7291. They record no application errors or
warnings and one aborted music request. They are partial author captures, not a
complete journey, hardware/FPS result or independent scored art acceptance.

## Delivery still required

Review the final corrected source, completed controller/two-client/native-touch
journeys and actual laser images. Preserve the exact shared dirty HANDOFF during
local integration, then refresh the existing managed preview with matching
protocol 8 and its existing persistent database. Record served source/model/health
verification and open a draft PR stacked on the checked compound dependency.
