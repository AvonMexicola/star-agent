# Cargo tractor

Open **Menu → Trade → Cargo → Equip tractor beam** while standing or in EVA.
The field multitool switches to tractor mode. It uses the existing calibrated
hand/muzzle model and a mint tractor beam; it does not mine or fire weapons.

| Action | Controller | Keyboard / mouse | Touch |
| --- | --- | --- | --- |
| Lock and guide an aimed crate | Hold RT / R2 | Hold T or left mouse | Hold TRACTOR |
| Move the held crate | Move and aim with the sticks | Move and aim normally | Movement / look controls |
| Pull closer / push farther | D-pad up / down | [ / ] | Pull / Push |
| Align to your nearby ship | D-pad left | Click Align to ship | Align to ship |
| Secure a compatible cargo slot | X / Square | F | Secure grid |
| Release in place | Release RT | Release T / mouse | Release TRACTOR |
| Holster | D-pad right | R | Holster tractor |

Lock within **12 m of the crate's surface**. All seven sizes, from 1 through
64 SBU, work with the tractor; **only 1 SBU remains hand-carriable**. Both ships
must be stationary. A 64 SBU container moves at 1 m/s; smaller boxes move faster.
For another pilot's shipment, board their ship or disable it first. A beam does
not bypass a closed hatch, a supporting stack or another pilot's active lock.

Move clear of other cargo and guide the crate toward your ship. A mint wireframe
marks the next compatible free slot once the crate is close enough. Press X/F
to secure it. Align to ship matches its orientation; it requires clear room for
the rotation. A crate too large for the hold cannot be secured there: the Nomad
still holds 6 SBU and accepts individual crates up to 4 SBU; Atlas holds 512 SBU.

Released freight uses its crate arrest field to remain at its last safe position,
including in EVA. It stays visible, solid and available for another tractor lock.
Opening a menu, losing focus or disconnecting stops movement. Release controls
before resuming. The server's short lease expires after 1.5 seconds without an
update, so disconnected players cannot keep crates locked forever.

Solo cargo uses the existing local mining save. Shared freight locations, custody
and grid contents persist in the server ledger. No new account/database setup is
required. Normal saves, developer RAM fixtures and server accounts remain separate.

This first tractor moves physical crates. It does not tow ships, move players,
simulate gravity-driven falls or provide a ship-mounted tractor turret.
