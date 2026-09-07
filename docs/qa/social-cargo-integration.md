# Social and cargo development integration

2026-09-07 · integration steward · reviewed in `feat/dev-social-review` and
integrated into `dev/all-features` at **`f861f8f`**. The refreshed local preview is
http://127.0.0.1:5178/. This is a local development checkpoint.

## Source and merge boundaries

The candidate starts with the reviewed content and hosted CI correction through
`3e39a75`. It combines social runtime through `006c35c`/`6341e5d`, the social
browser fixture `99fa858` and final reviewed delivery `a4c533d` (draft PR72), cargo
runtime `3c7af88`, and flight-controls copy
`f5c6933`. Source-owner records are [social QA](multiplayer-social.md),
[cargo QA](sbu-cargo.md), and [flight QA](combat-momentum.md).

The database merge keeps the ordered migration runner and both storage adapters.
Accounts remain migration001, cargo is002 and social is004;003 stays reserved for
the separate base-sites work. The client clears commerce, social presence and
connection-lifetime chat together after disconnect. Protocol3 is shared by the
combined client and server. Social identity and kicks remain server-owned.

Cargo uses the complete visible Nomad assembly to establish its6SBU limit;
Atlas retains512SBU. The current expedition character, Burrow checkpoint, physical
boarding and finite-momentum flight remain included in the combined source.

## Combined checks

At `0dc0d31` (later source-owner merges contain documentation/evidence only):

- **849 unit tests pass**, zero skips, running the normal package test list with
  concurrency limited to two to reduce shared-machine load.
- **117 multiplayer tests pass**, zero skips, against a newly created disposable
  PostgreSQL instance. This includes accounts, cargo, social, real authenticated
  sockets, reconnect persistence, migrations, race/rollback checks and remote rigs.
- The production development build passes. Its main bundle is
  `main-BznCPb_L.js`; the inherited large-chunk advisory remains.
- Repository and whitespace checks pass across the original 95 changed paths.
  Final evidence/documentation expands the range from the previously live dev
  checkpoint `219a584` to 112 paths; that full range passes too. The final registry
  check caught cargo's cleared claims list, which was restored to its recorded
  source paths before promotion without changing runtime code.
- Earlier focused integration checks pass33 gamepad/dev-launch/character/landmark
  cases. The kick-handshake follow-up passes all four social socket cases.

The SQL command was:

```sh
TMPDIR=/path/to/short/private/cache node scripts/social-database.mjs \
  tests/server-*.test.js tests/remote-players.test.js \
  tests/multiplayer-ui.test.js tests/multiplayer-social-ui.test.js
```

The shared persistent database was not a test fixture. A private PostgreSQL
custom-format backup was created for promotion; its archive table
of contents is readable and the dump has 0600 permissions. Credentials and backup
contents are outside the repository and are not included in evidence captures.

## Browser and review status

The source-owner social controller journey passes in1.3min, including real chat
composition, mutual requests, blocking, presence and neutral input on return.
The steward inspected its desktop/phone Friends and controller-keyboard captures:
the controls fit the existing chrome, remain legible and show clear focus. The
scoped independent cohesion and information/function review is4/5 each.

The social keyboard/touch case passes in 1.4 minutes, including literal HTML text,
reload/rejoin persistence, held-key return and a private kick without broadcast.
The ten-pilot/30-friend paging case passes in 55.7 seconds. The steward inspected
the final desktop chat, touch chat/kick, phone roster and long-draft keyboard
captures. Controls and feedback remain legible and bounded; the independent
cohesion and information/function scores remain 4/5 across these final views.
Geometry, asset materials and scene lighting are N/A for the scoped UI review.
These two cases used `2b65a31`, whose runtime and social fixtures match `99fa858`.
Earlier harness path/hidden-close failures and the interrupted overlapping job
are retained in the social QA record; partial stages are not counted as passes.

Cargo's checked source has completed Nomad6SBU physical controller handling,
Atlas512SBU rendering/access, and controller pad/shop phone journeys. These are
source-owner production checks; they do not establish a rendered online cargo
soak or hardware FPS acceptance. Controls-copy review uses the owner's DOM-only
desktop/phone evidence and does not change the flight input model.

## Local delivery

The steward preserved the shared HANDOFF appends in `041129d`, then merged the
checked source as `f861f8f`. Runtime and social fixtures have no diff from the
combined tested source. The local Prisma client was regenerated, and the existing
persistent-preview service restarted once to activate client and API together.

The frontend on 5178 and direct API on 8087 both return healthy HTTP responses.
Live cargo-grid and protocol source match the committed files exactly; social UI,
controller help and the rover launcher also match after normalizing Vite's import
paths. The local database reports migrations **1, 2 and 4** and the three new
commerce/friendship/block tables. It retains the same cluster directory identity
and the pre-promotion account/player-state row counts. Only read-only queries
were used for delivery verification; no test account or chat was inserted there.

The server remains available at http://127.0.0.1:5178/. Refresh the browser for
protocol 3. Cargo, social and controls follow-up tasks are locally integrated;
base power, newer rover polish and new fauna/landmark refinements remain outside
this frozen promotion. Public hosting and main were not updated. No physical-
controller, ten-human soak, backup-restore or hardware FPS acceptance is claimed.


## Hosted check portability follow-up

The first PR73 run at `aaf08cc` passed source and browser checks, but the
multiplayer job failed its cargo PostgreSQL case before database startup:
`mkdtemp` referenced a developer-specific cache directory absent on CI. The job
reported 116 passes and one failure; it is not a successful hosted run.

The fixture now creates its disposable cluster under Node's `tmpdir()` using a
unique cargo prefix. Its authority, migration, concurrency, rollback and restart
assertions are unchanged. All seven cargo server tests, including real isolated
PostgreSQL, pass in 2.98 seconds with an explicitly overridden temporary directory.
The cluster is removed by the fixture; the shared development database is unused.
No application runtime changed. Hosted checks will rerun on the pushed fix.
