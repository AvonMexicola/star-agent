# Field materials and base construction

This first playable slice adds local construction feedstocks, backpack processing,
mainframe claims and eight physical modules. It builds on the integrated equipment,
mining and shared container system. The longer [progression plan](design/base-building-plan.md)
remains a roadmap; engineering stations, power and survival upgrades are later work.

## Try it

Start from the opening station with your normal mining tool and laser rifle.
Take a ship to a world, land and physically leave through its hatch. Find an
outcrop, select the mining tool and mine basalt and copper. Aeon now has common
construction outcrops on dry land; Pyre has fewer, more widely spaced outcrops.
Selene retains its existing mineral geography. Mining and backpack capacity remain
finite; a new player receives no free construction stock.

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
with 12 kg mineral capacity and eight slots per attached box. Carry materials back
from the ship through the physical cargo interaction. An installed mainframe and
crate each provide two storage boxes through that same interface. Approach a
mainframe, press **F / controller X**, open its supplies and transfer materials.
Enable its construction supply buffer to spend those stored materials while
standing within that site's boundary. The buffer is opt-in and never draws from
remote ships or other bases.

## Placement and structure

| Action | Keyboard | Standard Xbox mapping |
| --- | --- | --- |
| Open pieces | B, outside on foot | Menu → Build |
| Move / aim | WASD / mouse | Left / right stick |
| Place one piece | Enter | RT press |
| Next snap candidate | T | LT press |
| Rotate / flip wall facing | Q / E | LB / RB |
| Change foundation height or floor level | Up / Down | D-pad up / down |
| Choose another piece | P | X |
| Leave placement | Esc | B |
| Jump | Space | A |
| Inspect backpack | Inventory shortcut | View |
| Interact with door, crate or mainframe | F | X, outside placement |

The placement HUD also provides touch buttons. Movement and aiming continue to
use the game's existing movement controls. Controller dialogs use D-pad/stick
focus, A to activate and B to close. New contextual actions pass through the
shared controller router and wait for neutral input after dialog or tool changes.
Keyboard B opens construction; Xbox B exits it. Placement suppresses weapon fire.

Foundations and floor panels use a 4 m grid; each storey is 3 m. Walls, window walls
and doorways snap to panel edges. A wall rotates by 180° to flip its facing on its
edge; other pieces rotate by 90°. Upper floors require two supporting walls.
Stairs occupy one panel bay: leave the space above the stairs open and put the
upper landing over an adjacent bay supported by two walls. Concrete panels, walls,
window glass, stair treads and rails all have collision. Doorway leaves slide into
their own jambs, with their movement space reserved during placement.

The preview explains insufficient material, occupied space, lack of support,
steep terrain, player obstruction and claim limits before spending. Night placement
has a forward work light. Placed mainframes show live owner, site size, module count
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
