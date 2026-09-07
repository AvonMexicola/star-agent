# Atlas fleet refresh — independent baseline review

**Baseline silhouette: 3.0/5. The required 4.5 silhouette gate is not met.**
The current Atlas has a legible heavy-hauler role, useful scale cues and a strong
cargo layout. Its repeated upper compartments and almost parallel shoulders
still dominate the outline. This is a starting-point review, not a six-criterion
final approval or a recommendation to merge the refresh.

Reviewed asset: `public/models/atlas-mark-ii/atlas-mark-ii.glb`, SHA-256
`a3b6e095060b965fbc51bb7e87dea4f985521d114efeaf5493d18bfe9ea434aa`.
The downloaded preview asset and local binary match. This is the existing PR30
asset in the `6f80fc0` integration baseline, not a newly rebuilt candidate.
I also hashed the `7b97f5a` Git blob independently and obtained the same value.
Reviewed source hashes are recorded in [source-identity.json](source-identity.json).

## Evidence and scope

I captured the actual Three.js preview at `http://localhost:5250/dev/atlas-mark-ii.html`
in Chromium 151.0.7922.173, desktop 1440×900 and touch-capable phone 390×844.
The recorded backend is ANGLE/OpenGL ES 3.2 on AMD Radeon 860M, radeonsi krackan1
ACO. The main capture case passed in 22.9 seconds with no recorded browser
warnings or errors. This elapsed test time is not an FPS measurement.

The own captures include [exterior](desktop-exterior.png),
[low quarter](desktop-low-quarter.png), [side](desktop-side.png),
[plan](desktop-plan.png), [verified bow](desktop-bow-verified.png),
[stern](desktop-stern.png), [aft](desktop-aft.png),
[cargo](desktop-cargo.png), [bridge](desktop-bridge.png),
[crew](desktop-crew.png), [galley](desktop-galley.png),
[lift](desktop-elevator.png), [mounts](desktop-mounts.png),
[open aft boarding ramp](desktop-boarding.png), [seated MFDs](desktop-seated.png)
and the corresponding phone exterior, crew and seated views.
Camera, state and backend records are in [browser-evidence.json](browser-evidence.json).
The capture spec and the resource/contract audit scripts are retained beside
this report. They reuse the installed review dependencies in the Kestrel
worktree; no Atlas production source or dependencies were changed.

**`desktop-bow.png` and `desktop-bow-replacement.png` are invalid shape evidence.**
My cameras at z = −105 and −72 were behind the studio backdrop at z = −68,
which occluded the ship. Both failed frames are preserved; they are reviewer
camera errors, not asset defects. The second browser case passed its automation
checks in 7.0 seconds, but image inspection invalidated it. A final view at
z = −62 passed in 7.6 seconds with no browser diagnostics. I inspected that
image: the complete bow is visible, the camera is in front of the actual scene
backdrop and every model vertex projects inside the available frame. See
[bow-verified-evidence.json](bow-verified-evidence.json) and
[capture-validity.json](capture-validity.json). There are 18 valid own views
and two preserved invalid ones. The bow confirms the 3.0 silhouette score.

The seated shots use a fixture at the authored stand position and invoke the
real seat interaction. They establish appearance from the actual pilot eye;
they do not prove the full boarding journey. I opened the aft ramp in the real
runtime and inspected the resulting pose. I did not run the complete input,
moving-part clearance, flight or performance acceptance suite in this baseline.

I also inspected inherited `docs/qa/atlas-mark-ii/first-exterior.png`,
`nose-after.png`, `final-cargo.png` and `pilot-mfds.png`, plus the original design
and visual reviews. Those are historical context, not my captures. The earlier
2.4 average belongs to the initial asset; I have not reused it as the current
score or treated the later builder fixes as independent approval.

## Ranked production work

1. **Give the large masses a clearer hierarchy before adding detail.** The
   [side](desktop-side.png) and [plan](desktop-plan.png) views still read as a
   long upper carriage on broad pontoons. In `build_atlas.py`, the four upper
   armour intervals, repeated vent cassettes and three shoulder plates per side
   retain a very even visual rhythm despite their small height differences.
   Develop a distinct protected bow, long cargo load spine and aft power mass.
   Change the outer fairing sections and where their volume peaks; do not merely
   add another plate pattern. Preserve the upper floor, pressure-room clearances
   and bridge eye while changing the envelope outside those occupied volumes.

2. **Unify the bow arch, jaw and shoulders as load-bearing construction.** In
   the [low-quarter view](desktop-low-quarter.png), the forward ceramic arch
   reads like an awning above separate cheek blocks, while the shoulder roofs
   remain broad, flat shelves. `build_loading_bow()` in `drive_pods.py`,
   `build_bow_cheek()` in `armour_forms.py` and the heavy-lift shoulder loft in
   `build_atlas.py` should share a stronger taper and a readable structural
   connection. Keep the arch outside the 11.6 m loading aperture. The current
   arch feet do attach into the cheek region in source; this is a visual massing
   criticism, not a claim that those meshes float physically.

3. **Rebuild the engine and hardware topology around visible function.** Each
   drive currently costs **54,996 triangles**, more than 90% of the whole-ship
   target by itself. `drive_pods.py` combines 24 petals, throat sections,
   actuators and straighteners per engine with multiple dense torus rings and
   beveled fasteners. Preserve deep outlets, convincing petals, cooling paths
   and the octagonal external silhouette with deliberately authored low-poly
   stock. Bake fine rings, bolts and grooves. A first allocation of roughly
   4–5k triangles per engine is reasonable to test, not an achieved result.

4. **Author retractable landing assemblies and the space they occupy.** The
   six existing feet at x = ±7, z = −18, 2 and 20 are fixed geometry batched into
   `ExteriorStructure`; the export has no named gear transforms. Their narrow
   struts are visible beneath the broad body, but no stowage or retraction is
   established. Block the bays, pivots, doors and load paths together. Prove the
   actual swept meshes clear the pressure bed, longerons, ramps and each other.
   A new gear rig must fit the aggregate triangle budget from its first blockout.

5. **Make surface finish communicate material and scale.** The family palette
   already works: ivory armour, graphite structure, petrol service panels and
   restrained mint/amber indicators. However, broad armour looks very plain,
   while the steel MFD frames and cargo beams show coarse, mottled grain. See
   [seated](desktop-seated.png) and [cargo](desktop-cargo.png). Use material masks
   for ceramic, coated metal, brushed mechanisms and rubber; keep wear around
   contacts, handles, loading edges and hot outlets. Carry exact stencils through
   the authored masks. A Meshy pass alone will not resolve the massing or justify
   broad random staining. Retain the source maps and original UV correspondence
   when the required new material pass is performed.

The cargo hold is the strongest existing space: its central lane, shelf edges,
overhead services and mounted bay signs clearly explain the ship's job. Preserve
that legibility while simplifying the repeated stock. Crew berths are enclosed
within authored pressure ends, outboard liners and berth surrounds; they are
not an unbuilt room. The galley has a wall-mounted mess leaf and a usable route
to hygiene. These interiors need refined materials and less repetitive small
geometry, not a replacement layout that sacrifices the successful circulation.

## Measured resource costs and a workable budget

[resource-audit.json](resource-audit.json) accounts for the actual GLB accessors,
image payloads, mesh groups and all three supplied LOD files.

| Supplied file | Triangles | Exported vertices | Bytes | Draw primitives |
| --- | ---: | ---: | ---: | ---: |
| Hero | 412,988 | 635,968 | 38,037,892 | 168 |
| LOD1 | 133,848 | 251,350 | 13,909,084 | 168 |
| LOD2 | 43,340 | 77,191 | 4,216,528 | 168 |

The hero is **6.88× the triangle limit and 9.51× the byte limit**. Its ten embedded
1024² PNG maps occupy 9,954,418 bytes. The rest is about 28.08 MB, principally
vertex and index data. Converting PNGs alone cannot meet 4 MB. LOD2 passes the
static triangle limit but remains 216,528 bytes over the file limit and does not
reduce primitive count. All three files total 56,163,504 bytes; the current
studio explicitly loads the hero. Switching to LOD2 would not establish the new
silhouette, mechanism or material gate.

The hero stores positions and normals as 7.63 MB each, UVs as 5.09 MB, indices as
2.74 MB, and normalized unsigned-short contact colour as 4.82 MB. Contact AO is
meaningful existing shading: reduce its encoding or bake it deliberately rather
than dropping it. The steel material alone accounts for 180,520 triangles.
`geo.py` bevels many rods and boxes and uses 32×8 torus stock; those construction
choices multiply into far more geometry than the silhouette needs.

A proposed first allocation, to verify on export rather than assume:

| Whole visible ship allocation | Triangle allowance |
| --- | ---: |
| Exterior load structure, armour and both drives | 22,000 |
| Cargo hold, fixtures and overhead structure | 10,000 |
| Upper deck, bridge, crew, galley and hygiene | 12,000 |
| Both ramps/tips, lift/gates and new landing gear | 10,000 |
| Three S3 empty interfaces and covers | 2,000 |
| Markings, light housings and remaining small fittings | 2,000 |
| Reserve, including four runtime MFD surfaces | 2,000 |
| **Total ceiling** | **60,000** |

Target roughly 60k or fewer exported vertices after deliberate hard-edge/UV
seam placement, about 2.6 MB for mesh/index/JSON data and at most 1.2 MB for
shared 1024²-or-smaller WebP maps. Those are planning allowances, not promises
about final encoding. Use shared trim/atlas regions, restrained material splits
and baked fine detail; re-export and measure after each major assembly. Preserve
mechanism transforms and visibility zones when combining compatible meshes.
Distance LODs should reduce draw cost as well as triangles and must retain the
required apertures and attachment frames.

Ten decoded RGBA8 1024² maps with full mip chains would require approximately
53.3 MiB before other renderer resources. That is a format-based estimate, not
measured GPU memory. Four runtime canvas MFD textures and their eight triangles
are additional to the static GLB counts. No studio FPS or full-game performance
claim is made here.

## Physical and named contracts to preserve

[contract-audit.json](contract-audit.json) records my exact world-vertex bounds,
named frames and a limited runtime/geometry audit. The original systems source
was bound to the original GLB in Node, with material references omitted solely
to avoid browser image decoding. Geometry was not simplified or changed.

- The visible closed asset measures **61.787 m long × 35.711 m wide × 14.619 m
  high**, inside the nominal 64×36×16 m envelope. All 635,968 exported vertices
  were included; this is not a loose transformed-box measurement.
- `RampFront`, `RampAft`, both folding tips, `CrewElevator`, both landing gates
  and the four `PilotMFD_*` transforms remain separate named frames. Both ramps
  reached their authored open angles with their tips unfolded. The lift carried
  a centred rider from 2.6 m to 9.5 m with its gate interlock active.
- All **174 sampled downward rays** hit the visible cargo, corridor, open ramp
  or lift surfaces near the runtime support height. Offsets range from −3 cm in
  cargo seams to +6.35 cm on ramp traction detail; the lift inset is +5 cm. These
  limited samples support preserving the current floor contract. They do not
  certify every contact, sweep, pressure seam or capsule route.
- The sampled galley doorway, hygiene passage and crew doorway are passable in
  the actual collider code. The crew aisle at x = −3.1 passes all three berths;
  a straight path at x = −2.5 correctly meets the fold desk. Keep geometry and
  `interior-colliders.json` in agreement when simplifying these fixtures.
- `Mount_S3_DorsalPort`, `Mount_S3_DorsalStarboard` and `Mount_S3_Aft` match the
  layout and shared S3 metadata. Their local +Y normals face up. Dorsal bores
  face −Z; the aft defence frame intentionally rotates its bore to +Z. The helper
  accepts S3 and rejects S1 under exact-size compatibility. This baseline shared
  standard contains S1/S3, so coordinate the later Kestrel S2 addition when
  updating shared files. These are empty fittings, not installed weapons or
  certification of the provisional weapon package envelope.
- There are no embedded glTF animation clips. Ramp and lift motion is currently
  owned by `AtlasMarkIISystems`; lack of clips is not itself a broken mechanism.

## Inspection issues and remaining gates

**Functional priority 1: the lower lift call station intrudes into the declared
8 m vehicle lane and has no matching walking collider.** In `build_atlas.py`, its stand and housing
are centred at x = 3.5, z = −5.1. Independent horizontal rays against the actual
GLB hit the housing at **x = 3.275, y = 3.92, z = −5.1**, well inside the lane's
x = ±4 boundary. The stand and touch face were also hit at x = 3.420 and 3.350.
The runtime nevertheless allows a standing walker to cross this fixture from
(3.5, 4.35, −6) to (3.5, 4.35, −4.5). The existing through-lane tests check the
centre line only. Move the call assembly outside the full vehicle envelope,
keep it reachable, and give its visible solid parts matching collision. Add an
actual mesh clearance check across the lane width. This confirmed baseline
defect is recorded separately from the successful floor-support samples above.

**Functional priority 2: inspection framing.** The [phone exterior](phone-exterior.png) crops both ends of the ship, and the
[phone seated view](phone-seated.png) cuts off the outer MFDs. Desktop MFDs are
readable and show truthful offline/state information. Fit exterior presets to
the available phone canvas and provide readable seated screen inspection while
preserving the physical eye and screen placement. Some desktop detail presets
also leave the large identity overlay over the subject.

Before material detail, the rebuilt silhouette needs a fresh independent 4.5
gate using complete bow, stern, side, plan and three-quarter views. Subsequent
work still requires the full six-criterion review, aggregate budget check,
actual ramp/lift/gear clearance, complete boarding/circulation journey,
keyboard/controller/touch checks and isolated hardware profiling requested in
the brief. The current baseline has no new art approval and no merge approval.
