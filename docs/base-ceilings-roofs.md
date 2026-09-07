# Ceiling fixtures and rounded roof skins

Cees requested simple ceiling lights and a separate roof-tile layer with rounded
edges, naming Dune: Awakening as a shape reference. The assets here are original
procedural geometry in `blender/build_base.py`, using the existing mineral-concrete
kit. No game meshes, textures or screenshots are redistributed as assets.

## Building and controls

Structural ceilings are still the existing Floor / flat roof, triangle floor and
quarter-circle floor pieces. The new **Roofs** tab supplies flat, rounded-edge,
rounded-corner, triangle and quarter-circle outer tiles. Each sits6 mm above a
matching supported ceiling; its outer skin rises60 cm. The curved edge faces the
piece's +Z side; a corner curves its +Z and +X sides. LT/RT rotate square edge and
corner tiles. Triangle and quarter-circle caps align to their supporting ceiling.
Each tile costs4 kg concrete and1 kg metal stock. Caps do not substitute for
structural ceilings, and cannot be placed freely on bare terrain or foundations.
This is an exterior finish; weather sealing/pressure simulation is not added here.

Ceiling lights appear in **Power** and **Roofs**. They snap below a supported
ceiling, occupy80×80 cm and project12 cm below its underside. Cost:1 kg metal,
0.5 kg conductor and0.5 kg glass. Aim up and press X/F to switch an individual light.
The switch persists. An enabled lamp adds50 W to site demand; power failure turns
off its emitter and illumination without changing the saved switch position.
Restoring power resumes an enabled lamp. The existing per-piece maintenance load
still applies while its switch is off.

B opens the wheel, LB/RB selects the tab, stick/A selects a piece, A places, X exits.
The shared keyboard and touch routes use the same placement and switch actions.
The Remove tool refuses to remove a ceiling until its attached lights and roof
skins have been removed, and still protects structural dependencies/filled storage.

## Geometry and runtime contracts

`mounts.js` is shared by placement, save validation and removal. Roof footprints
must fit their supporting ceiling polygon; fixtures must fit its underside. Save
restoration and the solo server use the same validation. The light switch is a
validated optional boolean and does not alter immutable piece transforms.

The rounded profile is sampled into original meshes. Conservative collision steps
are concentrated along the curve and tested to remain within16 cm above the visible
surface, below the existing30 cm walking step. The profile/mesh agreement is tested
within1.5 cm. Roof geometry retains concrete wear and metal seams without inventing
powered status indicators on passive roof skins. Per-piece material/triangle budgets
remain enforced. Corner collision is49 small boxes; spatial collision optimization
is still needed for dense settlements and no large-scene FPS claim is made.

Lamps share the existing pool of at most four nearby service lights. Their warm
unshadowed fill uses range12 m and existing distance fade; the renderer does not
allocate one dynamic light per saved lamp. More distant fixtures retain their
emissive appearance while their site is powered. This is deliberately distinct from
future instanced static geometry, streaming, room occlusion and shadow budgets.

## Verification status

- Final unit suite116 configured files passes32.82s on7e34acd; focused mount/profile/actual
  placement/switch/persistence/landing/rotation/live-power tests7/7 pass. All14 GLB geometry/budget tests pass.
- The exporter completed32 assets,60,932 triangles and5,411,100 bytes. Its process
  then hung during audio shutdown; only owned PID3321812 was terminated after the
  complete manifest and GLBs were written and validated. This is not an export
  failure or a claim of a clean Blender process exit.
- A legacy asset test required every concrete asset to have a powered mint marker.
  Passive roof skins now specifically require concrete wear and metal coping;
  original structural pieces retain their prior marker requirements and budgets.
- Production controller1/1 passes2.6min on4325c0b + test-onlyfc6b281, with no
  captured page/console errors; Roofs UI1/1 passes11.4s, including390×844; seven
  prop/assembled-kit views1/1 pass6.1s. The final controller recheck on7e34acd passes1/1 in2.5min with no captured
  errors after review corrections. Physical Xbox and continuous motion/FPS
  acceptance remain separate gates. See [curated evidence](qa/base-ceilings-roofs/README.md).


First controller attempt (source4325c0b) stopped on an existing floor/ceiling
socket: an empty-sky aim from the sandbox spawn projected six metres ahead and
selected the nearer unsupported candidate. The controller fixture now uses the
existing LB snap-cycle action to select its intended supported socket. No runtime
placement/support rule was relaxed. Its optional account probe also reached the
old absent8084 proxy; the fixture now points to the isolated8557 API. Original
failure state, screenshot and log are retained under the task evidence attempt-01.
The first independent CLI code-review request timed out without any model output;
the authorized host retry completed with three functional findings. Its report is
retained in the QA folder; all three were corrected in9aefa1e. Independent
follow-up closed those findings and scored the supplied still images3.6/5, below
final visual acceptance. Roof material detail and lighting refinement remain open.


Review corrections in9aefa1e: roof skins now supply walkable support to the same
collision solver as floors, preventing a falling player from becoming trapped
against a solid top. Square trims rotate relative to the supporting ceiling,
including60° foundations attached to triangular layouts. Visible lamp emissive
state and actual point-light eligibility now use the same live site-power result
on each update, even between ten-second save writes. Duplicate mount candidates
are collapsed, and mounted pieces no longer advertise ineffective height controls.
The seven regression tests exercise the actual collision, material and placement
code; no save or input shortcuts were added. Original GLBs remain byte-identical.


The follow-up review found that expanding each tiny curved-top collision cell
by the full player radius created a high invisible eave. In7e34acd, roof skins
use feet-centre support/contact for their stepped upper surface. Their required
structural ceiling underneath, and every wall/door, retain full-radius capsule
collision. Landing, uphill/downhill travel, rendered-height deviation under16cm
and leaving the eave are now tested directly. This is a deliberate narrow roof
contact rule, not a replacement character-physics solver. Height hints are also
composed conditionally rather than edited through an HTML string round-trip.

Independent final art acceptance remains **open (3.6/5)**: reduce the shared
concrete's directional striping, refine cap seams/quarter arc, soften lamp bloom
and improve small wheel labels. This is a usable development checkpoint; the
review does not establish continuous motion or large-base performance.
