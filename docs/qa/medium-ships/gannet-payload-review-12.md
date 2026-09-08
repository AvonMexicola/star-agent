# Independent Gannet Art12 payload measurement review

Disposition: the supplied packet's two CPU payload counts are reproducible and supported, with the scope corrections below. This is a resource and static geometry receipt, not rendered performance, GPU residency, visual support, loading, or gameplay acceptance. No cargo production source was changed and no GPU/browser was launched.

## Frozen input and independent execution

Reviewed archive: `/tmp/star-agent-gannet-payload-art12.tar.gz`, SHA256 `a26703628cc00050d0f2757e0be4dda140eaceae3ffa60401a38660d1bc9145a`, 12,581 B. All four archive members match the sidecar manifest and extracted files. Probe `payload.mjs` SHA256 is `3decc590142d5e6d9d8d15dbd8ab152995922c32d0692a503ad22adbc173053f`.

The root replay at `/tmp/star-agent-gannet-payload-root-12/root-receipt.json` is byte-identical to the original author receipt. I independently executed the frozen probe against the read-only integration worktree; it exited 0 and produced the same 38,492-byte receipt, SHA256 `ea81880c7127f2ba6d96e5a74526255f4585cfa6b2f4105aabb20039543def21`. A separate reviewer probe loaded the actual asset scenes, checked source/asset identities, counted the instantiated scene meshes and triangles, repeated bank/triangle queries, and checked actual detailed/LOD body bounds. It also exited 0.

Pinned Gannet: `6b4f48ad29aa5cf8a8e6004c0b45861fb65d97a449dc27c7533cbec83e052af8`, 55,622 triangles / 33 primitives / 3,290,672 B. Pinned Burrow: `831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468`, 21,526 triangles / 34 primitives / 2,175,556 B. The actual loaded world-scene counts agree with the GLB document counts for both and all three cargo assets. This review does not transfer these measurements to upcoming Art13.

Source SHA256 identities checked against the receipt:

| File | SHA256 |
| --- | --- |
| `src/cargo/visuals.js` | `eee79d8ff858412ca965b868f042b41be4950b05af629d7f8bd8865087131e65` |
| `src/cargo/grid.js` | `7ad52bcb445d81c5de6df5eb13c0a898fb228ecf7f1c7002fe285d17c67bf05f` |
| `src/gannet-layout.js` | `4240e53342815d1829d637983663453f7c2c8a1b47a99e77cdd887c6aa20063a` |
| `assets/gannet/layout.json` | `9334ef7470c6aa1c0d4da7a2ce91d42191fedfdde00bd8732f15675ad904adb5` |
| `src/gannet.js` | `abfd4766058edd7565918be75f8ba30ee1c66cecae87ac1b57edecf65ffd07d3` |
| `src/mining-rover.js` | `1fdae79530c769e3d96aad04c189d954ad4f9467214ff717a7a1c3b7f51af650` |
| `src/ship-mfd.js` | `c35f63193b152d1c43963acb54ecca73a6466aef57dfead6884d4f2ed8deb4e4` |

## Counts supported by actual production batching

The author probe executes production `createCargoVisual`, its material-group geometry merging, instance matrices, and nearest-24 detail selection. It stubs GLB file intake, image decoding and canvas glyph drawing; it does not replace cargo placement/batching logic. Both cases fill the actual two 64-cell banks, pass complete canonical-cell support and 128-SBU capacity checks, reject overflow, and reject removal of a loaded bottom cell in the small-crate case.

| Quantity | Two 64-SBU crates | 128 one-SBU crates |
| --- | ---: | ---: |
| Detailed / LOD crates at canonical pilot eye | 2 / 0 | 24 / 104 |
| Shape material batches | 5 | 7 |
| Label batches / line batches | 1 / 2 | 1 / 2 |
| Cargo triangles including labels | 7,784 | 130,112 |
| Complete raw Gannet + Burrow + cargo triangles | 84,932 | 207,260 |
| Complete unculled raw primitive/instance/line submissions | 75 | 77 |
| Cargo material objects including labels and grid | 7 | 9 |
| Raw assembly material objects | 21 | 23 |

These are assembly counts before visibility/frustum decisions, shadows and other world content, not renderer-observed draw calls. Instancing shares geometry buffers; multiplied instance triangle counts describe geometry submitted across instances, not separate per-crate geometry allocations. The brief separately requests this loaded-assembly measurement while retaining the per-ship 60k/4MB limit; it does not set a 60k cap for the ship plus every payload object.

I checked the separate source-derived live-display allowance: four independent 512×320 Gannet materials replace the single shared authored placeholder, and Burrow adds one 512×224 display plane/material. This gives 25/27 assembly material objects, 84,934/207,262 triangles, and 76/78 submissions. These are source allowances, not execution of the main-game lifecycle; detached display helper objects and unrelated effects are not a complete game memory inventory.

## Geometry and support limits

The actual banks are port `[-4.1,1.4,4.5]..[-2.9,3.8,9.3]` and starboard `[2.9,1.4,4.5]..[4.1,3.8,9.3]`. The author tests each bank with a **3 mm inset on all faces**. Therefore its phrase “complete bank interior” needs this qualification. Independent exact-boundary queries find 44 port / 45 starboard hull triangles touching or entering the excluded shell; the 3 mm inset regions have zero hits. No broad exclusion of moving parts was introduced.

The qualification does not invalidate the current crate-body result: all actual detailed and selected LOD body bounds fit wholly within those clear inset regions. The minimum body distance from a canonical bank face is 4.000113 mm for the 64-SBU case and 3.999987 mm for the one-SBU case. All body bounds also remain clear of the actual parked, closed Burrow bounds. This is the frozen rest/parked geometry, not a new open-door, elevator, or loading sweep certificate.

Label planes need separate scope. Production places each forward label 2 mm outside its cell front. At the leading bank edge, two labels in the 64-SBU case and 16 in the one-SBU case lie at `z=4.498`, outside the canonical bank and the inset-body certificate. The geometry and submission counts include them; the bank-body clearance certificate does not. This review records their bounds, without claiming new label triangle clearance, visual readability, or a visible defect from CPU coordinates alone.

Canonical support remains distinct from rendered contact. Independently reproduced gaps above the canonical floor are **10 mm** for the two large crates and **10–32.5 mm** for the selected small-crate detail/LOD mix. The actual small-crate vertical interlayer gaps remain **60–92.5 mm**. These values are not replaced by `validGrid === true`, and they are not a certification of physically touching stacks. Any difference between quantized hull floor geometry and the canonical plane is separate from these canonical-reference measurements.

## Residency terminology and correction

The numeric image accounting is consistent: eight ship/rover embedded image definitions, seven distinct encoded contents, and one 256×64 label texture in each single-key case. Nominal RGBA8 storage with full mip chains is 36,438,012 B including the label, or 40,544,872 B after the source-derived five display canvases.

The README misidentifies the duplicate: it is the **512² approved manufacturer/emblem image**, SHA256 `43448ef90190f5834c7be3761b74179595fcec5eee5d8d1b2a24c4d18eec145e`, present in both GLBs. The two normal-map hashes differ. This changes the explanation, not the eight-definition/seven-content count or the stated unshared estimate.

These are nominal image-storage estimates, not measured driver residency. They exclude geometry/index/instance buffers, environment and shadow maps, decode/transient buffers, other ships/world content, and additional session cache entries. The `geometryAssetBytes` field is actually the **total encoded GLB file bytes** for each selected set (5,745,328 / 5,699,772 B), including embedded images; it should not be labeled decoded geometry allocation. Actual runtime also initializes other objects, including a carried one-SBU template, so the selected-set totals are not a complete main-game residency inventory.

The retained module caches are material to interpretation: disposed cargo visuals retain template/batch/label cache entries. Visiting both test configurations can retain all three cargo templates and both size/resource label keys. Every additional size/resource key adds a label texture/material/submission. A single iron key is sufficient for these two capacity measurements but is not a worst-case multi-resource label budget. No GPU memory or FPS conclusion follows from the CPU totals.

## Review artifacts and reproducibility

Directory: `/tmp/star-agent-gannet-payload-independent-review/`.

| Artifact | SHA256 |
| --- | --- |
| `replay.json` | `ea81880c7127f2ba6d96e5a74526255f4585cfa6b2f4105aabb20039543def21` |
| `verify.mjs` | `b4051d94972beac5ba065ed8e5333be4c53b4d40c1acbb6f853042045b5eff18` |
| `geometry-receipt.json` | `87cec5bde7fd2889ae5c51889ff5c997a9f178eba76b0dd80136aca8326d86cf` |

Reproduce with `node /tmp/star-agent-gannet-payload-art12/payload.mjs /home/cees/projects/star-agent-medium-integration /tmp/star-agent-gannet-payload-independent-review/replay.json` and `node /tmp/star-agent-gannet-payload-independent-review/verify.mjs /home/cees/projects/star-agent-medium-integration /tmp/star-agent-gannet-payload-independent-review/geometry-receipt.json`. Both intentionally require the frozen Art12/source identities. The supplemental reader uses geometry-only image stubs and real Three scene transforms/triangle queries. It is independent verification of the static body/scene claims, not another copy of a live gameplay test.

No additional runtime blocker was established by this bounded measurement review. Preserve the documentation corrections, existing visual stack gaps, Art12 visual disposition, and pending actual loaded-scene/gameplay evidence.
