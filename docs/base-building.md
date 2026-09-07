# Field materials and base construction

This first playable slice adds local construction feedstocks, backpack processing,
mainframe claims and eight physical modules. It builds on the integrated equipment,
mining and shared container system. The longer [progression plan](design/base-building-plan.md)
remains a roadmap; engineering stations, power and survival upgrades are later work.

## Try it

Start from the opening station with your normal mining tool and laser rifle.
The Nomad receives a one-time construction kit: **80 kg concrete, 16 kg metal
stock, 3 kg conductor and 4 kg glass**. This funds a mainframe, three foundations,
two walls, a doorway, window wall, stairs, upper floor and crate. Existing saves
receive it too, without replacing cargo. If the hold is full, free space and use
**Claim starter construction supplies** in the inventory; the kit stays pending.
Reloading or spending it never awards another kit.

Take a ship to a world, land and physically leave through its hatch. Stay within
**50 m of the ship** and choose **Build → Mainframe** to spend its cargo directly.
The inventory and placement HUD show the cargo range and connection. Building
spends backpack materials first, then an enabled mainframe buffer, then nearby
ship cargo; it checks range again when you place each piece.

To replenish materials, find an outcrop, select the mining tool and mine basalt and copper. Aeon now has common
construction outcrops on dry land; Pyre has fewer, more widely spaced outcrops.
Selene retains its existing mineral geography. Mining and backpack capacity remain
finite after the starter allocation.

Open **Build → Recipes** with keyboard **B**, the on-screen Build button, or
controller **Menu → Field recipes**. Processing currently uses only backpack
contents and completes immediately. Convert basalt into common metal and glass,
and copper into conductor. The first mainframe costs **5 kg metal stock,
3 kg conductor and 2 kg glass**. Each chosen recipe consumes its input; processing
one kilogram into metal does not also award glass or aggregate.

Choose **Mainframe** from the Pieces view and aim at clear, reasonably flat ground.
Place it at least 128 m from another mainframe and clear of ships and stations.
It establishes a 64 m radius site belonging to the current local player. There is
no multiplayer authorization service yet. Foundations cost 12 kg concrete, made
by crushing basalt into aggregate, separating a separate binder batch, and pressing
8 kg aggregate with 2 kg binder into 10 kg dry concrete. Additional material and
recipe contracts are in [field materials](design/field-materials-slice.md).

All processed resources use the existing backpack, ship and base inventory grids,
with 48 kg mineral capacity, 16 kg material stacks and eight slots per attached
box. The starter backpack has one box; its second mount raises capacity to 96 kg.
The ship starts with four boxes (192 kg) and can mount eight (384 kg). Open the backpack within 50 m of the ship to access cargo, transfer items or
equip stored gear. Cargo remains available while aboard; outside that radius it
disappears from the inventory, even if the dialog was already open. An installed mainframe and
crate each provide two storage boxes through that same interface. Approach a
mainframe, press **F / controller X**, open its supplies and transfer materials.
Enable its construction supply buffer to spend those stored materials while
standing within that site's boundary. The buffer is opt-in and never draws from
ships beyond 50 m or other bases.

Typical complete outcrops now recover about 8–14 kg of concentrate, giving a
starter backpack room for at least three of the largest measured typical rocks,
provided other carried items leave enough stack slots. The original large test
rock yields about 22.55 kg. Old collected cargo keeps its existing quantities.

Aboard or within 50 m of the ship, open **Backpack → Nomad cargo → Deposit all resources**. On a
controller, use **View**, select the ship's storage and confirm the deposit action
with **A**. The button moves all raw and processed materials together. Carried
weapons, ammo, medical items and supplies stay with you. A full destination or
failed save leaves the entire resource load in your pack.

The inventory also shows **Mining level** and progress. Successfully collected
ore awards 100 XP per kg; the first level-up requires 1,000 XP. Later levels need
more XP. Misses, rejected collection, crafting and transfers award none. Older
saves without skill data start at level 1 without retroactive XP. Levels currently record skill;
tool bonuses and technology unlocks remain future work.

## Placement and structure

| Action | Keyboard | Standard Xbox mapping |
| --- | --- | --- |
| Open pieces | B, outside on foot | B within 64 m of owned mainframe; Menu → Build for a new site |
| Move / aim | WASD / mouse | Left / right stick |
| Place one piece | Enter | A press |
| Next snap candidate | T | LB press |
| Rotate / flip wall facing | Q / E | LT / RT |
| Change foundation height or floor level | Up / Down | D-pad up / down |
| Choose another piece | P | B |
| Leave placement | Esc | X |
| Jump | Space | RB while building; A otherwise |
| Inspect backpack | Inventory shortcut | View |
| Interact with door, crate or mainframe | F | X, outside placement |

The placement HUD also provides touch buttons. Movement and aiming continue to
use the game's existing movement controls. Controller dialogs use D-pad/stick
focus, A to activate and B to close. New contextual actions pass through the
shared controller router and wait for neutral input after dialog or tool changes.
Xbox B opens or reopens the wheel; X exits placement. Placement suppresses weapon fire.

Foundations and floor panels use a 4 m grid; each storey is 3 m. Walls, window walls
and doorways snap to panel edges. A wall rotates by 180° to flip its facing on its
edge; other pieces rotate by 90°. A roof needs one supported wall, or may extend up to two adjacent panels from a wall-supported roof.
Stairs occupy one panel bay: leave the space above the stairs open and put the
upper landing over an adjacent bay connected to a supported roof or wall. Concrete panels, walls,
window glass, stair treads and rails all have collision. Doorway leaves retract
into their own jambs, with their movement space reserved during placement. This
slice eases the leaves over half a second. Their collision follows the visible
opening; closing pauses if someone enters the leaf path. Reload restores the saved
open or closed position.

The preview explains insufficient material, occupied space, lack of support,
steep terrain, player obstruction and claim limits before spending. A forward work
light aids placement in darkness. Authored previews show the actual module
shape and materials. Mainframe and doorway service lights illuminate their
fixtures and nearby surfaces, including daytime shadows. Placed mainframes show live owner, site size, module count
and buffer status on their front display. Doors, physical storage, placements and
material consumption persist in the same save transaction. Failed storage writes
retain the preceding material and base state.

## Current scope and limits

- Eight claims, up to 64 modules per claim, 64 m radius and 32 m maximum local height.
- Mainframe, foundation, upper floor, wall, doorway with working door, glazed window,
  stairs and physical storage crate.
- Local single-player authority; no guests, raiding, demolition, upkeep or offline decay.
- Walls provide collision and cover. They do not yet create airtight rooms, oxygen,
  temperature protection or powered life support. Selene and Pyre remain expedition sites.
- No queued crafting, engineering bench, wind/solar generation or advanced tech tiers yet.
- Existing rock edits are retained up to a bounded save ledger; it does not evict
  depleted deposits to regenerate resources. Larger persistent worlds need a separate
  chunked storage design before increasing that limit.

Build state saves body-fixed anchors and restores double-precision world origins,
radial site frames and local module positions. Pyre bases and nearby ore remain
attached to its rotating surface across different page epochs. GPU groups subtract the camera origin. All new outcrops and terrain
placement sampling use the same canonical body terrain as movement and rendering.
Malformed or unsupported base saves pause construction and retain their original
content instead of resetting the player's progress.


## Supplied build sandbox

Open `/?sandbox=build&intro=0&seed=7291`, or use **Command menu → Open build sandbox**.
You start on foot on Selene beside a mainframe and a 12 × 12 m foundation pad.
**4,608 kg** of concrete, metal stock, glass and conductor is available directly
while placing pieces. Open **Build → Sandbox supplies → Refill bank** whenever
needed. Reload keeps your buildings and remaining stock in a separate sandbox
save. **Command menu → Return to regular game** restores your ordinary save.

Keyboard **B** or controller **B** near the mainframe opens the palette. Select with
left stick / A, place with A, rotate with LT/RT, and exit with X. Existing support,
collision and 64-piece-per-site limits still apply. Nine foundations plus the
mainframe use ten of the starting site's slots.


## Building wheel

Controller **B** within 64 m of your mainframe or keyboard **B** opens the radial
piece picker. **Menu → Build** also starts a new site.
Point the **left stick** at a piece and press **A** to choose. Its name and costs
appear in the centre. **B** reopens the wheel during placement; **B** closes it
without selecting. Release controls, then press **A** to place. D-pad browsing,
mouse/touch selection and Tab/Enter also work. Recipes and sandbox supplies remain
in the tabs above the wheel.


## Expanded kit and landing pads

In the wheel, **LB/RB switches tabs**: Blocks, Shapes, Facilities, Resources,
and Sandbox supplies where available. Left stick/A still selects pieces;
D-pad, keyboard Tab/Enter and touch tab buttons remain available.

Shapes adds equilateral triangle foundations and roofs (three 4 m edges accepting
full walls), quarter-circle foundations/roofs (radius 4 m) and matching solid/glazed
curved walls. Matching edges determine orientation. Foundations snap to existing
edges before offering a free-grid position; LB cycles candidates. Curved walls
follow their matching curved slab. Footprints govern collision as well as art.

Roof support starts at one grounded wall and spans at most two further connected
roof panels per storey. A saved floating roof island is rejected. Storage uses
the aimed floor height, so a roof overhead does not pull a crate off the floor
behind stairs; the staircase’s actual solid body still blocks intersecting crates.

Facilities includes an 8-box storage rack (384 kg mineral capacity), inventory
terminal, 16 m-wide Nomad hangar doorway, sloped 4 m approach ramp and three pad
foundations. X/F at a terminal opens the site’s containers; access expires when
you leave the terminal. Racks and crates use the same actual box inventory.
Walls can stack directly on matching walls for double-height hangar interiors;
D-pad height selects the upper storey. The hangar’s curtain retracts into its header, with live collision and closing
protection for characters and parked ships. Its open clearance is 14.58×5.17 m.
Ramps snap to 4 m bays along panel edges and rise 0.6 m over 4 m; the lower end can
embed in ground when joining a 0.3 m-high foundation.

| Pad | Foundation | Intended ship footprint |
| --- | --- | --- |
| S |16×16m | Nomad12.1×11.1m |
| M |32×40m | Atlas19×30m |
| L |48×72m | Future heavy38×60m: four times Atlas footprint area |

The large ship is a sizing reference, not a newly playable ship. Pad profiles
currently use the flying Nomad/Atlas collision layouts on this branch. Landing
clearance includes 1 m around the full ship footprint. Rotated ships must still fit.

Aim at the near edge when placing pad prefabs; their centres extend
beyond normal tool reach. Place the foundation, leave build mode, approach or stand on it and press **X/F →
Mark as landing pad**. Size-specific perimeter/approach markings persist. Landing
assist uses a clear, sufficiently large designated slab for touchdown; objects
on the pad or an undersized footprint prevent pad capture. Approach manually
above the pad and use the usual Y/L landing assist. No automatic flight-to-pad
route or pressure sealing is added.

Pad piers extend 8 m below the deck for uneven terrain. Choose a site where the
whole deck clears terrain and the supports reach it; use foundation height
adjustment if needed. Large-pad placement expands a 64 m claim to 96 m atomically,
unless it overlaps another claim. Other claims remain 64 m. The 64-piece/site limit
still applies; a complete prefab pad counts as one piece. In the Selene sandbox,
the small pad fits west of the starter pad; the large pad fits farther east,
for example near claim-local X 36/Z 0. Refill the bank between expensive pads.


## Base electricity and server saves

Use B → LB/RB → Power to build solar arrays, wind turbines, batteries and fuel
generators. Batteries start empty and charge from surplus generation. Wind does
not work on Selene. Solar needs sunlight and clearance above the array. Mine
Selene surface rocks for helium-3-rich regolith, or survey Pyre outcrops for rare
uranium-bearing ore; put fuel in mainframe supplies and load0.1 kg batches there.

X/F at a mainframe or power machine shows generation, load, battery energy, fuel
and health. Once generation and batteries cannot meet demand, the base loses
health over72 real hours. Restoring power stops decay;5 kg metal stock repairs25
health. At zero, the base and its stored contents are removed. Manual storage and
mainframe access remain available without electricity. Sandbox health is protected.

Bases are browser-local until **Connect / restore server base save** is used at
a mainframe while signed in. An existing account save is restored, with a local
backup retained first. Connected solo saves upload every ten seconds and restore
across browsers; server upkeep continues offline. Check the displayed saved/pending
status before leaving. Multiplayer construction remains disabled in this slice.
See [power and server-save memory](base-power-pipeline.md) for integration details.
