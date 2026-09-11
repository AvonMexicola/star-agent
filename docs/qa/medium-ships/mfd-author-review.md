# Medium MFD canonical inventory readout — staged display correction

The original Gannet MFD reports **1.0 kg** for a backpack whose canonical container contains **1.5 kg**, and **33.0 kg** for ship storage containing **136.0 kg** after the construction grant. This is a display omission: the legacy `ShipInventory.mass` counts only its older item catalog. Stratum has a separate display closure that also reads that legacy mass and hard-codes a 240 kg denominator.

The staged change is display-only. `createMediumShipInventory(store, legacy)` returns a frozen read-only adapter with `mass(id)` and `massReadout(id)`. It obtains current `MiningStore.container(id).items` and uses the canonical `itemMass` catalog. The canonical container already includes legacy supplies, so they are counted once; missing containers fall back to the provided legacy reader. The adapter exposes no transaction, container, ledger or capacity mutation API and caches no item state.

The shared MFD accepts the optional total-mass readout for offline use, including the immediate power-off page. Plain legacy arguments retain their existing supply/capacity formatting. Connected multiplayer bypasses the optional local formatter and preserves the existing server inventory path. Stratum's existing display closure uses `SHIP STORAGE: x.x kg` with the adapter; its dedicated `ORE BIN: x.xx / 384 kg`, ramp, gear and `32 SBU freight / separate ore bin` footer remain unchanged. The unadapted wrapper input retains its previous legacy behavior.

There is no combined `/20`, `/240` or `/960` total. The real limits remain separate: the tested default backpack has 20 kg supplies plus 48 kg resources, while a 960 kg ship supply allowance coexists with 192 kg resource capacity. Worn loadout, dedicated ore and SBU freight are not folded into the general ship/backpack container totals.

## Exact delivery allowlist

Only these four repository paths are delivered; all other staging links/copies are unchanged CPU-test dependencies:

1. `src/medium-ship-inventory.js` — new pure read-only adapter.
2. `src/ship-mfd.js` — optional offline total formatting; legacy/server paths retained.
3. `src/medium-ships.js` — Stratum's existing storage row consumes that optional formatting.
4. `tests/medium-ship-inventory.test.js` — four focused regressions.

Existing file base identities are `c35f63193b152d1c43963acb54ecca73a6466aef57dfead6884d4f2ed8deb4e4` for `src/ship-mfd.js` and `398ab8bbebf1ff58eaf464602fde224b9dcc975c63857b2904c7d6f80b309252` for `src/medium-ships.js`. The sidecar manifest gives complete base/final hashes, the exact archive and patch hashes. No `main.js`, package, store, server, asset, shader, geometry, camera or effect file was changed.

## Root-owned main integration

Add the import near the existing inventory imports:

```js
import { createMediumShipInventory } from './medium-ship-inventory.js';
```

Create the adapter once after `MiningField` has supplied its store (it reads subsequent commits and manifest binding dynamically):

```js
const mediumInventory = createMediumShipInventory(mining.store, inventory);
```

Change only the existing display argument in the ship-visible update block:

```js
ship.updateDisplays(
  dt,
  nav,
  mediumSystems[nav.shipId] && !multiplayer.connected ? mediumInventory : inventory,
  navigationTargets.course ?? course,
);
```

This guard uses the existing two-entry medium-systems map. It preserves legacy hull inputs and keeps local medium inventory out of ONLINE authority. Add `node tests/medium-ship-inventory.test.js` once to the normal package test chain. Root owns those wiring/package edits and its separate collection-mote and marker changes; this packet contains no competing main patch.

## CPU verification and limits

- **Original mismatch reproduced** using the actual unchanged shared MFD module, original Stratum display closure, real `MiningStore` commits and legacy argument. Receipt `qa/original-negative.json` records backpack `1.0 / 20 kg` versus required `1.5 kg`, ship `33.0 / 960 kg` versus `136.0 kg`, and original Stratum `SUPPLIES: 33.0 / 240 kg`. Source hashes are checked before that probe. No browser or live player inventory is involved.
- `node tests/medium-ship-inventory.test.js`: **4 / 4 PASS**, exit 0, 84.089293 ms reported. Cases cover an accepted mined gain with helium byproduct; the real 103 kg construction grant; modern catalog supplies; subsequent transfers; read-only display updates; immediate power-off; unchanged legacy readouts; direct and wrapped multiplayer server precedence; and the source-extracted actual Stratum display closure with separate ore/freight.
- `node --test tests/medium-ship-inventory.test.js tests/ship-power-support.test.js tests/multiplayer-ui.test.js`: **3 / 3 files PASS**, exit 0, 191.869778 ms. The existing power and multiplayer test files were copied unchanged into the isolated test stage so their direct MFD imports exercise the staged correction.
- The new test uses actual store and canvas MFD formatter code with a minimal CPU canvas stub. Only Stratum's existing display closure is source-extracted to avoid unrelated model loading/lights; this is not a model-loader or main-game integration certificate. No full build, broad suite, GPU or fresh native capture was run here.

The existing independent actual-game visual scores and failure evidence remain unchanged. The corrected source needs root's main wiring, host checks and fresh native MFD closure before those game presentation findings can close. This is an implementation handoff, not independent approval of my own correction.
