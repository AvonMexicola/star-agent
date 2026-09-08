# Gannet Art11 native inspection

The frozen Art11 asset passes the complete studio inspection on 2026-09-08:
one case in 31.2 seconds, 34.6 seconds total. This checks rendered geometry,
mechanism motion and inspection framing; independent art acceptance and full
gameplay remain separate gates.

Source is `5802948`; Gannet SHA256 is
`51f5578cc89f863453f937c7af5afb6bcee71fe4c4ef6a1e40105bd271bdaef1`,
and the current clear-view Burrow is `831b9569…`. Both served model files were
verified against the source bytes. The isolated studio build passes in 996 ms.
Root's actual geometry suite passes 12/12 in 1.804 seconds; the existing lamp
probe passes nine first-hit and 19 room-target paths on these exact models.

The native run uses Chromium 151.0.7922.173, ANGLE/OpenGL ES 3.2 on AMD Radeon
860M, at 1440×900 and resized 390×844, device scale 1. It is a pointer-driven
studio context, not native-touch or controller gameplay. No FPS claim is made.
The renderer emits no page or console errors.

All 21 original PNGs, framing receipts and the unedited video remain under
`/tmp/star-agent-gannet-native-art11`; the command log is
`/tmp/star-agent-gannet-native-art11.log`. The fixture checks actual display
vertices, not nominal rectangles. All four desktop MFDs and the centre/left/right
portrait looks remain inside the canvas, which never overlaps inspection
controls. Cockpit FOV stays 60 degrees and the maximum measured eye error is
0.000000385 m. The retained glazing has a clear central view.

The fixture actuates the hatch from a rear view, shows the Burrow in the bay,
lowers and raises the lift, closes the hatch, and shows both gear directions
from underneath. It asserts intermediate and settled actual mechanism states.
Root inspected the exterior, cockpit, loaded bay, hatch, gear and portrait
display originals. The independent reviewer receives all originals and ordinary
video frames; a successful test is not a visual quality score.

```sh
GANNET_HARDWARE=1 GANNET_URL=http://127.0.0.1:5581 \
GANNET_EVIDENCE=/tmp/star-agent-gannet-native-art11/evidence \
GANNET_TEST_OUTPUT=/tmp/star-agent-gannet-native-art11/test-output \
npm run test:browser -- -c scripts/gannet.config.js
```

The single owned browser exited and the shared GPU window was released at
01:05:11 UTC. No shared preview, user tab, API, database or deployment changed.
