# Station shopkeepers

Add the supplied adult female Crimson Outrider model behind the small-arms
counter in Aeon Orbital's existing Watchkeep Armory, and the supplied male
Cybertech Mechanic behind Kestrel Shipworks opposite. Both should feel present
through all four supplied idle animations, with smooth transitions and stable
feet. Keep the existing physical shop approach, purchase modal, warehouse
delivery and controller/touch bindings. This is a visual merchant integration,
not a new dialogue, combat, stock or server-authority system.

Base: 4706d62e92c002ce5a326c53cd8ee9ac07543645, isolated feat/station-shopkeeper.
Sources: user-provided Meshy_AI_Crimson_Outrider_biped.zip and
Meshy_AI_Cybertech_Mechanic_biped.zip; generation settings
were not supplied. Preserve the original archive and an editable/reproducible
Blender source. Combine four idles into one mesh/skin asset, normalized to feet
at Y=0 and front -Z, about 1.72 m female / 1.8 m male adult height. Default character targets remain
20k triangles / 2 MB / 1024px textures; inspect before any reduction.

Runtime: two optional merchants in the central hub, never one per hangar pod.
Each retains an independent animation mixer and four supplied idle clips.
Load when the player enters the hub; freeze animation when hidden or paused.
Keep meshes local to the hub's existing double-precision rebasing transform,
retain authored character materials, and use current shop lights. A small torso
collider behind the counter should preserve both customer and staff clearance.

Verification: actual exported clip/bounds checks, loader/animation lifecycle
regressions, build, game-rendered views and a controller-only hangar/elevator/
shop purchase/return journey. Record failures, exact identities and applicable
independent review; public deployment and shared promotion stay separate.

User visual correction, 2026-09-07: the supplied idle arms are held too far
outward and backward, making the shoulders appear pinched together. Correct both
characters' resting shoulder/upper-arm baseline to a relaxed stance: arms hang
near the sides, slightly forward, with a gentle elbow bend and hands beside the
thighs. Preserve intentional expressive gestures and continuous transitions.
This explicitly permits correcting derived bone animation tracks. Exact source
packs remain unchanged, and receipts must identify modified tracks honestly.
The previous uncorrected exports and their studio scores are historical evidence,
not accepted final merchant poses.
