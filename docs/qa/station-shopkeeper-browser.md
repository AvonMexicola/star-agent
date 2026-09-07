# Watchkeep and Kestrel merchant browser verification

**Full controller journey PASS: 1/1 in 3.1 minutes.** Astra independently reviewed the two merchants’ final studio images, actual game captures and bounded video frame sequences. The desktop merchant integration meets the scoped visual bar below; mobile actor visibility and broad station performance are not accepted by this review. Delivery remains pending the steward; this record does not claim integration or deployment.

## Exact final candidate and result

- Runtime commit: `35a7a93a8b036b40f5d5cf30dbb8851ecec2e9d5`; only documented test-entry/auth/menu-selector corrections followed in the QA fixture.
- Production preview: `http://127.0.0.1:5572`, built with `VITE_DEV_TOOLS=1`; `main-Dzobk9le.js` SHA-256 `4545412dbb966737f63e1071b75851e4f53ff877feea0433aaef45e9ae8db021`.
- Female: `808768844ffdc754d04d5017d2a03908f0055ff5e74544624189e12712580914`, 1,898,288 bytes.
- Male: `8f5052adf0b6d32c26e41d3cf379cb595b18b064f5af2dc6a68a7a2ace579537`, 1,579,416 bytes.
- Final receipt: `test-results/shopkeeper-evidence/1788815649310-0/report.json`, SHA-256 `b39a1da104230ab93d5169327b1cb544afe33f6afee313cf05391c782ebdf529`. **Errors [], warnings [].** Node emitted only the runner’s NO_COLOR/FORCE_COLOR warning outside the page.

The actual controller route leaves the Nomad chair, opens the hatch, walks down the ramp and around the side aisle, enters the station lift and selects Central hub, reaches Watchkeep then Kestrel, and returns through the lift toward the ship in its hangar. No pose setter or debug teleport supplies this journey. Each actor runs through all four supplied idle names and four natural transitions back to the starting clip, independently: female transitions1→5, male21→25. Confirm held down buys exactly one sidearm for350CR and one repair kit for120CR, delivered to the real station inventory; credits1500→1150→1030. Position, credits and fire remain protected across held input, modal close, actual tab focus recovery and device disconnect/reconnect until neutral. The current gameplay menu opens and closes via Menu/B. Both animation clocks pause for the equipment modal and both actors hide on hangar return.

Only GET `/api/auth/session` is intercepted with the canonical offline `{account:null}` response. Authentication/backend correctness, multiplayer authority and real hardware controller behavior are outside this check. No economy, interaction or movement response is mocked. The parent reports855 unit tests and actual Three skin/pose/cycle checks passing separately; these are parent-run, not this reviewer’s executions.

## Actual scene observations and limits

Chromium151.0.7922.173, AMD Radeon860M/radeonsi krackan1 ACO, ANGLE OpenGL ES3.2. Every final captured viewport used render scale1 and matching drawing-buffer dimensions: desktop1440×900 and resized390×844, DPR1. The earlier failed developer-enabled run auto-scaled merchant views to.8/1152×720; those historical captures must not be confused with the final scale1 set.

| Final view | Draw calls | Triangles |
| --- | ---: | ---: |
| Initial docked hangar | 560 | 841,366 |
| Watchkeep customer view | 418 | 896,664 |
| Kestrel customer view | 318 | 798,242 |
| Watchkeep / Kestrel phone view | 271 / 271 | 736,376 / 732,810 |
| Open purchase dialogs | 0 | 0 |
| Returned hangar, actors hidden | 631 | 883,344 |

These are current renderer counters at named views, not timing distributions, incremental actor costs or an FPS claim. Returned hangar631 draws exceeds the600 target in an inherited scene with both actors hidden. No broad station performance acceptance is granted. Fresh host inventory was clear before each NPC launch; HUB’s final short native capture log completed21:13:59.345UTC before final NPC start21:14:07UTC. No concurrent HUB browser was established in the subsequent full process check. Ordinary user desktop/GPU activity was preserved and uncontrolled. GPU was explicitly released after the final job exited.

## Independent scoped visual rubric

Reviewer: Astra, independent of the merchant model exporters and runtime author; author of this controller harness. Scores apply to the **visible desktop customer-side merchant presentation**, using final assets above. Historical original-arm scores do not override Cees’s rejection of those exports.

| Criterion | Score | Observed evidence |
| --- | ---: | --- |
| Silhouette and scale | 4 | Both read as adult merchants behind the respective counters. Corrected arms hang beside the body; original pinched/backward resting stance is resolved. Counter height and supplied adult scale are plausible from the reached camera. |
| Materials and detail | 4 | Actual shop light separates face/hair, cloth, gloves and utility hardware more effectively than the flat studio treatment. Faces and equipment remain readable at use distance; soft maps remain a polish limit. |
| Lighting and integration | 4 | Faces/torso respond to existing overhead shop lights and fit the lit alcoves. No obvious upper-body clipping in viewed resting/raised poses. The counter hides feet, so floor contact is not independently certified from this route. |
| Cohesion | 4 | Watchkeep’s utility/security outfit and Kestrel’s teal/orange mechanic fit the existing manufacturer shops without replacing their signage or interface language. |
| Information or physical function | 4 | Controller reach, correct shop identification, finite purchases, warehouse/credit deltas, pause and neutral-input gates all work in the complete route. Purchase UI fits both captured widths. |
| Motion | 4 | All eight real clips advance independently; sampled video windows show coherent weight shifts, female greeting and male overhead stretch returning to relaxed poses without a visible gross articulation break. Score is bounded to these visible sequences, not every frame or occluded feet. |

**Mean4.0/5, no item below3, for that desktop presentation scope.** No new blocking merchant placement/shoulder defect was found. The narrower still/motion evidence does not certify all possible camera angles, frame-level flicker, staff-side collision during every gesture, mobile actor visibility, native touch or full station performance.

Ranked remaining findings/limitations:

1. **Inherited phone HUD obstruction:** with the existing mining tool equipped, its large panel covers the merchant’s head at390×844; the raw `weapons-mobile.png` demonstrates this. Those images do not establish a clear mobile character presentation. A later holstered-controller view or HUD layout correction can resolve that evidence gap; no such extra GPU run is claimed here.
2. **Inherited scene/UI limits:**631 returned-hangar draws exceed target; navigation labels and the held tool overlap parts of the customer view, and bright equipment highlights can bloom. These were not introduced or fixed by the merchant integration.
3. **Asset polish:** female glove asymmetry and generally soft material detail remain visible. No gross sleeve tearing, collapsed shoulders or obvious torso penetration was established in the sampled corrected poses.

## Curated evidence and motion source

Eight ordinary WebP92 conversions preserve the captured framing/colors; no generated art, retouching or scene adjustment:

- [Watchkeep resting view](station-shopkeeper/weapons-idle-desktop.webp)
- [Kestrel resting view](station-shopkeeper/equipment-cycle-1-idle-11-desktop.webp)
- [Kestrel raised gesture](station-shopkeeper/equipment-idle-desktop.webp)
- [Watchkeep purchase desktop](station-shopkeeper/purchase-desktop.webp) and [phone](station-shopkeeper/purchase-mobile.webp)
- [Kestrel purchase desktop](station-shopkeeper/equipment-purchase-desktop.webp) and [phone](station-shopkeeper/equipment-purchase-mobile.webp)
- [Physical hangar return](station-shopkeeper/returned-hangar.webp)

The184.16-second continuous source recording is `test-results/shopkeeper-browser-1788815649079/shopkeeper-controller-phys-cecf7-idles-purchases-and-returns/video.webm`, SHA-256 `0f08d716bca1e6cb8471dc67207ab1c5a30c39c3946c689cdd94b612c75af356`. `video-1.webm` is the1-second auxiliary focus tab, not the journey. Astra inspected four sequential contact sheets extracted from the main recording: female90–95.5s and100–105.5s, male143–148.5s and149–154.5s, each12frames at2fps in chronological row order. These demonstrate selected gesture/transition progress, not full-rate viewing. Original video, PNGs, receipts and contact sheets remain ignored local evidence. Frame extraction was CPU-only after GPU release:

```sh
ffmpeg -v error -threads 2 -ss 90 -i VIDEO.webm -vf 'fps=2,scale=480:300,tile=4x3' -frames:v 1 -filter_threads 1 SHEET.png
```

Reproduce the single route against the parent-built developer-enabled preview with the command in the historical fixture notes below, using a unique output directory. The final syntax and whitespace checks pass. No further GPU job is planned for this task.

## Historical preparation, rejections and failed trials

Everything below is retained chronology. Statements such as “pending,” “no browser yet,” or old candidate hashes describe the earlier stage only; the final result above supersedes them. Original pose rejections and failed trials remain evidence and are not erased.

Status: HOLD — user rejected both merchants’ resting arm/shoulder poses; corrected exports and a new frozen build are required. No browser execution is authorized on the old 5572 candidate. Reviewer: Astra, independently of the character exporter and merchant runtime author. No browser or GPU job was launched during preparation.

The isolated production target is `http://127.0.0.1:5572`. The parent owns its frozen build and asset identities. Run only after ROOT READY and acquisition of the shared GPU lane:

```sh
TMPDIR=/home/cees/projects/star-agent/test-results/npc-tmp PWTEST_CACHE_DIR=/home/cees/projects/star-agent/test-results/npc-tmp npm run test:browser -- -c scripts/shopkeeper.config.js
```

The fixture starts the supported developer Nomad hangar entry. Thereafter it injects a standard Gamepad and uses only its axes/buttons for standing, hatch interaction, walking down the ramp, following the hangar side aisle, calling and entering the lift, selecting Central hub, approaching Watchkeep, buying a sidearm, crossing the central aisle to Kestrel Shipworks, buying a repair kit, closing dialogs and returning toward the parked ship. Runtime positions are read to calculate steering; no pose, inventory, localStorage or debug-action writes are used. This is injected controller coverage, not a physical device test.

The planned assertions distinguish merchant load/visibility and each merchant’s four supplied idle names through separate natural full cycles (at least four transitions and return to the starting clip per merchant) from the economy transaction. A held confirm must purchase exactly one sidearm for 350 credits into the warehouse at Watchkeep, and one repair kit for 120 credits at Kestrel. The prior sidearm count must survive the second transaction. Held movement/fire must remain suppressed through the shop close and tab focus recovery until neutral input. The controller menu is opened and closed through the same pad. Both merchant clocks must remain frozen while the equipment purchase dialog is open; the female alias clock is also checked during the armory purchase. Ship position must remain unchanged and both merchants must become hidden after returning to the hangar.

Screenshots cover both physically reached merchants and their purchase UIs at 1440×900 and 390×844. The latter is a resized desktop browser, not native mobile or touch journey evidence. Each incoming idle is captured after its normal crossfade completes, without animation seeking or a clock override. Per-capture scene metrics record current renderer draw calls, triangles, rendered frame counter, viewport, drawing buffer and render scale; these are scoped scene snapshots, not timings or an FPS claim. Modal counters can describe the retained last frame and are labeled with modal state. Full-route video is retained by Playwright; phase screenshots alone will not establish animation quality. Each run gets a unique `test-results/shopkeeper-evidence/<timestamp>-<worker>` directory by default, with state steps, page/console/HTTP errors, warnings, actual backend, viewport, drawing buffer, render scale and loaded script URLs in `report.json`. Override the receipt directory with `SHOPKEEPER_QA_OUT` only when it is unique. Large generated reports and recordings remain ignored.

Pending: exact frozen commit/bundle/GLB hashes, actual route result, warning review, independent inspection of game captures and continuous idle transitions, renderer cost evidence if supplied separately. No frame-rate, hardware-controller, touch, full station or final art acceptance is claimed by the prepared fixture.

The snapshot contract is `station.shopkeepers.weapons` and `.equipment`, with the female `station.shopkeeper` alias retained. Watchkeep expects `idle-04/06/07/15`; Kestrel expects `idle-02/03/11/12`. Individual transition waits are bounded at 60 seconds pending final male clip durations; the single route has a 12-minute ceiling. No additional browser worker or parallel GPU session is introduced.

## Preflight independent review, 2026-09-07

Astra inspected `src/station-shopkeeper.js`, its station-complex integration and the focused lifecycle/collision tests. No concrete blocking code defect was identified in this read: actors have separate mixers/load promises, load only for the occupied hub, retain their own materials, freeze on pause/focus/hidden state, use hub-local transforms and mirrored torso colliders, and dispose owned skeletons/geometry/materials/textures including late loads. Failed optional assets do not retry every frame. This is static review, not proof of working shadows, clearance during every gesture or rendered animation.

Female studio export: SHA-256 `6360429f81004eb9bb5a93626a71ceb55679e5a5aa29f28a188b411ccaefce09`, 1,752,664 bytes, 19,700 triangles. Read the final `assets/characters/watchkeep-shopkeeper/review/receipt.json` and personally inspected its seven views: front/back oblique, face detail and all four idle-midpoint images. Also inspected `source/inspection-front-oblique.png` as an unmatched reference; its different lighting/orientation/emission prevents a controlled material before/after claim.

Scoped findings: silhouette/identity **4/5**, materials/detail **3/5**. The adult proportions, face, auburn hair, goggles, utility vest and holster remain recognizable. Four midpoint poses show no gross skin tearing or collapsed limbs. The matte treatment is readable but makes goggles, armor and fabric similarly chalky; close inspection shows small dark triangular vest marks near the collar/badge, without sufficient evidence to identify actual holes. One boot lifts during idle-07 while the other supports the pose; natural motion and ground contact still require the game recording. These two scores are partial studio judgments, not a passing full rubric or game acceptance. No demonstrated blocking export defect was found in these images.

Male supplied durations are 2.366667, 5.366667, 1.933333 and 6.033333 seconds; its runtime crossfade is approximately .644444 seconds. The 60-second transition wait remains a failure ceiling, not an intended artificial playback delay. External `TMPDIR` and `PWTEST_CACHE_DIR` must be set before starting npm/Playwright because the transform cache can initialize before config evaluation. Config also sets the same short project temporary directory for Chromium; this is not sufficient alone for the transform cache. No browser has yet been launched for this task.

Male preflight: independently hashed `public/models/characters/kestrel-shopkeeper.glb` as `cb6238203ea14e55789ece92d912af04a087bf546960ab540e8597b366fb1e97` (author reports 1,511,512 bytes / 19,699 triangles). Personally inspected front/back oblique, face detail and `idle-02/03/11/12-mid.webp`, plus the raw-material source-oblique reference. The final image receipt was not yet present at inspection; author freeze must establish image/export provenance before final acceptance. Silhouette/identity **4/5**, materials/detail **3/5**, both scoped studio scores. Silver hair/beard, eyepiece, broad adult proportions, teal/orange suit and tool pockets remain coherent. No gross skin tearing or collapsed limbs appears in the four midpoint poses. Uniform matte response reduces hard/soft material separation; equipment and clothing folds are still readable. The raised-arm idle-03 needs actual overhead clearance and the close crossed-foot idle-12 needs continuous transition inspection. Neither is a demonstrated static blocker. Game lighting, all eight live idles and controller access remain untested.

## User pose rejection and superseded candidates — 2026-09-07 20:15:50 UTC

Cees rejected the resting shoulder/arm posture: upper arms extend backwards/outwards with pinched shoulders instead of hanging naturally. This supersedes female `6360429f81004eb9bb5a93626a71ceb55679e5a5aa29f28a188b411ccaefce09` and male `cb6238203ea14e55789ece92d912af04a087bf546960ab540e8597b366fb1e97` for acceptance, regardless of the earlier limited studio scores. Those scores and observations remain historical; they do not override the user’s rejection. Reported original upper-arm retraction is approximately 30 degrees female and 16–35 degrees male.

The authors are correcting derived animation rotation tracks in Blender under the user’s explicit instruction. Original downloaded sources remain preserved; earlier claims of unchanged animation rotation buffers apply only to the superseded exports. Upcoming review will compare relaxed baseline before/after poses and sampled/continuous motion, focusing on shoulder retraction, upper-arm hang, elbow position, hand clearance and torso intersections.

Astra released the queued NPC GPU reservation in the shared HANDOFF. No NPC browser was launched. The existing input fixture remains prepared, but the old preview must not be exercised for acceptance. Resume only after corrected assets, new ROOT READY and a newly coordinated GPU slot.

Corrected male preview `599a721077e7f07b8552234e6df0d630e2ad9864165e1f471fa560aa54f83fd3`: independently hashed the GLB and inspected only the refreshed front/back oblique images. The other five views were still stale at this review. The user-targeted shoulder/arm correction is visible: upper arms descend beside the torso instead of being held backwards/outwards, with continuous sleeve volume and less shoulder retraction. Scoped resting shoulder/arm pose **4/5**, provisional on these two stills. Hands remain flat/pronated in front of the thighs; a small inward-facing wrist/forearm relaxation is optional polish subject to cuff/hip clearance. No new finger rig is called for. This does not establish four-clip continuity, final export acceptance or game behavior, and does not restore the released GPU reservation.

Male wrist correction preview `585800d3202b1b3f6d501b928cceef32fa0d55cce3748c8594bac4dec16149d7`: GLB hash independently verified; only refreshed front/back oblique views inspected. Palms now face inward alongside the thighs, resolving the conspicuous flat/pronated presentation of the preceding preview. Resting shoulders/arms retain the improved downward hang. No visible cuff tear or obvious hand/hip penetration appears in these two views. Scoped resting pose remains **4/5**; complete corrected idle set and in-game transitions remain pending.

The prepared controller fixture now disconnects and reconnects the injected device while movement, fire and confirm remain held after shop close. It asserts unchanged position/credits and unarmed state on disconnect and reconnect, unchanged purchased stock count and weapon-shot count, and no mining beam; only neutral input may rearm. These are pending browser assertions, not claimed test results.

Corrected female `808768844ffdc754d04d5017d2a03908f0055ff5e74544624189e12712580914` (receipt: 1,898,288 bytes): GLB independently hashed; all seven refreshed studios personally inspected after the final receipt appeared. The corrected shoulders and upper arms hang downward with less retraction, and sleeve/vest volumes remain coherent across the four midpoint samples. Idle-15 retains the expressive raised-hand gesture. Scoped shoulder/arm pose **4/5**. The left glove remains more broad-face-visible/outward than the opposite glove near the holster; this asymmetry was sent to the author for interpretation rather than labeled a mesh defect. No gross cuff tear, collapsed shoulder or demonstrated torso penetration was identified in these views. Small hand/holster clearances, foot-lift transitions and the four crossfades still require actual game motion inspection. This corrected studio finding does not authorize a browser launch before new ROOT READY or substitute for user acceptance.

Final male studio review: independently hashed `8f5052adf0b6d32c26e41d3cf379cb595b18b064f5af2dc6a68a7a2ace579537`; all seven current views and the controlled `before-resting-front-oblique.webp` were personally inspected. Compared with the visibly backward/outward original stance, upper arms now rest downward beside the torso with inward-facing palms. Sleeve volume and the raised-arm idle-03 gesture remain coherent; no gross skin tearing or hand/torso penetration is demonstrated by the sampled views. Scoped corrected resting pose **4/5**; material/detail remains the earlier limited **3/5** judgment. The narrow stance during idle-12 and all crossfades still need live review. Root released final female80876884 and male8f5052ad with rebuilt preview5572/main-CdqmaDBv.js. NPC re-requested the shared GPU lane behind PUBLIC and earlier HUB on 2026-09-07; no browser had launched at this update.

First browser attempt on35a7a93/main-CdqmaDBv.js failed after1.2minutes before reaching the station. The build ignored the developer hangar parameters (`state.dev:null`, initial flight mode, station approximately2777km away), so the physical ramp exit entered EVA. `src/main.js` requires `VITE_DEV_TOOLS=1` for this supported entry. Additionally `/api/auth/session` returned HTTP500 and a console resource error. Receipt `test-results/shopkeeper-evidence/1788814922850-0/report.json`, screenshots and Playwright video/trace are preserved; the mislabeled `hangar-start.png` actually shows the orbital title view. Neither merchant loaded, so this does not establish a merchant rendering defect or pass. Actual Chromium backend was AMD860M/ANGLE GLES3.2,1440×900 viewport and buffer,scale1. Added explicit developer-entry/docked assertions for a corrected parent-built preview. No navigation setter or debug teleport was substituted.

Corrected retry preparation: parent authorizes intercepting only read-only GET `/api/auth/session` with canonical `{account:null}`, HTTP200/application-json, to isolate optional authentication in this offline presentation journey. No shop/inventory/action/pose request is mocked, and this check does not validate the auth backend. The initial real HTTP500 remains recorded. Playwright output directories now include a timestamp so retries preserve prior video/trace/failure artifacts. Parent rebuilds the preview with `VITE_DEV_TOOLS=1`; fresh bundle identity is required before retry.

Developer-enabled retry on main-Dzobk9le.js reached Watchkeep physically and passed all four natural female idles,350CR sidearm purchase, warehouse delivery, held confirm/close, actual focus recovery and disconnect/reconnect guards, with no page/console/HTTP errors or warnings. It stopped4.9minutes into the journey because the fixture expected legacy `#controller-menu`; actual Menu opened the current Contracts gameplay screen with visible tabs and Resume. Corrected the assertion to the active `.gameplay-screen`, retaining the same real Menu/B inputs. Male purchase and return were not reached. Evidence directory `test-results/shopkeeper-evidence/1788815210989-0`; video/trace retained in `test-results/shopkeeper-browser-1788815210746`. This was a fixture selector failure, not a missing in-game menu.
