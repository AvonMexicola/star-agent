# Bastion runtime closure

Decision: **PASS for the bounded CPU lifecycle and integration review.** No
remaining blocker was found within this scope. This is independent review of
root-authored renderer fixes; it is not visual acceptance or acceptance of the
reviewer's separate ramming implementation.

Reviewed source:

- `src/station-security.js`: `af78ee5a4be663a6b3ebbf0a070f7e836babe1581ba1a60ea5526e9cbd05f18b`
- `src/station-complex.js`: `fdba2a8939d472392407a891fbc505a9caefe2f8329cf254f7286b4bcd954a64`
- Actual GLB: `ccc8f276dc07891aff056fded88367607a28d5f5aa2897e39b9ae973fca3472f`

The original rejected source, report and results remain unchanged in the parent
directory. This directory contains a separate revised snapshot with exact hashes.

| Original finding | Independently observed closure |
| --- | --- |
| Strike IDs survived disconnect and suppressed a restarted service's first shot | Actual client clear-world and station disconnect hooks clear `seen`; a new strike with the old ID is accepted |
| An empty named rig published readiness and accepted shots | Readiness rejects with `Bastion body geometry is empty.`; zero parts and no accepted strike |
| A disposed pending load republished an invisible collision rig | Resolving the asset leaves ready false, zero rigs, no scene group and no stale station pointer |

The revised source also checks finite body positions, valid triangle counts and
indices, and finite invertible mesh transforms before any rig publication. The
error path clears readiness and partial rig/group state. Session reset removes
beam geometry and pending events, clears counters and returns articulated poses
to rest. Disposal prevents subsequent state/strike publication.

Validation on Node v26.7.0:

- Root's `node --test --test-isolation=none --test-reporter=tap tests/station-defense.test.js` passes all five cases, including actual GLB muzzle/collision checks, the real station disconnect method, empty/nonfinite geometry and disposal during loading.
- `node probe.mjs` here passes the original independent failure scenarios with explicit closure assertions. Only the old probe's access to the now-absent disposed rig was made null-safe; the original probe remains unchanged.
- The same 108 exported-face sweeps hit across four mounts, three articulated poses and nine meshes. All 648 rendered vertex comparisons remain within `2.3283064365386963e-10` m at the large world origin; collision contact changes from rebasing remain zero.

The probe saves exact results in `results.json`; `source-sha256.json` identifies
its source and artifact. No production files were changed, and no browser,
GPU or server was launched. Runtime browser/input, shader rendering and asset visual review
remain with the coordinated acceptance workflow.
