# Gannet Art13 full-payload CPU measurement

**PASS within the stated static assembly scope.** This executes production cargo placement, material merging, instancing and detail selection against the imported Art13 asset. It does not certify a rendered scene, GPU residency, FPS, visually contacting stacks, loading/flight, or main-game lifecycle. An independent reviewer still owns the packet audit.

Root confirmed clean integration `e727d8e`, Art13 source cherry-pick `ef3d898`, before this measurement. No repository file, service, ledger or browser was modified. All16 relevant source/dependency hashes and five model hashes are frozen in `inputs.json` and verified before use and again after execution. Previously hashed Art12 application sources are unchanged.

| Frozen input | Identity |
| --- | --- |
| Gannet Art13 | `8da0bc2e3da7c8c2a2db7b29957b226fab0ba30eb0155f98d82a3f82c3995e6f` |
| Clear Burrow | `831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468` |
| Adapted probe | `2ca8990a1a2f543e2f6f8b2e84fcb57f84f25e496e5bdc7f920783d4a08cd39a` |
| Inputs | `3a2a71645ffe8433a93e58c382b00f930790ab3dc22952ebf0d465d1f42ac5ff` |
| Final receipt | `e204787fa96ef7691a71ee4755edc9d2df6789d6ffd3188c4fbfdd2be7a8f1ea` |

## Production assembly results

Gannet contains56,490 triangles/33 primitives/3,169,484 encoded bytes. Burrow remains21,526/34/2,175,556. Actual loaded scene triangle and mesh counts match each GLB document, including all three freight templates. Both cases fill128SBU across the real two64-cell banks, reject overflow, and pass complete canonical cell support. Removing a supporting bottom one-SBU crate is rejected.

| CPU assembly quantity | Two64-SBU crates | 128one-SBU crates |
| --- | ---: | ---: |
| Detailed / LOD crates at canonical pilot eye | 2 /0 | 24 /104 |
| Cargo shape-material batches | 5 | 7 |
| Label batches / grid-line batches | 1 /2 | 1 /2 |
| Cargo triangles including labels | 7,784 | 130,112 |
| Gannet + Burrow + cargo triangles | 85,800 | 208,128 |
| Unculled primitive/instance/line submissions | 75 | 77 |
| Raw assembly material objects | 21 | 23 |
| Selected encoded GLB file bytes | 5,624,140 | 5,578,584 |

These are CPU assembly counts, including multiplied instance triangle work. They are not renderer-observed draw calls or per-instance geometry allocations. Instancing shares shape geometry. Frustum decisions, shadow passes, other ships and world content are excluded.

The separate source-derived display allowance remains four512×320 Gannet live materials replacing one placeholder, plus a512×224 Burrow display plane/material. It gives25/27 material objects,85,802/208,130 triangles and76/78 submissions. This allowance is explicitly not execution of the main-game display lifecycle.

## Actual bounds and support qualification

The canonical port bank is `[-4.1,1.4,4.5]..[-2.9,3.8,9.3]`; starboard is `[2.9,1.4,4.5]..[4.1,3.8,9.3]`. Only their interiors inset3mm on all faces are triangle-clear. The actual exact boundaries still touch/enter44port and45starboard hull triangles; the receipt includes affected mesh names. No claim is made that the full uninset bank is empty.

Every actual selected detailed/LOD crate **body** fits entirely within those tested inset regions and clears the parked closed Burrow bounds. Minimum body distance from a canonical bank face is4.000113mm for the large crates and3.999987mm for the small-crate mix. The receipt records all body bounds.

Labels are measured from the **actual production plane vertices and instance matrices**, not inferred from the body allocation. Two label planes in the large case and16in the small case extend beyond the leading canonical bank face; the same counts lie outside the tested inset. All label bounds are retained separately. Their geometry is included in totals, but this probe does not certify label-to-hull triangle clearance or visual readability.

Canonical support is not physical visual contact. Floor gaps remain10mm for large crates and10–32.5mm for selected small crates. The one-SBU stack has60–92.5mm visual interlayer gaps. These are referenced to canonical grid planes, separately from quantized hull-floor positions. No cargo code or support rule was weakened to obtain a pass.

## Storage estimates and cache scope

`encodedGlbAssetBytes` names whole encoded GLB files, including embedded images. It is **not decoded geometry/index/instance allocation**. Those buffers are excluded from the following image estimates.

Each single-key case requires eight ship/rover image definitions with seven distinct encoded contents. The duplicated content is the approved512² manufacturer emblem (`43448ef90190f5834c7be3761b74179595fcec5eee5d8d1b2a24c4d18eec145e`), present in both ships. The normal maps differ. Freight templates contain no embedded images.

Nominal RGBA8 storage with full mip chains is36,438,012B including one256×64 label canvas, or40,544,872B including the separate source-derived display allowance. These estimates do not measure driver allocation; they exclude geometry, environments, shadows, decode/transient buffers and the rest of the game.

The two sequential cases observe all five asset paths, totaling5,857,684encoded file bytes. Production module caches retain templates, material batches and both size/resource keys (`64:iron`, `1:iron`) across visits. This observed union is still not total session residency: prior visits, the main game's other initialized templates, and additional resource keys can add retained objects. Every additional size/resource key adds a label material/texture and label submission.

## Reproduction and changes from Art12

Run with the integration's installed dependencies:

```sh
node --check /tmp/star-agent-gannet-payload-art13/payload.mjs
node /tmp/star-agent-gannet-payload-art13/payload.mjs /home/cees/projects/star-agent-medium-integration /tmp/star-agent-gannet-payload-art13/replay.json
```

Final syntax and execution both exit0 on Node26.7.0. The receipt records the exact probe/input hashes and source/model identities; stale inputs are rejected. GLB filesystem intake, image decode and canvas glyph drawing use CPU stubs. Production cargo geometry, materials, placement and instance matrices execute unchanged.

`probe-art12-to-art13.diff` contains the complete111-line unified diff against the preserved Art12 probe (`3decc590142d5e6d9d8d15dbd8ab152995922c32d0692a503ad22adbc173053f`). Changes pin Art13 and dependencies, verify actual scene totals, qualify the3mm bank region, measure labels separately, record body bounds, correct encoded-byte/duplicate-image/cache terminology, and label the source-derived display allowance. No capacity, detail selection, collision inset or support tolerance changes.

`comparison-art12.json` records the arithmetic delta: +868hull/assembly triangles, unchanged cargo/submission/support-gap counts, and−121,188encoded bytes in either selected asset set. Art12 originals and its independent review are retained untouched. Preparatory successful receipts and their exact probe sources are retained separately; the manifest identifies the final source and receipt. Native loaded-scene and gameplay acceptance remain separate.
