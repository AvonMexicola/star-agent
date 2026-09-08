# K-17 Mk1 rotating field cutter

Cees supplied the yellow `mining tool mk1.png` reference and requested a revolving
head, with possible different heads for future tiers. Replace the existing
handheld cutter's visible model; retain its actual two-hand grip, 8 m surface
reach, heat budget, mining yield, inventory transactions and input routes.

The fixed yellow receiver, rear power pack, pistol grip and foregrip support a
three-lobed rotating cartridge. A fixed central optical shaft keeps the emitted
beam on its calibrated axis. The cartridge accelerates while the actual beam
operates and coasts when it stops. It cannot rotate the grips or grant extraction.
The named K17-M30 mounting datum prepares later cartridges; Mk1 is the only
implemented head. No upgrade economy or tier bonuses are included.

Budgets: 10,000 triangles, 1 MB GLB, at most six draw primitives (rigid body and
moving head cannot be batched together), three 1024² PBR maps. Normal and ORM
remain byte-identical shared handheld atlases; one cutter-specific yellow map
adds about 5.33 MiB GPU residency including mipmaps when both palettes are loaded.

Acceptance: native model/rig and actual Selene mining views; full controller
landing, disembarkation, aim, mining, collected result inventory and return;
keyboard/native touch checks; held-input focus, modal and disconnect gates.
Inspect whole-revolution bearing clearance, fixed emitter alignment and UV/PBR.
Physical controller, independent art review and measured FPS remain separate.
