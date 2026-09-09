# Physical tractor custody

The instant `haul` cargo command is retired. New `tractor-grab`, `tractor-move`,
`tractor-release`, `tractor-align` and `tractor-stow` intents act through the
existing atomic commerce transaction. Protocol 4 requires matching client/server.
No new SQL migration is needed: the existing world JSON ledger gains an optional
`loose` dictionary. Old valid saves with no detached freight load unchanged.

A detached crate keeps its original ID, resource, SBU volume, double-precision
world position and unit quaternion. An exclusive 1.5-second lease names its current
operator. A stale/replayed command cannot duplicate freight or refresh an old
lease. Failed writes retain the source grid and the previous committed pose.
At most 2048 loose crates may exist. All crate IDs are checked before dictionary
lookup, including reserved prototype property names.

The server derives ship transforms, operator aim, theft eligibility and the tool
from its existing navigation/inventory authority. Submitted world positions are
ignored. Movement is capped by elapsed server time and size-dependent speed;
whole-crate sweeps check hulls, other freight and station collision. Canonical
terrain and trade-pad floors reject penetration. Rotation requires clear sampled
intermediate envelopes. This is conservative box handling, not rigid-body physics.

Clients send at most five movement requests per second and interpolate committed
poses for rendering. Each update, including the short lease, is durable in the
same world transaction; there is no separate client-owned flight/cargo store.
This deliberately favours simple recovery for the ten-pilot prototype over a
high-throughput physics server. Detached freight persists after disconnect and
uses an arrest field instead of an unsaved gravity simulation. Expiry releases
the lock without deleting or moving the crate.

The existing calibrated mining tool mesh supplies the handheld emitter. Tractor
mode suppresses mining, ammunition use and weapon fire. Native dialogs retain
their common focus/neutral gate. The independent tractor panel only presents
semantic input actions and server/local ledger results.
