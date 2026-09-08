# Independent Gannet Art13 payload CPU audit

**The frozen packet's static assembly counts and qualified body-clearance results are supported.** My replay is byte-identical to the author's final receipt, and a separate geometry reader confirms the actual Art13 scene totals, bank intersections and selected body bounds. The former Art12 documentation corrections are now explicit. No new runtime blocker was established by this bounded audit.

This measures CPU assembly resources and frozen rest geometry. It does not approve loaded-scene visuals, physical stack contact, loading or flight, main-game cache lifecycle, driver residency or FPS. The separate Art13 native visual review remains a different record. No production source, original packet or earlier evidence was changed; no GPU/browser was launched.

## Frozen inputs and independent execution

Archive `/tmp/star-agent-gannet-payload-art13.tar.gz`: **74,609 bytes**, SHA **`f429a6755652cafd4f4ec711f7282ac61030d2225b7cd55f4d09ec1ed94f1799`**. Sidecar manifest SHA **`7a3b626fed5bd8da2994330a76ec8d1f2696ce600174edb82b0c271bbe6804fe`**. All **17** archive members match the sidecar and the existing extracted files. The retained **111-line** Art12-to-Art13 unified diff was regenerated and matches exactly.

The final probe SHA is **`2ca8990a1a2f543e2f6f8b2e84fcb57f84f25e496e5bdc7f920783d4a08cd39a`**. Its `inputs.json`, SHA **`3a2a71645ffe8433a93e58c382b00f930790ab3dc22952ebf0d465d1f42ac5ff`**, pins **16 source/dependency files and five assets**. I independently verified all these identities in the read-only integration worktree. The packet identifies root import `e727d8e`; the exact model identities, not a moving branch name, control the execution.

- Gannet: **`8da0bc2e3da7c8c2a2db7b29957b226fab0ba30eb0155f98d82a3f82c3995e6f`**, **56,490 triangles / 33 primitives / 3,169,484 encoded bytes**.
- Burrow: **`831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468`**, **21,526 triangles / 34 primitives / 2,175,556 encoded bytes**.
- Production cargo visual source: **`eee79d8ff858412ca965b868f042b41be4950b05af629d7f8bd8865087131e65`**; cargo grid source **`7ad52bcb445d81c5de6df5eb13c0a898fb228ecf7f1c7002fe285d17c67bf05f`**; canonical Gannet layout **`9334ef7470c6aa1c0d4da7a2ce91d42191fedfdde00bd8732f15675ad904adb5`**. These remain unchanged from the checked Art12 measurement.

My frozen-probe execution exited **0** and produced the same **214,171-byte** receipt, SHA **`e204787fa96ef7691a71ee4755edc9d2df6789d6ffd3188c4fbfdd2be7a8f1ea`**. The separate reviewer reader also exited **0**. It retains my earlier independent geometry method and changes only the frozen receipt input from Art12 to Art13. The old reader and old results remain preserved. It loads the actual GLBs, counts scene meshes/triangles, applies world transforms, queries actual hull triangles, places the selected detailed/LOD bodies and verifies their bank/parked-rover separation.

The author probe executes production `createCargoVisual`, material-group merging, instancing and nearest-24 detail selection. Only file intake, image decode and canvas glyph drawing are CPU stubs. I read the changed measurement logic and the unchanged production placement/batching source. The final probe now reads actual production label plane vertices and instance matrices separately from body bounds. My separate reader's label reconstruction agrees on the excluded-label counts; it is not represented as a second live-label renderer.

## Counts reproduced

| CPU assembly quantity | Two 64-SBU crates | 128 one-SBU crates |
| --- | ---: | ---: |
| Detailed / LOD crates at canonical pilot eye | 2 / 0 | 24 / 104 |
| Cargo shape-material batches | 5 | 7 |
| Label / grid-line batches | 1 / 2 | 1 / 2 |
| Cargo triangles, including labels | 7,784 | 130,112 |
| Gannet + Burrow + cargo triangles | **85,800** | **208,128** |
| Unculled primitive/instance/line submissions | **75** | **77** |
| Raw assembly material objects | 21 | 23 |
| Selected encoded GLB bytes | 5,624,140 | 5,578,584 |

Both fill the real two 64-cell banks, pass canonical full-footprint support, reject overflow and retain the rejection of removing a supporting bottom one-SBU crate. Each actual loaded scene total agrees with the GLB document for Gannet, Burrow and all three cargo templates. Compared with Art12, only **868 hull/assembly triangles** and **−121,188 encoded bytes** change in these totals; cargo counts, batches and support gaps remain unchanged.

These are unculled CPU assembly submissions, not renderer-observed draw calls. Instancing shares geometry; multiplied instance triangle work is not a separate geometry allocation per crate. Shadows, material passes, frustum choices, other objects and world content are outside this count.

The source-derived display allowance remains separately labeled: four 512×320 Gannet live materials replace one authored placeholder, and Burrow adds a 512×224 display plane/material. This yields **25 / 27 material objects**, **85,802 / 208,130 triangles** and **76 / 78 submissions**. It is not execution of the actual main-game display lifecycle.

## Geometry and contact qualifications

The canonical port bank is **[-4.1,1.4,4.5]..[-2.9,3.8,9.3]** and starboard **[2.9,1.4,4.5]..[4.1,3.8,9.3]**. Fresh Art13 triangle queries reproduce **44 port / 45 starboard** intersections or contacts at the exact boundaries and **zero** hits within each **3 mm inset**. The packet now names the tested inset explicitly and retains the affected exact-boundary mesh names; it no longer implies that the whole uninset bank is empty.

All selected detailed/LOD **bodies** fit within that verified inset and clear the actual parked, closed Burrow bounds. The reproduced minimum body margin to a canonical bank face is approximately **4.000113 mm / 3.999987 mm**. These body bounds use the decoded templates and production placement positions; they are CPU bounds, not a claim of micron-level GPU position measurement.

The author separately bounds actual label instances. **Two** label planes in the large case and **16** in the small case extend beyond the leading canonical bank face and the tested inset. They sit approximately at **z=4.498**, outside the body-clearance certificate. Counts include their geometry, but neither the packet nor this audit certifies label-to-hull triangle clearance or visual readability. This limitation is now clearly stated rather than hidden by body containment.

Canonical grid support remains distinct from rendered contact. Reproduced floor gaps are **10 mm** for large crates and **10–32.5 mm** for the detailed/LOD small-crate mix; small-crate interlayer gaps are **60–92.5 mm**. These are gaps against canonical support planes, not measured changes to the quantized ship floor. They remain visible-support limitations and are not waived by `validGrid`. No loading, moving lift, open rover-door or carried-flight clearance claim is added.

## Storage and cache scope

The corrected `encodedGlbAssetBytes` field counts complete encoded GLBs, including embedded images. It does not count decoded vertex/index/instance memory. The images comprise eight definitions with seven distinct byte contents. The duplicated content is the **512² manufacturer emblem**, SHA **`43448ef90190f5834c7be3761b74179595fcec5eee5d8d1b2a24c4d18eec145e`**; the normal maps differ. This closes the old duplicate-image wording error.

Nominal RGBA8 storage with full mip chains is **36,438,012 bytes** including one 256×64 label canvas per single-key case, or **40,544,872 bytes** including the separate display allowance. These are arithmetic image-storage estimates, not measured driver residency. They exclude decoded geometry, environments, shadows, transient/decode buffers and unrelated game resources.

The sequential test intake union contains five asset paths and **5,857,684 encoded bytes**. Unchanged production module caches retain templates/batches and the `64:iron` / `1:iron` label keys across visits. This observed union is not a total session-residency bound: prior visits, other initialized templates and additional size/resource label keys add resources. Each additional label key adds material/texture/submission work. The packet now preserves these limits explicitly.

## Reproduction and evidence

Owned review directory: `/tmp/star-agent-gannet-art13-independent-review-payload/`.

```sh
node /tmp/star-agent-gannet-payload-art13/payload.mjs /home/cees/projects/star-agent-medium-integration /tmp/star-agent-gannet-art13-independent-review-payload/replay.json
node /tmp/star-agent-gannet-art13-independent-review-payload/verify.mjs /home/cees/projects/star-agent-medium-integration /tmp/star-agent-gannet-art13-independent-review-payload/geometry-receipt.json
```

| Independent artifact | SHA-256 |
| --- | --- |
| `replay.json` | `e204787fa96ef7691a71ee4755edc9d2df6789d6ffd3188c4fbfdd2be7a8f1ea` |
| `verify.mjs` | `f3480e36bdb71eca552bacde0754020b1e66151898f87bcf462cffbb4fe38884` |
| `geometry-receipt.json` | `42fce106ffd83347eca906d78b5b3cd4db9b87aed3b8e98e03ebef77477427e3` |

`intake.json` records archive/member/input/diff verification, and `manifest.json` freezes this independently authored report and review evidence. This audit introduces no cargo source changes or visual score. Preserve the support/label limitations and require separate actual loaded-scene and gameplay evidence for those claims.
