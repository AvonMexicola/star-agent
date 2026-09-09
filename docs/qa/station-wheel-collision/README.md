# Station wheel collision correction

Runtime `8a2a12f` removes invisible walls alongside diagonal wheel spokes. The
old collision tree stored a bounding box per triangle and used that box as the
final solid. For a long diagonal spoke, it covered hundreds of metres of empty
space. The actual authored ring reports a hit along X -160 to +160 at
Y 692.820323 / Z 400, despite a 200 m square corridor containing no physical
triangles. A ray against the visible geometry also passes unobstructed.

The existing BVH still rejects distant geometry cheaply. Its leaves now use a
continuous separating-axis test against the actual triangle and full actor box.
This preserves thin/fast contacts, corners, asymmetric actor bounds, solid doors,
local transforms and immutable geometry across LOD/rebases. Client flight,
server flight and server weapon occlusion use the same shared implementation.
The hull envelope itself is unchanged; this does not permit squeezing a large
ship through a space smaller than its conservative flight bounds.

## Verification

- Six focused station test files pass: exterior, complex, hangar, fleet-hangar,
  concourse and defense. Actual-asset regressions cover all six clear gaps in
  both rings at three rotations, both travel directions and a billion-metre
  render rebase. Independent Three.js triangle/box checks prove the 200 m clear
  corridors. Real root armour and rim still collide. Analytical tests cover
  2,000 m sweeps, corner contact, parallel motion and leaving a touching face.
- Full configured unit suite: 165 files pass, no failures/skips (29.39 seconds).
  Production build passes with development entry enabled (15.37 seconds while
  unit checks ran). Repository and whitespace checks pass; check-plan recorded.
- All 40 selected server cases pass across the initial run and corrected setup:
  room, hub, combat and transport, including authoritative open-gap/solid-spoke
  flight and shot occlusion. The initial run passed 39 but its PostgreSQL case
  failed because this new worktree lacked the ignored generated Prisma client.
  Copying the unchanged generated client from local dev fixed setup; both
  transport tests then passed, including isolated PostgreSQL restart. The shared
  database was not used or reset by these fixtures.
- Actual controller browser 01 passes in 2.1 minutes. From the supported Nomad
  exterior launch, only standard Gamepad input flies to the wheel, crosses the
  visible gap, turns, returns through the same gap and brakes. Focus/held-input
  suppression checked. No teleports or navigation writes after entry. The live
  wheel keeps rotating; 3,361 pose samples show travel from station-local
  X -3800 through -905 and back to -1314.91, ending in flight at 0.023 m/s.
- Chromium 151.0.7922.173, AMD Radeon 860M, ANGLE GL, 1440×900, one worker, no
  retries. Page/console/request errors are empty. [Journey](journey.json),
  [approach](wheel-approach.png), [far side](through-wheel.png). Actual images
  inspected; the return screenshot faces away into dark space and is retained
  with the original raw evidence, not presented as a useful geometry view.

## Cost and delivery

A local CPU sample queried one actual hero ring over 360 varied paths repeated
20 times. Median/p95 query time changed from 0.0104/0.0280 ms to 0.0217/0.0429 ms.
Retaining triangle vertices increased measured heap per ring from 8.86 MB to
18.61 MB; measured build time was 81.8 versus 90.9 ms. This is a single local
sample with browser work active, not a frame-rate or cross-device acceptance
claim. [Measurements](cpu.json). No rendered geometry/draw changes.

Integrated locally at `8a2a12f`; the managed 5178/8087 preview/API was refreshed
with its existing persistent database. Served collider bytes and both health
routes pass. [Local receipt](local-integration.json). The source worktree and
shared journal preserve all preceding Greenbank/drive/tractor work. No asset,
SQL/save schema, dependency or wire-format change. Protocol 11 remains the
unpublished local pair; refresh existing clients after this physics update.

No public deployment: this correction is separate from frozen paired release
candidate `c5eb519` / PR113, which remains billing-gated. Physical-controller,
independent acceptance and broad performance coverage remain separate.
Private preview 5700 and the owned browser are closed. Original logs, screenshots
and failed server setup remain in `/tmp/station-wheel-*` and
`/tmp/star-agent-station-wheel-evidence/01`.

Run `VITE_DEV_TOOLS=1 npm run build` then
`npm run test:browser -- -c scripts/station-wheel.config.js`.
