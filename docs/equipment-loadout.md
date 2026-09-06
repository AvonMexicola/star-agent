# Player equipment and loadout

The shared backpack/storage dialog now has an **Equipment** view: two weapon
slots, one tool, one backpack, two ammo slots and four quick-item slots. Select a
slot, then draw, stow or assign an item from your backpack or accessible storage.
The same dialog and focus system serves the ship, station and field cache.

A finite starter kit contains a carbine, sidearm, mining laser, life-support
backpack, 60 carbine charges, 36 sidearm charges, three bandages and two healing
stims. Quick slots 3 and 4 start empty. Existing mineral cuts, container contents
and box mounts are preserved when an older save gains its initial loadout.

## Controls

| Action | Keyboard / pointer | Standard controller |
| --- | --- | --- |
| Equipment screen | K; Equipment tab in backpack | Menu → Equipment; or View → Equipment |
| Draw weapon 1 / 2 / tool | 1 / 2 / 3; shortcut buttons | D-pad left cycles held slots |
| Select / holster mining tool | 3 / R | D-pad right |
| Fire held weapon or tool | T / captured left mouse / hold panel button | RT |
| Use quick slots 1–4 | 4–7; shortcut buttons | D-pad up selects, down uses |
| Slot or action selection | Click / touch / Tab and Enter | D-pad / left stick, A |
| Close and return | Close / Escape | B |

Held-gear and quick-item shortcuts apply on foot and in EVA. Flight bindings
remain as before. Weapons currently fire outside the cabin, like the mining
adapter. The shortcut bar shows the active hand slot and selected quick slot.
Switching hand slots suppresses held firing until the controller returns neutral;
keyboard auto-repeat cannot restart a held T after a switch.

## Inventory and save contract

`src/inventory/loadout.js` owns the slot definitions, compatibility and immutable
transactions over `MiningStore`. The existing `star-agent.selene-mining.v1` save
now contains a versioned `loadout` alongside cuts, minerals and all containers.
It does not introduce a separate save that could lose one side of a transfer.

- Gear physically moves out of a container into a slot. Swapping returns the old
  item to the source in the same transaction; full storage rejects the whole swap.
  Ammo and quick-item slots hold bounded stacks and support topping up.
- Failed writes preserve both inventory and equipped state, pause mutation and
  keep the original save. Invalid saved loadouts are retained and blocked, rather
  than replaced by another starter kit. Reloading never replenishes spent ammo.
- The backpack supplies its existing one/two box mounts. It must be empty before
  removal and must be stowed in external storage. With no backpack equipped,
  capacity is zero: gathering and transfers into it fail. Re-equipping preserves
  attached mounts. Worn gear mass and total carried mass are displayed separately
  from the existing storage limits; this is not a new unified encumbrance solver.
- `Equipment.update({authorizeFire})` consults the loadout after the fire-rate
  gate and muzzle check, before emitting a shot. One matching ammo-slot charge
  must save successfully. Unloaded, incompatible or blocked ammo cannot fire.
  Charges feed the energy weapons directly; separate magazines/reload timing
  are not implemented. Mining retains its heat system and does not consume ammo.
- A late asset load cannot reattach an old item after the user switches slots.
  Mining heat cools while the tool is put away and cannot be reset by slot cycling.
- Medical items consume one stack unit atomically with their effect: bandages
  stop bleeding and restore 15 health, stims restore 40, capped at 100. Full-health
  items are retained unless a bandage can stop bleeding. They cannot revive at 0.
  `Loadout.injure()` is a hook for future authoritative damage systems; this slice
  does not invent ambient injuries, fauna, combat damage or oxygen depletion.

## Rendering and integration

The current first-person Equipment socket adapter now supports both held weapon
models and the cutter. Existing authored GLBs and calibrations are preserved.
`weapon-target.js` is reused from committed PR27 (`d9f4d7c`) for camera/muzzle
queries; the existing shared particle director provides pulse/impact feedback.
Weapon hits do not excavate or grant minerals. Only the cutter requests cuts.

This branch is stacked on expedition PR24 at `c3ef10c`. Fable should preserve the
newer shared rig/gear assets and PR27's independent colored-weapon and flight
work when integrating. Keep one particle director, the current regional mineral
callbacks and the equipment ammo-authorization hook. No second input router or
separate per-container equipment screen is needed.

Production evidence and specific fixture limitations are recorded under
`docs/qa/equipment-loadout/`. Physical-controller checks are separate from the
injected standard Gamepad journeys. Browser storage is scoped to its origin;
previews on different ports have separate saves.
