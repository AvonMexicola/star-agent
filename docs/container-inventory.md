# Shared box inventory

Press **I**, click the persistent **Backpack** button, or use the controller View
button when the controller router is installed. Mined basalt, copper and ice
appear beside expedition supplies in the backpack. Select an item stack, choose a
nearby container and transfer one unit or a complete stack. The Nomad cargo view
also offers **Deposit all resources** beside the storage selectors. It moves all
raw and processed materials together while retaining gear, ammunition and supplies.
The inventory also shows saved mining level and progress.

The same renderer serves backpacks, ships, station lockers and registered base
containers. Ship storage is available aboard the ship. Aeon orbital storage is
available while docked. A base or surface crate must be registered with an actual
proximity callback; this module does not create a base building.

Every box adds eight stack slots and 48 kg mineral capacity. Material stacks hold
16 kg; rations stack to ten; equipment occupies one slot each. The backpack has two
box mounts, other containers eight. Attaching an empty box is free in this
prototype. Supply weight limits remain separate: 20 kg in the backpack and the current
ship manifest limit aboard. Box additions expand material storage and stack slots.
Field construction recipes and equipment use are implemented; buying boxes is later work.

## Integration

`createInventoryUI(nav, ship, manifest, miningStore)` returns:

- `openPack()`, `openContainer(id)`, `openStorage(id)`, `openEquipment()`, `open`, `update()`, `state`, `dispose()`.
- `registerContainer({ id, name, kind, boxes, available })`, where `available` is
  a function checked before opening and transferring. Example:

```js
inventoryUI.registerContainer({
  id: 'crescent-cache', name: 'Crescent field cache', kind: 'base', boxes: 2,
  available: () => nav.mode === 'walk' && nav.position.distanceTo(cache.position) < 4,
});
```

The component installs `nav.openInventory()` for the physical ship cargo
interaction and `nav.openBackpack()` for controller View. It uses a native
`#cargo-dialog`, semantic buttons, stable `data-controller-key` attributes and
`data-controller-focus` on Close. The shared controller dialog router owns
D-pad/stick focus navigation and A/B actions. Its 250 ms refresh timer also updates
the collected-mineral badge; optional root `update()` calls are throttled.

Useful browser selectors are `#backpack-button`, `[data-location="ship"]`,
`[data-container="pack"] [data-item="copper"]`, `[data-transfer="one"]`,
`[data-transfer="stack"]`, `[data-add-box="pack"]` and `[data-action="stow"]`.

## Save transaction and migration

`MiningStore` now owns mineral containers, supplies, registered storage and edited
rock fields in one localStorage transaction under the existing mining key. It
imports the old ship manifest when loading a legacy mining save. The original
manifest key is retained, and the existing `ShipInventory` display object is
synchronized after a successful write. Reload never imports that old manifest
again after the unified save exists.

Rejected capacity checks, stale rock revisions and failed writes publish neither
inventory changes nor the corresponding terrain cut. Invalid saves remain on
disk and pause mutations. Supply and mineral transfers use this same transaction;
there is no separate reward write. Accepted ore awards mining XP in that same
transaction. Saves are local to this browser; stale-tab writes are rejected.
Multiplayer coordination remains future work.

`getRock(id, initialField)` returns `{ field, revision }`; `commitRock(id, result,
revision)` saves that field and credits the shared backpack atomically. The
primary Selene rock retains its original API. At most 16 additional
rock fields can be saved alongside the original deposit. `canEditRock(id)` reports whether a new deposit can be edited;
already saved deposits remain editable at the cap. `releaseRock(id)` drops an
unsaved runtime initial field when a streamed rock is evicted; it never deletes a
saved edit. Encoded immutable fields are cached to avoid re-encoding every saved
rock during an unrelated transfer.

## Validation

The integrated numerical suite covers slot and mass limits, box expansion, legacy
migration, reloads, resource conservation, station/base transfers, failed saves,
stale rewards and the additional-rock save cap.

The production Chromium journey passes backpack/ship transfers, box expansion,
reload, station storage, physical-cache availability and the 390 px phone layout.
Evidence is included with the expedition review. Station docking and placement near
the field cache are explicit UI fixtures; this inventory test does not claim a
physical journey to either location. The separate controller journey covers real
in-game entry, mining, backpack access and return to play through standard input.
