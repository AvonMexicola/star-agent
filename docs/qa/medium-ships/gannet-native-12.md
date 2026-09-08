# Gannet Art12 native inspection

The exact Art12 studio inspection passes on 2026-09-08: one case in32.6seconds,
35.9seconds total, runner exit0. Captured source is `9610187`; Gannet is
`6b4f48ad29aa5cf8a8e6004c0b45861fb65d97a449dc27c7533cbec83e052af8`,
55,622triangles/3,290,672bytes, with current clear Burrow `831b9569…`.
Both HTTP assets match the source bytes. Main build10 passes in4.83seconds
(`main-DA6sz98Z.js`); the isolated studio build passes in1.07seconds.
Current asset/runtime/continuity checks pass72/72 in3.888seconds, and the
unchanged runtime lamp probe passes nine emitters and19 occupied paths.

The actual renderer completes all21 desktop/portrait views, both hatch
directions, elevator lowering/raising with Burrow visible, and gear retraction
and deployment. The unchanged fixed pilot eye,60-degree lens and actual MFD
vertices pass forward desktop and centre/left/right portrait framing checks.
The inspection controls remain outside the canvas. Root inspected the original
exterior, side, top, cabin, loaded bay and cockpit images. The subsequent [independent review](gannet-native-review-12.md) scores
3.97 overall and4.4 for silhouette: both remain below the required art gates.
The bright floor lattice and remaining forward shape/material issues require
correction. Successful native inspection does not close that review.

Chromium151.0.7922.173 uses ANGLE/OpenGL ES3.2 on AMD Radeon860M, DPR1,
1440×900 and a resized390×844 page. This is pointer-operated studio inspection,
not native-touch gameplay. The page/console-error receipt is empty; this fixture
does not collect console warnings. The final portrait scene counter is13draws
and47,866triangles after culling, not a complete loaded-scene cost or FPS result.

The new static contact colors and studio-only fixture shadows rendered without
recorded shader errors. That result does not approve their appearance or the
separate main-game light helper. The prior Art11 failure stays retained.

Original PNGs/framing/state and full motion video remain under
`/tmp/star-agent-gannet-native-art12`; log:
`/tmp/star-agent-gannet-native-art12.log`. The owned browser exited and the
shared GPU window was released at02:12:48UTC.

```sh
TMPDIR=/home/cees/projects/.mdtmp \
GANNET_HARDWARE=1 GANNET_URL=http://127.0.0.1:5581 \
GANNET_EVIDENCE=/tmp/star-agent-gannet-native-art12/evidence \
GANNET_TEST_OUTPUT=/tmp/star-agent-gannet-native-art12/test-output \
npm run test:browser -- -c scripts/gannet.config.js
```
