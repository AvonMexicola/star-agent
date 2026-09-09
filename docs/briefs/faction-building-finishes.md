# SA-BUILD-003 — faction paint and rigid site graphics

Active; Cees requests different building colours, faction posters/decorations,
corporate landing sites and crimson pirate bases on Selene and Miasma. Both pirate
bases must be vacuum architecture: rigid enclosed habitats, roofs and airlocks;
no tents. Base `cc1e749`, isolated `feat/faction-building-finishes`, 5684/API8684.
Parent owns build/faction appearance and four public settlements; the explicitly
delegated pirate author owns the second site and both habitat entrances at 5686.

Eight curated paints preserve the existing authored kit geometry, UVs, concrete
textures, glass, steel, status lights and collisions. A native Finishes tab supports
new placement and recolouring an owned part through the same controller router.
Eight original deterministic rigid prints support solid wall faces and designated
pad markings. No cloth or new tent assets. Prints identify six factions/corporations
and two safety procedures; they do not promise simulated pressure or reputation.

Four existing trade sites retain their names, coordinates, economic identities and
garages: Verdant Materials at Greenbank, Tidemark Logistics at Stillwater, Cinder
Industrial at Ember, Vesper Extraction at Verdigris. Crimson Pact identifies pirate
bases. Existing Meridian Shipworks emblem/provenance remains intact.

Optional allowlisted `finish` / `graphic` fields extend version-1 piece records.
Absent fields retain the original appearance; invalid values are rejected by shared
client/server base validation. Geometry/cost/storage/door/power authority is unchanged.
Atomic existing save writes retain appearance across reload; cosmetics cost no
materials. Painting remains an offline construction action, with existing optional
solo cloud-save handling. This additive cosmetic contract needs no protocol/schema
or terrain-generator change; preserve unknown later feature hooks on integration.

Acceptance requires a complete controller-only production sandbox route (choose,
place, repaint, inspect inventory, persist, return), keyboard/native touch checks,
focus/modal/held/device suppression, and actual game-rendered before/after site
views. Check resource lifetime, per-instance isolation, print clearance and physical
invariants. Record browser/backend/scene metrics and original failed attempts.
Formal independent art, hardware and performance acceptance remain separate from
a labelled checked local development integration. No public deployment.
