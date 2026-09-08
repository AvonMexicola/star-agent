# Stratum Art03 — authored checkpoint, native review pending

This revision replaces the long upper extraction lids with raised tool-root load arches, a lower thermal-service waist and tapering aft compression housings. The center pressure cell now carries a seated roof service assembly. All moving mining geometry, landing legs, telescopic ramp, glass and MFD faces retain their Art02 triangles and transforms. This is a development asset checkpoint, not independent art acceptance.

The source base is Stratum `f78357e01f3a6db64f175f8b60526e1308b902e5`, asset `b2660a8e400c7ae64ed75cf3e4166d66f1953f0fb6dcbcce5357b1edaa37eb3e`. The final Art03 asset is **`22bbf0296e349e24f1a9bd636745511bf31b9291f1a305814f13d4a45cac4d08`**, **51,346 triangles / 3,932,512 bytes**, 66 primitives and 110 nodes. All three embedded WebPs remain 1024². The default 60k/4 MB/1024 limits are unchanged.

## Construction and finish

A CPU raycast of the old editable source found broad ivory skin faces behind their own graphite backing. The correction uses explicit centered shell thickness, physical metre-sized gasket reveals and fitted outward skins. The new export records 104 panels and 664 broad outward triangle samples: 650 directly hit their own skin, and none hit their own backing first. Other real assemblies cover the remaining 14 samples. This receipt checks actual evaluated surface relationships; it does not award a visual score.

The former 91-cycle directional finish signal has been replaced by independent, isotropic filtered roughness and micro-height gradients. Texture grain repeats every four metres and contains no baked lighting. Color remains grayscale reflectance multiplied by the explicit Meridian material recipe; there is no semantic color atlas to invert. Normal and ORM channels are independently validated from decoded runtime WebP bytes and actual UV0 samples.

The contact bake now ignores each source object's own evaluated thickness while retaining nearby fitting contact. A subdivided top face allows the existing deck to carry short-range contact near furniture feet. The support datum remains Y1.35; the seated rubber wear surface rises 6 mm above it. Berth/bin floor collars remain within their existing collision volumes. No central cockpit brace has been introduced.

The shared geometry and packing helpers, canonical layout, systems, loader, eye/display/beam/nozzle APIs and gameplay sources are unchanged. The measured 14 independent flight solids are refreshed for the new static surfaces. Dynamic ground-reaching geometry remains separate from the pressure body.

## CPU and build evidence

Evidence is retained in `/tmp/star-agent-stratum-art03-qa`; the final delivery manifest binds its source and export hashes. No browser or GPU job was launched by this author.

| Check | Result and limit |
| --- | --- |
| CPU Blender export | Root executed the exact frozen builder with Blender 5.2.0 LTS, `--background --factory-startup -noaudio --python-exit-code 1`. Final build03b exited 0. |
| Existing Stratum tests | **11/11 pass**, including byte/texture budgets, all gear/boom bounds, intermediate flight-solid coverage, aisle/portal/freight space, gear clearance, complete ramp support, rebased muzzle/nozzle precision, clear central glass, all four display faces, sequencing and failed-load lifecycle. Ran `node tests/stratum.test.js`, the in-process node:test harness. |
| Protected Art02 geometry | Exact triangle-coordinate sets for four gear subtrees, the ramp subtree, both complete boom subtrees, four display faces and all glass; all 21 required transforms exact. |
| Moving boom clearance | 49 yaw/pitch combinations per boom, 58,527 actual triangle pairs; zero contacts outside the intentional root bearings. This supplements the existing finer envelope sampling. |
| Packed runtime versus unencoded source | All indices and 226,172 UV scalars exact; 97 named transforms exact. Maximum loaded position error **0.209 mm**, normal error **0.376°**, color error 0.001862; within the existing 1 mm / 0.4° limits. |
| Finish routing | Three actual embedded WebP hashes match provenance. Texture selection, UV0, base factors, normal strength and ORM channels pass. |
| Studio | Production build passes. The inherited >500 kB bundled-Three advisory remains recorded. Syntax and Playwright test listing pass (two desktop/phone cases); no browser pass is claimed. |
| Studio projection | 18 CPU cases use the actual source camera functions and loaded MFD geometry. Individual displays remain inside the canvas at the fixed eye; measured complete gear/head bounds fit the stated inspection rectangle at desktop and portrait aspect ratios. This is not a native DOM/readability check. |

## Preserved failures and correction

The original asset's failed 3.26 static mean / 3.4 silhouette and Art02's failed **3.84 static mean / 4.0 silhouette** remain in history. The latter independent report is `/tmp/star-agent-stratum-art02-independent-review.md`, SHA256 `b1ea9d2548255ce612bac5612f71b0994e409ee2c08ad2663dfadf276a319255`. The brief still requires silhouette 4.5 and QUALITY still requires the applicable overall mean.

Art03a correctly failed the byte gate at **4,044,832 bytes**, asset `4ea18bcc3d351a075aefc8c01112e057452b30b49ecc06b010e055908d8970a6`. Its export, builder, failure log and 10/11 test result are retained. The sole final change quantizes the subtle basecolor grain to seven bits before lossless WebP packing, changing at most one encoded channel byte. This saves 112,320 bytes. All 316 non-image buffer views, nodes, meshes, materials and accessors remain exact; normal and ORM PNG/WebP files are byte-identical to Art03a. No geometry was deleted to meet the budget.

The earlier old-runner diagnostic wrote its complete panel-ray receipt, then hung during Blender shutdown with a PulseAudio permission error; that owned process was stopped and its exit130 retained. It was not a renderer or application failure. Subsequent exports used root's authorized host CPU execution, with no repeated runner launch loop.

## Native evidence still required

The updated studio uses fixed-eye gaze for pilot and cabin inspection; its old interior OrbitControls path could move the eye. Four visible MFD look buttons rotate toward actual display geometry without moving the pilot or changing the 72° vertical inspection lens. Pointer drag and controller right-stick look use the same fixed-eye path. Hidden MFD buttons are excluded from controller focus. Touch targets are at least 44 px high.

The revised browser fixture retains the original baseline views and sequencing assertions, adds each MFD from the fixed pilot eye, closer measured gear bounds through retract/extend, and native range drags through all four yaw/elevation corners before returning both heads to neutral. Native trusted-event receipts and unedited video accompany those future runs. The test file is prepared and listed, not executed by this author.

Independent native Art03 review, the final game-rendered cabin/mining/traversal evidence, phone per-display readability, detailed mechanism motion and scene performance remain separate pending gates. No Art02 score is carried forward. Cees retains final acceptance and release authority.
