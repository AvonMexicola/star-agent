# Retail motion evidence

**Recorded interaction journey passed on `29885c9`; bounded motion evidence inspected.** This is author-produced evidence, not an independent visual score. It does not clear the known poster/mounting-tile shadow banding in that candidate. The later `025e587` changes spotlight shadow bias/resolution; this recording is not a capture of that later lighting revision.

The preceding [Astra review](station-shop-branding-astra-review.md) scored motion 3 because evidence was limited, without identifying a motion defect. This record adds consecutive presentation samples and retains their source video. It does not claim a complete frontal elevator-door review or absence of flicker between samples.

## Identity and verified environment

| Field | Recorded value |
| --- | --- |
| Runtime | `29885c90d4a431f139dd4e0844e81dc5d1ae7d7f` |
| Production preview | `http://127.0.0.1:5260` |
| Bundle | `index-BJaVs6Cv.js` |
| Bundle SHA256, lead-provided immutable identity | `e0a95c936d4c421e3deee8e51b1fa506255de0f9931c984398048c58b8267c49` |
| Concourse GLB SHA256, lead-provided identity | `953054d5cf34e246b4a0e3b43c5181d3e64e5ff5c4cbb18c44fa53e064975378` |
| Test start | 2026-09-06 18:47:09.276 UTC |
| Browser | Chromium 151.0.7922.173, Arch Linux; Playwright 1.63.0 |
| Actual renderer attachment | ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2) |
| Actual WebGL | WebGL 2.0 (OpenGL ES 3.0 Chromium) |
| Actual viewport / drawing buffer / render scale | 1440×900 / 1440×900 / 1 |
| Test result | One desktop journey passed, 48.6 s test, 54.9 s command; exit 0 |
| Source video | VP8 WebM, 1440×900, YUV420p, nominal 25 fps, 45.08 s, 5,351,639 bytes |
| Video SHA256 | `af29f8ee0eaeb4af02f7ad14645d0348cf3014a46e094155ffaad36b1ef589f8` |

The video is `/tmp/star-agent-shop-motion/raw/station-shop-walk-through--97abd-r-transfer-cargo-and-reload/video.webm`. The sibling `trace.zip` and `shop-controller-desktop.png` retain trace actions and full-resolution purchase feedback. `/tmp/star-agent-shop-motion/results.json` retains the result, environment attachment and physical stopping diagnostics; decoded attachments are also stored beside it. These temporary artifacts must be retained separately if long-term video review is required; they are not committed assets.

The first attempt failed before opening a game page because Playwright's FFmpeg helper was absent. Its installation awaited approval, then `npx playwright install ffmpeg` succeeded. That setup failure was not a game defect. Recording began only after the lead released the GPU lane; the lane was returned immediately upon completion. Frame extraction subsequently used CPU FFmpeg with one codec thread.

## What the journey establishes

The existing `scripts/station-shop.spec.js` desktop test walks through passenger transit to the armory, buys with a controller, returns, transfers cargo and reloads. Assertions passed for physical waypoint reach, elevator state, hub/berth arrival, controller focus/purchase/close, unchanged player position under modal movement input, unchanged parked ship position, 1,150 remaining credits, one delivered sidearm, warehouse-to-ship transfer and persistence after reload. The test's monitored page and THREE/WebGL/shader error list remained empty; this is not a blanket assertion about all console warnings.

Walking uses real W input and collision, then waits for natural velocity decay below .01 m/s before turning. Nine stop diagnostics measured .2263–.2769 m of coasting after release. No position or velocity override occurs inside those walking legs.

Setup deliberately docks the ship and places the player in a clear side aisle. It does not prove physical ship-ramp boarding. `walkTo` calls `orientToward` between legs, causing intentional instantaneous camera-heading changes. The sharp turn at approximately 13.1 s before cabin entry, 21.4 s toward the armory and 24.7 s toward the return route are fixture behavior, not evidence of camera continuity or runtime snapping bugs.

Passenger transit is the existing explicit destination transfer with a fade. It is not a physically traveling elevator between floors. The recording does not establish combat, equipping, installed component effects, multiplayer, mobile motion, free camera movement, all lighting conditions or stable frame cost.

## Consecutive sample ledger

All timestamps below are **video-relative presentation times**, established from decoded images. They are not Playwright trace monotonic timestamps. Each linked sheet contains 20 consecutive 0.1 s samples, read left to right then top to bottom. All ten sheets were visually inspected. Windows deliberately overlap at the cabin-to-transit boundary; 200 extracted samples therefore do not mean 20 unique seconds of coverage.

| Window | Samples and contact sheets | Observation and limit |
| --- | --- | --- |
| 6.0–7.9 s: hangar approach | 20, [walking](station-shop-motion/walking-contact-01.webp) | Terminal, deck joints and service wall enlarge continuously during this straight input-driven leg; no sampled position jump. This covers two seconds of the longer approach. |
| 11.0–14.9 s: elevator area and physical entry | 40, [11.0–12.9](station-shop-motion/elevator-entry-contact-01.webp), [13.0–14.9](station-shop-motion/elevator-entry-contact-02.webp) | Player settles beside the elevator; after the deliberate heading snap, cabin rails and rear wall approach continuously as the player walks inside. Opening is mostly at the right frame edge while the camera faces sideways. The assertion waits for complete opening, but these images do **not** provide a complete frontal view of both moving leaves. |
| 14.0–17.9 s: hub departure/arrival | 40, [14.0–15.9](station-shop-motion/hub-transit-contact-01.webp), [16.0–17.9](station-shop-motion/hub-transit-contact-02.webp) | Cabin darkens at roughly 14.7–15.0; transit overlay holds, then hub emerges around 16.6–16.8 and walking resumes. No exposed world-position jump in the sampled fade. The quick destination-menu click is not resolved at 10 Hz in this outbound window. |
| 21.0–24.9 s: armory approach and purchase | 40, [21.0–22.9](station-shop-motion/shop-purchase-contact-01.webp), [23.0–24.9](station-shop-motion/shop-purchase-contact-02.webp) | Following the fixture turn, stock/counter approach continuously. Modal at 24.3 shows 1,500 credits; 24.4 shows 1,150 and delivery feedback; 24.5 returns to the same counter view. Automated purchase is very brief: controller focus and input blocking are established by assertions/trace, not by reading every state in these thumbnails. Known shadow banding remains visible on this older candidate. |
| 31.0–34.9 s: return destination and berth arrival | 40, [31.0–32.9](station-shop-motion/return-transit-contact-01.webp), [33.0–34.9](station-shop-motion/return-transit-contact-02.webp) | Destination modal appears at 31.7; cabin fades at 31.8–32.2, transit overlay holds, berth appears around 33.6–33.8 and physical walking resumes. No sampled unmasked teleport. |
| 37.0–38.9 s: cargo terminal and reload | 20, [cargo/reload](station-shop-motion/cargo-reload-contact-01.webp) | Walking slows by the terminal, cargo modal appears at 38.3, deliberate page reload starts at 38.4. Transfer and persistence passed assertions; the brief modal does not visually resolve the whole transfer transaction. Reload is a fixture action, not a runtime crash. |

The source video retains intervals omitted from the bounded sheets, including startup, additional approach/return walking and the rest of reload. The full physical journey passed, but the contact sheets are a selective temporal audit. No frontal door follow-up was run in this task.

## Reproduction and evidence limits

The original run used `/tmp/star-agent-shop-motion.config.mjs`. Its portable equivalent, [`scripts/station-shop-motion.config.mjs`](../../scripts/station-shop-motion.config.mjs), imports `scripts/concourse.config.js`, selects only the desktop journey, uses one worker, no retries, no web-server rebuild, viewport 1440×900, `video: {mode: 'on', size: {width: 1440, height: 900}}`, `trace: 'on'`, and `STATION_MOTION_RENDER_SCALE=1`. Hardware flags are `--use-gl=angle --enable-gpu --ignore-gpu-blocklist --use-angle=gl`; the renderer attachment above verifies the backend actually used.

```sh
npm run test:browser -- -c scripts/station-shop-motion.config.mjs
python3 scripts/station-motion-extract.py --video /tmp/star-agent-shop-motion/raw/station-shop-walk-through--97abd-r-transfer-cargo-and-reload/video.webm --start 14 --seconds 4 --name hub-transit
```

The preserved [`scripts/station-motion-extract.py`](../../scripts/station-motion-extract.py) is the portable equivalent of the temporary extraction helper. It requires Python 3, FFmpeg/FFprobe, ImageMagick and fontconfig (or an explicit `--font`). The portable config/helper received syntax checks; the recorded execution used their temporary equivalents. The extraction script uses FFmpeg `fps=10,showinfo`, retaining full-resolution sampled PNGs, command, FFprobe metadata and frame log under `/tmp/star-agent-shop-motion/windows/NAME/`. ImageMagick assembles labeled thumbnails without semantic edits. Curated sheets are resized 360×225 thumbnails encoded as WebP quality 90 at unchanged sheet dimensions for a smaller review artifact; the original lossless PNG sheets remain under `/tmp`. Source video is already compressed, and thumbnail resampling/WebP encoding lose fine detail. No brightness, color or content correction was applied. The source WebM remains unchanged.

Nominal 25 fps recording and 10 Hz extraction are presentation cadences, not measurements of original game rendering frequency. Repeated video frames can reflect recording behavior. Brief UI states can fall between selected samples; sub-sample flicker is untested. Trace times and video times have different origins and were not equated. This evidence supports the bounded continuity observations above; it cannot certify every frame or establish performance. The later lighting-only candidate `025e587` uses bundle `index-mk6QIuGf.js` SHA256 `bde5924fa0c3bacbe03f03a87ea2946e0ff4583c207fa50a7c81f8b27dcec0e7` per the integration lead and needs its own lighting evidence.

The portable config defaults to a timestamped `/tmp/star-agent-shop-motion-*` output directory to prevent later runs overwriting evidence; `STATION_MOTION_OUTPUT` can select an explicit run directory. The extractor refuses an existing window directory, so choose a new `--out` or `--name` for a repeated extraction. The original recorded temporary config used the fixed paths listed above.
