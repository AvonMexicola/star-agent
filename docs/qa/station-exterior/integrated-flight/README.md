# Combined build: exterior entry and physical bay departure

Runtime `0880516` combines exterior geometry `261ebab` with the shared combat build
`7bd4bd5`. Hero SHA `5b39b183…b76e6`, distant SHA `ec98e225…ffdcb`; both exports and
all four independently reviewed station modules are unchanged during integration.

All three `scripts/station-exterior.spec.js` cases pass in **4.9 minutes**:
seven actual-render views/ring motion (54.1 s), controller/touch entry (2.9 min),
and physical Kestrel exit, reboarding and departure (1.1 min). The run records zero
browser console errors, warnings or page errors. Node runner colour-environment
notices are distinct from browser diagnostics. The log remains local at
`/tmp/station-exterior-integrated-browser-01.log`.

[The render receipt](render-evidence.json) records Chromium 151.0.7922.173,
AMD Radeon 860M / ANGLE OpenGL ES 3.2, DPR 1, scale 1, seed 7291, desktop 1440×900
and phone 390×844. All seven counts match the previous final geometry capture.
The [selected overview](quarter.png) is the current combined build; all seven
current frames remain in `/tmp/station-exterior-integrated-01/`. Earlier complete
geometry views are retained in `../geometry-checkpoint/`.

The [controller image](controller-preview.png), [phone image](phone-playable-preview.png)
and [input receipt](input-evidence.json) establish entry and menu/held-input behaviour,
not polished HUD layout or a physical controller test. The inherited combat panels
and temporary start toast make the phone frame crowded; full UI art approval is
not claimed. The preview does not replace their owner modules.

The physical journey begins at an explicit developer hangar start. Thereafter
actual keyboard input runs the port ladder, reboards, secures the cockpit, launches,
retracts gear and flies more than 130 m from the active berth. No debug camera or
position edits occur during that case. See [port ladder](physical-port-ladder.png),
[departure](physical-departure.png) and [selected resulting state](departure-evidence.json).
This proves that one bay journey remains usable; the independent CPU probes cover
all twenty approach lanes. It is not a continuous flight from planetary orbit or
a full docking-return test. No hardware frame-time, full art, or deployment claim.
