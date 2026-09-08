# SA-PIRATE-001 — Ground pirate encounters

Cees supplied two Selene and three Aeon human models and asks for interesting NPCs to fight. Build one playable camp on each world with distinct tactical roles, readable aim windups, real ranged damage/cover, recovery and a finite loot cache. Reuse existing offline equipment, health/inventory and shared controller dialog routes. The encounters are solo; suppress them while connected to authoritative multiplayer.

Five source meshes receive fitted skeletons, skin weights, in-place movement and combat clips. Retain exact inputs and reproducible build, <=20k triangles/2MB per runtime character. Add crouched idle/directional movement to the active expedition player and preserve existing aim/tool/grip/leg calibration. Pickup/carry clips can share the existing library; do not claim a new heavy-object gameplay system.

Own deterministic simulation, camp ground sampling from canonical world functions, rendering relative to camera origin, local cover collision, target/equipment adapter and status/loot UI in src/pirates. Existing input router owns all polling and modal neutral arming. Keyboard and controller must physically land, disembark, fight, crouch, collect real loot, inspect inventory and return to the ship. Add focus/dialog/disconnect/replacement held-trigger tests.

No runtime dependencies, no new online authority/protocol/save schema, no production deployment. Preview5664 and asset review5665; serialize any browser/GPU job through latest HANDOFF and actual process inventory. Independent acceptance and physical controller testing are separate from author/injected checks.
