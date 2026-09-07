# Atlas fleet refresh

Cees requested Atlas next after the Kestrel and Nomad visual overhaul, and
observed that all three ships read as a related family. This continuation brings
the original Atlas Mark II heavy hauler through the same silhouette, materials
and independent-review workflow. The existing cargo layout is the foundation.

## Baseline and ownership

- Isolated branch `feat/atlas-fleet-refresh`, based on integration `6f80fc0`.
- Future PR target is `main` under the current repository policy, with the
  consolidated PR #34 baseline declared as a dependency.
- Existing Atlas development PR #30 is draft at `7b97f5a`; that commit is already
  an ancestor of this integration baseline. Preserve its source and physical work.
- Root owns this brief and the refresh lane. Nomad remains the active production
  priority; this document prepares Atlas's next production pass.
- Scope: `assets/atlas-mark-ii/`, its runtime GLBs, Atlas studio/systems/controls,
  focused tests and review evidence. Shared gameplay changes require a deliberate
  integration scope; do not replace the legacy flight-ready Atlas by file swap.

The current hero is 412,988 triangles and 38,037,892 bytes, SHA-256
`a3b6e095060b965fbc51bb7e87dea4f985521d114efeaf5493d18bfe9ea434aa`.
It has 168 static batches, 13 materials and 10 textures. The studio adds four MFD
surfaces. Its previous independent 2.4/5 review concerns the initial model; later
fixes have no independent art approval. This is a measured starting point.

## Player experience and physical contract

Preserve the 64 × 36 × 16 m nominal unarmed envelope and authoritative
`assets/atlas-mark-ii/layout.json`. The 14.4 × 48 m hold has a clear 8 m vehicle
lane, floor at 2.6 m and ceiling at 8.8 m. Front and rear 11.6 m loading ramps
retain their independent 6 m main leaves and 2 m folding tips. Keep the crew lift,
upper deck at 9.5 m, four readable seated MFDs, enclosed berths, galley/hygiene
circulation and physical F/A/TAP controls.

Exterior gear must have named, believable stowage and moving-part clearance.
Three S3 fittings retain the shared mount frame and exact-size compatibility.
No installed weapons or combat statistics are implied. Every modified floor,
door, ramp or lift must agree with its collision and state owner.

## Family and visual direction

Keep each role immediately legible: Nomad is the compact solo utility tender,
Kestrel the light interceptor and Atlas the heavy logistics ship. Share ivory
ceramic armour, graphite structure, restrained petrol service covers, brushed
metal mechanisms, mint status light and amber access/warning marks. Use fitted
panel returns, recessed glazing, exposed load paths and deliberate service
access; scale the construction family to a ship carrying large cargo.

The proposed manufacturer is **Meridian Shipworks**. It is a working name pending
Cees's preference, not an approved decal or established lore. Keep identity data
centralized; finish the mechanics and construction without baking a provisional
manufacturer into every texture. The ship names remain Nomad, Kestrel and Atlas.

The original C2 cargo-flow and Caterpillar industrial references remain in
`docs/design/atlas-mark-ii.md`. They guide role and construction; retain original
geometry, markings and source provenance. Start with a fresh actual-renderer
baseline of exterior, bow, stern, side, plan, hold, boarding, crew and seated views.

## Production sequence and acceptance

1. Independently review the current silhouette and human scale before adding
   detail. Rebuild primary forms until silhouette is at least 4.5/5. Preserve
   successful circulation and the actual pilot eye while reshaping the exterior.
2. Budget from the start: target the existing 60,000-triangle / 4,000,000-byte ship
   limit and at most 1024² WebP runtime maps. The full visible ship includes its
   interior and dynamic fittings. Use shared trims, baked fine detail and explicit
   LODs; report aggregate costs. Do not silently inherit the oversized hero as an
   exception or trade a destroyed silhouette for a low triangle count.
3. Use scripted Blender geometry, reusable parts and authored material regions.
   Keep editable source, stable moving pivots and clean UVs. Follow the current
   Kestrel material workflow: Meshy text-to-texture on a validated opaque painting
   shell, retain original UVs, verify the returned atlas and apply only the maps
   to the original rig. Preserve exact prompts, source hashes and failed findings.
4. Bake/pack with material-specific roughness/metalness, contact AO and restrained
   generated wear. Verify plain material response, grazing angles, seams and
   registration placement in the actual Three.js renderer. Do not paint lighting
   into the albedo or mistake a concept for a game screenshot.
5. Run unit/build checks, physical boarding → hold → lift → crew/galley/bridge
   journey, ramp/lift/gear cycles, seated screen framing, phone UI and supported
   keyboard/controller/touch input. Collect browser errors and inspected images.
6. Profile affected views at 1440×900 on the actual hardware backend. Record
   draws, triangles, GPU work and frame pacing separately; do not infer full-game
   FPS from an isolated studio. Preserve the project scene budgets.
7. Obtain a fresh independent six-criterion review, target at least 4.2/5 with
   every criterion at least 4. Preserve failures and specific closures. Submit
   the resulting source, asset, tests and evidence as a reviewable PR for Cees's
   gate. No merge or deployment is implied.

Use `docs/asset-production-standard.md`, `SHIP-PIPELINE-MEMORY.md`, the existing
Atlas design/control records and the current Kestrel production record together.
Where old Atlas notes require an Opus session, Cees's later Astra/Codex reviewer
workflow takes precedence. This brief starts work; it claims no new render,
optimization, material generation, successful check or visual approval.
