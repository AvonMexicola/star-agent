# Social and cargo development integration

2026-09-07 · integration steward · prepared in `feat/dev-social-review`.
This record covers the checked combined local candidate. All required focused
social browser cases have passed; the serialized shared preview promotion is next.

## Source and merge boundaries

The candidate starts with the reviewed content and hosted CI correction through
`3e39a75`. It combines social runtime through `006c35c`/`6341e5d`, the social
browser fixture `99fa858`, cargo runtime `3c7af88`, and flight-controls copy
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
- Repository and whitespace checks pass across the95 changed paths from the
  previously live dev checkpoint `219a584`.
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

No shared service restart, main merge or public deployment accompanies this
prepared checkpoint. Local delivery details will be recorded after the serialized
promotion. No physical-controller or hardware FPS acceptance is claimed.
