
## Initial host CPU and traffic baseline

Measured 2026-09-07 21:18 UTC on the existing 8-vCPU AMD EPYC host, Node
22.23.2, frozen live runtime f9037eb. Run
`node scripts/multiplayer/capacity-baseline.mjs` in a separate checkout. It uses
only an in-memory store and deterministic synthetic pilots, warms up 300 ticks,
then measures 1,800 ticks (60 simulated seconds). The send callback serializes
real per-pilot snapshots to JSON. It never contacts the live room or database.

| Pilots | Mean tick | p95 tick | Maximum tick | Raw outgoing JSON |
| --- | --- | --- | --- | --- |
| 10 | 0.72 ms | 1.21 ms | 2.11 ms | 13.8 Mbit/s |
| 20 | 2.00 ms | 3.58 ms | 5.61 ms | 53.8 Mbit/s |

The simulation runs at 30 Hz (33.3 ms nominal tick interval), with 15 state
messages/second/pilot. At twenty pilots, measured simulation plus serialization
cost corresponds to about 6% of one CPU core. This excludes socket/TLS, SQL,
network scheduling, combat-heavy scenes and client rendering. It is a starting
baseline, not certification of twenty real players, latency or frame rate.

The current full-room JSON snapshots are bandwidth-heavy: about 6.72 MB/s across
twenty clients in this scenario, or 24.2 GB/hour if continuously full. Actual
traffic depends on scene/state and occupancy. Monitor transfer allowance as well
as CPU; an interest-managed or compact snapshot protocol is a separate future
optimization. No new server or paid service was provisioned.
