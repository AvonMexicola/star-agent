# Atlas first production checkpoint — geometry iteration

The Atlas refresh now has a working authored exterior and retractable gear,
within the existing whole-ship geometry/file budgets. This checkpoint preserves
the 64 m hauler's occupied layout and physical studio walkthrough. **It is not
the finished visual asset, a silhouette approval or the gameplay Atlas replacement.**

Current hero SHA-256:
`f61dfd26570635436ffd05a4243b38be11a891a28dada35f758ae789ed2b396e`.
The source is `assets/atlas-mark-ii/atlas-mark-ii.blend`, rebuilt by
`assets/atlas-mark-ii/build_atlas.py`; layout and systems own every moving pivot.

| Export | Triangles | Bytes |
| --- | ---: | ---: |
| Frozen original hero | 412,988 | 38,037,892 |
| Current hero, full interior/gear/contact bake | 59,443 | 3,859,404 |
| Current LOD 1 | 37,400 | 2,294,168 |
| Current LOD 2 | 23,150 | 1,462,120 |

There are 241 exported mesh batches; the studio adds its four live MFD surfaces.
Meeting the asset triangle/byte limits does not establish a full-scene draw-call
or frame-time pass. The supplied LODs have been regenerated but still need their
own distance/pop review before final delivery.

## Implemented geometry and mechanics

- Swept shoulders with their width peak moved aft; lower middle roof and a
  narrower aft machinery cap; raked upper load supports. The pressure walls,
  cargo deck, upper rooms, lift aperture and actual pilot eye remain in place.
- Fitted shoulder radiators and attitude jets replace floating world-X fittings.
  Drive pods retain real recessed exhaust depth, with far less repeated stock.
- Six named legs fold longitudinally into hollow pockets outside the cargo
  pressure vessel. Pads counter-rotate about the actual .56 m cross pin. Doors
  open before legs move and close after stowage. Their motion is owned by
  `AtlasMarkIISystems`; no embedded animation clip is implied.
- Ramp toes taper to the true landing plane while retaining the 6 m main leaf,
  2 m tip and authored walking incline. Upper pressure gaskets retract above
  the 8.8 m loading clearance when the ramps open; fixed lintels/lights moved up.
- Cargo overhead fittings now sit above the declared clearance. The lift call
  panels moved outside the 8 m drive lane, with matching interaction anchors and
  fixed collision boxes driven by the shared layout.
- The studio uses the approved shared Meridian Shipworks identity and identifies
  this as a geometry study. Final hull registration and manufacturer decals are
  still part of the surface finish pass.

The rigid mesh packer uses the standard
[KHR_mesh_quantization extension](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization).
The installed Three.js loader already supports it. Mesh-only leaf transforms
decode integer positions while named moving nodes keep their exact transforms;
indices and UVs are retained. The exporter measured a maximum position error of
.626 mm and normal error of .379 degrees on this hero. WebP images are embedded.
No decoder download or runtime dependency was added. This storage change is not
topology decimation of the hero.

## Validation and evidence

- `npm ci` completed. `npm test` passed **459/459** after the first working
  mechanism/packing checkpoint. After the subsequent hull, gear-bay and header
  changes, the focused real-asset suite passed **19/19** and the production build
  passed again. The full suite was not rerun for those isolated final changes.
- `node scripts/atlas-refresh-motion-check.mjs` passed on the exact current hero.
  [Motion evidence](motion-check.json) covers 41 sampled poses for each of six
  legs and their doors against actual exported static triangles, 101 poses for
  each ramp, and 90 upward rays through the hold and both loading portals.
  There were no tested static collisions outside explicit bearing/door-hinge
  contact volumes, no toe penetration and no sampled overhead intrusion.
  The minimum sampled ramp Y was +.0257 mm. This is a sampled check, not a
  continuous collision certificate or a suspension/structural simulation.
- The final current **production** build rendered and completed both gear
  directions and both ramp/header-seal openings: **1/1** browser test, 29 s,
  no page/console errors or warnings. [Render evidence](render-evidence.json)
  records the hash, camera, browser and GPU identity. Actual frames:
  [exterior](exterior.png), [side](side.png), [plan](plan.png),
  [gear down](gear-down.png), [gear moving](gear-moving.png),
  [gear stowed](gear-stowed.png), [open hold](cargo-open.png),
  [open aft loading](aft-open.png).
- The complete retained **keyboard** route passed against the preceding
  production checkpoint: aft ground approach → ramp → hold → lift → seated
  pilot → crew aisle and aft wall → galley/hygiene. No repositioning shortcuts
  were used for that journey. It took 1.2 minutes; together with its shape case,
  the two tests passed in 1.4 minutes with no browser errors.
  [That checkpoint's identity](physical-journey-asset.json) is explicitly
  `b2e56a709bc0e2d3eefbaadf7c7c0c179f96da6e81b85d96bd2891787e40e1e6`;
  it precedes the last gear-pocket and retracting-header changes. The final
  current short render does not silently replace a rerun of that full route.
  [Pilot screens](pilot-mfds.png), [bridge approach](bridge-walk.png) and
  [crew aft approach](crew-aft-walk.png) are from that physical journey.

Browser evidence uses Chromium 151 on AMD Radeon 860M through ANGLE/OpenGL.
Exterior captures are 1440×900, DPR 1. The inherited physical test walks at
480×300 and inspects the seated four-screen frame at 1440×900. No FPS/performance
acceptance or physical-controller-device testing is claimed. Some builder
exterior screenshots retain faint fading UI; the independent review must wait
for chrome transitions to finish.

## Failed checks and changes retained in the record

- The original silhouette scored 3.0/5. The first new shell still read as a long
  carriage and had warped plate diagonals. The reviewer supplied concrete massing
  changes, partially applied here. [Independent constraints and direction](../production-constraints/review.md)
  preserve the exact baseline and inherited first-pass images. No final score is
  borrowed from a Kestrel or Nomad review.
- An initial capture failed with connection refused after the temporary dev
  process ended. Root replaced that process with a persistent service and later
  verified a separate production build. Raw logs remain under `/tmp`.
- Quick geometry exports intentionally skipped the contact bake. The existing
  AO regression then failed (17/18 at that intermediate stage). Full baking was
  restored before this checkpoint; the regression now passes. No test was skipped
  or weakened to turn the quick export green.
- The first full mechanism candidate reached 60,273 triangles / 4.88 MB. Removing
  invisible fine engine fixings and packing vertex data brought the hero under
  budget. A subsequent shape pass briefly exceeded the 4 MB cap; the current
  3.86 MB export includes the complete asset and contact bake.
- Inspection exposed an incorrect pad-centre counter-rotation joint and overly
  deep box-like gear pockets. The pivot now matches the actual cross pin; shallower
  pockets expose the legs, and frame ties route clear of the inner door swing.
- The first overhead-only sample did not cover the old low portal seal. The new
  moving gasket and relocated portal stock close that additional defect, with
  the final ray grid including both portal planes.
- Blender logs a local `bl_pkg`/`cattrs` startup error unrelated to authoring;
  all recorded final Blender builds exit 0. Vite retains its bundle-size advisory.

## Work still open

Fresh independent silhouette review is underway, with a required score ≥4.5
before final materials. The broad dark upper side and bow mouth still need a
candid art judgment. This checkpoint is intentionally frozen for that review.

Unique painting UVs and a validated opaque Meshy shell do not exist yet. The
current exporter rebuilds metre-scale tile UVs; it must preserve a frozen unique
atlas before maps-only import. No Atlas Meshy job, generated finish, paid credits
or manual download is claimed. Retain the clean rig and exact source hashes when
that stage begins.

Gear is an authored/runtime inspection mechanism; discoverable complete
keyboard/controller/touch operation and landed flight interlocks remain pending.
The older partial/injected controller studio tests are not full acceptance.
Phone framing, empty S3 installation clearance, material/LOD review, whole-scene
performance, fallback handling and the ≥4.2 final independent art gate still need
their own checks. The existing legacy gameplay Atlas has not been replaced by
this 64 m model. There is no refreshed Atlas PR, merge or deployment yet.
