# Deep-space cargo recovery

Development candidate; complete browser acceptance and local integration are
still pending. These contracts run in solo flight.

Open **Menu → Contracts → Cargo recovery** (or **Trade → Recovery**), choose your
cargo ship and accept a contract. Acceptance reserves the job and marks a distress
signal. It does not issue cargo or move your ship.

| Contract | Defenders | Cargo | Terminal payment |
| --- | --- | --- | --- |
| Silent Atlas | None | 2 × 2 SBU | 900 CR |
| Raider claim | Nomad and Kestrel | 2 × 2 SBU | 1,500 CR |
| Broken convoy | Nomad and two Kestrels | 3 × 2 SBU | 2,400 CR |

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
   secures an available grid slot. Haul each crate through the opening. D-pad
   right holsters the tractor. Return slowly to your ramp and walk to the chair.
5. Track Greenbank Supply on Aeon, land the loaded ship on its pad, walk to the
   terminal and choose **Recovery → Deposit all**. All original crates must be
   secured aboard the selected ship. The terminal removes the manifest and pays
   once; ordinary crates cannot replace it.

The crates belong to the accepting pilot and cannot be sold as ordinary goods.
Abandoning recalls that mission’s cargo and pays nothing. Unload unrelated crates
stacked above recovery cargo before depositing or abandoning. Reloading preserves
the same mission and original crate identities; it does not create replacements.

Keyboard tractor controls: hold T, `[`/`]` changes distance, interact secures and R
holsters. The onscreen tractor panel supplies touch controls. Physical-device and
other-hull journey testing remain separate from injected Gamepad checks.

[Development evidence and limits](qa/deep-space-recovery/README.md).
