# Base power candidate — 2026-09-07

User asks for base electricity/storage, solar/wind/fuel progression, loss of health
when unpowered and server removal at zero. Baseline audit confirms browser-only
construction despite an existing account PostgreSQL database. Implementation adds
account-scoped solo saves; shared multiplayer construction remains disabled.

The initial balance uses72 real unpowered hours to removal. An optional duration
question was sent; no answer arrived before implementation proceeded with that
stated default. Core creation grants2 kWh emergency reserve; batteries add empty
capacity. Existing bases are initialized when first entering this system rather
than retroactively decayed. Sandbox health does not decay.

## Checks and corrections

- Initial focused checks caught a duplicated generated definition in the authored
  bounds registry; corrected before runtime QA. Final26 GLB bounds checks pass.
- Existing inventory tests assumed exactly nine material types and exactly six
  secondary-map types when filling eight slots. They now account for the two fuel
  feedstocks while retaining the same meaningful full-slot rejection assertion.
- Fresh-browser cloud tests initially used a fake storage that never retained
  writes; fixed to exercise actual read-after-write behavior.
- Pure power/environment and cloud checks pass: empty battery capacity, renewable
  charge, nighttime drain, partial-interval depletion, finite fuel conservation,
  no airless wind, roof-blocked solar, expiry, stale identity rejection, failure
  rollback and conserved mining mass/XP.
- Real isolated PostgreSQL + authenticated HTTP test passes, including concurrent
  CAS saves, account isolation, adapter restart, container restoration, offline
  expiry and rejection of resurrected IDs. Repeated after renumbering migration3
  to avoid the cargo lane's reserved migration2. Existing game DB was untouched.
- Full unit suite passes114 configured files; production build succeeds with the
  inherited chunk-size advisory. Later final checks recorded below.

Controller and prop renderer checks are complete below. Independent visual score,
full multiplayer building and physical Xbox are not claimed. See [pipeline memory](../../base-power-pipeline.md).

Additional regressions pass for a lost fuel acknowledgement, immediate pending
status, a remote layout change and an account-cookie switch. The actual HTTP/SQL
test rejects a POST bound to another account. Wind rotor separation initially
created six mesh batches; sharing rotor-arm material reduces it to the existing
five-batch limit. All exported bounds and budgets pass after that correction.

Final local/cloud regressions pass 8/8, including explicit sandbox-only fuel supply,
actual inventory debit and refusal to repair an already expired site.
`check:repo` reports pre-existing overlapping active task claims (audio/fauna/flight/
vehicle/integration); no unrelated registry claims were changed. `plan:checks`
completes but its remote-dev comparison includes the broader inherited integration
baseline; feature validation is scoped to this branch’s base-power changes.

## Final power checkpoint evidence

- Full unit suite: 114/114 files, 53.45 s. Production build succeeds
  (`main-BlZZ6LPS.js`, inherited chunk-size advisory).
- Controller-only production sandbox: 1/1 passed, 2.8 min. Placed solar, battery
  and uranium generator through the wheel, physically walked to the mainframe,
  observed charging, rejected fuel without its generator, supplied sandbox fuel,
  debited 0.1 kg uranium, inspected the remaining 0.9 kg in storage, returned to
  play and reloaded all pieces/charge. No debug teleport or state-injected placement.
- Shared UI: 8/9 initially; the legacy isolation case expected B-brake/RT-rise.
  Canonical current controls use B-descend/LT-brake/RT-fire. Fixture-only correction
  passes the focused case in 5.1 s. All nine cases have passing evidence, including
  the new Power tab and held-input suppression.
- Five power prop views: one renderer case passes in 6.6 s, Chromium 151.0.7922.173,
  ANGLE/OpenGL on AMD Radeon 860M, 1440×900. Studio draw counts include ground and
  human scale reference. No page/console errors. Gameplay/phone captures inspected.
- Exported kit: 26 pieces, 57,460 triangles, 5,115,660 bytes. Distinct reactor
  silhouettes/markings remain a future art-polish opportunity; current cabinet
  assets are functional and share the construction palette, not independent art
  acceptance. UI is readable at desktop and phone widths with scrolling.
- The standalone production test has no auth backend on its inherited proxy8084;
  unauthenticated session requests log ECONNREFUSED. Sandbox still completes with
  zero page errors. Real authenticated persistence is separately covered by the
  isolated PostgreSQL/HTTP test and live preview5557/API8557.

Commands: `npm test`; `node --test tests/base-power-database.test.js`;
`npm run test:browser -- -c scripts/base-power.config.js`;
`npm run test:browser -- -c scripts/build-ui.config.js` (focused `--grep 'B enters'`
correction); `npm run test:browser -- -c scripts/base-power-assets.config.js`.
Browser runs use the authorized host path and home-disk TMPDIR/output; only one
browser job ran at a time in this lane. GPU window released after captures.

## Removal and capacity follow-up

Cees requested an allowance above64 and a remove tool. Sites now accept1,024
pieces, while the existing claim radius remains64m (96m for a large pad). Added
explicit one-piece removal with no refund, storage/support/mainframe protection,
server-side deletion and stale-piece identity rejection. Aimed selection uses
actual building collision rays and an orange/red outline. Final controller
removal journey is pending its shared GPU window.

- Full unit suite115/115 passed44.13s after the first removal implementation.
- Subsequent focused build/power/cloud suite13/13 configured files passes after
  canonical snapshot comparison; local removal6/6 covers empty-space diagnostics.
- Cloud10/10 passes including a concurrent placement during a removal response and
  simulated JSONB key ordering. Real SQL/HTTP1/1 passes1.934s after corrections.
- The extended SQL second-save test exposed unchanged anchors being rejected
  because JSONB reordered object keys. Server anchor and client layout comparison
  now canonicalize keys. The older f20cebc checkpoint must not integrate without
  this correction. The next stale-expiry test correctly rejected its older
  watermark; the fixture now asserts that rejection and separately verifies a
  current-watermark stale site cannot revive.
- sync caching and distant per-piece update suppression are implemented; streaming
  and instancing remain planned. No populated-scene FPS result is claimed.
