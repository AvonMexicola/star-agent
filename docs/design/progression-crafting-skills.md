# Expedition progression: crafting, training and dangerous destinations

Design draft · 2026-09-06 · requested by Cees after the sparse Selene ring.
This is a proposed direction, not implemented gameplay or settled balance.

The later [base-building plan](base-building-plan.md) makes construction the first
delivery: floors/walls/doors/windows/stairs, mainframe, universal local feedstocks,
then engineering stations and power. It develops the tool/tech tree below, with
Aeon as the easiest settlement and Selene/Pyre as harder but locally supplied sites.

The intended loop is **discover → gather → process → craft → train → reach a new
environment → bring something valuable home**. Upgrades should change where the
player can go and what they can do. Existing destinations should stay useful after
the next tier opens, because advanced recipes still consume ordinary materials.

## Material tiers and destinations

These are provisional gameplay categories. New ore and creature names are working
names, not claims about real geology or biology. Pyre is the hot inner planet
already named in the roadmap; Aeon is the existing main planet.

| Tier | Sources and example materials | Equipment and opportunities |
| --- | --- | --- |
| 1 · Field | Existing basalt concentrate, copper ore and water ice; later Aeon fibers and salvage | Repair supplies, copper conductors, ceramic parts, storage boxes and basic tool cooling |
| 2 · Expedition | Refined Tier 1 materials; richer Selene deposits and ring salvage | Improved mining head, insulated suit lining, active cooling pack, cave lights and exploration equipment |
| 3 · Specialist | Pyre refractory ore and fictional heliometal; Aeon cave crystals and alien biological components | High-temperature equipment, advanced sensors, specialized armor and industrial machinery |
| 4 · Frontier | Rich Pyre deposits in severe exposure zones; deep-cave discoveries and rare mature-creature components | Exceptional modules with distinct capabilities, demanding manufacturing and maintenance |

Material tier, ore concentration and processing state are separate. A rich copper
vein yields more copper per load; it does not turn copper into a different tier.
Orbital resource colors indicate broad provinces, while close scans reveal grade
and hazards. Reserve crystals for caves, consistent with the existing roadmap.

The two specialist branches can run in parallel. A player who enjoys mining can
develop industrial equipment on Pyre; an explorer can pursue cave technology on
Aeon. Some advanced combinations can reward both routes, but basic survival gear
must not require rare loot from the place it is needed to survive.

## Crafting and storage

Use the existing box/stack interface in the backpack, ship, station and base. Add
Recipes beside stored items, with ingredients, output, compatible workbench,
power requirements and available output space visible before crafting. Select an
output container explicitly. Show which nearby containers supply ingredients;
do not consume materials from a distant station or ship automatically.

The proposed processing ladder is a hand assembly kit, then a forge/refiner, then
a powered fabricator. Station services give players access before owning a base.
Ship installations trade cargo space and power for expedition independence. Align
these consumers with the separate ship-power work when integrating.

Recipes are deterministic. Skills unlock recipes and options; repeatedly crafting
the same module should not be a lottery for a better roll. Modules have useful
tradeoffs: cooling takes power and pack space, added protection increases mass,
and a faster cutter produces more heat. Start with a few readable module slots
rather than a large tree of tiny percentage upgrades.

Candidate first chain, using only today's three mined resources:

1. Refine copper ore into conductor stock and basalt concentrate into ceramic stock.
2. Assemble conductor and ceramic stock into a mining-laser heat-sink module.
3. Fit the module, mine again and observe a longer firing window with the same
   finite deposit yield. Return to storage with the actual collected resources.

Recipe quantities and processing losses need playtesting. Define inputs, outputs,
waste and energy explicitly before implementing any recipe. No recipes or costs
in this draft are final. Existing freely attached boxes must be grandfathered if
new boxes later become crafted items.

## Training through play

Start with four disciplines and three readable ranks: Apprentice, Technician and
Specialist. Training combines a short practical milestone with a research record
or station lesson. Avoid compulsory real-time waiting and endless repeated crafts.

| Discipline | Examples of credited practice | Example capability |
| --- | --- | --- |
| Extraction | Successfully recover material, identify a new ore class, finish a controlled cut | Tune cutter modes and use more demanding mining heads |
| Fabrication | Complete a first recipe, repair equipment, assemble a new component family | Unlock advanced assemblies and module tuning |
| Survey | Map a new province, analyze a sample, record a cave route | Read deposit quality and environmental clues |
| Field operations | Complete an EVA return, recover a cave sample, manage a heat exposure exercise | Use specialized environmental modules and expedition equipment |

Credit extraction from committed material recovery, not trigger time or frame
count. First discoveries and varied tasks should matter more than grinding one
cheap recipe. Craft/salvage loops must not generate unlimited training credit.
Do not reset knowledge when a character loses cargo. Permit retraining so early
specialization choices do not permanently spoil a player's build.

Recipes, practical knowledge and installed equipment each have a purpose. Knowing
how to operate a cooling system does not supply one; owning a suit must not demand
an unrelated skill level simply to wear it. Keep prerequisite lists short and show
the next useful action when something is unavailable.

## Pyre: valuable ore behind an environmental challenge

Proposed access sequence: ordinary mining → refined ceramic/conductor parts →
insulated lining and active cooling → a short Pyre expedition → high-temperature
materials → longer expeditions to richer, hotter deposits. The first cooling kit
uses materials obtainable on Aeon/Selene or through ordinary station services.

A starter suit cannot operate the miner safely at a hot deposit. The UI explains
the cooling/protection shortfall before landing and at the tool. An upgraded suit
enables mining, while accumulated heat and coolant still limit time outside.
Overheating first gives clear warnings and tool shutdown, with time to retreat;
it must not be an unexplained instant-death boundary.

Treat direct sunlight, ambient conditions, ground contact, tool heat and cooling
as separate contributors. A shadow should reduce solar heating, not magically
remove hot air or hot ground. Suit protection, power and coolant determine a
changing heat margin. Show heat trend and estimated safe working time with a
reserve for the return journey; label that estimate as conditional on current
conditions. A ship cabin or powered shelter is a practical recovery destination.

The most valuable ore can occupy exposed ridges and severe geothermal regions.
Safer deposits near cooler approaches provide a first foothold. Readable landing
sites, shade, terrain, haul distance and available cooling create route choices.
The roadmap's Pyre temperature is a setting proposal; do not treat it as an
already simulated thermal model.

“Expensive” should eventually mean useful, scarce and costly to retrieve/process.
Pyre resources can feed high-end equipment and consume common materials during
manufacture. Exact prices, NPC demand and a trading economy remain separate work;
do not promise a player market while multiplayer is not implemented.

## Aeon caves: creatures, discoveries and special loot

Start with one explorable cave: a visible entrance, a quiet outer chamber, a
branching mineral route and a dangerous deeper nest with an alternate exit.
Create the complete adventure before multiplying cave seeds.

Working creature concepts:

- **Rift grazer:** usually avoids players but defends itself nearby. Shed plates
  supply a modest source of biological reinforcement without requiring combat.
- **Echo stalker:** hunts in the deep chambers and reacts to mining noise. Its
  sensory organ supplies a component for specialist scanning equipment.
- **Nest guardian:** a later, clearly telegraphed territorial threat guarding
  rich ore and rare components. It should be avoidable or lureable, with readable
  attack cues, cover and a retreat route.

Dangerous animals can drop useful biological materials such as carapace plates,
sensory organs and filtering membranes. Analyze samples to discover recipes for
armor composites, scanners and environmental filters. Keep valuable ordinary
ore and cave crystals in the expedition too, so a trip can succeed without a rare
drop. Research samples, shed material and abandoned nests offer slower alternatives
to combat. Rare enemies should not be the only route to basic survival upgrades.

Introduce combat only with working hit detection, damage, avoidance, feedback,
recovery and loot pickup. Equipment models and tracer effects alone do not prove
combat is implemented. Noise attracting predators can make mining a decision:
take another cut, move quietly to another vein, or return with what is in the pack.
Creature navigation and line of sight must use the cave's actual collision.

For the first survival prototype, retain equipped essentials and training after
incapacitation; drop carried loot into a recoverable cache and return the player
to a safe location. Exact loss rules need playtesting. Persist the cache and its
remaining contents so reload cannot duplicate loot or erase a completed recovery.

## Implementation contracts

Current code already provides finite mining yields, box inventories, atomic
local saves, controller menus and equipment heat behavior. Crafting, skill ranks,
Pyre surface hazards, cave exploration and creature combat are proposals here.

- Generalize the item registry and save schema before adding tiered resources.
  `src/inventory/containers.js` and `src/mining/store.js` currently rely on three
  ordered mineral quantities plus a fixed supply catalog. New items must not be
  silently dropped when translating between those representations. Preserve old
  cuts, cargo, boxes and original save data through a versioned migration.
- Commit ingredient consumption, output, job status and training credit together.
  For the first slice, use atomic immediate recipes. A later powered job system
  needs persisted reservations and completion claims before adding long queues.
  Full output storage, repeat activation or a failed write must not duplicate or
  consume items. New stacks must obey the same mass and slot rules everywhere.
- Route module effects through equipment/suit behavior and the shared inventory;
  a visual equipment attachment is not an installed gameplay modifier. Use stable
  recipe, module, discovery, creature and loot identifiers, independent of labels.
- Follow the local cave replacement contract in
  [the mining research](../selene-mining-research.md): one domain owns visible
  terrain replacement, contact, ground support and hits. An invisible radial
  heightfield must not block the entrance or snap a player out of a tunnel.
  Establish one connected cave and safe collision before procedural expansion;
  unrestricted planetary excavation is not a prerequisite for this first cave.
- Keep hazards, creature activation and cave streaming bounded around the player.
  Retain double-precision world positions and camera-relative GPU uploads. Do not
  commit to world-scale voxel conversion or a different mesher in this design.
- Loot generation and collection need saved identities and claimed state. Reloading
  a cave cannot respawn a killed creature's unclaimed inventory repeatedly. Decide
  explicit respawn rules later; do not derive respawns from renderer cell eviction.

## Build order and acceptance

Later user priority: [cargo and the base mainframe](cargo-and-base-mainframe.md)
moves a small buildable base/storage slice ahead of this crafting-first sequence,
after the ship recovery marker and regional mineral deposits. The progression
contracts below still apply when their respective systems are implemented.

1. **One useful crafted upgrade:** item/save migration, station workbench, the
   conductor/ceramic/heat-sink chain and an Extraction/Fabrication milestone.
   Mine → transfer → refine → craft → fit → mine → reload using controller alone.
   Verify a measurable heat change, exact resource accounting, full-container
   rejection, failed writes, repeat input and preservation of old saves.
2. **Suit preparation:** module slots, power/coolant supply and a controlled thermal
   test area with readable warnings and retreat. Demonstrate that common materials
   provide a viable first kit before making a new planet depend on it.
3. **First Pyre expedition:** one landing region, hot deposit, cooling limit and
   worthwhile return cargo. Prove landing, mining, survival and return in one trip.
4. **First Aeon cave:** entrance/collision, light, route, ore and exit; then one
   creature, working combat/avoidance, sample loot and a usable biological recipe.
5. **Expand variety:** more caves, fauna, material grades, specialization choices,
   powered crafting queues and an economy after the core expeditions are fun.

Every slice follows [the controller contract](../controller-contract.md), including
recipe selection, quantity, module installation, skill screens, loot and return to
play. Use the shared dialog router and preserve held-input suppression; do not
invent another menu input system. Report physical-controller testing separately
from injected Gamepad journeys. Runtime and browser validation belong to each
implementation slice, not to this design document.
