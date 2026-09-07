# Gannet geometry iteration history

These are author checks, not independent art scores. The original failed exports/logs remain under `/tmp/star-agent-gannet-evidence` on the authoring machine; they are not portable committed test reports.

| Candidate | Actual finding | Correction / result |
| --- | --- | --- |
| Geometry01 | Source had 38,156 triangles; fin reached Y 7.21135 and rear fixture Z 11.004, outside the requested envelope. | Reduced the fin tip and later inset the rear entry lamp. Original export/source measurement retained. |
| Geometry02 | Actual GLB tests passed 5/7. The rear lamp still exceeded Z 11 by 4 mm; a freight upper shelf lip entered the 5.8 m bay. | Lamp moved inside the envelope; shelf lip moved outside the bay. Test assertions retained. |
| Geometry03 | 6/7 passed. The cabin-to-bay wall extended into the first occupied freight cell. Further source inspection found a forward lift guide and shoulder fairing also crossed the freight volume. | Ended the vestibule wall before Z 4.5, placed its pressure closure ahead of the cell, moved guides ahead of the bank, and shaped fairings outside it. |
| Geometry04 | 7/7 direct CPU cases passed in 0.827 s. Actual steering/suspension, door sweep, player route, support triangles, full bay, full freight and gear envelopes all passed. | Added physical fixed call panels and their named transforms without changing the clear bay or freight layout. |
| Geometry05 | Call-panel candidate: 39,878 triangles, 33 mesh primitives, four WebP images, 2,417,904 bytes. The test runner passed the file in 1.385 s. | Prepared portable packed Blender images and an unchanged-geometry rebuild check before delivery. |
| Geometry06 | Clean rebuild after packing source images yields the exact geometry05 GLB SHA `90aafdb5…`; all seven direct cases pass in 0.998 s. Four images are packed into the editable source; isolated studio build passes. | Frozen geometry/material/rig checkpoint. Browser and independent visual gates remain pending. |

The initial `python3` environment lacked Pillow; the existing local ship-authoring Python environment generated the maps successfully. Blender 5.2 emitted the inherited missing `cattrs` / extension registration messages and a missing optional MeshOptimizer message, then exported successfully. This pipeline uses the existing rigid packer, not MeshOptimizer or Draco. Its material exporter warning about more than one image node concerned the shared ORM sampler; the original shader uses the same image and sampler for both roughness and metalness. Actual renderer review remains necessary.

Some failing `node --test` invocations reported only a failed file without child assertion detail. Direct execution of the same `node:test` module exposed the geometric failures and individual case results; no test was skipped or weakened. This reporting difference is retained separately from the geometry defects.
