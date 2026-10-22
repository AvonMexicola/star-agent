# Hangar revision: actual AMD render comparison

This final root-run capture comparison records candidate **1eeb3022cbdd8483a81f35b1cb15d3863161b323**, including the ceiling occlusion correction, against the previous candidate **4da1a5d1a1acac00b3034fed8f06457a682f6852**. All eight corrected views were inspected. Recessed ceiling diffusers are visible again in the gallery; ring faces remain readable. The first comparison of intermediate candidate 0d75c3f and the defect it found are preserved below as history.

This is implementation-team evidence, **not a completed independent Opus review or visual approval**. The independent rereview hit its service quota after an incomplete/failed capture attempt. Its directory remains untouched and is excluded from both successful comparisons.

## Final capture provenance and matching conditions

- BEFORE: root capture, `/tmp/star-agent-hangar-before-hardware`, candidate 4da1a5d served at `http://127.0.0.1:5239`; completed **2026-09-06T12:57:02.211Z**.
- AFTER: root capture, `/tmp/star-agent-hangar-coffer-tour`, candidate 1eeb302 served by the persistent production preview at `http://127.0.0.1:5249`; completed **2026-09-06T14:05:40.377Z**.
- Both: Chromium **151.0.7922.173**, **ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)**, vendor **Google Inc. (AMD)**, **WebGL 2.0 (OpenGL ES 3.0 Chromium)**. Actual AMD hardware, not SwiftShader.
- All eight pairs are **1600 × 900**, seed **7291**, render scale 1. Camera position/FOV and fixture records match exactly. World views use intro=0; the opening uses the authored intro=1 cinematic at t=10; cockpit and detail views use the same camera fixtures.
- Both evidence files contain eight captures, zero console errors, zero warnings, zero failed requests, zero unexpected lifecycle events, and no run failure. The production scene rendered without reported shader errors. This does not claim identical shader programs: revised hull/material variants intentionally change rendering inputs.
- HUD hidden in both tours; no HUD clock/FPS mask, crop, resize, alignment correction or retouching. Physical signs and station MFDs remain part of the comparison.
- Commit attribution records the builds supplied by the integration owner. The capture harness itself does not embed a Git revision.

**Repository image mapping:** every file `docs/qa/hangar-revision/01–08*.png` is now an exact copy from the **1eeb302 root coffer tour**. The four files `docs/qa/hangar-revision-before/05–08*.png` remain unchanged exact copies from **4da1a5d/root before-hardware**. These are curated review copies, not accepted baselines. Historical 0d75c3f originals remain in `/tmp/star-agent-hangar-final-tour`, with their exact hashes below. No accepted baseline or other historical QA image was rewritten.

## Final pixelmatch results: 4da1a5d → 1eeb302

Real pixelmatch from **playwright-core@1.63.0 bundled pixelmatch/pngjs**, threshold **0.1**, default antialias exclusion, **1,440,000 pixels per pair**. Exact changed-pixel counts are authoritative; displayed fractions/percentages are rounded. A fraction **strictly greater than 0.02** is a review item, not an automatic failure or acceptance. Zero means no differences exceeded this configuration, not necessarily byte-identical PNGs.

| View | Different pixels | Fraction | Percentage | Review rule |
|---|---:|---:|---:|---|
| [01-orbit.png](hangar-revision/01-orbit.png) | 0 | 0.000000000000 | 0.000000% | Below 2% |
| [02-coast.png](hangar-revision/02-coast.png) | 0 | 0.000000000000 | 0.000000% | Below 2% |
| [03-forest.png](hangar-revision/03-forest.png) | 4,412 | 0.003063888889 | 0.306389% | Below 2% |
| [04-highlands.png](hangar-revision/04-highlands.png) | 0 | 0.000000000000 | 0.000000% | Below 2% |
| [05-hangar-t10.png](hangar-revision/05-hangar-t10.png) | 8,231 | 0.005715972222 | 0.571597% | Below 2% |
| [06-cockpit.png](hangar-revision/06-cockpit.png) | 801 | 0.000556250000 | 0.055625% | Below 2% |
| [07-corner.png](hangar-revision/07-corner.png) | 132,185 | 0.091795138889 | 9.179514% | Review required |
| [08-gallery.png](hangar-revision/08-gallery.png) | 64,908 | 0.045075000000 | 4.507500% | Review required |

Diagnostics remain in `/tmp/star-agent-hangar-coffer-image-diff`: `comparison.json` and eight `*.diff.png` files. Raw test reports are not copied into the repository.

## Final image inspection

All eight final originals were viewed against the previously inspected BEFORE images. No new unexpected broad composition changes were apparent in this review.

- **Opening / cockpit:** the ring retains its silhouette and mint window strips, with readable blue-grey panel faces and section values. The opening shows deck seams and physical SERVICE sign backplates. The cockpit retains all four MFDs and readable text. Small pixel-difference percentages in these dark views do not negate the visible material improvement. [Opening before](hangar-revision-before/05-hangar-t10.png) / [final](hangar-revision/05-hangar-t10.png); [cockpit before](hangar-revision-before/06-cockpit.png) / [final](hangar-revision/06-cockpit.png).
- **Corner, 9.179514% review item:** incoming hull floor seams, wall/material separation and fitted CENTRAL HUB, FREIGHT TRANSFER, WAREHOUSE and SERVICE sign backplates are visible. Terminal, prints, workbench, equipment and operations gallery retain their layout and access space. The changes match the intended hull/finish/sign work; the flag still awaits independent visual review. [Before](hangar-revision-before/07-corner.png) / [final](hangar-revision/07-corner.png).
- **Gallery, 4.507500% review item:** the corrected image visibly restores **framed, recessed rectangular ceiling diffusers** above the operations gallery. Crossbeams, window framing, console graphics and berth signage remain visible. Their housing arrangement differs from the earlier hull's light faces, so this remains an intentional image difference to review, rather than a demand to reproduce the old arrangement. The physical occlusion observed in 0d75c3f is no longer present in this view. [Before](hangar-revision-before/08-gallery.png) / [final](hangar-revision/08-gallery.png).
- **World views:** orbit, coast and highlands have zero above-threshold differences. The forest differs by 4,412 pixels (0.306389%); its terrain silhouette, foliage layout and broad composition appear stable. Animation timing and LOD/streaming variation are possible explanations, not established causes. Matching fixtures and settled terrain do not prove identical animation history.

The intentional source scope includes station hull/LOD reconstruction, AO-preserving finish variants, ring paint/environment fill, fitted sign backplates, LOD batching and newer Nomad/Atlas GLBs. These fixtures do not validate every ship surface or Atlas. Ring phase differs slightly because it is not frozen by this tour; that measured limitation is not assigned as the cause of every changed pixel. This document makes no frame-budget or physical-boarding pass claim.

## Historical first comparison: 4da1a5d → 0d75c3f

Intermediate candidate **0d75c3f8d61c33a87ab660c6fb1ec567db0760f2** was root-captured in `/tmp/star-agent-hangar-final-tour`, completed **2026-09-06T13:40:09.504Z**, on the same AMD/browser/resolution/fixtures. Its eight images and clean evidence remain there. The first comparison's diagnostics remain in `/tmp/star-agent-hangar-final-image-diff`; these historical values have not been relabeled as the final candidate.

| View | Different pixels | Fraction | Percentage | Review rule |
|---|---:|---:|---:|---|
| 01-orbit.png | 0 | 0.000000000000 | 0.000000% | Below 2% |
| 02-coast.png | 0 | 0.000000000000 | 0.000000% | Below 2% |
| 03-forest.png | 3,974 | 0.002759722222 | 0.275972% | Below 2% |
| 04-highlands.png | 0 | 0.000000000000 | 0.000000% | Below 2% |
| 05-hangar-t10.png | 8,252 | 0.005730555556 | 0.573056% | Below 2% |
| 06-cockpit.png | 492 | 0.000341666667 | 0.034167% | Below 2% |
| 07-corner.png | 133,775 | 0.092899305556 | 9.289931% | Review required |
| 08-gallery.png | 55,947 | 0.038852083333 | 3.885208% | Review required |

The first inspection found that the gallery's formerly bright ceiling rectangles had become dark regions. It explicitly left this unresolved rather than attributing it to the intended lower emission. The integration owner then confirmed that redundant **5.8 × 4.9 m modular ceiling sheet boxes at `HZ1 - .2`** physically covered the incoming hull's recessed coffer diffusers at **`HZ1 + .30`**.

The bounded correction in [the station builder](../../blender/build_station.py) removes those redundant sheets while retaining light coffers, crossbeams and auxiliary strips. The hero was rebuilt to **89,944 triangles, approximately 3.80 MB**. The owner added an [upward ray visibility regression](../../tests/station-floor.test.js) checking eight actual diffuser locations, reporting failure before the correction and all three floor/ceiling checks passing afterward. The final 1eeb302 hardware image above now provides visual confirmation that the corrected diffuser faces are visible. This closes the identified occlusion finding; it does not replace the outstanding independent visual review.

## Reproduce

Serve each candidate production build in isolation. These commands use the actual capture origins; the current integration tour harness does not substitute models in either build. Use fresh output directories for repeat runs to preserve this evidence.

```sh
# Previous candidate 4da1a5d (root BEFORE capture)
node scripts/hangar-integration-tour.mjs --url http://127.0.0.1:5239 --out /tmp/star-agent-hangar-before-hardware --extras --perf1440 --hardware
# Final candidate 1eeb302 (root AFTER capture)
node scripts/hangar-integration-tour.mjs --url http://127.0.0.1:5249 --out /tmp/star-agent-hangar-coffer-tour --extras --perf1440 --hardware
node scripts/hangar-image-diff.mjs --before /tmp/star-agent-hangar-before-hardware --after /tmp/star-agent-hangar-coffer-tour --out /tmp/star-agent-hangar-coffer-image-diff
# Historical intermediate 0d75c3f was captured with:
node scripts/hangar-integration-tour.mjs --url http://127.0.0.1:5249 --out /tmp/star-agent-hangar-final-tour --extras --perf1440 --hardware
node scripts/hangar-image-diff.mjs --before /tmp/star-agent-hangar-before-hardware --after /tmp/star-agent-hangar-final-tour --out /tmp/star-agent-hangar-final-image-diff
```

The `--perf1440` option records extra counter/cadence samples without changing the saved 1600×900 PNG dimensions. Capture order and production build attribution matter: the same preview port served different candidates at different times.

## Final input SHA-256 manifest and curated image mapping

BEFORE = `/tmp/star-agent-hangar-before-hardware`, candidate 4da1a5d; AFTER = `/tmp/star-agent-hangar-coffer-tour`, candidate 1eeb302. All eight AFTER entries map byte-for-byte to `docs/qa/hangar-revision/<filename>`. BEFORE entries 05–08 map byte-for-byte to `docs/qa/hangar-revision-before/<filename>`.

```text
10538c022009e888b0363b2ea04a9edfe533091530343684674b1c0a0ce87573  BEFORE/01-orbit.png
cddfbe09d4642e2abfed2b4e4c6fc1adbac57236fcd23baf21eb8cb01916dcd5  AFTER/01-orbit.png
bba537f5d104ef6cb10e0e6616c6544c680721d0f83e12dc5787b79d911a3736  BEFORE/02-coast.png
c91b99364bb0710e2a65d96d1c40123673859161c9d8ac2c7c2f46161dd2194e  AFTER/02-coast.png
d916017a7ab24bbafa550f6620fb5776c1c4319b775016898c3656cd8e18c30f  BEFORE/03-forest.png
186f42776d171d01f59523ecc9005b3a027eaf3bdbc3d62843c0d3818d584ea8  AFTER/03-forest.png
86e14debf1d9bc9657b312ceb37e0b5ff7e93ebe65c7cca819e4c8d1de9789dd  BEFORE/04-highlands.png
1fa6ded715d32b422c0ba90e72b25487b966eac8825cbe2c651de40575a91f82  AFTER/04-highlands.png
6cd22d0291b1f3145a1baf31751f2c701b69f42974d7cbd29dcd656d32004617  BEFORE/05-hangar-t10.png
52942101acc53c7ac5c60d7d838ffc0d0e3dc93077dbc2cac435219fc3e28799  AFTER/05-hangar-t10.png
301bfdb29c5323a9c8da4d2219f176f036c481f2079b352e2d048409664938cb  BEFORE/06-cockpit.png
18a6c4d9c483fdde3e1a752307ee410e6aa88ca29e7ec85142d99bb94b7e4bec  AFTER/06-cockpit.png
4c1c87e8f359c8d3d5f4dcdbc0b2b1fd51511559bea7474f4547d5b457bee20a  BEFORE/07-corner.png
c9cf98270ab3c867b1dea68ae95fbc172cd90c73ff51ae720ba325fbff637fe6  AFTER/07-corner.png
1918d0f702c77638859bf4b81246b6c59b257ee487d93ad5b93d0741b9363716  BEFORE/08-gallery.png
844d9ad17ce75b351b1829439da0f7f704bc63cef0f43169e0708a856f05953a  AFTER/08-gallery.png
efbe70d5d37e907d6428709b9af3e95a168f0d4bf9c2babeba14b2c40f8c1401  BEFORE/evidence.json
a29fb7594edfd7a45aa4fbb9bade5ee9af9b7bf3061237c2622bb056edff5042  AFTER/evidence.json
e5cb21bcb729fd75dbefbdefd0a3d9841ab454e76af84884e6876fac321783e2  FINAL-DIAGNOSTIC/comparison.json
```

## Historical 0d75c3f image hashes

These originals remain under `/tmp/star-agent-hangar-final-tour`. They are no longer the eight curated current repository images. The historical comparison reused the same eight BEFORE inputs listed above.

```text
5e650f8fd04e4358777499e6c99a8571279b57d45a5db24305aa18f0f07682ec  HISTORICAL-0d75c3f/01-orbit.png
4dd0ac313894057f303f85a3c2363ece221a27f639268951ef6f0ead71d6c0e9  HISTORICAL-0d75c3f/02-coast.png
cbf9c4d0e79123558fea4129ffab54fb613582ae03ec5c52eb90e1085a1c024c  HISTORICAL-0d75c3f/03-forest.png
d87b2eb4299a7a80cf0e29bb48fdbc7e0527d36c12ba6ea571c2ddc75ad68bdf  HISTORICAL-0d75c3f/04-highlands.png
8a1674baf07457d40426756c7f3b7f8dde3e575c6d94018e8dfa7843d2b19fc4  HISTORICAL-0d75c3f/05-hangar-t10.png
75296591a7dd2babd012601977ec5044fffe6a67f3307b0bce77432bad5a1357  HISTORICAL-0d75c3f/06-cockpit.png
c85137ab8ee12ba260b6e2fee72de9f718638aa657282eee0026b794b6297b9f  HISTORICAL-0d75c3f/07-corner.png
7ca8c3f0ac1a629e7877c361bb05ba3767e861d943484da323e44a32cac4c1a3  HISTORICAL-0d75c3f/08-gallery.png
271b67089f2aab0834c6b73e148e0eebe9b26b6e83113a134946c8301b815a71  HISTORICAL-0d75c3f/evidence.json
b97cbe03a613acf41cfebbdda0193969d894afa2c327b7ee37142f399a1b8dce  HISTORICAL-DIAGNOSTIC/comparison.json
```
