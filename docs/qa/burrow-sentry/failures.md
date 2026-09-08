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

| browser01 `2026-09-08T21-39-51.380Z` | Actual pilot boarding, forward/reverse, aim/fire, seated local Character and backpack reached; held RT correctly prevented the first B in the new dialog. The fixture waited for gameplay arming while still in UI. Gunner/two-client skipped by maxFailures=1. | Fix the fixture to wait for the existing `uiArmed` gate in a dialog, release the entering held input, then hold RT while actually leaving. Fixture correction does not change gameplay. Sources unchanged during01; original video/stills/state retained. Its firing image also exposed the presentation lifetime issue below. |

| browser01 pulse image review | Counter advanced but the sampled still had no visible laser. A .13 s new pulse immediately lost the current frame's dt (up to .2 s), so it could expire before first draw. | Each confirmed pulse now renders once before aging. Added read-only actual endpoint/visibility receipt; build06 passes6.78s, rendered follow-up pending. |

| browser02 `2026-09-08T21-49-28.932Z` | Both accounts connected and controller Menu deployed a real shared rover. The direct diagonal pilot waypoint crossed the aft hull and stopped at local [-1.277,1.75,2.8846], matching the2.88 m boundary. | Parent independently confirmed. The fixture now walks aft, across the port corner, then to the door. Collision was preserved. Both-context video and retained path samples added; no runtime change. |

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
