# Cargo tractor

Cees requests a tractor beam to take crates larger than the 1 SBU hand limit.
This follow-up starts from the checked SBU cargo delivery (25460fa), separately
from the steward's frozen cargo/social promotion.

The first tool is a handheld tractor mode on the existing field multitool.
Menu → Trade equips it; RT / mouse / T powers the beam, aim and movement guide
the crate, and F / X secures a compatible nearby grid slot. Touch uses the same
actions. All seven crate sizes are supported; large crates move more slowly.
Crates remain physical and visible to nearby pilots while detached. A released
crate's inertial arrest holds its last safe pose; it is not silently returned,
deleted or transferred through another ship. Only 1 SBU remains hand-carriable.

The server derives aim, reach, movement and boarding/disabled-ship eligibility.
An expiring exclusive tractor lease prevents two pilots controlling one crate.
Crate location/custody and grid changes save atomically in the existing ledger;
bounded movement cannot tunnel through cargo or closed hulls. Menus, focus loss,
controller loss and disconnect stop movement without losing or duplicating cargo.

Validation covers packing/shape sweeps, lease races, theft eligibility, stale or
replayed commands, persistence/reconnect, plus a complete injected-controller
equip → lock larger crate → move → secure → return journey and phone controls.
Builder inspection is distinct from independent art/hardware acceptance.
