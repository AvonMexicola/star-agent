# Gannet Art11 — primary form and inspection revision

Art11 is a frozen development candidate awaiting native capture and independent visual review. No Art11 GPU or art acceptance result is claimed here. Art10's failed independent assessment remains the comparison baseline: static mean 3.62, silhouette 3.7 against the required 4.5. The quality and asset budgets remain binding.

## Frozen candidate

The source delta is based on Gannet commit `a58faba00c10d67ef467b6f4493ce8a0b03772c0`. The nine-file archive and exact base/final hashes remain in the local evidence archive `/tmp/star-agent-gannet-art11-delta.*`; this document is delivered separately.

- GLB SHA256: `51f5578cc89f863453f937c7af5afb6bcee71fe4c4ef6a1e40105bd271bdaef1`.
- **2,439,212 bytes; 45,394 triangles; 33 primitives; four embedded 1024 WebP maps.** Limits remain 4,000,000 bytes, 60,000 triangles and 1024 texture edge.
- Editable blend: `5568605d44eb020bce991d1bf0362a1bf5bce3f22bd52a2f78aab6a8d79ce96c`; builder: `3510586a53bd02c49622284274a70c36fffec703337209599ed16746ea47b678`.
- Canonical layout remains `9334ef7470c6aa1c0d4da7a2ce91d42191fedfdde00bd8732f15675ad904adb5`. Original PBR generator/maps and Art10's corrected atlas routing are unchanged.

## Authored changes

The long drive hull now has distinct forward power/gear and aft engine sections joined by a narrower, raised service section. Shaped shoulders join those drives to the pressure cell. Clipped, canted fins have substantial load saddles. The ceramic cowls end over the graphite structure, avoiding the previous nearly coincident full-height side faces.

Maintenance lids have fitted returns and gaskets. An actual machined thermal pocket contains mounted heat-exchange blades. The repeated crown lids give way to a forward pressure-access assembly and an aft climate housing with a service well. Two exterior load arches carry longitudinal bay roof cassettes. Graphite engine collars and recessed throats have restrained metal bands/lips and real chamber backstops.

The pressure enclosure, interior fittings, 5.8 m clear bay, 128 SBU side banks, rover/player paths, mechanical motion, fixed anchors and named lamp faces are preserved. No shared gameplay, runtime lighting, rover, loader or system file changes are included.

## Actual CPU verification

The final candidate passes **12/12 physical/geometry tests**, zero failures or skips, in **1.858 seconds**, using clear Burrow asset `831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468`. Coverage includes complete gear poses, full freight and bay volumes, current rover steering/suspension/door sweeps, physical player/floor routes, pressure closure, 101 hatch poses, clear pilot glass and all four actual display faces. Minimum open-leaf/cap clearance remains 25.82 mm; MFD backing/shelf overlap remains 11.74 mm.

Additional actual-export probes pass:

- **66** retained named transforms/parents, **five** bit-identical MFD/glass meshes and **11** retained moving envelopes.
- **77** first-hit material/roughness samples decoded from the actual embedded WebP maps and **70** expected outer-surface positions within 3 mm. The sampled cowl, lid, roof and fin skins are visible ahead of their supporting geometry.
- **16** nozzle rays reach the recessed chamber behind Z 9.85 with default material-side settings.
- Both bay lamp anchors retain their coordinates and actual mint faces, with 40.077 mm anchor-minus-0.04Y to face gaps.

The local receipts are under `/tmp/star-agent-gannet-art11-evidence/`; they are retained local artifacts, not committed generated reports. These CPU checks do not compile shaders or establish visual quality. JS/Python syntax, scoped whitespace and the standalone studio build pass; the build retains its recorded greater-than-500 kB chunk warning.

## Preserved failures and studio coverage

First Art11 asset `1236f991…` passed the physical suite but failed all 16 nozzle-backstop rays: removing the old full-height drive body exposed gaps between stators without a nearby chamber surface. Its source, asset and failed receipt remain preserved. The final recessed dark bulkhead resolves that gap while keeping the nozzle mouth open.

An initial surface fixture expected a flat plane at two points on the intended 55 mm cowl bevel. Both already hit ceramic, about 6 mm inside that plane. The unchanged asset then passed representative planar-interior samples. The original failed expectations and corrected fixture are both retained; material checks and tolerances were not weakened.

The studio now reserves a canvas outside its header, controls and footer. Cockpit FOV is 60 degrees at the unchanged canonical eye, with fixed-eye left/forward/right inspection for portrait outer displays. The prepared browser fixture preserves all 13 existing screenshots and assertions, adds eight motion/portrait views, and checks actual MFD corners, eye/FOV and chrome overlap. It selects rear and underside presets before actuating the hatch and both gear directions.

**Native execution of those additions is still pending.** Root will build and capture from the current medium integration with clear Burrow. The isolated author's inherited rover reference is older and is not part of this delta. Actual gameplay, lighting, touch/controller, performance and final independent art acceptance remain separate evidence.
