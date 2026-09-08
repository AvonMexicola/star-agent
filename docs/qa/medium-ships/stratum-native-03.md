# Stratum Art03 native inspection

Stratum Art03 passes the complete desktop and native-touch studio inspections
on2026-09-08: two cases in52.6 seconds total (25.5 desktop,23.7 phone). Source
`2638857` includes the checked startup/cache merge; exact GLB SHA256 is
`22bbf0296e349e24f1a9bd636745511bf31b9291f1a305814f13d4a45cac4d08`.
The51,346-triangle,3,932,512-byte model remains within the existing asset limits.

All50 original PNGs, two unedited videos, trusted input events and actual
mechanism/camera receipts remain under `/tmp/star-agent-stratum-native-art03`;
log `/tmp/star-agent-stratum-native-art03.log`. Desktop is1440×900, phone390×844,
DPR1. The actual renderer is Chromium with ANGLE/OpenGL on AMD Radeon860M.
The desktop fixture uses native pointer controls; the phone fixture uses touch
contacts and taps. Neither performs a game flight or hardware-device test.

The authored pilot eye stays fixed for the default cockpit and each of four
MFD looks. Real UI gestures sweep the mining heads through yaw−0.20/+0.20 and
pitch−0.12/+0.14, then restore neutral. The cameras expose both gear directions,
both ramp directions and their intermediate states. Both cases record zero
page errors, console warnings and failed HTTP responses. Root inspected the
exterior, cockpit, cabin and mining-head originals. Independent art scoring is
pending; successful rendering and native controls are not a quality score.

Before capture, the main production build passes5.21 seconds (`main-BQoDRjRm.js`),
and the isolated studio build passes1.01 seconds. All59 final asset/medium/cutter
checks pass3.9997 seconds, and actual lamp geometry probes pass nine emitter
first hits and19 room paths. These use Art03 Stratum, Art11 Gannet and the current
clear Burrow. The earlier checked source merge separately passes1083 normal
unit tests and58 focused tests. Existing chunk-size advisories remain recorded.

```sh
STRATUM_URL=http://127.0.0.1:5580 \
STRATUM_QA_OUTPUT=/tmp/star-agent-stratum-native-art03 \
npm run test:browser -- -c scripts/stratum-studio.config.js
```

Both owned contexts and the browser closed; the shared GPU slot was released
at01:25:44 UTC. Full keyboard/native-touch gameplay, final art, loaded scene cost,
durable reload and multiplayer acceptance are not claimed here. No shared
preview, user tab, API, database or public release changed.
