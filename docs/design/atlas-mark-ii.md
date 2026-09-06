# Atlas Mark II — heavy logistics asset candidate

An original 64 m heavy cargo ship, authored in Blender in metres. This is an asset-development branch, not a claim of Star Citizen production parity or a replacement for the current flight-ready Atlas. A dedicated inspection scene exercises its authored ramp and elevator nodes.

## Design reference

Cees requested the large through-loading hold of a Hercules C2 with a more angular, industrial exterior influenced by the Drake Caterpillar. Reference research used the [official Hercules introduction](https://robertsspaceindustries.com/en/comm-link/transmission/16550-Introducing-The-Hercules-Crusaders-Premier-Tactical-Starlifter), [C2 interior gallery](https://robertsspaceindustries.com/community-hub/post/hercules-c2-interior-Pz6fS4ImtMyMs), and [official Caterpillar brochure](https://robertsspaceindustries.com/media/v5ecpi8q1rvyur/source/Caterpillar_brochure.pdf). Study images remain outside the repository. No Star Citizen mesh, texture, branding or audio is included.

The resulting original design uses unequal flank armour segments, exposed service channels, sloped bow cheeks, a continuous loading arch, octagonal drive pods with recessed mechanical exhausts, six landing feet and a recessed wedge bridge. The aft engineering fairing slopes down from the crew deck. Ivory replaceable armour, graphite pressure structure, muted petrol service covers and restrained mint/amber practical lighting form the material palette.

## Authoritative layout

`assets/atlas-mark-ii/layout.json` owns dimensions, moving-part pivots, interior deck heights and mount positions. Coordinates are Y-up, nose −Z, right +X. The Blender helper converts this explicitly to Blender Z-up; glTF restores Y-up. No runtime scale correction is required.

- Nominal unarmed envelope: 64 × 36 × 16 m. Measured geometry bounds are reported by the build manifest, not assumed to fill the envelope.
- Cargo room: 14.4 m wide and 48 m long; floor 2.6 m, ceiling 8.8 m. The central 8 m vehicle lane stays clear.
- Front and aft loading ramps: 11.6 m wide, 8 m long; 6 m main leaves plus 2 m folding tips fit beneath the upper deck, with independent physical hinge nodes.
- Side elevator: 2.8 × 3.6 m, cargo floor to the 9.5 m upper deck; open floor aperture and connected vestibule.
- Upper deck: forward bridge, port crew bunks/lockers/desk and starboard galley/hygiene area.
- Three empty S3 weapon interfaces: two shoulder mounts and one aft dorsal mount. Future mounted weapons can exceed the unarmed height envelope.

The [weapon interface standard](../weapon-mount-standard.md) defines S1 and S3 docking geometry separately from provisional future weapon package dimensions. It does not install weapons or migrate existing Nomad weapon meshes.

## Materials and source

Two generated albedo sources provide subtle ceramic paint and cargo-deck abrasion. Independently authored, deterministic periodic micro-height maps produce normal maps; packed occlusion/roughness/metallic channels use authored material values. Upholstery has a separate procedural weave normal and roughness map. Panel thickness, edge bevels, treads, fasteners, seals, conduit and furniture are actual geometry. Local contact shading is baked into vertex colours with a deterministic twelve-ray hemisphere; moving ramps, gates and lift are isolated during baking so their closed positions do not leave painted shadows on other components. It supplements the PBR maps and does not bake studio lighting. Texture source prompts and hashes live with the source assets.

Rebuild from the repository root with Blender 5.2, Python 3 + NumPy and ImageMagick available:

```sh
python3 assets/atlas-mark-ii/build_textures.py
blender --background --factory-startup -noaudio --python-exit-code 1 --python assets/atlas-mark-ii/build_atlas.py
npm run dev -- --port 5250 --strictPort
```

Open `http://localhost:5250/dev/atlas-mark-ii.html`. The editable packed Blender scene is `assets/atlas-mark-ii/atlas-mark-ii.blend`; the builder is the parametric source. The exporter creates a full-detail GLB and two decimated distance candidates with 512 px and 256 px material derivatives. The inspection scene loads the full-detail model; automatic gameplay LOD switching is not claimed.

The model is batched by material within authored component groups, preserving ramp, elevator and mount transforms. Final UVs use world-axis metre projection, including rotated cylinder end caps. `export_atlas.py` can re-export the saved Blender scene without regenerating its geometry. This is an authoring-quality candidate with an explicit measured budget; it is not approved against the older 60k-triangle / 4 MB ship budget. Distance decimation requires visual review before gameplay use.

## Validation and integration boundary

`npm test` includes layout, animation, physical floor/gate and mount compatibility tests. Browser tests use the actual exported model and exercise an aft ramp → cargo → lift → bridge/crew/galley/hygiene journey, shader errors, inspection presets and phone layout:

```sh
npm run build
npm run test:browser -- -c scripts/atlas-mark-ii.config.js
# On a hardware-capable Linux host:
ATLAS_HARDWARE=1 npm run test:browser -- -c scripts/atlas-mark-ii.config.js
```

This inspection scene is independent of the live fleet, saves and flight controls. Flight integration requires a deliberate new ship layout in `boarding.js`, navigation/collision ownership, powered-cabin behavior, hangar-fit validation, cargo mechanics, controller testing and graphics budget approval. The dedicated walker uses 56 authored furniture/bulkhead AABBs, platform rails, empty-shaft barriers, visible landing gates and closed-door boundaries. These still require deliberate integration with live gameplay physics; a standalone walkthrough is not a full gameplay physics certification.

## Revision after the first walkthrough

The first candidate was a functional blockout with an initial material pass; its visual quality did not meet the requested baseline. The user identified ferry-like windows, gaps beneath the canopy and at door/ceiling joints, and a galley island obstructing circulation. The revised source replaces the glazing band with a recessed raked trapezoid and small angular quarter panes, shares pressure-face boundaries, adds door/ceiling seals, and tapers both the bridge floor and walker boundary. Seven bounded ray tests inspect the exported mesh at the reported pressure interfaces; they are not a complete manifold or atmosphere-simulation certification.

The galley now uses a wall-mounted mess leaf with no island or stools. The tested capsule has 0.96 m through the doorway, 1.60 m along the galley aisle and 0.95 m at the hygiene turn. Three-dimensional furniture remains solid in the standalone walker.

`assets/atlas-mark-ii/design/shape-study.png` is an AI-generated **design study, not an in-game render**. Its prompt is retained beside it. It guides proportions and construction hierarchy; dimension annotations in the concept are not authoritative. The layout JSON remains the dimensional contract. Actual browser evidence is in `docs/qa/atlas-mark-ii/`.


## Upper-deck construction

The crew compartment now has its own forward/aft walls and outboard liner,
closed berth backs, chamfered pressure frames and removable ceiling/wall panels.
The same crown family continues through corridor, galley and bridge. The original
outer hull and drive-pod geometry are retained. Door-frame faces project beyond
partition ends to remove their coplanar flicker. The complete physical browser
route reaches the last bunk, meets the aft wall and returns through the side door.
See [the upper-deck production record](../qa/atlas-mark-ii/upper-deck-record.md).


## Pilot displays and physical controls

`layout.json` owns four PilotMFD anchors and the chair-aligned pilot eye. The shared
MFD renderer accepts those authored mounts, and draws real ramp/lift state at 5 Hz.
F/A at the pilot seat sits down; F/A stands up. Flight, navigation and manifest
pages remain disconnected in this studio. All four screens fit the tested 56°
pilot view. The instrument extension has its own physical collider.

Controls use [the physical button standard](../physical-control-standard.md):
projected labels show Go up/Go down/Call lift and Open/Close ramp from actual
mechanism state, with F/A/TAP activation and disabled interlock states. Preset
buttons hide while walking. The documented hangar contract awaits station adoption.
The [nose/cockpit record](../qa/atlas-mark-ii/cockpit-controls-record.md) includes
actual close-ups, seated renders, browser input checks and remaining boundaries.
