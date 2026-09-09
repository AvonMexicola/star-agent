# Deep-space cargo recovery

Development candidate; complete browser acceptance and local integration are
still pending. These contracts run in solo flight.

Open **Menu → Contracts → Cargo recovery** (or **Trade → Recovery**), choose your
cargo ship and accept a contract. The grid requirement is a planning notice; a
full or undersized hold does not block acceptance. Acceptance reserves the job and marks a distress
signal. It does not issue cargo or move your ship.

| Contract | Defenders | Required container | Optional loot | Payment |
| --- | --- | --- | --- | --- |
| Silent Atlas | None | Atlas flight recorder · 2 SBU | 1 × 2 SBU | 900 CR |
| Raider claim | Nomad and Kestrel | Navigation archive · 2 SBU | 1 × 2 SBU | 1,500 CR |
| Broken convoy | Nomad and two Kestrels | Convoy data vault · 2 SBU | 2 × 2 SBU | 2,400 CR |

Each mission needs **one 2 SBU container slot: 0.6 × 0.6 × 1.2 metres**.
Optional loot needs its own additional grid space. The notice checks actual slot
shape as well as showing free SBU.

1. Track the disabled Atlas and fly to its deep-space signal. The drive stops
   at20km; approach in normal flight. Your marked crates appear inside its aft
   cargo bay when you reach the wreck. Both ramps are already open.
2. For guarded jobs, switch to Combat mode in Menu → Ship and destroy the
   defending flight from an armed Nomad or Atlas.
   Clearance is saved. Leaving before clearance lets the defenders regroup.
3. Brake completely, stand with X and physically walk out through your open rear
   hatch. EVA to the Atlas aft bay. These2SBU crates require the tractor beam.
4. Equip the tractor through Recovery or Cargo. Hold RT to lock and guide a crate;
   left/right sticks move/aim, A/B translate vertically in EVA, LT brakes. D-pad
   up/down adjusts distance, left aligns the crate to your nearby ship, and X
   secures an available grid slot. Haul the required container through the opening; take any optional loot you want.
   Load bonus cargo below the mission container so it remains supported at delivery. D-pad
   right holsters the tractor. Return slowly to your ramp and walk to the chair.
5. Track Greenbank Supply on Aeon. If Aeon blocks the route, navigate around the
   planet before engaging the delivery drive. Land the loaded ship on its pad, walk to the
   terminal and choose **Recovery → Deposit mission cargo**. The specific original mission container
   must be secured aboard the selected ship. The terminal removes only required
   mission cargo and pays once. Bonus loot cannot replace the objective; leaving
   it behind does not block completion. Secured bonus loot remains yours to sell
   through the ordinary Cargo tab.

The marked mission container belongs to the accepting pilot and cannot be sold
as ordinary goods. Bonus containers are private optional loot until secured and
may then be sold. Abandoning recalls required and unsecured cargo, keeps secured
bonus loot, and pays no mission reward. Unload bonus or other cargo stacked above
the mission container before depositing or abandoning. Reloading preserves the
same mission and crate identities; it does not create replacements. Earlier
accepted development saves retain their original whole-manifest terms.

Keyboard tractor controls: hold T, `[`/`]` changes distance, interact secures and R
holsters. The onscreen tractor panel supplies touch controls. Physical-device and
other-hull journey testing remain separate from injected Gamepad checks.

[Development evidence and limits](qa/deep-space-recovery/README.md).
