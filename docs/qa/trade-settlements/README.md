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

Browser/controller/visual results will be recorded below after the queued job.
Independent visual review and physical-controller acceptance remain pending.


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
