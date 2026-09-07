# Cargo tractor verification

2026-09-07, builder record for SA-CARGO-002 / `feat/cargo-tractor`.
Base cargo/social/landmark integration is `4706d62`. Final runtime `70fcaad`.
This is a checked development feature, not independent art or hardware acceptance.

## Implemented

The calibrated field multitool has a selectable tractor mode, mint beam, physical
detached crates, adjustable hold distance, alignment and nearby grid securing.
All 1/2/4/8/16/32/64 SBU sizes use their original cargo assets and volumes. The
Nomad6/Atlas512 capacities and 1 SBU hand-carry limit are unchanged. Larger
containers move more slowly. Existing instant `haul` is rejected.

The optional `loose` ledger records each crate's original identity, pose and
exclusive expiring lease. Server-derived aim, stationary ships, theft permission,
shape sweeps and slot fit govern movement and custody. Release/focus loss/menu/
disconnect stop movement and preserve freight; another pilot can reclaim an
expired lock. Released crates use an arrest field, not gravity simulation.
Protocol4; no additional SQL migration. Normal solo, test RAM and online saves
remain separate. Native multi-touch tracks the powering finger independently.

## Automated checks

- Full unit suite: **857/857**, `full-unit.log` (39.9 s), including the eight
  tractor/lease/shape tests. Later receipt and touch fixes received focused checks.
- Full multiplayer: **116 pass / 2 SQL-only skips / 0 fail**, `multiplayer.log`.
  Both skipped SQL cases subsequently pass in the **27/27** disposable PostgreSQL
  follow-up (`sql-followup.log`, 8.7 s). No shared database is used as a fixture.
- Final **17/17** cargo/local-save/tractor/server checks (`durable-release.log`,
  2.7 s): real aim and ignored submitted coordinates, exclusive locks, disconnect/
  reclaim, failed write, unchanged crate identity, hull-switch blocking, actual
  SQL migration/concurrent sale/rollback and exact detached-cargo close/reopen.
  The saved position includes 25,000,000,000.125 m to exercise world precision.
- Production build passes; inherited Vite chunk-size advisory remains.
  Repository and whitespace checks pass. Check-plan helper is advisory only.

Raw logs/results live outside Git at `/home/cees/.cache/star-agent-tractor/`.

## Actual rendered journeys

Native Chromium151 / WebGL ANGLE OpenGL, one Playwright worker. Desktop1440×900
and phone390×844. Standard Gamepad is injected, not physical hardware. Shipments
are explicitly preloaded into isolated developer RAM inventory; no player pose
is rewritten after the normal docked start. The earlier SBU delivery record covers
station purchase → physical return; these cases exercise the new tractor route.

1. **Nomad2SBU controller, 58.7 s, PASS**, `browser-third.log`, runtime71d59b6:
   stand from the chair, physically walk aft, aim, open Menu → Trade → Cargo,
   equip tractor, hold RT, move the crate, open menu and stop, neutral-arm the menu,
   hold RT across its close without replay, release/re-lock, secure with X, holster
   and inspect the phone cargo page. No mining beam or hand-carried2SBU appears.
2. **Atlas64SBU keyboard/native touch, 59.9 s, PASS**, `browser-atlas-final.log`,
   runtime501a6fb: stand/walk from cockpit to the deck using physical movement,
   keyboard/menu equip, hold T, pull closer, release/re-lock, then a native second
   touch secures while the first holds the beam. Phone bounds and saved64SBU grid
   contents are checked; holster returns to play. The physical approach uses the
   standard Gamepad helper; this is a mixed-input route, not a touch-only flight.

No captured page/console errors. Both tools/geometry were inspected in the actual
renderer. Subsequent70fcaad only normalizes a receipt's optional JSON field; it
does not alter visuals or input. No further GPU job remains. Four curated images:

- [Nomad beam and contextual hints](cargo-tractor/nomad-tractor.png)
- [Atlas64SBU beam](cargo-tractor/atlas-tractor.png)
- [Phone tractor controls](cargo-tractor/tractor-phone.png)
- [Phone cargo manifest after securing](cargo-tractor/tractor-cargo-phone.png)

## Failed checks and corrections

- First SQL run lacked this new worktree's generated Prisma client. Generation
  restored the isolated test setup; no application workaround or shared DB change.
- First browser build omitted `VITE_DEV_TOOLS=1`, started in orbit and failed its
  station walking waypoint. The config now builds with the flag and asserts an
  actual docked start. No tractor activation/pass was claimed for that attempt.
- The first real controller operation passed movement/menu-stop, but the fixture
  pressed B before the newly opened menu had received neutral input. The shared
  router correctly ignored it. The fixture now neutral-arms the menu before the
  held-trigger close check; gameplay gating was preserved.
- Tractor hints were cached under the previous mining-tool key. Include tractor
  mode in the cache key; inspected hints now say TRACTOR and SECURE GRID.
- The Atlas fixture initially matched Trade tabs in thirteen hidden dialogs.
  Scope selection to `dialog[open]`; no application change for that failure.
- Native second-touch release cleared the powering finger and did not reliably
  synthesize a click. Track pointer IDs and act on native secondary pointerdown.
  Secure waits for a pending movement write; availability no longer flickers
  during those saves. The affected Atlas case then passed.
- Exact detached-crate SQL reopen comparison found an optional receipt property
  with `undefined` in memory but omitted by JSON. Omit it consistently before save;
  exact saved state, identity and double-precision position now compare equal.

## Limits

Reuses the existing tool/crate assets and beam shader; no new asset approval is
claimed. Collision is conservative envelope handling. There is no ship towing,
tractor turret, gravity-driven crate fall, independent visual score or FPS claim.
Cross-account authority, visible snapshot delivery and reconnect are server-tested;
a rendered two-human online piracy session and physical-controller playtest remain
unperformed. Standing local integration permits a labeled development checkpoint.

## Local delivery follow-up

Integrated in local dev `638a5e4` with the [handheld Blender pass](handheld-tools.md)
on 2026-09-07. That follow-up provides the distinct tractor model and preserves the
physical cargo behavior. The combined Nomad controller route passes on final
runtime `a50c060`; all8 cargo/server/actual-SQL cases pass after preparing the
isolated checkout's database fixture. Client and API were refreshed together for
protocol4 at21:09:42UTC, with the existing persistent database retained and no
schema migration or reset. The native-touch evidence above remains specific to
its original checked source; no new hardware claim is made.
