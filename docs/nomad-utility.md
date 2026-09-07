# Nomad 02 — draft review checkpoint

[Draft PR #46](https://github.com/AvonMexicola/star-agent/pull/46) publishes this
checkpoint. The implementation is commit `9a363cb`; the final finish and
acceptance gates listed below are still open.

The user requested a substantial original visual upgrade and Cutter-like starter
utility gameplay, then specifically requested folding gear, empty S1 hardpoints,
ramp/sign clearance, corrected Nomad 02 markings and the shared Meridian
Shipworks identity. This lane implements that bounded ship upgrade in an isolated
`feat/nomad-utility` worktree. It depends on PR #34’s consolidated integration
base `6f80fc0` for the existing inventory, controller and moving-cabin contracts;
the review PR targets `main` under the current project policy.

[Official 2022 Drake Cutter brochure](https://media.robertsspaceindustries.com/t6b4ip5ypoot8/source.pdf)
was used to establish the historical solo starter/utility role. It is inspiration
for playable access and modest onboard utility, not a source of Nomad artwork,
exact current Star Citizen statistics, copied layout or combat balance.

## Implemented behavior

See [Nomad 02 guide](nomad-ship.md) for the physical route, rest limits, persistent
cargo, manual/assisted gear behavior and exact empty-mount contract. Base game
flight handling remains in use. No bed healing/logout, SCU conversion, extra
interactive props, installed S1 guns or new landing suspension is claimed.

## Evidence completed so far

- Independent primary silhouette v1: **3.4/5, failed**. v2: **4.1/5, failed**.
  The body, nose, drive roots and rear collar were rebuilt in response.
- Independent primary silhouette v3: **4.5/5, passed**. Thirteen self-captured
  Chromium views, including walking scale and approximately 30 m views.
  This historical gate did not certify the later finish or moving mechanisms.
- `npm test`: **471 tests passed in 63 files**, 2026-09-07, after the gear-clock
  backport, full asset bounds checks, real cargo state tests, moving berth
  invariants and unpowered terrain/station soft-contact deployment checks.
- Production build passed. Chromium 151.0.7922.173 / AMD Radeon 860M / ANGLE GL,
  DPR 1: keyboard/cargo/physical exit-return/gear/reload and 390×844 injected touch
  cabin route passed with zero page errors, console warnings or failed requests.
  Keyboard case includes pointer cargo controls and an explicit quick-transit
  landscape fixture; the local boarding route uses physical movement.
- Assisted moving-berth keyboard route and deliberately malformed-model fallback
  rest/cargo/physical ramp route passed. The fallback emitted its one expected
  loader warning; the normal journeys had no browser warnings.
- A parseable GLB missing `CargoBox_8` also passed the full physical fallback
  route after intake was made atomic across the cabin, chair, console and eight
  box roots. Both failure fixtures passed their targeted production retry; no
  partially adopted authored cabin overlaps the procedural fallback.
- The authored PBR material and existing re-entry shader rendered together with
  clean browser diagnostics and hull heat 0.80. This controlled 18 km / 6 km/s
  inertial fixture does not establish a continuous atmospheric flight journey.
- [Independent controller review](qa/nomad-02/controller-review.md): desktop and
  phone parked utility loops, assisted moving berth and rotating inertial berth
  all passed on one frozen runtime/GLB. Injected standard Gamepad events drove
  the actual menus, physical route, cargo transfer, gear command and saved reload.
  The report preserves the earlier failed harness attempts and candidate hashes.

The complete loaded assembly passed 21 sampled gear states, 21 folding-ramp
states and 243 actual triangle floor intersections. All eight installed boxes
bring the complete runtime ship to **59,224 triangles**. The GLB is 3,413,568
bytes, with four 1024 px WebP images. See the [curated evidence](qa/nomad-02/README.md).

The first browser iteration found a Fleet button overlapping the phone walk pad.
The corrected layout reserves the equipment bar, adds Commands access and keeps
Fleet reachable through that menu. A keyboard no-teleport assertion also needed a
10-micrometre tolerance for planet-scale floating-point roundoff; its observed
difference was below a nanometre. Neither failure is represented as a passing run.
The later heating fixture initially watched stellar heat instead of the separate
`reentryHeat` state; the corrected targeted run passed. Visual inspection also
found and corrected the cargo MFD's stale starboard direction label.

Reproduce the focused production checks with:

```sh
npm run test:browser -- -c scripts/nomad-utility.config.js
npm run test:browser -- -c scripts/nomad-studio.config.js
npm run test:browser -- -c scripts/nomad-controller.config.js
```

The configurations build and serve on port 5295. `NOMAD_URL` selects an already
running candidate instead; `NOMAD_HARDWARE=1` selects ANGLE GL. Serialize hardware
captures with other agents. The controller harness is retained from the reviewer
with portable path/config plumbing; the original passing runs remain separately
identified in its report. These commands do not imply physical-device testing.

## Material provenance — pending local import

Original authored hull and cabin finishes are baked locally. The validated opaque
hull painting copy preserves the original UV/vertex buffers and contains one
material and one base-colour image, with no rig. The cleaned upload removes only
collapsed/tiny-UV triangle fragments from that painting copy.

Meshy 7 Text Input, PBR on, 2K generated one finish job using **10 existing
credits**; no subscription or purchase was made. Keep Original Texture and UV was
on. The exact prompt, upload layout/hash and cleaning script are retained under
`assets/ship/`. The generated mesh is for UV validation only; only returned maps
will enter the authored material pipeline. Runtime has no Meshy or network
requirement. Browser download was blocked with `ERR_BLOCKED_BY_CLIENT`, and a
manual user download was requested. No signed-URL or browser-permission bypass
was attempted. Imported raw maps, source hashes and the semantic finish recipe
will be recorded when the supplied file is available.

The independent CPU audit found and reproduced two holes before import: a stale
clean upload could borrow a new manifest UV ID, and a matching returned fragment
could pass one-way vertex checks. The revised importer proves the original
upload hash, actual UV buffer and deterministically cleaned copy as one chain.
It requires bidirectional used position/UV corners and unique triangle coverage,
allowing exporter index/winding changes and duplicate faces. A 10-micrometre
position / 0.000002 UV tolerance accommodates Float32 normalization. The packer
checks raw-map and derivative hashes as well as the painting identity.

The [independent CPU audit](qa/nomad-02/pipeline-review.md) closed seven findings.
`python3 assets/ship/test_texture_contract.py` passes **17 tests**, independently
repeated, covering the actual clean-shell roundtrip, rejected partial/stale
inputs, material UV mapping, upload-time Blender signature binding, and staged
export failure handling. Oversized or failed source saves leave the prior asset
bundle intact; final replacement of several files is not a filesystem transaction.
The exact observed job settings and prompt are retained and hashed. Their
bookkeeping does not prove the attribution of a future supplied source file.

The clean Blender-data reset prevents orphan material/image aliases when rebuilding
from an existing file. Isolated Blender 5.2.0 CPU probes reproduced all textured
hull/cabin UVs and the rig; applying the material attachment twice preserved the
tested geometry, normals, transforms and custom properties. Those probes skipped
baking and export. Only unused UVs on two untextured emissive batches varied;
whole-file byte determinism and reproduced bake pixels are not claimed.

This is a draft checkpoint for the implemented gameplay and authored shape. The
real source import, full finish export, final browser/packed budget checks, final
independent visual rubric and clean performance acceptance remain pending. No
generated maps have entered the runtime yet. No merge or deployment is authorized
by this record.
