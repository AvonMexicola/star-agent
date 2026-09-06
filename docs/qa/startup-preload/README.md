# Startup preparation — 2026-09-06

The original loading screen released play once the six root terrain meshes existed
and two opening frames had rendered. On a Chromium/ANGLE OpenGL run at 1440×900,
the first sample showing ready was 9.15 seconds after navigation; Aeon's 4096-wide
orbital maps did not appear until approximately 30 seconds. Terrain also continued
refining after readiness. This supports a startup-work explanation for the reported
first-minute stutter, without attributing every laptop performance problem to it.

Startup now waits for the station, active ship, characters, surface atlases and
Aeon's complete orbital maps, then settles the current view's terrain, compiles
scene materials with Three.js compileAsync and renders a short warmup. Automatic
resolution calibration runs during warmup, with asset/compile stalls excluded
from its frame counter. A labelled progress bar counts completed stages; it does
not pretend to measure downloaded bytes. The intro remains at time zero, audio
stays gesture-gated and player input is held until preparation finishes.

A key held through loading must be released before repeats can enter play. Gamepad
input is suspended at handover and must return to neutral. Graphics failure stops
the frame loop's work, preserves the recovery message and keeps controls disabled.
Orbital worker failure/disposal releases preload waiters using the existing
procedural fallback; successful readiness never waits on every future destination.

This moves work earlier; it does not remove the initial cost, persist generated
maps between visits, preload all future surface patches, or establish a portable
FPS improvement. New areas still stream during travel. First successful checks
reached ready with complete 4096 maps and settled terrain in 20–24 seconds on this
machine. The laptop may take longer.

Validation and independent review are recorded alongside this file. Full PR34's
existing visual blockers remain open; no production deployment is claimed.

Validation:

- `npm test`: 458 passed, including startup phase ordering, worker error/disposal
  completion, held-key suppression, both ship layouts and all twenty tilted berths.
- `npm run build`: passed; existing large-loader-chunk advisory remains.
- Production Chromium suite covering startup and opening: 6 passed, including
  full keyboard and injected Gamepad-only physical boarding/departure, cinematic
  handover, the moving-origin floor check and station/orbit preload.
- After the final held-key/context-failure hardening, both startup paths were
  rerun: 2 passed. They verify held W cannot leak repeated input into play,
  initial input cannot open the map or change power/seat/movement, and successful
  preload has complete 4096 maps, all eight stages and no console/page errors.
- Physical controller hardware was not used; the browser journey drives the
  standard Gamepad API. The independent review supplies the final loading UI
  screenshots and controlled graphics-context-loss check.
