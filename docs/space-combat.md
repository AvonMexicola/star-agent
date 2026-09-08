# Space patrol combat

The combat loop runs offline in the current integrated game. It uses the
existing Nomad 02 and Kestrel GLBs, camera-relative rendering, shared ship weapons
and controller dialog/input router. No new external services or assets are needed.

## Play

1. Fly an armed Nomad, Kestrel or Atlas to Aeon, Selene, Pyre, Miasma or
   Selene's asteroid belt. Ordinary flight and map travel both work. The local
   launcher also supplies explicit location starts for testing.
2. Open **Patrol console** or **Menu → Contracts**. Choose **Easy**, **Standard**
   or **Hard**; the brief shows the actual local enemy roster and wave count.
3. **Accept patrol**, resume, and follow the amber beacon. In clear orbit it is
   3 km ahead; surface dispatch puts it 30 km above the local terrain. Climb and
   align with the marker before accelerating. Station dispatch remains beyond
   the shipping lanes. Belt dispatch uses a clear lane above the asteroid plane.
   Acceptance never moves your ship. Contacts activate within 1.1 km.
4. Destroy the advertised flight. Hard missions bring a second wave after a
   ten-second warning. Stay within 9 km of the beacon while shields recharge.
5. Open **Contracts → File combat report**. The report records location,
   difficulty, kills, waves, active sortie time, shots, hits and hull at completion.
   The last three reports are shown; twelve are retained for this session.

| Region | Easy · 1 ship | Standard · 2 ships | Hard · 2 + 3 ships |
|---|---|---|---|
| Aeon orbit | Shipping lane sweep | Outer perimeter patrol | Orbital blockade |
| Selene orbit | Lunar picket | Far-side intercept | Silent horizon |
| Pyre orbit | Ash runner | Cinder patrol | Ember siege |
| Miasma orbit | Haze watcher | Veiled ambush | Toxic cordon |
| Selene asteroid belt | Claim jumper | Belt interdiction | Broken ring |

Easy encounters have 65% integrity, slower turns and lower firing pressure.
Standard uses full ship integrity and normal pilots. Hard uses 120% integrity,
faster pilots and higher firing pressure. Weapon damage still comes from the
actual fitted gun size; difficulty changes NPC firing intervals. Selene's pickets
favor interceptors, Miasma's patrol uses two raiders, and Pyre's standard flight
uses two Kestrels. Each Hard sortie has its own roster, listed before acceptance.

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
wreck salvage, player/NPC ship collisions, NPC asteroid/terrain avoidance, credit or cargo rewards and persistence are
not implemented. Combat is offline;
multiplayer keeps server authority and does not run this NPC simulation. Contracts,
reports and combat integrity reset on reload. Opening a dialog or losing focus
pauses combat. Leaving the engagement, boarding or engaging travel abandons it. A ship change, crash or multiplayer connection cancels an active sortie. A completed report keeps the finish state even if you fire, repair or switch ships before filing it.

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


Regional encounter checks use `scripts/enemy-encounters.config.js` on owned port
5398. Its production-game routes select a difficulty through the real controller
menu, steer to the beacon, fight, inspect the report and return to flight. The
fixture reads debug state for feedback; it changes only injected Gamepad inputs.
Keyboard and native touch cases cover the new selection/accept/abandon controls.
See [regional encounter QA](qa/enemy-encounters.md) for actual results and limits.
