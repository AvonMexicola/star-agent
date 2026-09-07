# Original Pyre branch reconciliation

Compared `origin/feat/pyre` (`44e426a`) with PR34 runtime `0ab1854`.
The newer `feat/pyre-planet-tech` branch continued `a18cf81` and recovered working
changes; commit ancestry alone does not show their inclusion.

| Original work | Candidate implementation / decision |
|---|---|
| Keplerian position, 30.36-day period, epoch pin, tidal body frame | `pyre-world.js`: the entire `STAR` through frame-transform block is byte-identical to the original. Position is evaluated at the pinned/page-load epoch and frozen during the session in both versions. |
| Worker epoch synchronization | `pyre.worker.js` calls `setPyreEpoch` for each job. `pyre-terrain.js` sends `PYRE_EPOCH` for patch and identity-map requests. |
| Streaming, prewarm, halo normals, near-ground readiness | `pyre-terrain.js` retains the altitude-based 64/32/16 job budget, `prewarm`, one-cell normal halo, and level-12 readiness below 2 km. This is a job budget, not mesh resolution. Current meshes use 32/16 cells by LOD and add resident-parent geomorphs. |
| Per-body atmosphere and distant worlds | `atmosphere.js` has two slots; `main.js` binds Pyre to slot 1 and updates both distant-world points. The `AEON_ATMOSPHERE` constant is byte-identical. The star's angular radius is distance-aware and uses the shared authored radius; PR35 adds the new solar encounter separately. |
| Numerical coverage | Retain v2 resource/collision/morph tests. Recover the original orbital-period and level-17 astronomical rebasing/shared-edge tests. Broader legacy tuning tests rely on superseded v1 appearance parameters. |
| Browser journey | Current `scripts/pyre.spec.js` verifies orbital, caldera and lava views, physical landing/ramp/reboarding/launch, and errors. Passing main-integration run recorded separately. |
| User guide | Retain `docs/pyre.md`, which describes the actual v2 resources, morphs and 1,800 km arrival. Do not restore the old 60 km arrival or obsolete tuning values. |

The remaining differences in `44e426a` are alternative appearance tuning, the
older correlated noise hash, the old lava-cell neighbourhood and sampler without
normalized resource profiles. Restoring them would discard v2 continuity/resource
fixes and the subsequently requested broad arrival view. The old branch history
is reconciled while preserving the newer implementation and the useful additional
invariants above. No new orbital simulation is claimed: both implementations
freeze the epoch during a session.
