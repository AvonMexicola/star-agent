# Shared box inventory

Press **I**, click the persistent **Backpack** button, or use the controller View
button when the controller router is installed. Mined basalt, copper and ice
appear beside expedition supplies in the backpack. Select an item stack, choose a
nearby container and transfer one unit or a complete stack. The Nomad cargo view
also offers **Stow all minerals**.

The same renderer serves backpacks, ships, station lockers and registered base
containers. Ship storage is available aboard the ship. Aeon orbital storage is
available while docked. A base or surface crate must be registered with an actual
proximity callback; this module does not create a base building.

Every box adds eight stack slots and 12 kg mineral capacity. Mineral stacks hold
4 kg; rations stack to ten; equipment occupies one slot each. The backpack has two
box mounts, other containers eight. Attaching an empty box is free in this
prototype. Existing supply weight limits remain 20 kg backpack / 120 kg ship;
box additions expand mineral storage and stack slots. Item use, crafting and
buying boxes are not implemented.

## Integration

`createInventoryUI(nav, ship, manifest, miningStore)` returns:

- `openPack()`, `openContainer(id)`, `open`, `update()`, `state`, `dispose()`.
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
there is no separate reward write. Saves are local to this browser, without
concurrent-tab or multiplayer coordination.

`getRock(id, initialField)` returns `{ field, revision }`; `commitRock(id, result,
revision)` saves that field and credits the shared backpack atomically. The
primary Selene rock retains its original API. At most eight additional space
rocks can be saved. `canEditRock(id)` reports whether a new deposit can be edited;
already saved deposits remain editable at the cap. `releaseRock(id)` drops an
unsaved runtime initial field when a streamed rock is evicted; it never deletes a
saved edit. Encoded immutable fields are cached to avoid re-encoding every saved
rock during an unrelated transfer.

## Validation in this lane

21 numerical checks passed across container inventory, mining and ship inventory.
They cover slot and mass limits, box expansion, legacy migration, reloads,
resource conservation, station/base transfers, failed saves, stale rewards and the
space-rock save cap. The release hook was added after that run and has a targeted
regression assertion.

The production browser run reached desktop backpack display, mineral and supply
transfers, box expansion and screenshots, then failed an immediate assertion of
navigation state following the asynchronous dialog close event. The test now
waits for the close handler. A rerun was held at tool approval and interrupted;
final browser validation is delegated to the integration lane. Desktop screenshots
from the partial run are in `/tmp/star-agent-inventory-evidence/`. Mobile and
station screenshots are not claimed. The test's station docking state is an
explicit UI fixture, not evidence of physical station traversal.
