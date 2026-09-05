# System travel handoff

User priority: selectable system map on M, atmospheric/space speed tiers, and a
0.9c maximum travel drive with a tunnel effect.

Implemented in isolated worktree /tmp/star-agent-travel-work, branch
feat/system-travel, rebased onto integration f028a43 after the Selene merge.
No shared source modules were replaced. Fable/Claude retains merge/deploy ownership.

## Ownership and integration

- src/travel-model.js owns target metadata, speed policy, swept route guards and
  analytical acceleration/braking. Target centres/radii derive from celestial.js.
- src/navigation.js owns drive lifecycle and manual speed policy. Drive sampling
  uses actual elapsed time, with a fully checked straight segment. There is no
  destination teleport, route snapping or frame-size-dependent integration drift.
- src/system-map.js + CSS own the native modal, keyboard M, target selection and
  explicit engagement. Opening the map pauses navigation. Escape restores it.
- src/travel-effects.js draws camera-local cyan/violet tunnel light after the
  atmosphere pass; world depth is unchanged. A scene-only additive effect would
  disappear against the atmosphere's depth-free sky, which inspection caught.
- src/main.js wires course, drive HUD, rendering and debug diagnostics.
- Detailed controls, speeds, gate radii and limitations: docs/space-travel.md.

The 0.9c value is a cap. Current moon trips peak near 0.1c because acceleration and
braking must fit the short route. Long-route unit cases reach 0.9c. Only Aeon and
Selene are selectable; the star is a map reference. No new planets or station
drive destination are claimed. Real relativistic physics is not simulated.

This work includes the merged Nomad, controller and Selene integration. Forest,
terrain-transition, crash and heating PRs remain separate. When merging crash
navigation, preserve its collision state/recovery and ensure beginTravel rejects
destroyed ships. Preserve the physical boarding and station paths. Equipment and
opening-sequence work belong to the other handoff lanes.

## Evidence

- npm test: 82 passing cases, including 8 new pure travel and 4 Navigation cases.
- npm run test:browser -- -c scripts/travel.config.js: 2 passing production Chromium
  journeys: real map selection, paused flight, round-trip movement and exact safe
  endpoints, normal controls after arrival, ground gate and narrow-screen layout.
- Production build succeeds; existing Vite bundle-size advisory remains.
- Browser scene and tunnel shaders compiled without page/console errors in the
  travel journey. Inspected screenshots: docs/images/system-map.png and
  docs/images/travel-tunnel.png; additional arrival/mobile images are in /tmp.
- Visual evidence: Chromium with ANGLE/SwiftShader, 1440x900 viewport, render scale
  0.55; mobile layout checked at 390x844. Software FPS is not a hardware claim.
- Full production browser suite: 7/7 pass, including controller exploration,
  physical landing/walking/reboarding/launch, travel, seed reload and quick transit.
  CI verify and the Vercel preview checks also passed.

Local production preview: http://127.0.0.1:5177/ . Press M, choose Selene, engage.
The normal initial orbit has a clear route. The guide explains launch/climb
requirements for starting from the ground.
