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
| `site/media/coast.webp` (original release) | `docs/qa/main-integration/shore.png`, existing 1440×900 world capture |
| `site/media/selene.webp` (original release) | `docs/qa/moon-stones/landing-shelf.webp`, existing 960×600 lunar capture |
| `site/media/flight.mp4` and poster | This release's Kestrel test start above Aeon, seed 7291, external camera, eight-second canvas capture |
| `site/media/hangar.mp4` and poster | This release's Nomad hangar test start, seed 7291, eight-second canvas capture |
| `site/media/field-notes.mp4` (original release) | Flight and hangar clips joined, H.264, 1280×800, no audio |

The original flight/hangar films use explicit development test starts. Their
joined edit does not prove a continuous journey. The homepage labels both current
alpha limits and the broader seamless-universe ambition.

### Supplied expedition screenshots and continuous arrival

The gallery now uses the user's two original PNGs without image alterations:

| Public file | Content and source checksum |
| --- | --- |
| `aeon-expedition.png` | Kestrel in Aeon grassland, 2560×1508; SHA-256 `d8205ec52e8eb2ed3c2f4cb21e855fe55d88e138be6572539a34112e6fa287ed` |
| `selene-expedition.png` | Nomad on Selene, 2560×1600; SHA-256 `95f89e874e06f42bc8e6250eccfb92ab623dda0a48fc26820fc3c258b92b02c0` |

The new `nomad-aeon-arrival.mp4` replaces the joined reel with one
continuous canvas recording: targeted relativistic drive, 20 km arrival, ordinary
boosted descent, braking, keyboard pitch-up, landing assist and touchdown. Seed
7291; a 60,000 km development start is placed off camera, west of the coastal
station ground track by 0.01 rad, then 60 m west and 180 m south to a
gentler 80×80 m footprint sampled from the canonical terrain. Nothing writes the ship pose, travel elapsed time
or simulation clock after recording starts. The initial direct coast approach was
correctly blocked by Aeon Orbital, so the fixture uses a clear approach to nearby
dry grassland. No game source or safety gate is changed for the recording.

The reproducible encoder compresses descent to 6×, approach to 4× and landing to
3×, retaining drive arrival and touchdown at 1×. Every frame belongs to the same
take; speed labels appear in the film. Output is H.264, 1280×800, with no audio.
The accepted take is **94.72 seconds**, edited to **30.97 seconds**. Chromium
151.0.7922.173 / AMD Radeon 860M / ANGLE OpenGL ES 3.2, viewport 1440×900,
DPR 1, fixed render scale 1. The browser case passes in 2.5 minutes; 908 trajectory
samples include acceleration, arrival braking and landed mode, with no quick
transit, crash, graphics-context loss, HTTP/page/console error or API/WebSocket.
An earlier completed take was replaced because its touchdown framing crowded a
nearby outcrop. No physics or collision code was modified to get the final image.

`burrow-atlas.mp4` preserves the user's complete **2 min 55 sec** sequence from
`miningcar in atlas.mp4`: field mining, driving into the Atlas, boarding the bridge
and takeoff. Source SHA-256
`0ffe8edff89e4e34d012ca8166f8052d89d8ba228647ba92be67398eb6aaef08`;
source 2560×1600 at 60 fps. The public copy is H.264, 1280×800 at 30 fps, CRF 24,
35,692,967 bytes, fast-start MP4, with audio and metadata removed. Its poster is
an actual frame at 124.5 seconds. No scenes are reordered or accelerated.
Sampled views across the full recording show only game content. This is explicitly
labelled **local development footage**: its new Atlas/rover scene does not change
or promise the exact feature set of the frozen public solo snapshot.

Both films require user playback; neither downloads automatically with the page.
The responsive film grid stacks on smaller screens. Homepage QA checks playback
of both films, the original screenshot links, ambient motion controls, reduced
motion, keyboard focus and layouts at 1440×900 and 390×844. The updated
homepage case passes in 3.0 seconds, with zero page or HTTP errors; all 16 page
dependencies and 40 existing viewer references pass static validation. The desktop
and phone evidence links below show this latest two-film layout.

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

## Original solo/homepage acceptance (2026-09-07)

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
