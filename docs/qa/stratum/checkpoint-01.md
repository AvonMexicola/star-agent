# Stratum M-05 — first authored checkpoint

**Development candidate, not final art or gameplay acceptance.** The builder
has frozen the original hollow hull, fitted cockpit/cabin, two extraction booms,
real telescopic rear ramp, four folding gear legs and standalone inspection
adapter/studio. Root owns fleet, flight, navigation, mining and ledger integration.

Author: `/root/nomad_cutter`; source branch assigned by root is
`feat/meridian-stratum`, starting at `4e34432`. Work was authored/tested in the
writable `/tmp/star-agent-stratum-author` shadow, preserving the shared dirty
workspace and sibling worktrees. The ownership-filtered bundle contains only
new Stratum paths. Root will copy and commit it in the assigned worktree; this
report does not invent that future commit identity.

## Frozen export and layout

| Item | Actual record |
| --- | --- |
| Runtime GLB | `public/models/stratum.glb` |
| SHA-256 | `7cce466e64bb500fd35f7f559fd28b15a67db79df6e618f604512be5b2229058` |
| Bytes / triangles | 3,574,792 / 28,688 |
| Meshes / primitives / nodes | 62 / 62 / 92 |
| Maps | Three embedded lossless 1024² WebP images; original PNG sources and recipe retained |
| Editable source | `assets/stratum/stratum.blend`, relative texture paths; SHA `2db8fb90f698f29f1753c33fe7942b86ebb1970f6e37078960a1908e98fa11d0` |
| Layout SHA | `a17f9159a02de736fc1463da132a4a709d95135ca5fcb93647e762d6abe5ff44` |
| Actual parked bounds | X±5.959974, Y0…4.718014, Z−9.400000…7.720000 m |
| Flight allocation | min[−6.5,0,−10], max[6.5,5.6,8]; includes closed access and all gear/boom poses |
| Open ramp extent | Z12.203015m, minY0; small deck rise/normal offset explains the3mm overhang beyond the12.2m floor endpoint |

The nominal18m class allocation is intentionally reported separately from the
17.12m neutral geometry length. Fourteen measured flight parts keep the pressure
body, drives, static axles, gear, booms and closed access cassette separate. Only
the four individual gear envelopes reachY0. Gear/boom boxes include sampled
motion with a2cm interpolation guard; open access is outside the flight contract.

See `assets/stratum/README.md`, `layout.json`, `measurements.json`,
`flight-parts.json` and `textures/provenance.json` for exact interfaces, timings,
coordinates, allocation semantics and source hashes.

## Actual CPU validation

- Blender5.2.0 LTS, CPU background export completed with exit0. Runtime file passes60k-triangle/4MB/1024-map limits. The installed optional remote-asset add-on reports missing`cattrs`, and optional MeshOptimizer is unavailable; neither is used by this original local builder. No GPU render was launched.
- `node tests/stratum.test.js`: **10/10 pass**,0 skips, about0.62s in the final authoring receipt. This runs the actual `node:test` cases directly. An earlier `node --test` subprocess wrapper terminated without a useful diagnostic in the old sandbox; root can rerun the standard wrapper after copying. No escalation or repeated runner troubleshooting was attempted.
- Checks decode the actual GLB geometry and hierarchy: bounded gear/boom poses; ground datum; fourteen separate collision volumes covering additional intermediate poses; whole-triangle aisle/portal/freight keep-outs; real foot OBB vs fixed hull across13 gear poses; nested ramp guide separation; deployed incline/headroom/ground clearance; actual open bore and recessed emitter; real muzzle/nozzle frames; double precision at25 billion metres; all four one-sided MFD faces visible from the pilot eye; instance state independence; sequencing and failed/disposed asset loads.
- `node scripts/stratum-measure.mjs`: actual binary bounds,13 gear samples,169 yaw/pitch combinations per boom, named muzzle/nozzle measurements and14 flight boxes generated with matching export hash.
- Standalone Vite7.3.6 production build passed. It produces the isolated studio and copies only the Stratum model. The615kB combined Three/studio JavaScript chunk emits Vite's standard size advisory; it is recorded, not silenced. No shared package/game entry was changed.
- Playwright fixture discovery passed: two desktop/phone cases listed. This is syntax/discovery only; **zero browser cases have been executed** for Stratum.

Raw logs are under `/tmp/star-agent-stratum-qa/`; they are not included as generated
test reports in the commit. Earlier failures were corrected before this freeze:
stored tangents exceeded the4MB budget; the initial hinge axle intruded into the
clear portal; nested underside guides required13cm stacking; the final guide
was shortened to stay above the ground plane. The original pre-fix GLB remains
under `/tmp/star-agent-stratum-qa/candidate-01/`. These are CPU engineering
iterations, not failed independent art scores.

## Remaining gates and limits

No native screenshot, GPU metric, art score, continuous-animation visual pass,
physical game journey or actual mining payout is claimed. The reserved5580
studio must still be rendered and inspected on desktop/phone after queue
acquisition, then independently reviewed against the4.5 silhouette target.
Materials, lighting, canopy sightlines, lettering, full mechanisms and all visible
clearances require that real-renderer review. Exact foot/floor and aisle checks
do not certify every possible pair of moving triangles or every aim trajectory.

The studio shows explicit inspection MFD data. The physical freight/ore/supply
volumes are authored reservations, with no separate fake ledger. Root's adapter
must install real MFD state, gate walking on full ramp deployment, secure access
before flight, consume the canonical gear progress, use actual muzzle rays and
register the ship's trusted server/cargo contracts. Complete keyboard/controller/
touch flight, landing, boarding, extraction and persistence remain pending.
