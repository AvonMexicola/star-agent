# Trade settlement construction record

Author: Codex settlement lane. Source base c766544; branch feat/trade-settlements.
Four settlements reuse the authored assets under public/models/base and the source
pipeline in blender/build_base.py. No new model, texture, shader or dependency.
Layouts are reproducible from src/settlements/layout.js and the canonical world
seed/body frames. All GPU transforms pass through BuildSystem's local-origin
renderer. Player saves and claim ownership are separate from authored content.

## Checks and retained findings

- Actual single-process normal suite: 1,118 cases passed, zero skips, 94.23 s.
  Command: the package npm-test file list with Node's --test-isolation=none.
  The first ordinary npm test reports only per-file aggregates on this host;
  it is retained separately and is not the source of the case count.
- Initial layout checks caught 48 incorrectly mounted roof tiles and lamps over
  panel seams per settlement. Corrected roof height to the existing .006 m mount
  offset and centred lamps within supported ceiling tiles. Updated checks pass.
- Canonical pad surface sampling passes: every sampled deck point clears terrain
  and pad piers reach it. Nomad support, open-door traversal, wall collision,
  terminal reach and online exclusion pass. These are numerical checks, not art review.
- Market checks pass real cargo/credit conservation, independent stock, distance
  rejection, receipt replay, buy/sell spread and depletion across saved reload.
  Missing established settlement markets fail closed instead of replenishing.
- A seed probe found that seed7291's meadow region is under water in some other
  worlds. Survey now falls back to that seed's canonical coast/forest/polar
  destinations. Seeds 0,1,42,12345,4294967295 each yielded supported Aeon sites.
  If no supported site can be found, that location is omitted with diagnostics
  instead of preventing the rest of the game from starting.
- Production development builds pass. Initial sandbox build could not write
  Vite's temporary config beside linked dependencies; approved execution passed.
  Existing Vite large-chunk warnings remain; no asset/FPS acceptance is inferred.
- Repository checks and requested plan against origin/dev/all-features pass.
  That remote ref predates 57 local medium-ship commits; the c766544 plan records
  this lane's actual diff separately.

Independent visual review and physical-controller acceptance remain pending.

The final combined runtime is 03a561e: checked base-commerce f51822f was merged
after the first browser attempt. Shared-hook resolutions retain the owner's base
storage, sale reservations, power gating, online authority, beacon details and
deduplication alongside settlement market lookup and the Trade filter. Both new
test files remain in the normal suite. This exact union passes **1,127 actual
unit cases, zero skips, 77.87 s**, plus **62 focused cases** and the production
development build (4.04 s). Logs: /tmp/settlements-union-unit.log,
/tmp/settlements-union-focused.log and /tmp/settlements-union-build.log.


Additional regression evidence: 55 focused settlement/build/navigation/market cases
pass after public-site protection and the seed fallback. All four sites resolve on
seeds 0,1,42,12345,4294967295 and7291. Fifteen shared cargo/market regressions pass;
the separate disposable PostgreSQL persistence case passes after generating this
worktree's Prisma client with npm run prisma:generate. Its first run aborted Node
26.7.0 inside InternalCallbackScope::Close at callback.cc:185 while reaching a
local socket test in the sandbox (SIGABRT, host PID694819, 12:55:18 CEST).
The approved run avoided that abort but found the missing generated client.
Original logs and core metadata were retained, no app fix was made for either
harness failure, and only the failed fixture's own PostgreSQL process was stopped.
A missing generated client caused that fixture to leave its child server running;
the repaired rerun exited0 and cleaned up its own database normally.

Before browser validation, checked local station repair76aa45e was merged into
this branch at586d619. No settlement runtime conflicts occurred. Existing public
station bytes are the checked owner revision, not another worktree's pending edits.

## Browser and builder visual inspection

`SETTLEMENT_EVIDENCE=/tmp/star-agent-settlements-02 npm run test:browser -- -c
scripts/settlements.config.js` ran one worker, no retries, on Chromium
151.0.7922.173 with ANGLE OpenGL ES 3.2 / AMD Radeon 860M (radeonsi krackan1 ACO),
seed 7291, desktop 1440 × 900 and phone viewport 390 × 844. Runtime 03a561e.
The complete **injected standard Gamepad journey passes in 2.1 minutes**, with
zero page errors, console errors or warnings. It selects Stillwater in the real
map, extends gear, lands, leaves the seat, opens the hatch, walks the ramp and
pad into the exchange, buys one SBU of ice into actual cargo, sells it back,
returns through the same ramp and cabin, sits and launches. Stock returns to
2,400 and credits finish at 1,493 from 1,500; the spread is conserved.

Dialog closure, a real browser tab focus loss/return, and injected Gamepad
disconnect/reconnect all suppress a held RT until neutral. Cargo fits both
viewports. The initial ship approach at 65 m is an explicit development fixture;
the following player journey uses only controller buttons/sticks with read-only
navigation feedback. This proves neither physical hardware nor continuous
interplanetary travel. See [controller receipt](controller-receipt.json),
[map selection](map-desktop.png), [exchange](exchange-entrance.png) and
[phone cargo](cargo-390.png).

The visual tour reached all four worlds and retained actual renderer/state
captures: [Aeon](aeon-overview.png), [Selene](selene-overview.png),
[Pyre](pyre-overview.png), [Miasma](miasma-overview.png). Builder inspected each.
Aeon and Selene show the three enclosed kit buildings and clear pad; interior
lights and a reachable terminal are visible in the physical Selene visit.
Pyre and Miasma are night-side views: runway markings remain visible but building
exteriors are dark. Existing service lights are deliberately capped at 28 m;
distant overview visibility is not an independent materials/lighting approval.
No FPS or broad performance acceptance is claimed. Cold scenes and the dense
kit carry an outstanding performance/visual-review cost.

Retained failures: attempt01 completed trade and returned inside the cabin but
its last pilot waypoint stopped at ship-local z +0.195, outside the canonical
seat's 1.6 m reach. Corrected fixture stops at z -1.65; attempt02 completes.
Attempt02's separate four-world case then failed the phone selector because
`[data-map-view="locations"]` matches both the dialog and its button. All four
world images were already captured; the combined case is **not** labelled passed.
The selector is now button-scoped and the phone closure is isolated from costly
world reloads. Original logs/screens/state remain in /tmp/star-agent-settlements-01,
/tmp/star-agent-settlements-02 and /tmp/settlements-browser-01.log / -02.log.

## Delivery boundary

Player-base commerce and station repair are preserved at their checked owner
revisions. The settlement feature adds no server schema or protocol change of
its own. Independent review, physical gamepad testing and shared authoritative
settlements remain open. Public release is not implied by local integration.
