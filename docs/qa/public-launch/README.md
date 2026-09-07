# Public homepage, solo snapshot and multiplayer capacity

This release creates three deliberately separate entry points. The homepage is
static project/media content; solo is a frozen browser build branched from checked
local development; multiplayer retains its existing deployed protocol and database
with capacity raised to twenty. See [the release procedure](../../public-release.md).

## Public media provenance

All images and films show real Star Agent development rendering. No stock or
AI-generated illustration is presented as gameplay. Captures contain only the
anonymous game canvas, with no desktop, account information or private messages.

| Public file | Source |
| --- | --- |
| `site/media/orbit.webp` | `docs/qa/nomad-02/world/01-orbit.png`, existing 1600×900 production-world capture; its adjacent README records the original environment |
| `site/media/coast.webp` | `docs/qa/main-integration/shore.png`, existing 1440×900 world capture |
| `site/media/selene.webp` | `docs/qa/moon-stones/landing-shelf.webp`, existing 960×600 lunar capture |
| `site/media/flight.mp4` and poster | This release's Kestrel test start above Aeon, seed 7291, external camera, eight-second canvas capture |
| `site/media/hangar.mp4` and poster | This release's Nomad hangar test start, seed 7291, eight-second canvas capture |
| `site/media/field-notes.mp4` | Flight and hangar clips joined, H.264, 1280×800, no audio |

These are explicit development test starts. Editing two scenes together is not
proof of a continuous whole-system journey. The homepage labels both current alpha
limits and the broader seamless-universe ambition. Media is encoded from the
captured canvas; public screenshots are WebP conversions of the stated sources.

## Multiplayer validation

The separate `release/public-multiplayer` branch starts at the exact former live
`f7a30ef` revision. Source/runtime release `f9037eb` preserves protocol version 1
and the production account database. Draft PR: <https://github.com/AvonMexicola/star-agent/pull/78>.

- Local multiplayer suite: 79 pass, one explicitly skipped SQL-only test.
- Host Node 22 room, remote-player and live-connection checks: 19 pass.
- Host auth/database checks against a disposable test database: all 15 pass;
  the test database was dropped afterwards, with no production data reset.
- Twenty authenticated WebSockets receive twenty unique pilots/hangars. The 21st
  receives room-full/1013 with the correct twenty-player message; replacing a
  disconnected pilot succeeds. The production signup rate limiter is unchanged.
- Public HTTPS registration, secure-cookie session, authenticated WSS and hangar
  assignment probe passed after deployment, removing its own synthetic account.

No claim of twenty simultaneous human/GPU clients or stable twenty-player FPS is
made. This is an enforced capacity release, with live performance still to measure.

## Infrastructure observations

Earlier capture attempts failed: one lost its graphics context after a scene
reload, and another encountered texture `ERR_INSUFFICIENT_RESOURCES` followed by a
Chromium main-process SIGILL (2026-09-07 20:32:48 UTC). That second process had reached
the game and had multiple threads; it was not the previously diagnosed single-thread
Crashpad startup signature. No exact crash assertion was recovered. Neither run is
passing evidence.

The runner subsequently reported EDQUOT while creating `/tmp/.git`. The host's
16 GiB tmpfs carried a roughly 12.1 GiB quota for the development user and was at
that quota despite ample SSD space. An SSD-backed temporary directory let both
scenes load and record without those resource errors. The user requested a system
storage correction separately; it does not change the game source or GPU flags.

Raw browser recordings, logs, reports and any extracted diagnostic memory remain
outside Git. Curated public media and final page/viewer screenshots are the shared
artifacts. The test uses one Chromium worker and coordinates the shared GPU slot.
