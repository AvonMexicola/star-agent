# Burrow candidate 08 — focused cabin and attachment review

Exact reviewed SHA **`504e7d0d7ea832fab2b135897f1edd6bdc767f971bbf67fa017b3d0c541000e8`**, **21,570 triangles / 2,178,532 bytes**. Frozen asset/layout/builder and read-only probes are retained beside this report. No art score is assigned from source changes; candidate 07's visual review remains the last scored render.

**One localized lower-side gap remains.** The broader closed-cabin grid now has **4 escapes in 762 lateral rays**. All four are on the starboard lower wall, at Z 0.645/0.650 and Y 0.75/1.25. The fixed panel ends at Z 0.640; the rear pillar begins near Z 0.6575, and the new rear window-edge rod starts above Y 1.32. Extending the existing lower panel to Z 0.670 would overlap the pillar without changing the overall envelope or door opening. The upper side/window/header/port-strip failures found on 07 are closed on this grid.

The former deep header interference is resolved. Actual flat moving gasket top is Y **2.359999895** and roof underside is **2.359987007**: the remaining overlap is **12.9 micrometres**, consistent with quantized export rounding at the intended mating plane. The old rubber tube extended about 32 mm into the roof. Component-classified contacts now involve the flat rubber mating face and closed jamb seals; no moving glass or metal contact is found in those header samples. The actual 13-pose door result, including raw contacts, remains in `structure-08.json`.

Other focused checks remain clear:

- **24 wheel states** have zero contacts outside the explicit own-hub/clevis mating allowance.
- **125 entry camera centres** clear radius 0.12 m with minimum surface distance **0.149987 m** using the canonical forward waypoint.
- The stepped stringers, chassis attachments and service-cover overlaps retain their 07 closure; `structure-08.json` measures the actual current geometry.
- Both new lamp brackets intersect the windshield gasket and their lamp housing. Across **18 cutter aim states**, neither head contacts a bracket and all forward muzzle rays are unobstructed for the checked 30 m range.
- The old 32 forward-quarter glazing rays also pass, but the broader 762-ray result is the relevant evidence for the newly repaired side spans.

The lateral rays start at X ±0.76 beside the seat so the seat cannot mask a shell hole. They sample valid side-cell regions behind the sloping forward boundary and seek shell within 0.22 m outward. This is a discrete geometric-gap diagnostic, not a mathematical watertight-solid or gas-pressure certification. Wheel/door/cutter checks likewise sample explicit poses rather than claiming a complete continuous swept volume. Generic mannequin hands/harness contacts remain outside a driving-animation certificate.

## Capture handoff

`capture-08.mjs` is prepared and both outer/embedded JavaScript pass syntax checks. It verifies the exact 08 export, uses its frozen `layout-08.json`, refreshes attached-skin inverse matrices and asserts correct posed-human placement.

The fixture preserves the seven native PBR views and adds two separately labelled diagnostic images: `diagnostic-cockpit-shadow-off.png` and `diagnostic-rear-shadow-off.png`. Each repeats the corresponding native camera with shadows disabled. These diagnose the regular bands; they do not replace the shadowed acceptance evidence or establish performance. Output directory: `/home/cees/projects/.mining-rover-qa/reviewer/candidate-08`. The reviewer has not launched a browser or executed this capture.

Artifacts: `candidate-08.glb`, `layout-08.json`, `builder-08.py`, `candidate-08.mjs`, `joints-08.mjs/.json`, `cabin-08.mjs/.json`, `header-08.mjs/.json`, `structure-08.mjs/.json`, `lamp-08.mjs/.json`, and the corrected capture files. Earlier failed candidates and the candidate 04 erratum are preserved.
