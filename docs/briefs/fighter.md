# Brief: "Kestrel" — sleek single-seat fighter (high-effort, Astra)

*Requested by Cees 2026-09-06. Owner: Astra (Blender script + Meshy texturing, QUALITY.md §1b recipe). Deliver as one PR
against `main`/integration with a ship-studio page and a reviewer-session rubric score ≥ 4.2.*

## Intent
The hero combat ship for Phase 4: a light, fast interceptor that reads as *sleek* from every angle — long nose, low
canopy, blended wing-body, thin swept wings with tip fins, twin engines with big nozzles. References (put images in
`docs/refs/fighter/`): Star Citizen Gladius/Arrow, Elite Eagle/Viper, F-16/F-35 and the YF-23 for the blended body,
the Nomad for our faction language (white armour, dark polymer, brushed metal, mint #b6efd1 accents, amber warnings).

## Numbers
- 13.5 m long, 9 m span, 3.2 m tall on gear; belly 0.9 m above ground when landed; origin at the ground-contact plane
  (y = 0), nose −Z, like `ship.js`/the Nomad. Ship budget: ≤ 60 k tris (exterior + cockpit), ≤ 4 MB with 1024² WebP maps.
- Mass 9 t, 2 engines, RCS: 12 nozzles (named `RCS_*`) so the flight model can puff them. Fuel/heat placeholders.
- Hardpoints (named empties, Phase 4 mounts): `HP_Nose` (gun), `HP_WingL/R` (guns or missile racks), `HP_Belly`
  (missile bay). Sockets face −Z, origin at the mount plate.
- Cockpit: single seat, canopy that opens (glTF animation `CanopyOpen`, 3 s), 4 MFD quads named `MFD_1..4` sized
  4:3 at 512×384 px equivalent, a HUD glass plane `HUD_Glass`, stick and throttle, pilot eye empty `PilotEye` at the
  seated eye position (the Meshy pilot sits here via `sit-idle`).
- Landing gear: 3 struts (`Gear_Nose`, `Gear_L`, `Gear_R`) as separate nodes with a `GearDown` animation (1.2 s) —
  `landing-gear.js` drives compression on the strut nodes.
- Engines: nozzles `Nozzle_L/R` with an emissive inner throat (mint→white by throttle), afterburner cones as separate
  hidden meshes `AB_L/R` the code scales.
- Boarding: hatch or canopy entry from the ground (ladder that folds: `Ladder`, animation `LadderDown`), consistent with
  the boarding loop (`boarding.js`).

## Process (QUALITY.md §1b)
1. Blockout in Blender by script (`blender/build_fighter.py`): silhouette first — render 4 turntable angles + a
   3/4 front and a rear view with an HDRI in EEVEE; a **reviewer session** scores silhouette only; iterate until ≥ 4.5
   on criterion 1 before adding detail.
2. Detail: bevels, panel seams (EXACT booleans), intake/exhaust, canopy frame, sensor blisters, wing-root fairings,
   maintenance hatches from the kitbash library, cable/greeble runs via Geometry Nodes on the belly and behind panels.
3. Materials: `blender/materials.py` node groups (edge wear, cavity grime, panel darkening); then **Meshy text-to-texture
   on the uploaded mesh** for decals/wear (squadron markings, mint stripes, "NO STEP", serials), baked back to 1024² WebP.
4. Cockpit: separate interior mesh, same material pass; MFD quads receive the existing `ship-mfd.js` canvases.
5. Verification: Node GLTFLoader check of all named nodes/animations/budgets; ship studio page (`/dev/ship.html` pattern)
   with exterior, cockpit, gear/canopy/ladder animation toggles; Playwright screenshots; `npm test`; rubric review by a
   different session (silhouette, materials, lighting, cohesion, function, motion) — target ≥ 4.2 overall, nothing < 4.
6. Integration is a separate PR (selectable ship in the hangar berth next to the Nomad; flight model tuning: higher
   accel/turn, lower cargo).

## Not in scope
Weapons firing, damage model, shields (Phase 4). Cargo. Multi-crew.
