# Base building — design plan (Rust-style, multi-world)

*Requested by Cees 2026-09-06. Owner: Astra (implementation, per ROADMAP Phase 6). PM: Claude. Status: plan, not built.*

## 1. Fantasy in one paragraph

Land anywhere, plant a **Mainframe** (our tool cupboard), and the ground around it becomes yours: you can place snapped
floors, walls, doorways, windows and stairs, mined and poured from the rock under your feet. Every world gives you the
basics — stone, sand, water, ore for concrete and iron — so a first base is always possible where you stand. Nothing
advanced is local: solar glass wants Selene's silica and helium, alloys want Pyre's sulphur and rare metals, electronics
want asteroid platinum and ice. The tech tree is a map of the system: to build higher you have to fly further.

## 2. Slices (build in this order; each slice is its own PR with the QUALITY.md checklist)

| Slice | Contents | Exit |
|---|---|---|
| **B1 Mainframe + placement** | Mainframe object (place on ground, 1 per base, radius 60 m, ownership + access code, build privilege inside radius); ghost preview; **floors, walls, doorways, windows, stairs** in Tier 1 (concrete); socket snapping; validity rules; save/load | Build a 2-floor concrete hut with stairs and a doorway; a stranger can't build inside your radius |
| **B2 Materials + mining** | Resource nodes (rock, sand, ore, ice, sulphur, silica), hand tool + mining laser yields, inventory mass, the **Concrete Mixer** (stone + sand + water → concrete), **Furnace** (ore → iron) | Mine, mix, pour: a base built from locally mined material on Aeon, Selene and Pyre |
| **B3 Tool tiers + Engineering Station** | Tool tree (§5), the Engineering Station (crafts tools, parts, blueprints), Tier 2 pieces (steel), doors that lock to the code | Craft a Tier-2 tool at the station; upgrade a wall in place |
| **B4 Power** | Wind turbine, solar array, battery, cable/wireless power grid per base, consumers (lights, doors, station, refinery) | A base runs lights and a door on wind at night and solar by day |
| **B5 Tech tree + travel gating** | Research at the Engineering Station using **off-world** materials; Tier 3 pieces (composite), Refinery, Fabricator | You must bring Selene silica and Pyre alloy home to unlock solar glass and Tier 3 |
| **B6 Shield + raids (multiplayer)** | Interference shield from the Mainframe (ROADMAP Phase 6), decay/upkeep, server validation | Two players, one raid, one repair |

## 3. The Mainframe (tool cupboard)

- **Placement**: on ground with slope < 15°, not inside another Mainframe's radius (60 m; Tier 2 core 90 m, Tier 3 120 m).
  One per base. Blender hard-surface prop (§1b recipe): a knee-high server pillar with a mint status ring, a keypad, an
  antenna, a hinged panel showing the upkeep bin.
- **Authority**: the placer is owner; owner sets a **4-digit access code**; anyone who enters the code at the keypad is
  *authorized* (build, open coded doors, use stations). Authorization list lives on the Mainframe (server-side in Phase 5).
- **Build privilege**: within the radius only authorized players can place, upgrade, rotate or remove pieces; outside
  the radius anyone can build (but not overlap another radius). Unauthorized players inside the radius get "BUILD
  BLOCKED — MAINFRAME 41 m" on the HUD.
- **Upkeep** (B6): pieces inside the radius decay unless the Mainframe's bin holds materials; decay 24 h per tier
  (Rust rule). Single-player: decay off by default.
- **Later**: the Mainframe is also the base's network node (power grid root, shield emitter, map marker, respawn point).

## 4. Building pieces — Tier 1 set (B1)

Grid: 4 m foundation module, 3 m wall height, snapping via named **sockets** on each piece (glTF empties):
`S_Floor_N/E/S/W` (floor-to-floor), `S_Wall_N/E/S/W` (floor-to-wall bottom), `S_WallTop_*` (wall-to-floor above),
`S_Stair_Top/Bottom`. Placement = nearest compatible socket within 1.5 m of the aim ray hit, else free on terrain
(foundations only). Pieces are instanced meshes per type+tier; the base is a list of `{type, tier, parent, socket,
rotation, hp}` records (see §8).

| Piece | Size | Notes |
|---|---|---|
| Foundation | 4 × 4 × 0.5 m | Levels to terrain: legs extend to the ground up to 3 m (auto), else "TOO STEEP". First piece of any base. |
| Floor | 4 × 4 × 0.25 m | Upper storeys; needs a wall or pillar under a corner. |
| Wall | 4 × 3 × 0.25 m | Solid. |
| Doorway | 4 × 3 wall with a 1.2 × 2.2 opening | Accepts a Door (locks to the Mainframe code). |
| Window | 4 × 3 wall with a 1.6 × 1.0 opening | Accepts Window Glass (Tier 2+) or bars. |
| Stairs | 4 × 4 footprint, rises 3 m | Straight run; U-turn variant in B3. |
| Pillar | 0.5 × 3 m | Support for floors without walls. |
| Roof (B3) | 4 × 4 sloped | Later. |

Tiers (visual + hp): **T1 Concrete** (poured grey, form-board texture, 500 hp) → **T2 Steel** (panelled, dark polymer +
brushed metal, 1 500 hp) → **T3 Composite** (white armour + mint seams, 4 000 hp). Upgrade in place with a hammer
(hold, pays the material delta). Pieces are Blender-script assets (`blender/build_base_pieces.py`), one texture set per
tier, ≤ 2 k tris each.

## 5. Tools and tiers

| Tier | Tools | Made at | Needs |
|---|---|---|---|
| T0 (start) | **Hands**, **Survey scanner** (shows nodes), **Multitool** (hammer/wrench: place, rotate, upgrade, repair) | given | — |
| T1 | **Pick** (stone/ore ×1), **Shovel** (sand ×1), **Canister** (water) | Multitool, no station | 20 iron, 10 stone |
| T2 | **Mining laser** (already exists: ×3 yield, heat), **Power drill**, **Welder** (steel pieces) | Engineering Station | steel, copper, a power cell |
| T3 | **Ore extractor** (placed, automatic, powered), **Fabricator** (composite pieces, electronics) | Engineering Station + research | composite, electronics, off-world materials |

The **Engineering Station** (B3) is a placed bench (2 × 1 m, powered in B4, hand-cranked before): crafts tools and parts,
holds blueprints, and is where **research** happens (B5): drop off-world materials to unlock recipes.

## 6. Materials and where they come from (the travel loop)

**Rule: everything Tier 1 is minable on every body; each higher tier needs at least one material from another body.**

| Material | Aeon | Selene (moon) | Pyre (hot) | Ring asteroids | Used for |
|---|---|---|---|---|---|
| Stone | ✔ cliffs/boulders | ✔ regolith rock | ✔ basalt | ✔ | concrete, T1 |
| Sand | ✔ beaches, deserts | ✔ regolith | ✔ ash | — | concrete, glass |
| Water | ✔ lakes/sea (canister) | ice (polar craters) | — | ✔ ice | concrete, refinery |
| Iron ore | ✔ outcrops | ✔ | ✔ | ✔ | T1 tools, steel |
| Copper | ✔ (rarer, hills) | ✔ | ✔ | ✔ | wiring, T2 |
| Wood | ✔ trees | — | — | — | scaffolds, furniture, campfire |
| **Silica (glass-grade)** | — | ✔ highland regolith | — | — | window glass, **solar glass** |
| **Helium-3** | — | ✔ (regolith, extractor) | — | — | fusion cell (T3 power) |
| **Sulphur** | — | — | ✔ vents | — | alloys, batteries |
| **Rare metals** (titanium/vanadium) | — | trace | ✔ lava plains | ✔ | T3 composite, drills |
| **Platinum-group** | — | — | — | ✔ metallic asteroids | electronics, fabricator |
| Crystals (caves, Phase 6) | ✔ caves | ✔ deep | ✔ | — | sensors, shield emitter |

**Concrete on every world**: stone + sand + water (or ice) at the **Concrete Mixer** (B2, a placed prop). On Selene the
water comes from polar ice (canister on ice nodes), on Pyre from a **Water Reclaimer** on the Engineering Station (T2)
or hauled from Aeon — so Pyre bases are possible but cost a trip or a tier. Ice asteroids make the ring a water source.

**Node design**: resource nodes are placed by the same scatter system as props (seeded per body), visible with the
Survey scanner as HUD markers within 300 m. Yield per hit by tool tier; nodes deplete and respawn (24 h). Voxel mining
(caves, asteroids, outcrops — ROADMAP Phase 6) replaces the hit-the-node model for ore later.

## 7. Power (B4)

- **Wind turbine** (12 m mast, Blender prop): output by altitude and a per-body wind field (Aeon 0.3–1.0, Pyre 0.2–1.5,
  Selene 0 — no air; the HUD says so). **Solar array** (2 × 4 m panels): output by sun elevation and body distance
  (Pyre ×6, Selene ×1, Aeon ×1, night 0). **Battery** stores 10 kWh. **Fusion cell** (T3, He-3) constant 5 kW.
- Grid: each base has one grid rooted at the Mainframe; producers/consumers within the radius connect automatically
  (no cable spaghetti in v1; cables are visual only, drawn as curves along floors). Consumers: lights (auto at night),
  coded doors, Engineering Station (T2 recipes), Refinery, Ore extractor, shield (B6).
- HUD: base power page on the MFD/menu: generation, load, battery %.

## 8. Data and code shape (for Astra)

- `src/build/` — `pieces.js` (catalog: type, tier, sockets, hp, cost), `placement.js` (aim ray, socket snap, validity,
  ghost), `base.js` (records, save/load JSON per seed, instancing, decay), `mainframe.js` (radius, auth, code), `power.js`
  (grid solve per frame at 1 Hz), `resources.js` (nodes, yields, inventory), `crafting.js` (recipes, stations, research).
- Base record: `{ id, mainframe:{pos, dir, code, owner}, pieces:[{id, type, tier, pos, quat, parent, socket, hp}],
  stations:[…], grid:{producers, consumers, battery} }` — server-authoritative in Phase 5; local `localStorage` until then.
- Assets: `blender/build_base_pieces.py` (all pieces × tiers), `blender/build_base_props.py` (Mainframe, Mixer, Furnace,
  Engineering Station, Turbine, Solar, Battery, Extractor), one texture set per tier via the §1b recipe; sockets as named
  empties; manifest rows.
- Tests: snapping math, validity (overlap, support, slope), power solve, recipe gating by material origin, decay clock.
- Dev page `/dev/build.html`: flat ground, unlimited materials, all pieces, screenshot tour for the reviewer.

## 9. Open decisions (Cees)

1. Gravity/tier feel: should T1 concrete be *ugly on purpose* (form-board, rebar) so T3 composite feels earned?
2. Single-player decay: off (proposed) or on with a long clock?
3. Stairs: straight only in B1, U-turn in B3 — fine?
4. Should the Mainframe double as the respawn point from B1?
