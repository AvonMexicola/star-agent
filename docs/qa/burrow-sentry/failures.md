# Retained Sentry attempts and corrections

Raw CPU/build logs remain in the ignored `assets/burrow-sentry/.staging/` and
browser logs/videos/images in ignored `test-results/sentry-*`. Nothing below
turns an incomplete or skipped check into a pass.

| Attempt | Finding | Resolution / subsequent evidence |
| --- | --- | --- |
| author01 | Blender wrote export but did not exit after audio startup permission error | Only its owned PID stopped. author02 completed Blender export and exit 0 through the approved host path. |
| focused01–03 | Initial hidden-file isolation issue, then gunner eye route clipped the seat headrest at x = -0.48 | Authored route now detours at x = -0.45; actual 12 cm eye-sphere route and GLB checks pass. |
| room01–02 | Incomplete vehicle adapter lacked `look`, causing actual room errors | Complete adapter composes step/look/key/interact/constrain; 13 normal room cases passed. |
| focused04–05 | Incorrect raw Gannet-system fixture; stale pilot input after gunner reservation; actual full turret sweep exceeded Gannet ceiling | Use actual carrier system and new neutral epoch. Gannet is explicitly refused; Atlas full-envelope/ramp/frame checks pass. |
| focused06 / server02 | Rifle fixture expected 30 damage; canonical rifle deals 25 | Corrected expectation only; actual hull damage, ship HP preservation and destruction/ejection pass. |
| authority07 / focused08 | Review required owner-disconnected crew, mixed friendship, and all-crew pending membership | Live validated hull target and single-debit all-crew relationship logic pass, including held promise while the nonfriend leaves. |
| build02–03 | Sandbox EROFS on Vite's temporary config cache through existing dependency symlink | Bounded host build passes; no dependency or permission changes. |
| unit02 / multiplayer01 | Prior turn ended before a completion receipt | Incomplete, not passed or failed. Later named runs retain actual completion receipts. |
| multiplayer02 | Node 26 native InternalCallbackScope assertion in concurrent subprocesses; seven file failures | Flags had been appended after file arguments. Retained; no application fix or claim that this was a Sentry expectation failure. |
| multiplayer03–04 | Proper serialized host run failed two SQL cases, then kept the cargo child alive; same result with short disk TMPDIR | Only exact owned Node parent/cargo children stopped. Focused sql-failure01 identified missing worktree-generated Prisma client. This was a private bootstrap prerequisite, not a schema or pool failure. Parent generated the ignored private client; multiplayer05-parent passed 210 cases/2 existing opt-in skips, no failures, in 65.093 s. |
| server03–04 / collision01–02 | Added actual moving room fixture never moved: full suspension envelope was ray-swept below its supporting station deck | `eda1ba7` raises only lower side samples to 15 cm above the root while preserving true upper clearance; canonical support still owns tyres. collision03 passes walker/rover stop and no phantom owner-ship damage. |
| focused09 / build05 | Final frozen deck-contact source | All 42 focused GLB/core/Atlas/security/room cases pass in 19.00 s; production preview build passes in 9.21 s. |

Browser01 (`2026-09-08T21-39-51.380Z`) reached actual pilot boarding,
forward/reverse, aim/fire, seated local Character and backpack. Held RT correctly
prevented the first B in the new dialog, but the fixture waited for gameplay
arming while still in UI. It now waits for the existing `uiArmed` gate, releases
the entering held input, then holds RT while actually leaving. No gameplay
change was needed. Gunner/two-client cases were skipped by `maxFailures=1`;
unchanged source hashes, original video, stills and state are retained.

Its firing image exposed a real presentation issue: a new 0.13 s pulse immediately
lost the current frame's dt (up to 0.2 s), so it could expire before its first
draw. Each confirmed pulse now renders once before aging, with read-only actual
endpoint/visibility evidence. Build06 passed in 6.78 s; subsequent04/05/08
captures show the actual twin barrel beams.

Browser02 (`2026-09-08T21-49-28.932Z`) connected both accounts and deployed a real
shared rover through controller Menu. The direct diagonal pilot waypoint crossed
the aft hull and stopped at local [-1.277, 1.75, 2.8846], matching its 2.88 m
boundary. Parent independently confirmed that collision. The fixture now walks
aft, across the port corner, then to the door. Collision was preserved, with no
runtime change; both-context video and physical path samples are retained.

Runtime `eda1ba7` preserves checked shared `f1ef821`. Browser01 used Chromium's
ANGLE OpenGL ES backend on **AMD Radeon 860M** at **1440×900**. It recorded zero
page/console errors or warnings, and one aborted music MP3 request. The actual
GLB rendered and local Character state was visible/seated; full feature browser
acceptance remains pending. No hardware-controller or FPS pass is inferred.

Browser03 (`2026-09-08T21-57-16.900Z`) traversed the corrected aft-port path and
physically seated the pilot, but its largest sampled rendered step was 0.746 m,
above the unchanged 0.6 m check. The recording lacked timestamps, so this alone
does not distinguish a reconciliation discontinuity from a delayed rendered
frame. The original context videos, state and failure are retained. The next
fixture writes time, rendered position and authoritative peer pose before
evaluating the same condition with a soft assertion, allowing later independent
authority steps to produce evidence. The added actual-room regression checks
every 30 Hz route step and passes as part of focused10 (20 cases, 14.515 s).

Browser01's backpack also revealed that `insideShip` on a sealed rover bypassed
the parked ship's normal cargo distance. The cargo helper now reuses checked
`occupiesShip`; rover occupants use the actual 50 m distance branch. Focused10
covers nearby Nomad/Atlas access and distant/missing carrier refusal.

Browser04 (`2026-09-08T22-16-52.220Z`, 4.8 min) completed both real station/EVA
approaches, boarding, concurrent pilot drive/gunner fire and neutral pilot fallback.
Pilot access measured 0.0567 m across 246 samples; gunner 0.1417 m across 171,
both passing the unchanged 0.6 m condition. The original03 timing remains unknown;
no threshold was relaxed. The inspected crew images show both laser beams at the
actual barrel ends and an unobstructed gunner sight.

Its final server-inventory check exposed a real disconnect: the pilot's error was
`Too many messages.`, and the local backpack appeared only after that disconnect.
Sentry called immediate neutral transmission from both blocked simulation and
render frames. The owned suspension adapter now stops on the transition once;
the ordinary multiplayer 20 Hz clock still sends neutral heartbeats. The server
rate limits and server-inventory assertion are unchanged. `input-rate03-host.log`
passes all **33** Sentry/multiplayer input cases in **0.771 s**, including five
seconds of 240 Hz blocked updates with Sentry occupied and inactive. Every
synthetic neutral keeps `vehicleReady` false. Final browser connection checks
now span inventory open, held dialog, close and physical pilot exit.

Browser05 (`2026-09-08T22-37-01.560Z`, 1.3 min) reached the solo pilot, drive,
reverse, visible barrel pulses, distant-cargo refusal, held modal and controller
disconnect checks. The native focus helper closed its temporary tab before
detaching that tab's CDP session, causing teardown to throw and obscure its
return. The fixture now saves the focus receipt before cleanup and detaches
before closing. No runtime change was made. Remaining cases did not run.

Browser06 (`2026-09-08T22-44-27.274Z`, 59.1 s) recorded six bursts before View
was sent and seven when the held-input dialog check ran. Both controller and
turret were disarmed in the visible dialog, but the original counts do not
establish when that extra burst occurred. The fixture now records the actual
dialog-open attribute mutation with its timestamp and shot count; subsequent
no-fire/modal and held-exit conditions use that boundary. No input or cadence
code changed, and06's missing timing remains unobserved. The two-client case
now runs first so its connected inventory/exit verification takes priority.

Browser07 (`2026-09-08T22-49-12.369Z`, 4.2 min) kept both players connected and
seated the pilot, then the gunner's first exterior EVA waypoint failed to
converge. Its retained final samples oscillated 9.56–37.82 m from the point with
5.18 m/s final speed. The fixture pursued position without damping velocity in
the actual inertial EVA model. Its replacement observes local velocity, reduces
desired speed toward the point and uses the existing LT brake for deliberate
stops; only standard Gamepad axes/buttons change. The physical waypoints, reach
and timeouts are retained. There was no application error/warning or connection
loss; Vite's reset warning during context teardown is retained in the raw log.

Browser08 (`2026-09-08T23-24-26.349Z`, 5.1 min) completed the corrected physical
EVA route, both seats, concurrent driving/fire, gunner exit and neutral pilot
fallback. Maximum sampled access steps were 0.17 m for the pilot and 0.0567 m
for the gunner. Both clients stayed connected with no server error, and page
errors/warnings were empty; two aborted music requests remain recorded.
Occupied controller View then opened local Backpack instead of server inventory.
The Sentry callback used the local-only `nav.openBackpack`; it now selects the
existing online-aware `nav.openInventory` when connected. The strict server
dialog assertion is retained, with an additional actual panel Backpack click
and connection check. No authority or rate limit changed. Solo/native cases
did not run, and the original failure and unchanged source hashes are retained.

Before09, a separate source review identified a phone return-to-walking overlap:
the on-foot Sentry panel used bottom 82 px over the existing coarse walking
controls at bottom 88 px. The normal Burrow already reserves bottom 350 px when
unoccupied. The owned Sentry panel now applies that same separation based on its
occupied class. This is a source-review correction, not a recorded08 phone
failure. The native 390×844 route now checks disjoint panel/control bounds and
actual button hit targets before entry and after exit, saves an on-foot image,
and uses native touch to walk away. Its rendered result remains pending.

The peer World/Faction startup race exposed a guard-format gap before09. The
owned guard now recognizes `.bin/playwright`, `@playwright/test/cli.js` and
`playwright/cli.js` test commands, plus worker processes. Chromium can expose its
command line as one space-joined argument; flag-word normalization now detects
that actual form. A host `--guard-only` check at `2026-09-08T23-52-56.066Z`
correctly returned busy (exit 2) for Faction CLI 2275526 and its Chromium processes,
including 2276141. No Sentry browser or server launched. The raw private process
receipt is retained; this is guard validation, not a gameplay attempt or pass.


Dedicated09 (`2026-09-09T00-00-52.733Z`, frozen `a77953d` / runtime
`9d31320`) reached physical EVA and the rear gunner door, admitted the gunner
seat and began its access animation. The gunner then disconnected with
`Too many messages.` while the pilot remained connected. This is an unresolved
socket rejection, not a selector or travel failure. The application reported
no console errors or warnings; three aborted music requests and teardown WebSocket
reset are retained. Solo/native cases did not run. No rate limit was changed.

Parent diagnostics distinguish the existing rate and pending-message limits.
The next fixture passively records sent WebSocket message types, timestamps and
per-second counts, retains failed access samples in `finally`, and orders solo,
keyboard/phone, then the two-client diagnostic. Two actual-adapter CPU probes
(on original `a77953d` / `9d31320`, then checked rotating-world composition plus
the Sentry frame changes) exercised real Navigation, GamepadInput,
MultiplayerClient, Sentry system and room snapshots with renderer/UI stubs only.
At 20/60/144/240 rendered frames per second, boarding generated exactly one
interact action; pending exit generated one request; modal/focus/held controls
stayed bounded. Peak rolling-second outbound counts were 23/24/24/24. These
memory-transport diagnostics did not reproduce09 and do not replace its socket
or browser acceptance.

Rotating-world integration required explicit carrier, renderer and beam chart
tags, foreign suit/hull ray conversions, and physical seat/chart conversion.
The Sentry placement uses Navigation's existing placement-revision convention
so a chart transition already applied by the seat is not applied again by
Navigation's enclosing step. Focused tests use that actual enclosing update.
Carrier02/03 initially failed because the new fixture used a nullish fallback
that replaced the valid inertial `null` frame with Selene; preserving explicit
null fixed the fixture. Carrier04 and final08 pass. Focused06 passed40/42 but
the two new ship-ray fixtures aimed0.2m below the authored hull's minY=0; lowering
the fixture hull root2m made its intended interception real. Final hit07 passes
all6 suit/ship/rover boundary cases. No collision allowance was weakened.
Build11 failed before Vite loaded config because the shared dependency cache
was read-only in the runner; the bounded host build is recorded separately.


Browser10 (`2026-09-09T00-50-23.525Z`) was deliberately stopped after its owner
found build12 had omitted `VITE_DEV_TOOLS=1 VITE_MULTIPLAYER_ENTRY=1`. The public
bundle therefore ignored the explicit Sentry surface start. Exact runner PID,
SIGINT, source hashes and original logs are retained. This is a QA build invocation
mistake; it is not a gameplay or Chromium failure. The guarded runner now owns
the flagged production build before each private browser job and records its
flags, frozen source hashes and actual generated JavaScript/CSS/index hashes.
No application behavior or server limit changed for this correction.


Browser11 (`2026-09-09T00-55-15.842Z`) correctly built the flagged bundle in4.30s
and recorded main-C7yzYpq9 plus its actual hashes. Before opening a browser,
Playwright refused the occupied8678 API port. The interrupted10 runner had left
its detached memory API and preview children alive. Their exact Node executable,
argv, worktree, unique SENTRY_OUTPUT token, process start ticks and listening ports
identified PIDs2402624 and2402664 as10's owned leftovers. They were gracefully
stopped with SIGTERM; the retained verified-cleanup receipt reports no survivors.
The portable runner now cleans only such uniquely owned fixture children after
each job, including interruption. It never reuses an existing server or treats a
port number as process ownership. No game source or server rate limit changed.
