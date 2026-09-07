# Bastion runtime integration: independent CPU review

Decision: required lifecycle/readiness corrections remain. Actual geometry,
articulation and world rebasing pass the bounded CPU probes. No visual acceptance
or graphics-performance claim is made.

Reviewer: `/root/nomad_cutter`, separate from the renderer and asset authors.
This review covers root's `src/station-security.js` and the narrow world, room,
main, client and station-complex hooks. It does not independently accept this
reviewer's authored ramming correction.

Frozen source and hashes are in this directory. The actual copied GLB is
`ccc8f276dc07891aff056fded88367607a28d5f5aa2897e39b9ae973fca3472f`,
877,048 bytes. It had advanced beyond the earlier candidate03 announcement before
the snapshot; source hashes identify exactly what ran. Original source is not
modified. The probe uses Node geometry loading with inert textures, not a browser.

## Required corrections

1. **P2: a reconnect after server restart suppresses new station strikes.**
   `server/security.js` assigns IDs from a per-service sequence starting at one.
   `StationDefense.strike` rejects IDs retained in `seen`, but the actual client
   `_clearWorld` → `StationComplex.setMultiplayerState(null)` disconnect path
   never clears that set. The probe executes the frozen actual disconnect hook:
   the initial `aeon-orbital:1` is accepted, disconnect retains one seen ID, and
   the next service's valid first strike is rejected. Authoritative damage can
   therefore occur without its fresh beam/recoil/impact presentation. Use a
   service-unique event namespace or clear deduplication and pending transient
   effects when the session ends.

2. **P2: a named empty rig is accepted as ready and can fire without a body.**
   A valid scene hierarchy preserving every required articulation and muzzle
   node, but containing no mesh primitives, resolves `readyPromise` successfully.
   The probe records `ready=true`, four rigs, zero parts, no error and an accepted
   strike. Validate nonempty, finite body geometry before publishing rigs or
   readiness. Current server loading awaits readiness, so it also trusts this
   erroneous successful state. The actual frozen asset contains valid geometry;
   this finding concerns the advertised readiness contract.

3. **P3: disposal during loading still publishes a live collision rig.**
   `dispose()` removes the group and clears rigs but does not cancel the pending
   ready callback or detach `station.defense`. Resolve the real asset after an
   early disposal and the object becomes ready with four rigs/nine parts each,
   while its group remains outside the scene and station collision still points
   at it. The current main hook disposes on page unload, limiting the present
   gameplay reach. A disposed guard should prevent late publication and release
   the station pointer only if it still refers to this instance.

Root has acknowledged these findings and owns the corrections. This rejected
snapshot remains frozen; closure should name the revised source hashes.

## Positive results

- Both existing actual-GLB tests pass: named muzzle authority, rest/recoil pose,
  late-join state, visible-beam origin and articulated collision after rebasing.
- The independent probe covers four mounts, three yaw/pitch poses and nine meshes
  per mount. All 108 swept rays through real exported triangle faces hit.
- 648 exported vertex comparisons across two camera origins have maximum world
  error `2.3283064365386963e-10` m at a 25-billion-metre origin. Corresponding
  collision contact points have zero difference between the rebases.
- Cloned mounts share nine geometry objects and nine collision trees. Per-part
  matrices remain in the station-local frame; render position is separately
  rebased. Server world loading awaits the same articulated asset.
- Beam geometry starts at local Z zero, extends toward its historical target,
  and subtracts the double camera origin at placement. It uses standard Three
  materials, with no new custom shader. Browser compilation remains unverified
  in this CPU-only task.

## Reproduce

From this directory:

```
node --test --test-isolation=none tests/station-defense.test.js
node probe.mjs
```

Node version: v26.7.0. The probe prints and saves `results.json`; exact source
hashes are in `source-sha256.json`. The named-empty and disposal cases deliberately
exercise lifecycle failure paths, not different shipped geometry. No GPU, browser,
network server, root production edit or asset mutation was performed.
