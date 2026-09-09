# Starter cargo tractor

User request: add a tractor beam to the default player loadout.

Add one finite cargo tractor to fresh solo and multiplayer backpacks. Keep the mining laser in the existing Tool slot; swapping the tractor into that slot must activate the real cargo beam. Preserve saved inventories without refilling moved equipment. Reuse the existing model, controller bindings, cargo commands, save transaction and server ownership checks.

Isolated `feat/starter-tractor`, base `70a2db5`, preview port5694, no API service or public deployment. Shared hooks: mining selection, trading setup, authoritative equip/tractor gate. Existing SA-NAV-003 drive-entry controller correction must remain intact. Claims are listed in SA-CARGO-003; integrated cargo and loadout behavior remains authoritative.

Acceptance: starter kit count and swap/save conservation; multiplayer equip, durable restore and cargo commands; full configured unit suite and build; controller-only physical approach, Loadout selection, real2SBU movement, interruption gates, secure, holster and return to mining. Record browser results separately from physical-device testing. Integrate checked commits into local dev/all-features and refresh the managed preview without resetting its database.
