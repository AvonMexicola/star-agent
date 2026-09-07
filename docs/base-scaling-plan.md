# Scaling player settlements

Cees asked how to avoid slowdown after hundreds of buildings, 2026-09-07.
This is a profiling/implementation plan, not a measured capacity claim.

## Current audit

`BuildSystem.update()` calls `sync()` every frame. Both traverse all claims and
pieces. Every saved piece receives a render object; distant claim groups become
invisible after a 500–600 m fade, but remain resident and participate in application
updates. Door motion, opacity changes and turbine animation continue in that loop.
Service lights are already capped at four and fade out by 28 m. Power has a
one-second status cache and ten-second local update interval, with timestamp-based
offline settlement on the server. These are useful starting limits, not a solution
for hundreds of dense bases. Prototype claim/piece limits remain in force.

## Priority order

1. Measure current 100/500/2,000-piece scenes and scattered sites separately from
   one dense settlement. Record frame-time percentiles, build CPU time, draw calls,
   triangles, resident model memory, load hitches, collision candidates, save size
   and server upkeep duration. Do not extrapolate an empty-scene FPS measurement.
2. Replace per-frame full synchronization with layout/door/power dirty revisions.
   Cache static transforms and display text. Traverse only active nearby pieces;
   sleeping door animations reconcile to saved endpoints on activation. Power loss
   and expiry still apply remotely. Frustum-hidden sites must not lose collision
   if an actor is inside them.
3. Index sites and pieces spatially. Stream nearby sites, use a simplified exterior
   at intermediate distance and unload detailed objects far away. Keep database
   records and navigational markers. Queue asset creation across frames and retain
   shared GLB geometry/material caches correctly when individual instances unload.
   Use hysteresis to avoid thrashing at distance boundaries. Flight speed determines
   look-ahead loading; floors/collision must be ready before a landing or entry.
4. Instance repeated wall/floor/foundation primitives in spatial chunks by geometry
   and material. Keep moving door leaves, interactive indicators and transparent
   windows separate as appropriate. Preserve instance-to-piece identity for aiming,
   damage and editing. Cull chunks, not one world-sized batch. All GPU transforms
   retain the project's double-precision origin-subtraction contract.
5. Limit shadowed lights, particles and expensive interiors by distance. Preserve
   a recognizable distant silhouette and large landing-pad visibility. Tune
   thresholds from measured visual size and approach speed, not an arbitrary short
   draw distance that makes large bases suddenly appear underneath a ship.
6. Shared multiplayer requires body/cell interest subscriptions and incremental
   versioned commands instead of sending every player's buildings to everyone.
   Server collision/access must remain authoritative even when a client's render
   object is absent. Batch upkeep by timestamps with cached power topology, bounded
   work queues and a next-update/expiry schedule; rendering distance never pauses
   fuel consumption or decay. Snapshot-on-every-ten-seconds is a solo starter
   mechanism and should not become a global multiplayer broadcast.

Verification must include build/remove while crossing stream boundaries, shared
mesh disposal, stale asynchronous loads after expiry, fast ship approaches, doors
and collision on reload, remote access revocation, and offline upkeep with thousands
of inactive records. Performance acceptance requires measured budgets on the target
hardware and explicit browser/backend/resolution, alongside the existing controller
and visual journeys.

Reference: Three.js `InstancedMesh` reduces draw calls for repeated geometry and
materials: https://threejs.org/docs/pages/InstancedMesh.html . Apply it to the
installed library version and validate actual batching in the renderer.
