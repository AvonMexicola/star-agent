# Burrow Sentry parent review

Status: [draft PR106](https://github.com/AvonMexicola/star-agent/pull/106) is open;
full browser acceptance and local delivery remain pending. Cees retains product and release acceptance. This record
does not claim an independent visual score or physical-controller testing.

The parent integration agent reviewed the delegated Sentry implementation, its
authority and collision contracts, and the actual first browser captures. The
parent authored merge composition, socket diagnostics and delivery work. The Sentry owner retains
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
  `Too many messages.` The visible local backpack did not establish requested
  server inventory access. Parent traced repeated
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
protocol and its existing persistent database. Record served source/model/health
verification and update the existing draft PR stacked on the checked compound
dependency.

All five hosted checks pass on `860ffde`, run `34288992299`, and on the later
inventory fix `fc835cd`, run `34291190384`: plan, source, multiplayer, browser and
verify. They also pass on the final phone/game runtime `9d31320`, run
`34292125734`. The PR body edit superseded run `34291159220`, whose cancelled jobs and
resulting verify failure are retained; the named replacement run is the actual
complete pass. The generic hosted browser job does not replace the dedicated
Sentry journeys.

While browser08 was running on frozen `860ffde` / runtime `fd43bd0`, parent source
review found another inventory path to correct: Sentry's `openCargo()` called the
local `nav.openBackpack`, while the connected wrapper is `nav.openInventory`.
Both the visible Sentry Backpack button and the occupied-controller View route
reach this adapter. Keyboard I and the generic Pilot menu have separate online
wrappers. Browser08 reproduced the local-dialog failure while both clients stayed
connected, proving an independent routing defect alongside the earlier rate
flood. It completed the corrected EVA route, both seats and neutral pilot fallback
with rendered access steps of 0.17 m / 0.056667 m. The 5.1-minute failure retains
unchanged source hashes, zero application errors/warnings and two aborted music
requests. Parent inspected its exterior and gunner images; both beams emerge
from their barrels and the central sight remains unobstructed.

Parent reviewed and consumed the owned one-line fix `fc835cd`: connected Sentry
inventory now invokes the existing live server-aware callback, while solo keeps
the local backpack. Its 38 relevant input/inventory cases pass in 0.602 s and its
fresh production build passes in 4.27 s. Server, model and simulation source are
unchanged. The strict connected-controller dialog check remains, with an
additional native pointer panel check explicitly distinguished in the report.
Complete connected, solo and native browser acceptance remains required.

Before browser09, parent also found that the phone's fixed Sentry panel shares
the walking pad's lower-right area after exiting. The existing mining Burrow
already moves its unoccupied panel above that pad. Owner correction `9d31320`
applies the same positioning convention only to Sentry and tracks its occupied
state; desktop layout and shared cabin controls are unchanged. Its fresh build10
passes in 8.09 s, with repository/syntax checks complete. The native journey now
records disjoint bounds and actual hit targets before boarding and after exit,
then uses real touch input to walk away. This was a source-review finding before
the phone journey, not a fabricated failed browser capture. Its rendered
acceptance remains pending.

The shared queue exposed a launch-signature race between other owners. Sentry
did not launch into that overlap. Parent found its own guard could miss the
`.bin/playwright` CLI and Chromium's single space-joined command line. The
`a77953d` guard recognizes those observed forms, both official CLI paths and
`workerMain` / `workerProcessEntry`. Read-only host probes at 23:52:56 and
23:54:53 UTC detected the actual running Faction CLI, browser and worker and
returned busy/exit 2 without launching anything. Browser/backend/security
settings and the `9d31320` game build are unchanged. Original failed and
superseded evidence is retained.

Browser09 on frozen `a77953d` / runtime `9d31320` stopped after 6.4 minutes during
gunner boarding. The pilot remained connected; the gunner disconnected with
`Too many messages.` Both physical approaches completed, and the original video
shows the gunner's reserved seat and moving cabin access before disconnection.
The server rate ceiling and pending-command ceiling share that public message;
the cause is not yet established. No application errors/warnings were recorded;
three aborted music requests and the teardown WebSocket reset remain retained.
Source hashes were unchanged. Solo and native cases were not run.

Parent traced the actual on-foot interaction, input adapter, frame loop, client,
room and socket queue without finding another demonstrated input flood. A narrow
server diagnostic now distinguishes the rate ceiling from the pending queue,
preserving both limits and the public close reason. All 16 actual HTTP/socket
cases pass in 2.931 s (`server-http04.log`), including separate wire-level rate
and deliberately blocked-command cases. The next fixture persists failed access
samples and passive WebSocket timings. This instrumentation is not a gameplay fix
or acceptance evidence for the unresolved disconnect.


## Checked shared world composition

Private `c358541461b6a2bab9256aae25439e5c73a0c361` consumes only the released
shared `1da9b0e` rotation delivery, including checked faction and vacuum-base
`2a6e405`. The merge preserves planetary time and peer frames, all Sentry seat
fields, exact access reconciliation, Miasma canonical claims and the complete
164-file test inventory. Protocol 10 combines delivered rotation protocol 9
with Sentry authority; final client/API refresh must be paired. This private
composition has not been integrated or served.

All 1,252 normal cases pass in 59.879 s (`unit04.log`). The serialized multiplayer
suite passes 220 cases with two existing opt-in skips in 55.185 s
(`multiplayer06.log`). Explicit-base repository checks cover 335 paths; the
suggested plan and branch inventory ran. These results belong to `c358541`,
before any subsequent Sentry frame adaptation; no final combined browser/build
pass is inferred.

Parent reviewed the retained actual-adapter CPU diagnostic on old runtime
`9d31320` / head `a77953d`. Real Navigation, GamepadInput, MultiplayerClient,
Sentry system and authoritative room snapshots completed boarding at
20/60/144/240 Hz, with one interaction and peak rolling-second outbound counts
23/24/24/24. Modal/focus held-input gates, delayed exit acknowledgement and the
inactive panel remained bounded. Presentation was stubbed, transport was in
memory, and initial door positions were fixture setup. This rules out the tested
adapter cycles; it does not identify the native WebSocket failure or replace a
physical browser journey. The original script, JSON and log remain in the
feature owner's private `.staging/adapter-probe01.*`.


Parent then reproduced a carrier-cargo boundary defect: a rover rider 49.99 m
from a parked Atlas was denied because the query subtracted coordinates in
different rotation charts. The new regression uses actual Navigation getters
and `fromShipLocal`, both boundary directions and all four worlds, also refusing
50.01 m. The original host failure is retained in `cargo-frame-before-host.log`;
the first sandbox test process failed before named cases and is retained
separately. The helper now obtains the hull root through Navigation's existing
frame conversion; the 50 m limit and rover cabin classification remain unchanged.
All 13 cargo-access and ship-inventory cases pass in 0.160 s
(`cargo-frame-after.log`). This is a CPU boundary regression, not an Atlas
loading/flight browser acceptance claim.


The socket diagnostic also records only numeric rate/pending counters, whether
admission completed, and elapsed active-command time. This distinguishes an
awaited operation from a batch received before the serialized queue starts;
no message payload or account identity is logged. Limits, close reason and
queue scheduling are unchanged. The actual HTTP/socket suite passes all 16
cases again (`server-http05.log`), including the expected counters and bounded
set of diagnostic fields.
