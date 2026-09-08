# Gannet Art10 — authored revision, native review pending

Art10 responds to the failed Geometry09 native art review. Source commit `a58faba` is integrated by `70aa30c`; root verified all 13 delivered file hashes. This is an authored development checkpoint, not visual or gameplay acceptance.

The final GLB SHA256 is `ca49eb995747a9fa665833729b3a370e757bcb0dd0d7e537695603b8705d6303`: **2,251,080 bytes, 41,302 triangles, 33 mesh primitives and three 1024² PBR WebP maps and one 512² emblem WebP image**. Canonical layout, pilot eye, displays, access routes and mechanism ranges remain unchanged.

## Changes and reproduced defects

- **Texture atlas mismatch:** Blender UVs used the PNG row direction directly. Exported graphite floor UVs consequently sampled amber: Geometry09's actual lift pixel was `[189,139,62]`. One source V conversion now yields the intended graphite `[39,51,57]`; ceramic, petrol, metal, rubber and liner samples also match their declared materials. Coherent scanline normals were removed, and roughness/metal separation was refined. Materials were not brightened to compensate for missing runtime lamps.
- **Hull forms:** continuous graphite drive keels now support shaped fore/aft ceramic cowls, a recessed thermal bridge and maintenance covers fitted to the varying hull surface. Shoulder guards, roof service lids and bay crossbeams give the transport more structure. Actual width increases about 40 mm per side, remaining within the unchanged 16 m flight envelope.
- **Obstructed nozzles:** closed drive end caps blocked the existing hollow shrouds. Actual coaxial bores now expose the working recess. Sixteen axial first-hit rays improve from **0/16 to 16/16** passing, with the failed asset retained.
- **Foot surfaces:** the steel shoe and rubber sole previously shared their Y=0 bottom faces. The steel now starts above the sole, retaining overlap at their joint and the same complete moving envelope.
- **Bay lamps:** two actual flush roof diffusers and fitted frames sit at X±1.88, Y4.601, Z7.44, preserving clear space through Y4.600. Named anchors `CabinLight_Bay_Port` and `CabinLight_Bay_Starboard` support the separately owned runtime light helper. Existing cabin strip geometry is unchanged.

## Validation and limits

The unchanged Gannet suite passes **12/12, zero failures/skips**, including actual clear-windscreen Burrow `831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468`; that run took 1.591 s. Checks cover the bay and both 64 SBU freight banks, rover steering/suspension/door and player routes, supporting floors, pressure skins, full hatch travel, gear bounds, clear pilot glass, all 36 MFD face rays and fitted display supports.

Additional CPU probes pass seven actual first-hit UV/decoded-WebP/ORM samples, sixteen nozzle-depth rays, 64 retained named transforms, five byte-identical display/glass meshes and eleven unchanged moving envelopes within1 mm. The lighting owner separately verifies six actual Gannet emitter attachments and eleven finite cabin/bay target paths. These are geometry checks, not rendered illumination or shadow evidence.

The first build failed before publication because a material-less Boolean cutter introduced an empty material slot; assigning its real surface material corrected that failure. Earlier UV, nozzle and foot failures remain in the local evidence archive, together with the successful CPU export logs and their optional Blender extension warnings. Syntax, whitespace and frozen-archive hash checks pass.

Retained local evidence is under `/tmp/star-agent-gannet-art10-evidence/`; it is not committed and is not a portable CI artifact. Root owns fresh native desktop/phone captures, shader diagnostics, camera/lighting integration and gameplay/input verification. The author ran no GPU job and assigns no independent score to this revision. Geometry09's failed visual assessment remains historical evidence; Art10 is awaiting independent native review.
