# Rare Aeon landmark formations

User request: restore the missing large rocks, with interesting overhangs and
dynamic silhouettes; approximately the rare one percent should give an area character.

Keep the mineable basalt stones and existing canonical terrain. Add a separate,
seeded Aeon bedrock layer: roughly 50–120 m tall, broad undercut mesas, leaning
split fins, and occasional natural bridges. Real mesh undersides and matching
collision must preserve open space below overhangs. Reuse the bundled CC0 Rock030
maps with metre-scaled weathering. No new dependency, mined-rock identity, save
schema, terrain height or input binding is required.

The layer needs bounded streaming, shared geometry, gradual LOD transitions,
camera-relative GPU transforms, exclusions for vegetation, and physical collision.
Verify deterministic placement/geometry, underside clearance and swept contact,
then inspect actual ground/approach renders and a controller traversal. The first
delivery targets Aeon, where the preceding loose-stone replacement exposed the
missing scale. Other bodies retain their current formations.

Base: f8e48d9, isolated branch feat/landmark-rocks. Own new src/landmark-*.js,
their tests/browser capture, and narrow hooks in main, forest distribution,
vegetation, and mining occlusion. QA port 5381; shared preview 5178 and persistent
API/database remain owned by their existing service. Local integration is a
development checkpoint; independent art review and public release are separate.
