# Space patrol combat

This first combat loop runs offline in the current integrated game. It uses the
existing Nomad 02 and Kestrel GLBs, camera-relative rendering, shared ship weapons
and controller dialog/input router. No new external services or assets are needed.

## Play

1. Start in orbit with Nomad, Kestrel or Atlas in the local ship/location launcher.
2. Open **Patrol console** on screen or **Menu → Contracts**. The physical
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
| Open mission / combat report | Patrol console button; hangar cargo terminal | Menu → Contracts |
| Aim / fly | Existing flight controls | Right / left stick |
| Fire | Hold T or the ship's Hold to fire button | Hold RT / R2 |
| Combat / cruise | Z or mode button | Menu → Ship → Combat / cruise |
| Fly-by-wire / unlocked | V | R3 |
| Full braking | Hold X | Hold LT / L2 |
| Weapon | 1 pulse, 2 solar lance, 3 singularity | Menu → Ship → Ship weapon |
| Next hostile | Tab or Next target button | Menu → Ship → Next hostile target |
| Recover after combat loss | Enter or console recovery button | A / ✕, or Menu → Contracts → Recover |
| Abandon | Console → Abandon patrol | Same console action |

Fly-by-wire is on by default and corrects drift with finite thruster force. Releasing thrust brakes gradually; turning the nose does not instantly redirect travel. V / R3 unlocks thrust-off coasting and lets you turn around while retreating and firing. Hold X / LT to brake, and allow substantially more stopping room in Atlas.

Combat speed caps are Kestrel220, Nomad180 and Atlas120 m/s. Z switches to faster cruise and locks weapons. Switching back brakes gradually; fire stays locked until actual speed is within the combat limit, boost is off and gear is retracted. This applies in either assist mode. Landing assist requires speed below10 m/s.

A/B rises/descends and LT brakes (matching EVA). Menu → Settings → Controller layout
shows the complete diagram, also available through Help. The selected
contact has brackets, shield/hull readings and a projectile lead ring. Edge arrows
continue tracking targets behind the camera. Solar lance is hitscan and needs no
lead ring. Tracking does not steer the ship or guarantee a hit.

## Damage and limits

Nomad has 180 shield / 240 hull; Kestrel 140 / 160; Atlas 360 / 600. Shield absorbs
first, overflow damages hull, and shield recharges after six seconds without a
hit. Hull does not regenerate; docking repairs it. Zero hull fails the patrol and
requires explicit recovery. Projectiles sweep moving spherical ship envelopes;
laser queries are immediate. Projectiles inherit the firing ship’s velocity and the lead ring uses relative velocity. Visible laser pulses follow the moving fitted barrel while retaining their original impact point; damage is still resolved once per shot. Existing ground crash and stellar thermal models
remain separate from these combat hitpoints.

Player and NPC hulls carry the [sized Meridian guns](ship-weapons.md). NPC
mechanisms are stowed; actual barrel poses drive their fixed-bore shots. Raise
landing gear before player fire. Missiles, squad coordination, component damage,
wreck salvage, player/NPC ship collisions, mission rewards and persistence are
not implemented. Combat is offline;
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

The three controller journeys start through the supported orbital launcher, accept
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
