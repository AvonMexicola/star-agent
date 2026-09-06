# Mining particles — production verification, 2026-09-06

Build: `index-DY2p5nPi.js`, expedition preview http://127.0.0.1:5213/.
Particle source: committed `a81b75e` / PR27; mining integration is in PR24.

- `npm test`: all 29 numerical files pass, including particle precision/pool
  limits, arrival, miss feedback, reset and committed/rejected/replayed cuts.
  Regional forwarding is checked with a synchronous worker to verify that the
  event contact exists before even an immediate worker response.
- Production browser run: Crescent and named Copper Ejecta controller journeys,
  generated regional copper journey/reload and physical space-mining journey
  passed (four cases). Each requires the new visible beam, contact counter,
  collection counter and live particles as well as real inventory gains.
- The focused pointer/touch/controller-interruption case passed on rerun (53.9 s).
  Its first run failed because it measured a hidden mobile button before the
  frame after closing help. The test now waits for visibility; no runtime change
  was needed. The final case also operates both new settings through the actual
  controller menu, focus and A activation.
- Held RT is suppressed through backpack close, blur/refocus and disconnect/
  reconnect. Empty sky emits the beam with zero contact/collection particles.
  Mouse and actual CDP touch holds produce saved cuts. Reduced motion and bloom
  off retain readable feedback. Page and console errors are empty in all cases.

Chromium 151.0.7922.173, ANGLE Vulkan SwiftShader. Desktop 1440×900, mobile
390×844. Focused and space fixtures render at 0.65; controller journeys use
adaptive scaling. No hardware FPS or physical Xbox validation is claimed.
The full surface journeys use only injected standard Gamepad input, with
read-only feedback for steering. Space uses real physical walking/EVA inputs
with a debug aiming seam; the focused regression uses a debug starting pose.

Curated screenshots were inspected for the beam, contact sparks, copper/ice
fragments, the visible equipped tool, depth-tested contact and mobile layout.
JSON beside each image records actual saves, effects counters and limitations.
