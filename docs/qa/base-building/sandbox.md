# Build sandbox

User request: a building environment with plentiful materials. Work is based on
PR41 at `891c916`, isolated worktree `/tmp/star-agent-base-work`.

Open `/?sandbox=build&intro=0&seed=7291`, or Command menu → Open build sandbox.
The sandbox starts on foot on Selene, beside an existing mainframe and nine
foundations forming a 12 × 12 m pad. Canonical lunar terrain supports the site;
no alternate terrain/collision plane is introduced. Normal placement, snapping,
collision, support, save and 64-piece-per-site limits apply.

The bank contains 3,072 kg concrete, 768 kg metal stock, 384 kg glass and 384 kg
conductor. Twelve ordinary eight-box containers hold this stock within existing
capacity rules. Sandbox construction can draw from them without cargo trips.
Build palette → Sandbox supplies displays totals and refills the bank to 4,608 kg.
The mainframe's local supply buffer remains an ordinary, independently managed box.

All storage handed to Fleet, ShipInventory and MiningStore is prefixed with
`star-agent.build-sandbox.v1:`. Initial allocation and its receipt commit with the
base in one MiningStore write. Reload preserves spent materials and buildings;
only an explicit refill restores the bank. Refill preserves carried cargo, cuts,
XP, equipment and buildings. Ordinary mode never receives sandbox supply sources.
Command menu → Return to regular game leaves this namespace.

Unit allocation, namespace isolation, reload, stale-write,
quota failure and canonical terrain checks pass. Full `npm test` passes all 76
configured files; focused sandbox/build-state/ship-access run passes 25 assertions.
Production build passes with 157 modules and the existing chunk-size advisory.

Browser attempt history: initial runs died before the regular game was ready.
Chromium's own startup log identified a fatal font-data-service assertion with
`Disk quota exceeded (122)`. A renderer SIGTRAP core was also present; its unresolved
stack alone did not identify the cause. Subsequent tests use
`TMPDIR=/home/cees/.cache/star-agent-browser-tmp` on the home disk. No system cleanup
or configuration change was made; no core was extracted.


The production controller journey passed **1/1 in 2.1 minutes**, Chromium
151.0.7922.173 at 1440×900 and 390×844. It starts in the regular game and uses
injected standard Gamepad input to enter the shipped sandbox, select/place a wall,
verify an exact 8 kg bank debit, inspect/refill stock, open/close the backpack,
reload with equal saved buildings/stock, and return to the byte-identical ordinary
mining/inventory save. No pose or resource fixture is injected; spawning and the
initial grant are actual sandbox features. Zero page errors. Physical Xbox is
untested. Evidence: `/tmp/star-agent-build-sandbox/journey.json`.

[Arrival](sandbox/arrival.png), [wall preview](sandbox/wall-preview.png),
[supplies desktop](sandbox/supplies-desktop.png) and
[supplies phone](sandbox/supplies-phone.png) were inspected. The supplied pad is
visible on the real lunar shelf; all supply totals and the refill action fit the
phone view. No new meshes, materials or shaders are authored by this feature.
Existing whole-scene performance and integration review gates remain; the previous
asset rubric applies to the kit, not a new independent sandbox UI acceptance.

Shared keyboard/touch/controller UI regression: 5/5 pass in 11.4 s, including
held-trigger suppression and inner scrolling. Persistent port 5296 returns HTTP
200; its index matches current dist (`main-DmvYObi_.js`) byte-for-byte.
