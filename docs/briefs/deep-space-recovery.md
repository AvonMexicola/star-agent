# SA-RECOVERY-001 — Disabled Atlas cargo recovery

Status: locally integrated at `d3cbde3` on2026-09-09. Cees requests deep-space cargo recovery from a disabled Atlas with
alarm lights and open ramps, including enemy-guarded variants. Base `f1ef821`,
branch `feat/deep-space-recovery`, isolated `.worktrees/deep-space-recovery`.
Private preview5680 QA is complete and released. Shared5178 serves the checked
solo feature; API8087/protocol9 and its database are preserved.

## Playable scope

Three solo recovery contracts: unguarded, raider guard and heavier blockade.
Accepting marks a fixed deep-space distress site without moving the player. Fly
there, defeat any guards, EVA to the open64m Atlas and tractor the named2SBU
mission container through the open bay into the player’s own hold. Other containers
are optional bonus loot. Return to Greenbank Supply and deposit only the original
required container at its terminal for one payment. The mission shows the required
0.6 × 0.6 × 1.2m grid space; a full hold does not block acceptance. Required cargo
is private and cannot be substituted or sold. Secured bonus loot can be sold and
remains after mission completion or abandonment.
Save/reload and abandonment preserve exact crate/payment state. Guarded sorties
reuse existing solo ship-combat authority; online recovery is explicitly unavailable.
Existing online transport remains intact. No shared NPC/protocol extension is claimed.

## Implementation and ownership

New src/recovery modules own catalog, ledger, wreck presentation/collision and UI.
Small explicit hooks in existing commerce, crate seal preservation, main, navigation
collision and combat encounter entry. Reuse unchanged authored Atlas GLB, canonical
Atlas systems/ramps/EVA geometry, existing SBU assets, tractor and ship weapons.
No new dependencies, authored ship geometry, terrain, global lighting or input loop.
Checked Pirate/faction/rotation integrations are composed. Main/combat hooks
preserve their separate APIs, canonical surface coordinates, fixed deep-space
poses and protocol9. Pending Sentry source is not copied.

## Verification

Meaningful model tests for exact required identity, optional bonus handling, ownership, clearance,
deposit/removal stacks, atomic payout, reload/failed-save and rollback. Geometry
checks for true open ramp sweeps, hull/beam occlusion, origin precision and flight
collision. Actual standard-Gamepad mission entry/flight/EVA/tractor/loading/
return/deposit/result/relaunch, and guarded combat route. Keyboard/native phone
actions, held input across dialogs/native focus/device changes. Inspect original
1440×900/390×844 images and actual alarm motion/render diagnostics. Physical
controller, all-hull journeys and independent acceptance remain separate.


## Cees's specific-container revision

Acceptance must show the required cargo-grid size rather than reject a full hold.
New jobs require one named 2 SBU container; other wreck containers are optional
loot which the player can keep or sell. Missing optional cargo never blocks the
mission reward. Maintain original-container identity, accepting-pilot privacy,
guard clearance, real tractor/grid movement and physical terminal delivery.


## Delivery evidence

All163 combined normal test files and build07 pass. Complete controller09, guarded
controller07 and keyboard/native-phone07 pass with empty application diagnostics.
The exact source, original screenshots, retained failures and local HTTP verification
are in [the QA record](../qa/deep-space-recovery/README.md). PR105 remains a draft
for independent review; local integration is separate from public deployment.
