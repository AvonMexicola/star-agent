# Mining capacity and progression follow-up — 2026-09-07

The player reported filling the backpack before finishing one rock. The previous
12 kg mineral box and 4 kg stacks were mismatched to actual finite rock yields.
This follow-up changes newly recovered concentrate, mineral capacity and stacks;
existing cargo, cuts, gear, ammunition, supplies and economy values are retained.

## Measured balance

Each generated density field was exhausted with the production `carve` occupancy
quadrature using a radius large enough to cover the entire bounded field. This is
a complete-field unit fixture, not a timed tool journey or proof that buried rock
is reachable from the surface. Actual hand mining still uses its bounded brush.

| Generated field | Whole volume, m³ | Previous recovered kg | New recovered kg |
|---|---:|---:|---:|
| Variant 0 | 13.745314 | 164.943769 | 13.745314 |
| Variant 1 | 10.439929 | 125.279145 | 10.439929 |
| Variant 2 | 8.668844 | 104.026132 | 8.668844 |
| Variant 3 | 7.930037 | 95.160448 | 7.930037 |
| Variant 4 | 11.372897 | 136.474768 | 11.372897 |
| Variant 5 | 12.399554 | 148.794649 | 12.399554 |
| Legacy Crescent | 22.549681 | 270.596170 | 22.549681 |

New recovery is **1 kg of concentrate per removed cubic metre**, previously 12.
This is a gameplay recovery fraction, not the physical density of basalt, copper
ore or ice. Recipes remain mass-conserving at their existing finite costs. A core
still needs 7 kg basalt feedstock and 3 kg copper feedstock; local copper-rich and
basalt outcrops supply both. No imported water, starter ore or free components
were added. Finishing rocks takes longer than obtaining the old small raw inputs;
tool speed and hauling-time balance have not been benchmarked in this follow-up.

Every mineral box now holds 48 kg in eight shared slots, and every raw/processed
material stack holds 16 kg. The default one-box backpack holds three largest
standard generated rocks (41.235942 kg), with its normal starter supplies still
present. A second box increases mineral capacity to 96 kg and doubles stack slots.
The default four-box ship holds 192 kg; eight boxes hold 384 kg. Supplies retain
their separate existing mass limits, and item/ammunition stack sizes do not change.
Material variety and other carried supplies can still consume slots before the
mineral mass limit. Two complete legacy Crescent fields fit the starter mass
budget; three do not. Capacity is finite and the second backpack box remains useful.

## Save and progression contract

`MiningStore` defaults absent `progression` to `{mining:{xp:0}}` and validates
present progression on load. Malformed values retain the original save and block
mutation. No historical cargo is rescaled and no historical XP is inferred.
Accepted extraction adds 100 XP per newly recovered kg in the same prospective
transaction as cargo and density edits. Fractional XP survives small cuts. Stale
revisions, full mass/slots, unavailable storage and rejected saves cannot award XP.
Deposit, transfer, craft and reload preserve XP. Levels have no yield multipliers
or equipment gates in this slice. The skill module owns thresholds and its cap.

The 16-additional-edited-deposit ledger limit remains: old cuts are never evicted
or regenerated to make room. This is an explicit prototype persistence limit.

## Validation and evidence status

The existing construction-materials, build-state, container-inventory, mining,
resource-mining, space-mining, station-ledger, bulk-deposit and loadout suites
passed after updating obsolete capacity fixtures. Gear/ammo behavior, container
migration, stale writes and quota rollback retain their existing assertions.
The independent agent completed **7/7 passing** checks in
`tests/mining-loop.test.js`: three complete largest-variant fields commit together
with 41.235942 kg and matching XP; fourth-rock capacity rejection followed by
box-upgrade success; full-slot rejection; legacy migration and malformed XP
retention; stale/quota rollback; actual empty worker response with no XP; and
craft/transfer/stow preserving XP. Root owns the final combined suite and build.

The targeted controller browser check for Deposit all resources is owned by the
UI agent. Its result is separate from these unit checks. The earlier Aeon/Pyre
mining-to-core screenshots and full-kit controller journey used the previous
balance and remain historical evidence; they are not presented as measurements
of this new recovery rate. The current recovery rate is checked separately below.

## Actual accepted-mining browser check

`npm run test:browser -- -c scripts/materials-gameplay.config.js --grep
'accepted mining awards'` passed in **58.2 seconds**. Using the documented Aeon
landing/aim fixture at `aeon-construction-v1-41696-5`, actual T tool input recovered
**0.15829777851786275 kg** and atomically saved **15.829777851786275 XP**. No
resource or equipment grants were injected. The normal one-box backpack showed
48 kg capacity, Mining Level 1, 15 / 1000 displayed XP and a positive progress bar.
The inspected screenshot showed the harvested basalt and copper stacks alongside
normal starting rations. Full page reload retained identical XP, cargo and edits.

Chromium used ANGLE AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES
3.2, at 1280×800 and scene render scale 0.4. The collector reported zero page
errors, console errors or console warnings. Node printed the existing conflicting
NO_COLOR/FORCE_COLOR runner-environment advisory; it was not a browser warning.
No FPS, full-rock hand-mining timing, real landing route or physical-controller
claim is made for this bounded check. The independent Deposit all suite also
passed controller, keyboard, 390 px touch and full-ship rollback checks (4/4),
with XP preserved and reload verified; its UI owner maintains that evidence.

[Actual mining skill screenshot](mining-skill.png). Exact generated evidence is
retained outside the repository at
`/tmp/star-agent-materials-gameplay/mining-skill-evidence.json`.
