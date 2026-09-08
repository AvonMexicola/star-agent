# Passenger elevator access repair

Base: local `dev/all-features` at `c766544`. Worktree `/tmp/star-agent-elevator`,
branch `fix/station-elevator-access`. No new dependencies; existing installed
dependencies are linked for local checks. Dedicated preview port 5263/API 8263, one browser
worker. Shared previews and databases remain owned by their existing sessions.

Cees reported a broken elevator and a hangar wall separating its button from the
door. The fleet bay refit scales the legacy vestibule with the shell, from door
Z 22.3 toward Z 16.38, while the finished passenger kit stays at Z 22.3. Preserve
the legacy vestibule as a named human-scale assembly. The lobby and all twenty
hangars continue to reuse the existing passenger pressure-door asset.

The offline call action also rejected every position within 0.5 m of the door
plane, including positions beside the opening. It now uses the shared physical
threshold check, including the player's lateral position. Both offline and
server actions now interlock closing only: standing near closed leaves cannot
prevent calling them open. Occupied closing doors remain protected.

## Source and artifact

`blender/build_station.py` separates the existing vestibule shell and lights into
named assemblies. `fleetHangarAsset()` leaves these and their existing lettering
outside the bay scaling frame. It still shares immutable geometry, preserves the
larger fleet deck/door transforms, and applies the same result to client and server.
The detailed pressure-door kit and LOD GLB are unchanged.

Rebuild (Blender 5.2.0 LTS, CPU, six threads):

```sh
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio --threads 6 --python-exit-code 1 --python blender/build_station.py -- --out public/models/station.glb
```

Export succeeded in 3.3 s with the existing optional extension `cattrs`/registration
warnings retained in `/tmp/star-agent-elevator-qa/blender.log`. The exporter and
actual GLTFLoader parse succeeded; the warnings are not hidden.

| Artifact | Before | After |
| --- | --- | --- |
| Station bytes | 3,804,976 | 3,807,800 |
| Triangles | 89,944 | 89,944 |
| Primitives | 121 | 125 |
| Nodes | 110 | 115 |

Station SHA-256: `6cc8a1b531811944352830dd4bfd201821afde6c67948cf335e6def4c8766a14`.
Unchanged passenger kit: `981a229de511ed34ea99a1d35cc639bb05651e4f8c8829d8ba987dbfc5b9f5c2`.
Four extra material primitives separate the existing vestibule from the shell;
no full-scene frame-time or budget acceptance is inferred.

## Evidence

[Before](station-elevator-access/before.png) and
[after](station-elevator-access/after.png) use the same fixed eye and target in the
game renderer. The old GLB is served from the base commit for the baseline. The
old stretched wall hides the doors; the correction exposes the existing door kit
beside its call panel. These controlled poses establish visual comparison only.
The independent keyboard/controller/phone routes start seated in the actual
development hangar and use movement/interact inputs to leave the ship, walk to
the panel, enter, travel, leave the lobby cabin, call it again, return and board.
State is read only for steering and assertions throughout those routes.

Validation environment: Chromium 151.0.7922.173, AMD Radeon 860M,
ANGLE/OpenGL ES 3.2, desktop 1440×900 and native-touch phone 390×844. Injected
standard Gamepad checks application routing; no physical-device claim.

## Check and failure ledger

- `npm test`: 146 test files pass, zero skips, 46.5 s, on the initial geometry
  and lateral-threshold fix. Node 26 reports file-level counts with isolation.
- Focused station/concourse/hub checks: 28 cases pass. Additional station floor,
  original/large bay collision and prop regressions: 26 cases pass.
- Final interlock/fleet/hub selection checks: 21 cases pass, including opening
  while 0.34 m from closed leaves and refusing to close on the same occupant.
- `npm run build`: pass, 334 modules, 5.09 s; normal chunk-size warning. An earlier
  sandbox attempt failed writing the linked dependency cache; the approved build
  succeeded. Browser builds also succeed with development entry enabled.
- `npm run check:repo` passes; the required `plan:checks` against
  `origin/dev/all-features` includes the existing local branch delta. A second
  plan against `c766544` identifies this repair's scope. Plans are not test results.
- First browser run: matched capture passes; both complete desktop input routes
  reach the parked cockpit with unchanged inventory/ship position, then fail
  the diagnostics check because the isolated preview had no account API.
  Original results/videos retained under `attempt-01`; not counted as passes.
- Harness corrections: first the added API command used the config directory
  instead of the repo root; then Playwright required explicit fixture parameter
  destructuring. Both failed before browser launch and were fixed.
- Corrected API run: controller round trip passes with empty app diagnostics,
  including held interact through destinations and held reconnect at the lobby.
  Keyboard's added camera turn exposed a test route into the call-panel housing;
  preserve that failure and step back before crossing. Final run is recorded below.

Validation and integration pending. This is a bounded repair, not final station
art acceptance. Physical controller testing and independent review are separate.
