# Field construction materials: implemented first slice

The legacy basalt/copper/ice arrays remain unchanged in the mining save. Six
processed kilogram resources live beside them in `materials.pack` and
`materials.ship`; remote containers use their existing item maps. All nine
materials share the mineral mass budget (12 kg per box), four-kilogram stack size
and eight slots per box. Gear, shop stock, ammunition, terrain edits and building
extensions remain in the existing atomic save. Normal new saves receive no
construction material.

| Field recipe | Input kg | Output kg | Nominal seconds per batch |
| --- | --- | --- | --- |
| Crush aggregate | 1 basalt | 1 aggregate | 2 |
| Separate dry binder | 1 basalt | 1 mineral-binder | 4 |
| Press dry concrete | 8 aggregate + 2 mineral-binder | 10 concrete | 6 |
| Work common metal | 1 basalt | 1 metal-stock | 6 |
| Refine conductor | 1 copper | 1 conductor | 6 |
| Process basic glass | 1 basalt | 1 glass | 6 |

These are fictional Tier-0 processing abstractions. A selected fraction consumes
its entire input mass; the same input is never counted toward several outputs.
There are no extra byproducts or imported water requirements. Current batches
complete immediately. Seconds describe proposed throughput for later timed
presses, not a running timer. Grid power, heat, energy storage and workstation
progression are not implemented prerequisites.

`craft(store, recipeId, {source:'pack', target:'pack', quantity:1})` and
`previewCraft` are exported by `src/crafting/transactions.js`. Quantity is an
integer batch count. The default confines processing to the backpack. Callers
must enforce physical access if they supply other containers. Ingredients and
output capacity are checked before one save; a failed or stale write keeps both
materials and the previous world state. Preview performs the same validation
without writing.

Aeon dry land and Pyre now stream common construction outcrops through the
existing three-worker regional mining limit. Body-local spherical cells use
120 m spacing on Aeon and 300 m on Pyre. Twenty percent of cells have a common
copper profile; others are predominantly basalt with trace copper. Profiles
classify actual mineral veins, rather than awarding every ingredient from one
cut. Aeon sea-level cells are excluded. These deposits use canonical body height
and normal sampling and the existing finite density fields, shaders, collision,
mining ray checks and atomic extraction. Selene's existing geography is retained.
This establishes local feedstocks, not a guarantee that every landing is safe or
that a complete shelter route has been traversed on each world.

The edited-deposit ledger is bounded at 16 additional deposits plus the legacy
Crescent deposit. Exact encoded density snapshots for a full test ledger occupy
less than 3.3 million serialized characters. No edit is evicted and depleted ore
never respawns to make space; once full, existing edited deposits remain usable.
A Chromium integration check also writes and reads the full 3,260,550-character
ledger plus a 250,000-character base reserve within the actual browser quota.
Storage quota failures still roll back the complete transaction. Larger economies
need a dedicated compressed/chunk persistence design before increasing this cap.

Automated coverage in `tests/construction-materials.test.js` includes legacy and
processed resource migration, exact recipe mass, output capacity, preview,
quota/stale-session rollback, corrupt-save retention, canonical Aeon/Pyre
outcrops, actual mining rays and extraction, finite contact exhaustion, reload
and the full serialized deposit budget. Controller journeys and renderer review
are integration acceptance work and are not established by these unit tests.
