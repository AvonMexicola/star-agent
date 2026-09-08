# SA-RECOVERY-001 — Disabled Atlas cargo recovery

Status: active. Cees requests deep-space cargo recovery from a disabled Atlas with
alarm lights and open ramps, including enemy-guarded variants. Base `f1ef821`,
branch `feat/deep-space-recovery`, isolated `.worktrees/deep-space-recovery`.
Private preview5680 / optional test API8680; no shared services or GPU reserved.

## Playable scope

Three solo recovery contracts: unguarded, raider guard and heavier blockade.
Accepting marks a fixed deep-space distress site without moving the player. Fly
there, defeat any guards, EVA to the open64m Atlas, tractor its two or three sealed
2SBU crates through the open cargo bay into the player’s own hold, return to
Greenbank Supply and deposit all original crates at its terminal for one payment.
Cargo is private to the accepting pilot; no duplicate issue, substitution or resale.
Save/reload and abandonment preserve exact crate/payment state. Guarded sorties
reuse existing solo ship-combat authority; online recovery is explicitly unavailable.
Existing online transport remains intact. No shared NPC/protocol extension is claimed.

## Implementation and ownership

New src/recovery modules own catalog, ledger, wreck presentation/collision and UI.
Small explicit hooks in existing commerce, crate seal preservation, main, navigation
collision and combat encounter entry. Reuse unchanged authored Atlas GLB, canonical
Atlas systems/ramps/EVA geometry, existing SBU assets, tractor and ship weapons.
No new dependencies, authored ship geometry, terrain, global lighting or input loop.
Main/combat hooks coordinate with pending Pirate/Sentry owners; preserve their
separate APIs and protocol8 work. No unfinished owner source is copied.

## Verification

Meaningful model tests for exact multi-crate identities, ownership, clearance,
deposit/removal stacks, atomic payout, reload/failed-save and rollback. Geometry
checks for true open ramp sweeps, hull/beam occlusion, origin precision and flight
collision. Actual standard-Gamepad mission entry/flight/EVA/tractor/loading/
return/deposit/result/relaunch, and guarded combat route. Keyboard/native phone
actions, held input across dialogs/native focus/device changes. Inspect original
1440×900/390×844 images and actual alarm motion/render diagnostics. Physical
controller, all-hull journeys and independent acceptance remain separate.
