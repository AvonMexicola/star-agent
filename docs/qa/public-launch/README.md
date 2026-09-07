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

A separate host-only baseline on the frozen multiplayer runtime measured 1,800
simulation/JSON ticks after warmup: twenty pilots averaged **2.00 ms/tick**, p95
3.58 ms, maximum 5.61 ms, against a 33.3 ms nominal interval. Raw per-pilot state
JSON totaled **53.8 Mbit/s** (6.72 MB/s across all twenty), about four times the
10-pilot baseline. Socket/TLS, SQL, combat-heavy scenes and client rendering are
excluded. This is useful headroom/traffic evidence, not full-load certification.
The reproducible script and complete limits are in PR #78. Bandwidth deserves
attention before increasing the room limit again.

## Final solo/homepage acceptance

`npm run test:browser -- -c scripts/public-launch.config.js`: **both cases pass**,
completed 2026-09-07 21:26:57 UTC. Chromium 151.0.7922.173, AMD Radeon 860M,
ANGLE OpenGL ES 3.2 / radeonsi krackan1 ACO, DPR 1. Game/desktop viewport
1440×900; phone layout 390×844. Captures use the exact static production files,
with no Vite source server or API proxy. The final tested game entry is
`main-DJKsrr8c.js`, SHA-256
`2e6b77b44087a9ec053e223c99c313be2eb1c6387afc6896f18b4187e789ae2e`.

- Fresh solo boot opens the development launcher. Injected standard-controller
  B/Menu and keyboard F2/ship/location actions work. Multiplayer entry/account/
  Comms UI is absent; no API request or WebSocket is opened.
- Kestrel coast and Nomad hangar starts render with their graphics contexts intact.
  Both real eight-second clips and clean canvas posters were recorded. The joined
  H.264 film is 15.86 seconds, 1280×800, approximately 1.60 MB, without audio.
- The packaged equipment viewer reaches asset readiness and renders the actual
  expedition character/rifle with no reported model error.
- Both target links, ambient playback/pause, user-operated film, keyboard focus,
  reduced-motion no-autoload behavior and phone width are checked.
- Zero page/console errors, failed HTTP responses or solo API/WS connections.
  The earlier viewer favicon 404 was corrected by packaging an explicit icon link.
- `npm test`: all 117 configured test files pass on Node 26; production solo build,
  repository checks, all 13 homepage files and all 40 viewer references pass.

Builder inspection: [desktop](homepage-desktop.webp), [phone](homepage-phone.webp),
[equipment viewer](equipment-viewer.webp). Images were checked for layout, readable
content, missing assets and game-only capture content. There is no independent art
review, physical controller-device test or client FPS claim in this release.
