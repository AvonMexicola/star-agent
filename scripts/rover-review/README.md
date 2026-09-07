# Independent Burrow review fixtures

Prepared by `/root/kestrel_reviewer` from the retained candidate 09 review, with candidate 10 identity and follow-through now archived. These sources belong at `scripts/rover-review/`; generated evidence belongs outside the repository. No historical GLB copies, browser profiles or raw screenshots belong beside the scripts. Curated, identified captures live under `docs/qa/mining-rover/`.

These are finite diagnostic probes and an isolated native Three PBR capture fixture. They do not certify a continuous collision sweep, global mathematical watertightness, pressure simulation, structural strength, all possible human animations, game input, mining transactions, LOD or FPS. Passing a process is not finished-art acceptance. Read the JSON contacts and the scoped review.

## Inputs and outputs

Repository root defaults to two levels above this directory. Assets are resolved from the repository:

- `public/models/mining-rover.glb`
- `assets/mining-rover/layout.json`
- `public/models/props/mannequin.glb`
- installed `three`, `vite` and `@playwright/test` packages in `node_modules`

`ROVER_REVIEW_OUT` is required and must be outside the repository. `ROVER_REVIEW_ROOT` is an optional root override for checking these files before copying them into a repository. `ROVER_EXPECTED_SHA` defaults to frozen candidate 10 (`88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`); set it explicitly when reviewing a new, identified candidate. This changes the input being measured, not its acceptance status. Human identity remains fixed to `8a46b5b09f0659661a0e4373db159f9b87d43136144e118e908265f45ba6a52d`.

Example, after copying the directory into the repository:

```bash
export ROVER_REVIEW_OUT=/absolute/external/rover-review/candidate-10-cpu
node scripts/rover-review/header.mjs
node scripts/rover-review/cabin.mjs
node scripts/rover-review/joints.mjs
node scripts/rover-review/structure.mjs
node scripts/rover-review/lamps.mjs
```

Each command writes its own JSON. Run sequentially so joint poses and resource use remain straightforward to interpret. They do not launch a browser.

| Probe | Actual finite scope |
| --- | --- |
| `header.mjs` | 762 outward side-shell rays from X ±0.76, plus closed/0.1375/0.55 rad door contact classification. Requires all 762 rays to hit within 0.22 m. Contacts at seals are reported rather than broadly excluded. |
| `cabin.mjs` | Actual joint-world × inverse-bind skinning in idle/sit-idle; sampled radius-0.12 m eye path, seated body contacts and 32 historical forward-quarter rays. The 762-ray probe owns the fuller side-gap check. Generic hand/yoke or harness contacts need interpretation. |
| `joints.mjs` | 24 wheel states across travel −0.22/0/+0.22 m and front steering −0.52/0/+0.52 rad at spin 0.123 rad, plus runtime-articulated links. Only the explicit own-hub mating region is accepted automatically; other wheel contacts fail. Link/anchor contacts remain in JSON for spatial review. |
| `structure.mjs` | Six stringer/tread contacts and above-tread intrusion, chassis connections, gasket/cover/fastener overlaps, rest envelope, 13 door poses and 18 cutter poses. Surface contact is not a load certificate. Historical 04-to-05 text comparison is retained in archived evidence, not falsely repeated without its baseline input. |
| `lamps.mjs` | Both real lamp-support connections and 18 cutter aiming states, checking lamp-bracket intersections and forward muzzle self-rays. |
| `mechanisms.mjs` | Optional broader raw contact report: three compression × three steering × two spin samples (rear duplicates skipped), 13 door poses, fixed steps and 18 cutter/muzzle samples. Does not turn every intended mating contact into a failure or silently discard it. |
| `delta-08-09.mjs` | Optional historical 08-to-09 world-triangle multiset comparison. Requires `ROVER_BEFORE_GLB` and `ROVER_BEFORE_LAYOUT` pointing to archived candidate 08. The allowed changed region is specifically the fixed starboard lower-panel extension; this is not a general acceptance check for arbitrary redesigns. |

The triangle library uses a BVH and separating axes, including in-plane axes for coplanar contacts. The parser supports the exported non-sparse, non-Draco glTF accessors and LINEAR/STEP animation channels; unsupported accessors/interpolation fail. Current rover articulation follows canonical link anchors/wheel offsets directly. No legacy Nomad or weapon-mount dependency remains.

## Native capture — coordinate GPU use first

The parent/host operator runs this after obtaining the GPU window. Do not launch it in parallel with another GPU review or performance run. One Chromium launch, no retry loop:

```bash
export ROVER_REVIEW_OUT=/absolute/external/rover-review/candidate-10-native
export ROVER_BROWSER_TMP=/short/absolute/browser-temp
node scripts/rover-review/capture.mjs
```

Keep the browser temporary path short: Chromium's Unix socket pathname limit previously rejected a long nested path. `CHROMIUM_PATH` defaults to `/usr/bin/chromium`; `ROVER_REVIEW_PORT` defaults to 5434. The output contains six desktop 1440×900 PNGs, a phone 390×844 PNG and `capture.json`. The script verifies file and HTTP-served SHA, actual human poses, attached-skin translations, overview framing and enabled shadow reception. It records browser/backend, source commit/dirty state, layout hash, actual input hashes, camera frames, scene counts and shadow-frustum settings. Zero console/page warnings or errors are required.

The native fixture uses unmodified imported PBR materials, ACES exposure 0.95, RoomEnvironment intensity 0.75 and the same key/fill directions and camera presets as the original review. Transparent glazing does not cast opaque shadows. The directional shadow frustum is fitted to actual posed model/human vertices plus their floor-shadow projection. It retains a 2048² map, depth bias −0.0001 and normal bias 0.010 m. The [candidate 10 native review](../../docs/qa/mining-rover/review-visual-10.md) inspected the resulting shadow-on images, closed the fixture acne and scored the scoped static views 4.04/5. That is evidence for this recorded fixture, not for arbitrary changed inputs or whole-game lighting.

The original global-shadow toggle was invalid with already cached receiving programs. A separate fresh-launch diagnostic initializes casting/reception off and asserts that state:

```bash
export ROVER_REVIEW_OUT=/absolute/external/rover-review/candidate-10-shadow-off
node scripts/rover-review/capture.mjs --shadow-off
```

This writes only cockpit/rear diagnostic views. It is not acceptance lighting. Preserve previous native and failed diagnostic evidence. No display is populated by the isolated fixture, so its blank MFD is not a runtime failure. The original posed mannequin is a scale reference, not driving IK. Underbody views omit the floor and use full droop; compression views hold body height fixed.

The [production record](../../docs/qa/mining-rover/production-record.md) keeps the
native static review, keyboard motion 3.8, complete recorded input journeys and
remaining physical-MFD-footer visual check separate. The 5417 user preview must
stay frozen; 5419 is the final production candidate. This documentation update
does not authorize concurrent browser work or restart either preview.
