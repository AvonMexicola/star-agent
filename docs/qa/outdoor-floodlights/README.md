# Outdoor floodlights — asset and gameplay record

Builder: Codex, SA-LIGHT-001, branch `feat/outdoor-floodlights`.
Brief: [outdoor floodlights](../../briefs/outdoor-floodlights.md).
Final floodlight runtime: `bb7ff9d`; night review on `dbd4c6e`, final controller/day
review on `c38d89a` including checked HUD `9b629f2` and settlement needs `290f5ad`.
This is builder evidence. Independent rubric acceptance, physical-device testing
and hardware frame-time acceptance remain pending. Local integration is a
development checkpoint, separate from public release.

## Source and contract

Original deterministic Blender authorship. No external imagery, generated image
service, third-party model, texture or dependency. Editable component source:
`assets/build-floodlight/floodlight.blend`. Rebuild with Blender 5.2.0 LTS:

```
ALSOFT_DRIVERS=null blender --background --factory-startup --python-exit-code 1 --python blender/build_floodlight.py
```

The ordinary `blender/build_base.py` rebuild also invokes the dedicated builder.
Both routes preserve the complete base manifest. Runtime import uses the existing
`createBuildVisual` GLTF loader, cloned materials and cached geometry.

Metres, Y up, mounting surface at Y0; beam faces local −Z. The service box faces
+Z and is reached at Y1.2. Named source/export anchors are `LightEmitter`,
`LightTarget` and `SwitchTarget`. Every exported vertex is checked against the
mast, shoe, control-box and head colliders. Landing checks cover Nomad, Atlas,
Gannet and Stratum at all four canonical settlement sites.

Measured GLB: **9,826 triangles, five meshes/material draws, 837,064 bytes**.
SHA-256: `3f2d93fc8eb0f236e2cc590cf327cda09e84711a13aceba73fb62560a797240b`.
Bounds: X ±1.3375 m, Y0–5.84492 m, Z−0.607883–0.58 m.
Five PBR materials: WhiteArmour, EdgeSteel, DarkPolymer, MintStatus and
WarmTaskLight. Metre-projected UVs and per-corner surface variation; zero textures.
The export is below the existing per-piece 10k-triangle/1 MB limits. No separate
LOD was added; the existing construction coverage fade remains at 500–600 m.

## Runtime behavior and bounded cost

Power wheel entry, normal placement/material ledger, reachable switch and saved
`lightOn` flag. Ceiling lights remain in the Roofs wheel. A powered mast consumes
600 W; switching off removes its operating demand and useful emitted light.
The usual 10 W per-piece/base upkeep remains. Base supply loss also removes
illumination without changing the saved switch setting.

All construction renderers share one scene pool of **six spotlights and at most
two 512² shadow maps**. Each light has a 75 m range, 180–260 m camera-distance
fade, intensity 1,500 and downward target. World positions and targets remain doubles until
the floating camera origin is subtracted. No new custom shader, global ambient,
sun, exposure or volumetric effect. Distant planets cannot consume the six slots.

The four commissioned settlements each have six perimeter masts supported by the
existing large pad. Four illuminate the pad and the middle pair point toward the
exchange entrance. No player material/save grants are used.
These world fixtures follow the existing settlement availability and authority.

## Checks and corrections

- Seven individual new tests pass: measured export/anchors/collision, independent
  material switching, Pyre-scale coordinate precision, shared caps/disposal,
  distance fade, actual energy and save semantics, all-site support/landing.
- `npm test`: final combined `c38d89a` passes all 153 test files in 32.87 s,
  no failures or skips. Earlier 150/152-file runs are historical.
- Four focused existing geometry/roof-light/build-state/settlement files pass.
- `npm run check:repo` passes; required plan against `origin/dev/all-features`
  reports the broader unpushed development stack. It is guidance, not validation.
- Final combined `f8c9fa0` production build passes: 352 modules in 6.01 s, with
  the inherited chunk-size warning. The final browser harness also builds with
  `VITE_DEV_TOOLS=1`. After the checked Burrow merge, four affected floodlight/
  mining/rover test files pass in 2.39 s; nine owned runtime/asset files are
  byte-identical to the final controller/day candidate.
- `npm run test:multiplayer`: 191 pass, two existing opt-in SQL skips, zero failures
  in 7.27 s after generating this isolated worktree's local Prisma client.
  Seven new tests include actual `updateBaseSites` server save/power semantics;
  no new database migration or account data mutation is needed.
- First Blender export failed because joining one material batch invalidated
  object references used by later batches. Compute all groups before joining;
  subsequent exports pass and retain the same runtime GLB hash. The failed
  process hung during audio shutdown and was explicitly stopped. `ALSOFT_DRIVERS=null`
  permits clean headless authoring shutdown without changing system settings.
- Blender reported unavailable optional `cattrs`/MeshOptimizer and thumbnail-cache
  warnings. The uncompressed GLB/native save and measured exports succeeded.
- First production build failed with read-only shared Vite cache (`EROFS`).
  The same build passed through the approved scoped escalation.

## Actual renderer and input evidence

Chromium 151.0.7922.173; AMD Radeon 860M, ANGLE/OpenGL ES 3.2, 1440×900,
render scale 1, seed 7291. Native touch uses a 390×844 viewport. Browser runs
are serialized through an actual-launch host process gate; one worker, no retry.
Art captures use explicit camera poses and hidden HUD after canonical terrain
meshes settle. They do not establish a flown or walked route to each settlement.
The controller case uses the shipped build sandbox and actual Gamepad movement,
with no pose, inventory or save injection.

- Attempt 01: complete controller placement/material debit/switch/reload route
  passed on initial runtime `85208b7` (2.1 minutes). The final combined attempt 05
  repeats this journey on `c38d89a` and passes in 1.8 minutes.
- Controller route enters Power with B/RB, selects/places using A, spends exactly
  8 metal stock / 3 conductor / 2 glass, opens the real result inventory, walks to
  the reachable switch and holds X to toggle once. Off survives reload; X turns
  it back on. Held RT across dialog closure, native tab focus loss and Gamepad
  disconnect require neutral input before resuming. F also switches it; native
  phone taps select the same lamp and exit the wheel. Physical Gamepad not tested.
- Attempt 04: final Pyre and Miasma render checks pass 2/2 in 2.7 minutes. Each
  approach, walking and mast view has six active lights and two shadows. Both
  receipts have zero page/console errors or warnings.
- Attempt 05: four cases pass in 5.3 minutes: final controller journey, settled
  Aeon and Selene views, and the same-view pre-floodlight Pyre baseline. All final
  receipts have zero application errors and warnings. Browser build logs retain
  inherited chunk-size/NO_COLOR warnings and the private API's SMTP-not-configured
  notice. No Chromium startup crash occurred in these floodlight runs.

### Failed checks and corrections retained

1. Browser 02 reached the application but ignored a developer settlement start
   because the production build omitted `VITE_DEV_TOOLS=1`. Add that build flag
   to the dedicated QA configuration; no application code was changed to bypass it.
2. Browser 03 captured Aeon before 70 queued terrain meshes settled and exhausted
   one 240-second timeout while loading its fourth world. Split into per-world
   tests and wait for canonical terrain/LOD readiness. The final Aeon view has
   clear pad/support contact; no alternate terrain floor was introduced.
3. Initial intensity 5,000 blew out pad highlights and left the exchange front
   dark. Reduce to 1,500 and aim the middle pair toward the exchange. Final night
   images retain floor texture and show the actual building entrance.
4. First night mast close-up cropped its heads. Move only the QA camera for the
   final walking-scale full-mast image; geometry and lighting remain unchanged.
5. The first restricted Node 26.7.0 server run raised a native async-hooks
   assertion/SIGABRT (`InternalCallbackScope::Close`, execution_async_id == 0).
   Coredump metadata was inspected; it does not establish a floodlight defect or
   OOM cause. The approved outside-sandbox rerun eliminated that assertion but
   exposed three SQL fixtures missing local `server/generated/prisma/index.js`.
   `npm run prisma:generate` succeeds (Prisma 7.9.1); the same suite then passes
   191/193 with only the two existing opt-in skips. Its failed fixture's own
   PostgreSQL process was shut down gracefully. Shared databases were untouched.

Original exporter/build/unit/server/browser logs and failed video remain in
`/tmp/floodlights-*` and `/tmp/star-agent-floodlights-01` through `-05`. The original
second server failure log is `/tmp/floodlights-multiplayer-02-original.log`; the
successful rerun is `-02.log`. Curated PNGs and compact receipts below are retained
in this directory; raw debug state and generated test reports are not committed.

## Builder findings and remaining review

The twin heads, cooling fins, tilt brackets and bolted shoe read at walking
height; at approach distance the six masts outline the landing pad. The same
white/steel/polymer kit materials and mint switch are used without changing
world exposure. Real switches remove useful light and respect base power.

Miasma's existing flora/rock population intersects part of its pad in the current
settlement scene. Floodlights make this inherited clearance issue easier to see;
this task does not alter vegetation, collision terrain or settlement site choice.
Geometry clearance tests cover the construction kit and four supported ships,
not an assertion that the surrounding procedural flora is clear. Streaming parent
terrain can also obscure construction briefly before its canonical meshes settle.

Asset cost is 9,826 triangles / five material draws per mast; one settlement adds
58,956 triangles / 30 material draws before shadows. Four sites share the single
837,064-byte GLB and geometry cache; individual material clones retain switch state; distant construction is culled.
Shadow passes add scene work beyond those 30 draws. The shared six-light/two-map
cap is verified, not proof of a hardware frame budget. The recorded scene draw
counts exceed the general 900-draw surface reference and Miasma exceeds 1.8M
triangles. Snapshot FPS on a contended shared machine is not median/p95 or
acceptance. Performance and independent art review remain open; no budget waiver
or independent score is claimed.


### Curated captures and measured scene cost

- [Pyre approach](pyre-approach.png), walking view [before](pyre-walk-before.png) / [after](pyre-walk.png).
- [Aeon approach](aeon-approach.png) and [full mast at walking height](aeon-mast.png).
- [Selene approach](selene-approach.png), [Miasma walking view](miasma-walk.png).
- Controller [lamp on](lamp-on.png) / [off](lamp-off.png), [result inventory](result-inventory.png), [390 px Power wheel](power-phone.png).
- [Source identities and exact poses](source-and-views.json), [controller receipt](controller.json).
- Renderer receipts: [Aeon](aeon-world.json), [Selene](selene-world.json), [Pyre](pyre-world.json), [Miasma](miasma-world.json), [pre-floodlight comparison](comparison-before.json).

The builder inspected each final world approach/walking/mast capture plus UI and
switch evidence. Pyre before/after uses identical seed, epoch, camera and scale;
it compares the earlier settlement preview to the current combined candidate,
so it is not an isolated lighting-only performance experiment.

| Scene/view | Draws | Triangles | Snapshot FPS |
| --- | ---: | ---: | ---: |
| Pyre approach before | 1,670 | 1,171,318 | 35 |
| Pyre approach after | 2,457 | 1,658,168 | 28 |
| Pyre walking before | 1,410 | 1,043,026 | 36 |
| Pyre walking after | 2,224 | 1,527,810 | 30 |
| Aeon approach after | 2,713 | 1,944,091 | 32 |
| Selene approach after | 2,345 | 2,076,028 | 27 |
| Miasma approach after | 2,841 | 5,120,434 | 21 |

Counts include complete rendered scenes/shadow passes. The Pyre approach delta
is +787 draws/+486,850 triangles; the lamp geometry alone accounts for 30 draws/
58,956 triangles. Retain this cost for independent optimization review; it is
not excused by the small source GLB. No averaged timing or automated pixel diff
is claimed. These are local development results, not final performance acceptance.

## Integration contract

No database/schema or protocol-version change. Client and API both import the
piece catalog and power model; reload them together before account-backed solo
saves contain the new type. Older clients reject unknown pieces through the
existing save guards. Public deployment is not part of this task.


Locally integrated at `8566a43` on 2026-09-08. The guarded fast-forward preserved
all 56,247 unrelated dirty HANDOFF bytes (SHA3bf320f0). The existing persistent
preview service restarted once through its graceful shutdown path, retaining
the same database. Direct8087 and proxied5178 health both return200; served light
modules return200 and the served GLB matches the tested SHA256 exactly.
[Integration receipt](local-integration.json). No public deployment occurred.
