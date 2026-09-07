# SA-WPN-001 — fitted ship weapons in three sizes

Status: active. Human sponsor: Cees. Root owns implementation and integration;
independent mount/functional/visual review uses separate sessions.
Base: `a748be101aad4ea672a157481044ce9ed6b03e35` on `dev/all-features`; isolated `feat/ship-weapon-fittings`.
Preview ports 5410/5411; no shared GPU reservation during CPU authoring.

## Player result

Cobalt pulse, Solar lance and Singularity gain actual manufactured gun bodies in
S1, S2 and S3. Nomad fits S1, Kestrel S2 and Atlas S3. Each shot, beam and muzzle
flash starts at a named barrel-tip node and follows its bore. Larger sizes increase
damage and visible firing/impact scale while preserving each family's identity.
The existing keyboard, controller and touch weapon selector changes the fitted
family as a complete set, matching the current prototype's weapon selection.
No new inventory/economy or paid service is needed. Flyable Atlas and the separate
Mark II studio both receive fittings; this does not make Mark II flyable.

## Contracts and visual target

Metres, +Y docking normal, -Z bore; exact S1/S2/S3 docking diameters from the shared
mount standard. Nomad and Kestrel use actual authored sockets, not hull-relative
pseudo muzzles. Legacy Atlas needs measured surface-supported socket adapters.
Mark II keeps its authored front/aft orientation. Preserve cabin, ladder, gear,
ramp and lift volumes. The common package remains compact enough for Kestrel's
underslung belly mount; final geometry and full moving clearance are measured.

Original Meridian construction: ivory armor shells, dark receivers, exposed steel
barrels, large panel divisions, cooled emitter chambers and family-colored bore
status. Pulse has a linear ribbed accelerator; Solar a shrouded optical lance;
Singularity a ring-coil emitter. Larger variants gain wider receivers/cooling
structure, not only a uniformly scaled prop. Reproducible Blender source, deliberate
bevels/UVs, original baked procedural PBR maps and source/manifest retained.

Target <=4,000 triangles per fitted gun, <=2 material draws at rest, one shared
kit load, <=1024² WebP maps. Report combined loaded/visible payload and equipped
ship scene cost. Scale is judged beside the actual ships and a 1.8 m reference.
No assumed final art/FPS score. Source hull exports and existing painted ship UVs
remain owned by their asset lanes; fittings are independent children of sockets.

## Gameplay and precision

One authoritative shared ship weapon profile supplies size, damage, interval,
speed/range and effect scale. Keep handheld and server weapon behavior unchanged
unless a narrowly justified compatibility hook is required. Online authority is
preserved; this is fitted offline fleet combat, with online behavior explicitly
reported. Offline NPCs use actual barrel poses if their weapons are updated.

Resolve muzzle transforms from the current model hierarchy after its pose update,
then add the double camera origin. Never upload planetary coordinates or fabricate
a camera-front muzzle. The same start/direction feeds obstruction tests, combat
projectiles and effects. Reticle behavior must agree with fixed bores. Firing must
stop on unavailable gun assets, dialogs, focus loss, disconnect and ship changes;
no replay when selecting a new type or returning to flight.

## Acceptance and verification

Measure GLB hierarchy/UVs/materials/bounds, size matching and barrel tips. Test
size monotonicity and real shield/hull damage, exact muzzle transforms under ship
rotation/rebasing/recoil, source/weapon clearances and safe optional-load failure.
Run relevant invariants, full unit/build and contributor helpers. Capture actual
production ship fits and shots in flight, including keyboard/controller/touch
selection/fire/stop, menu/focus/disconnect neutral gates and a physical boarding
and departure route. Inspect emitted projectiles/beams at the barrels, not just
counters. Independent review records current assets and any failed iteration.

## Delivery

Pending implementation and checks. Draft PR and local integration after a coherent
verified checkpoint. No main merge or deployment. Update this brief, HANDOFF,
registry, source-head inventory and review evidence with actual results.
