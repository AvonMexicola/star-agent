# Atlas meadow ramp correction

The seed 7291 meadow start exposed three boarding faults: the aft exterior
button rejected boots 0.52 m above its assumed floor, the forward ramp toe
floated 1.24 m above terrain, and jumping more than 0.45 m lost ramp support.

Exterior controls now use physical reach to their visible panels. Parked ramps
fit their existing rigid geometry to canonical terrain or the real landing pad.
The deployed floor and normal follow those same transforms. Navigation retains
jump support and catches descending feet crossing a ramp, without lifting a
player through its underside. Station angles and server-owned replication remain
explicit; parked contact fits are cached by pose, seed and support revisions.

Validated on 2026-09-08:

- Build and 86 focused Atlas, rover, navigation, build-pad and server tests pass.
- Ten update-driven jump/walk regressions pass; the prior navigation fails nine.
- Production GLB main/toe raycasts agree with support within 0.1 mm. Dense
  canonical samples put both meadow toes in contact without sampled burial.
- Full `npm test`: 990 pass, five fail. The same five failures reproduce on the
  unchanged preview baseline: obsolete pad/opening fixtures and station launch
  checks already assigned to the fleet integration owner. These are not passes.
- Cees requested to perform the hands-on test instead of the queued browser
  run. The controller regression is prepared in
  `scripts/atlas-ground-ramps.config.js` but has not been run. No new browser,
  physical-controller, screenshot or FPS acceptance is claimed.

Manual route: reload the local meadow link, operate both exterior buttons,
walk up/down each ramp, then jump from the grass onto each ramp. Uneven terrain
can contact one edge of a rigid ramp before the other; no invisible floor extends
beyond its real toe. Report the end, control used and point of any failed step.

## Current fleet integration — 2026-09-08

Applied the complete checked `4bc97438814e6b2ede81fb55d4aa41d0a16faa99`
delta to fleet baseline `c732034` in `feat/atlas-ground-ramp-integration`.
The only content conflict was `package.json`: the complete current test list,
including HUB market/policy/defense suites, is retained and the three ramp suites
are appended once. Main retains the occupied-Burrow Menu9 fix; its only changes
are the checked build-pad pose and revision hooks. Both trading modules retain
the finite-market/tractor transaction and hands-free restrictions, adding only
the checked pad revision callbacks. Protocol remains 5. No medium ships, asset
replacements, station geometry changes or shared-preview writes were added.

Combined checks:

- **136/136 pass**: the three new ramp suites, Atlas authored/gameplay geometry,
  actual full-size station/20-berth sweeps and opening, rover surface/carrier/
  storage/physics, SBU/tractor and build-pad navigation/shapes.
- **51/51 pass**: server cargo, station market/hub, community room, private
  performance snapshots and remote players. This includes isolated PostgreSQL
  cargo migration, atomic transaction failure, concurrent settlement and restart.
- An additional CPU probe exercised actual server-created Navigation through
  JSON `playerSnapshot` and `applyAuthoritativePeer` for **300 frames** of ramp
  opening, adapted ground contact and closing. All mechanism angles matched;
  connected recipients never sampled local support; pivots, width and rigid
  leaf lengths stayed fixed. Protocol input ignored client mechanism fields.
- Production build passes: `main-BYHoMVrV.js`; the existing large-chunk warning
  remains. No new shader or rendering claim follows from this build.
- Repository check and change-plan check pass against `c732034`. The first repo
  check rejected a temporary link to this agent's own generated Prisma client;
  replacing that link with an ignored local copy resolved the check. No shared
  dependency generation or database mutation occurred.

Logs are `/tmp/star-agent-ramp-integration-{physical,server,build,repo,plan}.log`.
The owner's five stale baseline fixture failures remain recorded above; the
current fleet fixtures pass in this combined focused run. The complete normal
suite was not repeated here. No browser/GPU fixture was launched: Cees chose
hands-on terrain-ramp review, and the parent owns final station/cargo acceptance
and development promotion.
