# Stratum touch03: independent controls and MFD presentation review

The two targeted presentation fixes are visible in the actual 390×844 originals: the persistent landed keyboard hint no longer covers inspected MFDs, and walking controls now clear the equipment bar. Four landed native-look views expose all four physical display faces. A remaining **in-flight overlap** prevents a blanket claim that the physical MFDs stay unobstructed: the expanded flight controls cover much of the visible mining display. The redundant mining HUD keeps its key state readable, but it does not make the underlying MFD unobstructed.

This review covers root-authored `nomad-cabin-controls.js/css` and the resulting phone presentation. It excludes approval of my earlier input fixtures, mining implementation and lamp helper. No runtime edits, browser/GPU launches, new motion score, or whole-asset score were made.

## Evidence and identity

Root's frozen source is `60bdd67ffac2b9ce9afd6be011c09e666f3d8f81`, build13 `main-S4E53Kmz`. Reviewed all **13 original touch03 PNGs**, including four MFD looks, restored forward view, walking/ramp states, flight mining, inventory and final pilot view; compared the four touch02 MFD originals and its failed walking frame. Original directory: `/home/cees/projects/.medium-ships-qa/stratum-primary-touch-03/touch/`. No review image was edited or recaptured.

The completed root journey receipt is `journey.json`, SHA256 `9b91adede46f562611c379983d7807a9c86204824c6723e6420693df1c674fa8`. It reports `PASS`, stable before/after identities, Chromium151.0.7922.173, 390×844, no page errors or warnings, and no performance claim. The root log records 1/1 pass, approximately3.0 minutes test /3.1 minutes total. These are root-run functional results, not an independent re-execution or self-approval of the fixture. The reviewed camera records retain FOV66 and identical landed eye positions through all four MFD looks; only actual look orientation changes. Asset remains Stratum Art03 `22bbf0296e349e24f1a9bd636745511bf31b9291f1a305814f13d4a45cac4d08`.

| Reviewed source | SHA256 |
| --- | --- |
| `src/nomad-cabin-controls.js` | `4ef882bd89c7e61348299b5ecdcf5a017db579d6053eb380927bbca72ef6cb6b` |
| `src/nomad-cabin-controls.css` | `23e84ad3427ed4e313e50b042625c86d7889b57a50b91aba90420a4e939d3c95` |
| `src/ship-mining.css` (presentation context) | `ba92e62620f3d4662250742fe7fcdb6b1061c497bf44bb099da214da0891b547` |
| `src/ship-mfd.js` (display context) | `c35f63193b152d1c43963acb54ecca73a6466aef57dfead6884d4f2ed8deb4e4` |
| `src/main.js` (capture/state context) | `6afa49e2125ce58a7545979b2df97bc6957ce8c1d269e5ec665ef4d68c0362dc` |

## Verified closures

- In touch02, the persistent `F · LEAVE PILOT SEAT` strip lay across all four inspected screens, including the ore row. In touch03 it is absent. Flight, navigation, mining and cargo key rows and footers are exposed in their separate native-look frames. The physical forward view has no newly introduced central strut. At rest portrait crops the outer screens and overlays parts of the lower suite; I do not require all four to fit one portrait frame or confuse center projection with actual readability.
- The four inspected display centers are approximately `(189,421)`, `(207,420)`, `(204,420)` and `(206,419)` pixels. The upper status HUD ends nearY304; landed actions occupyY769..832 and the mining panelY607..756. The images, not these centers alone, establish that the inspected faces are clear.
- Landed `Launch`, `Leave pilot seat` and `Commands` remain visible separate buttons. Source retains44px minimum button height, actual navigation action handlers and mode/power-dependent labels. The coarse-pointer rule suppresses the duplicate landed `flight-state` strip only when the landed medium controls are visible; walking/flight state is not globally removed.
- Touch02's walking Commands button sat underneath the equipment bar. Touch03's ramp/terrain images show all four arrows, the contextual action and Commands above the bar. The new walk-only bottom88px rule supplies this clearance. The script still updates the medium class from actual ship identity and mode, so this is not an unconditional style change to every ship.
- The actual inventory frame keeps Resume, storage tabs, both visible pagination rows and item/result information within the phone. It is a visible UI result, not a new audit of ledger semantics or persistence authority.

## Remaining findings, ranked

1. **Physical mining MFD overlap in flight.** In `04-native-twin-cutters.png` and `07-final-pilot-ore-status.png`, the expanded flight controls occupy `[204,520]..[378,832]`. The visible MFD3 center is approximately`(354,665)`, inside this area, and the images show its rows behind the arrows, vertical controls and actions. The left mining panel still displays charge, ore and active/stopped state; the target remains visible and the root journey completes. Those facts support usable controls, not an unobstructed physical MFD while flying. A future presentation closure should reserve readable physical-screen space or provide an explicit inspection state while keeping real flight controls available. Do not carry the landed-look result into an all-mode MFD claim.
2. **Clipped on-foot instruction strip.** `02-actual-terrain-ramp-view.png` retains a long single-line instruction crossing the center and clipped at both viewport edges. It also appears in touch02. The separate contextual action is readable, so this did not block the recorded route; the instruction should wrap within the phone or use concise touch wording.
3. **Keyboard wording remains on phone.** The early touchdown and pilot-return toasts still instruct `F`, `P` and `B`; the inventory footer shows controller navigation legends. Actual touch buttons are present and the messages are transient, but their wording is inconsistent with the active input. The fixed persistent hint must not be described as complete removal of every keyboard hint.

## Limits

This is a static original-image and source review at one portrait resolution. I did not certify physical touchscreen ergonomics, landscape/tablet layouts, accessible text scaling, all unavailable states, video motion, other ships or GPU/FPS performance. The root-run journey and its accepted practice-memory serialized commits are separate evidence; they do not establish browser-localStorage or dev-flight reload persistence. Existing Stratum art findings remain unchanged.

The exact image hashes, camera/HUD records, source identities and root renderer fields are retained in `/tmp/star-agent-stratum-touch-presentation-review-03/evidence.json`. No overall art score or full phone-presentation approval is issued. The targeted landed-MFD and walking-button closures pass; the in-flight overlap and minor copy/layout issues remain explicit.
