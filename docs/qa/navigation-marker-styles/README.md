# Navigation marker types — 9 September 2026

The focused HUD markers now have a small shape/color distinction:

| Type | Symbol | Color |
| --- | --- | --- |
| Next objective | Dotted diamond | Existing amber |
| Selected POI | Location pin | Soft white |
| Ship | Hull outline | Existing mint |
| Ground vehicle | Rover outline | Pale blue |

Off-screen markers retain a tiny type icon in the label alongside the directional
arrow. Selection adds a thin outline without replacing the marker's type color;
the aimed drive ring uses the same color. No added HUD text, animation, marker
eligibility change, input binding, dependency or movement change.

This is a presentation follow-up to SA-NAV-002, based on local70a2db5 with the
checked planetary drive changes retained. The source changes are limited to
marker JS/CSS and the fixed SVG helper. The existing browser fixture accepts
separate evidence paths so earlier screenshots and failure records survive.

Before references: [POI/objective](../focused-location-arrows/phone-objective-and-poi.png)
and [ship/rover](../focused-location-arrows/parked-burrow-and-ship.png).

Validation passes: existing navigation/marker source tests, development production
build (`main-BAMd9Vr4.js`, existing chunk-size advisory), repository and whitespace
checks. The unchanged two-case marker journey passes in3.3minutes using
Chromium151 / AMD Radeon860M / ANGLE OpenGL ES3.2 and one worker. It covers the
complete injected-controller POI/patrol selection, switching, clearing and return
route, saved-filter reload, keyboard Burrow exit and both parked rover types.
Both cases report zero page/console errors. No physical-device or independent
acceptance claim. Full originals and video: `/tmp/star-agent-marker-styles`.

Inspected captures: [desktop POI and objective](objective-and-selected-poi.png),
[phone shapes and off-screen POI badge](phone-objective-and-poi.png),
[mint ship badge](driving-ship-bearing.png), and [blue rover badge](parked-burrow-and-ship.png).
At the sampled parked pose the ship label falls beneath the existing loadout bar;
the driving capture shows it unobstructed. Marker positions are unchanged.

Local integration: runtime `c7adec1` fast-forwarded into `dev/all-features`,
preserving all533,066bytes of the unrelated HANDOFF journal and the checked
planetary-drive source. All five runtime files match the tested source and are
served on5178; both5178/8087 API health checks pass. No service/database restart
or public deployment was needed.
