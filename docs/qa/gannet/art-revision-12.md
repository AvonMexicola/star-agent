# Gannet Art12 — connected shell, upholstery and measured contact

Art12 is a development candidate awaiting fresh native capture and independent art review. Art11's failed assessment is preserved: six-item mean **3.90**, silhouette **4.1** against **4.5**. CPU checks do not grant a visual pass. The quality and asset budgets remain binding.

## Candidate and scope

The delta is based on Gannet `985e1fc1787e8a8fb5a6a70e34d4d6c9915090bc`. Its exact path allowlist, base/final hashes and frozen archive are retained locally as `/tmp/star-agent-gannet-art12-delta.*`.

- Actual GLB: `6b4f48ad29aa5cf8a8e6004c0b45861fb65d97a449dc27c7533cbec83e052af8` — **3,290,672 bytes, 55,622 triangles, 33 primitives, 98 nodes**.
- Embedded textures: **three 1024² PBR WebP maps and one 512² emblem WebP image**. Art10's earlier texture-count wording is corrected; Art11's existing correction is retained. Historical asset bytes are unchanged.
- Limits remain 4,000,000 bytes, 60,000 triangles and 1024 maximum texture edge. The complete current Burrow adds 21,526 triangles: the two assets total 77,148 before freight, scene geometry or culling. This is not a rendered scene budget or FPS measurement.
- Canonical layout remains `9334ef7470c6aa1c0d4da7a2ce91d42191fedfdde00bd8732f15675ad904adb5`. No gameplay, loader, systems, shared runtime lights, rover or input fixture changes are included.

## Authored changes

The upper drive cowls now have a narrow crown and two broad chines. More strongly raked, canted fins taper into substantial load saddles; fitted composite service faces follow each actual fin station. A flared cockpit roof fillet joins the pressure crown to the shoulders. The successful fore/aft drives, service waist, chamber backstops and bay roof structure remain.

Seats, head restraints, mattresses and pillows have closed rounded cushion profiles and small physical welt seams. A dark sage textile has distinct rough, nonmetallic response; liner, ceramic and structural finishes remain separate. Berth fronts have real recessed toe space with supporting soles/end feet. Cupboards have fitted floor bases and ceiling returns. Amber remains restricted to guides and access marks.

The preserved Art11 tire/lift gap was **0.025 mm**, berth/floor **0.076 mm**, and cupboard/floor **10.060 mm**. The first two did not support a floating-geometry diagnosis. New cupboard bases reduce the measured gap to **0.076 mm**. These are actual exported geometry measurements at the canonical reference pose, not live suspension measurements.

Static cavity AO uses actual fixed opaque geometry, 24 deterministic cosine-hemisphere rays per sample, a 0.42 m range and 3.5 mm origin bias. It is stored in `COLOR_0`, bounded to at least 0.45, and multiplies the existing material texture. The ORM red channel stays white. Additional floor vertices immediately outside fixed plinth boundaries resolve local contact: sampled values are **0.784/0.792** beside the berths versus **1.0** in the open aisle. This contains no terrain, rover, world-light direction or selected mechanism shadow. The complete elevator, gear and hatch assemblies neither cast nor receive this baked term; their exported colors are exactly white.

## Studio-only receiver correction

The old four unshadowed centreline points had no corresponding bay emitter. Six finite downward fixture sources now attach to the actual cabin strips and named bay diffuser mesh. Four 1024 shadow maps permit real geometry to cast onto the floor and moving lift/reference rover. End fixture cones reach the pilot and portal; no runtime fixture geometry is created. Global lights, environment, exposure, canonical eye, 60° cockpit FOV and existing studio framing/controls are unchanged.

The summed nominal local intensity remains 33 cabin + 20 bay, but point-to-cone conversion is not a radiometric match. The main-game light helper is unchanged and does not inherit these studio shadow settings. Only fresh native images can establish contact appearance, shadow artifacts, shader compilation or the cost of these maps.

## Actual CPU checks and retained failures

The final asset passes **12/12** existing physical/geometry cases, no failures/skips, in **2.814 seconds**, using Burrow `831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468`. These cover full gear poses, both complete 64 SBU banks, the clear bay, rover steering/suspension/door travel through lift heights, player/floor routes, pressure closure, 101 hatch poses, clear forward glass, 36 MFD face rays and fitted display supports. Minimum open-leaf/cap clearance stays 25.82 mm; backing/shelf overlap stays 11.74 mm.

Additional actual-export probes pass:

- **66** retained transforms/parents, **five** bit-identical MFD/glass meshes and **11** unchanged moving envelopes.
- **103** decoded WebP/material/roughness samples, **96** expected outer-surface positions within 3 mm, and **16** recessed-nozzle rays with actual material sides.
- **Eight** finite triangle entry/exit columns connect the new fin/fillet outer faces into their underlying load structure without an intervening air gap. These are sampled geometric connections, not stress analysis or an all-volume proof.
- All **20** PBR primitives retain vertex-color material support; all **12** moving PBR primitives are white. The floor probe checks **3,600** exported top-face samples.
- **Six** actual fixture-to-emitter first hits, clear short downward rays and **seven** occupied target paths. Source attachment does not alter mesh/material identity.

The first Art12 export passed the physical suite but exposed a real fin skin error: one broad nonplanar polygon bridged the canted profile and became buried by up to 37 mm. Splitting the fitted face at actual longitudinal stations fixes its outer position and preserves closed returns. The failed source, asset and receipt remain under `attempt-01/`. Initial test points on cowl bevels, outside a fin inset, and at the intended shoulder/guard overlap were corrected to test the declared faces; original receipts remain. The initial studio cone missed pilot/portal eye paths, so the two end cones were widened at the same fixture positions and nominal intensity. A first CPU helper addressed the quantized floor group instead of its mesh child; the corrected helper preserves that error log.

A repeat full CPU build reproduces the final GLB, collision data and source-map bytes exactly. Editable `.blend` serialization and its manifest hash may differ between saves; no byte-identical blend claim is made. Python/JS syntax and the standalone studio build pass; its greater-than-500 kB chunk warning remains. The authoring mirror uses inherited read-only symlinks and is not the integrated repository-check environment.

Receipts and original failures are retained locally under `/tmp/star-agent-gannet-art12-evidence/`; generated reports are not committed. The author ran no browser/GPU job. This studio build carries the author's older inherited reference rover; root's native build must use the current clear Burrow. Art12 gameplay regression, native desktop/phone/motion review, main-game lighting and performance remain separate checks. Cees retains final product and release acceptance.
