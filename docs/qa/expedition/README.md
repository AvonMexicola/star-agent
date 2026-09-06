# Expedition validation

This evidence accompanies the controller, inventory, EVA, ring population and
resource geography implementation. It is implementation review material;
independent Fable/Claude visual approval remains pending.

## Automated checks

- `npm test` passes all 20 test files. An explicit run with
  `--test-isolation=none` reports **156 passing cases**.
- Production Chromium journeys cover the controller-only Crescent and Copper
  Ejecta routes, backpack/ship/station/cache transfers, EVA exit/reboarding,
  mining persistence/touch/cargo, lunar landing/launch and orbital rendering.
- The isolated controller-dialog regression passes focus, activation, modal
  suppression and async close behavior.
- The HDR tool fixture passes real screenshot comparisons: the textured tool
  changes 3,214 pixels, and the unobstructed beam changes 4,677 pixels while
  an occluded region remains unchanged. The no-hit path emits no mining reward.

All nine distinct production journeys pass across the integrated run and targeted
reruns. The initial integrated run passed eight; its orbital fixture waited for
LOD 4 at a viewpoint that uses LOD 3. After correcting the fixture and refining
the province contours, the final build passed orbital resources/layout, physical
EVA and space mining again. The final telemetry contrast received one additional
orbital/layout rerun. Earlier failure traces remain only in `/tmp`.

## Environment and scope

Chromium 151.0.7922.173, ANGLE/SwiftShader Vulkan software renderer, desktop
1440 × 900 and phone 390 × 844. The HDR fixture uses its own recorded viewport.
See each JSON file for renderer, input, camera setup and measured state. Automatic
render scaling can lower the game resolution on this software backend; these
images are not evidence of hardware GPU frame rates or a performance acceptance.

Controller journeys inject standard Gamepad state and use actual action routing.
The Crescent and copper trips use no keyboard, pointer input or debug gameplay
mutation: debug reads only guide stick steering and assertions. OS enumeration
recognizes the Xbox Wireless Controller, but no physical button sequence is claimed.

Inventory station/cache positions and orbital visual cameras are explicit fixtures.
The space mining journey uses the Ring Survey UI shortcut and real suit translation,
with a debug orientation helper for aiming. Those checks are distinct from the
complete controller-only surface routes.

## Evidence

- [Controller mining](controller-mining.png), [backpack](controller-backpack.png)
- [Copper province mining](copper-controller-mining.png)
- [Phone inventory](backpack-phone.png), [field cache](field-cache.png),
  [station storage](station-storage.png)
- [HDR textured tool and beam](tool-hdr.png)
- [Orbital resource geography](orbital-resources.png), [legend](orbital-legend.png),
  [phone survey](phone-survey.png)
- [Space mining](space-mining.png), [space backpack](space-backpack.png),
  [physical EVA](eva-ship.png)

The copper controller run collected 2.64 kg copper, 0.20 kg basalt and 0.10 kg ice;
the outcrop's regional weights are 93.5% copper, 4.5% basalt and 2% ice. Finite cuts
strike discrete seams, so collected proportions need not exactly equal the regional
weights. The screenshot and saved state show the actual result, rather than a
separate inventory fixture.
