# Space patrol combat

This first combat loop runs offline in the current integrated game. It uses the
existing Nomad 02 and Kestrel GLBs, camera-relative rendering, shared ship weapons
and controller dialog/input router. No new external services or assets are needed.

## Play

1. Start in orbit with Nomad or Kestrel in the local ship/location launcher.
2. Open **Patrol console** on screen or **Menu → Patrol console**. The physical
   hangar cargo terminal also has a Security contracts button. Accept the patrol.
3. Follow the amber signal marker. From open space it is 3 km ahead; at the station
   dispatch places it 6 km beyond the approach. Regular flight reaches it without
   teleporting. Contacts activate within 1.1 km of the signal.
4. Destroy the Nomad raider and Kestrel escort. Both intercept, make firing passes,
   break away at close range, and return to the patrol area if pulled too far out.
5. Open the console and **File combat report**. The report lists both kills and
   increments the session's completed patrols. You can then accept another patrol.

| Action | Keyboard / pointer | Standard controller |
|---|---|---|
| Open mission / combat report | Patrol console button; hangar cargo terminal | Menu → Patrol console |
| Aim / fly | Existing flight controls | Right / left stick |
| Fire | Hold T or the ship's Hold to fire button | Hold RT / R2 |
| Weapon | 1 pulse, 2 solar lance, 3 singularity | Menu → Ship weapon |
| Next hostile | Tab or Next target button | Menu → Next hostile target |
| Recover after combat loss | Enter or console recovery button | A / ✕, or Menu → Patrol console → Recover |
| Abandon | Console → Abandon patrol | Same console action |

A/B rises/descends and LT brakes (matching EVA). Menu → Controller layout
shows the complete diagram, also available through Help. The selected
contact has brackets, shield/hull readings and a projectile lead ring. Edge arrows
continue tracking targets behind the camera. Solar lance is hitscan and needs no
lead ring. Tracking does not steer the ship or guarantee a hit.

## Damage and limits

Nomad has 180 shield / 240 hull; Kestrel 140 / 160; Atlas 360 / 600. Shield absorbs
first, overflow damages hull, and shield recharges after six seconds without a
hit. Hull does not regenerate; docking repairs it. Zero hull fails the patrol and
requires explicit recovery. Projectiles sweep moving spherical ship envelopes;
laser queries are immediate. Existing ground crash and stellar thermal models
remain separate from these combat hitpoints.

NPCs use the current authored hulls with mechanisms stowed. This prototype enables
the shared energy array on Kestrel; fitted gun meshes, hardpoint equipment,
missiles, squad coordination, component damage, wreck salvage, player/NPC ship
collisions, mission rewards and persistence are not implemented. Combat is offline;
multiplayer keeps server authority and does not run this NPC simulation. Contracts,
reports and combat integrity reset on reload. Opening a dialog or losing focus
pauses combat. Leaving the engagement, boarding or engaging travel abandons it.

## Verification

`npm test` includes `tests/space-combat.test.js`: shield overflow/recharge/death,
orbital precision sweeps, moving-target lead, mission transitions, obstruction,
projectile travel and NPC attack/break behavior.

Build the local-launcher version with `VITE_DEV_TOOLS=1 npm run build`, then run
`npm run test:browser -- -c scripts/space-combat.config.js`. Where `/tmp` has a user
quota, set `COMBAT_TMPDIR` to an existing writable directory on another filesystem.
The browser fixture stubs only the unrelated signed-out account session response.

The two controller journeys start through the supported orbital launcher, accept
through the actual console, fly using the sticks, target and fire, receive NPC
hits, destroy both contacts, file the report and return to play. They only read
navigation state for steering feedback; they do not set poses or call gameplay
methods. Held fire is checked across modal close, focus loss, disconnect, device
replacement and unsupported mappings. No physical controller is claimed.

A separate keyboard/pointer and recovery test uses explicit controlled poses for
close-up NPC inspection. Those images are visual fixtures, not controller-route
evidence. Renderer counters and browser/backend details accompany the captures in
`/tmp/star-agent-combat-evidence/`. The QA record distinguishes verification from
independent visual approval.
