# Ground pirate encounters

In solo play, open **Menu → Contracts → Ground pirate camps**. Choose the Aeon
or Selene approach, land with **B / controller Y**, leave the seat with **F / X**,
walk aft and operate the hatch. Walk down the physical ramp and around your ship
toward the salvage barriers. The development ship/location launcher also lists
both camp approaches. Quick transit is an explicit shortcut to the approach;
landing, disembarking and boarding remain physical.

Aeon's **Red Wake** has a captain, an advancing raider and a flanking scout.
Selene's **Vacuum Jackals** have a tougher captain and a moving adjutant.
Captains rise above low cover to aim and crouch while reloading. The amber
warning marks their aim windup: move before they fire, or break sight behind a
barrier, rock or your parked ship. Their rounds use the existing suit health and
bleeding system. Medical quick slots and the existing evacuation recovery apply.

| Action | Keyboard | Standard controller |
| --- | --- | --- |
| Move / aim | WASD / mouse or arrow keys | Left / right stick |
| Equip carbine | 1 | D-pad left cycles equipment |
| Fire | T / mouse | RT |
| Crouch / stand outside | C | Right-stick click (R3) |
| Use selected medical item | Existing quick-slot binding | D-pad down |
| Recover cache / interact | F | X |
| Backpack / equipment | I / K | View / Menu → Loadout |
| Commands / return | Escape | Menu / B |

Crouch includes idle, forward/backward walking and both strafes. It reduces
walking speed and eye height; jumping requires standing. Rifle aiming remains
available while crouched. Crouching is currently restricted to solo outdoor
walking, with conservative standing clearance against ordinary world obstacles.
It does not provide a crawl-under geometry system. R3 retains flight-assist
control during flight; C retains downward thrust during flight/EVA.

On touch screens the camp status includes a **Crouch / Stand** button. It supports
a second-finger tap while a walking button remains held. The visible salvage
button opens the same inventory used by F/X. The native inventory supports
selecting and transferring each recovered stack.

Defeat every pirate to unlock the cache: **24 carbine charges, one healing stim
and two bandages**. These are actual backpack transfers. Each camp's cache is
finite and remembered in the current local save; an emptied cache does not refill
after reload. Enemy and clearance state lasts for the browser session, so enemies
return on a fresh session. Walk back up the ramp, approach the pilot chair and
use F/X to sit down again.

The five supplied models have fitted rigs and 21 movement/combat clips each.
The expedition player has 35 clips, including the expanded crouch set. Pickup
and carrying motions are available assets; a new heavy-object handling mechanic
is not part of these encounters. Lizzy has a separate prepared guide asset with
corrected arms, walking, running, idle and greeting. She has no tutorial dialogue
or in-world placement yet.

See the [production and validation record](qa/pirates/README.md) for measured
asset budgets, actual journeys, retained failures and remaining acceptance.
Ground pirates are suppressed when connected to authoritative multiplayer.
