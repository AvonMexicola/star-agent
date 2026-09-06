# Materials and transactional base acceptance

## Implemented checks

`tests/construction-materials.test.js` covers exact mass-conserving field recipes,
processed/legacy inventory migration and transfer, ingredient and output-capacity
rejection, no-write preview, stale-tab and quota rollback, malformed-save
retention, real canonical Aeon/Pyre rock raycasts and extraction, finite contact
exhaustion, cut reload and the bounded 16-deposit serialized budget.

`tests/build-state.test.js` exercises the real BuildSystem with rendering disabled:
core/crate costs and backing containers commit together; duplicate placement
cannot consume twice or allocate IDs; quota and stale-tab failures retain the
previous whole state; buffer opt-in requires nearby on-foot access; invalid
claim overlap, complete boundary, player intersection and unsupported floors are
rejected. Save validation includes structural support chains, mixed boundary
corners, monotonic IDs and required backing containers. The initial nine state
checks passed; later root regressions are recorded in the integration ledger.

## Actual browser evidence

Command: `npm run test:browser -- -c scripts/materials-gameplay.config.js`.
Hardware: Chromium, ANGLE AMD Radeon 860M Graphics, radeonsi krackan1 ACO,
OpenGL ES 3.2. Viewport 1280×800; functional screenshots use render scale 0.4,
so these are interaction evidence rather than asset beauty renders. No FPS
claim is made.

The actual Chromium storage test writes and reads the complete ledger of 16
additional exact density fields plus the legacy field: 3,260,550 serialized
characters. An additional 250,000-character base reserve also fits localStorage.
This passed; the larger 64-field draft cap was rejected during design review
before acceptance because exact snapshots would exceed the intended budget.

Aeon passed the full tested transaction journey in 37.2 seconds:

1. Begin with normal empty mineral cargo. A debug landing/aim fixture puts the
   player beside deterministic local copper and basalt outcrops.
2. Open the real backpack and attach its second empty box using the visible
   control. This adds capacity only; no ore, components or loadout are granted.
3. Use the actual T mining input, collision and worker extraction. Three aiming
   cycles recovered 8.07296183420658 kg basalt and 3.466855533857597 kg copper.
4. Click the real recipe buttons to make 5 kg metal stock, 3 kg conductor and
   2 kg glass. Assert exactly 7 kg basalt and 3 kg copper were consumed.
5. A local flat-site navigation fixture selects nearby canonical ground. Use
   the actual piece UI and Enter to place the mainframe; assert all ten crafted
   kilograms are consumed and one base piece is saved, then wait for its model.

Evidence retained at:

- `/tmp/star-agent-materials-gameplay/aeon-mined-core.png`
- `/tmp/star-agent-materials-gameplay/aeon-evidence.json`

The Aeon run reported zero page errors. A mainframe default-facing issue was
identified in the screenshot and sent to the root/asset owners for correction.
The image predates that facing correction.

Pyre passed the same real mining, recipe-button and mainframe placement journey
in 1.9 minutes, using five aiming cycles. Extraction recovered
9.091715698498774 kg basalt and 3.927772276763619 kg copper. Crafting consumed
exactly 7 kg basalt and 3 kg copper; placement consumed the resulting 10 kg of
components. The inspected screenshot shows the loaded mainframe screen facing
the player, including the default-facing correction.

A full page reload at epoch +86,400,000 ms retained the exact piece list, remaining
materials and body-fixed anchor. The restored world origin matched the canonical
next-day Pyre frame within 0.00001 m and its quaternion within 1e-7 radians. This
run reported zero page errors. Its command was
`npm run test:browser -- -c scripts/materials-gameplay.config.js --grep 'Pyre landing'`.

Evidence retained at:

- `/tmp/star-agent-materials-gameplay/pyre-mined-core.png`
- `/tmp/star-agent-materials-gameplay/pyre-evidence.json`

## Recorded failed checks and limits

Two earlier runs were intentionally interrupted: an initial SwiftShader run to
release the GPU, and a later aiming fixture that waited at an exhausted rock
angle because its Playwright timeout argument was in the wrong position. The
fixture now bounds and skips those angles, and switches to common basalt after
recovering enough copper.

The first Pyre browser attempt failed before mining. Its Node-precomputed landing
position and the page used different default wall-clock epochs for Pyre's orbit.
The fixture now supplies the exact Node epoch in the page URL. With the matching epoch, the next Pyre attempt mined 9.295828032400095 kg
basalt and 3.8630629077724734 kg copper and passed all ten real recipe-button
transactions and exact ingredient deductions. Its core preview correctly rejected
the selected fixture terrain as uneven, so no placement was claimed. The fixture
now checks all nine footprint clearances and places the eye on canonical nearby
ground before aiming. The final narrow rerun passed core placement and the
next-day full-page persistence reload, as recorded below. The investigation also
found and fixed Pyre persistence across naturally changing page epochs. Claims now retain body-fixed anchors and restore their absolute
runtime frames for the current orbit. Deposits use the same canonical body frame,
so their IDs, finite edits and nearby relationship to bases survive tidal rotation.
`tests/build-anchors.test.js` passes four checks covering one-day orbital movement,
idempotent restoration, static-world migration, corrupt/unknown legacy Pyre
anchors and stable deposit identity. Unknown historical Pyre coordinates without
an epoch are retained and blocked rather than guessed.

These are landing and local aiming fixtures, not a demonstrated flight, landing,
walking or survey route. No physical Xbox test is claimed. The separate controller
journey owns physical navigation acceptance. A complete locally supplied 2×2
shelter with its 25% margin on every body, production hauling balance, timed
presses, power, thermal shelter and rare-material progression remain outside
these material/core checks.
