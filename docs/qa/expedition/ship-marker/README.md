# Ship recovery beacon — 2026-09-06

Implementation: `53a3c77`. The automatic marker displays the rear ramp of the
parked Nomad with distance, an on-screen diamond and an off-screen direction arrow.
It follows the current ship pose and hides in the cabin or pilot seat. There is no
new binding or menu action. The label is kept below the initial EVA toast, and the
unused EVA flight-state label no longer overlaps the beacon.

Four projection tests pass: front/behind directions, edge and camera-plane bounds,
suit yaw/roll, interplanetary double precision and nearby/distant formatting. The
existing Gamepad and EVA numerical files also pass.

The final production browser journey passes using only injected standard Gamepad
input for gameplay: brake, stand, walk to the hatch, open it, leave into EVA,
accelerate/coast/brake, turn from the off-screen beacon to the ship, open/close the
backpack, approach slowly, attach boots to the ramp, walk inside and reseat. The
marker is hidden before exit and after reboarding. No position/orientation or
interaction method is called by the fixture; read-only diagnostics guide stick
steering. Viewport/render-scale changes are rendering fixtures.

- [Ship behind: edge arrow](ship-behind-edge-arrow.png)
- [Ship ahead: rear ramp](ship-ahead-ramp-beacon.png)
- [390px phone layout](ship-beacon-phone.png)
- [Measured journey and renderer provenance](journey.json)

Chromium 151.0.7922.173, ANGLE/SwiftShader Vulkan, 1440×900 and 390×844,
render scale 0.65; zero browser/console errors. Screenshots were visually inspected.
No physical Xbox sequence, hardware FPS or manager visual approval is claimed.

Run: `npm run test:browser -- -c scripts/expedition.config.js scripts/ship-marker.spec.js`.
Integrations with the independent moving-ship/Atlas lane must pass the active hull
pose, name and real entry point; this test exercises the expedition Nomad.
