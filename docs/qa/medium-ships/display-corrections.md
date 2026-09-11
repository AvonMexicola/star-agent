# Medium cockpit display and collection corrections

Source checkpoint **3cf80ad**, 2026-09-08. The independent final-model game
reviews preserved in [Stratum final04](stratum-game-review-final04.md) and
[Gannet final13](gannet-game-review-final13.md) requested three corrections:

- Stratum's fully deployed physical ramp still showed CLOSED in its recovery
  beacon. The marker now reads the real medium mechanism's access status;
  legacy hulls retain their existing door fallback.
- Collection motes from accepted vehicle mining travelled to the pilot and
  obscured MFDs. A committed job's destination now controls attraction: backpack
  feedback retains its behavior, while ship/rover-bin particles stay at the cut.
  Failed or uncommitted cuts still produce no collection event.
- Medium MFDs read the old supplies-only manifest, so Gannet showed 1.0 kg after
  a real transfer produced a 1.5 kg backpack. A read-only view of the canonical
  local inventory now counts supplies, mined resources and construction goods
  once. Separate capacity limits, dedicated ore bins and SBU freight stay
  separate. The combined total has no misleading single capacity denominator.
  Main applies the adapter only to the two offline medium hulls; legacy inputs
  and multiplayer inventory paths are preserved.

The [author's exact source handoff](mfd-author-review.md) records the original
negative reproduction, four-file allowlist and tests. Root added the main wiring
and the new regression file to the existing normal test command. There are no
asset, shader, camera, navigation, collider, ledger, save or server changes in
this correction. Capture identity lists include the corrected modules; the
keyboard/controller routes and assertions are unchanged.

## Verification

- Full normal suite: **1,113 / 1,113 PASS**, zero skips/failures, 34.829 seconds,
  `/tmp/star-agent-medium-final-units-17.log`. Four new cases execute the actual
  MiningStore and MFD formatter, including later commits, construction, read-only
  behavior, power-off, server precedence and Stratum's separate ore/freight.
- Production build17: PASS, 16.73 seconds, `main-UzszgUIJ.js`. Existing bundle-size
  warning retained. Development-enabled build18: PASS, 4.99 seconds,
  `main-4jz7U8ns.js`; used for the corrected gameplay captures.
- Earlier scoped marker/medium checks: 13 PASS. Collection/energy/mining/input
  checks: 61 PASS. The actual callback/particle CPU probe keeps non-pack particles
  near the cut at large world coordinates; it is not a rendered or ledger test.
- Native UI01 failed at startup because root omitted `VITE_DEV_TOOLS=1` from
  build17: the ordinary Nomad loaded, `dev` was null and the expected Stratum
  start was unavailable. No medium gameplay was reached. Original errors,
  screenshots and video remain in `stratum-primary-final-ui01`; all application
  diagnostics were empty. Source was unchanged; build18 enables the dev launcher.

The [independent source/CPU review](mfd-independent-review.md) passes six
additional probes, 24 old/current display comparisons and ten actual main-binding
combinations. It preserves the inherited online power-off page's legacy-mass
limitation; truthful online power-off storage is outside this offline correction.

The corrected Stratum keyboard route reports **1/1 PASS**, 1.9-minute case and
2.0-minute total, at 3cf80ad/build18. `journey.json` and Playwright's final status
both report PASS, with stable source and empty page/warning/HTTP diagnostics.
The full 112.28-second VP8 and auxiliary video are finalized. The outer tool
wrapper nevertheless returned **143 after completion**, as happened in the
retained earlier Gannet touch run; the cause is not established. A clean shell
exit is not claimed. This is separate from UI01's startup configuration failure.
The [ramp marker](stratum-game-ramp-ui02.png),
[actual mining view](stratum-game-mining-ui02.png) and
[final pilot MFDs](stratum-game-pilot-ui02.png) are unaltered native screenshots.
Raw evidence remains in `stratum-primary-final-ui02/keyboard` under the local
`.medium-ships-qa` folder. The visible transfer moves 0.36739655113495173 kg basalt
into the backpack; actual serialized practice-memory revisions advance from 0 to
17. This is the committed in-memory development save, not a browser reload test.

The corrected Gannet controller route reports **1/1 PASS**, 3.6-minute case and
3.7-minute total, on the same 3cf80ad/build18. Both the npm child and outer tool
exit **0**; hashes remain stable and page/warning/HTTP diagnostics are empty.
It completes real cabin/rover boarding, elevator unloading, four-wheel terrain
contact, twin mining, inventory transfer, all five fresh-neutral gates, reverse
loading, securement, loaded flight and gear landing with the same rover.
The [inventory transfer](gannet-game-transfer-ui01.png) and
[returned pilot view](gannet-game-pilot-ui01.png) both show the backpack's new
1.6 kg total after transferring 0.6017855069500966 kg basalt, alongside
136.0 kg ship storage. The
[loaded touchdown](gannet-loaded-touchdown-ui01.png) is an unaltered native frame.
All 11 originals and finalized video remain in `gannet-controller-final-ui01`.

Both current captures use Chromium 151.0.7922.173 / AMD Radeon 860M ANGLE OpenGL,
1440×900, DPR1, 1152×720 game drawing buffer. Stratum uses native keyboard/mouse;
Gannet uses an injected standard Gamepad through the real input route.
The [Stratum pixel follow-up](stratum-game-review-ui02.md) passes **4.02/5**,
with no criterion below 3 and no waived threshold. It closes the actual deployed
marker, cockpit-bound collection motes and corrected storage readout. Nine
originals and 34 ordinary full-size video frames were inspected; the older 3.82
failure remains preserved. The [Gannet pixel follow-up](gannet-game-review-ui01.md)
passes **4.04/5**, also with no criterion below 3 or waiver. It closes the omitted
mass and sampled collection presentation after inspecting all 11 originals and
17 ordinary full-size video frames. Its older 3.86 failure remains preserved.
These are scoped game-presentation reviews; unchanged studio scores and remaining
HUD/light advisories remain separate. No physical-device, online, whole-scene
performance or FPS acceptance is implied.

## Loaded Gannet measurement scope

The [Art13 payload measurement](gannet-payload-13.md) and
[independent replay](gannet-payload-review-13.md) remain pinned to **e727d8e**.
An exact comparison at 3cf80ad confirms that 19 of their 21 source/dependency/model
inputs are unchanged. The only changed inputs are `ship-mfd.js` (display text
formatting) and `package.json` (one normal test entry). MFD canvas dimensions,
geometry/material creation, cargo assembly and all model bytes are unchanged.
`/tmp/star-agent-medium-display-payload-delta.json` retains the full before/after
hashes. The original probe was not replayed with altered pins, and its original
whole-source identity is not claimed for 3cf80ad. Its static counts and explicit
cargo-label/contact/cache limitations remain recorded for the measured version.
