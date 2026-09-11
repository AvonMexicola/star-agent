# Final Stratum Art04 in the main game

The unchanged complete injected-controller journey passes on final Art04:
one case in 2.5 minutes, 2.6 minutes total, runner exit 0, on 2026-09-08.
Captured runtime is `e727d8e`, production build15 `main-B5-qTCnz.js`, with GLB
`1f5cae2a4901a2618d7cff36f1713a19777b45d586022614b9bc5449560cb75b`.
The exact served model matches the source. Runtime/model hashes remain stable;
page errors, console warnings and failed HTTP requests are all empty.

From the explicit Selene test approach, the real controller lands, deploys gear,
leaves the chair, walks through the aisle and ramp onto canonical terrain, returns,
secures the ramp and regains the pilot chair. It launches, retracts gear, turns
and flies approximately 26 m to the existing Crescent deposit. Both final
articulated muzzle transforms exactly match the live beam starts (zero position
error; direction errors below 2.5e-16). Both hit the deposit at approximately
21.678 m, without ship occlusion. Actual accepted voxel edits publish ore into
the dedicated bin; the real inventory dialog transfers material to the backpack.

All five interruption gates pass: held dialog closure, trusted native focus loss
and return, disconnect, controller replacement and unsupported mapping. Fresh
release is required before mining resumes. The route ends in powered flight
with the tool stopped and saved revision 24. Serialized bytes are read from the
actual development practice-memory adapter, not a mocked inspection copy or a
reload-persistence test. The controller fixture's small helium transfer rounds
to 0.00 kg in the UI; the separate keyboard/touch receipts demonstrate visibly
nonzero basalt transfers.

Chromium 151.0.7922.173 uses ANGLE/OpenGL ES 3.2 on AMD Radeon 860M, 1440×900,
DPR 1, render scale 0.8 and 1152×720 drawing buffer. This is the actual game
renderer, physical navigation and injected standard Gamepad route. No physical
controller, multiplayer, FPS or complete exterior-art acceptance is inferred.
The [independent studio review](stratum-native-review-04.md) remains separate;
the final actual-game images receive their own bounded review.

Ten original PNGs, complete video, source/input/beam/save receipts and ramp traces:
`/home/cees/projects/.medium-ships-qa/stratum-controller-final04`.
Log: `/tmp/star-agent-stratum-controller-final04.log`.
GPU released at 03:26:49 UTC. Earlier controller03 and all keyboard/touch routes
are retained at their original recorded source/model versions.

The later [independent actual-game review](stratum-game-review-final04.md)
requests changes at 3.82 overall: the deployed ramp marker incorrectly says
CLOSED, and collected-mineral particles approach the pilot and cover right MFDs.
These are display/effect defects, distinct from the passing physical/mining route
and the accepted studio geometry. Original evidence remains retained while the
bounded corrections receive new source and native checks.

```sh
STRATUM_OUTPUT=/home/cees/projects/.medium-ships-qa/stratum-controller-final04 \
STRATUM_URL=http://127.0.0.1:5582 \
npm run test:browser -- -c scripts/stratum-gameplay.config.js
```
