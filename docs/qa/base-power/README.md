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

Controller/browser and final prop captures are queued behind the shared host GPU
window. Independent visual score, full multiplayer building and physical Xbox
are not claimed. See [pipeline memory](../../base-power-pipeline.md).

Additional regressions pass for a lost fuel acknowledgement, immediate pending
status, a remote layout change and an account-cookie switch. The actual HTTP/SQL
test rejects a POST bound to another account. Wind rotor separation initially
created six mesh batches; sharing rotor-arm material reduces it to the existing
five-batch limit. All exported bounds and budgets pass after that correction.
