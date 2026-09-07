# Controller building radial

Base: `43b4c6e`, PR41, `/tmp/star-agent-base-work`. The eight existing building
pieces now use a stable clockwise wheel: foundation, wall, doorway, window,
floor/roof, stairs, storage, mainframe. Original SVG line icons and sectors use
existing CSS tokens; no generated bitmap or new game mesh is involved.

Menu → Build enters the wheel; X reopens it during placement. Point the left
stick and press A to choose. Neutral stick retains selection. B closes without
choosing or placing. D-pad keeps ordinary focus browsing through pieces and tabs;
keyboard Tab/Enter, native pointer/touch buttons and recipes/sandbox supplies use
the same dialog. Placement still needs a separate RT edge after neutral input.

`GamepadInput` exposes already-deadzoned `ui.stickX/stickY` separately from the
combined D-pad/left-stick navigation vector. There is no second poll. The shared
router accepts an optional `dialog.controllerNavigation(ui)` target, then owns
focus, A activation and B/Menu cancellation as before. Ordinary dialogs keep
linear navigation and right-stick scrolling. Angular hysteresis suppresses
boundary jitter; magnitude below .35 keeps the last selection. This is selection
only, never release-to-build.

Verification: full unit suite 543/543 pass (24.54 s); focused radial/gamepad/build
input 16/16 pass. Initial UI browser suite 7/7 pass (14.7 s): eight directions,
neutral retention, 390px bounds and >=44px hit targets, confirmation/cancel,
focus loss, held confirmation, disconnect/replacement, keyboard/touch, recipes
and held RT through dialog transitions. Fixture now passes actual `nav.focused`
into the shared poll, matching production. Physical Xbox remains untested.

Visual inspection of the initial desktop/phone captures found the generic square
controller outline obscuring the highlighted wedge. It is replaced by a thicker
mint slice outline, retaining visible focus. Final captures and touch-selection
rerun follow this CSS correction. No world performance improvement is claimed;
existing scene budget failures and independent visual acceptance remain draft
integration gates.


Final UI rerun: **7/7 pass in 14.9 s**, now including real CDP touch selection of
Storage on the radial and touch placement. Final isolated
[desktop](radial/wheel-desktop.png) and [phone](radial/wheel-phone.png) captures
show the corrected wedge focus and were inspected.

Production controller journey: **1/1 pass in 2.2 minutes**, Chromium
151.0.7922.173, 1440×900 / 390×844. It uses the game's own sandbox entry, stock and
spawn, analog NE selection of Wall, A confirmation, separate RT placement and exact
8 kg debit, supply refill, backpack, reload and return to the unchanged ordinary
save. No pose/inventory injection, no page errors. Production
[desktop](radial/production-radial-desktop.png) and
[phone](radial/production-radial-phone.png) captures predate only the final CSS
focus-ring correction; the focused UI rerun covers that correction. The run uses
native ANGLE GL flags; no new isolated GPU-time claim is made.

Final production rebuild: 159 modules, 3.75 s, existing chunk-size advisory.
Persistent port 5296 serves `main-BeHYcLVR.js` / `main-BWxrrVHt.css`; HTTP200 and
byte-identical index comparison to dist verified. PR41 stays draft, unmerged.
